# Reporting & Export Centre

## Scope
The Reporting & Export Centre adds a workspace-authenticated CSV export for provider-reported daily performance. It includes all published destinations visible to the signed-in member, including posts that are not linked to a campaign.

## Export contract
- Route: `GET /api/social/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Date range is required by the UI, validated server-side, and limited to 366 calendar days.
- One row represents one published destination and one provider reporting date.
- Export fields: reporting date, provider code, post title, publish timestamp, provider post ID, impressions, reach, engagements, likes, comments, shares, saves, clicks and video views.
- Rows are sourced from `social_post_analytics_daily` with `period_type='daily'`; lifetime snapshots are intentionally excluded.
- Missing metric values remain blank. Provider metrics are not combined across platforms.
- CSV cells are quoted and formula-leading content is neutralised to reduce spreadsheet formula injection risk.

## Pagination and scale
- Published destinations are fetched in deterministic 1,000-row PostgREST range pages ordered by destination ID.
- Analytics are fetched in target-ID batches of 200 and 1,000-row range pages ordered by reporting date and target ID.
- Account, post and platform metadata lookups are chunked to avoid oversized PostgREST `in` filters.
- The interactive report and synchronous CSV export support up to 50,000 published destinations and 100,000 daily metric rows per request. Larger requests fail explicitly with HTTP 413 for CSV export; narrow the reporting period or scope until an asynchronous export job is introduced.
- Pagination uses the authenticated Supabase client and retains workspace/brand RLS; it does not use service-role access.

## Security and limits
- Requires an authenticated user and an active workspace membership.
- Queries use the authenticated Supabase server client; row-level security remains in force for brand access.
- The export does not use the service-role client or expose credentials.
- Synchronous request caps are 50,000 published destinations and 100,000 metric rows; larger workspaces will need an asynchronous export job.
- The route sends private, no-store responses.

## Not included
No PDF rendering, scheduled delivery, shareable public links, generated executive summaries, or cross-provider comparison scores. These require additional validated reporting semantics and operational infrastructure.
