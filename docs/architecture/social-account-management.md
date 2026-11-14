# Social account management centre

The customer-facing Channels page is the workspace's account inventory and credential-health view.

## Account health

The browser reads account identity through the authenticated Supabase session. A server route first verifies that the account is visible to the current user through brand-scoped RLS, then reads credential metadata through the server-only Supabase service client. Token values and encrypted token bytes are never returned.

The health response contains:
- connection status and last provider verification;
- granted OAuth scopes;
- access-token expiry and refresh-token expiry where supplied by the provider;
- last successful token refresh time;
- whether a refresh token exists;
- encryption key version (identifier only, never key material).

A token expiring within seven days is displayed as expiring soon. Providers that omit an expiry are displayed as unknown rather than incorrectly labelled healthy.

## Disconnect

Only workspace owners, administrators and managers can disconnect an account. The server invokes migration `20261110000500_atomic_social_account_disconnect.sql` after authorization. The database performs credential deletion, account-state transition and audit insertion in one transaction. The server:
1. authenticates the current user;
2. confirms active manager membership in the same organization;
3. confirms the account is visible under brand-scoped RLS and belongs to that organization;
4. deletes the encrypted access/refresh token row using the service role;
5. marks the social account disconnected;
6. writes a tenant-scoped audit event.

Disconnect removes SocialOS's stored credentials. It does not guarantee that the provider-side OAuth grant has been revoked. The UI directs users to the provider's security settings for revocation.

## Reconnect

Accounts in reauthorization-required, expired, disconnected or error states can start the existing OAuth authorization flow again. Facebook and Instagram accounts use the Meta OAuth flow; YouTube and LinkedIn use their respective flows. The OAuth callback revalidates the user session, organization membership and brand before storing credentials.

## Boundaries

- The API never returns access tokens, refresh tokens, ciphertext, nonces or authentication secrets.
- Token metadata is returned with `Cache-Control: no-store`.
- The dashboard does not claim that a connected account has every publishing permission. It displays granted scopes for operator review.
- TikTok, Threads, Pinterest and X are listed as planned integrations; they are not presented as live publishing adapters.
- Apply migration `20261110000500_atomic_social_account_disconnect.sql` after the preceding migrations before using disconnect.

The account-management API and UI have not been tested against a live SocialOS Supabase project in this change.


## Provider health and account reliability

The connected channels page includes a provider health panel backed by `GET /api/social/accounts/health`.

- The endpoint requires an authenticated user and an active workspace membership. It scopes account and token metadata queries to that workspace.
- Credential metadata is read server-side using the service client, but only expiry timestamps, refresh timestamps and boolean refresh-token availability are returned. Access-token ciphertext, nonce, authentication tag and plaintext are never returned.
- Health classifications distinguish healthy, warning, action-required, error, disconnected and pending accounts.
- Access tokens expiring within seven days are warnings. Expired access tokens, expired refresh tokens or an account explicitly marked for reauthorization require action. Missing token records and credential errors are surfaced.
- Unknown expiry is not represented as confirmed healthy. Meta connections without a refresh-token flow may require reconnection when the provider invalidates a token; the health panel does not promise automatic refresh.
- The panel offers a manual refresh of the health snapshot. It does not itself call provider APIs or force token refresh.

This is a credential and connection health snapshot, not a provider uptime monitor. Provider API reachability checks, endpoint quota telemetry and scheduled pre-campaign delivery risk scoring remain future capabilities.
