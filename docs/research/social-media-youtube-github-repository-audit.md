# SocialOS — Social Media and YouTube GitHub Repository Research

**Research date:** 9 November 2026
**Purpose:** Identify public software and technical ideas relevant to SocialOS. This is a research and architecture reference, not approval to copy or deploy third-party code.

## 1. Scope and SocialOS principles

This research covers public GitHub repositories related to social media management, publishing and scheduling, YouTube creator operations, video ingestion, transcripts, editing assistance, Shorts repurposing, analytics and AI-agent workflows.

SocialOS is an AI-powered social media operating system for brand management, content creation, video production, publishing, analytics and multi-tenant SaaS. Preserve SocialOS's own product architecture, tenant boundaries, data model, authentication, RLS, auditability and durable publishing system. External repositories are references, not replacements for SocialOS's core platform.

Repository descriptions and feature lists below are based on public documentation and selected manifest/licence inspection. Maintainer claims should be verified against implementation, tests, API availability and maintenance before adoption.

## 2. Social media management and scheduling repositories

### 2.1 Postiz
- Repository: https://github.com/gitroomhq/postiz-app
- Documentation: https://docs.postiz.com
- Licence: AGPL-3.0.
- Stack evidence: TypeScript monorepo, pnpm; distinct frontend, backend, orchestrator and extension applications; package manifest specifies Node 22.23.4.
- README scope: multi-network management, scheduling, automation and analytics; public API, Node SDK, n8n node and Make integration. Listed networks include Instagram, YouTube, Dribbble, LinkedIn, Reddit, TikTok, Facebook, Pinterest, Threads, X, Slack, Discord, Mastodon and Bluesky.
- SocialOS learning: provider integration boundaries, API/SDK design, integration ecosystem, automation and exposing controlled publishing capabilities to AI agents.
- Licence note: AGPL-3.0 has network-use source-sharing implications for modified versions. Do not copy code into proprietary SocialOS without legal review.

### 2.2 Mixpost
- Repository: https://github.com/inovector/mixpost
- Composer manifest: https://github.com/inovector/mixpost/blob/main/composer.json
- Licence: MIT (verified in LICENSE.md and composer.json).
- Stack evidence: PHP 8.2+, Laravel ecosystem, Inertia, Horizon queues, Guzzle, FFmpeg integration, Pest tests and PHPStan.
- README feature areas: social account management, analytics, post versions and conditions, media library, team collaboration, workspaces, queue and calendar management.
- SocialOS learning: account-specific post variants, media-library organisation, scheduling queues, team permissions and workflow design.
- Reuse position: MIT is comparatively permissive; retain required notices and audit dependencies and specific files before reuse.

### 2.3 Postmill AI
- Repository: https://github.com/postmill-ai/postmill-app
- Documentation: https://docs.postmill.ai
- Licence: AGPL-3.0.
- Stack evidence: TypeScript/pnpm monorepo, frontend and backend applications, Prisma, Node engine >=24 and <25.
- README describes an AI-native self-hostable social scheduler for agencies and multi-brand teams, 45+ channels, 46 built-in media tools, bring-your-own-key AI across multiple providers, publishing calendar, design tools, analytics and engagement inbox.
- SocialOS learning: unify visual design, content creation, multi-channel publishing, analytics and engagement in a single workspace.
- Licence note: AGPL-3.0; use as a product and architecture reference unless legal review authorises code reuse.

### 2.4 TryPost
- Repository: https://github.com/trypostit/trypost
- Documentation: https://docs.trypost.it
- Licence: AGPL-3.0-only (verified from LICENSE.md and composer.json).
- Stack evidence: PHP/Laravel, Laravel MCP, Horizon, Passport, Socialite, Redis/Predis, S3-compatible storage and platform provider packages.
- README describes an MCP server with 80+ tools, REST API, AI-agent integration, adaptive composer, calendar and queues, approvals, workspaces and analytics.
- SocialOS learning: agent-accessible operations, the rule that agent actions and human actions should share permissions and approval checks, and MCP alongside REST APIs.
- Licence note: AGPL-3.0-only; do not transplant code into proprietary SocialOS without legal review.

