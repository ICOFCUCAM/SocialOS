import test from "node:test";
import assert from "node:assert/strict";
import { createProviderRateLimiter } from "../src/provider-rate-limits.mjs";

function fakeRedis() {
  const values = new Map();
  return {
    values,
    async eval(script, count, ...args) {
      const keys = args.slice(0, count);
      const nowOrUntil = Number(args[count]);
      if (script.includes("local now =")) {
        let wait = 0;
        for (const key of keys) {
          const untilAt = Number(values.get(key) || 0);
          if (untilAt > nowOrUntil) wait = Math.max(wait, untilAt - nowOrUntil);
        }
        return wait;
      }
      const ttl = Number(args[count + 1]);
      for (const key of keys) {
        const current = Number(values.get(key) || 0);
        if (nowOrUntil > current) values.set(key, nowOrUntil);
      }
      return ttl;
    }
  };
}

test("provider cooldown applies across shared app and account scopes", async () => {
  const redis = fakeRedis();
  const limiter = createProviderRateLimiter({ redis });
  const scope = { platform: "instagram", appId: "meta-app-1", accountId: "account-1" };
  await limiter.defer(scope, 45000, 1000);
  assert.equal(await limiter.waitTimeMs(scope, 2000), 44000);
  assert.equal(await limiter.waitTimeMs({ ...scope, accountId: "account-2" }, 2000), 0);
  assert.equal(await limiter.waitTimeMs({ ...scope, platform: "facebook", accountId: "account-3" }, 2000), 0);
});

test("app-level cooldown coordinates different accounts using the same provider app", async () => {
  const redis = fakeRedis();
  const limiter = createProviderRateLimiter({ redis });
  await limiter.defer({ platform: "youtube", appId: "google-client", accountId: "a" }, 60000, 1000);
  assert.equal(await limiter.waitTimeMs({ platform: "youtube", appId: "google-client", accountId: "b" }, 1000), 60000);
});

test("cooldown duration is bounded to six hours", async () => {
  const redis = fakeRedis();
  const limiter = createProviderRateLimiter({ redis });
  await limiter.defer({ platform: "linkedin", appId: "li-app", accountId: "li-account" }, 24 * 60 * 60 * 1000, 1000);
  assert.equal(await limiter.waitTimeMs({ platform: "linkedin", appId: "li-app", accountId: "li-account" }, 1000), 6 * 60 * 60 * 1000);
});
