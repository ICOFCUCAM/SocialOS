-- Campaign planning foundation. Campaigns belong to one organisation and one brand.
-- All campaign mutations are authenticated SECURITY DEFINER RPCs with role checks.

do $$ begin
  create type public.social_campaign_status as enum
    ('draft','planned','active','paused','completed','archived');
exception when duplicate_object then null; end $$;

create table public.social_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) between 2 and 160),
  description text not null default '' check (length(description) <= 3000),
  objective text not null default '' check (length(objective) <= 1600),
  target_audience text not null default '' check (length(target_audience) <= 1200),
  key_message text not null default '' check (length(key_message) <= 1200),
  call_to_action text not null default '' check (length(call_to_action) <= 300),
  content_pillars text[] not null default '{}',
  channels text[] not null default '{}',
  start_date date,
  end_date date,
  status public.social_campaign_status not null default 'draft',
  success_metrics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (brand_id,organization_id) references public.brands(id,organization_id) on delete restrict,
  unique (id,organization_id),
  check (start_date is null or end_date is null or end_date >= start_date),
  check (cardinality(content_pillars) <= 20),
  check (cardinality(channels) <= 8),
  check (jsonb_typeof(success_metrics) = 'array' and jsonb_array_length(success_metrics) <= 10)
);
create index social_campaigns_brand_idx
  on public.social_campaigns(organization_id,brand_id,status,start_date desc,created_at desc);

create table public.social_campaign_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campaign_id uuid not null,
  post_id uuid not null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (campaign_id,organization_id) references public.social_campaigns(id,organization_id) on delete cascade,
  foreign key (post_id,organization_id) references public.social_posts(id,organization_id) on delete cascade,
  unique (campaign_id,post_id)
);
create index social_campaign_posts_post_idx on public.social_campaign_posts(organization_id,post_id);

create trigger social_campaigns_set_updated_at before update on public.social_campaigns
  for each row execute function public.set_updated_at();

alter table public.social_campaigns enable row level security;
alter table public.social_campaign_posts enable row level security;

create policy social_campaigns_select_brand on public.social_campaigns
  for select to authenticated using(private.can_access_brand(brand_id,organization_id));
create policy social_campaign_posts_select_brand on public.social_campaign_posts
  for select to authenticated using (
    exists(select 1 from public.social_campaigns c
      where c.id=campaign_id and c.organization_id=organization_id
        and private.can_access_brand(c.brand_id,c.organization_id))
  );

revoke all on public.social_campaigns,public.social_campaign_posts from anon,authenticated;
grant select on public.social_campaigns,public.social_campaign_posts to authenticated;
grant all on public.social_campaigns,public.social_campaign_posts to service_role;

create or replace function public.create_social_campaign(p_payload jsonb)
returns uuid
language plpgsql security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := nullif(p_payload->>'organization_id','')::uuid;
  v_brand uuid := nullif(p_payload->>'brand_id','')::uuid;
  v_campaign uuid := gen_random_uuid();
  v_role text;
  v_status public.social_campaign_status := coalesce(nullif(p_payload->>'status',''),'draft')::public.social_campaign_status;
  v_start date := nullif(p_payload->>'start_date','')::date;
  v_end date := nullif(p_payload->>'end_date','')::date;
  v_pillars text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'content_pillars','[]'::jsonb))), '{}');
  v_channels text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'channels','[]'::jsonb))), '{}');
  v_metrics jsonb := coalesce(p_payload->'success_metrics','[]'::jsonb);
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if v_org is null or v_brand is null then raise exception 'Organisation and brand are required' using errcode='22023'; end if;
  select role into v_role from public.organization_members
    where organization_id=v_org and user_id=v_user and status='active';
  if v_role not in ('owner','administrator','manager','editor','publisher') then
    raise exception 'Campaign creation permission required' using errcode='42501';
  end if;
  if not private.can_access_brand(v_brand,v_org) then
    raise exception 'Brand access required' using errcode='42501';
  end if;
  if not exists(select 1 from public.brands where id=v_brand and organization_id=v_org and is_active) then
    raise exception 'Active brand not found' using errcode='42501';
  end if;
  if length(trim(coalesce(p_payload->>'name',''))) not between 2 and 160
    or length(coalesce(p_payload->>'description','')) > 3000
    or length(coalesce(p_payload->>'objective','')) > 1600
    or length(coalesce(p_payload->>'target_audience','')) > 1200
    or length(coalesce(p_payload->>'key_message','')) > 1200
    or length(coalesce(p_payload->>'call_to_action','')) > 300 then
    raise exception 'Campaign field length is invalid' using errcode='22023';
  end if;
  if cardinality(v_pillars)>20 or cardinality(v_channels)>8
    or jsonb_typeof(v_metrics)<>'array' or jsonb_array_length(v_metrics)>10 then
    raise exception 'Campaign planning list exceeds limits' using errcode='22023';
  end if;
  if v_start is not null and v_end is not null and v_end<v_start then
    raise exception 'Campaign end date must not precede its start date' using errcode='22023';
  end if;
  if v_status not in ('draft','planned') then
    raise exception 'New campaigns must start as draft or planned' using errcode='22023';
  end if;
  insert into public.social_campaigns(
    id,organization_id,brand_id,created_by,name,description,objective,target_audience,
    key_message,call_to_action,content_pillars,channels,start_date,end_date,status,success_metrics
  ) values (
    v_campaign,v_org,v_brand,v_user,trim(p_payload->>'name'),
    coalesce(p_payload->>'description',''),coalesce(p_payload->>'objective',''),
    coalesce(p_payload->>'target_audience',''),coalesce(p_payload->>'key_message',''),
    coalesce(p_payload->>'call_to_action',''),v_pillars,v_channels,v_start,v_end,v_status,v_metrics
  );
  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(v_org,v_user,'social.campaign.created','social_campaign',v_campaign,
    jsonb_build_object('brand_id',v_brand,'status',v_status));
  return v_campaign;
