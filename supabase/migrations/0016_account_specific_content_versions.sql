-- Account-specific content versions. The original post remains the shared fallback;
-- an account version may override copy, platform options and media independently.

create table public.social_post_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  post_id uuid not null,
  social_account_id uuid,
  is_default boolean not null default false,
  title text,
  body text not null default '',
  platform_options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (post_id,organization_id)
    references public.social_posts(id,organization_id) on delete cascade,
  foreign key (social_account_id,organization_id)
    references public.social_accounts(id,organization_id) on delete restrict,
  unique (id,organization_id),
  check (jsonb_typeof(platform_options)='object'),
  check (length(body)<=20000),
  check ((is_default and social_account_id is null) or
         (not is_default and social_account_id is not null))
);
create unique index social_post_versions_default_uq
  on public.social_post_versions(post_id) where is_default;
create unique index social_post_versions_account_uq
  on public.social_post_versions(post_id,social_account_id) where not is_default;
create index social_post_versions_post_idx
  on public.social_post_versions(organization_id,post_id);

create table public.social_post_version_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  version_id uuid not null,
  asset_id uuid not null,
  position integer not null default 0 check(position>=0),
  alt_text text,
  created_at timestamptz not null default now(),
  foreign key (version_id,organization_id)
    references public.social_post_versions(id,organization_id) on delete cascade,
  foreign key (asset_id,organization_id)
    references public.social_media_assets(id,organization_id) on delete restrict,
  unique(version_id,asset_id),
  unique(version_id,position)
);
create index social_post_version_media_asset_idx
  on public.social_post_version_media(organization_id,asset_id);

create trigger social_post_versions_set_updated_at
  before update on public.social_post_versions
  for each row execute function public.set_updated_at();

alter table public.social_post_versions enable row level security;
alter table public.social_post_version_media enable row level security;

create policy social_post_versions_select_brand on public.social_post_versions
  for select to authenticated using (
    exists(select 1 from public.social_posts p
      where p.id=post_id and p.organization_id=organization_id
        and private.can_access_brand(p.brand_id,p.organization_id))
  );
create policy social_post_version_media_select_brand on public.social_post_version_media
  for select to authenticated using (
    exists(select 1 from public.social_post_versions v
      join public.social_posts p on p.id=v.post_id and p.organization_id=v.organization_id
      where v.id=version_id and v.organization_id=organization_id
        and private.can_access_brand(p.brand_id,p.organization_id))
  );

revoke all on public.social_post_versions,public.social_post_version_media from anon;
revoke insert,update,delete on public.social_post_versions,public.social_post_version_media from authenticated;
grant select on public.social_post_versions,public.social_post_version_media to authenticated;
grant all on public.social_post_versions,public.social_post_version_media to service_role;

-- Backfill every existing post before switching API/worker reads.
insert into public.social_post_versions(
  organization_id,post_id,social_account_id,is_default,title,body,platform_options
)
select p.organization_id,p.id,null,true,p.title,p.body,'{}'::jsonb
from public.social_posts p
where not exists(select 1 from public.social_post_versions v
  where v.post_id=p.id and v.is_default);

insert into public.social_post_version_media(organization_id,version_id,asset_id,position,alt_text)
select m.organization_id,v.id,m.asset_id,m.position,m.alt_text
from public.social_post_media m
join public.social_post_versions v on v.post_id=m.post_id
  and v.organization_id=m.organization_id and v.is_default
on conflict do nothing;

-- Preserve legacy target overrides as account-specific versions.
insert into public.social_post_versions(
  organization_id,post_id,social_account_id,is_default,title,body,platform_options
)
select t.organization_id,t.post_id,t.social_account_id,false,p.title,
  coalesce(t.caption_override,p.body),coalesce(t.platform_options,'{}'::jsonb)
from public.social_post_targets t
join public.social_posts p on p.id=t.post_id and p.organization_id=t.organization_id
where (t.caption_override is not null or t.platform_options<>'{}'::jsonb)
  and not exists(select 1 from public.social_post_versions v
    where v.post_id=t.post_id and v.social_account_id=t.social_account_id);

