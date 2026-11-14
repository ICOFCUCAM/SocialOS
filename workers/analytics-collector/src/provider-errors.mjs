// Google APIs report quota and rate limits as HTTP 403 with these reasons.
// They mean "try later", not "permission revoked", and must not force a reconnect.
const GOOGLE_QUOTA_REASONS = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "rateLimitExceeded",
  "userRateLimitExceeded",
]);

export function isGoogleQuotaError(payload) {
  const errors = Array.isArray(payload?.error?.errors) ? payload.error.errors : [];
  return errors.some((item) => GOOGLE_QUOTA_REASONS.has(String(item?.reason || "")));
}
