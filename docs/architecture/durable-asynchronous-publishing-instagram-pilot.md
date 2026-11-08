# Durable asynchronous publishing: Instagram video pilot

## Decision

Implement the first asynchronous provider lifecycle for Instagram video publishing only. Keep Facebook, Instagram image, YouTube and LinkedIn on their existing synchronous adapter contract until each has a separately reviewed lifecycle design.

The publisher's PostgreSQL outbox remains the source of truth. Redis remains a coordination/cooldown layer; it is not the durable operation store. Do not introduce Temporal for this milestone.

## Current failure mode

The Instagram adapter creates a media container, polls `status_code` up to 20 times with three-second sleeps in the same worker execution, then calls `media_publish`. A still-processing container is surfaced as a retryable job failure. Retrying the whole job can create a second container, and the worker slot is occupied during provider processing.

## Lifecycle contract

The asynchronous adapter contract is separate from the existing `publishTarget()` synchronous contract:

- `submit(input, operation)`: initiate provider-side work and return a provider operation identifier.
- `checkStatus(input, operation)`: inspect an existing provider operation; it must never create a new one.
- `finalize(input, operation)`: perform the irreversible publish/finalize action after the provider reports readiness.
- Each method returns a typed outcome: `pending`, `completed`, `retryable`, `rejected`, or `unknown`.

The Instagram pilot maps these stages to container creation, container status inspection, and `media_publish`. The adapter must persist the container ID before any later status check.

## Durable state and transitions

Persist one provider operation per publish target. Proposed states:

1. `prepared`: durable intent exists; no provider request has been attempted.
2. `submit_started`: request may have reached Meta; automatic resubmission is forbidden if the outcome becomes ambiguous.
3. `processing`: Meta returned a container ID; future work is status polling only.
4. `finalize_started`: `media_publish` may have reached Meta; a lost response is ambiguous and must not be blindly repeated.
5. `published`: verified external post ID is persisted and the target/job are completed.
6. `rejected`: provider definitively rejected the operation.
7. `outcome_unknown`: remote side effect may have happened but cannot be verified; operator reconciliation is required.

Transitions are monotonic except for retry scheduling of a status check. Polling a `processing` operation may update `next_check_at`, poll count and sanitized last-response classification, but must not move it back to `prepared` or `submit_started`.

## Persistence proposal

Add a tenant-scoped `provider_operations` table linked to `publish_jobs` and `social_post_targets`, with:

- `organization_id`, `job_id`, `target_id`, `provider`, `operation_type`
- `state`, `remote_operation_id`, `next_action_at`, `poll_count`
- `locked_at`, `locked_by`, `last_error_code`, `last_error_message`
- `external_post_id`, `external_permalink`, `created_at`, `updated_at`, `completed_at`

Use a unique constraint to prevent more than one active Instagram video operation per target. Add a partial due-work index on `(next_action_at, created_at)` for states eligible for polling/finalization. RLS should expose no operation rows to browser roles unless a narrowly scoped operator read surface is explicitly required; all mutations remain service-role/RPC mediated.

Do not persist access tokens, signed media URLs, request authorization headers, raw provider payloads, or unbounded error bodies in operation metadata. Store only allowlisted identifiers and sanitized classifications.

## Crash and duplicate safety

- Persist `submit_started` before making the container-create request.
- If the worker loses the response after `submit_started`, transition to `outcome_unknown`; do not submit again automatically.
- Once the container ID is stored, every retry is a status check against that same ID.
- Provider status polling uses `next_action_at`; never sleep inside a worker.
- Persist `finalize_started` before `media_publish`.
- If the finalize response is lost, mark `outcome_unknown`; do not call `media_publish` again without a verified provider lookup or operator reconciliation.
- A stale operation lease in `processing` is safe to reclaim for another status check. A stale lease in `submit_started` or `finalize_started` is not safe to replay.
- Update operation, target, job, aggregate post status and event history transactionally wherever possible. Use a dedicated SECURITY DEFINER RPC for multi-row finalization/reconciliation if client-side multi-statement writes cannot provide atomicity.

## Worker scheduling

Keep initial job claiming separate from operation polling:

- Initial publisher claims create/advance `prepared` operations.
- A bounded poller claims due `processing` operations atomically using `FOR UPDATE SKIP LOCKED` and short leases.
- Each poll execution performs one provider request and releases the worker immediately.
- Poll intervals use bounded backoff and provider Retry-After when present.
- Provider-specific concurrency limits must be applied to submit, poll and finalize requests; existing cooldown keys alone are not semaphores.

## Tests required before enabling

Use a fake provider and deterministic clock. Cover:

- submit -> pending -> pending -> ready -> finalize -> published
- definitive provider rejection
- transient status-check failure and Retry-After scheduling
- worker crash after `submit_started` with no response (no resubmit)
- worker crash after container ID persistence (poll same ID)
- ambiguous `media_publish` response (no second finalize)
- stale lease recovery in each state
- duplicate worker claims and concurrent pollers
- tenant isolation and service-role-only writes
- atomic finalization of operation, target, job, parent post and event

## Repository prerequisites and sequencing

Before adding the migration or enabling this path:

1. Resolve the duplicate migration version `0016`: both `0016_account_specific_content_versions.sql` and `0016_post_analytics.sql` currently exist. Confirm the repository's migration application history before renumbering; do not rename an already-applied migration in a deployed database.
2. Diagnose the failed CI run on the current PR #33 head (`3678baf4bfdd84b77f999d606c478f4d38fbd669`). The Actions API currently reports failure but does not expose step details in the returned job record.
3. Replay the complete migration chain against a clean disposable PostgreSQL/Supabase-compatible database and run publisher tests before opening this feature for review.

This document records the implementation contract only. It does not claim that asynchronous publishing has been implemented, that migrations have been applied, or that tests pass.
