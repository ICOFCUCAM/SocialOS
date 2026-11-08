import test from "node:test";
import assert from "node:assert/strict";
import { providerJson, requireScopes, PublishError } from "../src/errors.mjs";

test("provider 429 is retryable and preserves Retry-After", async () => {
  await assert.rejects(
    providerJson(new Response("{}", { status: 429, headers: { "retry-after": "12" } }), "Test"),
    error => error instanceof PublishError && error.retryable && error.retryAfterMs === 12000
  );
});

test("provider 5xx is marked ambiguous and retryable at transport layer", async () => {
  await assert.rejects(
    providerJson(new Response("{}", { status: 503 }), "Test"),
    error => error.retryable && error.ambiguous
  );
});

test("provider 4xx is not retryable", async () => {
  await assert.rejects(
    providerJson(new Response("{}", { status: 403 }), "Test"),
    error => !error.retryable && !error.ambiguous
  );
});

test("scope check rejects absent publishing permissions", () => {
  assert.throws(() => requireScopes(["profile"], ["publish"], "Test"), error => error.code === "MISSING_PUBLISH_SCOPES");
});
