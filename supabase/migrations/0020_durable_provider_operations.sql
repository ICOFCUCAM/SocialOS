-- Durable provider-side operations for asynchronous publishing.
-- Extends the existing publish_jobs outbox; this is not a second post queue.

-- Composite keys let provider operations prove that their job, target and
-- connected account all belong to the same organization.
alter table public.publish_jobs
  add constraint publish_jobs_id_org_target_key
  unique (id, organization_id, target_id);

alter table public.social_post_targets
  add constraint social_post_targets_id_org_account_key
  unique (id, organization_id, social_account_id);

create table public.publish_provider_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid not null,
  target_id uuid not null,
  social_account_id uuid not null,
  provider text not null check (provider = 'instagram'),
  operation_type text not null check (operation_type = 'instagram_video_publish'),
  state text not null default 'prepared'
    check (state in (
      'prepared','submit_started','processing','finalize_started',
      'published','rejected','outcome_unknown'
    )),
  idempotency_key text not null unique,
  remote_operation_id text,
  external_post_id text,
  external_permalink text,
  next_action_at timestamptz,
  poll_count integer not null default 0 check (poll_count >= 0),
  locked_at timestamptz,
  locked_by text,
  submit_started_at timestamptz,
  submitted_at timestamptz,
  finalize_started_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint publish_provider_operations_job_target_fk
    foreign key (job_id, organization_id, target_id)
    references public.publish_jobs(id, organization_id, target_id) on delete cascade,
  constraint publish_provider_operations_target_account_fk
    foreign key (target_id, organization_id, social_account_id)
    references public.social_post_targets(id, organization_id, social_account_id) on delete cascade,
  constraint publish_provider_operations_job_type_key
    unique (job_id, operation_type),
  constraint publish_provider_operations_remote_id_check
    check (remote_operation_id is null or length(trim(remote_operation_id)) > 0),
  constraint publish_provider_operations_published_check
    check (state <> 'published' or (external_post_id is not null and completed_at is not null)),
  constraint publish_provider_operations_lock_check
    check ((locked_at is null and locked_by is null) or (locked_at is not null and locked_by is not null))
);

create index publish_provider_operations_due_idx
  on public.publish_provider_operations(next_action_at, created_at)
  where state = 'processing';

create index publish_provider_operations_org_state_idx
  on public.publish_provider_operations(organization_id, state, updated_at desc);

create trigger publish_provider_operations_set_updated_at
  before update on public.publish_provider_operations
  for each row execute function public.set_updated_at();

alter table public.publish_provider_operations enable row level security;

-- Provider operation details are service-side operational data. Browser roles
-- receive no direct access; operator APIs must return explicitly sanitized data.
revoke all on public.publish_provider_operations from public, anon, authenticated;
grant all on public.publish_provider_operations to service_role;

-- Claim only resumable status-poll operations. Side-effecting submit/finalize
-- states are deliberately excluded from automatic replay after a stale lease.
create or replace function public.claim_due_publish_provider_operations(
  p_worker_id text,
  p_limit integer default 20,
  p_lease_seconds integer default 120
)
returns setof public.publish_provider_operations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'Worker ID is required' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select o.id
    from public.publish_provider_operations o
    where o.state = 'processing'
      and coalesce(o.next_action_at, now()) <= now()
      and (
        o.locked_at is null
        or o.locked_at < now() - make_interval(secs => greatest(30, least(coalesce(p_lease_seconds,120),600)))
      )
    order by coalesce(o.next_action_at, o.created_at), o.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,20),100))
  )
  update public.publish_provider_operations o
  set locked_at = now(),
      locked_by = p_worker_id
  from candidates c
  where o.id = c.id
  returning o.*;
end;
$$;

revoke all on function public.claim_due_publish_provider_operations(text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_publish_provider_operations(text,integer,integer)
  to service_role;

-- A processing lease is safe to reclaim because the next action is a read-only
-- status check against the persisted remote ID. Submit/finalize leases are not.
create or replace function public.recover_stale_publish_provider_operations(
  p_lease_seconds integer default 120
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recovered integer := 0;
begin
  update public.publish_provider_operations
  set state = 'outcome_unknown',
      locked_at = null,
      locked_by = null,
      next_action_at = null,
      last_error_code = 'PROVIDER_OPERATION_OUTCOME_UNKNOWN',
      last_error_message = 'A provider side-effect request lost its worker lease. Verify the provider outcome before taking further action.'
  where state in ('submit_started','finalize_started')
    and locked_at is not null
    and locked_at < now() - make_interval(secs => greatest(30, least(coalesce(p_lease_seconds,120),600)));

  get diagnostics v_recovered = row_count;
  return v_recovered;
end;
$$;

revoke all on function public.recover_stale_publish_provider_operations(integer)
  from public, anon, authenticated;
grant execute on function public.recover_stale_publish_provider_operations(integer)
  to service_role;

comment on table public.publish_provider_operations is
  'Durable remote provider operation state for asynchronous publishing. Extends publish_jobs; PostgreSQL remains authoritative and Redis is coordination only.';
comment on column public.publish_provider_operations.remote_operation_id is
  'Provider-issued operation/container identifier. Never store access tokens, signed media URLs or raw provider responses in this table.';
comment on column public.publish_provider_operations.idempotency_key is
  'Stable logical operation identity derived by the trusted publisher for one job and operation type.';
