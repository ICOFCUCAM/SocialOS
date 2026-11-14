# Campaign Performance & Analytics

## Scope
Migration `20261110000800_post_analytics.sql` introduces a tenant-scoped normalised store for provider-reported post metrics. The Analytics workspace separates daily time-series rows from lifetime snapshots, groups results by provider, and attributes daily rows to linked campaigns.

## Metric model
Each row is one provider target and one metric date. Common fields include impressions, reach, engagements, likes, comments, shares, saves, clicks and video views. Nullable values mean the provider did not report that metric; they are not treated as zero by the storage contract. Provider-specific numeric values may be stored in the allowlisted `provider_metrics` object.

Daily rows are additive across dates. Lifetime snapshots are stored separately using `period_type='lifetime'` and are excluded from additive campaign totals to avoid summing repeated snapshots.

## Security
- Every metric row references a publishing target and its organisation using a composite foreign key.
- Authenticated reads are protected by RLS through target → post → brand membership.
- Browser roles have SELECT only; provider workers write using the service role.
- The table stores normalised values, not raw provider payloads, OAuth tokens or personal data.

## Current limitations
- The dashboard shows daily impression trends for the latest 14 reported dates, provider-separated daily totals, latest lifetime snapshots per destination, and provider-separated campaign results.
- Lifetime snapshots are selected as the latest row per publishing target and are never summed across collection dates.
- Daily and lifetime results are grouped by the connected account's platform code. The workspace does not sum unlike provider metrics into a single cross-platform KPI.
- The provider collector currently implements YouTube daily metrics and Meta/LinkedIn lifetime metrics in the stacked provider analytics milestones. Live results still require the worker, permissions, provider app access and database migrations to be deployed.
- Metrics from different platforms can have different definitions, reporting windows and availability. The UI labels them as provider-reported and does not claim perfect cross-platform equivalence.
- Campaign attribution is based on explicit post-to-campaign links. A post linked to multiple campaigns can appear in each campaign's totals; the workspace-wide summary is therefore a sum of campaign-attributed rows, not a deduplicated organisation total.
- Migration 0016 is not applied to a live database. Apply migrations 0001–0016 in order in a dedicated SocialOS Supabase project.
