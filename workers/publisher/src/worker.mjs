import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createDecipheriv } from "node:crypto";
import { publishTarget } from "./providers/index.mjs";
import { PublishError } from "./errors.mjs";

const supabaseUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const db = createClient(supabaseUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });
const workerId = process.env.PUBLISH_WORKER_ID || "publisher-" + randomUUID();
const pollMs = Math.max(500, Number(process.env.PUBLISH_POLL_INTERVAL_MS) || 2500);
const signedUrlSeconds = Math.max(60, Math.min(900, Number(process.env.PUBLISH_MEDIA_URL_TTL_SECONDS) || 600));
const maxVideoBytes = Math.max(1, Number(process.env.PUBLISH_MAX_VIDEO_BYTES) || 250 * 1024 * 1024);
let stopping = false;

function decryptStoredToken(nonce, ciphertext, tag) {\n  const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;\n  if (!raw) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured.");\n  const encryptionKey = Buffer.from(raw, "base64");\n  if (encryptionKey.length !== 32) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must decode to 32 bytes.");\n  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, nonce);\n  decipher.setAuthTag(tag);\n  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");\n}\nfunction pgBytea(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value !== "string") throw new Error("Encrypted token field is missing.");
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("Encrypted token field has invalid bytea encoding.");
  return Buffer.from(hex, "hex");
}
function safeMessage(error) {
  return String(error?.message || "Publishing failed").replace(/(?:access_token|Bearer)\s*[:=]?\s*[^\s&]+/gi, "[REDACTED]").slice(0, 1200);
}
function retryDelay(job, error) {
  if (error?.retryAfterMs && Number.isFinite(error.retryAfterMs)) return Math.min(6 * 60 * 60 * 1000, Math.max(1000, error.retryAfterMs));
  const base = Math.min(60 * 60 * 1000, 30_000 * (2 ** Math.max(0, job.attempt_count - 1)));
  return Math.round(base * (0.8 + Math.random() * 0.4));
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
  return { target, post, account: { ...account, platform: platform.code } };
}
async function getToken(account) {
  const row = await must(await db.from("social_account_tokens").select("*").eq("social_account_id", account.id).eq("organization_id", account.organization_id).single(), "Encrypted credentials not found");
  if (row.access_token_expires_at && Date.parse(row.access_token_expires_at) <= Date.now() + 60_000) {
    await db.from("social_accounts").update({ connection_status: "reauthorization_required", last_error: "Access token expired; reconnect this account." }).eq("id", account.id);
    throw new PublishError("Social account credentials have expired and must be refreshed by reconnecting.", { code: "REAUTHORIZATION_REQUIRED" });
  }
  try {
    return decryptStoredToken(pgBytea(row.access_token_nonce), pgBytea(row.access_token_ciphertext), pgBytea(row.access_token_tag));
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
async function getMedia(postId, organizationId, platform) {
  const rows = await must(await db.from("social_post_media").select("position,alt_text,asset_id").eq("post_id", postId).eq("organization_id", organizationId).order("position"), "Post media lookup failed");
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
  const code = error.code || "PUBLISH_ERROR";
  const ambiguous = Boolean(error.ambiguous);
  const retryable = Boolean(error.retryable) && !ambiguous;
  const terminal = ambiguous || !retryable || job.attempt_count >= job.max_attempts;
  const status = terminal ? "dead_letter" : "retry";
  const now = new Date().toISOString();
  const message = safeMessage(error);
  await must(await db.from("publish_jobs").update({
    status, available_at: new Date(Date.now() + (terminal ? 0 : retryDelay(job, error))).toISOString(),
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
      ...(code === "REAUTHORIZATION_REQUIRED" || code === "MISSING_PUBLISH_SCOPES" ? { connection_status: "reauthorization_required" } : {}),
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
  try {
    const context = await getTarget(job);
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
    const media = await getMedia(context.post.id, job.organization_id, context.account.platform);
    const publication = await publishTarget({
      account: { ...context.account, granted_scopes: context.account.granted_scopes || [] },
      token,
      post: { ...context.post, body: target.caption_override ?? context.post.body, platformOptions: target.platform_options || {} },
      media
    });
    await finish(job, target, { ...publication, platform: context.account.platform });
  } catch (error) {
    if (!target) {
      const lookup = await db.from("social_post_targets").select("*").eq("id", job.target_id).eq("organization_id", job.organization_id).maybeSingle();
      target = lookup.data;
    }
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
console.log(JSON.stringify({ event: "publisher_stopped", workerId }));
