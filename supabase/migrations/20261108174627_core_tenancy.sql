create extension if not exists pgcrypto;

do $$ begin create type public.workspace_type as enum ('internal','customer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.organization_status as enum ('active','suspended','pending_deletion'); exception when duplicate_object then null; end $$;
do $$ begin create type public.member_status as enum ('active','invited','suspended','removed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.social_connection_status as enum ('pending','connected','expired','reauthorization_required','disconnected','error'); exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end; $$;

create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) > 0),
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
 workspace_type public.workspace_type not null default 'customer',
 status public.organization_status not null default 'active',
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 settings jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index organizations_owner_idx on public.organizations(owner_user_id);

create table public.organization_members (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 role text not null default 'viewer' check (role in ('owner','administrator','manager','editor','publisher','analyst','client','viewer')),
 status public.member_status not null default 'active',
 joined_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (organization_id,user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

create table public.organization_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 email text not null check (length(trim(email)) > 3),
 role text not null check (role in ('administrator','manager','editor','publisher','analyst','client','viewer')),
 invitation_token_hash text not null unique,
 invited_by uuid not null references auth.users(id) on delete restrict,
 expires_at timestamptz not null,
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index organization_invitations_org_idx on public.organization_invitations(organization_id);

create table public.brands (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 name text not null check (length(trim(name)) > 0),
 slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
 description text,
 website_url text,
 brand_settings jsonb not null default '{}'::jsonb,
 is_active boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (organization_id,slug),
 unique (id,organization_id)
);
create index brands_organization_idx on public.brands(organization_id);

create table public.brand_members (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 brand_id uuid not null,
 user_id uuid not null,
 role text not null default 'editor' check (role in ('manager','editor','publisher','analyst','viewer')),
 created_at timestamptz not null default now(),
 unique (brand_id,user_id),
 foreign key (brand_id,organization_id) references public.brands(id,organization_id) on delete restrict,
 foreign key (organization_id,user_id) references public.organization_members(organization_id,user_id) on delete restrict
);

create table public.social_platforms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 name text not null,
 is_enabled boolean not null default true,
 capabilities jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
insert into public.social_platforms(code,name) values
 ('instagram','Instagram'),('facebook','Facebook'),('tiktok','TikTok'),('youtube','YouTube'),
 ('linkedin','LinkedIn'),('threads','Threads'),('pinterest','Pinterest'),('x','X')
on conflict(code) do nothing;

create table public.social_accounts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 brand_id uuid not null,
 platform_id uuid not null references public.social_platforms(id) on delete restrict,
 external_account_id text not null,
 account_name text not null,
 account_username text,
 account_type text,
 profile_image_url text,
 connection_status public.social_connection_status not null default 'pending',
 granted_scopes text[] not null default '{}',
 last_verified_at timestamptz,
 last_error text,
 metadata jsonb not null default '{}'::jsonb,
 connected_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (brand_id,organization_id) references public.brands(id,organization_id) on delete restrict,
 unique (organization_id,platform_id,external_account_id),
 unique (id,organization_id)
);
create index social_accounts_brand_idx on public.social_accounts(brand_id);

-- Only encrypted token material is stored here; encryption keys remain outside PostgreSQL.
create table public.social_account_tokens (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 social_account_id uuid not null unique,
 access_token_nonce bytea not null,
 access_token_ciphertext bytea not null,
 access_token_tag bytea not null,
 refresh_token_nonce bytea,
 refresh_token_ciphertext bytea,
 refresh_token_tag bytea,
 encryption_algorithm text not null default 'AES-256-GCM' check (encryption_algorithm = 'AES-256-GCM'),
 encryption_key_version text not null,
 access_token_expires_at timestamptz,
 refresh_token_expires_at timestamptz,
 token_type text,
 last_refreshed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (social_account_id,organization_id) references public.social_accounts(id,organization_id) on delete restrict,
 check ((refresh_token_nonce is null and refresh_token_ciphertext is null and refresh_token_tag is null)
     or (refresh_token_nonce is not null and refresh_token_ciphertext is not null and refresh_token_tag is not null))
);

create table public.audit_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete restrict,
 actor_user_id uuid references auth.users(id) on delete set null,
 action text not null,
 resource_type text not null,
 resource_id uuid,
 ip_address inet,
 user_agent text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index audit_events_org_time_idx on public.audit_events(organization_id,created_at desc);

create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger organization_members_set_updated_at before update on public.organization_members for each row execute function public.set_updated_at();
create trigger brands_set_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger social_accounts_set_updated_at before update on public.social_accounts for each row execute function public.set_updated_at();
create trigger social_account_tokens_set_updated_at before update on public.social_account_tokens for each row execute function public.set_updated_at();

create or replace function public.create_customer_organization(p_name text,p_slug text)
returns uuid language plpgsql security definer set search_path = public, auth, pg_temp
as $$
declare v_user_id uuid := auth.uid(); v_org_id uuid;
begin
 if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_name is null or length(trim(p_name))=0 then raise exception 'Organization name is required' using errcode='22023'; end if;
 if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then raise exception 'Invalid organization slug' using errcode='22023'; end if;
 insert into public.organizations(name,slug,workspace_type,owner_user_id)
 values(trim(p_name),p_slug,'customer',v_user_id) returning id into v_org_id;
 insert into public.organization_members(organization_id,user_id,role,status,joined_at)
 values(v_org_id,v_user_id,'owner','active',now());
 return v_org_id;
end; $$;
revoke all on function public.create_customer_organization(text,text) from public;
grant execute on function public.create_customer_organization(text,text) to authenticated;
comment on table public.social_account_tokens is 'Encrypted OAuth credentials; backend/service role only.';
