# SocialOS migration history reconciliation — 2026-11-10

**Repository:** `ICOFCUCAM/SocialOS`
**Branch:** `integration/socialos-feature-stack`
**Hosted Supabase project:** `hpnuhfsdwejldcylsflj`
**Production changes:** none

## Executive decision

Do not run `supabase db push`, `supabase migration repair`, or apply migrations to production until migration filenames are normalized to Supabase's timestamp convention and a clean local replay passes.

The repository currently names migrations `0001_...` through `0017_...`. Supabase CLI migration files must use `<timestamp>_<name>.sql`; the CLI compares only timestamp versions between local files and `supabase_migrations.schema_migrations`, not descriptive names. The hosted database stores 14-digit timestamps. Thus matching descriptive migration names does not make local and remote histories aligned.

## 1. Hosted migration ledger (read from Supabase)

| Sequence | Hosted version | Hosted name | Repository filename |
|---:|---|---|---|
| 1 | `20261108174627` | `0001_core_tenancy` | `0001_core_tenancy.sql` |
| 2 | `20261108174659` | `0002_tenant_rls` | `0002_tenant_rls.sql` |
| 3 | `20261108174707` | `0003_explicit_table_privileges` | `0003_explicit_table_privileges.sql` |
| 4 | `20261108174848` | `0004_revoke_anon_function_execution` | `0004_revoke_anon_function_execution.sql` |
| 5 | `20261108175020` | `0005_profiles_and_auth_onboarding` | `0005_profiles_and_auth_onboarding.sql` |
| 6 | `20261108175537` | `0006_atomic_workspace_onboarding` | `0006_atomic_workspace_onboarding.sql` |
| 7 | `20261108175641` | `0007_private_tenant_helpers` | `0007_private_tenant_helpers.sql` |

The hosted database reports exactly these seven applied migration records. Repository files 0008–0017 are pending relative to that ledger.

## 2. Object-level reconciliation observations

The first seven repository SQL files were fetched and compared against the hosted schema inventory, policies, grants, functions, enum labels, triggers, constraints and indexes.

Observed matches include:
- The expected tenancy tables and profile table exist.
- Expected enums and enum labels are present.
- The final onboarding RPC definition matches migration 0006: authenticated identity is derived from `auth.uid()`, name and slug are validated, and organization, owner membership and starter brand are created atomically.
- Private helper functions exist with SECURITY DEFINER and fixed search paths; the expected tenant RLS policies reference them.
- The auth-user profile trigger and updated-at triggers exist.
- The OAuth token table has RLS enabled, no policies, no anon/authenticated table grants, and service_role access only.
- The hosted migration ledger names and order correspond to files 0001–0007.

This is a strong object-level correspondence for the observed objects, but it is not a cryptographic proof that the original SQL bytes applied to production are identical to the current Git files. The CLI migration ledger does not store a content hash. Do not describe this as checksum verification.

## 3. Critical filename/version mismatch

Supabase CLI documentation specifies `<timestamp>_<name>.sql` for migration files and states that only timestamps are compared by `supabase migration list`.

Current repository filenames begin with four-digit sequence labels, whereas the hosted history versions are 14-digit timestamps. Consequently, the current local migration inventory cannot match the hosted history by timestamp, even though descriptive names match.

### Required normalization plan

1. Preserve the seven hosted migration version IDs exactly when normalizing the first seven repository files:
   - `20261108174627_core_tenancy.sql`
   - `20261108174659_tenant_rls.sql`
   - `20261108174707_explicit_table_privileges.sql`
   - `20261108174848_revoke_anon_function_execution.sql`
   - `20261108175020_profiles_and_auth_onboarding.sql`
   - `20261108175537_atomic_workspace_onboarding.sql`
   - `20261108175641_private_tenant_helpers.sql`
2. Do not edit the SQL contents of these historical migrations during filename normalization.
3. Generate fresh 14-digit timestamps for pending migrations 0008–0017 using `supabase migration new <name>` in a Docker-capable working environment. Preserve their dependency order and existing SQL content. Do not invent or reuse a hosted version ID.
4. Review the complete rename diff and confirm there are no duplicate timestamps.
5. Run `supabase migration list` against the linked project in read-only mode and verify the first seven timestamps align while migrations 8–17 appear only as local pending entries.
6. Run `supabase db reset` against a disposable local database, followed by schema smoke, tenant-isolation, lint and generated-type checks.
7. Only after all checks pass, review the production rollout plan. Do not use `migration repair` to paper over a real filename mismatch.

The exact rename operation is intentionally not performed in this report: this integration branch's pending migration filenames and workflow must be changed together, and a full diff/replay should validate the result.

## 4. Hosted tenant-suspension authorization gap

The hosted `private.can_access_brand(uuid,uuid)` function currently matches migration 0007. Its organization-manager branch checks active organization state through `private.has_org_role`, but the direct brand-member branch checks only active organization membership. It does not independently require the parent organization to be active and not soft-deleted.

This means a brand member can potentially retain brand access when the parent organization is suspended or soft-deleted. Migration `0017_enforce_active_tenant_state.sql` in the integration branch fixes this by checking active/non-deleted organization state around both authorization paths. It also adds an active-tenant guard to `create_social_post_bundle`.

**Severity:** security issue requiring prioritized remediation and tests.
**Production status:** migration 0017 has not been applied. No production changes were made during this audit.

## 5. Additional notes

- The hosted schema contains only the pre-publishing table set from migrations 0001–0007. Publishing/media/campaign/analytics migrations 0008–0016 are not present in the hosted migration ledger.
- The local validation workflow currently runs `supabase db reset` but cannot pass the hosted timestamp comparison while migration filenames use four-digit prefixes.
- GitHub Actions runner allocation remains a separate blocker; previous jobs failed before steps were recorded.

## 6. Release gates

- [ ] Normalize historical filenames to exact hosted timestamps.
- [ ] Generate pending migration timestamps with Supabase CLI.
- [ ] Verify local/remote migration list alignment (first seven applied; remaining ten pending).
- [ ] Restore a functioning GitHub Actions runner.
- [ ] Pass clean local replay of all 17 migrations.
- [ ] Pass schema smoke and tenant-isolation regression tests.
- [ ] Review migration 0017 and test suspended/deleted tenant access denial.
- [ ] Review backup and production rollout/rollback plan.
- [ ] Only then authorize production migration deployment.

## Evidence boundary

This document records read-only Supabase and GitHub observations from 2026-11-10. No production schema, migration history, data, Auth setting or Storage setting was changed.
