# SocialOS Analytics Collector

A scheduled, one-shot worker that imports provider-reported analytics into `social_post_analytics_daily`.

## Current provider coverage

### YouTube
- Uses the official YouTube Analytics API v2 `reports.query` endpoint.
- Queries per published video and stores daily views, likes, comments, shares and estimated minutes watched.
- Uses `channel==MINE`, `dimensions=day`, and a video ID filter.
- Ends the reporting window three days before collection because YouTube Analytics data commonly has 48–72 hours of processing latency.
- Re-fetches a bounded lookback window and upserts by target/date/period to accommodate late metric updates.
- Requires the connected account to have the exact scope `https://www.googleapis.com/auth/youtube.readonly`. Existing accounts connected only for uploads must reconnect and grant the read scope.

### Facebook Pages and Instagram
- Uses the configured, explicit Meta Graph API version and the official media insights endpoint `/{media-or-post-id}/insights`.
- Facebook Page posts request the current media-view metrics `post_media_view` and `post_total_media_view_unique`.
- Instagram media requests `views`, `reach`, `likes`, `comments`, `saved`, `shares` and `total_interactions`.
- Meta media insights are stored as lifetime snapshots, not daily time series. The dashboard must not sum snapshots across collection dates.
- Missing metrics remain null; an unsupported or unavailable metric is never represented as zero.
- Facebook connections require `read_insights` and `pages_read_engagement`. Instagram connections require `instagram_basic`, `instagram_manage_insights` and `pages_read_engagement` under the existing Facebook Login flow.
- Existing Meta connections must reconnect to grant the additional analytics permissions.
- Meta metric availability can vary by media type, account eligibility and API version. The collector stores only returned, numeric metrics.

### LinkedIn member posts
- Uses the official Community Management API `GET /rest/memberCreatorPostAnalytics?q=entity` finder for each published member post URN.
- Requires the `r_member_postAnalytics` member-consent permission and approved Community Management API access. Existing LinkedIn connections must reconnect; the LinkedIn app must also have the required product access.
- Requires an explicit `LINKEDIN_API_VERSION` in `YYYYMM` format; the worker never guesses a version.
- Collects lifetime counts for impressions, members reached, reactions, comments and reshares. It also attempts optional saves, link clicks, followers gained and profile views from content.
- Stores results as lifetime snapshots. Missing values remain null; unsupported optional metrics are omitted. Errors for core metrics fail the target rather than silently producing partial zeroes.
- Requires provider post IDs to be LinkedIn `share` or `ugcPost` URNs.

No unofficial scraping is used.

## Run

Deploy as a scheduled job (for example, once daily) using the included Dockerfile.

Required environment:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SOCIAL_TOKEN_ENCRYPTION_KEYS` or `SOCIAL_TOKEN_ENCRYPTION_KEY`
- `SOCIAL_TOKEN_KEY_VERSION` when using a versioned key ring
- `META_GRAPH_API_VERSION` for Meta collection
- `LINKEDIN_API_VERSION` (YYYYMM) for LinkedIn collection
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` to refresh expired access tokens

Optional:
- `ANALYTICS_MAX_TARGETS` (default 100, max 500)
- `ANALYTICS_LOOKBACK_DAYS` (default 35, range 7–90)
- `ANALYTICS_REQUEST_DELAY_MS` (default 1000)

The job is intentionally one-shot. The scheduler owns cadence and retry policy. It never writes credentials or raw provider responses to logs.

## Data handling
- Only published targets with a provider post/video ID are considered.
- Expired YouTube and LinkedIn access tokens are refreshed under the same `claim_social_token_refresh` lock the publisher uses, so the two workers never rotate a refresh token concurrently. Meta Page tokens do not expire and are used as stored.
- Google quota errors (HTTP 403 `quotaExceeded` and similar) are retried on a later run; they do not mark the account for reconnection.
- Missing analytics scope is reported as a skip, not as zero metrics.
- Daily records are upserted, not added, so repeat collection is idempotent.
- The worker writes through the Supabase service role. Do not expose service credentials to browser code.
