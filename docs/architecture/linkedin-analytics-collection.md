# LinkedIn Analytics Collection

## Scope and endpoint
The collector retrieves analytics for an individual authenticated member's published post through the official Community Management API endpoint:

`GET https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity`

The entity finder accepts LinkedIn post URNs of type `share` or `ugcPost`. The worker sends `X-Restli-Protocol-Version: 2.0.0` and an explicitly configured `Linkedin-Version: YYYYMM` header. It does not guess or silently default the API version.

## Permission and product access
- OAuth requests `r_member_postAnalytics` in addition to the existing member publishing scopes.
- The LinkedIn app must have Community Management API access and the member must consent to the analytics permission.
- Existing accounts need to reconnect to grant the scope.
- A 401/403 is treated as reauthorization required; the platform access approval requirement is documented because OAuth scope alone does not grant product access.

## Metrics and storage
Core lifetime metrics: impressions, members reached, reactions, comments and reshares.

Optional metrics: post saves, link clicks, followers gained from content and profile views from content. These may not be available to every app/account/version; unsupported optional metrics remain null.

LinkedIn returns a count per requested metric. The worker requests metrics individually, maps numeric counts to normalized fields, and stores one `lifetime` snapshot. The analytics UI must not sum lifetime snapshots from multiple collection dates. Missing values are null, not zero. Core metric errors fail the target; unsupported optional metrics may be skipped.

## Operational limits
- One API request per metric per post, with the configured collector delay between requests.
- No live LinkedIn API calls were made during implementation.
- No production deployment or migration was performed.
- LinkedIn analytics availability depends on LinkedIn app approval, member consent, account eligibility and configured API version.
