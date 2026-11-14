# Meta Analytics Collection

## Scope
This milestone extends the scheduled analytics collector with Facebook Page post and Instagram media insights. It uses the same encrypted SocialOS account-token store and service-role-only persistence path as YouTube collection.

## Official API integration
- Requests are sent to the configured `META_GRAPH_API_VERSION` on `graph.facebook.com`; no version is silently inferred in the worker.
- Facebook Page post insights use `post_media_view` and `post_total_media_view_unique`.
- Instagram media insights use `views`, `reach`, `likes`, `comments`, `saved`, `shares` and `total_interactions`.
- These metrics are stored as `lifetime` snapshots. A later collection date is a new snapshot; lifetime rows must never be added together.
- The common `impressions` column is used as the normalized content-view count. Provider-specific metric names and platform are recorded in `provider_metrics`.
- Unsupported or absent metrics remain null. The collector does not manufacture zeroes for missing values.

## Permissions
The existing Meta Facebook Login flow now requests:
- Facebook Page: `read_insights`, `pages_read_engagement`.
- Instagram: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`.

Previously connected accounts need to reconnect to grant these scopes. The collector skips accounts without all required grants. A provider 401/403 marks the account `reauthorization_required`.

## Boundaries and follow-up
- Metric availability varies by media type, account eligibility, permissions and Graph API version. This implementation records only metrics actually returned as numeric values.
- No live Meta API calls were made as part of implementation.
- LinkedIn analytics is not included.
- The existing migration 0016 is required and remains unapplied until the migration stack is deployed to the dedicated SocialOS Supabase project.
- No deployment or production credential changes were performed.
