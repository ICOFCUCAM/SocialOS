# SocialOS Creator Studio — Product Strategy and Delivery Roadmap

**Status:** Proposed product and engineering roadmap
**Research inputs:** `docs/research/social-media-youtube-github-repository-audit.md`
**Scope:** Convert the repository research into a coherent SocialOS product capability without importing competing schedulers or duplicating core infrastructure.

## 1. Product decision

Build Creator Studio as a first-class capability inside SocialOS. Do not build a separate YouTube scheduler, downloader or standalone AI chatbot. Creator Studio should connect research, planning, creation, media production, approval, publishing and measurement to the existing SocialOS brand, workspace, campaign, composer, media-processing, provider-adapter and durable publishing systems.

Product promise: **Create once. Adapt intelligently. Approve confidently. Publish everywhere. Learn from performance.**

Primary customers:
- Creators and creator-led businesses managing their own channels.
- Agencies managing multiple brands and client accounts.
- Marketing teams coordinating campaigns across multiple social networks.

## 2. Product capability model

Creator Studio is organised into seven connected capabilities:

1. **Creator and Brand Intelligence** — voice profiles, audience, positioning, content pillars, approved facts, claims to avoid, source material and channel context.
2. **Research and Planning** — public niche research, competitor outlier analysis, campaign briefs, capacity-aware calendars and content opportunities.
3. **AI Creation Studio** — scripts, hooks, captions, platform variants, title/thumbnail concepts, descriptions, chapters and campaign copy.
4. **Media Production Studio** — uploads, transcript generation, edit decision lists, clip discovery, vertical reframing, subtitles, thumbnails, render jobs and reusable media assets.
5. **Review and Collaboration** — drafts, comments, approvals, revision history, role-aware review and explicit approval gates.
6. **Publishing and Distribution** — account-specific versions, provider capability checks, scheduling, durable publishing, retry/reconciliation and delivery status.
7. **Performance Intelligence** — channel and campaign analytics, retention analysis, packaging comparisons, recommendations and feedback into future content.

These capabilities should share one content and media model. They must not become isolated mini-applications with their own account connections, queues or publishing state.

## 3. What to adopt from the research

| Research source | Adopt as a product/engineering idea | Do not adopt blindly |
|---|---|---|
| Postiz | API/SDK ecosystem, provider integration boundaries, automation surfaces | Its scheduler or AGPL implementation as a replacement for SocialOS |
| Mixpost | Media organisation, account-specific versions, queue and workspace concepts | A second queue or Laravel subsystem |
| Postmill AI | Integrated creative tools, analytics and engagement experience | A second backend or AGPL code without legal review |
| TryPost | MCP/agent operations with permission and approval boundaries | Agent access that bypasses SocialOS authorization |
| BrightBean Studio | Agency workspace and client-account workflows | A parallel multi-tenant model |
| YouTube Agent Skill | Eleven creator workflows, six deterministic utilities, creator voice profile, transcript-led intelligence | Claude-specific skill files as a production runtime or its manual publishing flow as the SocialOS publisher |
| Tube Archivist | Channel/media metadata and authorised archive research | An unrestricted downloader inside the SaaS |
| YouTube Transcript API | Transcript-driven content intelligence where permitted | Uncontrolled transcript extraction as a guaranteed API |
| yt-dlp / MeTube | Ingestion UX and authorised internal media processing references | Cookie/session/private-API access or rights circumvention |
| MoneyPrinterTurbo and clipping projects | Media assembly and long-to-short workflow ideas | Unreviewed third-party media pipelines or model licences |
| Open-Dispatch | Provider adapter and dispatch abstraction patterns | Another publish queue |

### Licensing policy

- Treat AGPL projects as study-only unless legal counsel approves a specific reuse and distribution model.
- MIT projects such as Mixpost and YouTube Agent Skill are candidates for selective reuse after file-level, dependency and asset licence review; preserve notices.
- Keep a third-party component register with repository, commit SHA, files used, licence, notices, modifications, owner and review date.
- Never infer that a project's licence authorises use of platform data, copyrighted media, scraping or private endpoints.

