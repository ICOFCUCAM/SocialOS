# SocialOS Tenant Isolation Test Plan

Status: specification only. Implement and execute against a disposable Supabase project before production.

## Test identities
- User A: owner of Organisation A.
- User B: active editor assigned to Brand A1.
- User C: active member of Organisation A, not assigned to Brand A1.
- User D: owner of Organisation B.
- User E: removed or suspended member of Organisation A.

## Fixtures
Create Organisations A and B; Brands A1 and A2 under A and B1 under B; a social account and encrypted token for A1; invitations and audit events for both organisations.

## Required assertions
1. A can read Organisation A but not B; D cannot read A.
2. B can read Brand A1; C cannot unless assigned; B cannot read B1.
3. A can read social account metadata for an authorised brand; D cannot read A's metadata.
4. anon and authenticated cannot select token records; only trusted service-role workflows can manage them.
5. E loses access after membership suspension/removal.
6. A user cannot create an organisation with another user's owner ID.
7. A user cannot self-assign owner/admin through direct membership writes.
8. Only owner/admin can view the full membership roster and invitations.
9. Authenticated users cannot update or delete audit events.
10. A user cannot change owner_user_id through a client update.
11. Composite foreign keys reject cross-organisation social-account/brand relationships.
12. Composite foreign keys reject brand assignments for non-members.
13. Organisation suspension blocks member and brand access.

## Execution
Use Supabase CLI locally or a disposable hosted project. Seed identities with service-role test setup. Exercise requests under authenticated and anon roles with realistic JWT claims. Verify both allowed and denied cases. Add API-level tests as well as SQL/RLS tests; policy tests alone do not prove NestJS routes are secure. Never use production customer data.
