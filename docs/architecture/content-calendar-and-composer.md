# Content Calendar and Post Composer

## Routes

- `/app/calendar` provides a month grid and a monthly post list.
- `/app/compose` provides the multi-channel post composer.

Both routes load the current user's active workspace and read tenant-scoped records through the authenticated Supabase client.

## Composer workflow

The composer selects an active brand, connected social accounts belonging to that brand, shared post title/body/media, optional account-specific caption and media versions, and either draft or scheduled mode. The shared version is the fallback; a destination version overrides copy, platform options and ordered media for that connected account.

For scheduled posts, the browser sends the selected local date/time as an ISO timestamp and supplies the IANA timezone. The server API validates the payload and calls `create_social_post_bundle`, which atomically creates the post, media associations, targets and (when scheduled) publish jobs.

Draft creation still requires at least one connected target account because the current database RPC requires at least one destination. Version creation is atomic with post, target, media and scheduled outbox creation. Existing target caption overrides and platform options are backfilled into account versions. Editing existing drafts, approval workflows and post deletion are not part of this milestone.

## Media

Uploads use the existing server-issued signed upload URL flow:
1. Authenticated route validates membership, brand, MIME type and declared size.
2. Browser uploads directly to the private Supabase Storage bucket using the signed token.
3. Finalize route verifies object existence, size and reported MIME type, then enqueues media processing.
4. Composer only permits selection of assets whose processing status is `ready`.

The media worker remains responsible for signature validation, malware scanning, media inspection and platform renditions. Upload completion alone does not make an asset publishable.

## Calendar behavior

The month grid places each post by scheduled time, otherwise publication time, otherwise creation time. The list shows posts associated with the selected month. Posts open the Publishing Centre for delivery status and platform result details.

## Platform constraints

The composer lets each selected account receive a separate caption and media set. The publisher resolves the account version first and otherwise uses the shared fallback; legacy target overrides remain a compatibility fallback. Provider capability validation is authoritative in the publisher immediately before dispatch and checks the adapter's verified media requirements, media types and item count. Unverified provider character limits remain unset rather than guessed. The composer does not promise identical media support across platforms.

## Operational prerequisites

The feature depends on the existing schema and API foundations in migrations `0001`–`0013`, the safe retry RPC in `0014`, and a running media-processing and publishing worker. Migrations have not been applied to a live SocialOS project as part of this change. No live provider publication or production deployment was performed.

## Account-specific content version model

- `social_post_versions` stores one default version per post and zero or one override per selected social account.
- `social_post_version_media` stores ordered media attachments per version; it references existing tenant-scoped media assets and never stores public URLs.
- The default version is the shared fallback. An account-specific version takes precedence for that destination.
- `create_social_post_bundle_with_versions` wraps the existing atomic post/outbox RPC and creates versions in the same transaction. It rejects versions for accounts not selected as destinations and assets outside the post's organisation/brand.
- Existing posts are backfilled to default versions; legacy caption/platform-option overrides are preserved as account versions.
- Browser roles have tenant-scoped SELECT only. Version writes are performed by the authenticated SECURITY DEFINER RPC; the publisher uses its service-role connection.
- The worker resolves the version at execution time, loads media from that version, and applies provider capability validation before calling the adapter.

Provider capability metadata intentionally describes only implemented SocialOS adapters. Platform API limits and permissions can vary by API version, account type and approval status; unknown character limits are not fabricated and must be added only after official-provider verification.
