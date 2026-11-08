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

Only workspace owners, administrators and managers can disconnect an account. The server:
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
- The account-management API and UI have not been tested against a live SocialOS Supabase project in this change.
