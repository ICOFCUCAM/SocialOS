import test from "node:test";
import assert from "node:assert/strict";
import { computeRetryDelay, classifyPublishFailure } from "../src/retry-policy.mjs";

test("Retry-After is respected with a one-second floor and six-hour ceiling", () => {
  assert.equal(computeRetryDelay({ attemptCount: 1, retryAfterMs: 50 }), 1_000);
  assert.equal(computeRetryDelay({ attemptCount: 1, retryAfterMs: 99_999_999 }), 6 * 60 * 60 * 1000);
});

test("exponential backoff is bounded and jitter is deterministic", () => {
  assert.equal(computeRetryDelay({ attemptCount: 1, random: () => 0.5 }), 30_000);
  assert.equal(computeRetryDelay({ attemptCount: 2, random: () => 0 }), 48_000);
  assert.equal(computeRetryDelay({ attemptCount: 100, random: () => 1 }), 60 * 60 * 1000);
});

test("retry policy never retries ambiguous provider outcomes", () => {
  assert.deepEqual(classifyPublishFailure({ code: "TIMEOUT", retryable: true, ambiguous: true }, 1, 5), {
    ambiguous: true, retryable: false, terminal: true, code: "PUBLISH_OUTCOME_UNKNOWN"
  });
});

test("retryable failures retry until the attempt limit", () => {
  assert.equal(classifyPublishFailure({ code: "RATE_LIMIT", retryable: true }, 1, 5).terminal, false);
  assert.equal(classifyPublishFailure({ code: "RATE_LIMIT", retryable: true }, 5, 5).terminal, true);
  assert.equal(classifyPublishFailure({ code: "BAD_REQUEST" }, 1, 5).terminal, true);
});
