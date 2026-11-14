# SocialOS database foundation smoke-test report

Date: 2026-11-08
Environment: Supabase Cloud development project `SocialOS` (`hpnuhfsdwejldcylsflj`), Frankfurt (`eu-central-1`), PostgreSQL 17.11.
Scope: Initial database/RLS smoke checks only. This is not a full security certification.

## Checks performed

- Confirmed the new project began with no auth users, organisations, or memberships.
- Confirmed all nine application tables have row-level security enabled.
- Confirmed anonymous table SELECT privileges are absent.
- Confirmed authenticated users have no direct INSERT privilege on memberships, invitations, social accounts, audit events, or OAuth token storage.
- Confirmed authenticated users have no SELECT/INSERT/UPDATE/DELETE privileges on `social_account_tokens`.
- Ran a rollback-only fixture with two users, two organisations, and two brands. As User A, only Organisation A and Brand A were visible; Organisation B and Brand B returned zero rows. Membership helper returned true for A and false for B.
- Ran `create_customer_organization` as an authenticated test identity; it created an organisation and owner membership inside a transaction that was rolled back.
- Found Supabase's default function grants gave `anon` EXECUTE on tenant helper and organisation-creation functions. Added migration `0004_revoke_anon_function_execution.sql`.
- Rechecked function privileges: anon EXECUTE is false; authenticated and service_role EXECUTE are true for the four application functions.
- Confirmed all test fixtures were rolled back; auth users, organisations, and memberships are zero.

## Important limitations

- These are smoke tests, not a full automated test suite.
- No live OAuth provider, publishing, invitation acceptance, membership removal, suspended-account, or API-level tests have been run.
- The trigger protecting critical organisation fields still needs explicit role-context tests for authenticated and service-role requests.
- Backend routes must enforce tenant membership and role checks independently of database RLS.
- Test assertions should be converted into repeatable pgTAP and API integration tests before production.

## Applied migrations

1. `0001_core_tenancy`
2. `0002_tenant_rls`
3. `0003_explicit_table_privileges`
4. `0004_revoke_anon_function_execution`
