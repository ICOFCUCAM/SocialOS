# SocialOS YouTube Creator Tooling — Deep-Dive Repository Assessment

**Status:** Research supplement for Creator Studio roadmap  
**Research snapshot:** 2026-11-09  
**Target branch:** `docs/creator-studio-product-roadmap`  
**Purpose:** Extend the existing repository inventory with focused inspection of YouTube creator automation, transcript, repurposing, media-production and official API components.  
**Boundary:** Documentation only. No application code, migrations, secrets, production database or deployment changes.

## 1. Executive decision

Keep `Jakeschincariol/youtube-agent-skill` as a creator-intelligence workflow reference and selectively evaluate the following complementary projects:

1. `darkzOGx/youtube-automation-agent` — end-to-end approval-first agent workflow reference.
2. `mutonby/openshorts` — strongest candidate for a focused technical spike around long-form-to-Shorts discovery and rendering.
3. `jdepoix/youtube-transcript-api` — transcript ingestion reference, with a strict distinction between unofficial caption retrieval and official YouTube APIs.
4. `Huanshere/VideoLingo` — localization, subtitle alignment and dubbing reference.
5. `harry0703/MoneyPrinterTurbo` — automated short-video assembly workflow reference, not a default production dependency.
6. `fralapo/clippyme` — smaller MIT implementation worth architecture study, but not a production dependency until independently validated.
7. `yt-dlp/yt-dlp` — downloader ecosystem reference only; do not make unrestricted downloading or cookie/session-based extraction part of the hosted SocialOS product.

**Do not combine these projects into one runtime.** SocialOS should own the product, tenant model, OAuth, AI orchestration, media asset lineage, approvals, publisher queue, analytics and billing. Borrow only isolated algorithms or workflow ideas after file-level code, dependency, model and asset licence review.

## 2. Repository comparison

GitHub repository metadata snapshot (stars are a popularity signal, not a quality or security assessment):

