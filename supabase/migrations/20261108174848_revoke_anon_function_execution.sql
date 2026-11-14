-- Supabase grants EXECUTE on public functions to anon by default in this project.
-- These functions are intended for authenticated application sessions or trusted backend use.
revoke execute on function public.create_customer_organization(text,text) from anon;
revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.has_org_role(uuid,text[]) from anon;
revoke execute on function public.can_access_brand(uuid,uuid) from anon;
