export class PublishError extends Error {
  constructor(message, { code = "PUBLISH_FAILED", retryable = false, retryAfterMs = null, ambiguous = false } = {}) {
    super(message);
    this.name = "PublishError";
    this.code = code;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.ambiguous = ambiguous;
  }
}

export async function providerJson(response, provider) {
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* provider may return non-JSON */ }
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new PublishError(provider + " API returned HTTP " + response.status, {
      code: provider.toUpperCase() + "_HTTP_" + response.status,
      retryable,
      retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
      ambiguous: response.status >= 500
    });
  }
  return body;
}

export function requireScopes(granted, required, provider) {
  const have = new Set(Array.isArray(granted) ? granted : []);
  const missing = required.filter(scope => !have.has(scope));
  if (missing.length) {
    throw new PublishError(provider + " account must be reconnected with additional publishing permissions.", {
      code: "MISSING_PUBLISH_SCOPES"
    });
  }
}