### 2.5 BrightBean Studio
- Repository: https://github.com/brightbeanxyz/brightbean-studio
- Licence: AGPL-3.0 (README badge; inspect actual licence file before reuse).
- Stack evidence: Python 3.12+, Django 5.x.
- README describes an open-source, self-hostable platform for creators, agencies and SMBs, multi-workspace teams, approvals, scheduling, monitoring and posting across Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky, Google Business Profile, Mastodon and DEV.to.
- It states that integrations use official first-party APIs with the operator's developer credentials.
- SocialOS learning: agency workflows, multi-workspace operations, customer-owned provider credentials and first-party API integration.
- Licence note: AGPL-3.0; use as a reference unless legal review authorises reuse.

### 2.6 Other cross-posting and publishing infrastructure
- Open-Dispatch: https://github.com/Matthew-Selvam/Open-Dispatch — Python-based multi-network dispatch abstraction; investigate as a reference for provider orchestration, idempotency and consistent publishing results.
- Crossposter: https://github.com/apoorvdarshan/crossposter — local/self-hosted cross-posting and scheduling reference. Its README warns that some platform integrations may rely on cookies, local sessions, private APIs or third-party tools. Do not use these techniques for commercial SocialOS integrations; require official, authorised APIs.
- OpenPost: https://github.com/clawnify/OpenPost — additional open-source social publishing candidate; verify maintenance, licence and architecture before relying on it.
- PostSider: https://github.com/lumizone/postsider — additional social publishing candidate; verify maintenance, licence and architecture before relying on it.
- LateWiz: https://www.latewiz.com/ — cross-platform publishing service reference, including YouTube among its advertised channels. This is a product reference, not a confirmed reusable GitHub codebase.

## 3. YouTube creator, media and channel tooling

### 3.1 Tube Archivist
- Repository: https://github.com/TubeArchivist/TubeArchivist
- Purpose described in project documentation: channel subscriptions, video archiving, metadata indexing/search and local video library workflows.
- SocialOS applications: creator-channel monitoring, authorised video-library organisation, metadata search and channel research.
- Boundary: archival/download workflows are not equivalent to official channel publishing or analytics APIs. Respect permissions, copyright and platform terms.

### 3.2 MeTube
- Repository: https://github.com/alexta69/metube
- Purpose: self-hosted web interface around yt-dlp, with video/audio/subtitle/thumbnail/playlist/channel download workflows.
- SocialOS applications: reference for a media-ingestion interface and job-progress UX.
- Boundary: do not assume a downloaded video may be republished or repurposed. Require rights and user authorisation.

### 3.3 YoutubeDL-Material
- Repository: https://github.com/Tzahi12345/YoutubeDL-Material
- Purpose: web interface and media-library workflow around youtube-dl/yt-dlp style tools.
- SocialOS applications: historical reference for self-hosted media-download and library UX.
- Maintenance and security posture should be checked before use.

### 3.4 yt-dlp
- Repository: https://github.com/yt-dlp/yt-dlp
- Purpose: command-line media extractor/downloader for YouTube and numerous other sites.
- SocialOS applications: authorised ingestion and internal processing only where permitted.
- Do not use it to bypass platform restrictions, access controls or rights. For publishing, account management and analytics prefer official platform APIs.

### 3.5 YouTube Transcript API
- Repository: https://github.com/jdepoix/youtube-transcript-api
- Purpose: access YouTube subtitle/transcript text, including timestamped snippets and available manual or automatically generated captions and translations.
- SocialOS applications: transcript retrieval, chapter drafting, video search, repurposing, summaries and content intelligence.
- Verify current YouTube behaviour, rate limits, language availability and terms before production use.

### 3.6 ytarchive
- Repository: https://github.com/Kethsar/ytarchive
- Purpose: livestream archiving.
- SocialOS applications: research reference for authorised live-event archive workflows.
- External media tooling such as FFmpeg and YouTube-specific access requirements may apply; verify current compatibility and legal permissions.

## 4. YouTube AI video creation and repurposing projects

