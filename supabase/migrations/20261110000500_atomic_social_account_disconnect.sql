-- Make credential deletion, account state transition and audit record atomic.
create or replace function public.disconnect_social_account(
  p_account_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare affected integer;
declare platform_code text;
begin
  select sp.code into platform_code
  from public.social_accounts sa
  join public.social_platforms sp on sp.id=sa.platform_id
  where sa.id=p_account_id and sa.organization_id=p_organization_id
  for update of sa;

  if not found then
    raise exception 'Social account not found in this organization' using errcode='P0002';
  end if;

  delete from public.social_account_tokens
  where social_account_id=p_account_id and organization_id=p_organization_id;

  update public.social_accounts
  set connection_status='disconnected', last_error=null
  where id=p_account_id and organization_id=p_organization_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Unable to disconnect social account' using errcode='P0001';
  end if;

  insert into public.audit_events(
    organization_id,actor_user_id,action,resource_type,resource_id,metadata
  ) values (
    p_organization_id,p_actor_user_id,'social_account.disconnected','social_account',p_account_id,
    jsonb_build_object('platform',coalesce(platform_code,'unknown'))
  );

  return true;
end;
$$;

revoke all on function public.disconnect_social_account(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.disconnect_social_account(uuid,uuid,uuid) to service_role;
