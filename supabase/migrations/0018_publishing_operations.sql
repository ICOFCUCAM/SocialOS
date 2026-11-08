-- Publishing operations: durable attempt history, tenant-safe queue metrics,
-- and explicit operator reconciliation for dead-lettered jobs.

create table public.publish_job_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.publish_jobs(id) on delete cascade,
  target_id uuid not null references public.social_post_targets(id) on delete cascade,
  event_type text not null check (event_type in (
    'claimed','published','retry_scheduled','dead_lettered','outcome_unknown',
    'operator_retried','operator_marked_published','cancelled'
  )),
  attempt_number integer,
  error_code text,
  message text,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index publish_job_events_org_created_idx
  on public.publish_job_events(organization_id,created_at desc);
create index publish_job_events_job_idx
  on public.publish_job_events(job_id,created_at desc);
alter table public.publish_job_events enable row level security;
revoke all on public.publish_job_events from public,anon;
grant select on public.publish_job_events to authenticated;
grant all on public.publish_job_events to service_role;
create policy publish_job_events_select_tenant on public.publish_job_events
  for select to authenticated using (
    exists (
      select 1 from public.social_posts p
      where p.id=publish_job_events_target_post_id_placeholder
    )
  );
