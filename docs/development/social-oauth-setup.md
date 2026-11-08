# SocialOS OAuth foundation setup

## Supported in this first server-side adapter slice

- YouTube via Google OAuth and YouTube Data API v3 channel lookup.\n- Meta OAuth with Facebook Page discovery and linked Instagram professional-account discovery.
- LinkedIn member profile via Sign In with LinkedIn / OpenID Connect.

This is not yet the full Meta (Facebook Pages + Instagram), TikTok, Threads, Pinterest or X integration. Provider publishing capabilities and app approval are separate from basic account identification.

## Required server-only environment

```dotenv
SOCIAL_OAUTH_REDIRECT_BASE_URL=https://your-socialos-host.example
SOCIAL_OAUTH_STATE_SECRET=<at-least-32-random-characters>
SOCIAL_TOKEN_ENCRYPTION_KEY=<base64-encoded-32-byte-random-key>
SOCIAL_TOKEN_KEY_VERSION=v1
SUPABASE_SERVICE_ROLE_KEY=<server-only-supabase-service-role-key>

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
```

Generate independent secrets; never commit them or prefix them with `NEXT_PUBLIC_`. Keep the encryption key in the deployment secret manager and maintain a controlled rotation plan. Losing the key makes existing encrypted tokens unreadable.

For local secret generation, use a trusted password manager or a local cryptographic generator. The encryption key must decode from base64 to exactly 32 bytes.

## Provider console setup

Register these exact redirect URIs:

- `https://your-socialos-host.example/api/social/callback?provider=youtube`
- `https://your-socialos-host.example/api/social/callback?provider=linkedin`

Google: enable YouTube Data API v3, configure a Web OAuth client and request the minimum YouTube scope. Google may require OAuth consent-screen verification for production access.

LinkedIn: request the Sign In with LinkedIn using OpenID Connect product. This adapter identifies the member profile only; it does not grant organisation-page publishing access. Request additional LinkedIn products and permissions separately when required.

## Flow and security controls

- Authenticated user and active organisation membership are checked before starting OAuth.
- The requested brand must belong to the same organisation and be active.
- A short-lived, HTTP-only, SameSite=Lax, production-secure cookie carries HMAC-signed state and the PKCE verifier.
- Callback validates signature, state, provider, age, logged-in user, membership and brand again.
- Authorization codes are exchanged server-to-server; provider tokens are never returned to the browser.
- Access and refresh tokens are encrypted with AES-256-GCM before writing to the service-role-only token table.
- Do not log tokens, authorization codes, client secrets, state cookies or token endpoint response bodies.

## Known next work

1. Add refresh-token rotation and revocation/disconnect workflows.
2. Add Meta OAuth adapter with Facebook Page and linked Instagram professional-account discovery.
3. Add provider capability and publishing permission checks; basic profile connection does not imply publishing permission.
4. Add OAuth integration tests and tenant-isolation tests.
5. Add token-key rotation tooling and operational alerting.

## Meta app setup

Configure a Meta app with the Facebook Login product and the current Graph API version. Register this exact redirect URI:

- `https://your-socialos-host.example/api/social/callback?provider=meta`

Set `META_CLIENT_ID`, `META_CLIENT_SECRET` and `META_GRAPH_API_VERSION` on the server. The default Graph API version in this adapter is configurable; verify it against the version enabled for your Meta app before deployment.

The adapter requests these permissions:
- `pages_show_list` to enumerate Pages the authorizing person can access.
- `pages_read_engagement` to read Page metadata and engagement context.
- `pages_manage_posts` for future Facebook Page publishing.
- `instagram_basic` and `instagram_content_publish` for eligible Instagram professional accounts.

The callback exchanges the authorization code, requests a long-lived Meta user token, discovers accessible Facebook Pages and linked Instagram professional accounts, and stores each Page/profile as a separate SocialOS account. Page access tokens are encrypted before persistence. The Instagram professional account uses its associated Page access token for this Facebook Login-based integration.

Important eligibility and review constraints:
- Instagram must be a professional (Business or Creator) account linked to a Facebook Page for this integration path.
- Permissions and publishing features require the appropriate Meta app review / Advanced Access before use with people outside app roles or test users.
- The connected Facebook user must have the necessary Page task/access level.
- This first slice does not yet implement publishing, media-container processing, token refresh monitoring, revocation, or granular capability checks. Do not expose publishing controls until those are implemented and verified.
