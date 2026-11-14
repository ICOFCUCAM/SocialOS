create or replace function public.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp
as $$ select exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
 where m.organization_id=p_org_id and m.user_id=auth.uid() and m.status='active' and o.status='active' and o.deleted_at is null); $$;

create or replace function public.has_org_role(p_org_id uuid,p_roles text[])
returns boolean language sql stable security definer set search_path=public,auth,pg_temp
as $$ select exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
 where m.organization_id=p_org_id and m.user_id=auth.uid() and m.status='active' and o.status='active'
 and o.deleted_at is null and m.role=any(p_roles)); $$;

create or replace function public.can_access_brand(p_brand_id uuid,p_org_id uuid)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp
as $$ select public.has_org_role(p_org_id,array['owner','administrator','manager'])
 or exists(select 1 from public.brand_members bm join public.organization_members om
 on om.organization_id=bm.organization_id and om.user_id=bm.user_id
 where bm.brand_id=p_brand_id and bm.organization_id=p_org_id and bm.user_id=auth.uid() and om.status='active'); $$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid,text[]) from public;
revoke all on function public.can_access_brand(uuid,uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated,service_role;
grant execute on function public.has_org_role(uuid,text[]) to authenticated,service_role;
grant execute on function public.can_access_brand(uuid,uuid) to authenticated,service_role;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.social_platforms enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_account_tokens enable row level security;
alter table public.audit_events enable row level security;

create policy organizations_select_member on public.organizations for select to authenticated using(public.is_org_member(id));
create policy organizations_update_admin on public.organizations for update to authenticated
 using(public.has_org_role(id,array['owner','administrator']))
 with check(public.has_org_role(id,array['owner','administrator']));
create policy organization_members_select_self_or_admin on public.organization_members for select to authenticated
 using(user_id=auth.uid() or public.has_org_role(organization_id,array['owner','administrator']));
create policy organization_invitations_select_admin on public.organization_invitations for select to authenticated
 using(public.has_org_role(organization_id,array['owner','administrator']));
create policy brands_select_authorized on public.brands for select to authenticated using(public.can_access_brand(id,organization_id));
create policy brands_insert_managers on public.brands for insert to authenticated with check(
 public.has_org_role(organization_id,array['owner','administrator','manager']) and (created_by is null or created_by=auth.uid()));
create policy brands_update_managers on public.brands for update to authenticated
 using(public.has_org_role(organization_id,array['owner','administrator','manager']))
 with check(public.has_org_role(organization_id,array['owner','administrator','manager']));
create policy brands_delete_admin on public.brands for delete to authenticated
 using(public.has_org_role(organization_id,array['owner','administrator']));
create policy brand_members_select_authorized on public.brand_members for select to authenticated using(public.can_access_brand(brand_id,organization_id));
create policy social_platforms_select_enabled on public.social_platforms for select to authenticated using(is_enabled=true);
create policy social_accounts_select_authorized on public.social_accounts for select to authenticated using(public.can_access_brand(brand_id,organization_id));
create policy audit_events_select_admin_or_actor on public.audit_events for select to authenticated using(
 actor_user_id=auth.uid() or (organization_id is not null and public.has_org_role(organization_id,array['owner','administrator'])));

-- Token records are never exposed to browser roles.
revoke all on table public.social_account_tokens from anon,authenticated;
grant all on table public.social_account_tokens to service_role;

-- SECURITY INVOKER is intentional: current_user remains the request role.
create or replace function public.prevent_client_critical_org_change()
returns trigger language plpgsql set search_path=public,auth,pg_temp
as $$ begin
 if current_user <> 'service_role' and (
  new.owner_user_id is distinct from old.owner_user_id or
  new.workspace_type is distinct from old.workspace_type or
  new.status is distinct from old.status or
  new.deleted_at is distinct from old.deleted_at) then
  raise exception 'Critical organisation changes require trusted backend workflow' using errcode='42501';
 end if;
 return new;
end; $$;
drop trigger if exists organizations_prevent_client_critical_change on public.organizations;
create trigger organizations_prevent_client_critical_change before update of owner_user_id,workspace_type,status,deleted_at
on public.organizations for each row execute function public.prevent_client_critical_org_change();

-- Membership, invitation, social connection, token and audit writes are backend-mediated.
-- No authenticated write policies are defined for those tables in this migration.