## 4. Existing SocialOS foundations to extend

The feature-stack branch already documents or contains the foundations below. Creator Studio should extend them rather than recreate them:

- Multi-tenant workspace, brand and role model with Supabase RLS.
- Brand identity and existing `brands.brand_settings` as the initial voice/context source.
- AI Content Studio with human-reviewed generation and composer handoff.
- Campaigns and campaign-to-post relationships.
- Content calendar and multi-channel composer.
- Private media ingestion, malware scanning, media processing and platform rendition profiles.
- OAuth account connections and provider publishing adapters for currently supported platforms.
- Durable publishing jobs, retry/reconciliation and publishing operations.
- Analytics collection and reporting foundations.

Important implementation boundary: the feature-stack integration branch is a development integration line, not proof that all its migrations are deployed to the hosted Supabase project. Validate the branch, migration chain and live database independently before rollout.

## 5. Target architecture

### 5.1 Core domain records

Introduce new records only where the existing schema cannot represent the domain. Candidate domain objects (names are conceptual until schema review):

- `creator_voice_profiles`: workspace/brand/creator-scoped, versioned voice guidance, audience, style, forbidden language, evidence rules and source references.
- `creator_sources`: authorised source assets, channel/video references, ownership/rights declaration, source metadata and provenance.
- `media_transcripts`: transcript metadata, language, provider/source, processing state and timestamps.
- `media_transcript_segments`: ordered text segments with start/end timestamps and speaker metadata where available.
- `creator_ai_runs`: task type, input references, model/provider, prompt version, structured output, usage, status and audit metadata.
- `content_analysis_reports`: retention, packaging, channel audit and competitor research results with source timestamps and confidence/heuristic labels.
- `media_clip_candidates`: source asset, transcript time range, proposed hook, rationale, score explanation, crop instructions and review state.
- `content_approvals` or an extension of an existing approval domain: reviewer, decision, revision, timestamps and audit events.

Do not create all these tables automatically. First inspect the current branch schema and identify which concepts can be represented by existing `brands`, `social_posts`, `social_post_versions`, media assets, campaigns, analytics and audit structures. Any new table must have explicit organisation/brand ownership, RLS, least-privilege grants, indexes, retention rules and tests.

### 5.2 Service boundaries

- **Web/API layer:** authenticated user actions, input validation, workspace/brand authorisation and request creation.
- **AI orchestration:** bounded task contracts for script, packaging, comment triage, planning, SEO, chapters, channel audit and analysis. No direct publishing credentials or arbitrary tenant access in model prompts.
- **Media worker:** malware scanning, probing, transcription orchestration, clip preparation, FFmpeg rendering, subtitles, thumbnails and rendition generation. Keep untrusted media processing isolated.
- **Publisher worker:** remains the sole system responsible for provider delivery, token handling, idempotency, retries and reconciliation.
- **Analytics ingestion:** official provider APIs and authorised exports, with provenance, time windows and refresh status.
- **Storage:** private tenant/brand/asset paths; signed access; lifecycle and retention controls.
- **Audit and usage:** record AI actions, approval decisions, provider delivery, cost/usage and administrative changes.

### 5.3 AI output contract

Every AI task should return a versioned, validated structured result rather than free-form text alone. Include task type, source references, output fields, warnings, missing evidence, heuristic scores with explanations, model/prompt version and human-review state. Scores must be labelled as estimates, never guaranteed performance predictions.

Treat source transcripts, comments, imported descriptions and brand documents as untrusted reference data. They must not override system policy, authorization or tool permissions. Do not expose OAuth tokens or service credentials to models.

## 6. YouTube Creator Studio workflow

