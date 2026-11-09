# Publishing Operations Centre

The customer workspace exposes a tenant-scoped publishing operations view at `/app/publishing`.

## Dashboard

The page summarizes:
- scheduled posts;
- queued, retrying and running jobs;
- successful target deliveries during the current calendar month;
- dead-letter jobs requiring attention.

It displays recent publishing jobs with their post, target account, platform, job status, attempt count, next available time, provider permalink and safe error details. Views filter all activity, active queue jobs, successful jobs and failed jobs.

The dashboard reads through the authenticated Supabase client. Row-level security on posts, targets and jobs remains the tenant and brand boundary. No service-role credentials or OAuth tokens are exposed to the page.

## Manual retry

Migration `0014_safe_manual_publish_retry.sql` adds a service-role-only RPC. The route authenticates the user and permits workspace owners, administrators, managers and publishers.

A retry is accepted only when:
- the job is in `dead_letter`;
- the target is failed and has no provider post ID;
- the destination account is connected;
- the failure is not `PUBLISH_OUTCOME_UNKNOWN`.

The transaction resets the job and target to the queue, resets the attempt counter and writes an audit event. The worker still applies its bounded retry policy.

## Unknown outcomes

An ambiguous provider response or expired worker lease may mean the platform accepted a post even though SocialOS did not record the response. These jobs are not retryable from the dashboard. Operators must check the destination platform and reconcile the result before any further action. This is a deliberate duplicate-prevention rule.

## Migration and deployment

Apply migrations in order through `0014` before enabling this workflow. The migration chain has not been applied to a live SocialOS Supabase project as part of this change.

The publishing worker must be deployed and configured separately. A dashboard showing queue state does not prove that a worker is running or that a provider has accepted a post. Live provider verification and production deployment remain outstanding.


## Operations dashboard integration

The existing `/app/publishing` workspace page now consumes the operational summary and recent event history introduced in migration 0019. It adds 24-hour delivery/dead-letter metrics, oldest overdue job, retry count and a recent event timeline.

Known retryable failures use the authenticated `/api/social/publishing/operations` action and the tenant-authorized `operator_retry_publish_job` RPC. The page does not expose a retry action for ambiguous provider outcomes.

For `PUBLISH_OUTCOME_UNKNOWN`, publishers with the required workspace role can open a reconciliation form. The operator must first verify the post on the destination platform and enter its actual external post ID; the optional permalink is stored with the target. The database function performs the state transition and audit write.

The dashboard uses the active workspace membership selected by the current application shell. Multi-workspace switching and account-level role resolution remain separate follow-up work; do not assume this page currently offers a workspace selector.


## Pre-publish readiness assessment

`POST /api/social/publishing/readiness` accepts a post ID and assesses each destination independently using the current saved post versions.

Checks include:
- Whether SocialOS has a publishing adapter for the destination and the platform is enabled.
- Whether the account remains connected and an encrypted credential record exists.
- Access-token expiry, including a warning when expiry is unknown or within 24 hours.
- Whether the destination-specific version or shared fallback exists.
- Whether selected media is ready, its type is supported by the current adapter, and required processed renditions exist.
- Whether a platform-required media asset is present.
- Whether the scheduled delivery time is still in the future.

The response classifies each destination as ready, review or blocked and returns blocker, warning and informational findings. The content calendar exposes a per-post assessment control so a user can inspect readiness before relying on a scheduled campaign.

This assessment is a snapshot, not a guarantee. It does not reserve provider quota, test provider uptime, predict future API changes, or guarantee acceptance at delivery time. Provider cooldowns and quotas remain enforced by the publishing worker. It currently assesses saved posts; unsaved composer state is not included. The readiness endpoint does not schedule, mutate or publish a post.


## Campaign-wide readiness orchestration

The campaign detail page now provides an on-demand campaign readiness assessment through `GET /api/social/campaigns/[campaignId]/readiness`.

The endpoint:
- Authenticates the caller and scopes campaign, post, target, account, token metadata and media queries to the campaign's organization.
- Assesses every linked post and its publishing destinations, rather than treating the campaign as one undifferentiated publishing job.
- Checks campaign start/end window, missing posts, unscheduled posts, destination failures and pending delivery.
- Checks each destination's provider adapter, platform enablement, account connection and access-token expiry.
- Resolves the account-specific content version with the shared default fallback.
- Checks version-specific media processing state, media kind, platform media requirements and available processed renditions.
- Returns campaign-level ready/review/blocked status, summary counts and post-by-post findings.

The UI is an explicit snapshot action. It does not change campaign state, publish posts, schedule work or reserve provider quota. Re-run after editing campaign dates, posts, media or connected accounts. It does not guarantee provider acceptance at a later delivery time.
