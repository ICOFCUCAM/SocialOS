# OAuth token lifecycle and publisher worker

## Token lifecycle

- OAuth access and refresh tokens are encrypted with AES-256-GCM. Encryption keys remain outside PostgreSQL.
- The publisher checks token expiry before a publish attempt and refreshes supported provider tokens before they expire.
- Google/YouTube refresh uses the Google OAuth token endpoint. LinkedIn refresh uses the LinkedIn OAuth token endpoint where the application and authorization are eligible for refresh tokens.
- Meta Page and Instagram tokens are not refreshed through this generic OAuth refresh path. Expired Meta credentials require reconnecting.
- Refresh requests are serialized per social account through a database lease RPC so multiple worker replicas do not race refresh-token rotation.
- Provider refresh-token rotation is persisted when a new refresh token is returned.
- Invalid or expired refresh grants move the social account to `reauthorization_required`; the worker does not continue publishing with invalid credentials.

## Encryption key rotation

The worker and OAuth callback support a versioned key ring.

Recommended environment configuration:

- `SOCIAL_TOKEN_KEY_VERSION`: current key identifier, e.g. `v2`.
- `SOCIAL_TOKEN_ENCRYPTION_KEYS`: JSON object mapping key IDs to base64-encoded 32-byte keys, e.g. `{"v1":"<base64-old-key>","v2":"<base64-current-key>" }`.

For backwards compatibility, `SOCIAL_TOKEN_ENCRYPTION_KEY` may be used as the current key when the key ring does not contain the current key ID.

Rotation procedure:
1. Generate a new random 32-byte key in a secret manager.
2. Add the new key under a new key ID while retaining the old key ID and key.
3. Set `SOCIAL_TOKEN_KEY_VERSION` to the new key ID.
4. Deploy the callback and publisher worker with the same key ring.
5. As accounts refresh or reconnect, their access and refresh tokens are re-encrypted under the current key version.
6. Do not remove the old key until every stored token row has been re-encrypted and verified. A database inventory query should confirm no rows remain on the old version.

Never place real key material in source control, build arguments, logs or client-exposed environment variables.

## Worker deployment

Build `workers/publisher/Dockerfile` with `workers/publisher` as the build context. Run as a separate long-running service, not as a Vercel function.

Required environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SOCIAL_TOKEN_KEY_VERSION`
- `SOCIAL_TOKEN_ENCRYPTION_KEYS` (or legacy single-key variable)

Provider configuration:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `META_GRAPH_API_VERSION`
- `LINKEDIN_API_VERSION`

Optional worker controls:
- `PUBLISH_WORKER_ID`
- `PUBLISH_POLL_INTERVAL_MS`
- `PUBLISH_MEDIA_URL_TTL_SECONDS`
- `PUBLISH_MAX_VIDEO_BYTES`

## Publishing behavior

The worker claims due jobs, loads tenant-scoped post/target/account records, refreshes expiring OAuth tokens where supported, decrypts credentials in memory, retrieves prepared private media derivatives, calls provider adapters and persists results.

- Facebook Pages: text and single photo/video.
- Instagram professional accounts: one image or Reel.
- YouTube: one MP4 through resumable upload.
- LinkedIn: text-only posts.
- LinkedIn media, Instagram carousels, Facebook multi-photo, TikTok, X, Threads and Pinterest publishing are not implemented.

## Retry and duplicate prevention

- HTTP 429 responses can be retried using `Retry-After`; transient failures use bounded exponential backoff with jitter.
- Ambiguous provider outcomes are dead-lettered for manual reconciliation.
- Expired worker leases without a recorded provider post ID are dead-lettered rather than blindly retried.
- An expired or revoked refresh grant requires user reconnection.
- Migration `20261110000300_publish_worker_lease_recovery.sql` handles publishing leases.
- Migration `20261110000400_oauth_token_refresh_lock.sql` serializes token refresh operations.

## Operational requirements and limitations

- Apply migrations in order before deploying the worker.
- Provider app review, production access, refresh-token eligibility and scope approval remain provider-controlled.
- Meta token refresh is not automatic in this implementation.
- Provider API calls have not been tested against live accounts.
- No database migration has been applied and no worker has been deployed by this change.
