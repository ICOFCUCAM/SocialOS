-- SocialOS publishing pipeline foundation.
-- All writes are backend/worker mediated; authenticated clients receive tenant-scoped read access only.

do $$ begin
  create type public.social_post_status as enum
    ('draft','scheduled','processing','published','partially_published','failed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.social_post_target_status as enum
    ('pending','queued','publishing','published','failed','skipped','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.publish_job_status as enum
    ('queued','running','retry','succeeded','dead_letter','cancelled');
exception when duplicate_object then null; end $$;

create table public.social_media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_bucket text not null,
  storage_object_key text not null,
  original_filename text,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  checksum_sha256 text,
  processing_status text not null default 'pending'
    check (processing_status in ('pending','processing','ready','failed','quarantined')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (brand_id,organization_id) references public.brands(id,organization_id) on delete restrict,
  unique (id,organization_id),
  unique (storage_bucket,storage_object_key)
);
create index social_media_assets_brand_idx on public.social_media_assets(organization_id,brand_id,created_at desc);

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  title text,
  body text not null default '',
  status public.social_post_status not null default 'draft',
  scheduled_at timestamptz,
  timezone text not null default 'UTC',
  published_at timestamptz,
  cancelled_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (brand_id,organization_id) references public.brands(id,organization_id) on delete restrict,
  unique (id,organization_id),
  check (status <> 'scheduled' or scheduled_at is not null)
);
create index social_posts_brand_created_idx on public.social_posts(organization_id,brand_id,created_at desc);
create index social_posts_schedule_idx on public.social_posts(scheduled_at) where status='scheduled';

create table public.social_post_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  post_id uuid not null,
  asset_id uuid not null,
  position integer not null default 0 check (position >= 0),
  alt_text text,
  created_at timestamptz not null default now(),
  foreign key (post_id,organization_id) references public.social_posts(id,organization_id) on delete cascade,
  foreign key (asset_id,organization_id) references public.social_media_assets(id,organization_id) on delete restrict,
  unique (post_id,asset_id),
  unique (post_id,position)
);
create index social_post_media_asset_idx on public.social_post_media(asset_id);

create table public.social_post_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  post_id uuid not null,
  social_account_id uuid not null,
  status public.social_post_target_status not null default 'pending',
  platform_post_id text,
  platform_permalink text,
  caption_override text,
  platform_options jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  published_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (post_id,organization_id) references public.social_posts(id,organization_id) on delete cascade,
  foreign key (social_account_id,organization_id) references public.social_accounts(id,organization_id) on delete restrict,
  unique (id,organization_id),
  unique (post_id,social_account_id)
);
create index social_post_targets_post_idx on public.social_post_targets(organization_id,post_id);
create index social_post_targets_account_idx on public.social_post_targets(organization_id,social_account_id);

create table public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  post_id uuid not null,
  target_id uuid not null,
  status public.publish_job_status not null default 'queued',
  idempotency_key text not null unique,
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  last_error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (post_id,organization_id) references public.social_posts(id,organization_id) on delete cascade,
  foreign key (target_id,organization_id) references public.social_post_targets(id,organization_id) on delete cascade,
  check ((status='running' and locked_at is not null and locked_by is not null)
      or (status<>'running' and locked_at is null and locked_by is null))
);
create index publish_jobs_claim_idx on public.publish_jobs(available_at,created_at)
  where status in ('queued','retry');
create index publish_jobs_target_idx on public.publish_jobs(organization_id,target_id,created_at desc);

create trigger social_media_assets_set_updated_at before update on public.social_media_assets
  for each row execute function public.set_updated_at();
create trigger social_posts_set_updated_at before update on public.social_posts
  for each row execute function public.set_updated_at();
create trigger social_post_targets_set_updated_at before update on public.social_post_targets
  for each row execute function public.set_updated_at();
create trigger publish_jobs_set_updated_at before update on public.publish_jobs
  for each row execute function public.set_updated_at();

