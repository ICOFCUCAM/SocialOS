const META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION;

function graphBase() {
  if (!META_GRAPH_VERSION || !/^v\\d+\\.\\d+$/.test(META_GRAPH_VERSION)) {
    throw new Error("META_GRAPH_API_VERSION must be explicitly configured.");
  }
  return "https://graph.facebook.com/" + META_GRAPH_VERSION;
}

async function requestInsights(objectId, metrics, token, fetchImpl) {
  const url = new URL(graphBase() + "/" + encodeURIComponent(objectId) + "/insights");
  url.searchParams.set("metric", metrics.join(","));
  url.searchParams.set("period", "lifetime");
  const response = await fetchImpl(url, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    signal: AbortSignal.timeout(30000),
    cache: "no-store"
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const error = new Error(response.status === 401 || response.status === 403
      ? "Meta Insights permission is unavailable; reconnect the account with insights access."
      : response.status === 429 || response.status >= 500
        ? "Meta Insights is temporarily unavailable."
        : "Meta Insights rejected the requested metrics.");
    error.retryable = response.status === 429 || response.status >= 500;
    error.reauthorize = response.status === 401 || response.status === 403;
    throw error;
  }
  return Array.isArray(payload.data) ? payload.data : [];
}

function scalarMetric(metric) {
  const value = metric?.values?.[0]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function collectMetaInsights(target, platformCode, token, fetchImpl = fetch) {
  const isInstagram = platformCode === "instagram";
  const requested = isInstagram
    ? ["views", "reach", "likes", "comments", "saved", "shares", "total_interactions"]
    : ["post_media_view", "post_total_media_view_unique"];
  const response = await requestInsights(target.platform_post_id, requested, token, fetchImpl);
  const values = new Map(response.map(item => [item.name, scalarMetric(item)]));
  const views = values.get(isInstagram ? "views" : "post_media_view");
  const reach = values.get(isInstagram ? "reach" : "post_total_media_view_unique");
  const likes = values.get("likes");
  const comments = values.get("comments");
  const shares = values.get("shares");
  const saves = values.get("saved");
  const totalInteractions = values.get("total_interactions");
  const componentEngagements = [likes, comments, shares, saves].some(value => value !== null)
    ? [likes, comments, shares, saves].reduce((sum, value) => sum + (value ?? 0), 0)
    : null;

  // Meta returns these media metrics as lifetime snapshots, not daily time series.
  const record = {
    organization_id: target.organization_id,
    target_id: target.id,
    metric_date: new Date().toISOString().slice(0, 10),
    period_type: "lifetime",
    impressions: views,
    reach,
    likes,
    comments,
    shares,
    saves,
    engagements: totalInteractions ?? componentEngagements,
    provider_metrics: {
      provider: "meta",
      platform: platformCode,
      metric_semantics: "lifetime_snapshot",
      raw_metric_names: requested.filter(name => values.has(name))
    },
    collected_at: new Date().toISOString()
  };
  const hasMetrics = Object.entries(record).some(([key, value]) =>
    ["impressions", "reach", "likes", "comments", "shares", "saves", "engagements"].includes(key) && value !== null
  );
  return hasMetrics ? [record] : [];
}
