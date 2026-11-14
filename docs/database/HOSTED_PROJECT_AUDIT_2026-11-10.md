# Hosted SocialOS Supabase audit — 2026-11-10

**Project ref:** `hpnuhfsdwejldcylsflj`
**Scope:** read-only inspection of migration ledger, public schema, Supabase security advisors and selected grants.
**Change policy:** no hosted schema, data, Auth or Storage settings were modified during this audit.

## Executive summary

The hosted project still reports only seven applied migrations, named `0001_core_tenancy` through `0007_private_tenant_helpers`. The integration branch contains later migrations, so its complete schema is not present in the hosted project. Do not treat hosted production as a test target for migrations 0008 onward.

The first seven migration names are present in the hosted ledger in sequence. The original reconciliation concern remains: compare the actual SQL definitions and objects, not just names or timestamps, before considering the histories aligned. A filename match is not proof of schema equivalence.

## 1. Migration and schema state

- Hosted migration ledger: 7 entries, from `0001_core_tenancy` to `0007_private_tenant_helpers`.
- The hosted public schema currently contains the early tenancy/onboarding tables, including organizations, organization_members, organization_invitations, brands, brand_members, social_platforms, social_accounts, social_account_tokens, audit_events and profiles.
- Later publishing, media, campaigns and analytics tables from the integration branch are not represented in the inspected hosted table inventory.
- No pending migration was applied as part of this audit.

## 2. Security advisor findings

### 2.1 Encrypted OAuth token table has RLS enabled and no policies — INFO

Supabase reports `public.social_account_tokens` has RLS enabled but no policies. Direct privilege checks returned:
- `anon` SELECT: false
- `authenticated` SELECT: false
- `service_role` SELECT: true

This is consistent with the table's documented backend/service-role-only design. With RLS enabled and no policies, browser roles have no row access; the service role bypasses RLS. The advisor notice is therefore an intentional deny-by-default posture, not a reason to add a permissive policy. Continue to keep token encryption/decryption and all writes server-side.

### 2.2 Customer workspace onboarding RPC — WARN

Supabase reports `public.create_customer_organization(text,text)` is SECURITY DEFINER and executable by authenticated users. Inspection confirms:
- It rejects calls where `auth.uid()` is null.
- It validates workspace name and slug.
- It creates the organization, owner membership and starter brand in one function transaction.
- Execute grants are `authenticated`, `postgres` and `service_role`; PUBLIC/anon are not granted.
- `anon` and `authenticated` do not have CREATE privilege on the public schema.

This appears to be an intentional authenticated onboarding RPC, not an unauthenticated endpoint. Keep its narrow argument validation and explicit grants. Before broader rollout, add regression tests for duplicate slug, malformed input, unauthenticated invocation, and attempts to create an organization for another user. Review any future expansion of this function carefully because SECURITY DEFINER executes with owner privileges.

### 2.3 Leaked-password protection disabled — WARN / owner configuration

Supabase Auth currently reports leaked-password protection is disabled. Enable it in the Supabase Dashboard under Authentication → Settings → Password Security (wording may vary), after confirming the desired password policy. This setting was not changed during the audit.

## 3. Performance advisor findings

### 3.1 Nine unindexed foreign keys — INFO

The advisor identified nine FK constraints without a covering index. Candidate areas include:
- `audit_events.actor_user_id`
- `brand_members(brand_id, organization_id)`
- `brand_members(organization_id, user_id)`
- `brands.created_by`
- `organization_invitations.invited_by`
- `social_account_tokens(social_account_id, organization_id)`
- `social_accounts(brand_id, organization_id)`
- `social_accounts.connected_by`
- `social_accounts.platform_id`

Do not blindly create one index per advisor finding. First inspect existing composite index column order and query plans. An index whose leading columns match the FK can already cover it; the advisor output should be reconciled with actual index definitions. Add only indexes justified by the exact FK column order and expected delete/update/join workloads.

### 3.2 Six RLS policies re-evaluate auth functions — WARN

The advisor flags policies on profiles, organization_members, brands and audit_events for per-row re-evaluation of `auth.uid()` or related auth functions. Where semantically equivalent, wrap stable request-level calls as scalar subqueries, e.g. `(select auth.uid())`, then compare query plans and verify policy behavior. Do not alter authorization predicates or helper semantics during this optimization.

### 3.3 Unused indexes — INFO

Four indexes were reported unused in the observed period. Do not remove them solely on this signal: the hosted database has very low row counts and a limited workload, so an index may not yet have been exercised. Reassess after representative traffic and query-plan evidence.

## 4. Supabase platform change to account for

Supabase announced that new public tables/functions are no longer automatically exposed through the Data API by default, with enforcement on existing projects from 30 October 2026. Every new Creator Studio table must have explicit intended grants and RLS policies; do not rely on automatic exposure. The project is being developed after this change date, so migrations must explicitly define the Data API access contract.

## 5. Recommended order

1. Owner enables leaked-password protection in Auth settings.
2. Complete exact migration reconciliation for hosted migrations 0001–0007 versus the branch files.
3. Restore CI runner execution and prove clean local replay.
4. Add tests for onboarding RPC misuse and sensitive token-table denial.
5. Prepare an index-only migration after inspecting exact index definitions and workload.
6. Optimize RLS policy auth-function calls in a separate, behavior-preserving migration.
7. Resume Creator Studio schema work only after clean replay and tenant tests pass.

## Evidence boundary

This report reflects read-only Supabase tool results observed on 2026-11-10. It does not certify a complete production security audit, prove the full RLS policy matrix, establish a backup, or authorize a production migration. No hosted project changes were made.
