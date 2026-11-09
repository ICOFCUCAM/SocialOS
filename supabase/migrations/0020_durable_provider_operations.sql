-- Durable provider-side operations for asynchronous publishing.
-- Extends the existing publish_jobs outbox; this is not a second post queue.

-- A job remains durable while its remote provider operation is processing,
-- but it is not reclaimed as a new publish attempt.
alter type public.publish_job_status add value if not exists 'awaiting_provider';

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

-- Provider-issued IDs must not be attached to two logical operations for
-- the same connected account. NULL remains valid before Meta returns an ID.
create unique index publish_provider_operations_remote_id_uidx
  on public.publish_provider_operations(provider, social_account_id, remote_operation_id)
  where remote_operation_id is not null;

create unique index publish_provider_operations_external_post_uidx
  on public.publish_provider_operations(provider, social_account_id, external_post_id)
  where external_post_id is not null;

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
  with uncertain as (
    update public.publish_provider_operations
    set state = 'outcome_unknown',
        locked_at = null,
        locked_by = null,
        next_action_at = null,
        last_error_code = 'PROVIDER_OPERATION_OUTCOME_UNKNOWN',
        last_error_message = 'A provider side-effect request lost its worker lease. Verify the provider outcome before taking further action.'
    where state in ('submit_started','finalize_started')
      and locked_at is not null
      and locked_at < now() - make_interval(secs => greatest(30, least(coalesce(p_lease_seconds,120),600)))
    returning id, organization_id, job_id, target_id
  ), jobs as (
    update public.publish_jobs j
    set status = 'dead_letter',
        locked_at = null,
        locked_by = null,
        completed_at = now(),
        last_error_code = 'PUBLISH_OUTCOME_UNKNOWN',
        last_error_message = 'Provider submission/finalization lost its worker lease. Reconcile externally before retrying.'
    from uncertain u
    where j.id = u.job_id and j.organization_id = u.organization_id
    returning j.id, j.organization_id, j.target_id, j.attempt_count
  ), targets as (
    update public.social_post_targets t
    set status = 'failed',
        last_error_code = 'PUBLISH_OUTCOME_UNKNOWN',
        last_error_message = 'Provider outcome is uncertain. Verify the platform before retrying.'
    from jobs j
    where t.id = j.target_id and t.organization_id = j.organization_id
    returning t.id
  )
  select count(*)::integer into v_recovered from jobs;

  return coalesce(v_recovered, 0);
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

-- Enforce lifecycle monotonicity and immutable tenant/job identity in PostgreSQL,
-- not only in publisher JavaScript.
create or replace function public.guard_publish_provider_operation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_platform_code text;
begin
  if tg_op = 'INSERT' then
    if new.state <> 'prepared' then
      raise exception 'Provider operation must be created in prepared state' using errcode = '22023';
    end if;
  else
    if new.organization_id <> old.organization_id
      or new.job_id <> old.job_id
      or new.target_id <> old.target_id
      or new.social_account_id <> old.social_account_id
      or new.provider <> old.provider
      or new.operation_type <> old.operation_type
      or new.idempotency_key <> old.idempotency_key
      or new.created_at <> old.created_at then
      raise exception 'Provider operation identity and tenancy are immutable' using errcode = '22023';
    end if;

    if new.state <> old.state and not (
      (old.state = 'prepared' and new.state = 'submit_started')
      or (old.state = 'submit_started' and new.state in ('processing','rejected','outcome_unknown'))
      or (old.state = 'processing' and new.state in ('processing','finalize_started','rejected','outcome_unknown'))
      or (old.state = 'finalize_started' and new.state in ('published','rejected','outcome_unknown'))
    ) then
      raise exception 'Invalid provider operation state transition: % -> %', old.state, new.state using errcode = '22023';
    end if;
  end if;

  if new.state in ('processing','finalize_started','published') and new.remote_operation_id is null then
    raise exception 'A remote operation ID is required for this state' using errcode = '23514';
  end if;
  if new.state = 'published' and (new.external_post_id is null or new.completed_at is null) then
    raise exception 'Published operations require an external post ID and completion time' using errcode = '23514';
  end if;

  select sp.code into v_platform_code
  from public.social_accounts sa
  join public.social_platforms sp on sp.id = sa.platform_id
  where sa.id = new.social_account_id
    and sa.organization_id = new.organization_id;

  if v_platform_code is distinct from new.provider then
    raise exception 'Provider does not match the linked social account platform' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger publish_provider_operations_guard
  before insert or update on public.publish_provider_operations
  for each row execute function public.guard_publish_provider_operation();

