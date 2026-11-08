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
  p_limit integer default 10,
  p_org_concurrency_limit integer default 3
)
returns setof public.publish_jobs
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_limit integer := greatest(1,least(coalesce(p_limit,10),50));
  v_org_limit integer := greatest(1,least(coalesce(p_org_concurrency_limit,3),20));
begin
  if p_worker_id is null or length(trim(p_worker_id))=0 or length(p_worker_id)>200 then
    raise exception 'A valid publisher worker ID is required' using errcode='22023';
  end if;

  -- Serialize only the short claim transaction so concurrent replicas cannot
  -- over-claim a workspace's configured in-flight allowance.
  perform pg_advisory_xact_lock(hashtext('socialos:publish-job-claim'));

  return query
  with due as materialized (
    select j.id,j.organization_id,j.available_at,j.created_at,
      coalesce(f.last_claimed_at,'-infinity'::timestamptz) as fairness_at,
      row_number() over (
        partition by j.organization_id
        order by j.available_at,j.created_at,j.id
      ) as org_rank
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
    order by fairness_at,j.available_at,j.created_at
    for update of j skip locked
  ),
  chosen as (
    select id,organization_id,org_rank,fairness_at,available_at,created_at
    from due
    order by org_rank,fairness_at,available_at,created_at
    limit v_limit
  ),
  claimed as (
    update public.publish_jobs j
    set status='running',locked_at=now(),locked_by=p_worker_id,
        attempt_count=j.attempt_count+1
    from chosen c
    where j.id=c.id
    returning j.*
  ),
  touched_orgs as (
    insert into public.publish_organization_fairness(organization_id,last_claimed_at,updated_at)
    select distinct organization_id,now(),now() from claimed
    on conflict(organization_id) do update
      set last_claimed_at=excluded.last_claimed_at,updated_at=excluded.updated_at
    returning organization_id
  )
  select c.* from claimed c;
end;
$$;

revoke all on function public.claim_publish_jobs(text,integer) from public,anon,authenticated,service_role;
revoke all on function public.claim_publish_jobs(text,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_publish_jobs(text,integer,integer) to service_role;

comment on table public.publish_organization_fairness is
  'Service-only workspace claim fairness cursor for durable publisher scheduling.';
