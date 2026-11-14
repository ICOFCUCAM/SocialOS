import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(
  new URL("../../../src/app/api/social/campaigns/[campaignId]/readiness/route.ts", import.meta.url),
  "utf8",
);
const panel = await readFile(
  new URL("../../../src/components/app/campaign-readiness-panel.tsx", import.meta.url),
  "utf8",
);
const detail = await readFile(
  new URL("../../../src/app/(protected)/app/campaigns/[campaignId]/page.tsx", import.meta.url),
  "utf8",
);

test("campaign readiness endpoint authenticates and scopes by active organization membership", () => {
  assert.match(api, /auth\.getUser\(\)/);
  assert.match(api, /organization_members/);
  assert.match(api, /status",\s*"active"/);
  assert.match(api, /organization_id/);
});

test("campaign readiness evaluates linked posts, targets, account and credentials", () => {
  assert.match(api, /social_campaign_posts/);
  assert.match(api, /social_post_targets/);
  assert.match(api, /social_accounts/);
  assert.match(api, /social_account_tokens/);
  assert.match(api, /CONTENT_VERSION_MISSING/);
  assert.match(api, /social_post_version_media/);
  assert.match(api, /MEDIA_NOT_READY/);
  assert.match(api, /PLATFORM_MEDIA_REQUIRED/);
  assert.match(api, /MEDIA_RENDITION_MISSING/);
});

test("campaign readiness detects schedule window, failed delivery and missing plan", () => {
  assert.match(api, /POST_BEFORE_CAMPAIGN/);
  assert.match(api, /POST_AFTER_CAMPAIGN/);
  assert.match(api, /DESTINATION_FAILED/);
  assert.match(api, /CAMPAIGN_HAS_NO_POSTS/);
  assert.match(api, /CAMPAIGN_END_PASSED/);
});

test("campaign readiness is read-only and presented as an on-demand snapshot", () => {
  assert.match(api, /NextResponse\.json/);
  assert.doesNotMatch(api, /\.update\(|\.insert\(|\.delete\(/);
  assert.match(panel, /on-demand snapshot/);
  assert.match(detail, /CampaignReadinessPanel/);
});
