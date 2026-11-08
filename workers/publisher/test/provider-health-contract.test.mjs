import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(
  new URL("../../../src/app/api/social/accounts/health/route.ts", import.meta.url),
  "utf8"
);
const panel = await readFile(
  new URL("../../../src/components/app/provider-health-panel.tsx", import.meta.url),
  "utf8"
);
const channels = await readFile(
  new URL("../../../src/app/(protected)/app/channels/page.tsx", import.meta.url),
  "utf8"
);

test("provider health endpoint requires authenticated active workspace membership", () => {
  assert.match(api, /auth\.getUser\(\)/);
  assert.match(api, /status", "active"/);
  assert.match(api, /organization_id/);
});

test("provider health returns metadata only and never selects token material", () => {
  assert.match(api, /access_token_expires_at/);
  assert.match(api, /refresh_token_expires_at/);
  assert.match(api, /last_refreshed_at/);
  assert.doesNotMatch(api, /select\("[^"]*access_token_ciphertext/);
  assert.doesNotMatch(api, /select\("[^"]*access_token_nonce/);
  assert.match(api, /Cache-Control.*no-store/);
});

test("health panel displays warnings and is integrated into channels", () => {
  assert.match(panel, /expiring_soon|action_required/);
  assert.match(panel, /Refresh/);
  assert.match(channels, /ProviderHealthPanel/);
});