1. User connects an eligible YouTube channel through SocialOS OAuth and grants only the required scopes.
2. SocialOS imports permitted channel/video metadata using official APIs and records source/provenance.
3. User selects an owned or authorised video/media asset, or supplies an authorised transcript.
4. Transcript processing creates timestamped segments and records language, source, processing state and provenance.
5. Creator Voice Memory applies the selected brand/creator profile and approved facts.
6. Research and AI tools generate scripts, hooks, titles, thumbnail briefs, descriptions, chapters, comment reply drafts and channel recommendations.
7. Shorts discovery proposes timestamped, self-contained segments with new hooks and vertical crop guidance.
8. User reviews candidate clips; media worker renders only after selection/authorization.
9. SocialOS creates platform/account-specific content versions and validates provider capabilities and media constraints.
10. Team review and approval occur before scheduling or publishing.
11. The existing publisher worker delivers the approved content and records provider outcomes.
12. Analytics and authorised retention data inform future recommendations.

Publishing, comment replies and public metadata changes must remain explicit user-authorised actions, subject to workspace roles and approval policy.

## 7. Phased delivery plan

### Phase 0 — Foundation verification

Objective: ensure the existing integration branch is a reliable base.
- Reconcile the feature branches into a known integration baseline and document branch/PR status.
- Validate migrations in order in a clean local PostgreSQL/Supabase environment.
- Compare migration history and schema against the hosted project; do not apply migrations to production as part of this phase.
- Run application checks, worker tests, type checks, lint and build; record failures and known gaps.
- Verify current YouTube adapter scopes, upload lifecycle, resumable upload handling, token refresh and provider capability checks.
- Confirm media worker isolation, file limits, malware scanning, storage paths and lifecycle policies.
**Exit criteria:** reproducible local setup, migration validation report, passing required checks or a prioritised defect list, no unreviewed production schema changes.

### Phase 1 — YouTube account and source foundation

Objective: give a workspace a safe, official connection to YouTube and a reliable source library.
- Verify OAuth consent and least-privilege scopes.
- Import channel identity and permitted video metadata.
- Add channel/source sync status, pagination, rate-limit handling and disconnect/revocation lifecycle.
- Support user-uploaded or otherwise authorised source media.
- Record source ownership/rights declaration and provenance.
**Exit criteria:** account lifecycle and metadata sync tested against a controlled test channel; tenant isolation and token protection verified.

### Phase 2 — Transcript and Creator Voice Memory

Objective: create reusable intelligence context.
- Design versioned voice profiles scoped to workspace/brand/creator.
- Allow users to define audience, tone, phrases to use/avoid, approved facts and claims that require evidence.
- Add transcript ingestion from authorised uploads and supported sources.
- Store timestamped segments, language, provenance and processing status.
- Add transcript search and reuse across chapters, edit decisions, retention and Shorts.
**Exit criteria:** transcript jobs are recoverable; profile access is tenant-safe; outputs cite source segments where possible.

### Phase 3 — AI Creator Intelligence

Objective: translate the eleven YouTube Agent Skill workflows into SocialOS-native tasks.
- Script and hook generation.
- Title/thumbnail pair analysis.
- SEO description and chapter generation.
- Comment classification and reply drafts.
- Capacity-aware planning.
- Public niche/outlier research with source dates and transparent calculations.
- Channel audit and prioritised recommendations.
- Retention analysis using authorised analytics exports/data.
**Exit criteria:** schema-validated outputs, prompt/model versioning, usage accounting, evaluation fixtures, explicit human review and no autonomous publishing.

### Phase 4 — Repurposing and media production

Objective: convert approved long-form material into reusable platform assets.
- Transcript-based candidate clip discovery.
- New standalone hooks and on-screen text suggestions.
- Vertical crop/reframe previews and editor decision lists.
- Subtitle generation and thumbnail preparation.
- Queue render jobs through the existing isolated media worker.
- Store derivatives in the existing private media library and preserve source-to-derivative lineage.
**Exit criteria:** media fixtures, resource limits, malware gates, worker recovery, render QA and user approval before publication.

### Phase 5 — Cross-platform campaign distribution

Objective: adapt one source into a coherent campaign.
- Create account-specific versions using existing post-version concepts.
- Validate each provider's supported formats, media limits and metadata.
- Connect generated assets to campaign and calendar workflows.
- Add review/approval and revision history.
- Deliver through the existing durable publisher; do not create a parallel scheduler.
**Exit criteria:** provider integration tests, duplicate prevention, reconciliation path, approval enforcement and end-to-end staging tests.