| Repository | Stars (approx.) | Licence reported by GitHub | Main capability | SocialOS decision |
|---|---:|---|---|---|
| [youtube-agent-skill](https://github.com/Jakeschincariol/youtube-agent-skill) | — | MIT | Eleven creator workflows and six deterministic Python utilities | Adopt workflow concepts; selectively reuse tools after tests |
| [youtube-automation-agent](https://github.com/darkzOGx/youtube-automation-agent) | 5.1k | MIT | Research, script, narration, visuals, video assembly, approval, scheduling and analytics learning | Study orchestration, approval gates and evaluation loop; do not adopt as a second app |
| [openshorts](https://github.com/mutonby/openshorts) | 7.6k | MIT | Long-video clipping, AI moment detection, face tracking, captions, dubbing, MCP/API | Highest-priority candidate for a contained Shorts spike |
| [VideoLingo](https://github.com/Huanshere/VideoLingo) | 19.1k | Apache-2.0 | Subtitle segmentation, translation, alignment and dubbing | Study localization pipeline; audit model and asset licences |
| [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) | 8.6k | MIT | Retrieve manual and auto-generated captions | Optional ingestion adapter only; not a guaranteed or official API |
| [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | 141.6k | MIT | Topic-to-short-video generation with scripts, stock visuals, voice and subtitles | Study pipeline and UX; audit all external assets, models and providers |
| [clippyme](https://github.com/fralapo/clippyme) | 63 | MIT | Self-hosted clipping, speaker reframing, subtitles, browser editing and scheduling integrations | Architecture reference; small adoption signal means extra validation |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | 206.5k | Unlicense | Multi-site media extraction/download | Study only for authorised internal workflows; no unrestricted SaaS downloader |

Metadata is time-sensitive and should be refreshed before a procurement or legal decision. GitHub's repository licence field does not clear third-party models, bundled media, fonts, sample assets, hosted APIs or transitive dependencies.

## 3. Capability findings and integration boundaries

### 3.1 Creator intelligence and agent workflow

**YouTube Agent Skill** contributes:
- Script writing with five candidate hooks based on 21 formulas.
- Creator voice profile template.
- Title/thumbnail pairing lint.
- Transcript-to-edit decision list.
- Comment triage and reply drafting.
- Capacity-aware planning.
- Competitor outlier analysis using a channel-relative baseline.
- Retention export analysis.
- Shorts discovery, SEO, chapter generation and channel audit.
- Six small deterministic Python utilities.

Its own documentation correctly says the hook score is heuristic and not a predictor. Its viral-title classifier describes title wording, not proven causal reasons for views. Its workflow does not publish.

**youtube-automation-agent** is a useful end-to-end workflow comparator. Its public project description emphasises a human approval stage, content quality review, media-rights checks and learning from measured analytics. Study its task orchestration, state transitions, approval UX and evidence loop. Do not give an external agent direct access to SocialOS service-role credentials, tenant-wide data or publisher secrets.

**SocialOS implementation:** build provider-neutral, versioned task contracts. Examples: `research_topic`, `draft_script`, `score_hook`, `analyse_packaging`, `transcribe_asset`, `propose_clips`, `draft_reply`, `analyse_retention`. Persist model/provider, prompt version, source references, warnings, cost, output schema version and review status.

### 3.2 Shorts and media production

**OpenShorts** is the most directly relevant candidate for a focused engineering spike. Its public project description covers AI moment detection, 9:16 clip generation, face tracking, captions, dubbing and an MCP/API surface.

**ClippyMe** describes a similar workflow with active-speaker reframing, browser editing, subtitle styling, silence/filler removal and cross-platform scheduling. Treat it as a smaller codebase to learn from, not evidence that its quality or operational maturity is production-ready.

**MoneyPrinterTurbo** is a useful reference for an automated topic-to-video pipeline: script, narration, visuals, subtitles and assembly. Do not assume bundled stock-media sources, generated music, voices or model weights are commercially reusable merely because the repository is MIT.

**SocialOS implementation boundary:**
- Reuse existing private media ingestion and ClamAV scan gate.
- Reuse existing FFmpeg/ffprobe media worker, resource limits and private storage.
- Add transcript-aligned clip proposals and crop instructions as durable jobs.
- Render selected clips as derivatives linked to the original asset.
- Keep timeline/editor decisions separate from AI suggestions.
- Do not create another media queue, storage system or publishing scheduler.
- Never render or publish third-party source media without documented user authority and rights provenance.

A spike should compare OpenShorts against the existing SocialOS worker on a fixed test set: clip boundary accuracy, speaker framing, caption timing, output quality, processing time, CPU/GPU cost, recovery behaviour and license/dependency footprint. No code import until results are reviewed.

### 3.3 Transcript ingestion

**youtube-transcript-api** is MIT-licensed and can retrieve manual and automatically generated YouTube captions without an API key. This is not an official YouTube Data API guarantee. Availability can change, rate limiting or anti-automation measures can interrupt it, and it must not be represented as a supported source for every video.

Preferred source order:
1. User-uploaded or user-provided transcript.
2. Transcript from a media asset SocialOS is authorised to process.
3. Official/authorised provider export where available.
4. Optional adapter to a third-party caption retrieval library only after terms, reliability and policy review.

Persist source type, video ID, language, retrieval timestamp, attribution/provenance, processing status and rights/authorisation basis. Never store browser cookies or use logged-in user sessions as a commercial integration.

### 3.4 Localization and dubbing

**VideoLingo** is an Apache-2.0 reference for segmentation, translation, subtitle alignment and dubbing. It may help SocialOS add multilingual creator workflows, but the actual models, voices, translation APIs, fonts and media assets need separate licence and commercial-use review.

Recommended product sequence: transcript → translation draft → subtitle segmentation/alignment → human review → optional dubbed audio → render. Preserve original transcript and translation versions and never overwrite source audio.

## 4. Official YouTube API constraints

SocialOS already documents a YouTube publisher adapter and resumable upload path. Extend that implementation rather than adding a separate uploader.

- Google documents OAuth 2.0 for private channel data and write operations. API keys are for public-data access; they do not replace user OAuth. Use the least-privilege scopes needed for the requested action.
- YouTube Data API quota allocations and method costs are material product constraints. The current public documentation describes a default daily quota and separate search/upload buckets; quota allocation and costs can change. Build quota accounting, backoff and user-visible connection/permission states.
- YouTube Analytics API supports authorised channel-owner reports and targeted queries. Audience-retention reports expose segment-level measures such as `audienceWatchRatio`, `relativeRetentionPerformance`, `startedWatching` and `stoppedWatching` subject to supported report combinations and channel authorisation.
- Do not promise that every Studio chart/export is available through every API. Map each SocialOS metric to the exact API report or user-supplied export and record provenance.
- Upload and publish actions must pass through the existing publisher worker, provider capability validation, durable idempotency, retries and reconciliation.

Official references:
- [YouTube OAuth authorisation](https://developers.google.com/youtube/data/guides/authentication)
- [YouTube Data API overview and quota](https://developers.google.com/youtube/data/getting-started)
- [Video upload endpoint](https://developers.google.com/youtube/v3/docs/videos/insert)
- [YouTube Analytics APIs](https://developers.google.com/youtube/analytics)
- [Channel reports and audience retention](https://developers.google.com/youtube/analytics/channel_reports)

## 5. Fit with the existing SocialOS branch

The inspected `integration/socialos-feature-stack` documentation already defines:
- YouTube resumable upload through the publisher worker.
- Google OAuth token refresh and encrypted token storage.
- Durable publishing jobs, retry/reconciliation and reauthorization states.
- A separate media-processing worker with FFmpeg/ffprobe, ClamAV scanning, private storage and rendition generation.
- Existing content calendar, composer, account-specific versions and analytics foundations.
- A Creator Studio strategy and phased roadmap in the open draft PR.

Do not create a new YouTube publisher, media worker, token store, queue or calendar. The immediate engineering task remains Phase 0 verification: inspect actual code and migrations, confirm current adapter scopes and upload lifecycle, run local checks and compare migration state. Documentation describing a capability is not proof that it is deployed or tested against live accounts.

## 6. Recommended priority

| Priority | Work item | Rationale |
|---|---|---|
| P0 | Verify current YouTube OAuth, adapter, migrations and publisher in the integration branch | Prevent duplicate systems and discover existing gaps |
| P1 | YouTube channel connection + authorised metadata sync | Foundation for creator account context |
| P1 | Transcript ingestion and timestamped transcript model | Enables script, chapters, clip discovery and retention analysis |
| P1 | Creator Voice Memory and evidence/claim rules | Differentiates SocialOS and improves output consistency |
| P2 | Native AI script, hook, title/thumbnail and SEO workflows | Fastest user-visible value from YouTube Agent Skill |
| P2 | OpenShorts benchmark spike using a fixed authorised media set | Determine whether its clipping approach is worth adapting |
| P2 | Analytics and retention report mapping | Build evidence-led recommendations |
| P3 | Localization/dubbing benchmark using VideoLingo concepts | Valuable expansion after transcript foundation |
| P3 | Cross-platform repurposing and account-specific versions | Leverage existing composer and publisher |

## 7. Security, legal and quality gates

- MIT and Apache-2.0 permit broad reuse subject to their conditions, but preserve notices and inspect every copied file and dependency.
- Treat AGPL projects as study-only unless a legal review approves the intended use and distribution model.
- Maintain a third-party component register: repository URL, immutable commit SHA, copied paths, licence, dependency/model/asset licences, modifications, notices, reviewer and date.
- No private YouTube endpoints, cookies, credential sharing or unrestricted downloading.
- All source media must have an authorisation/rights record before processing or redistribution.
- Imported transcripts, comments, descriptions and documents are untrusted content; they must never override system instructions or tool permissions.
- AI outputs and scores are recommendations, not facts. Attach evidence, confidence and caveats.
- Human review is required before public uploads, comments, metadata changes or other externally visible actions.
- No production migrations or deployments as part of this research update.

## 8. Research references

- https://github.com/Jakeschincariol/youtube-agent-skill
- https://github.com/darkzOGx/youtube-automation-agent
- https://github.com/mutonby/openshorts
- https://github.com/Huanshere/VideoLingo
- https://github.com/jdepoix/youtube-transcript-api
- https://github.com/harry0703/MoneyPrinterTurbo
- https://github.com/fralapo/clippyme
- https://github.com/yt-dlp/yt-dlp

**Final recommendation:** Adopt the YouTube Agent Skill's creator workflows as SocialOS-native AI tasks; benchmark OpenShorts for Shorts production; use the transcript and localization projects as optional, replaceable adapters; and keep all publishing, security, tenancy, media storage and analytics ownership inside SocialOS.
