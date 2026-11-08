import Redis from "ioredis";
import { PublishError } from "./errors.mjs";

const ACQUIRE_SCRIPT = `
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
for i = 1, #KEYS do
  local untilAt = tonumber(redis.call("GET", KEYS[i]) or "0")
  if untilAt > now then
    return untilAt - now
  end
end
return 0
`;
const COOLDOWN_SCRIPT = `
local untilAt = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
for i = 1, #KEYS do
  local current = tonumber(redis.call("GET", KEYS[i]) or "0")
  if untilAt > current then
    redis.call("SET", KEYS[i], untilAt, "PX", ttl)
  end
end
return 1
`;

function safePart(value) {
  return String(value || "default").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export function createProviderRateLimiter({ redis, keyPrefix = "socialos:provider-rate-limit" }) {
  if (!redis) throw new Error("A Redis client is required.");
  const keysFor = ({ platform, accountId, appId = "default", businessId = null }) => {
    const root = keyPrefix + ":" + safePart(platform);
    const keys = [root + ":app:" + safePart(appId), root + ":account:" + safePart(accountId)];
    if (businessId) keys.push(root + ":business:" + safePart(businessId));
    return keys;
  };
  return Object.freeze({
    async waitTimeMs(scope, now = Date.now()) {
      const keys = keysFor(scope);
      const wait = Number(await redis.eval(ACQUIRE_SCRIPT, keys.length, ...keys, now, 6 * 60 * 60 * 1000));
      return Number.isFinite(wait) ? Math.max(0, wait) : 0;
    },
    async defer(scope, retryAfterMs, now = Date.now()) {
      if (!Number.isFinite(retryAfterMs) || retryAfterMs <= 0) return;
      const bounded = Math.min(6 * 60 * 60 * 1000, Math.max(1000, retryAfterMs));
      const untilAt = now + bounded;
      const keys = keysFor(scope);
      await redis.eval(COOLDOWN_SCRIPT, keys.length, ...keys, untilAt, bounded);
    }
  });
}

let redisClient = null;
let limiter = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    connectTimeout: 5000
  });
  limiter = createProviderRateLimiter({ redis: redisClient });
}

export async function waitForProviderCapacity(scope) {
  if (!limiter) return;
  try {
    const wait = await limiter.waitTimeMs(scope);
    if (wait > 0) {
      throw new PublishError("Provider rate limit cooldown is active for this account or application.", {
        code: "PROVIDER_RATE_LIMIT_COOLDOWN",
        retryable: true,
        retryAfterMs: wait
      });
    }
  } catch (error) {
    if (error instanceof PublishError) throw error;
    throw new PublishError("Provider rate-limit coordination is unavailable; publishing is paused safely.", {
      code: "RATE_LIMIT_COORDINATOR_UNAVAILABLE",
      retryable: true,
      retryAfterMs: 30000
    });
  }
}

export async function deferProviderCapacity(scope, retryAfterMs) {
  if (!limiter || !Number.isFinite(retryAfterMs) || retryAfterMs <= 0) return;
  try {
    await limiter.defer(scope, retryAfterMs);
  } catch {
    throw new PublishError("Provider rate-limit cooldown could not be persisted; publishing is paused safely.", {
      code: "RATE_LIMIT_COORDINATOR_UNAVAILABLE",
      retryable: true,
      retryAfterMs: 30000
    });
  }
}

export async function closeProviderRateLimiter() {
  if (redisClient) await redisClient.quit();
}
