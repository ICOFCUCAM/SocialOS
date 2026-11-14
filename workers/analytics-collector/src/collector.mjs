import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { collectMetaInsights } from "./meta-insights.mjs";
import { collectLinkedInInsights } from "./linkedin-insights.mjs";
import { getAccessToken } from "./oauth-token.mjs";
import { isGoogleQuotaError } from "./provider-errors.mjs";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const name of required) if (!process.env[name]) throw new Error(name + " is required.");

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const maxTargets = Math.max(1, Math.min(500, Number(process.env.ANALYTICS_MAX_TARGETS) || 100));
const lookbackDays = Math.max(7, Math.min(90, Number(process.env.ANALYTICS_LOOKBACK_DAYS) || 35));
const delayMs = Math.max(250, Number(process.env.ANALYTICS_REQUEST_DELAY_MS) || 1000);

const workerId = "analytics-" + randomUUID();
function dateOnly(date) { return date.toISOString().slice(0, 10); }
function daysAgo(days) { const d = new Date(); d.setUTCDate(d.getUTCDate() - days); return dateOnly(d); }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function queryYouTubeAnalytics(token, videoId, startDate, endDate) {
  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  for (const [key, value] of Object.entries({
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: "views,likes,comments,shares,estimatedMinutesWatched",
    dimensions: "day",
    filters: "video==" + videoId,
    sort: "day",
    maxResults: "200"
  })) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    signal: AbortSignal.timeout(30000),
    cache: "no-store"
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const status = response.status;
    // Google reports quota exhaustion as 403; that is not a revoked permission.
    const quota = isGoogleQuotaError(payload);
    const error = new Error(quota
      ? "YouTube Analytics quota is exhausted; collection will resume later."
      : status === 401 || status === 403
        ? "YouTube Analytics access is unavailable; reconnect with the YouTube analytics read scope."
        : status === 429 || status >= 500
          ? "YouTube Analytics temporarily unavailable."
          : "YouTube Analytics rejected the report request.");
    error.retryable = quota || status === 429 || status >= 500;
    error.reauthorize = !quota && (status === 401 || status === 403);
    throw error;
  }
  const headers = payload.columnHeaders?.map(item => item.name) ?? [];
  return (payload.rows ?? []).map(values => Object.fromEntries(headers.map((name, index) => [name, values[index]])));
}

async function collectYouTubeTarget(target, token) {
  const endDate = daysAgo(3);
  const startDate = daysAgo(lookbackDays);
  const rows = await queryYouTubeAnalytics(token, target.platform_post_id, startDate, endDate);
  if (!rows.length) return 0;
  const records = rows.map(row => {
    const likes = Number(row.likes ?? 0);
    const comments = Number(row.comments ?? 0);
    const shares = Number(row.shares ?? 0);
    return {
      organization_id: target.organization_id,
      target_id: target.id,
      metric_date: row.day,
      period_type: "daily",
      video_views: Number(row.views ?? 0),
      likes,
      comments,
      shares,
      engagements: likes + comments + shares,
      provider_metrics: { provider: "youtube", estimated_minutes_watched: Number(row.estimatedMinutesWatched ?? 0) },
      collected_at: new Date().toISOString()
    };
  });
  const { error } = await db.from("social_post_analytics_daily").upsert(records, { onConflict: "target_id,metric_date,period_type" });
  if (error) throw new Error("Unable to persist YouTube analytics: " + error.message);
  return records.length;
}

async function persistLinkedInTarget(target, token) {
  const records = await collectLinkedInInsights(target, token, fetch, () => wait(delayMs));
  if (!records.length) return 0;
  const { error } = await db.from("social_post_analytics_daily").upsert(records, { onConflict: "target_id,metric_date,period_type" });
  if (error) throw new Error("Unable to persist LinkedIn analytics: " + error.message);
  return records.length;
}

async function persistMetaTarget(target, platformCode, token) {
  const records = await collectMetaInsights(target, platformCode, token);
  if (!records.length) return 0;
  const { error } = await db.from("social_post_analytics_daily").upsert(records, { onConflict: "target_id,metric_date,period_type" });
  if (error) throw new Error("Unable to persist Meta analytics: " + error.message);
  return records.length;
}

async function main() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: targets, error } = await db.from("social_post_targets")
    .select("id,organization_id,social_account_id,platform_post_id,published_at,status")
    .eq("status", "published").not("platform_post_id", "is", null)
    .gte("published_at", cutoff).order("published_at", { ascending: false }).limit(maxTargets);
  if (error) throw new Error("Unable to load published targets: " + error.message);

  let collected = 0;
  let skipped = 0;
  let failed = 0;
  for (const target of targets ?? []) {
    try {
      const { data: account, error: accountError } = await db.from("social_accounts")
        .select("id,organization_id,platform_id,connection_status,granted_scopes")
        .eq("id", target.social_account_id).eq("organization_id", target.organization_id).single();
      if (accountError || !account || account.connection_status !== "connected") { skipped++; continue; }
      const { data: platform, error: platformError } = await db.from("social_platforms")
        .select("code").eq("id", account.platform_id).single();
      if (platformError || !["youtube", "facebook", "instagram", "linkedin"].includes(platform?.code)) { skipped++; continue; }
      const scopes = account.granted_scopes ?? [];
      const requiredScopes = platform.code === "youtube"
        ? ["https://www.googleapis.com/auth/youtube.readonly"]
        : platform.code === "instagram"
          ? ["instagram_basic", "instagram_manage_insights", "pages_read_engagement"]
          : platform.code === "linkedin"
            ? ["r_member_postAnalytics"]
            : ["read_insights", "pages_read_engagement"];
      if (!requiredScopes.every(scope => scopes.includes(scope))) {
        skipped++;
        console.warn("Skipped account without required analytics permissions:", account.id, platform.code);
        continue;
      }
      const { data: tokenRow, error: tokenError } = await db.from("social_account_tokens")
        .select("*").eq("social_account_id", account.id).eq("organization_id", target.organization_id).single();
      if (tokenError || !tokenRow) { skipped++; continue; }
      const token = await getAccessToken({ db, account, platformCode: platform.code, tokenRow, workerId });
      if (platform.code === "youtube") collected += await collectYouTubeTarget(target, token);
      else if (platform.code === "linkedin") collected += await persistLinkedInTarget(target, token);
      else collected += await persistMetaTarget(target, platform.code, token);
    } catch (error) {
      failed++;
      console.error("Analytics collection failed for target", target.id, {
        message: String(error?.message || "Unknown error").slice(0, 400),
        retryable: Boolean(error?.retryable),
        reauthorize: Boolean(error?.reauthorize)
      });
      if (error?.reauthorize) {
        await db.from("social_accounts").update({
          connection_status: "reauthorization_required",
          last_error: "Provider analytics permission is unavailable; reconnect the account."
        }).eq("id", target.social_account_id).eq("organization_id", target.organization_id);
      }
    }
    await wait(delayMs);
  }
  console.log(JSON.stringify({ scanned: targets?.length ?? 0, metricRowsUpserted: collected, skipped, failed }));
}

main().catch(error => {
  console.error("Analytics collector stopped:", String(error?.message || error).slice(0, 500));
  process.exitCode = 1;
});
