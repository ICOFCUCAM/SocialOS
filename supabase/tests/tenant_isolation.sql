-- Executable two-tenant RLS and authorization regression tests.
-- Run only against a disposable local database after all migrations have replayed.
-- All fixture rows are rolled back at the end.

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
) values
  ('10000000-0000-4000-8000-000000000001','authenticated','authenticated',
   'tenant-a-owner@socialos.test','',now(),'{}'::jsonb,'{}'::jsonb,now(),now(),false,false),
  ('20000000-0000-4000-8000-000000000002','authenticated','authenticated',
   'tenant-b-brand-editor@socialos.test','',now(),'{}'::jsonb,'{}'::jsonb,now(),now(),false,false),
  ('30000000-0000-4000-8000-000000000003','authenticated','authenticated',
   'tenant-a-viewer@socialos.test','',now(),'{}'::jsonb,'{}'::jsonb,now(),now(),false,false)
on conflict (id) do nothing;

insert into public.organizations(id,name,slug,owner_user_id,status)
values
 ('a0000000-0000-4000-8000-000000000001','Tenant A','tenant-a','10000000-0000-4000-8000-000000000001','active'),
 ('b0000000-0000-4000-8000-000000000002','Tenant B','tenant-b','20000000-0000-4000-8000-000000000002','active');

insert into public.organization_members(organization_id,user_id,role,status,joined_at)
values
 ('a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner','active',now()),
 ('a0000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','viewer','active',now()),
 ('b0000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','viewer','active',now());

insert into public.brands(id,organization_id,name,slug,created_by)
values
 ('aa000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Tenant A Brand','main','10000000-0000-4000-8000-000000000001'),
 ('bb000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','Tenant B Brand','main','20000000-0000-4000-8000-000000000002');

-- A viewer is explicitly a brand editor in Tenant B. This exercises the
-- direct brand-member branch rather than the owner/manager shortcut.
insert into public.brand_members(organization_id,brand_id,user_id,role)
values ('b0000000-0000-4000-8000-000000000002',
        'bb000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000002','editor');

-- Tenant A owner must see only Tenant A data.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
begin
  if (select count(*) from public.organizations) <> 1
     or not exists (select 1 from public.organizations where id='a0000000-0000-4000-8000-000000000001') then
    raise exception 'Tenant A owner can see another tenant or cannot see its own tenant';
  end if;
  if exists (select 1 from public.brands where id='bb000000-0000-4000-8000-000000000002') then
    raise exception 'Cross-tenant brand visibility: Tenant A owner can see Tenant B brand';
  end if;
  if not exists (select 1 from public.brands where id='aa000000-0000-4000-8000-000000000001') then
    raise exception 'Tenant A owner cannot see its own brand';
  end if;
end $$;

-- Tenant B editor has legitimate brand access while the tenant is active.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$
begin
  if not exists (select 1 from public.brands where id='bb000000-0000-4000-8000-000000000002') then
    raise exception 'Active Tenant B brand editor cannot see its assigned brand';
  end if;
  if exists (select 1 from public.brands where id='aa000000-0000-4000-8000-000000000001') then
    raise exception 'Cross-tenant brand visibility: Tenant B editor can see Tenant A brand';
  end if;
end $$;

reset role;

-- Suspend Tenant B as the service role so the production guard trigger accepts
-- this trusted administrative state change. The brand membership remains active.
set local role service_role;
update public.organizations
set status='suspended'
where id='b0000000-0000-4000-8000-000000000002';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$
declare
  rejected boolean := false;
begin
  if exists (select 1 from public.brands where id='bb000000-0000-4000-8000-000000000002') then
    raise exception 'Suspended tenant brand remains visible to its brand editor';
  end if;

  begin
    perform public.create_social_post_bundle(jsonb_build_object(
      'organization_id','b0000000-0000-4000-8000-000000000002',
      'brand_id','bb000000-0000-4000-8000-000000000002',
      'body','This must never be created while tenant is suspended',
      'target_account_ids',jsonb_build_array()
    ));
  exception when insufficient_privilege then
    rejected := true;
  end;

  if not rejected then
    raise exception 'Post creation was not rejected for a suspended tenant';
  end if;
end $$;

-- A workspace viewer cannot use the post-creation RPC even in an active tenant.
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.create_social_post_bundle(jsonb_build_object(
      'organization_id','a0000000-0000-4000-8000-000000000001',
      'brand_id','aa000000-0000-4000-8000-000000000001',
      'body','Viewer role must not create posts',
      'target_account_ids',jsonb_build_array()
    ));
  exception when insufficient_privilege then
    rejected := true;
  end;

  if not rejected then
    raise exception 'Workspace viewer was allowed to create a social post';
  end if;
end $$;

reset role;
rollback;

select 'SocialOS tenant isolation tests passed' as result;