- MoneyPrinterTurbo: https://github.com/rioryugen/MoneyPrinterTurbo — automated video creation from text and media assets. Study end-to-end generation, asset selection and assembly.
- AI Clipping Generator: https://github.com/SamurAIGPT/ai-clipping-generator — long-form to short-form video clipping. Study candidate clip selection, captions and output generation.
- Open Shorts Clipping: https://github.com/csentropy/open-shorts-clipping — short-video clipping workflows; compare selection, editing and export.
- YouTube MCP Server: https://github.com/ZubeidHendricks/youtube-mcp-server — candidate YouTube tool interface for AI agents. Repository identity and current status must be re-verified before use.
- Easy Uploader: https://github.com/wanghaisheng/easy-uploader — candidate upload automation project. Verify API behaviour, platform permissions and maintenance before use.

## 5. YouTube Agent Skill — detailed repository assessment

### Repository identity
- Name: YouTube Agent Skill.
- Repository: https://github.com/Jakeschincariol/youtube-agent-skill
- Owner: Jakeschincariol; default branch: main.
- Public repository; not archived at inspection.
- Licence: MIT, verified at https://github.com/Jakeschincariol/youtube-agent-skill/blob/main/LICENSE.
- README: https://github.com/Jakeschincariol/youtube-agent-skill/blob/main/README.md.
- The repository contains 11 Claude skills, six standalone Python utilities and a creator voice-profile template.
- README says the Python utilities run on clean Python 3 without external dependencies.

### What makes this project different

This is not a conventional social media scheduler and not a YouTube upload client. It is a set of specialist creator workflows for researching, scripting, packaging, editing, analysing and planning a YouTube channel. Its defining design rule is human approval: the skills generate recommendations and copy, but nothing gets published automatically. The README explicitly says YouTube Data API publishing could be built with OAuth but is not implemented here.

It is relevant to SocialOS because its creator functions could become AI-assisted production services in SocialOS Creator Studio, while SocialOS retains account connection, tenancy, publishing, scheduling, audit and analytics infrastructure.

### The eleven skills

1. **/yt-script — Script writing and hook scoring.** Turns an idea into a spoken YouTube script. Generates five alternative hooks using 21 hook formulas. Runs candidates through a hook-scoring utility, presents the strongest options and marks retention beats. Includes opening, body, payoff and close; on-screen visual cues for every beat; and runtime estimate using 150 words per minute. Avoids inventing statistics, results or sources. The repository notes hook scoring is heuristic, not predictive; it was calibrated against 74 real short-form hooks and distinguishes deliberately weak hooks from stronger ones better than it distinguishes an individual creator's hits from misses.
2. **/yt-package — Title and thumbnail pairing.** Treats title and thumbnail as one combined packaging decision. Generates title candidates and checks truncation, duplication and vagueness. Reports desktop/mobile title-length considerations. Avoids repeating the title in the thumbnail and recommends short thumbnail copy. Produces a thumbnail brief describing expression, framing, words and background contrast. A Python utility lints title/thumbnail combinations.
3. **/yt-edit — Transcript-to-edit decision list.** Converts a timestamped transcript into an edit decision list. Identifies long pauses/dead air, filler-only cues and repeated/restarted sentences. Supports SRT, VTT and Whisper JSON according to the skill instructions. Provides timecodes and trimming guidance. It does not modify video media itself and warns that speech-derived cut percentages may be misleading when footage includes silent demonstrations or visual sequences.
4. **/yt-comment — Comment triage and reply drafting.** Sorts comments into questions, corrections, praise and bait. Drafts short replies in the creator's voice. Highlights recurring questions as future video topics. Recommends one comment to pin and explains why. Does not publish replies automatically.
5. **/yt-plan — Weekly or monthly publishing plan.** Builds a schedule based on the creator's actual available hours and work already in progress. Recommends an anchor video, a low-effort supporting video and Shorts derived from the anchor. Uses the channel's own analytics to identify suitable publishing days rather than assuming a generic best day. Explicitly accounts for workload and what should be dropped if the week becomes difficult.
6. **/yt-viral — Niche and outlier research.** Compares public videos in a creator's niche. Ranks performance using each channel's own median rather than raw views alone. Requires at least four videos per channel for a meaningful median. Classifies visible title formulas but distinguishes title analysis from causal claims about why a video succeeded. Skill instructions say it reads public listings only and does not log in to creator accounts or use credentials.
7. **/yt-retention — Audience-retention analysis.** Reads a YouTube Studio audience-retention CSV export. Identifies early hook leakage, sharp retention cliffs and gradual audience decline. Can compare retention changes to a supplied transcript and identify what was being said when viewers left. Produces a priority improvement rather than an undifferentiated list. Thresholds and diagnostic heuristics should be independently validated before presenting them as universal rules.
8. **/yt-shorts — Long-form-to-Shorts discovery.** Finds self-contained moments in a long-video transcript, generally around 20–55 seconds. Ranks candidate segments and supplies timestamps and opening lines. Writes a new first line for viewers without the context of the full video. Adds first-two-second on-screen text, a loop point and vertical reframing notes. Uses the hook-scoring utility as a supporting check. It selects and describes candidate moments; it does not render or publish media.
9. **/yt-seo — Search-facing metadata.** Writes descriptions, tags and search-oriented copy. Prioritises the first two description lines. Generates three target search queries and checks the title and description against them. Treats tags as a weak signal and uses them mainly for spelling variants, product names and disambiguation. Avoids keyword stuffing and unrelated tags.
10. **/yt-chapters — Transcript-based chapters.** Generates chapter boundaries from transcript timing and topic changes. Validates chapter constraints stated by the skill: first chapter at 00:00, at least three chapters and each at least 10 seconds. Suggests retitling generated topic labels into useful section promises. Provides a Python validation utility.
11. **/yt-audit — Channel audit.** Reviews recent titles as a set, thumbnail readability, recent video openings, upload consistency and available retention data. Uses title-linter and hook-scoring utilities where appropriate. Outputs the single highest-priority fix, three specific things already working and what not to change yet. It avoids overwhelming the creator with twenty generic problems.

