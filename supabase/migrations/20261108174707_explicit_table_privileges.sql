-- Explicit table grants: RLS is the row boundary; SQL privileges are the operation boundary.
revoke all privileges on all tables in schema public from anon, authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select on public.organization_invitations to authenticated;
grant select, insert, update, delete on public.brands to authenticated;
grant select on public.brand_members to authenticated;
grant select on public.social_platforms to authenticated;
grant select on public.social_accounts to authenticated;
grant select on public.audit_events to authenticated;
revoke all privileges on public.social_account_tokens from anon, authenticated;
grant all privileges on all tables in schema public to service_role;
alter default privileges in schema public revoke all on tables from anon, authenticated;
