import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(
  new URL("../../../src/app/api/social/publishing/readiness/route.ts", import.meta.url),
  "utf8"
);
const component = await readFile(
  new URL("../../../src/components/app/publish-readiness-check.tsx", import.meta.url),
  "utf8"
);
const calendar = await readFile(
  new URL("../../../src/app/(protected)/app/calendar/page.tsx", import.meta.url),
  "utf8"
);

test("readiness endpoint requires authentication and verifies workspace membership", () => {
  assert.match(api, /auth\.getUser\(\)/);
  assert.match(api, /organization_members/);
  assert.match(api, /status","active"/);
});

test("readiness evaluates account-specific content, media, provider and credentials", () => {
  assert.match(api, /social_post_versions/);
  assert.match(api, /social_post_version_media/);
  assert.match(api, /social_account_tokens/);
  assert.match(api, /PROVIDER_ADAPTER_UNAVAILABLE/);
  assert.match(api, /ACCESS_TOKEN_EXPIRED/);
  assert.match(api, /MEDIA_NOT_READY/);
  assert.match(api, /PLATFORM_MEDIA_REQUIRED/);
});

test("readiness is advisory and reports blockers and warnings per destination", () => {
  assert.match(api, /severity:"blocker"\|"warning"\|"info"/);
  assert.match(api, /summary:/);
  assert.match(api, /readiness,/);
  assert.match(component, /Assessment is advisory/);
});

test("calendar exposes readiness assessment for each monthly post", () => {
  assert.match(calendar, /PublishReadinessCheck/);
  assert.match(component, /api\/social\/publishing\/readiness/);
});
