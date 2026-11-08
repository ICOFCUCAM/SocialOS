-- User profile records are separate from authentication credentials.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or length(trim(display_name)) between 1 and 120),
  avatar_url text,
  locale text not null default 'en' check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_self
on public.profiles for select to authenticated
using (user_id = auth.uid());

create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (user_id = auth.uid());

create policy profiles_update_self
on public.profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all privileges on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant all privileges on public.profiles to service_role;

-- Create a profile for every new Auth user without exposing auth.users to clients.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_socialos on auth.users;
create trigger on_auth_user_created_socialos
after insert on auth.users
for each row execute function public.handle_new_auth_user();
