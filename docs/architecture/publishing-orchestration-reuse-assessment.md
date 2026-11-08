# Publishing orchestration reuse assessment

**Work package:** WP-2  
**Branch:** `feat/publishing-fanout-retry-policy`  
**Status:** Retry policy extracted and unit tests added; runtime suite not executed here.

## Existing SocialOS design

SocialOS already models publishing as one durable job per destination account:
- `social_post_targets` has a unique constraint on `(post_id, social_account_id)`.
- `publish_jobs` has a unique idempotency key and a foreign key to one target.
- `create_social_post_bundle` creates a target for each selected account and enqueues one job per target when scheduled.
- `claim_publish_jobs` atomically claims due jobs using `FOR UPDATE SKIP LOCKED`.
- The publisher worker processes one target job at a time.
- The worker calculates the aggregate post state from destination target states, including `partially_published`.
- Ambiguous provider outcomes are dead-lettered rather than automatically retried.

This already implements the essential account-level fan-out pattern observed in Mixpost. Replacing it with a second orchestration engine would add complexity without a demonstrated benefit.

## Improvements in this branch

Retry and failure classification are now isolated in `src/retry-policy.mjs`:
- Retry-After is bounded between one second and six hours.
- Exponential backoff is bounded to one hour and uses jitter.
- Retry jitter is sampled once per calculation.
- Ambiguous provider outcomes are terminal and mapped to `PUBLISH_OUTCOME_UNKNOWN`.
- Retryable errors stop retrying at the configured attempt limit.
- Non-retryable errors are terminal.

Unit tests cover:
- Retry-After floor and ceiling.
- Exponential backoff and jitter.
- Attempt exhaustion.
- Non-retryable failures.
- Ambiguous provider outcomes.

The worker now delegates its retry decision and delay calculation to this tested policy module.

## Remaining orchestration risks and follow-up

1. **Atomic completion:** target status, job status, post aggregate status and audit event are separate database operations. A transactional RPC should own terminal state transitions.
2. **Lease recovery aggregation:** `recover_stale_publish_jobs` marks abandoned targets failed but does not refresh the parent post's aggregate status or write the corresponding audit event.
3. **Idempotency scope:** the database key prevents duplicate job creation for a target, but cannot guarantee provider-side exactly-once publishing. Provider timeouts remain ambiguous and require reconciliation.
4. **Unscheduled draft posts:** the current bundle function creates durable jobs for scheduled posts. Immediate publishing/draft enqueue semantics should be checked separately before changing them.
5. **Concurrency:** current worker claims one job at a time per worker. Throughput scaling should be introduced only with measured provider rate limits and safe per-account concurrency controls.

## Acceptance status

| Requirement | Status |
|---|---|
| One durable job per destination | Existing design |
| Per-destination outcome persistence | Existing design |
| Partial success aggregation | Existing design |
| Bounded exponential backoff | Implemented in this branch |
| Retry-After handling | Implemented in this branch |
| Ambiguous outcome not auto-retried | Existing design; policy now unit-testable |
| Deterministic retry policy tests | Added; execution pending CI |
| Atomic terminal transitions | Follow-up required |
| Parent aggregate refresh after lease recovery | Follow-up required |
| Provider-side reconciliation | Not implemented |

## Reuse decision

Adapt Mixpost's fan-out and batch-outcome concepts, but retain SocialOS's existing durable outbox, per-target jobs and tenant-scoped records. No Mixpost code is copied and no Laravel dependency is introduced.
