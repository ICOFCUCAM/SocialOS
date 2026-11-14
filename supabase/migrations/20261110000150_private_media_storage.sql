-- Private object storage for SocialOS media. Uploads are issued by authenticated server routes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'social-media','social-media',false,262144000,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- No authenticated or anonymous storage.objects policy is created for this bucket.
-- Storage access is through server-issued signed URLs only.

comment on table public.social_media_assets is
  'Tenant-scoped media records. Object storage is private; clients use server-issued signed URLs.';


do $$ begin
  create type public.media_processing_job_status as enum
    ('queued','running','retry','succeeded','failed','dead_letter');
exception when duplicate_object then null; end $$;

create table public.media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_id uuid not null,
  status public.media_processing_job_status not null default 'queued',
  idempotency_key text not null unique,
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 4 check (max_attempts between 1 and 10),
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  last_error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (asset_id,organization_id)
    references public.social_media_assets(id,organization_id) on delete cascade,
  unique (asset_id),
  check ((status='running' and locked_at is not null and locked_by is not null)
      or (status<>'running' and locked_at is null and locked_by is null))
);
create index media_processing_claim_idx on public.media_processing_jobs(available_at,created_at)
  where status in ('queued','retry');

create trigger media_processing_jobs_set_updated_at before update on public.media_processing_jobs
  for each row execute function public.set_updated_at();

alter table public.media_processing_jobs enable row level security;
revoke all on public.media_processing_jobs from anon,authenticated;
grant all on public.media_processing_jobs to service_role;

create or replace function public.claim_media_processing_jobs(p_worker_id text,p_limit integer default 5)
returns setof public.media_processing_jobs
language sql
security definer
set search_path=public,pg_temp
as $$
  with candidates as (
    select id from public.media_processing_jobs
    where status in ('queued','retry') and available_at<=now()
      and attempt_count<max_attempts
    order by available_at,created_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,5),20))
  )
  update public.media_processing_jobs j
  set status='running',locked_at=now(),locked_by=p_worker_id,attempt_count=j.attempt_count+1
  from candidates c where j.id=c.id
  returning j.*;
$$;
revoke all on function public.claim_media_processing_jobs(text,integer) from public,anon,authenticated;
grant execute on function public.claim_media_processing_jobs(text,integer) to service_role;

comment on table public.media_processing_jobs is
  'Durable private media-processing queue. Worker validates file signatures, scans media, extracts metadata and generates safe derivatives.';