end;
$$;

create or replace function public.update_social_campaign(p_campaign_id uuid,p_payload jsonb)
returns boolean
language plpgsql security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_campaign public.social_campaigns%rowtype;
  v_role text;
  v_pillars text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'content_pillars','[]'::jsonb))), '{}');
  v_channels text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'channels','[]'::jsonb))), '{}');
  v_metrics jsonb := coalesce(p_payload->'success_metrics','[]'::jsonb);
  v_status public.social_campaign_status := (p_payload->>'status')::public.social_campaign_status;
  v_start date := nullif(p_payload->>'start_date','')::date;
  v_end date := nullif(p_payload->>'end_date','')::date;
begin
  select * into v_campaign from public.social_campaigns where id=p_campaign_id for update;
  if not found then raise exception 'Campaign not found' using errcode='P0002'; end if;
  select role into v_role from public.organization_members
    where organization_id=v_campaign.organization_id and user_id=v_user and status='active';
  if v_role not in ('owner','administrator','manager','editor','publisher')
    or not private.can_access_brand(v_campaign.brand_id,v_campaign.organization_id) then
    raise exception 'Campaign edit permission required' using errcode='42501';
  end if;
  if length(trim(coalesce(p_payload->>'name',''))) not between 2 and 160
    or length(coalesce(p_payload->>'description','')) > 3000
    or length(coalesce(p_payload->>'objective','')) > 1600
    or length(coalesce(p_payload->>'target_audience','')) > 1200
    or length(coalesce(p_payload->>'key_message','')) > 1200
    or length(coalesce(p_payload->>'call_to_action','')) > 300
    or cardinality(v_pillars)>20 or cardinality(v_channels)>8
    or jsonb_typeof(v_metrics)<>'array' or jsonb_array_length(v_metrics)>10 then
    raise exception 'Campaign field value exceeds limits' using errcode='22023';
  end if;
  if v_start is not null and v_end is not null and v_end<v_start then
    raise exception 'Campaign end date must not precede its start date' using errcode='22023';
  end if;
  update public.social_campaigns set
    name=trim(p_payload->>'name'),description=coalesce(p_payload->>'description',''),
    objective=coalesce(p_payload->>'objective',''),target_audience=coalesce(p_payload->>'target_audience',''),
    key_message=coalesce(p_payload->>'key_message',''),call_to_action=coalesce(p_payload->>'call_to_action',''),
    content_pillars=v_pillars,channels=v_channels,start_date=v_start,end_date=v_end,
    status=v_status,success_metrics=v_metrics
  where id=p_campaign_id;
  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(v_campaign.organization_id,v_user,'social.campaign.updated','social_campaign',p_campaign_id,
    jsonb_build_object('status',v_status));
  return true;
end;
$$;

create or replace function public.attach_post_to_campaign(p_campaign_id uuid,p_post_id uuid)
returns boolean
language plpgsql security definer
set search_path=public,auth,private,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_campaign public.social_campaigns%rowtype;
  v_post public.social_posts%rowtype;
  v_role text;
begin
  select * into v_campaign from public.social_campaigns where id=p_campaign_id for update;
  if not found then raise exception 'Campaign not found' using errcode='P0002'; end if;
  select * into v_post from public.social_posts where id=p_post_id;
  if not found or v_post.organization_id<>v_campaign.organization_id or v_post.brand_id<>v_campaign.brand_id then
    raise exception 'Post must belong to the same brand and workspace as the campaign' using errcode='42501';
  end if;
  select role into v_role from public.organization_members
    where organization_id=v_campaign.organization_id and user_id=v_user and status='active';
  if v_role not in ('owner','administrator','manager','editor','publisher')
    or not private.can_access_brand(v_campaign.brand_id,v_campaign.organization_id) then
    raise exception 'Campaign edit permission required' using errcode='42501';
  end if;
  insert into public.social_campaign_posts(organization_id,campaign_id,post_id,added_by)
  values(v_campaign.organization_id,p_campaign_id,p_post_id,v_user)
  on conflict(campaign_id,post_id) do nothing;
  return true;
end;
$$;

revoke all on function public.create_social_campaign(jsonb) from public,anon;
revoke all on function public.update_social_campaign(uuid,jsonb) from public,anon;
revoke all on function public.attach_post_to_campaign(uuid,uuid) from public,anon;
grant execute on function public.create_social_campaign(jsonb) to authenticated;
grant execute on function public.update_social_campaign(uuid,jsonb) to authenticated;
grant execute on function public.attach_post_to_campaign(uuid,uuid) to authenticated;
