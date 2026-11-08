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
      select 1
      from public.social_post_targets t
      join public.social_posts p on p.id=t.post_id and p.organization_id=t.organization_id
      where t.id=publish_job_events.target_id
        and t.organization_id=publish_job_events.organization_id
        and public.can_access_brand(p.brand_id,p.organization_id)
    )
  );


-- Tenant-authorized queue summary. Counts only jobs belonging to brands the
-- caller can access; no provider tokens or raw payloads are exposed.
create or replace function public.get_publishing_operations_summary(p_organization_id uuid)
returns table (
  queued_count bigint,
  running_count bigint,
  retry_count bigint,
  dead_letter_count bigint,
  succeeded_24h bigint,
  failed_24h bigint,
  oldest_due_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public,auth,pg_temp
as $$
begin
  if auth.uid() is null or not public.is_org_member(p_organization_id) then
    raise exception 'Workspace membership required' using errcode='42501';
  end if;
  return query
  select
    count(*) filter (where j.status='queued'),
    count(*) filter (where j.status='running'),
    count(*) filter (where j.status='retry'),
    count(*) filter (where j.status='dead_letter'),
    count(*) filter (where j.status='succeeded' and j.completed_at>=now()-interval '24 hours'),
    count(*) filter (where j.status='dead_letter' and j.completed_at>=now()-interval '24 hours'),
    min(j.available_at) filter (where j.status in ('queued','retry') and j.available_at<=now())
  from public.publish_jobs j
  join public.social_posts p on p.id=j.post_id and p.organization_id=j.organization_id
  where j.organization_id=p_organization_id
    and public.can_access_brand(p.brand_id,p.organization_id);
end;
$$;
revoke all on function public.get_publishing_operations_summary(uuid) from public,anon;
grant execute on function public.get_publishing_operations_summary(uuid) to authenticated;

-- Retry is an explicit operator action. Unknown outcomes require a separate
-- reconciliation action and cannot be retried through this function.
create or replace function public.operator_retry_publish_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_job public.publish_jobs%rowtype;
  v_post public.social_posts%rowtype;
begin
  select * into v_job from public.publish_jobs where id=p_job_id for update;
  if not found then raise exception 'Publishing job not found' using errcode='P0002'; end if;
  select * into v_post from public.social_posts
    where id=v_job.post_id and organization_id=v_job.organization_id;
  if auth.uid() is null
    or not public.has_org_role(v_job.organization_id,array['owner','administrator','manager','publisher'])
    or not public.can_access_brand(v_post.brand_id,v_post.organization_id) then
    raise exception 'Publishing operator permission required' using errcode='42501';
  end if;
  if v_job.status not in ('dead_letter','retry') then
    raise exception 'Only retryable or dead-lettered jobs can be retried' using errcode='22023';
  end if;
  if v_job.last_error_code='PUBLISH_OUTCOME_UNKNOWN' then
    raise exception 'Unknown provider outcomes require explicit reconciliation before retry' using errcode='22023';
  end if;
  if v_job.attempt_count>=v_job.max_attempts then
    raise exception 'Retry limit exhausted; increase attempts through an approved support workflow' using errcode='22023';
  end if;
  update public.publish_jobs set status='retry',available_at=now(),
    locked_at=null,locked_by=null,completed_at=null,
    last_error_code=null,last_error_message=null
  where id=p_job_id;
  update public.social_post_targets set status='queued',
    last_error_code=null,last_error_message=null
  where id=v_job.target_id and organization_id=v_job.organization_id;
  insert into public.publish_job_events(organization_id,job_id,target_id,event_type,
    attempt_number,actor_user_id,message)
  values(v_job.organization_id,v_job.id,v_job.target_id,'operator_retried',
    v_job.attempt_count,auth.uid(),'Operator manually requeued this publishing job.');
  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(v_job.organization_id,auth.uid(),'social.publish_job.operator_retried',
    'publish_job',v_job.id,jsonb_build_object('target_id',v_job.target_id));
end;
$$;
revoke all on function public.operator_retry_publish_job(uuid) from public,anon;
grant execute on function public.operator_retry_publish_job(uuid) to authenticated;

-- Reconcile an ambiguous provider result as published only when an operator
-- supplies the external post ID obtained from the platform itself.
create or replace function public.operator_reconcile_publish_job(
  p_job_id uuid,p_external_post_id text,p_permalink text default null
)
returns void
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_job public.publish_jobs%rowtype;
  v_post public.social_posts%rowtype;
begin
  if p_external_post_id is null or length(trim(p_external_post_id))=0
    or length(p_external_post_id)>500 then
    raise exception 'A verified external post ID is required' using errcode='22023';
  end if;
  select * into v_job from public.publish_jobs where id=p_job_id for update;
  if not found then raise exception 'Publishing job not found' using errcode='P0002'; end if;
  select * into v_post from public.social_posts
    where id=v_job.post_id and organization_id=v_job.organization_id;
  if auth.uid() is null
    or not public.has_org_role(v_job.organization_id,array['owner','administrator','manager','publisher'])
    or not public.can_access_brand(v_post.brand_id,v_post.organization_id) then
    raise exception 'Publishing operator permission required' using errcode='42501';
  end if;
  if v_job.status<>'dead_letter' or v_job.last_error_code<>'PUBLISH_OUTCOME_UNKNOWN' then
    raise exception 'This job is not awaiting unknown-outcome reconciliation' using errcode='22023';
  end if;
  update public.social_post_targets set status='published',
    platform_post_id=trim(p_external_post_id),platform_permalink=nullif(trim(p_permalink),''),
    published_at=now(),last_error_code=null,last_error_message=null
  where id=v_job.target_id and organization_id=v_job.organization_id;
  update public.publish_jobs set status='succeeded',completed_at=now(),
    last_error_code=null,last_error_message=null,locked_at=null,locked_by=null
  where id=v_job.id;
  insert into public.publish_job_events(organization_id,job_id,target_id,event_type,
    attempt_number,actor_user_id,message,metadata)
  values(v_job.organization_id,v_job.id,v_job.target_id,'operator_marked_published',
    v_job.attempt_count,auth.uid(),'Operator reconciled the provider publication.',
    jsonb_build_object('external_post_id',trim(p_external_post_id)));
  update public.social_posts p set
    status = case
      when not exists(select 1 from public.social_post_targets t where t.post_id=p.id and t.organization_id=p.organization_id and t.status<>'published') then 'published'::public.social_post_status
      when exists(select 1 from public.social_post_targets t where t.post_id=p.id and t.organization_id=p.organization_id and t.status='published')
        and not exists(select 1 from public.social_post_targets t where t.post_id=p.id and t.organization_id=p.organization_id and t.status not in ('published','failed','skipped','cancelled')) then 'partially_published'::public.social_post_status
      else p.status
    end,
    published_at=coalesce(p.published_at,now())
  where p.id=v_job.post_id and p.organization_id=v_job.organization_id;

  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(v_job.organization_id,auth.uid(),'social.publish_job.outcome_reconciled',
    'publish_job',v_job.id,jsonb_build_object('target_id',v_job.target_id,
    'external_post_id',trim(p_external_post_id)));
end;
$;
revoke all on function public.operator_reconcile_publish_job(uuid,text,text) from public,anon;
grant execute on function public.operator_reconcile_publish_job(uuid,text,text) to authenticated;
