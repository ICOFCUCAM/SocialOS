-- Manual retry is allowed only for known, non-ambiguous failures.
-- Unknown provider outcomes require external reconciliation; never blindly republish them.
create or replace function public.retry_publish_job(
  p_job_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_job public.publish_jobs%rowtype;
  v_target public.social_post_targets%rowtype;
  v_role text;
begin
  select role into v_role
  from public.organization_members
  where organization_id=p_organization_id
    and user_id=p_actor_user_id
    and status='active';

  if v_role is null or v_role not in ('owner','administrator','manager','publisher') then
    raise exception 'Publishing manager permission required' using errcode='42501';
  end if;

  select * into v_job
  from public.publish_jobs
  where id=p_job_id and organization_id=p_organization_id
  for update;

  if not found then
    raise exception 'Publishing job not found' using errcode='P0002';
  end if;
  if v_job.status <> 'dead_letter' then
    raise exception 'Only dead-letter jobs can be manually retried' using errcode='22023';
  end if;
  if v_job.last_error_code = 'PUBLISH_OUTCOME_UNKNOWN' then
    raise exception 'Unknown provider outcomes must be reconciled externally before any retry' using errcode='42501';
  end if;

  select * into v_target
  from public.social_post_targets
  where id=v_job.target_id and organization_id=p_organization_id
  for update;

  if not found or v_target.platform_post_id is not null then
    raise exception 'Target is missing or already has a provider post ID' using errcode='42501';
  end if;
  if v_target.status <> 'failed' then
    raise exception 'Only failed targets can be retried' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.social_accounts a
    where a.id=v_target.social_account_id
      and a.organization_id=p_organization_id
      and a.connection_status='connected'
  ) then
    raise exception 'Reconnect the social account before retrying' using errcode='42501';
  end if;

  update public.publish_jobs
  set status='retry',attempt_count=0,available_at=now(),
      locked_at=null,locked_by=null,completed_at=null,
      last_error_code=null,last_error_message=null
  where id=p_job_id and organization_id=p_organization_id;

  update public.social_post_targets
  set status='queued',attempt_count=0,
      last_error_code=null,last_error_message=null
  where id=v_target.id and organization_id=p_organization_id;

  update public.social_posts
  set status='scheduled',last_error_code=null,last_error_message=null
  where id=v_job.post_id and organization_id=p_organization_id;

  insert into public.audit_events(
    organization_id,actor_user_id,action,resource_type,resource_id,metadata
  ) values (
    p_organization_id,p_actor_user_id,'social.publish_job.manually_retried',
    'publish_job',p_job_id,jsonb_build_object('target_id',v_target.id)
  );

  return true;
end;
$$;

revoke all on function public.retry_publish_job(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.retry_publish_job(uuid,uuid,uuid) to service_role;
