# SocialOS database migration reconciliation

**Status:** repository history aligned to the hosted seven-migration sequence; production publishing migrations remain unapplied.
**Repository:** `ICOFCUCAM/SocialOS`
**Branch:** `integration/socialos-feature-stack`
**Supabase project:** SocialOS production, `hpnuhfsdwejldcylsflj` (Frankfurt)
**Safety:** no production schema or migration-history writes were performed during this audit.

## 1. Hosted migration ledger

The hosted `supabase_migrations.schema_migrations` ledger contains these records:

| Hosted version | Hosted migration name |
|---|---|
| 20261108174627 | 0001_core_tenancy |
| 20261108174659 | 0002_tenant_rls |
| 20261108174707 | 0003_explicit_table_privileges |
| 20261108174848 | 0004_revoke_anon_function_execution |
| 20261108175020 | 0005_profiles_and_auth_onboarding |
| 20261108175537 | 0006_atomic_workspace_onboarding |
| 20261108175641 | 0007_private_tenant_helpers |

The integration branch originally had migrations 0004–0006 in a different order. The canonical repository filenames now match the hosted sequence:

1. `0001_core_tenancy.sql`
2. `0002_tenant_rls.sql`
3. `0003_explicit_table_privileges.sql`
4. `0004_revoke_anon_function_execution.sql`
5. `0005_profiles_and_auth_onboarding.sql`
6. `0006_atomic_workspace_onboarding.sql`
7. `0007_private_tenant_helpers.sql`

The old misordered filenames were removed from the integration branch and replaced with files using the hosted order. The SQL contents were retained under their corresponding canonical names. This is a repository-history correction only; it does not alter the hosted ledger.

## 2. Production schema evidence

The live database was inspected for public tables, columns, RLS policies, functions, triggers, storage buckets and storage policies.

Confirmed core objects include:
- Organisations, organisation members and invitations.
- Brands and brand members.
- Social platform registry, social accounts and encrypted social account tokens.
- Profiles and audit events.
- Private tenant helper functions: `private.is_org_member`, `private.has_org_role`, `private.can_access_brand`.
- Workspace onboarding and auth profile trigger functions.
- Core tenant/profile RLS policies.

The production schema inspection did not find the publishing objects introduced by migrations 0008–0016. The storage inspection also returned no storage bucket or storage.objects policy rows for the proposed `social-media` bucket.

## 3. Pending migration inventory

There are **nine** repository migrations after the hosted baseline:

| Migration | Objects and purpose |
|---|---|
| 0008 | Posts, media assets, targets, publishing jobs, job claiming, post bundle RPC |
| 0009 | Private `social-media` bucket, media processing jobs and claim RPC |
| 0010 | Stale media-job lease recovery |
| 0011 | Stale publishing-job lease recovery and target-state reconciliation |
| 0012 | OAuth token refresh lock columns and claim/release RPCs |
| 0013 | Atomic social-account disconnect and audit event |
| 0014 | Guarded manual publish retry |
| 0015 | Campaigns, campaign-post links and campaign RPCs |
| 0016 | Daily post analytics and tenant-scoped read policy |

The order is dependency-sensitive. In particular, 0009 depends on 0008's `social_media_assets`; 0010 depends on 0009's media job table; 0011 and 0014 depend on 0008's publish queue; 0015 depends on posts and brands; 0016 depends on publish targets and posts.

## 4. Review findings before production rollout

### Fixed in this branch
- Migration 0011 previously marked a stale publish job as succeeded when a provider post ID existed, but left its target in its previous state. The migration now also marks that target as published and sets `published_at`, while preserving the dead-letter / unknown-outcome path when no provider ID exists.

### Backend authorization requirements
- Migrations 0013 and 0014 expose their RPCs to `service_role` only and accept an actor user ID as an argument. The trusted API must derive that ID from a verified user session, never from an arbitrary request-body field.
- The disconnect endpoint must independently verify that the authenticated actor has permission to disconnect the account in the specified organization before invoking the service-role RPC.
- The retry endpoint must likewise use the authenticated actor identity and enforce the required organization/brand publishing role. Do not expose service-role credentials to the browser.
- For all service-role RPC calls, validate the organization/account/job relationship server-side and write an audit event with the verified actor.

### Operational requirements
- Back up production and verify the backup before any rollout.
- Build a clean local database by replaying migrations 0001–0017 in order.
- Compare the resulting schema, policies, grants, triggers, functions, constraints and storage configuration with the expected definitions.
- Test upload signing, media validation, job claiming, lease expiry, publish retry, OAuth refresh contention, campaign access and analytics RLS.
- Apply production migrations only after the clean replay and security tests pass.

## 5. Production rollout decision

**Do not run migrations 0008–0016 in production yet.** The branch is now aligned by filename with the hosted 0001–0007 history, but a clean local replay and application-level integration/security tests are still required.

Do not delete or rewrite the seven hosted migration records. Do not reset production. Do not mark any of 0008–0016 as applied until their SQL has actually executed successfully in the target database.

## 6. Evidence boundary

This report records what was observed through the connected GitHub and Supabase integrations during the audit. It does not claim that a production backup was taken, that the local replay was run, or that any pending migration was applied.


## 7. Validation automation added

The integration branch now includes:
- `.github/workflows/database-validation.yml`: local Supabase startup, clean migration replay, migration count, schema/security smoke test, database lint and generated TypeScript type check.
- `supabase/tests/migration_smoke.sql`: verifies required tables, RLS enablement, worker RPC presence, private media bucket configuration and privileged RPC execution restrictions.
- `docs/development/LOCAL_DATABASE_VALIDATION.md`: exact safe local commands and evidence checklist.
- Local Storage configuration raised to 250 MiB to match the private media bucket limit in migration 0009.

### Current execution result

GitHub Actions created runs for both the existing application CI and the new database-validation workflow, but the jobs failed before starting a runner: the GitHub job records show `runner_id = 0` and empty `steps`. No SQL migration step ran, so this is not evidence of a migration SQL failure or success. The run logs were not available from the connector.

The current execution environment also has no Docker executable, so a local Supabase replay could not be run here. The validation workflow and instructions are committed, but **the 16-migration replay remains unverified** until a Docker-capable runner actually executes the job.
