# SocialOS publishing pipeline

## Scope of this foundation

This milestone establishes the durable, tenant-scoped data model and authenticated API for drafts and scheduled publishing. It does **not** yet send content to social networks. Provider publishing adapters, media upload/transcoding, capability enforcement, and the worker runtime are subsequent milestones.

## Data flow

1. An authenticated user submits a post to `POST /api/social/posts`.
2. The API validates request shape, IDs, length limits and future scheduling time.
3. The API calls `create_social_post_bundle` through the user's Supabase session.
4. The database function verifies active workspace membership, role, active brand, connected destination accounts and ready media assets.
5. Post, media associations and destination targets are inserted in one database transaction.
6. For scheduled posts, one durable `publish_jobs` outbox row is inserted per destination, with a unique idempotency key and `available_at`.
7. A trusted worker claims due jobs with `claim_publish_jobs(worker_id, limit)`. The function uses row locking and `FOR UPDATE SKIP LOCKED` to support concurrent workers.

## API request

```json
{
  "organizationId": "uuid",
  "brandId": "uuid",
  "title": "Campaign title",
  "body": "Post copy",
  "timezone": "Europe/Oslo",
  "scheduledAt": "2026-12-01T10:00:00+01:00",
  "targetAccountIds": ["uuid"],
  "assetIds": ["uuid"]
}
```

Set `scheduledAt` to null or omit it to create a draft. A future timestamp creates scheduled targets and durable jobs. The database validates the caller's permissions and verifies that every selected account and asset belongs to the same organisation and brand.

## Job lifecycle

- `queued`: waiting for its scheduled time.
- `running`: atomically claimed by one worker, with a lease owner and timestamp.
- `retry`: transient provider or network failure; worker sets a future `available_at`.
- `succeeded`: provider accepted the publication and the external post ID/permalink has been saved.
- `dead_letter`: retry limit exhausted or non-retryable failure.
- `cancelled`: job intentionally cancelled before completion.

Workers implement lease recovery for abandoned `running` jobs, bounded exponential backoff with jitter, and ambiguous-outcome protection. Provider rate-limit coordination uses Redis shared across publisher replicas. Before dispatch, the worker checks provider-app and account cooldown keys; after an HTTP 429 with `Retry-After`, it records a bounded cooldown at both scopes. If Redis is configured but unavailable, publishing pauses and retries rather than bypassing coordination. Production publisher containers require `REDIS_URL`. Never blindly retry an ambiguous provider timeout without checking whether the platform already created the post.

## Security boundaries

- Browser clients cannot insert, update or delete publishing pipeline records directly.
- Authenticated users have tenant-scoped read access through RLS.
- Post creation runs through a SECURITY DEFINER function that derives the actor from `auth.uid()` and validates organisation, brand, role, account and asset relationships.
- Worker claiming is granted only to `service_role`; do not expose service-role credentials to browsers.
- Media object keys are stored as identifiers, not public URLs. Storage buckets must remain private and media delivery must use short-lived signed URLs.
- Provider capability checks must run before enqueueing and again in the worker immediately before publication.

## Important current limitations

- No social network publishing request is implemented by this milestone.
- No UI composer, media upload pipeline, video transcoding, approval workflow, refresh-token lifecycle or platform-specific validation is included.
- The worker must treat the database as the durable source of truth. Redis/BullMQ can wake workers and distribute load, but must not be the only record of a scheduled post.
- Apply this migration only to the dedicated SocialOS development project after review and tenant-isolation tests. Do not apply to production as an unreviewed change.


## Distributed provider rate-limit coordination

- Configure `REDIS_URL` on every publisher replica. Production workers fail at startup if it is missing.
- Optional provider app identifiers: `META_APP_ID`, `GOOGLE_CLIENT_ID`, and `LINKEDIN_CLIENT_ID`. The worker shares cooldowns by provider application and connected social account.
- HTTP 429 responses use the provider's `Retry-After` header when present; cooldowns are bounded to six hours.
- The coordinator does not invent provider quotas or assume all endpoints share the same quota. Business-level scopes and provider-specific usage-header interpretation remain future work until the provider contracts are verified.
- Redis coordinates cooldown state only. PostgreSQL remains the durable publishing queue and source of truth.
- Local development without `REDIS_URL` may run without distributed coordination; production may not.