### The six Python utilities

The README identifies six standalone utilities, described as dependency-free on clean Python 3:

1. **hookscore.py** — `skills/yt-script/hookscore.py`: scores YouTube opening hooks against five properties. Example: `python3 skills/yt-script/hookscore.py --hook "one line"`. Uses formula data from `skills/yt-script/hooks.json`.
2. **title.py** — `skills/yt-package/title.py`: lints title and thumbnail copy together. Example: `python3 skills/yt-package/title.py --title "..." --thumb "AI RAN IT"`.
3. **deadair.py** — `skills/yt-edit/deadair.py`: parses transcript and generates an edit decision list. Example: `python3 skills/yt-edit/deadair.py transcript.srt`.
4. **chapters.py** — `skills/yt-chapters/chapters.py`: creates and validates YouTube chapter timestamps. Example: `python3 skills/yt-chapters/chapters.py transcript.srt`.
5. **retention.py** — `skills/yt-retention/retention.py`: analyses a YouTube retention CSV, optionally alongside a transcript. Example: `python3 skills/yt-retention/retention.py retention.csv --transcript transcript.srt`.
6. **swipe.py** — `skills/yt-viral/swipe.py`: ranks video outliers against each channel's own median. Example: `python3 skills/yt-viral/swipe.py collected.json --min 2.0`.

### Creator voice profile

The repository includes `templates/voice.md`, a reusable voice-profile template intended to be copied to `~/.claude/youtube/voice.md`.

It captures who the creator is addressing; how the creator actually speaks using transcripts; words and expressions the creator does not use; words and phrases the creator does use; claims, numbers and results the creator refuses to make without evidence; and format choices such as length, opening style, intro, language, on-camera presence and production context.

Every skill that generates spoken or creator-facing copy is instructed to read this profile. If it is missing, the instructions ask for three of the creator's own videos to infer the voice. For SocialOS this is a valuable pattern: a persistent per-creator/per-brand voice profile could be used across scripts, captions, comments, thumbnails and platform-specific content versions.

### Installation and usage model

The README gives three Claude-oriented installation approaches: clone the repository and copy `skills/yt-*` into `~/.claude/skills/`; install it through the Claude plugin marketplace; or copy the skill directories into a project's `.claude/skills/` directory. It also says an individual SKILL.md can be pasted into a chat as a mode, but this loses the six Python utilities. These are Claude skill instructions; SocialOS should not assume they are drop-in code for its own runtime. Translate the workflows into SocialOS's own AI orchestration and service interfaces.

### What the repository explicitly does not do

