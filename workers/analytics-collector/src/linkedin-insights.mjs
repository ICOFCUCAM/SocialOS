const METRICS = [
  ["IMPRESSION", "impressions"],
  ["MEMBERS_REACHED", "reach"],
  ["REACTION", "likes"],
  ["COMMENT", "comments"],
  ["RESHARE", "shares"],
  ["POST_SAVE", "saves", true],
  ["LINK_CLICKS", "clicks", true],
  ["FOLLOWER_GAINED_FROM_CONTENT", "followers_gained", true],
  ["PROFILE_VIEW_FROM_CONTENT", "profile_visits", true]
];

function apiVersion() {
  const version = process.env.LINKEDIN_API_VERSION;
  if (!version || !/^\\d{6}$/.test(version)) {
    throw new Error("LINKEDIN_API_VERSION must be explicitly configured as YYYYMM.");
  }
  return version;
}

function entityFinder(urn) {
  if (typeof urn !== "string" || !/^urn:li:(ugcPost|share):[A-Za-z0-9_-]+$/.test(urn)) {
    throw new Error("LinkedIn analytics requires a valid ugcPost or share URN.");
  }
  const type = urn.startsWith("urn:li:ugcPost:") ? "ugcPost" : "share";
  return "(" + type + ":" + urn + ")";
}

async function queryMetric(urn, metric, token, fetchImpl) {
  const url = new URL("https://api.linkedin.com/rest/memberCreatorPostAnalytics");
  url.searchParams.set("q", "entity");
  url.searchParams.set("entity", entityFinder(urn));
  url.searchParams.set("queryType", metric);
  url.searchParams.set("aggregation", "TOTAL");
  const response = await fetchImpl(url, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      "Linkedin-Version": apiVersion(),
      "X-Restli-Protocol-Version": "2.0.0"
    },
    signal: AbortSignal.timeout(30000),
    cache: "no-store"
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const error = new Error(response.status === 401 || response.status === 403
      ? "LinkedIn post analytics access is unavailable; reconnect with analytics permission and verify Community Management API access."
      : response.status === 429 || response.status >= 500
        ? "LinkedIn analytics is temporarily unavailable."
        : "LinkedIn rejected an analytics metric request.");
    error.retryable = response.status === 429 || response.status >= 500;
    error.reauthorize = response.status === 401 || response.status === 403;
    error.unsupportedMetric = response.status === 400;
    throw error;
  }
  const element = payload.elements?.[0];
  const count = element?.count;
  return typeof count === "number" && Number.isFinite(count) ? count : null;
}

export async function collectLinkedInInsights(target, token, fetchImpl = fetch, pause = async () => {}) {
  const metrics = {};
  let successful = 0;
  for (const [metric, field, optional = false] of METRICS) {
    try {
      metrics[field] = await queryMetric(target.platform_post_id, metric, token, fetchImpl);
      if (metrics[field] !== null) successful++;
    } catch (error) {
      if (error.unsupportedMetric && optional) {
        metrics[field] = null;
        continue;
      }
      throw error;
    }
    await pause();
  }
  if (!successful) return [];
  const engagementParts = [metrics.likes, metrics.comments, metrics.shares];
  const engagements = engagementParts.some(value => value !== null)
    ? engagementParts.reduce((sum, value) => sum + (value ?? 0), 0)
    : null;
  return [{
    organization_id: target.organization_id,
    target_id: target.id,
    metric_date: new Date().toISOString().slice(0, 10),
    period_type: "lifetime",
    impressions: metrics.impressions,
    reach: metrics.reach,
    engagements,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    saves: metrics.saves,
    clicks: metrics.clicks,
    followers_gained: metrics.followers_gained,
    profile_visits: metrics.profile_visits,
    provider_metrics: {
      provider: "linkedin",
      metric_semantics: "lifetime_snapshot",
      metrics_collected: Object.entries(metrics).filter(([, value]) => value !== null).map(([field]) => field)
    },
    collected_at: new Date().toISOString()
  }];
}
