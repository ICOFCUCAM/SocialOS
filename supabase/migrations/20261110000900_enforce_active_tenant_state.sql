-- Enforce active-tenant state on every brand access path and publishing RPC.
-- The previous brand-member branch did not check organization suspension/deletion.
create or replace function private.can_access_brand(p_brand_id uuid,p_org_id uuid)
returns boolean
language sql stable security definer
set search_path=public,auth,private,pg_temp
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id=p_org_id and o.status='active' and o.deleted_at is null
      and (
        private.has_org_role(p_org_id,array['owner','administrator','manager'])
        or exists (
          select 1
          from public.brand_members bm
          join public.organization_members om
            on om.organization_id=bm.organization_id and om.user_id=bm.user_id
          where bm.brand_id=p_brand_id and bm.organization_id=p_org_id
            and bm.user_id=auth.uid() and om.status='active'
        )
      )
  );
$$;

revoke all on function private.can_access_brand(uuid,uuid) from public,anon;
grant execute on function private.can_access_brand(uuid,uuid) to authenticated,service_role;

-- Recreate the existing authenticated RPC with an explicit active-tenant guard.
create or replace function public.create_social_post_bundle(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := (p_payload->>'organization_id')::uuid;
  v_brand_id uuid := (p_payload->>'brand_id')::uuid;
  v_post_id uuid := gen_random_uuid();
  v_scheduled_at timestamptz := nullif(p_payload->>'scheduled_at','')::timestamptz;
  v_timezone text := coalesce(nullif(p_payload->>'timezone',''),'UTC');
  v_role text;
  v_account_id uuid;
  v_asset_id uuid;
  v_target_id uuid;
  v_item jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if v_org_id is null or v_brand_id is null then
    raise exception 'Organisation and brand are required' using errcode='22023';
  end if;

  -- Block all client post creation while a workspace is suspended or deleted.
  if not exists (
    select 1 from public.organizations o
    where o.id=v_org_id and o.status='active' and o.deleted_at is null
  ) then
    raise exception 'Active workspace required' using errcode='42501';
  end if;

  select role into v_role
  from public.organization_members
  where organization_id=v_org_id and user_id=v_user_id and status='active';
  if v_role is null then
    raise exception 'Active workspace membership required' using errcode='42501';
  end if;
  if v_role not in ('owner','administrator','manager','editor','publisher') then
    raise exception 'Insufficient workspace role' using errcode='42501';
  end if;
  if v_scheduled_at is not null and v_role not in ('owner','administrator','manager','publisher') then
    raise exception 'Publishing permission required to schedule posts' using errcode='42501';
  end if;
  if not exists(select 1 from public.brands b where b.id=v_brand_id
    and b.organization_id=v_org_id and b.is_active) then
    raise exception 'Active brand not found in this workspace' using errcode='42501';
  end if;
  if v_role not in ('owner','administrator','manager') and not exists(
    select 1 from public.brand_members bm
    where bm.organization_id=v_org_id and bm.brand_id=v_brand_id and bm.user_id=v_user_id
      and bm.role in ('manager','editor','publisher')
  ) then
    raise exception 'Brand membership required' using errcode='42501';
  end if;
  if v_scheduled_at is not null and v_role not in ('owner','administrator','manager','publisher')
    and not exists(select 1 from public.brand_members bm
      where bm.organization_id=v_org_id and bm.brand_id=v_brand_id and bm.user_id=v_user_id
        and bm.role in ('manager','publisher')) then
    raise exception 'Brand publishing permission required to schedule posts' using errcode='42501';
  end if;
  if length(coalesce(p_payload->>'body','')) > 20000
    or length(coalesce(p_payload->>'title','')) > 200 then
    raise exception 'Post title or body exceeds the supported length' using errcode='22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'target_account_ids','[]'::jsonb)) > 20
    or jsonb_array_length(coalesce(p_payload->'asset_ids','[]'::jsonb)) > 20 then
    raise exception 'Too many destinations or media assets' using errcode='22023';
  end if;
  if v_scheduled_at is not null and v_scheduled_at <= now() then
    raise exception 'Scheduled time must be in the future' using errcode='22023';
  end if;
  if not exists(select 1 from jsonb_array_elements_text(coalesce(p_payload->'target_account_ids','[]'::jsonb))) then
    raise exception 'At least one destination account is required' using errcode='22023';
  end if;

  insert into public.social_posts(
    id,organization_id,brand_id,created_by,title,body,status,scheduled_at,timezone
  ) values (
    v_post_id,v_org_id,v_brand_id,v_user_id,
    nullif(p_payload->>'title',''),coalesce(p_payload->>'body',''),
    case when v_scheduled_at is null then 'draft'::public.social_post_status else 'scheduled'::public.social_post_status end,
    v_scheduled_at,v_timezone
  );

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'asset_ids','[]'::jsonb))
  loop
    v_asset_id := (v_item#>>'{}')::uuid;
    if not exists(select 1 from public.social_media_assets a
      where a.id=v_asset_id and a.organization_id=v_org_id and a.brand_id=v_brand_id
        and a.processing_status='ready') then
      raise exception 'Media asset is unavailable, unprocessed or belongs to another brand' using errcode='42501';
    end if;
    insert into public.social_post_media(organization_id,post_id,asset_id,position)
    values(v_org_id,v_post_id,v_asset_id,(select count(*) from public.social_post_media where post_id=v_post_id));
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'target_account_ids','[]'::jsonb))
  loop
    v_account_id := (v_item#>>'{}')::uuid;
    if not exists(select 1 from public.social_accounts a
      where a.id=v_account_id and a.organization_id=v_org_id and a.brand_id=v_brand_id
        and a.connection_status='connected') then
      raise exception 'Destination account is not connected to this brand' using errcode='42501';
    end if;
    insert into public.social_post_targets(organization_id,post_id,social_account_id,status,scheduled_at)
    values(v_org_id,v_post_id,v_account_id,
      case when v_scheduled_at is null then 'pending'::public.social_post_target_status else 'queued'::public.social_post_target_status end,
      v_scheduled_at)
    returning id into v_target_id;
    if v_scheduled_at is not null then
      insert into public.publish_jobs(organization_id,post_id,target_id,idempotency_key,available_at)
      values(v_org_id,v_post_id,v_target_id,'social-post:'||v_post_id::text||':target:'||v_target_id::text,v_scheduled_at);
    end if;
  end loop;
  return v_post_id;
end;
$$;
revoke all on function public.create_social_post_bundle(jsonb) from public,anon;
grant execute on function public.create_social_post_bundle(jsonb) to authenticated;