### Phase 6 — Performance feedback and commercial readiness

Objective: turn analytics into useful recommendations and a viable paid product.
- Collect official channel/post metrics with provenance and freshness.
- Compare performance to the creator's own historical baseline.
- Join retention observations to transcript moments where supported.
- Measure AI and media-processing usage by workspace and feature.
- Add plan entitlements, rate limits, spend ceilings, quotas and overage rules.
- Add retention/deletion controls for source media, transcripts and derived assets.
- Add operational dashboards for job latency, failures, provider errors, model spend and media costs.
**Exit criteria:** measurable unit economics, cost guardrails, data lifecycle controls, support runbooks and reliable production monitoring.

## 8. Prioritisation and product sequencing

Recommended initial release slice:

1. Official YouTube channel connection and metadata.
2. Authorised transcript ingestion and timestamped transcript storage.
3. Editable Creator Voice Memory.
4. AI scripts, hooks, titles and descriptions.
5. Transcript-based Shorts candidate discovery (recommendations first; rendering later).
6. Handoff to the existing composer and publishing flow.

This slice is strategically strong because it creates a complete, visible creator workflow without requiring a new rendering engine, new scheduler or a large number of new platform integrations at once. It also creates the foundation for deeper video production and cross-channel distribution.

Do not begin by implementing all eleven skills and all media processing features simultaneously. Establish data contracts, security and evaluation first, then deliver vertical slices.

## 9. Commercial packaging hypotheses

Potential paid value drivers to test with customers:
- Creator/brand voice profiles and reusable brand context.
- AI generation volume and advanced creator workflows.
- Transcript hours and media processing/render minutes.
- Number of connected channels, brands, workspaces and team seats.
- Approval workflows, client portals and campaign reporting.
- Advanced analytics, retention analysis and competitor intelligence.

Do not set final prices from competitor feature counts alone. Measure AI token costs, transcription cost, storage, media CPU/GPU time, egress, provider constraints and support burden. Apply usage quotas and spend limits before opening expensive workflows broadly.

## 10. Decisions and non-goals

Decisions:
- Creator Studio is a first-class SocialOS module, not a separate SaaS product.
- YouTube is the first deep creator workflow, not the only supported platform.
- SocialOS owns OAuth, tenant isolation, media library, AI orchestration, approval, scheduling, publishing and analytics.
- External repositories are research references; MIT code reuse requires notices and review, AGPL code requires legal approval.
- Human approval remains mandatory for public actions unless a workspace owner explicitly configures an authorised automation policy.

Non-goals:
- Replacing SocialOS's publishing queue with Postiz, Mixpost or Open-Dispatch.
- Building an unrestricted YouTube downloader.
- Using cookies, private endpoints or browser-session automation as commercial provider integrations.
- Treating hook scores, virality multiples or retention heuristics as guarantees.
- Automatically publishing, commenting or changing public metadata from an AI generation response.
- Deploying schema migrations to the hosted database without a separate, explicit release approval.

## 11. Next engineering work

Start with Phase 0 verification and a YouTube vertical-slice technical design. Before adding schema, inspect existing tables and migrations on the intended integration branch, map current YouTube adapter and OAuth scopes, and establish which analytics and retention data are available through official APIs versus user-exported files. Then implement the smallest end-to-end increment behind tests and feature controls.

## 12. Research provenance

Primary repository inventory and detailed notes: `docs/research/social-media-youtube-github-repository-audit.md`.

Key direct references:
- https://github.com/gitroomhq/postiz-app
- https://github.com/inovector/mixpost
- https://github.com/postmill-ai/postmill-app
- https://github.com/trypostit/trypost
- https://github.com/brightbeanxyz/brightbean-studio
- https://github.com/Jakeschincariol/youtube-agent-skill
- https://github.com/TubeArchivist/TubeArchivist
- https://github.com/jdepoix/youtube-transcript-api
- https://github.com/yt-dlp/yt-dlp
- https://github.com/Matthew-Selvam/Open-Dispatch