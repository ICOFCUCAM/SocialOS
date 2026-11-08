# Official provider publishing and worker orchestration

## Supported provider operations

- Facebook Pages: text feed posts and single photo/video posts using a temporary fetchable media URL.
- Instagram professional accounts: one image or Reel per publication, using the media-container then publish flow. Video container processing is polled before publishing.
- YouTube: one MP4 video through the resumable upload API. Default privacy is private unless an explicit option is supplied.
- LinkedIn: text-only member posts through the Posts API. Media uploads are deliberately rejected until its upload workflow is implemented.
- Other platforms fail with `PROVIDER_NOT_SUPPORTED`; no unofficial API or browser automation fallback is used.

## OAuth permissions

- Meta: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`.
- YouTube: `https://www.googleapis.com/auth/youtube.upload`.
- LinkedIn: `openid`, `profile`, `w_member_social`.

Existing accounts must reconnect to grant newly requested publishing scopes. Provider app review, verification, user eligibility and production access remain subject to each provider's requirements. A requested scope does not mean the provider has approved the application.

## Publisher worker

Build `workers/publisher/Dockerfile` with `workers/publisher` as the build context. Run as a separate long-running service, not as a Vercel function.

Required environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SOCIAL_TOKEN_ENCRYPTION_KEY` — base64-encoded 32-byte AES-256-GCM key matching the key version used to encrypt the account tokens.

Provider configuration:

- `META_GRAPH_API_VERSION` — explicit Graph API version, e.g. `v25.0`.
- `LINKEDIN_API_VERSION` — provider-approved version in `YYYYMM` form.
- `PUBLISH_WORKER_ID`, `PUBLISH_POLL_INTERVAL_MS`, `PUBLISH_MEDIA_URL_TTL_SECONDS`, `PUBLISH_MAX_VIDEO_BYTES` are optional worker controls.

The worker:
1. Runs the stale publishing lease recovery RPC and atomically claims one due job.
2. Loads its tenant-scoped post, target, connected account and platform.
3. Decrypts AES-256-GCM credentials inside the worker process only.
4. Stops and marks the account for reauthorization if its access token has expired. Automatic refresh is not yet implemented.
5. Resolves the target platform's prepared media profile from private Storage. It issues short-lived signed URLs for Meta and downloads the prepared YouTube MP4.
6. Calls the platform adapter and records the external post ID and permalink, when returned.
7. Updates target, job and aggregate post states and writes an audit event.

## Retry and duplicate prevention

- HTTP 429 responses can be retried using `Retry-After`; transient failures use bounded exponential backoff with jitter.
- Ambiguous provider outcomes are dead-lettered for manual reconciliation. The worker must not blindly retry a timeout that might have created a post.
- An expired worker lease is also dead-lettered unless a provider post ID was already saved. This avoids automatic duplicate publication after a worker crashes between the remote publish call and the database update.
- Stale lease recovery requires migration `0011_publish_worker_lease_recovery.sql`.

## Explicit limitations

- The adapters have not been verified against live provider accounts.
- Instagram carousel, Facebook multi-photo, LinkedIn media, and TikTok, X, Threads and Pinterest publishing are not implemented.
- OAuth token refresh and revocation handling are not implemented; expired accounts must reconnect.
- Platform rate-limit coordination across multiple workers, provider-side reconciliation tools, integration tests and operational dashboards remain future work.
- YouTube upload currently buffers the prepared MP4 in memory; size limits and a single-job worker are important until streaming/resumable chunk persistence is implemented.
- Provider API requirements, app review and publishing permissions must be rechecked before production.

No database migration has been applied and no worker has been deployed by this change.
