# External Component Reuse Audit

**Status:** Research baseline; no upstream source code copied or vendored  
**Prepared:** 2026-11-08  
**Target:** SocialOS TypeScript application and worker architecture  
**Origin:** drafted on `feat/external-component-reuse-audit` (PR #30), now kept on `main`

## 1. Purpose

This register records the three external projects identified for SocialOS reuse. It distinguishes direct code reuse from architectural adaptation and optional service integration. A repository being useful as a reference does not mean its code has been imported, tested, or approved for production.

The goal is to avoid rebuilding mature capabilities while preserving SocialOS's tenancy model, TypeScript stack, security controls, product identity, and commercial licensing strategy.

## 2. Executive decisions

| Source | Licence observed in upstream root | Decision | Reuse mode |
|---|---|---|---|
| [Postiz](https://github.com/gitroomhq/postiz-app) | AGPL-3.0 | Do not copy or link its application code into proprietary SocialOS without a deliberate legal review and licensing decision | Architecture/reference only by default |
| [Mixpost](https://github.com/inovector/mixpost) | MIT | Reuse selected concepts; evaluate isolated code only where language/runtime compatibility justifies it | TypeScript adaptation; selective MIT code only after file-level review |
| [Content Machine](https://github.com/45ck/content-machine) | MIT | Evaluate as an isolated optional media-production capability | Package/worker integration after runtime and security validation |

This is an engineering assessment, not legal advice. Licence compatibility must be reviewed for the exact files, dependencies, distribution model, and deployment model before copying or linking upstream code.

## 3. Licence and provenance controls

### 3.1 Postiz

The upstream repository identifies itself as AGPL-3.0. AGPLv3 section 13 includes obligations for modified versions used for remote network interaction, including an offer to provide corresponding source to remote users. SocialOS is intended to be a commercial multi-tenant SaaS. Accordingly, the default is to study public architecture and independently implement compatible patterns rather than import Postiz application code.

Reference files inspected:
- `libraries/nestjs-libraries/src/dtos/posts/create.post.dto.ts`
- `libraries/nestjs-libraries/src/integrations/social/wordpress.provider.ts`

Useful patterns:
- typed post/integration DTOs;
- per-provider settings and validation;
- content sanitisation before provider calls;
- provider-specific error classification;
- media-aware post payloads.

Do not copy code, provider implementations, or substantial expressive structures into SocialOS under this default decision. If a future proposal requires direct use, obtain a written legal assessment first and document the resulting licence obligations.

### 3.2 Mixpost

The upstream package declares MIT in `composer.json` and includes `LICENSE.md`. MIT permits commercial use, modification, distribution and sublicensing subject to retaining copyright and permission notices in copies or substantial portions.

Reference files inspected:
- `src/Contracts/SocialProvider.php`
- `src/Actions/AccountPublishPost.php`
- `src/Actions/PublishPost.php`

Useful patterns:
- stable provider contract;
- account-specific publishing operation;
- separation of content parsing from provider execution;
- per-account provider response and error persistence;
- batch fan-out across accounts with completion/failure aggregation.

Mixpost is a Laravel/PHP package. SocialOS is TypeScript-based. Porting the PHP package or introducing a parallel Laravel runtime is not recommended. Implement equivalent TypeScript contracts and orchestration in SocialOS. Direct reuse of a small MIT-licensed asset should be considered only after checking its full dependency and notice requirements.

### 3.3 Content Machine

The upstream repository identifies itself as MIT and its package is `@45ck/content-machine`. It is a local-first short-form video skill pack for coding-agent harnesses, with skills, flows and deterministic runtime tools. It is not, by itself, a ready-made multi-tenant media backend.

Reference files inspected:
- `VENDORING.md`
- `docs/user/AGENT-QUICKSTART.md`
- `skills/longform-to-shorts/SKILL.md`
- `skills/video-render/SKILL.md`
- `package.json`

Useful capabilities and contracts:
- long-form source analysis and candidate clip selection;
- transcript/timestamp-driven selection;
- boundary snapping and explicit approval before extraction;
- vertical reframing and caption workflows;
- rendering with MP4 and caption sidecars;
- source-media rights, provenance and review evidence;
- inspectable run artifacts.

Important limitation: the documented long-form selection path currently produces a render handoff; extraction, reframing, rendering and review are subsequent steps. Do not represent it as a single fully automated operation without testing the complete chain.

Integration constraints:
- run processing in isolated worker jobs, not inside request handlers;
- never execute arbitrary agent shell commands on behalf of a tenant;
- validate file paths, URLs, media types, size, duration and resource limits;
- use private object storage and short-lived access URLs;
- persist source rights/provenance, approval and render metadata;
- ensure cancellation, retries and idempotency;
- verify FFmpeg/Remotion/browser dependencies and container reproducibility;
- ensure tenant identity is enforced at every API, job and storage boundary.

## 4. SocialOS target architecture

SocialOS remains the system of record for users, organisations, memberships, brands, connected social accounts, credentials, scheduled posts, publishing attempts, media assets, analytics and audit events.

External capabilities must sit behind SocialOS-owned interfaces:

1. **Provider adapter interface** — platform-specific OAuth, account discovery, publishing, deletion and analytics operations.
2. **Publishing orchestration service** — schedules and fans out posts, records per-destination attempts, classifies errors and applies bounded retry/idempotency rules.
3. **Media production service** — accepts authorised source assets and job specifications, invokes isolated processing workers, and returns immutable output artifacts plus provenance.
4. **Provenance and review service** — stores source, rights evidence, transformations, approvals, model/tool versions, output hashes and review state.

No external project may become a second source of truth for SocialOS tenancy or credentials.

## 5. Proposed SocialOS TypeScript contracts

These are target contracts, not yet implemented:

```ts
export type ProviderCapability =
  | "text"
  | "image"
  | "video"
  | "carousel"
  | "analytics"
  | "comments";

export interface SocialProviderAdapter {
  readonly key: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;
  authorize(input: OAuthAuthorizationInput): Promise<OAuthAuthorizationResult>;
  refresh?(input: TokenRefreshInput): Promise<TokenRefreshResult>;
  publish(input: PublishInput): Promise<PublishResult>;
  getPost?(input: ProviderPostLookupInput): Promise<ProviderPostResult>;
  getMetrics?(input: MetricsInput): Promise<MetricsResult>;
}

export interface PublishResult {
  providerPostId: string;
  publishedAt: string;
  canonicalUrl?: string;
  warnings: string[];
}

export interface MediaProductionJob {
  tenantId: string;
  brandId: string;
  sourceAssetId: string;
  requestedOutputs: Array<"short_vertical_video" | "captions" | "transcript">;
  approvalRequired: true;
  idempotencyKey: string;
}
```

Implementation requirements:
- tenant and brand IDs are derived from authenticated server-side context, not trusted from arbitrary client payloads;
- secrets are fetched only by server-side credential services;
- provider adapters receive narrowly scoped credentials and typed inputs;
- all external API calls use timeouts, bounded retries, rate limits and structured error classes;
- each publish attempt has a stable idempotency key and immutable audit record;
- media jobs use a queue and isolated worker process;
- outputs are not publishable until required rights and review gates pass.

## 6. Component reuse matrix

| Capability | Postiz reference | Mixpost reference | Content Machine | SocialOS action |
|---|---|---|---|---|
| Provider contract | Strong | Strong | Not primary focus | Define one canonical TypeScript interface |
| OAuth lifecycle | Inspect provider implementations | Provider contract | Not primary focus | Retain SocialOS OAuth/token vault; compare edge cases |
| Multi-account publishing | Provider fan-out patterns | Batch publishing actions | Not primary focus | Improve SocialOS publisher orchestration |
| Content calendar | Reference only | Product capability | Not primary focus | Retain SocialOS calendar; compare UX/workflow |
| Media ingestion | Reference only | Media library patterns | Ingest/source workflows | Retain SocialOS secure ingestion; add provenance |
| Long-form clipping | Not primary focus | Not primary focus | Core capability | Optional isolated media pipeline |
| Captions/rendering | Not primary focus | Not primary focus | Core capability | Integrate worker capability through job contract |
| Rights/provenance | Review patterns only | Not primary focus | Explicit asset-ledger/review patterns | Add first-class provenance records |
| Analytics | Provider-specific reference | Provider integrations | Feedback loop concepts | Retain SocialOS analytics schema and collectors |

## 7. Work packages and acceptance criteria

### WP-1 — Provider contract and adapter gap analysis

- Inventory all existing SocialOS provider interfaces and implementations.
- Compare them against the Postiz and Mixpost patterns.
- Define one provider contract and capability registry.
- Keep OAuth/token encryption and tenant ownership in SocialOS.
- Add contract tests using fake providers.

Acceptance:
- all existing providers implement the same contract or have a documented migration adapter;
- invalid capabilities and unsupported media combinations fail before enqueue;
- provider errors map to stable SocialOS error classes;
- tests prove one tenant cannot publish using another tenant's account.

### WP-2 — Publishing orchestration

- Compare current SocialOS job model with Mixpost's account-level fan-out and batch completion approach.
- Persist one attempt per destination.
- Add idempotency, bounded retries, rate limits and terminal failure states.
- Ensure one destination failure does not erase successful results for other destinations.

Acceptance:
- partial success is represented accurately;
- duplicate queue delivery cannot create duplicate provider posts where provider semantics allow idempotency;
- retrying a failed destination does not republish successful destinations;
- job ownership and account ownership are checked server-side.

### WP-3 — Content Machine capability spike

- Pin an upstream release/commit and package integrity metadata.
- Run the package's doctor/catalog and no-key smoke path in an isolated environment.
- Run a licensed sample-media long-form-to-shorts workflow.
- Record exact dependencies, execution time, CPU/memory, disk use and output artifacts.
- Test cancellation, timeout and worker restart behavior.

Acceptance:
- reproducible worker image and documented runtime dependencies;
- a source video produces candidate clips, approval artifacts, extracted clip(s), rendered MP4 and review report;
- source provenance and output hashes are persisted;
- no arbitrary shell access or cross-tenant file access is possible.

### WP-4 — Rights, provenance and approval

Proposed records:
- source asset and source URL (where applicable);
- rights basis/permission and reviewer;
- source hash and ingestion timestamp;
- transcript and clip time ranges;
- transformations and tool/model versions;
- approval/rejection actor and timestamp;
- output hashes and storage object identifiers.

Acceptance:
- publishing is blocked if required rights/review state is absent;
- every derived output can be traced to its source and transformations;
- tenant-scoped read/write policies and audit events are tested.

## 8. Non-goals and exclusions

- Do not import Postiz as a sub-application or copy its AGPL application code.
- Do not introduce Laravel/PHP solely to run Mixpost.
- Do not install Content Machine as an unrestricted server-side agent.
- Do not replace SocialOS authentication, tenancy, token storage or RLS with upstream equivalents.
- Do not claim any external component is integrated until a commit, test and runtime evidence exist.

## 9. Evidence links

- Postiz repository: https://github.com/gitroomhq/postiz-app
- Postiz post DTO: https://github.com/gitroomhq/postiz-app/blob/main/libraries/nestjs-libraries/src/dtos/posts/create.post.dto.ts
- Postiz provider example: https://github.com/gitroomhq/postiz-app/blob/main/libraries/nestjs-libraries/src/integrations/social/wordpress.provider.ts
- Mixpost repository: https://github.com/inovector/mixpost
- Mixpost provider contract: https://github.com/inovector/mixpost/blob/main/src/Contracts/SocialProvider.php
- Mixpost account publish action: https://github.com/inovector/mixpost/blob/main/src/Actions/AccountPublishPost.php
- Mixpost batch publish action: https://github.com/inovector/mixpost/blob/main/src/Actions/PublishPost.php
- Content Machine repository: https://github.com/45ck/content-machine
- Content Machine vendoring policy: https://github.com/45ck/content-machine/blob/master/VENDORING.md
- Content Machine long-form skill: https://github.com/45ck/content-machine/blob/master/skills/longform-to-shorts/SKILL.md
- Content Machine video render skill: https://github.com/45ck/content-machine/blob/master/skills/video-render/SKILL.md
- AGPLv3 section 13: https://opensource.org/license/agpl-3-0
- MIT licence: https://opensource.org/license/mit

## 10. Current implementation status

| Item | Status |
|---|---|
| Upstream repositories located | Research completed |
| Root licence files/package declarations inspected | Research completed |
| Representative implementation files inspected | Research completed |
| SocialOS reuse register committed | This document |
| Postiz code copied | No |
| Mixpost code copied | No |
| Content Machine package installed | No |
| SocialOS adapters implemented | No |
| Integration tests run | No |
| Runtime integration verified | No |

This document establishes the engineering plan and evidence baseline. It must be updated as each work package is implemented and tested.