- It does not upload or publish YouTube videos.
- It does not connect to the creator's YouTube account.
- It does not implement YouTube Data API OAuth publishing.
- Its normal completion point is content and an approval question; the creator copies the result and performs the publishing action.
- It does not directly perform video-media editing in /yt-edit; it outputs editing decisions.
- The /yt-shorts skill finds and scripts short-form segments; it does not claim to render those segments.
- /yt-viral works from public listings and does not use logged-in sessions or creator credentials.

This distinction is essential. SocialOS should integrate the intelligence functions with its own authorised account connection, media pipeline, approval workflow and durable publishing services.

### Licence and reuse position

The repository is MIT-licensed. The inspected LICENSE file is the standard MIT grant and requires preservation of the copyright and permission notice in copies or substantial portions. This is more permissive than the AGPL-licensed social platforms listed elsewhere in this document.

Before any direct reuse: preserve the MIT copyright and licence notice; audit dependencies, datasets, hook formulas, example assets and third-party material separately; inspect Python utilities for input handling, correctness, runtime limits and test coverage; do not assume a permissive licence permits platform scraping or unauthorised content use; treat performance scoring and retention rules as heuristics until validated against SocialOS evidence.

### SocialOS feature mapping

| YouTube Agent Skill capability | SocialOS module | Proposed implementation |
|---|---|---|
| Script generation and hook formulas | AI Script Studio | Generate multiple hooks, evidence-aware scripts, retention beats and on-screen directions |
| Title/thumbnail linter | Packaging Studio | Score and compare title-thumbnail pairs, preview truncation and test variants |
| Transcript edit decision list | Transcript Editor / Edit Assistant | Generate timecoded edit decisions from SRT/VTT/Whisper output; connect to actual media timeline |
| Comment triage | Engagement Inbox | Categorise comments, draft replies, detect recurring questions and route replies through approval |
| Weekly content plan | Content Calendar / Campaign Planner | Schedule against actual team capacity, existing assets and channel analytics |
| Public niche research | Trend and Competitor Intelligence | Collect authorised public metadata and compare each channel against its own baseline |
| Retention analysis | YouTube Analytics Intelligence | Import authorised retention exports or official analytics data and map drops to transcript moments |
| Shorts discovery | Repurposing Studio | Identify candidate segments, write standalone hooks, create vertical crop guidance and render through SocialOS media workers |
| SEO metadata | Publishing Metadata Assistant | Generate descriptions, chapters, limited relevant tags and query-targeted copy |
| Chapter generation | Video Metadata Studio | Derive and validate chapter timestamps and editable labels |
| Channel audit | Channel Health / AI Recommendations | Combine packaging, content rhythm, openings and retention into prioritised actions |
| Voice profile | Brand and Creator Voice Memory | Store creator-specific language, audience, forbidden phrases and evidence/claim boundaries |

### Recommended engineering adaptation

Do not copy the Claude-specific skill directory directly into the SocialOS frontend or worker. Translate each skill into a bounded capability with explicit inputs, outputs, data permissions and approval points.

- **Creator profile and voice memory:** store versioned creator voice profiles under correct workspace/brand/creator ownership. Support user editing, source-video references and audit history.
- **Transcript service:** accept authorised uploads or approved transcript sources; store timestamped segments, language and provenance; make transcript data reusable by chaptering, retention, editing and Shorts workflows.
- **AI workflow orchestrator:** expose separate tasks for scripts, packaging, comments, planning, competitor research, retention, Shorts, SEO, chapters and channel audit. Require structured outputs and record prompt/model/version.
- **Deterministic analysis utilities:** port or adapt Python scoring/parsing tools behind isolated server-side functions or worker jobs. Keep heuristic scores explainable and label them as estimates.
- **Media processing:** connect edit decisions and Shorts candidates to the existing SocialOS media-processing pipeline; keep analysis separate from rendering and rendering separate from publishing.
- **Approvals:** AI may draft, classify and recommend. Publishing, commenting or changing public metadata should pass through explicit user/team approval and existing SocialOS permission checks.
- **Publishing integration:** official YouTube Data API/OAuth account integration remains in SocialOS. The YouTube Agent Skill repository itself does not implement this.
- **Analytics:** ingest available official analytics and authorised Studio exports; preserve source and measurement dates; avoid treating correlation or formula classification as causal explanation.
- **Multi-tenancy:** every profile, transcript, candidate clip, comment draft, report and analytics record must carry workspace ownership and obey SocialOS RLS policies.

