-- Recover publishing jobs abandoned by a worker crash or forced deployment restart.
-- If the provider ID was already persisted, close the job as succeeded; otherwise
-- dead-letter it for manual reconciliation rather than risk publishing duplicates.
create or replace function public.recover_stale_publish_jobs(p_lease_minutes integer default 15)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recovered integer;
begin
  with stale as (
    select j.id, j.target_id, t.platform_post_id
    from public.publish_jobs j
    join public.social_post_targets t on t.id = j.target_id
    where j.status = 'running'
      and j.locked_at < now() - make_interval(mins => greatest(2, least(coalesce(p_lease_minutes, 15), 120)))
    for update of j skip locked
  ), changed as (
    update public.publish_jobs j
    set status = case when s.platform_post_id is not null
                      then 'succeeded'::public.publish_job_status
                      else 'dead_letter'::public.publish_job_status end,
        locked_at = null,
        locked_by = null,
        completed_at = now(),
        last_error_code = case when s.platform_post_id is not null then null else 'PUBLISH_OUTCOME_UNKNOWN' end,
        last_error_message = case when s.platform_post_id is not null then null
          else 'Worker lease expired without a recorded provider post ID. Reconcile externally before retrying.' end
    from stale s
    where j.id = s.id
    returning j.target_id, s.platform_post_id
  ), updated_targets as (
    update public.social_post_targets t
    set status = 'failed'::public.social_post_target_status,
        last_error_code = 'PUBLISH_OUTCOME_UNKNOWN',
        last_error_message = 'Worker stopped before the provider result was recorded. Check the platform before retrying.'
    from changed c
    where t.id = c.target_id and c.platform_post_id is null
    returning t.id
  )
  select count(*)::integer into recovered from changed;
  return coalesce(recovered, 0);
end;
$$;
revoke all on function public.recover_stale_publish_jobs(integer) from public, anon, authenticated;
grant execute on function public.recover_stale_publish_jobs(integer) to service_role;
