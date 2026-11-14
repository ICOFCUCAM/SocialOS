import test from "node:test";
import assert from "node:assert/strict";
import { publishInstagram } from "../src/providers/meta.mjs";
import { classifyPublishFailure } from "../src/retry-policy.mjs";

test("a network failure on Instagram media_publish is an unknown outcome, never a retry", async () => {
  process.env.META_GRAPH_API_VERSION = "v25.0";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/media_publish")) throw new TypeError("socket hang up");
    return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ id: "container-1" }) };
  };
  try {
    const error = await publishInstagram({
      account: { external_account_id: "ig-1", granted_scopes: ["instagram_basic", "instagram_content_publish"] },
      token: "token",
      post: { body: "caption" },
      media: [{ kind: "image", signedUrl: "https://example.test/image.jpg" }]
    }).then(() => null, err => err);
    assert.ok(error, "publishInstagram should reject");
    assert.equal(error.code, "PUBLISH_OUTCOME_UNKNOWN");
    assert.equal(error.ambiguous, true);
    const policy = classifyPublishFailure(error, 1, 5);
    assert.equal(policy.retryable, false);
    assert.equal(policy.terminal, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a provider success that cannot be recorded is classified as an unknown outcome", async () => {
  const { PublishError } = await import("../src/errors.mjs");
  const error = new PublishError("recorded failed", { code: "PUBLISH_RECORD_FAILED", ambiguous: true, externalPostId: "ext-1" });
  assert.equal(error.externalPostId, "ext-1");
  assert.deepEqual(classifyPublishFailure(error, 1, 5), {
    ambiguous: true, retryable: false, terminal: true, code: "PUBLISH_OUTCOME_UNKNOWN"
  });
});
