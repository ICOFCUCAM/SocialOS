import { classifyProviderQuotaError } from "./provider-quota-intelligence.mjs";

export class PublishError extends Error {
  constructor(message, { code = "PUBLISH_FAILED", retryable = false, retryAfterMs = null, ambiguous = false, status = null, quotaScope = null, usage = null, businessId = null, externalPostId = null } = {}) {
    super(message);
    this.name = "PublishError";
    this.code = code;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.ambiguous = ambiguous;
    this.status = status;
    this.quotaScope = quotaScope;
    this.usage = usage;
    this.businessId = businessId;
    // Set when the provider confirmed a publication that SocialOS failed to record.
    this.externalPostId = externalPostId;
  }
}

// Network failures after a publish request is sent are ambiguous: the provider may
// have accepted the post even though SocialOS never received its response.
export async function providerFetch(url, options, provider, { ambiguous = false } = {}) {
  try {
    return await fetch(url, options);
  } catch {
    if (ambiguous) {
      throw new PublishError(provider + " publication outcome is unknown; reconcile on the platform before retrying.", {
        code: "PUBLISH_OUTCOME_UNKNOWN",
        ambiguous: true
      });
    }
    throw new PublishError(provider + " request failed before a confirmed response.", {
      code: "PROVIDER_REQUEST_FAILED",
      retryable: true
    });
  }
}

export async function providerJson(response, provider) {
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* provider may return non-JSON */ }
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    const retryAfter = Number(response.headers.get("retry-after"));
    const quota = classifyProviderQuotaError(provider, body);
    const headerRetryAfter = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null;
    const metaUsage = provider === "Facebook" || provider === "Instagram"
      ? (await import("./provider-quota-intelligence.mjs")).parseMetaUsageHeaders(response.headers)
      : null;
    const businessCooldown = metaUsage?.business
      ?.filter(item => Number.isFinite(item.retryAfterMs) && item.retryAfterMs > 0)
      .sort((a,b) => b.retryAfterMs-a.retryAfterMs)[0] || null;
    throw new PublishError(provider + " API returned HTTP " + response.status, {
      code: quota?.code || (response.status === 401 ? "AUTHORIZATION_REVOKED" : response.status === 403 ? "PROVIDER_PERMISSION_DENIED" : provider.toUpperCase() + "_HTTP_" + response.status),
      retryable: quota?.retryable ?? retryable,
      retryAfterMs: headerRetryAfter ?? quota?.retryAfterMs ?? businessCooldown?.retryAfterMs ?? null,
      ambiguous: response.status >= 500,
      status: response.status,
      quotaScope: quota?.quotaScope || (businessCooldown ? "business_use_case" : null),
      businessId: businessCooldown?.businessId || null,
      usage: metaUsage
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
