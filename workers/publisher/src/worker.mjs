import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { publishTarget } from "./providers/index.mjs";
import { PublishError } from "./errors.mjs";
import { computeRetryDelay, classifyPublishFailure } from "./retry-policy.mjs";
import { resolveTargetContent } from "./content-version.mjs";
import { waitForProviderCapacity, deferProviderCapacity, closeProviderRateLimiter } from "./provider-rate-limits.mjs";

const supabaseUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const db = createClient(supabaseUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });
const workerId = process.env.PUBLISH_WORKER_ID || "publisher-" + randomUUID();
const pollMs = Math.max(500, Number(process.env.PUBLISH_POLL_INTERVAL_MS) || 2500);
const signedUrlSeconds = Math.max(60, Math.min(900, Number(process.env.PUBLISH_MEDIA_URL_TTL_SECONDS) || 600));
const maxVideoBytes = Math.max(1, Number(process.env.PUBLISH_MAX_VIDEO_BYTES) || 250 * 1024 * 1024);
let stopping = false;

function pgBytea(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value !== "string") throw new Error("Encrypted token field is missing.");
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("Encrypted token field has invalid bytea encoding.");
  return Buffer.from(hex, "hex");
}
function safeMessage(error) {
  return String(error?.message || "Publishing failed").replace(/(?:access_token|Bearer)\s*[:=]?\s*[^\s&]+/gi, "[REDACTED]").slice(0, 1200);
}
async function must(result, message) {
  if (result.error) throw new Error(message + ": " + result.error.message);
  return result.data;
}
async function getTarget(job) {
  const target = await must(await db.from("social_post_targets").select("*").eq("id", job.target_id).eq("organization_id", job.organization_id).single(), "Target lookup failed");
  const post = await must(await db.from("social_posts").select("*").eq("id", target.post_id).eq("organization_id", job.organization_id).single(), "Post lookup failed");
  const account = await must(await db.from("social_accounts").select("*").eq("id", target.social_account_id).eq("organization_id", job.organization_id).single(), "Account lookup failed");
  const platform = await must(await db.from("social_platforms").select("code,is_enabled").eq("id", account.platform_id).single(), "Platform lookup failed");
  if (!platform.is_enabled) throw new PublishError("This platform is disabled in SocialOS.", { code: "PLATFORM_DISABLED" });
  if (account.connection_status !== "connected") throw new PublishError("Social account is not connected.", { code: "ACCOUNT_NOT_CONNECTED" });
  const accountVersion = await must(await db.from("social_post_versions").select("*")
    .eq("post_id", post.id).eq("organization_id", job.organization_id)
    .eq("social_account_id", account.id).maybeSingle(), "Account content version lookup failed");
  const defaultVersion = await must(await db.from("social_post_versions").select("*")
    .eq("post_id", post.id).eq("organization_id", job.organization_id)
    .eq("is_default", true).single(), "Default content version lookup failed");
  return {
    target, post, contentVersion: resolveTargetContent({ defaultVersion, accountVersion, target }),
    account: { ...account, platform: platform.code }
  };
}
function encryptionKey(version) {
  let keys = {};
  if (process.env.SOCIAL_TOKEN_ENCRYPTION_KEYS) {
    try { keys = JSON.parse(process.env.SOCIAL_TOKEN_ENCRYPTION_KEYS); }
    catch { throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEYS must be a JSON object of base64 keys."); }
  }
  const currentVersion = process.env.SOCIAL_TOKEN_KEY_VERSION || "v1";
  const raw = keys[version] || (version === currentVersion ? process.env.SOCIAL_TOKEN_ENCRYPTION_KEY : undefined);
  if (!raw) throw new PublishError("OAuth encryption key version is unavailable: " + version, { code: "TOKEN_KEY_VERSION_MISMATCH" });
  const value = Buffer.from(raw, "base64");
  if (value.length !== 32) throw new Error("OAuth encryption keys must decode to 32 bytes.");
  return value;
}
function encryptStoredToken(token) {
  const keyVersion = process.env.SOCIAL_TOKEN_KEY_VERSION || "v1";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyVersion), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return { nonce: iv, ciphertext, tag: cipher.getAuthTag(), keyVersion };
}
function decryptStoredToken(nonce, ciphertext, tag, keyVersion) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(keyVersion), nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
async function refreshProviderToken(account, row) {
  if (account.platform === "facebook" || account.platform === "instagram") {
    throw new PublishError("Meta Page tokens cannot be refreshed through the generic OAuth refresh flow; reconnect the account when expired.", { code: "REAUTHORIZATION_REQUIRED" });
  }
  if (!row.refresh_token_ciphertext || !row.refresh_token_nonce || !row.refresh_token_tag) {
    throw new PublishError("No refresh token is available. Reconnect this social account.", { code: "REAUTHORIZATION_REQUIRED" });
  }
  if (row.refresh_token_expires_at && Date.parse(row.refresh_token_expires_at) <= Date.now()) {
    throw new PublishError("The provider refresh token has expired. Reconnect this social account.", { code: "REAUTHORIZATION_REQUIRED" });
  }
  const claimed = await db.rpc("claim_social_token_refresh", { p_social_account_id: account.id, p_worker_id: workerId, p_stale_after_seconds: 120 });
  if (claimed.error) throw new Error("Unable to acquire token refresh lock: " + claimed.error.message);
  if (!claimed.data) throw new PublishError("Another worker is refreshing this account token; retry shortly.", { code: "TOKEN_REFRESH_IN_PROGRESS", retryable: true, retryAfterMs: 15000 });
  try {
    const current = await must(await db.from("social_account_tokens").select("*").eq("social_account_id", account.id).eq("organization_id", account.organization_id).single(), "Token lookup failed during refresh");
    if (current.access_token_expires_at && Date.parse(current.access_token_expires_at) > Date.now() + 120000) return;
    const refreshToken = decryptStoredToken(pgBytea(current.refresh_token_nonce), pgBytea(current.refresh_token_ciphertext), pgBytea(current.refresh_token_tag), current.encryption_key_version);
    const clientId = account.platform === "youtube" ? process.env.GOOGLE_CLIENT_ID : process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = account.platform === "youtube" ? process.env.GOOGLE_CLIENT_SECRET : process.env.LINKEDIN_CLIENT_SECRET;
    const tokenUrl = account.platform === "youtube" ? "https://oauth2.googleapis.com/token" : "https://www.linkedin.com/oauth/v2/accessToken";
    if (!clientId || !clientSecret) throw new PublishError("OAuth client credentials are not configured for token refresh.", { code: "PROVIDER_NOT_CONFIGURED" });
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store"
    });
    let result = {};
    try { result = await response.json(); } catch { /* handled below */ }
    if (!response.ok || !result.access_token) {
      const invalidGrant = response.status === 400 || response.status === 401;
      throw new PublishError(invalidGrant ? "Provider rejected the refresh token. Reconnect this account." : "OAuth token refresh failed.",
        { code: invalidGrant ? "REAUTHORIZATION_REQUIRED" : "TOKEN_REFRESH_FAILED", retryable: !invalidGrant && (response.status === 429 || response.status >= 500), retryAfterMs: Number(response.headers.get("retry-after")) * 1000 || null });
    }
    const access = encryptStoredToken(result.access_token);
    const rotatedRefresh = encryptStoredToken(result.refresh_token || refreshToken);
    const updated = await db.from("social_account_tokens").update({
      access_token_nonce: "\\x" + access.nonce.toString("hex"),
      access_token_ciphertext: "\\x" + access.ciphertext.toString("hex"),
      access_token_tag: "\\x" + access.tag.toString("hex"),
      refresh_token_nonce: "\\x" + rotatedRefresh.nonce.toString("hex"),
      refresh_token_ciphertext: "\\x" + rotatedRefresh.ciphertext.toString("hex"),
      refresh_token_tag: "\\x" + rotatedRefresh.tag.toString("hex"),
      access_token_expires_at: result.expires_in ? new Date(Date.now() + Number(result.expires_in) * 1000).toISOString() : null,
      refresh_token_expires_at: result.refresh_token_expires_in ? new Date(Date.now() + Number(result.refresh_token_expires_in) * 1000).toISOString() : current.refresh_token_expires_at,
      encryption_key_version: access.keyVersion,
      token_type: result.token_type || current.token_type || "Bearer",
      last_refreshed_at: new Date().toISOString()
    }).eq("social_account_id", account.id).eq("organization_id", account.organization_id);
    if (updated.error) throw new Error("Unable to persist refreshed OAuth token: " + updated.error.message);
  } finally {
    await db.rpc("release_social_token_refresh", { p_social_account_id: account.id, p_worker_id: workerId });
  }
}
async function getToken(account) {
  const row = await must(await db.from("social_account_tokens").select("*").eq("social_account_id", account.id).eq("organization_id", account.organization_id).single(), "Encrypted credentials not found");
  if (row.access_token_expires_at && Date.parse(row.access_token_expires_at) <= Date.now() + 120_000) {
    try {
      await refreshProviderToken(account, row);
    } catch (error) {
      if (error.code === "REAUTHORIZATION_REQUIRED" || error.code === "TOKEN_KEY_VERSION_MISMATCH") {
        await db.from("social_accounts").update({ connection_status: "reauthorization_required", last_error: error.message }).eq("id", account.id);
      }
      throw error;
    }
  }
  const latest = await must(await db.from("social_account_tokens").select("*").eq("social_account_id", account.id).eq("organization_id", account.organization_id).single(), "Unable to reload OAuth credentials");
  try {
    return decryptStoredToken(pgBytea(latest.access_token_nonce), pgBytea(latest.access_token_ciphertext), pgBytea(latest.access_token_tag), latest.encryption_key_version);
  } catch {
    await db.from("social_accounts").update({ connection_status: "error", last_error: "Credential decryption failed." }).eq("id", account.id);
    throw new PublishError("Stored credentials could not be decrypted.", { code: "TOKEN_DECRYPTION_FAILED" });
  }
}
function requiredProfile(platform, kind) {
  if (kind === "video") {
    if (platform === "youtube" || platform === "linkedin") return "landscape";
    if (platform === "threads") return "square";
    return "vertical";
  }
  if (platform === "youtube" || platform === "linkedin") return "landscape";
  if (platform === "pinterest") return "pin";
  if (platform === "threads") return "square";
  return "portrait";
}
async function getMedia(versionId, organizationId, platform) {
  const rows = await must(await db.from("social_post_version_media").select("position,alt_text,asset_id").eq("version_id", versionId).eq("organization_id", organizationId).order("position"), "Content-version media lookup failed");
  const output = [];
  for (const row of rows) {
    const asset = await must(await db.from("social_media_assets").select("*").eq("id", row.asset_id).eq("organization_id", organizationId).single(), "Media asset lookup failed");
    if (asset.processing_status !== "ready") throw new PublishError("A selected media asset is not ready.", { code: "MEDIA_NOT_READY" });
    const processing = asset.metadata?.processing;
    const kind = processing?.kind;
    if (!["image", "video"].includes(kind)) throw new PublishError("Processed media metadata is missing.", { code: "MEDIA_DERIVATIVE_MISSING" });
    const profile = requiredProfile(platform, kind);
    const derivative = (processing.derivatives || []).find(item => item.profile === profile);
    if (!derivative?.objectKey) throw new PublishError("Required " + profile + " media derivative is missing.", { code: "MEDIA_DERIVATIVE_MISSING" });
    const bucket = asset.storage_bucket || "social-media";
    if (platform === "youtube") {
      const { data: blob, error } = await db.storage.from(bucket).download(derivative.objectKey);
      if (error || !blob) throw new PublishError("Unable to retrieve the prepared YouTube video.", { code: "MEDIA_DOWNLOAD_FAILED", retryable: true });
      const bytes = Buffer.from(await blob.arrayBuffer());
      if (!bytes.length || bytes.length > maxVideoBytes) throw new PublishError("Prepared video exceeds the publisher upload limit.", { code: "MEDIA_SIZE_LIMIT" });
      output.push({ kind, profile, bytes, altText: row.alt_text });
    } else {
      const { data, error } = await db.storage.from(bucket).createSignedUrl(derivative.objectKey, signedUrlSeconds);
      if (error || !data?.signedUrl) throw new PublishError("Unable to create temporary media delivery URL.", { code: "SIGNED_URL_FAILED", retryable: true });
      output.push({ kind, profile, signedUrl: data.signedUrl, altText: row.alt_text });
    }
  }
  return output;
}
async function refreshPostStatus(postId, organizationId) {
  const targets = await must(await db.from("social_post_targets").select("status").eq("post_id", postId).eq("organization_id", organizationId), "Unable to summarize post targets");
  if (!targets.length) return;
  const statuses = targets.map(item => item.status);
  const published = statuses.filter(status => status === "published").length;
  const failed = statuses.filter(status => status === "failed").length;
  const skipped = statuses.filter(status => status === "skipped").length;
  const cancelled = statuses.filter(status => status === "cancelled").length;
  const terminal = published + failed + skipped + cancelled === statuses.length;
  let status = "processing";
  if (published === statuses.length) status = "published";
  else if (terminal && published > 0) status = "partially_published";
  else if (terminal && published === 0 && failed + skipped > 0) status = "failed";
  else if (terminal && cancelled === statuses.length) status = "cancelled";
  await must(await db.from("social_posts").update({
    status,
    published_at: published > 0 ? new Date().toISOString() : null,
    last_error_code: failed > 0 ? "ONE_OR_MORE_TARGETS_FAILED" : null
  }).eq("id", postId).eq("organization_id", organizationId), "Unable to update post aggregate status");
}
async function finish(job, target, publication) {
  const now = new Date().toISOString();
  await must(await db.from("social_post_targets").update({
    status: "published", platform_post_id: publication.externalPostId,
    platform_permalink: publication.permalink, published_at: now,
    last_error_code: null, last_error_message: null
  }).eq("id", target.id).eq("organization_id", job.organization_id), "Unable to record published target");
  await must(await db.from("publish_jobs").update({
    status: "succeeded", locked_at: null, locked_by: null, completed_at: now,
    last_error_code: null, last_error_message: null
  }).eq("id", job.id), "Unable to complete publishing job");
  await refreshPostStatus(target.post_id, job.organization_id);
  await db.from("audit_events").insert({
    organization_id: job.organization_id, action: "social.post.published",
    resource_type: "social_post_target", resource_id: target.id,
    metadata: { platform: publication.platform || null, external_post_id: publication.externalPostId }
  });
}
async function fail(job, target, error) {
  const policy = classifyPublishFailure(error, job.attempt_count, job.max_attempts);
  const { code, ambiguous, retryable, terminal } = policy;
  const status = terminal ? "dead_letter" : "retry";
  const now = new Date().toISOString();
  const message = safeMessage(error);
  await must(await db.from("publish_jobs").update({
    status, available_at: new Date(Date.now() + (terminal ? 0 : computeRetryDelay({ attemptCount: job.attempt_count, retryAfterMs: error?.retryAfterMs }))).toISOString(),
    locked_at: null, locked_by: null, completed_at: terminal ? now : null,
    last_error_code: ambiguous ? "PUBLISH_OUTCOME_UNKNOWN" : code,
    last_error_message: ambiguous ? "Provider outcome is uncertain. Manual reconciliation is required before retry." : message
  }).eq("id", job.id), "Unable to update publishing job failure");
  await must(await db.from("social_post_targets").update({
    status: terminal ? "failed" : "queued",
    last_error_code: ambiguous ? "PUBLISH_OUTCOME_UNKNOWN" : code,
    last_error_message: ambiguous ? "Provider outcome is uncertain; reconcile externally before retrying." : message
  }).eq("id", target.id).eq("organization_id", job.organization_id), "Unable to update target failure");
  await refreshPostStatus(target.post_id, job.organization_id);
  if (terminal) {
    await db.from("social_accounts").update({
      ...(code === "REAUTHORIZATION_REQUIRED" || code === "MISSING_PUBLISH_SCOPES" || code === "AUTHORIZATION_REVOKED" || code === "PROVIDER_PERMISSION_DENIED" ? { connection_status: "reauthorization_required" } : {}),
      last_error: message
    }).eq("id", target.social_account_id);
  }
  await db.from("audit_events").insert({
    organization_id: job.organization_id, action: ambiguous ? "social.post.outcome_unknown" : "social.post.publish_failed",
    resource_type: "social_post_target", resource_id: target.id,
    metadata: { error_code: ambiguous ? "PUBLISH_OUTCOME_UNKNOWN" : code, retryable, terminal }
  });
}
async function handleJob(job) {
  let target;
  let context;
  let rateLimitScope;
  try {
    context = await getTarget(job);
    const appId = context.account.platform === "facebook" || context.account.platform === "instagram"
      ? process.env.META_APP_ID
      : context.account.platform === "youtube" ? process.env.GOOGLE_CLIENT_ID
      : context.account.platform === "linkedin" ? process.env.LINKEDIN_CLIENT_ID : "default";
    rateLimitScope = { platform: context.account.platform, accountId: context.account.id, appId: appId || "default" };
    target = context.target;
    if (target.status === "published" || target.platform_post_id) {
      await must(await db.from("publish_jobs").update({ status: "succeeded", locked_at: null, locked_by: null, completed_at: new Date().toISOString() }).eq("id", job.id), "Unable to close already-published job");
      return;
    }
    if (target.status === "cancelled" || target.status === "skipped") {
      await must(await db.from("publish_jobs").update({ status: "cancelled", locked_at: null, locked_by: null, completed_at: new Date().toISOString() }).eq("id", job.id), "Unable to close cancelled job");
      return;
    }
    await must(await db.from("social_post_targets").update({ status: "publishing" }).eq("id", target.id), "Unable to mark target publishing");
    await must(await db.from("social_posts").update({ status: "processing" }).eq("id", context.post.id).eq("organization_id", job.organization_id), "Unable to mark post processing");
    const token = await getToken(context.account);
    const media = await getMedia(context.contentVersion.id, job.organization_id, context.account.platform);
    await waitForProviderCapacity(rateLimitScope);
    const publication = await publishTarget({
      account: { ...context.account, granted_scopes: context.account.granted_scopes || [] },
      token,
      post: {
        ...context.post,
        title: context.contentVersion.title ?? context.post.title,
        body: context.contentVersion.body,
        platformOptions: context.contentVersion.platform_options
      },
      media
    });
    await finish(job, target, { ...publication, platform: context.account.platform });
  } catch (error) {
    if (rateLimitScope && (error?.code === "META_HTTP_429" || error?.code === "FACEBOOK_HTTP_429" || error?.code === "INSTAGRAM_HTTP_429" || error?.code === "LINKEDIN_HTTP_429" || error?.code === "YOUTUBE_HTTP_429")) {
      try { await deferProviderCapacity(rateLimitScope, error.retryAfterMs || 60000); }
      catch (coordinationError) { process.stderr.write(JSON.stringify({ event: "provider_rate_limit_persist_failed", jobId: job.id, code: coordinationError.code || "RATE_LIMIT_COORDINATOR_UNAVAILABLE" }) + "\\n"); }
    }
    const lookup = await db.from("social_post_targets").select("*").eq("id", job.target_id).eq("organization_id", job.organization_id).maybeSingle();
    if (lookup.data?.platform_post_id) {
      await db.from("publish_jobs").update({
        status: "succeeded", locked_at: null, locked_by: null,
        completed_at: new Date().toISOString(), last_error_code: null, last_error_message: null
      }).eq("id", job.id);
      await refreshPostStatus(lookup.data.post_id, job.organization_id);
      return;
    }
    target = lookup.data || target;
    if (target) await fail(job, target, error);
    else {
      await db.from("publish_jobs").update({ status: "dead_letter", locked_at: null, locked_by: null, completed_at: new Date().toISOString(), last_error_code: "TARGET_LOOKUP_FAILED", last_error_message: safeMessage(error) }).eq("id", job.id);
    }
    process.stderr.write(JSON.stringify({ event: "publish_failed", jobId: job.id, code: error.code || "PUBLISH_ERROR", ambiguous: Boolean(error.ambiguous) }) + "\n");
  }
}
async function poll() {
  const { error: recoveryError } = await db.rpc("recover_stale_publish_jobs", { p_lease_minutes: 15 });
  if (recoveryError) throw recoveryError;
  const { data, error } = await db.rpc("claim_publish_jobs", { p_worker_id: workerId, p_limit: 1 });
  if (error) throw error;
  for (const job of data || []) await handleJob(job);
  return (data || []).length;
}
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
console.log(JSON.stringify({ event: "publisher_started", workerId }));
while (!stopping) {
  try { if ((await poll()) === 0) await new Promise(resolve => setTimeout(resolve, pollMs)); }
  catch (error) { process.stderr.write(String(error.message || error) + "\n"); await new Promise(resolve => setTimeout(resolve, 5000)); }
}
await closeProviderRateLimiter();
console.log(JSON.stringify({ event: "publisher_stopped", workerId }));