-- Claim jobs atomically. SKIP LOCKED permits multiple workers without double-claiming.
create or replace function public.claim_publish_jobs(p_worker_id text,p_limit integer default 10)
returns setof public.publish_jobs
language sql
security definer
set search_path=public,pg_temp
as $$
  with candidates as (
    select id
    from public.publish_jobs
    where status in ('queued','retry')
      and available_at <= now()
      and attempt_count < max_attempts
    order by available_at,created_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,10),50))
  )
  update public.publish_jobs j
  set status='running',locked_at=now(),locked_by=p_worker_id,
      attempt_count=j.attempt_count+1
  from candidates c
  where j.id=c.id
  returning j.*;
$$;

revoke all on function public.claim_publish_jobs(text,integer) from public,anon,authenticated;
grant execute on function public.claim_publish_jobs(text,integer) to service_role;

alter table public.social_media_assets enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_media enable row level security;
alter table public.social_post_targets enable row level security;
alter table public.publish_jobs enable row level security;

create policy social_media_assets_select_brand on public.social_media_assets
  for select to authenticated using (public.can_access_brand(brand_id,organization_id));
create policy social_posts_select_brand on public.social_posts
  for select to authenticated using (public.can_access_brand(brand_id,organization_id));
create policy social_post_media_select_tenant on public.social_post_media
  for select to authenticated using (
    exists(select 1 from public.social_posts p
      where p.id=post_id and p.organization_id=organization_id
        and public.can_access_brand(p.brand_id,p.organization_id))
  );
create policy social_post_targets_select_tenant on public.social_post_targets
  for select to authenticated using (
    exists(select 1 from public.social_posts p
      where p.id=post_id and p.organization_id=organization_id
        and public.can_access_brand(p.brand_id,p.organization_id))
  );
create policy publish_jobs_select_tenant on public.publish_jobs
  for select to authenticated using (
    exists(select 1 from public.social_posts p
      where p.id=post_id and p.organization_id=organization_id
        and public.can_access_brand(p.brand_id,p.organization_id))
  );

-- Browser roles can read tenant-scoped publishing records, but all writes go through trusted APIs/workers.
revoke all on public.social_media_assets,public.social_posts,public.social_post_media,
  public.social_post_targets,public.publish_jobs from anon;
revoke insert,update,delete on public.social_media_assets,public.social_posts,public.social_post_media,
  public.social_post_targets,public.publish_jobs from authenticated;
grant select on public.social_media_assets,public.social_posts,public.social_post_media,
  public.social_post_targets,public.publish_jobs to authenticated;
grant all on public.social_media_assets,public.social_posts,public.social_post_media,
  public.social_post_targets,public.publish_jobs to service_role;

comment on table public.publish_jobs is
  'Durable publishing outbox. Workers claim jobs with claim_publish_jobs; provider adapters must enforce idempotency and platform-specific capability checks.';


