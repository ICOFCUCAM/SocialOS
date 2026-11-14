/**
 * Provider quota signals are intentionally evidence-driven. This module does
 * not invent undocumented quotas or assume every endpoint shares one bucket.
 */
export function parseMetaUsageHeaders(headers) {
  const parse = (name) => {
    const raw = headers?.get?.(name);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  };
  const app = parse("x-app-usage");
  const business = parse("x-business-use-case-usage");
  const businessScopes = [];
  if (business && typeof business === "object") {
    for (const [businessId, entries] of Object.entries(business)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const regainMinutes = Number(entry.estimated_time_to_regain_access);
        businessScopes.push({
          businessId,
          type: typeof entry.type === "string" ? entry.type : "unknown",
          callCount: Number.isFinite(Number(entry.call_count)) ? Number(entry.call_count) : null,
          cpuTime: Number.isFinite(Number(entry.total_cputime))
            ? Number(entry.total_cputime)
            : null,
          totalTime: Number.isFinite(Number(entry.total_time)) ? Number(entry.total_time) : null,
          retryAfterMs:
            Number.isFinite(regainMinutes) && regainMinutes > 0
              ? Math.min(6 * 60 * 60 * 1000, regainMinutes * 60 * 1000)
              : null,
        });
      }
    }
  }
  const appMetrics = app
    ? Object.fromEntries(
        Object.entries(app)
          .filter(([, v]) => Number.isFinite(Number(v)))
          .map(([k, v]) => [k, Number(v)]),
      )
    : null;
  return { app: appMetrics, business: businessScopes };
}

export function parseLinkedInThrottle(body = {}) {
  const message = String(body?.message || body?.error?.message || "");
  const upper = message.toUpperCase();
  if (!upper.includes("THROTTLE")) return null;
  const scopes = [];
  if (upper.includes("APPLICATION")) scopes.push("application");
  if (upper.includes("MEMBER")) scopes.push("member");
  if (upper.includes("DAY")) scopes.push("day");
  return { scopes, message: message.slice(0, 300) };
}

export function youtubeQuotaResetDelay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const local = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
  );
  local.setUTCDate(local.getUTCDate() + 1);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  const day = local.getUTCDate();
  // Resolve the next Pacific midnight by iteratively correcting the UTC guess;
  // this handles PST/PDT without assuming a fixed UTC offset.
  let target = Date.UTC(year, month - 1, day);
  for (let i = 0; i < 3; i++) {
    const probe = new Date(target);
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(probe)
        .map((x) => [x.type, x.value]),
    );
    const represented = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
    target += Date.UTC(year, month - 1, day) - represented;
  }
  return Math.max(1000, target - now.getTime());
}

export function classifyProviderQuotaError(provider, body = {}, now = new Date()) {
  const reasons = Array.isArray(body?.error?.errors)
    ? body.error.errors.map((item) => String(item?.reason || ""))
    : [];
  if (
    provider === "YouTube" &&
    reasons.some((reason) =>
      ["quotaExceeded", "dailyLimitExceeded", "dailyLimitExceededUnreg"].includes(reason),
    )
  ) {
    return {
      code: "YOUTUBE_DAILY_QUOTA_EXCEEDED",
      retryable: true,
      retryAfterMs: youtubeQuotaResetDelay(now),
      quotaScope: "application_daily",
    };
  }
  if (
    provider === "YouTube" &&
    reasons.some((reason) => ["rateLimitExceeded", "userRateLimitExceeded"].includes(reason))
  ) {
    return {
      code: "YOUTUBE_RATE_LIMIT_EXCEEDED",
      retryable: true,
      retryAfterMs: null,
      quotaScope: "short_window",
    };
  }
  if (provider === "LinkedIn") {
    const throttle = parseLinkedInThrottle(body);
    if (throttle)
      return {
        code: "LINKEDIN_QUOTA_EXCEEDED",
        retryable: true,
        retryAfterMs: null,
        quotaScope: throttle.scopes,
      };
  }
  return null;
}
