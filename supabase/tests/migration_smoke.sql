-- Local migration replay smoke tests.
-- Run only against a disposable local database after supabase db reset.
do $$
declare
  required_tables text[] := array[
    'organizations','organization_members','brands','brand_members',
    'profiles','social_platforms','social_accounts','social_account_tokens',
    'social_media_assets','social_posts','social_post_media','social_post_targets',
    'publish_jobs','media_processing_jobs','social_campaigns',
    'social_campaign_posts','social_post_analytics_daily'
  ];
  missing text[];
  tbl text;
begin
  select array_agg(name) into missing
  from unnest(required_tables) as t(name)
  where to_regclass('public.' || name) is null;

  if missing is not null then
    raise exception 'Missing required SocialOS tables: %', array_to_string(missing, ', ');
  end if;

  foreach tbl in array required_tables loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=tbl and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', tbl;
    end if;
  end loop;

  if to_regprocedure('private.can_access_brand(uuid,uuid)') is null then
    raise exception 'Missing private tenant brand-access helper';
  end if;
  if to_regprocedure('public.is_org_member(uuid)') is not null
     or to_regprocedure('public.has_org_role(uuid,text[])') is not null
     or to_regprocedure('public.can_access_brand(uuid,uuid)') is not null then
    raise exception 'Legacy tenant helpers remain in the exposed public schema';
  end if;
  if has_function_privilege('anon','private.can_access_brand(uuid,uuid)','EXECUTE') then
    raise exception 'Anonymous role can execute private tenant authorization helper';
  end if;
  if has_table_privilege('anon','public.social_account_tokens','SELECT')
     or has_table_privilege('authenticated','public.social_account_tokens','SELECT') then
    raise exception 'Browser role can read encrypted OAuth token records';
  end if;
  if not has_table_privilege('service_role','public.social_account_tokens','SELECT') then
    raise exception 'Service role cannot read OAuth token records';
  end if;

  if to_regprocedure('public.claim_publish_jobs(text,integer)') is null then
    raise exception 'Missing publish job claim RPC';
  end if;
  if to_regprocedure('public.claim_media_processing_jobs(text,integer)') is null then
    raise exception 'Missing media processing claim RPC';
  end if;
  if to_regprocedure('public.recover_stale_media_processing_jobs(integer)') is null then
    raise exception 'Missing media lease recovery RPC';
  end if;
  if to_regprocedure('public.recover_stale_publish_jobs(integer)') is null then
    raise exception 'Missing publishing lease recovery RPC';
  end if;
  if to_regprocedure('public.claim_social_token_refresh(uuid,text,integer)') is null then
    raise exception 'Missing OAuth refresh lock RPC';
  end if;
  if to_regprocedure('public.disconnect_social_account(uuid,uuid,uuid)') is null then
    raise exception 'Missing atomic disconnect RPC';
  end if;
  if to_regprocedure('public.retry_publish_job(uuid,uuid,uuid)') is null then
    raise exception 'Missing safe publish retry RPC';
  end if;
  if to_regprocedure('public.create_social_campaign(jsonb)') is null then
    raise exception 'Missing campaign creation RPC';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id='social-media' and public=false and file_size_limit=262144000
  ) then
    raise exception 'Private social-media storage bucket is missing or misconfigured';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and roles && array['anon','authenticated']::name[]
      and (qual ilike '%social-media%' or with_check ilike '%social-media%')
  ) then
    raise exception 'Unexpected direct client storage.objects policy references social-media';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'claim_publish_jobs','claim_media_processing_jobs',
        'recover_stale_media_processing_jobs','recover_stale_publish_jobs',
        'claim_social_token_refresh','release_social_token_refresh',
        'disconnect_social_account','retry_publish_job'
      )
      and has_function_privilege('anon',p.oid,'EXECUTE')
  ) then
    raise exception 'A privileged worker RPC is executable by anon';
  end if;
end $$;

select 'SocialOS migration smoke tests passed' as result;
