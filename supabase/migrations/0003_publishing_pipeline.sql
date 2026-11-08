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