-- Finalize the provider operation and all SocialOS publication records atomically.
-- The RPC is worker-only; its lease check prevents a stale worker from completing
-- an operation claimed by another replica.
create or replace function public.finalize_publish_provider_operation(
  p_operation_id uuid,
  p_worker_id text,
  p_external_post_id text,
  p_permalink text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.publish_provider_operations%rowtype;
  v_job public.publish_jobs%rowtype;
  v_target public.social_post_targets%rowtype;
  v_now timestamptz := now();
  v_statuses public.social_post_target_status[];
  v_published integer;
  v_failed integer;
  v_skipped integer;
  v_cancelled integer;
  v_total integer;
  v_post_status public.social_post_status;
begin
  if p_external_post_id is null or length(trim(p_external_post_id)) = 0 or length(p_external_post_id) > 500 then
    raise exception 'A verified external post ID is required' using errcode = '22023';
  end if;

  select * into v_operation
  from public.publish_provider_operations
  where id = p_operation_id
  for update;

  if not found then
    raise exception 'Provider operation not found' using errcode = 'P0002';
  end if;

  if v_operation.state = 'published' then
    if v_operation.external_post_id = trim(p_external_post_id) then return; end if;
    raise exception 'Provider operation was already finalized with a different external post ID' using errcode = '22023';
  end if;

  if v_operation.state <> 'finalize_started'
    or v_operation.locked_by is distinct from p_worker_id
    or v_operation.locked_at is null then
    raise exception 'Provider operation is not held in finalize state by this worker' using errcode = '42501';
  end if;

  select * into v_job
  from public.publish_jobs
  where id = v_operation.job_id
    and organization_id = v_operation.organization_id
    and target_id = v_operation.target_id
  for update;

  if not found then raise exception 'Publishing job no longer exists' using errcode = 'P0002'; end if;

  select * into v_target
  from public.social_post_targets
  where id = v_operation.target_id
    and organization_id = v_operation.organization_id
    and social_account_id = v_operation.social_account_id
  for update;

  if not found then raise exception 'Publishing target no longer exists' using errcode = 'P0002'; end if;

  if v_target.platform_post_id is not null and v_target.platform_post_id <> trim(p_external_post_id) then
    raise exception 'Target already has a different external post ID' using errcode = '22023';
  end if;

  update public.publish_provider_operations
  set state = 'published',
      external_post_id = trim(p_external_post_id),
      external_permalink = nullif(trim(p_permalink),''),
      completed_at = v_now,
      next_action_at = null,
      locked_at = null,
      locked_by = null,
      last_error_code = null,
      last_error_message = null
  where id = v_operation.id;

  update public.social_post_targets
  set status = 'published',
      platform_post_id = trim(p_external_post_id),
      platform_permalink = nullif(trim(p_permalink),''),
      published_at = v_now,
      last_error_code = null,
      last_error_message = null
  where id = v_target.id and organization_id = v_operation.organization_id;

  update public.publish_jobs
  set status = 'succeeded',
      locked_at = null,
      locked_by = null,
      completed_at = v_now,
      last_error_code = null,
      last_error_message = null
  where id = v_job.id and organization_id = v_operation.organization_id;

  select
    count(*)::integer,
    count(*) filter (where status = 'published')::integer,
    count(*) filter (where status = 'failed')::integer,
    count(*) filter (where status = 'skipped')::integer,
    count(*) filter (where status = 'cancelled')::integer
  into v_total, v_published, v_failed, v_skipped, v_cancelled
  from public.social_post_targets
  where post_id = v_job.post_id and organization_id = v_operation.organization_id;

  if v_published = v_total then
    v_post_status := 'published';
  elsif v_published + v_failed + v_skipped + v_cancelled = v_total and v_published > 0 then
    v_post_status := 'partially_published';
  elsif v_published + v_failed + v_skipped + v_cancelled = v_total and v_published = 0 and v_failed + v_skipped > 0 then
    v_post_status := 'failed';
  elsif v_published + v_failed + v_skipped + v_cancelled = v_total and v_cancelled = v_total then
    v_post_status := 'cancelled';
  else
    v_post_status := 'processing';
  end if;

  update public.social_posts
  set status = v_post_status,
      published_at = case when v_published > 0 then coalesce(published_at, v_now) else null end,
      last_error_code = case when v_failed > 0 then 'ONE_OR_MORE_TARGETS_FAILED' else null end
  where id = v_job.post_id and organization_id = v_operation.organization_id;

  insert into public.publish_job_events(
    organization_id,job_id,target_id,event_type,attempt_number,message,metadata
  ) values (
    v_operation.organization_id,v_job.id,v_target.id,'published',v_job.attempt_count,
    'Provider operation finalized successfully.',
    jsonb_build_object('external_post_id',trim(p_external_post_id),'provider',v_operation.provider)
  );

  insert into public.audit_events(
    organization_id,action,resource_type,resource_id,metadata
  ) values (
    v_operation.organization_id,'social.post.published','social_post_target',v_target.id,
    jsonb_build_object('provider',v_operation.provider,'external_post_id',trim(p_external_post_id))
  );
end;
$$;

revoke all on function public.finalize_publish_provider_operation(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.finalize_publish_provider_operation(uuid,text,text,text)
  to service_role;
