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

## Security and limits
- Requires an authenticated user and an active workspace membership.
- Queries use the authenticated Supabase server client; row-level security remains in force for brand access.
- The export does not use the service-role client or expose credentials.
- Query limits cap the initial release at 5,000 published targets and 20,000 metric rows. Larger exports require a paginated/background export milestone.
- The route sends private, no-store responses.

## Not included
No PDF rendering, scheduled delivery, shareable public links, generated executive summaries, or cross-provider comparison scores. These require additional validated reporting semantics and operational infrastructure.
