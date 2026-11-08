-- Fair, bounded publisher claims across workspaces.
-- PostgreSQL remains the durable queue and the arbiter for concurrency limits.

create table public.publish_organization_fairness (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_claimed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.publish_organization_fairness enable row level security;
revoke all on public.publish_organization_fairness from public,anon,authenticated;
grant all on public.publish_organization_fairness to service_role;

create index publish_jobs_org_due_idx
  on public.publish_jobs(organization_id,available_at,created_at)
  where status in ('queued','retry');
create index publish_jobs_org_running_idx
  on public.publish_jobs(organization_id,locked_at)
  where status='running';

create or replace function public.claim_publish_jobs(
  p_worker_id text,
  p_limit integer,
  p_org_concurrency_limit integer
)
returns setof public.publish_jobs
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_limit integer := greatest(1,least(coalesce(p_limit,10),50));
  v_org_limit integer := greatest(1,least(coalesce(p_org_concurrency_limit,3),20));
  v_iteration integer;
  v_org_id uuid;
  v_job_id uuid;
  v_running integer;
  v_claimed public.publish_jobs%rowtype;
begin
  if p_worker_id is null or length(trim(p_worker_id))=0 or length(p_worker_id)>200 then
    raise exception 'A valid publisher worker ID is required' using errcode='22023';
  end if;

  -- Serialize short claim transactions so workspace concurrency limits are
  -- respected across all replicas, not merely within one worker process.
  perform pg_advisory_xact_lock(hashtext('socialos:publish-job-claim'));

  for v_iteration in 1..v_limit loop
    v_org_id := null;
    v_job_id := null;

    -- Re-evaluate after each claim. Updating the fairness cursor rotates the
    -- next selection to another workspace before this one gets another slot.
    select candidate.organization_id into v_org_id
    from (
      select j.organization_id,
        coalesce(f.last_claimed_at,'-infinity'::timestamptz) as fairness_at,
        min(j.available_at) as oldest_due
      from public.publish_jobs j
      left join public.publish_organization_fairness f
        on f.organization_id=j.organization_id
      where j.status in ('queued','retry')
        and j.available_at<=now()
        and j.attempt_count<j.max_attempts
        and (
          select count(*) from public.publish_jobs running
          where running.organization_id=j.organization_id
            and running.status='running'
        ) < v_org_limit
      group by j.organization_id,f.last_claimed_at
      order by fairness_at,oldest_due,j.organization_id
      limit 1
    ) candidate;

    exit when v_org_id is null;

    select count(*) into v_running
    from public.publish_jobs
    where organization_id=v_org_id and status='running';
    if v_running>=v_org_limit then
      continue;
    end if;

    select id into v_job_id
    from public.publish_jobs
    where organization_id=v_org_id
      and status in ('queued','retry')
      and available_at<=now()
      and attempt_count<max_attempts
    order by available_at,created_at,id
    limit 1
    for update skip locked;

    if v_job_id is null then
      -- This can occur if a row was locked by a recovery/maintenance process.
      -- Mark the workspace cursor so another workspace can be considered.
      insert into public.publish_organization_fairness(organization_id,last_claimed_at,updated_at)
      values(v_org_id,clock_timestamp(),clock_timestamp())
      on conflict(organization_id) do update
        set last_claimed_at=excluded.last_claimed_at,updated_at=excluded.updated_at;
      continue;
    end if;

    update public.publish_jobs
    set status='running',locked_at=now(),locked_by=p_worker_id,
        attempt_count=attempt_count+1
    where id=v_job_id
    returning * into v_claimed;

    insert into public.publish_organization_fairness(organization_id,last_claimed_at,updated_at)
    values(v_org_id,clock_timestamp(),clock_timestamp())
    on conflict(organization_id) do update
      set last_claimed_at=excluded.last_claimed_at,updated_at=excluded.updated_at;

    return next v_claimed;
  end loop;
end;
$$;

revoke all on function public.claim_publish_jobs(text,integer) from public,anon,authenticated,service_role;
revoke all on function public.claim_publish_jobs(text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_publish_jobs(text,integer,integer) to service_role;

comment on table public.publish_organization_fairness is
  'Service-only workspace claim fairness cursor for durable publisher scheduling.';


-- Preserve the existing worker RPC contract (two arguments) while routing all
-- claims through the fair scheduler. The three-argument implementation is
-- callable only by this SECURITY DEFINER wrapper.
create or replace function public.claim_publish_jobs(p_worker_id text,p_limit integer default 10)
returns setof public.publish_jobs
language sql
security definer
set search_path=public,pg_temp
as $$
  select * from public.claim_publish_jobs(p_worker_id,p_limit,3);
$$;
revoke all on function public.claim_publish_jobs(text,integer) from public,anon,authenticated;
grant execute on function public.claim_publish_jobs(text,integer) to service_role;
