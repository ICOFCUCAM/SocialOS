# Official provider publishing adapters

## Scope

This milestone introduces isolated provider adapters for Facebook Pages, Instagram professional accounts, YouTube channels and LinkedIn member text posts. Adapters call official provider APIs directly and return external post IDs. They are a provider integration layer, not yet a complete scheduled-publishing service.

## OAuth permissions

The OAuth setup requests publishing permissions for supported provider operations:

- Meta: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`.
- YouTube: `https://www.googleapis.com/auth/youtube.upload`.
- LinkedIn: `openid`, `profile`, `w_member_social`.

Existing connections created with read-only or profile-only permissions must be reconnected and consent to the additional scopes. Provider app review, verification and user eligibility remain subject to each provider's requirements. A requested scope is not proof that the provider has approved the application for production access.

## Adapter operations

- Facebook Pages: text feed posts and single photo/video posts using a temporary fetchable media URL.
- Instagram professional accounts: one image or Reel per publication, using the media-container then publish flow. Video container processing is polled before publishing.
- YouTube: one MP4 video through the resumable upload API. Default privacy is private unless an explicit option is supplied.
- LinkedIn: text-only member posts through the Posts API. Media uploads are deliberately rejected until the provider media upload workflow is implemented.
- Other platforms fail with `PROVIDER_NOT_SUPPORTED`; no unofficial API or browser automation fallback is used.

## Safety and retry semantics

- Exact granted scopes are checked before API calls.
- Provider HTTP 429 and 5xx responses are marked retryable; 5xx responses and interrupted uploads can have ambiguous outcomes.
- An ambiguous timeout must be reconciled against provider state before retrying. Do not blindly retry and risk duplicate posts.
- YouTube resumable upload URLs are host-validated before sending OAuth credentials or media.
- Provider API versions are explicit configuration: `META_GRAPH_API_VERSION` and `LINKEDIN_API_VERSION`.
- Meta and LinkedIn adapters currently return a provider ID without a permalink when no canonical permalink is returned by the API.

## Not yet wired to the durable job queue

The adapters are isolated modules with unit-level contract tests. They are not yet connected to `claim_publish_jobs`, token decryption in the worker, media derivative retrieval, lease recovery, durable target/job status updates, or audit logging. Do not deploy them as a publishing service or claim that scheduled posts are now published end-to-end.

Before production use, implement the publishing worker orchestration, credential refresh/revocation handling, idempotent reconciliation for ambiguous outcomes, per-provider rate limits, staging integration tests and official app review.
