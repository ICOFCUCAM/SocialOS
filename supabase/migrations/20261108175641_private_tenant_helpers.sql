-- Move SECURITY DEFINER tenant helpers out of the exposed public API schema.
-- RLS policies can still invoke them, but PostgREST does not expose the private schema
-- unless an operator explicitly adds it to the Data API exposed schemas.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_org_member(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path=public,auth,pg_temp
as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id=m.organization_id
    where m.organization_id=p_org_id and m.user_id=auth.uid()
      and m.status='active' and o.status='active' and o.deleted_at is null
  );
$$;

create or replace function private.has_org_role(p_org_id uuid,p_roles text[])
returns boolean
language sql stable security definer
set search_path=public,auth,pg_temp
as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id=m.organization_id
    where m.organization_id=p_org_id and m.user_id=auth.uid()
      and m.status='active' and o.status='active' and o.deleted_at is null
      and m.role=any(p_roles)
  );
$$;

create or replace function private.can_access_brand(p_brand_id uuid,p_org_id uuid)
returns boolean
language sql stable security definer
set search_path=public,auth,private,pg_temp
as $$
  select private.has_org_role(p_org_id,array['owner','administrator','manager'])
  or exists (
    select 1 from public.brand_members bm
    join public.organization_members om
      on om.organization_id=bm.organization_id and om.user_id=bm.user_id
    where bm.brand_id=p_brand_id and bm.organization_id=p_org_id
      and bm.user_id=auth.uid() and om.status='active'
  );
$$;

revoke all on function private.is_org_member(uuid) from public,anon;
revoke all on function private.has_org_role(uuid,text[]) from public,anon;
revoke all on function private.can_access_brand(uuid,uuid) from public,anon;
grant execute on function private.is_org_member(uuid) to authenticated,service_role;
grant execute on function private.has_org_role(uuid,text[]) to authenticated,service_role;
grant execute on function private.can_access_brand(uuid,uuid) to authenticated,service_role;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations for select to authenticated
using(private.is_org_member(id));

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations for update to authenticated
using(private.has_org_role(id,array['owner','administrator']))
with check(private.has_org_role(id,array['owner','administrator']));

drop policy if exists organization_members_select_self_or_admin on public.organization_members;
create policy organization_members_select_self_or_admin on public.organization_members for select to authenticated
using(user_id=auth.uid() or private.has_org_role(organization_id,array['owner','administrator']));

drop policy if exists organization_invitations_select_admin on public.organization_invitations;
create policy organization_invitations_select_admin on public.organization_invitations for select to authenticated
using(private.has_org_role(organization_id,array['owner','administrator']));

drop policy if exists brands_select_authorized on public.brands;
create policy brands_select_authorized on public.brands for select to authenticated
using(private.can_access_brand(id,organization_id));

drop policy if exists brands_insert_managers on public.brands;
create policy brands_insert_managers on public.brands for insert to authenticated
with check(private.has_org_role(organization_id,array['owner','administrator','manager']) and (created_by is null or created_by=auth.uid()));

drop policy if exists brands_update_managers on public.brands;
create policy brands_update_managers on public.brands for update to authenticated
using(private.has_org_role(organization_id,array['owner','administrator','manager']))
with check(private.has_org_role(organization_id,array['owner','administrator','manager']));

drop policy if exists brands_delete_admin on public.brands;
create policy brands_delete_admin on public.brands for delete to authenticated
using(private.has_org_role(organization_id,array['owner','administrator']));

drop policy if exists brand_members_select_authorized on public.brand_members;
create policy brand_members_select_authorized on public.brand_members for select to authenticated
using(private.can_access_brand(brand_id,organization_id));

drop policy if exists social_accounts_select_authorized on public.social_accounts;
create policy social_accounts_select_authorized on public.social_accounts for select to authenticated
using(private.can_access_brand(brand_id,organization_id));

drop policy if exists audit_events_select_admin_or_actor on public.audit_events;
create policy audit_events_select_admin_or_actor on public.audit_events for select to authenticated
using(actor_user_id=auth.uid() or (organization_id is not null and private.has_org_role(organization_id,array['owner','administrator'])));

-- Remove the old helper entry points from the exposed public schema.
drop function if exists public.is_org_member(uuid);
drop function if exists public.has_org_role(uuid,text[]);
drop function if exists public.can_access_brand(uuid,uuid);
