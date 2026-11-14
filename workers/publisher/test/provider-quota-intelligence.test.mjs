import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMetaUsageHeaders,
  parseLinkedInThrottle,
  classifyProviderQuotaError,
  youtubeQuotaResetDelay,
} from "../src/provider-quota-intelligence.mjs";

test("parses Meta app and business use-case usage without inventing values", () => {
  const headers = new Headers({
    "x-app-usage": JSON.stringify({ call_count: 72, total_cputime: 41, total_time: 55 }),
    "x-business-use-case-usage": JSON.stringify({
      "business-123": [
        {
          type: "ads_insights",
          call_count: 90,
          total_cputime: 75,
          total_time: 80,
          estimated_time_to_regain_access: 12,
        },
      ],
    }),
  });
  const result = parseMetaUsageHeaders(headers);
  assert.equal(result.app.call_count, 72);
  assert.equal(result.business[0].businessId, "business-123");
  assert.equal(result.business[0].retryAfterMs, 12 * 60 * 1000);
});

test("ignores malformed Meta usage headers", () => {
  const result = parseMetaUsageHeaders(new Headers({ "x-app-usage": "{bad" }));
  assert.equal(result.app, null);
  assert.deepEqual(result.business, []);
});

test("identifies documented LinkedIn throttle message scope", () => {
  assert.deepEqual(
    parseLinkedInThrottle({ message: "THROTTLE: APPLICATION, MEMBER, DAY" }).scopes,
    ["application", "member", "day"],
  );
  assert.equal(parseLinkedInThrottle({ message: "Not authorized" }), null);
});

test("classifies YouTube daily quota exhaustion until next Pacific midnight", () => {
  const now = new Date("2026-11-08T20:00:00.000Z");
  const result = classifyProviderQuotaError(
    "YouTube",
    {
      error: { errors: [{ reason: "quotaExceeded" }] },
    },
    now,
  );
  assert.equal(result.code, "YOUTUBE_DAILY_QUOTA_EXCEEDED");
  assert.equal(result.quotaScope, "application_daily");
  assert.equal(result.retryAfterMs, 12 * 60 * 60 * 1000);
});

test("classifies YouTube short-window rate limit separately from daily quota", () => {
  const result = classifyProviderQuotaError("YouTube", {
    error: { errors: [{ reason: "userRateLimitExceeded" }] },
  });
  assert.equal(result.code, "YOUTUBE_RATE_LIMIT_EXCEEDED");
  assert.equal(result.retryAfterMs, null);
});

test("does not invent a LinkedIn reset time", () => {
  const result = classifyProviderQuotaError("LinkedIn", {
    message: "THROTTLE: APPLICATION, MEMBER, DAY",
  });
  assert.equal(result.code, "LINKEDIN_QUOTA_EXCEEDED");
  assert.equal(result.retryAfterMs, null);
});
