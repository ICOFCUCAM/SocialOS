# AI Content Studio

## Scope

The first AI Studio milestone generates three editable content variations from a user brief and the selected brand's saved identity. It supports platform-aware captions, educational/promotional posts, stories, short- and long-form video scripts, carousel outlines and announcements.

The feature is assistive: generation never publishes content, creates a scheduled post, or marks content approved.

## Brand context

The API reads the selected active brand through the authenticated Supabase client. Existing `brands.brand_settings` is used as the brand context source:
- Voice tone and guidance
- Target audience
- Positioning
- Content pillars
- Key messages

No new brand-context table or migration is required. The API limits the context it passes to the model.

## Request and authorization

`POST /api/ai/content` requires an authenticated user, active workspace membership, an allowed workspace role, and RLS access to the selected active brand. Request fields are bounded and platform/content-format values are allowlisted.

The provider API key is server-only. The browser never receives it. The API uses the configured OpenAI Chat Completions endpoint and asks for JSON output, validates the response shape, limits the returned variants and token usage metadata, and returns `Cache-Control: no-store`.

## Configuration

Set these server environment variables:
- `OPENAI_API_KEY`: server-side provider credential
- `SOCIALOS_AI_MODEL`: the model identifier enabled for the account

If either is missing, the endpoint returns a clear configuration error (503). Do not add either variable with a `NEXT_PUBLIC_` prefix, commit a real key, or expose the key to browser code.

## Prompt and output safeguards

The model is instructed to treat brand context and user content as reference data, not higher-priority instructions. It must not invent product features, prices, statistics, testimonials, guarantees or credentials. Generated text is still unverified and must be reviewed by a human.

The API validates and bounds returned text, hashtags and CTA fields. Provider errors are returned as generic operational messages; provider response bodies and credentials are not forwarded to the browser.

## User workflow

1. Select a brand, destination platform and content format.
2. Describe the objective and optionally add approved facts and a call to action.
3. Generate three variations.
4. Copy a variation or transfer it into the Post Composer.
5. Review and edit it, select connected accounts and save or schedule through the existing publishing flow.

The composer handoff uses browser session storage for the draft text and removes the value after it is loaded. It does not automatically select destinations or submit the post.

## Limitations and next work

- This milestone does not persist AI generations, campaign briefs, prompts or token usage in a billing ledger.
- No image generation, video generation, approval workflow, plagiarism/originality check, factual verification or automatic translation is included.
- No live model call was performed as part of repository implementation.
- The AI endpoint requires a configured model and API key in the deployment environment.
- Before commercial rollout, add per-workspace entitlements, rate limits, spend budgets, usage accounting, model/provider abstraction, prompt versioning and evaluation tests.
