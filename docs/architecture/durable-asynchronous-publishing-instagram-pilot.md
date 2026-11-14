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

1. Migrations now use 14-digit timestamp versions: account-specific versions is now `20261110001000_account_specific_content_versions.sql`, fair scheduling is `20261110001100_fair_publisher_scheduling.sql`, and publishing operations is `20261110001200_publishing_operations.sql`. The existing analytics migration remains `20261110000800_post_analytics.sql`. The hosted SocialOS project currently records only migrations `0001`–`0007`; no migration has been applied to the hosted project as part of this work.
2. Diagnose the failed CI run on PR #33. GitHub reports the job as failed, but the available Actions log endpoint returned a missing-blob response, so the underlying failing step remains unverified.
3. Replay the complete ordered migration chain against a clean disposable PostgreSQL/Supabase-compatible database and run publisher tests before opening this feature for review.

This document records the implementation contract only. It does not claim that asynchronous publishing has been implemented, that migrations have been applied, or that tests pass.

## Repository integration decision (verified against the current publisher branch)

This feature extends the existing publishing pipeline. It must not introduce a second generic queue or replace the current job lifecycle.

Existing responsibilities remain:

- `publish_jobs` is the durable root queue and owns scheduled work, attempts, leases, retries and terminal job status.
- `publish_job_events` is the durable attempt/operator event history. Provider-operation state is not duplicated into this event log.
- `publish_organization_fairness` and `claim_publish_jobs` continue to arbitrate fair workspace scheduling and initial job concurrency.
- `social_post_targets` remains the destination-level publication record; `finish()` and failure handling must be updated through an atomic database operation for the asynchronous path.

The missing durable object is the remote provider operation itself: Meta's media container ID, lifecycle stage, next poll time, poll count, operation lease and final external post ID. The proposed table should therefore be named `publish_provider_operations` to make its relationship to the existing queue explicit.

### Required relational and access invariants

- Each operation is scoped to one organization, one existing publish job, one target and one connected social account/provider.
- Enforce organization consistency in the database with composite foreign keys where the referenced tables expose matching unique constraints; do not rely only on worker-side filters.
- The operation must not outlive its owning job or target. Deletion behaviour should follow the existing queue's retention policy and must not silently erase audit history.
- Browser roles receive no direct insert, update or delete privileges. The publisher service role performs mutations; authenticated operator views, if later required, expose only sanitized fields through a tenant-authorized API/RPC.
- Add a unique idempotency identity for the logical provider operation. Do not use a partial uniqueness rule that permits a second submit merely because an earlier row became terminal or its lease expired.
- Keep provider account IDs, remote container IDs and external post IDs as identifiers only. Do not store access tokens, signed media URLs, raw provider responses or authorization-bearing URLs.

### Scheduling and atomicity refinements

The operation poller is a second work selector over `publish_provider_operations`, not a second queue for new posts. It claims only due operations in pollable states. Claiming must use a short database transaction, `FOR UPDATE SKIP LOCKED`, a bounded lease, and a service-only RPC. Provider network calls happen after the claim transaction commits.

A provider status check may be retried after a transient network error because it is a read of the already-created remote container. A container-create request and `media_publish` are side-effecting calls: if their outcomes are ambiguous, the operation becomes `outcome_unknown` and is never replayed automatically.

Finalization must be a single database transaction that verifies the operation state and lease, persists the verified external post ID, marks the target and job successful, recomputes the parent post status, appends the publish event, and releases the lease. A repeated finalization call must be idempotent and must not create duplicate event or audit records.

### Migration gate

The repository branch contains the account-version, fair-scheduling and operations migrations (`20261110001000`–`20261110001200`), but the connected hosted project has only recorded the first seven migrations. The hosted project is therefore not a valid place to infer the later table constraints. Before writing the additive migration, inspect the exact base migrations that create `publish_jobs` and `social_post_targets`, verify their unique/composite keys and delete behaviour, and replay the entire ordered migration chain against a disposable database. Do not apply this migration to the hosted project as part of this feature branch.
