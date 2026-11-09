# SocialOS Creator Studio — architecture and implementation plan

**Status:** architecture baseline; implementation must follow database validation gates.
**Repository:** `ICOFCUCAM/SocialOS`
**Branch:** `integration/socialos-feature-stack`
**Scope:** Creator Studio, unified composition, media, AI assistance, platform adaptation, approvals and publishing.

## 1. Executive decision

Build Creator Studio as a workflow on top of the existing SocialOS publishing foundation. Do not create a parallel post model, media library, calendar or queue.

The canonical content object remains `public.social_posts`. A post belongs to one organization and one brand. Each destination is represented by `public.social_post_targets`. The existing `caption_override` and `platform_options` fields are the intended per-destination extension points. Publishing remains worker-mediated through `publish_jobs`; browsers must never publish directly or hold provider credentials.

The first implementation milestone is not a visual redesign. It is to close the data and capability gaps between the existing AI Studio, composer, media pipeline and publishing adapters.

## 2. Existing implementation discovered

The integration branch already contains substantial foundations:

| Area | Existing implementation |
|---|---|
| AI Content Studio | `src/app/(protected)/app/studio/page.tsx`, `src/components/app/ai-content-studio.tsx`, `src/app/api/ai/content/route.ts` |
| Unified composer | `src/app/(protected)/app/compose/page.tsx`, `src/components/app/social-post-composer.tsx` |
| Calendar | `src/app/(protected)/app/calendar/page.tsx` |
| Campaigns | `src/app/(protected)/app/campaigns/*` and campaign migrations |
| Media upload | Signed upload URL, finalization and status routes |
| Media processing | `workers/media-processor`, ClamAV scan, image/video metadata and renditions |
| Publishing | Durable jobs and lease recovery; `workers/publisher` |
| Provider adapters | Meta (Facebook/Instagram), LinkedIn and YouTube |

The current schema already supports a canonical post plus target-level caption overrides and platform options. Preserve this architecture.

## 3. Capability reality — do not overstate platform support

The social platform registry is seeded with Instagram, Facebook, TikTok, YouTube, LinkedIn, Threads, Pinterest and X. A registry entry is not proof that publishing is implemented.

Current publisher adapter dispatch supports:
- Facebook Pages: text and one media item; multi-photo publishing is not implemented.
- Instagram: one image or one video/Reel media item.
- YouTube: one prepared video upload.
- LinkedIn: text-only; media upload is not implemented.

TikTok, Threads, Pinterest and X currently have no publishing adapter in the worker registry. The UI must distinguish **connected account**, **supported publishing**, **supported media format**, and **available analytics**. Never show an enabled publish action solely because a platform exists in the registry.

Create one server-owned capability map per adapter and expose a safe, read-only subset to the composer. Capability data must be verified against the provider's current official API documentation before enabling each feature.

## 4. Gaps identified in the current UI/API

### 4.1 AI output is transient
The AI endpoint generates three variants and returns token usage, but the UI keeps the result in component state. Selecting “open in composer” places the text in browser session storage. There is no durable generation history, prompt metadata, accepted-variant record or AI usage ledger.

**Required:** persist an accepted variant as a normal draft post, record its generation provenance separately from the published content, and preserve human edits as a new revision. Do not auto-publish AI output.

### 4.2 Composer uses one shared body
The composer sends one `body` for every selected destination. The publishing RPC creates target rows but does not accept `caption_override` or `platform_options`, despite those columns existing on the target table.

**Required:** support a canonical master caption plus per-target caption and structured platform options. Extend the trusted RPC atomically; do not update target rows from the browser in a way that bypasses authorization.

### 4.3 No durable editing/version workflow
The calendar and composer support drafts and scheduled posts, but there is no visible content revision history, restore action, editorial comments or approval state.

**Required:** define draft → in review → changes requested / approved → scheduled → publishing → published / partially published / failed. The approval workflow must be optional per workspace, with role- and brand-scoped authorization. Scheduling must be blocked until required approvals exist.

### 4.4 Platform constraints are not surfaced before scheduling
The worker may reject a destination after scheduling if its adapter cannot handle the selected media set or format. Platform constraints should be evaluated in the UI for feedback and revalidated on the server and worker as the final authority.

**Required:** validate account, content type, text limits, media count, aspect/duration/size requirements, visibility settings, provider scopes and adapter availability before a target can be queued.

### 4.5 AI governance and cost controls
The AI endpoint calls the OpenAI Chat Completions API directly, uses a configured model, and returns usage counts. It currently has no durable per-tenant usage ledger or explicit idempotency key in the inspected route.

**Required:** add server-side per-user and per-tenant rate limits, request idempotency, usage metering, budget/plan enforcement, model/provider abstraction, and retention controls. Keep API keys server-only. Store only the minimum prompt/response data needed for user history and compliance.

## 5. Target architecture

### 5.1 User experience

