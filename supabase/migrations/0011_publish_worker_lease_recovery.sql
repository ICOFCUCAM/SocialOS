-- Recover publishing jobs abandoned by a worker crash or forced deployment restart.
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
    select id, target_id, attempt_count, max_attempts
    from public.publish_jobs
    where status = 'running'
      and locked_at < now() - make_interval(mins => greatest(2, least(coalesce(p_lease_minutes, 15), 120)))
    for update skip locked
  ), changed as (
    update public.publish_jobs j
    set status = 'dead_letter'::public.publish_job_status,
        available_at = now(),
        locked_at = null,
        locked_by = null,
        completed_at = now(),
        last_error_code = 'WORKER_LEASE_EXPIRED',
        last_error_message = 'Publishing worker lease expired. Provider outcome must be reconciled before retry.'
    from stale s
    where j.id = s.id
    returning j.target_id, j.status
  ), updated_targets as (
    update public.social_post_targets t
    set status = 'failed'::public.social_post_target_status,
        last_error_code = 'WORKER_LEASE_EXPIRED',
        last_error_message = 'Worker stopped before the publishing result was recorded; verify provider state before retry.'
    from changed c
    where t.id = c.target_id
    returning t.id
  )
  select count(*)::integer into recovered from changed;
  return coalesce(recovered, 0);
end;
$$;
revoke all on function public.recover_stale_publish_jobs(integer) from public, anon, authenticated;
grant execute on function public.recover_stale_publish_jobs(integer) to service_role;
