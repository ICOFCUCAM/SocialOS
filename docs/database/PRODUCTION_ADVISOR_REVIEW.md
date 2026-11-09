# SocialOS production Supabase advisor review

**Reviewed:** 2026-11-10
**Project:** hosted SocialOS Supabase project
**Scope:** read-only inspection of applied migration history, exposed public table metadata and Supabase security/performance advisors.
**Changes made to hosted database:** none.

## 1. Migration history confirmed

The hosted database reports exactly seven applied migrations:

- 0001_core_tenancy
- 0002_tenant_rls
- 0003_explicit_table_privileges
- 0004_revoke_anon_function_execution
- 0005_profiles_and_auth_onboarding
- 0006_atomic_workspace_onboarding
- 0007_private_tenant_helpers

This confirms the production boundary in the migration reconciliation report: migrations 0008 onward, including 0017, are not recorded as applied in the hosted project. Do not apply or mark them applied as part of this advisor review.

## 2. Security advisor findings

### 2.1 Encrypted OAuth token table has RLS enabled and no policies — INFO

Supabase reports `public.social_account_tokens` has RLS enabled and no policies.

A read-only privilege check confirmed:
- `anon` cannot SELECT the table.
- `authenticated` cannot SELECT the table.
- `service_role` can SELECT the table.

This is the intended deny-by-default posture for encrypted provider credentials. Do not add a browser-facing policy just to silence the advisor. The finding is informational and should be documented as intentional.

### 2.2 SECURITY DEFINER onboarding RPC is callable by authenticated — WARN

Supabase reports `public.create_customer_organization(text,text)` is a SECURITY DEFINER function executable by authenticated users.

Inspection of the live function definition and migration 0006 confirms it:
- Requires `auth.uid()` and rejects null identity.
- Validates workspace name and slug.
- Creates the organization, owner membership and starter brand atomically.
- Has a fixed `search_path` of `public, auth, pg_temp`.
- Revokes execution from `PUBLIC` and `anon`, then grants it only to `authenticated`.

This is an intentional authenticated onboarding RPC; the function performs a narrowly scoped operation for the caller and does not accept a caller-supplied owner ID. The advisor warning is therefore not, by itself, proof of an exploitable vulnerability. Retain it as an explicit security-reviewed exception and include a regression test proving one user cannot create a workspace for another user.

### 2.3 Leaked password protection disabled — WARN

Supabase Auth currently reports leaked-password protection disabled. This is an account-level Auth setting, not a SQL migration. The project owner should enable it in Supabase Auth password security settings after reviewing any plan or provider constraints. No Auth setting was changed during this audit.

## 3. Performance advisor findings

The advisor reports:

- 9 foreign-key constraints without covering indexes.
- 6 RLS policies that may re-evaluate auth/current-setting functions per row.
- 4 indexes not yet used.

These are optimization findings, not evidence of incorrect access control. In particular, unused-index findings on low-row-count tables are not a reason to drop indexes without workload evidence.

Recommended follow-up:
1. Inspect existing indexes and query plans before adding any index.
2. Add only missing FK-leading indexes that support actual joins/deletes and tenant filters.
3. Rewrite eligible RLS predicates from `auth.uid()` to `(select auth.uid())` where semantics are unchanged.
4. Re-run advisors and compare query plans after changes.
5. Do not remove unused indexes until production workload and write overhead justify removal.

## 4. Release implications

- No production DDL or configuration was changed.
- The seven-migration production history remains intact.
- The 17-migration integration branch remains unverified by clean replay.
- The runner-allocation issue remains a separate CI infrastructure blocker.
- The token-table advisor finding should remain documented as intentional.
- The onboarding RPC warning should remain documented as a reviewed, narrowly scoped exception, with a dedicated test added to the local security suite.
- Leaked password protection requires an owner-side Auth configuration change.

## 5. Evidence limitations

This review is based on Supabase migration listing, table metadata, advisor output, and read-only SQL inspection of the onboarding function ACL/definition and OAuth token table privileges. It is not a full penetration test, and it does not certify migrations 0008–0017.