insert into public.social_post_version_media(organization_id,version_id,asset_id,position,alt_text)
select m.organization_id,v.id,m.asset_id,m.position,m.alt_text
from public.social_post_media m
join public.social_post_versions v on v.post_id=m.post_id
  and v.organization_id=m.organization_id
  and (v.is_default or exists(select 1 from public.social_post_targets t
    where t.post_id=v.post_id and t.organization_id=v.organization_id
      and t.social_account_id=v.social_account_id))
on conflict do nothing;

-- Preserve the existing atomic post/target/outbox transaction, then add versions
-- before commit so a scheduled worker can never observe an unversioned post.
create or replace function public.create_social_post_bundle_with_versions(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_brand_id uuid := (p_payload->>'brand_id')::uuid;
  v_post_id uuid;
  v_version_id uuid;
  v_item jsonb;
  v_asset_id uuid;
  v_account_id uuid;
  v_position integer;
  v_body text;
  v_options jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_payload->'account_versions','[]'::jsonb)) <> 'array' then
    raise exception 'Account versions must be an array' using errcode='22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'account_versions','[]'::jsonb)) > 20 then
    raise exception 'At most 20 account versions are allowed' using errcode='22023';
  end if;

  -- This function is called inside the same PostgreSQL transaction.
  v_post_id := public.create_social_post_bundle(p_payload);

  insert into public.social_post_versions(
    organization_id,post_id,social_account_id,is_default,title,body,platform_options
  )
  values(v_org_id,v_post_id,null,true,nullif(p_payload->>'title',''),
    coalesce(p_payload->>'body',''),'{}'::jsonb)
  returning id into v_version_id;

  insert into public.social_post_version_media(organization_id,version_id,asset_id,position,alt_text)
  select organization_id,v_version_id,asset_id,position,alt_text
  from public.social_post_media
  where organization_id=v_org_id and post_id=v_post_id
  order by position;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'account_versions','[]'::jsonb))
  loop
    if jsonb_typeof(v_item)<>'object' then
      raise exception 'Each account version must be an object' using errcode='22023';
    end if;
    v_account_id := (v_item->>'account_id')::uuid;
    v_body := coalesce(v_item->>'body',p_payload->>'body','');
    v_options := coalesce(v_item->'platform_options','{}'::jsonb);
    if v_account_id is null or length(v_body)>20000 or jsonb_typeof(v_options)<>'object' then
      raise exception 'Invalid account-specific content version' using errcode='22023';
    end if;
    if not exists(select 1 from public.social_post_targets t
      where t.post_id=v_post_id and t.organization_id=v_org_id
        and t.social_account_id=v_account_id) then
      raise exception 'Account version does not belong to a selected destination' using errcode='42501';
    end if;
    if exists(select 1 from jsonb_array_elements(coalesce(p_payload->'account_versions','[]'::jsonb)) x
      where x->>'account_id'=v_account_id::text
      group by x->>'account_id' having count(*)>1) then
      raise exception 'Duplicate account version supplied' using errcode='22023';
    end if;

    insert into public.social_post_versions(
      organization_id,post_id,social_account_id,is_default,title,body,platform_options
    ) values(v_org_id,v_post_id,v_account_id,false,
      nullif(v_item->>'title',''),v_body,v_options)
    returning id into v_version_id;

    v_position := 0;
    for v_asset_id in
      select value::text::uuid
      from jsonb_array_elements_text(coalesce(v_item->'asset_ids',p_payload->'asset_ids','[]'::jsonb))
    loop
      if not exists(select 1 from public.social_media_assets a
        where a.id=v_asset_id and a.organization_id=v_org_id and a.brand_id=v_brand_id
          and a.processing_status='ready') then
        raise exception 'Version media must be ready and belong to the post brand' using errcode='42501';
      end if;
      insert into public.social_post_version_media(organization_id,version_id,asset_id,position)
      values(v_org_id,v_version_id,v_asset_id,v_position);
      v_position := v_position+1;
      if v_position>20 then
        raise exception 'A content version may contain at most 20 media assets' using errcode='22023';
      end if;
    end loop;
  end loop;
  return v_post_id;
end;
$$;
revoke all on function public.create_social_post_bundle_with_versions(jsonb) from public,anon;
grant execute on function public.create_social_post_bundle_with_versions(jsonb) to authenticated;

comment on table public.social_post_versions is
  'Immutable-at-publish content snapshots: one default fallback plus optional account-specific copy and platform options.';
comment on table public.social_post_version_media is
  'Ordered media attachments for a particular default or account-specific content version.';
