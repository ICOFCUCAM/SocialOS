-- Make first-workspace creation atomic: organisation, owner membership and starter brand
-- are created in one transaction through the authenticated onboarding RPC.
create or replace function public.create_customer_organization(p_name text,p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 120 then
    raise exception 'Workspace name must be between 2 and 120 characters' using errcode='22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'Invalid workspace slug' using errcode='22023';
  end if;

  insert into public.organizations(name,slug,workspace_type,owner_user_id)
  values(trim(p_name),p_slug,'customer',v_user_id)
  returning id into v_org_id;

  insert into public.organization_members(organization_id,user_id,role,status,joined_at)
  values(v_org_id,v_user_id,'owner','active',now());

  insert into public.brands(organization_id,name,slug,created_by)
  values(v_org_id,trim(p_name),'main',v_user_id);

  return v_org_id;
end;
$$;

revoke all on function public.create_customer_organization(text,text) from public, anon;
grant execute on function public.create_customer_organization(text,text) to authenticated;
