const MAX_RETRY_AFTER_MS = 6 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const BASE_BACKOFF_MS = 30_000;

/**
 * Calculate bounded exponential backoff with jitter.
 * random is injectable so policy tests are deterministic.
 */
export function computeRetryDelay({ attemptCount, retryAfterMs = null, random = Math.random }) {
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.max(1_000, retryAfterMs));
  }
  const attempt = Number.isInteger(attemptCount) ? Math.max(1, attemptCount) : 1;
  const base = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** (attempt - 1)));
  const randomValue = random();
  const sample = Number.isFinite(randomValue) ? Math.min(1, Math.max(0, randomValue)) : 0.5;
  return Math.round(base * (0.8 + sample * 0.4));
}

/**
 * Ambiguous remote outcomes must never be retried automatically: the provider
 * may have created the post even if SocialOS did not receive its response.
 */
export function classifyPublishFailure(error, attemptCount, maxAttempts) {
  const ambiguous = Boolean(error?.ambiguous);
  const retryable = Boolean(error?.retryable) && !ambiguous;
  const attemptsExhausted = Number(attemptCount) >= Number(maxAttempts);
  return Object.freeze({
    ambiguous,
    retryable,
    terminal: ambiguous || !retryable || attemptsExhausted,
    code: ambiguous ? "PUBLISH_OUTCOME_UNKNOWN" : (error?.code || "PUBLISH_ERROR")
  });
}