### Recommended product positioning

The concept should not be a standalone YouTube chatbot. It should become a complete creator workflow in SocialOS:

**Research → Plan → Script → Package → Record → Transcribe → Edit → Repurpose → Approve → Publish → Measure → Improve.**

The differentiator is that intelligence and production connect to the same media library, multi-account composer, approvals, publishing engine and analytics environment. A creator can begin with a YouTube video and create a coordinated campaign for Instagram, TikTok, LinkedIn, Facebook and other connected accounts without losing the original creator voice.

## 6. Priority lessons and recommended SocialOS direction

1. Postiz — mature social-management scope, integrations, APIs and automation ecosystem.
2. Mixpost — account-specific versions, media library, queue and workspace concepts; MIT-licensed candidate for selective code-level review.
3. Postmill AI — creator design tools, AI model choices, analytics and engagement in one product.
4. TryPost — MCP and AI-agent operations, with approval and workspace boundaries.
5. BrightBean Studio — multi-workspace agency operations and first-party integrations.
6. YouTube Agent Skill — creator intelligence workflow, transcript analysis, creator voice memory and six deterministic Python tools; MIT-licensed.
7. Tube Archivist — channel/media archive and metadata research.
8. yt-dlp — authorised media-ingestion research only.
9. YouTube Transcript API — transcript and repurposing workflows.
10. MoneyPrinterTurbo — automated video assembly and asset workflows.
11. AI Clipping Generator and Open Shorts Clipping — long-to-short editing workflow references.
12. Open-Dispatch — multi-provider dispatch abstraction reference.

## 7. Licensing, platform and security controls

- AGPL projects (Postiz, Postmill AI, TryPost and BrightBean Studio) require legal review before code reuse or modification in a proprietary network service.
- MIT projects (Mixpost and YouTube Agent Skill, as verified from inspected licence files) generally permit reuse with preservation of required notices. Dependencies and bundled assets have their own licences.
- Do not rely on scraping, private endpoints, browser cookies or logged-in session extraction for commercial publishing integrations.
- Use official platform APIs and OAuth scopes, following platform policies and user consent.
- Treat media downloads, transcripts and repurposing as rights-sensitive. Users must have the necessary rights and authority to process and republish material.
- Keep OAuth tokens in protected server-side storage and out of prompts, logs and client-visible records.
- Enforce workspace ownership and RLS on connected accounts, media, drafts, comments, analytics, schedules and audit events.
- Keep AI-generated actions non-destructive and reviewable. Do not publish or send comments without required approvals.
- Treat heuristic hook scores, title scores, viral outlier analysis and retention diagnoses as decision support, not guaranteed performance predictions.

## 8. Proposed implementation order for SocialOS

1. YouTube account connection and channel metadata through official APIs.
2. Transcript ingestion and timestamped transcript storage.
3. Creator voice profiles and AI script generation.
4. Title/thumbnail packaging analysis.
5. Chapter generation and metadata assistant.
6. Retention analysis using authorised analytics data and transcript alignment.
7. Shorts candidate discovery and integration with SocialOS's media-rendering pipeline.
8. Comment triage and approved replies.
9. Capacity-aware content planning and channel audit.
10. Cross-channel adaptation, account-specific versions, approvals and durable publishing.
11. Analytics feedback loop and evidence-based recommendations.

The recommended first increment is **YouTube channel connection + transcript ingestion + creator voice profile + script/Shorts intelligence**, while retaining the existing SocialOS publishing infrastructure. This unlocks creator value without prematurely building another queue or replacing the media engine.

## 9. Verification boundaries

This document records an initial repository and documentation audit. It is not a claim that every listed repository has undergone a full code review, threat model, dependency audit, test run or production deployment. For YouTube Agent Skill specifically, the repository tree, README, all eleven SKILL.md files, voice template, licence and six utility source files were enumerated or read at the documentation level; the Python utilities have not yet been executed in a controlled test environment. Feature claims and heuristics must be validated before production adoption.