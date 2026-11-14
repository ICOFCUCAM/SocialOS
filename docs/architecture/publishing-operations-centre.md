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
