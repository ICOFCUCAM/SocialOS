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

No unofficial scraping is used. LinkedIn remains deliberately skipped until its current analytics permissions, metric definitions and endpoints are implemented and verified.

## Run

Deploy as a scheduled job (for example, once daily) using the included Dockerfile.

Required environment:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SOCIAL_TOKEN_ENCRYPTION_KEYS` or `SOCIAL_TOKEN_ENCRYPTION_KEY`
- `SOCIAL_TOKEN_KEY_VERSION` when using a versioned key ring

Optional:
- `ANALYTICS_MAX_TARGETS` (default 100, max 500)
- `ANALYTICS_LOOKBACK_DAYS` (default 35, range 7–90)
- `ANALYTICS_REQUEST_DELAY_MS` (default 1000)

The job is intentionally one-shot. The scheduler owns cadence and retry policy. It never writes credentials or raw provider responses to logs.

## Data handling
- Only published targets with a provider post/video ID are considered.
- Expiring tokens are skipped; the existing publisher refresh process must renew them or the user must reconnect.
- Missing analytics scope is reported as a skip, not as zero metrics.
- Daily records are upserted, not added, so repeat collection is idempotent.
- The worker writes through the Supabase service role. Do not expose service credentials to browser code.
