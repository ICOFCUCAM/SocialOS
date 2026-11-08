-- Recover jobs abandoned by a worker crash or deployment restart.
create or replace function public.recover_stale_media_processing_jobs(p_lease_minutes integer default 20)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recovered integer;
begin
  with stale as (
    select id, asset_id, attempt_count, max_attempts
    from public.media_processing_jobs
    where status = 'running'
      and locked_at < now() - make_interval(mins => greatest(5, least(coalesce(p_lease_minutes, 20), 120)))
    for update skip locked
  ), changed as (
    update public.media_processing_jobs j
    set status = case when s.attempt_count >= s.max_attempts then 'dead_letter'::public.media_processing_job_status
                      else 'retry'::public.media_processing_job_status end,
        available_at = now(), locked_at = null, locked_by = null,
        completed_at = case when s.attempt_count >= s.max_attempts then now() else null end,
        last_error_code = 'WORKER_LEASE_EXPIRED',
        last_error_message = 'Worker lease expired before the job completed.'
    from stale s where j.id = s.id
    returning j.asset_id, j.status
  ), marked_assets as (
    update public.social_media_assets a set processing_status = 'failed'
    from changed c where a.id = c.asset_id and c.status = 'dead_letter'
    returning a.id
  )
  select count(*)::integer into recovered from changed;
  return coalesce(recovered, 0);
end;
$$;
revoke all on function public.recover_stale_media_processing_jobs(integer) from public, anon, authenticated;
grant execute on function public.recover_stale_media_processing_jobs(integer) to service_role;
