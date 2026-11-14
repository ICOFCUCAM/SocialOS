import test from "node:test";
import assert from "node:assert/strict";
import { resolveTargetContent } from "../src/content-version.mjs";

test("uses the shared default version when no account override exists", () => {
  const result = resolveTargetContent({
    defaultVersion: { id: "default", body: "Shared copy", platform_options: { visibility: "public" } }
  });
  assert.equal(result.body, "Shared copy");
  assert.equal(result.versionId, "default");
  assert.equal(result.isAccountSpecific, false);
});

test("account-specific copy and options override the shared version", () => {
  const result = resolveTargetContent({
    defaultVersion: { id: "default", body: "Shared copy", platform_options: { visibility: "public" } },
    accountVersion: { id: "account", body: "Tailored copy", platform_options: { format: "reel" } }
  });
  assert.equal(result.body, "Tailored copy");
  assert.deepEqual(result.platform_options, { format: "reel" });
  assert.equal(result.versionId, "account");
  assert.equal(result.isAccountSpecific, true);
});

test("legacy target overrides remain compatible during migration", () => {
  const result = resolveTargetContent({
    defaultVersion: { id: "default", body: "Shared copy", platform_options: {} },
    target: { caption_override: "Legacy copy", platform_options: { visibility: "followers" } }
  });
  assert.equal(result.body, "Legacy copy");
  assert.deepEqual(result.platform_options, { visibility: "followers" });
});

test("an explicit account version takes precedence over legacy target overrides", () => {
  const result = resolveTargetContent({
    defaultVersion: { id: "default", body: "Shared copy", platform_options: {} },
    accountVersion: { id: "account", body: "New version", platform_options: {} },
    target: { caption_override: "Old legacy copy" }
  });
  assert.equal(result.body, "New version");
});
