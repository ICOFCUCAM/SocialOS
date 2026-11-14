# Content Calendar and Post Composer

## Routes

- `/app/calendar` provides a month grid and a monthly post list.
- `/app/compose` provides the multi-channel post composer.

Both routes load the current user's active workspace and read tenant-scoped records through the authenticated Supabase client.

## Composer workflow

The composer selects an active brand, connected social accounts belonging to that brand, post title/body, optional processed media assets, and either draft or scheduled mode.

For scheduled posts, the browser sends the selected local date/time as an ISO timestamp and supplies the IANA timezone. The server API validates the payload and calls `create_social_post_bundle`, which atomically creates the post, media associations, targets and (when scheduled) publish jobs.

Draft creation still requires at least one connected target account because the current database RPC requires at least one destination. Editing existing drafts, approval workflows, per-platform caption overrides and post deletion are not part of this milestone.

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

The composer selects connected account destinations, but actual format and publishing capabilities remain enforced by the provider adapters and publisher worker. The composer does not promise identical media support across platforms.

## Operational prerequisites

The feature depends on the existing schema and API foundations in migrations `0001`–`0013`, the safe retry RPC in `0014`, and a running media-processing and publishing worker. Migrations have not been applied to a live SocialOS project as part of this change. No live provider publication or production deployment was performed.
