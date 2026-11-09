-- Coordinate OAuth refresh across publisher replicas and preserve provider token lifetimes.
alter table public.social_account_tokens
  add column if not exists token_refresh_locked_at timestamptz,
  add column if not exists token_refresh_locked_by text;

create or replace function public.claim_social_token_refresh(
  p_social_account_id uuid,
  p_worker_id text,
  p_stale_after_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare claimed integer;
begin
  update public.social_account_tokens
  set token_refresh_locked_at = now(),
      token_refresh_locked_by = p_worker_id
  where social_account_id = p_social_account_id
    and (token_refresh_locked_at is null
      or token_refresh_locked_at < now() - make_interval(secs => greatest(30, least(coalesce(p_stale_after_seconds,120),600))));
  get diagnostics claimed = row_count;
  return claimed = 1;
end;
$$;

create or replace function public.release_social_token_refresh(
  p_social_account_id uuid,
  p_worker_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare released integer;
begin
  update public.social_account_tokens
  set token_refresh_locked_at = null,
      token_refresh_locked_by = null
  where social_account_id = p_social_account_id
    and token_refresh_locked_by = p_worker_id;
  get diagnostics released = row_count;
  return released = 1;
end;
$$;

revoke all on function public.claim_social_token_refresh(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.release_social_token_refresh(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_social_token_refresh(uuid,text,integer) to service_role;
grant execute on function public.release_social_token_refresh(uuid,text) to service_role;