-- Create a post, attach ready assets, add channel targets and enqueue scheduled work
-- in one transaction. The caller must be an authenticated workspace member.
create or replace function public.create_social_post_bundle(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_brand_id uuid := (p_payload->>'brand_id')::uuid;
  v_post_id uuid := gen_random_uuid();
  v_scheduled_at timestamptz := nullif(p_payload->>'scheduled_at','')::timestamptz;
  v_timezone text := coalesce(nullif(p_payload->>'timezone',''),'UTC');
  v_role text;
  v_account_id uuid;
  v_asset_id uuid;
  v_target_id uuid;
  v_item jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if v_org_id is null or v_brand_id is null then
    raise exception 'Organisation and brand are required' using errcode='22023';
  end if;

  select role into v_role
  from public.organization_members
  where organization_id=v_org_id and user_id=v_user_id and status='active';
  if v_role is null then
    raise exception 'Active workspace membership required' using errcode='42501';
  end if;
  if v_role not in ('owner','administrator','manager','editor','publisher') then
    raise exception 'Insufficient workspace role' using errcode='42501';
  end if;
  if v_scheduled_at is not null and v_role not in ('owner','administrator','manager','publisher') then
    raise exception 'Publishing permission required to schedule posts' using errcode='42501';
  end if;
  if not exists(select 1 from public.brands b where b.id=v_brand_id
    and b.organization_id=v_org_id and b.is_active) then
    raise exception 'Active brand not found in this workspace' using errcode='42501';
  end if;
  if v_role not in ('owner','administrator','manager') and not exists(
    select 1 from public.brand_members bm
    where bm.organization_id=v_org_id and bm.brand_id=v_brand_id and bm.user_id=v_user_id
      and bm.role in ('manager','editor','publisher')
  ) then
    raise exception 'Brand membership required' using errcode='42501';
  end if;
  if v_scheduled_at is not null and v_role not in ('owner','administrator','manager','publisher')
    and not exists(select 1 from public.brand_members bm
      where bm.organization_id=v_org_id and bm.brand_id=v_brand_id and bm.user_id=v_user_id
        and bm.role in ('manager','publisher')) then
    raise exception 'Brand publishing permission required to schedule posts' using errcode='42501';
  end if;
  if length(coalesce(p_payload->>'body','')) > 20000
    or length(coalesce(p_payload->>'title','')) > 200 then
    raise exception 'Post title or body exceeds the supported length' using errcode='22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'target_account_ids','[]'::jsonb)) > 20
    or jsonb_array_length(coalesce(p_payload->'asset_ids','[]'::jsonb)) > 20 then
    raise exception 'Too many destinations or media assets' using errcode='22023';
  end if;
  if v_scheduled_at is not null and v_scheduled_at <= now() then
    raise exception 'Scheduled time must be in the future' using errcode='22023';
  end if;
  if not exists(select 1 from jsonb_array_elements_text(coalesce(p_payload->'target_account_ids','[]'::jsonb))) then
    raise exception 'At least one destination account is required' using errcode='22023';
  end if;

  insert into public.social_posts(
    id,organization_id,brand_id,created_by,title,body,status,scheduled_at,timezone
  ) values (
    v_post_id,v_org_id,v_brand_id,v_user_id,
    nullif(p_payload->>'title',''),coalesce(p_payload->>'body',''),
    case when v_scheduled_at is null then 'draft'::public.social_post_status else 'scheduled'::public.social_post_status end,
    v_scheduled_at,v_timezone
  );

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'asset_ids','[]'::jsonb))
  loop
    v_asset_id := (v_item#>>'{}')::uuid;
    if not exists(select 1 from public.social_media_assets a
      where a.id=v_asset_id and a.organization_id=v_org_id and a.brand_id=v_brand_id
        and a.processing_status='ready') then
      raise exception 'Media asset is unavailable, unprocessed or belongs to another brand' using errcode='42501';
    end if;
    insert into public.social_post_media(organization_id,post_id,asset_id,position)
    values(v_org_id,v_post_id,v_asset_id,(select count(*) from public.social_post_media where post_id=v_post_id));
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'target_account_ids','[]'::jsonb))
  loop
    v_account_id := (v_item#>>'{}')::uuid;
    if not exists(select 1 from public.social_accounts a
      where a.id=v_account_id and a.organization_id=v_org_id and a.brand_id=v_brand_id
        and a.connection_status='connected') then
      raise exception 'Destination account is not connected to this brand' using errcode='42501';
    end if;
    insert into public.social_post_targets(organization_id,post_id,social_account_id,status,scheduled_at)
    values(v_org_id,v_post_id,v_account_id,
      case when v_scheduled_at is null then 'pending'::public.social_post_target_status else 'queued'::public.social_post_target_status end,
      v_scheduled_at)
    returning id into v_target_id;
    if v_scheduled_at is not null then
      insert into public.publish_jobs(organization_id,post_id,target_id,idempotency_key,available_at)
      values(v_org_id,v_post_id,v_target_id,'social-post:'||v_post_id::text||':target:'||v_target_id::text,v_scheduled_at);
    end if;
  end loop;
  return v_post_id;
end;
$$;
revoke all on function public.create_social_post_bundle(jsonb) from public,anon;
grant execute on function public.create_social_post_bundle(jsonb) to authenticated;
