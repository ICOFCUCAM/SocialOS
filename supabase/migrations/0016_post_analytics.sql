-- Normalised provider-reported post analytics.
-- Provider workers write these rows with service_role; tenant users receive read-only access.
create table public.social_post_analytics_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  target_id uuid not null,
  metric_date date not null,
  period_type text not null default 'daily' check (period_type in ('daily','lifetime')),
  impressions bigint check (impressions is null or impressions >= 0),
  reach bigint check (reach is null or reach >= 0),
  engagements bigint check (engagements is null or engagements >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  shares bigint check (shares is null or shares >= 0),
  saves bigint check (saves is null or saves >= 0),
  clicks bigint check (clicks is null or clicks >= 0),
  video_views bigint check (video_views is null or video_views >= 0),
  profile_visits bigint check (profile_visits is null or profile_visits >= 0),
  followers_gained bigint check (followers_gained is null or followers_gained >= 0),
  provider_metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metrics) = 'object'),
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (target_id,organization_id)
    references public.social_post_targets(id,organization_id) on delete cascade,
  unique (target_id,metric_date,period_type)
);

create index social_post_analytics_org_date_idx
  on public.social_post_analytics_daily(organization_id,metric_date desc);
create index social_post_analytics_target_date_idx
  on public.social_post_analytics_daily(target_id,metric_date desc);

alter table public.social_post_analytics_daily enable row level security;

create policy social_post_analytics_select_brand on public.social_post_analytics_daily
  for select to authenticated using (
    exists (
      select 1
      from public.social_post_targets t
      join public.social_posts p
        on p.id=t.post_id and p.organization_id=t.organization_id
      where t.id=target_id and t.organization_id=organization_id
        and private.can_access_brand(p.brand_id,p.organization_id)
    )
  );

revoke all on public.social_post_analytics_daily from public,anon,authenticated;
grant select on public.social_post_analytics_daily to authenticated;
grant all on public.social_post_analytics_daily to service_role;

comment on table public.social_post_analytics_daily is
  'Normalised provider-reported post metrics. Daily rows are additive over time; lifetime rows are point-in-time snapshots and must not be summed across collection dates.';
comment on column public.social_post_analytics_daily.provider_metrics is
  'Allowlisted provider-specific metric values not yet mapped to common columns. Must not contain raw API payloads, tokens or personal data.';