1. **Create** — choose brand, campaign (optional), content goal and one or more destinations.
2. **Generate or write** — AI creates editable variants or the user writes from scratch.
3. **Adapt** — generate or edit destination-specific captions, hashtags, titles, descriptions and platform options.
4. **Attach media** — select processed assets; see previews and platform-specific renditions.
5. **Validate** — run capability, policy, role, account-scope and media checks for every destination.
6. **Review** — optional approval workflow; comments and change requests attach to the draft/revision.
7. **Schedule or publish** — create target rows and jobs atomically. Immediate publishing should also be represented as a durable queue job, not a browser-side provider call.
8. **Track** — display target-level status, provider IDs, permalink, errors and analytics.

### 5.2 Data model direction

Reuse:
- `social_posts`: canonical post and shared metadata.
- `social_post_targets`: one row per connected destination, with `caption_override` and `platform_options`.
- `social_post_media` / `social_media_assets`: selected assets and processed media.
- `publish_jobs`: durable, idempotent worker queue.
- `social_campaigns` / `social_campaign_posts`: campaign relationship.
- `audit_events`: security- and workflow-relevant actions.

Proposed additions, only after migration tooling is operational and clean replay passes:
- `social_post_revisions`: immutable content snapshots, editor, timestamp and revision reason.
- `social_post_approvals`: approver, decision, comment, scope and timestamp.
- `social_ai_generations`: provider/model, request hash, usage, accepted variant reference and retention metadata; avoid storing secrets.
- Optional `social_post_comments` if editorial discussion is required beyond approval comments.

All new tables must have RLS enabled, organization/brand foreign-key integrity, least-privilege grants and tenant-isolation regression tests. Do not expose service-role operations to browser clients.

### 5.3 API boundaries

- Browser: authenticated UI and Supabase user session only.
- Next.js server routes/actions: validate identity, membership, role, brand, payload, idempotency and capability; invoke narrowly scoped RPCs.
- Supabase: canonical data, RLS, transactional post/target/job creation and audit records.
- Media worker: malware scan, signature validation, metadata extraction and derivative generation.
- Publisher worker: provider token decryption/refresh, capability enforcement, upload/publish, idempotency and reconciliation.
- AI service boundary: server-side provider adapter, schema-validated output, usage metering and tenant limits.

## 6. Implementation sequence

### Creator Studio 1 — persistence and per-destination content
- Make AI-generated variants saveable as durable drafts.
- Add canonical master caption and per-target caption overrides.
- Add platform options with strict allowlisted schemas per adapter.
- Add immutable revision history.
- Add transactional API/RPC and authorization tests.

**Acceptance:** a user can create a post, save it, leave the page, return later, edit it, and see separate target captions retained without losing the master copy.

### Creator Studio 2 — capability-aware composer
- Implement a server-owned adapter capability registry.
- Show only destinations with an enabled publishing adapter.
- Validate text, media count/type, duration, aspect ratio, scopes and required metadata per target.
- Preview the exact rendition and caption per destination.
- Revalidate at enqueue and immediately before provider calls.

**Acceptance:** unsupported combinations are blocked before scheduling, with a precise explanation; workers remain the final authority.

### Creator Studio 3 — approval and collaboration
- Workspace-level approval policy.
- Submit for review, approve, request changes and audit.
- Role/brand-scoped reviewer assignment.
- Approval gate in the transactional scheduling RPC.

**Acceptance:** no job can be queued for a post that requires approval but has not been approved.

### Creator Studio 4 — production polish and monetization
- AI usage ledger and tenant budgets.
- Media library search, filters, tags, folders and asset details.
- Bulk scheduling and campaign calendar.
- Performance/analytics surfaces and export.
- Plan-based feature/usage enforcement.

## 7. Release and testing gates

Do not merge or deploy this work to production until:
1. All migrations replay cleanly from an empty local database.
2. Existing migration smoke tests pass.
3. Two-tenant RLS tests pass.
4. Tests cover per-target override authorization and cross-tenant rejection.
5. Approval bypass tests pass.
6. Provider contract tests cover each enabled adapter and unsupported capability.
7. Media tests cover malicious signature, MIME mismatch, oversized files and scanner unavailable.
8. Worker retry/idempotency and ambiguous provider outcome recovery tests pass.
9. Application typecheck, lint and production build pass.

The CI runner assignment issue must be resolved before these gates can be treated as passed. Production remains untouched.

## 8. Immediate next engineering task

Implement **Creator Studio 1: durable draft persistence and per-target content** only after local database replay is available. First, extend the existing post-bundle RPC to accept a validated array of target objects (account ID, caption override and allowlisted platform options) and create all post, media, target and job rows in one transaction. Then add revision/AI-generation records through CLI-generated migrations, RLS policies and tests.

Do not implement approval states or new tables in an unvalidated production database. Keep the existing composer and AI Studio as the user-facing starting point; evolve them rather than replacing them.
