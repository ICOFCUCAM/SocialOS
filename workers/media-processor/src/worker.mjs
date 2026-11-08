import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { mkdtemp, readFile, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const bucket = process.env.MEDIA_BUCKET || "social-media";
const workerId = process.env.WORKER_ID || "media-" + randomUUID();
const waitMs = Math.max(500, Number(process.env.POLL_INTERVAL_MS) || 2500);
const maxBytes = 250 * 1024 * 1024;
const maxPixels = 40_000_000;
let stopping = false;

function signature(b) {
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString())) return "image/gif";
  if (b.subarray(4, 8).toString() === "ftyp") return "video/mp4";
  if (b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "video/webm";
  return null;
}

function command(bin, args, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let out = Buffer.alloc(0), err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdout.on("data", chunk => { out = Buffer.concat([out, chunk]); if (out.length > 2_000_000) child.kill("SIGKILL"); });
    child.stderr.on("data", chunk => { err = (err + chunk.toString()).slice(-4000); });
    child.on("error", e => { clearTimeout(timer); reject(e); });
    child.on("close", code => {
      clearTimeout(timer);
      code === 0 ? resolve(out) : reject(new Error(bin + " failed (" + code + "): " + err));
    });
  });
}

async function update(table, id, values) {
  const { error } = await db.from(table).update(values).eq("id", id);
  if (error) throw error;
}
async function put(objectKey, file, contentType) {
  const body = await readFile(file);
  const { error } = await db.storage.from(bucket).upload(objectKey, body, { contentType, upsert: true });
  if (error) throw error;
  return { objectKey, contentType, bytes: body.length };
}

async function processAsset(job) {
  const { data: asset, error } = await db.from("social_media_assets").select("*")
    .eq("id", job.asset_id).eq("organization_id", job.organization_id).single();
  if (error || !asset) throw Object.assign(new Error("Asset record not found"), { code: "ASSET_NOT_FOUND" });
  const { data: blob, error: downloadError } = await db.storage.from(asset.storage_bucket || bucket).download(asset.storage_object_key);
  if (downloadError || !blob) throw Object.assign(new Error("Original media download failed"), { code: "DOWNLOAD_FAILED" });
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (!bytes.length || bytes.length > maxBytes || (asset.file_size_bytes && bytes.length !== asset.file_size_bytes))
    throw Object.assign(new Error("Media size validation failed"), { code: "SIZE_MISMATCH" });
  const detected = signature(bytes);
  if (!detected) throw Object.assign(new Error("Unsupported file signature"), { code: "INVALID_SIGNATURE", quarantine: true });
  if (detected.startsWith("image/") !== String(asset.mime_type).startsWith("image/"))
    throw Object.assign(new Error("Declared MIME category does not match file signature"), { code: "MIME_MISMATCH", quarantine: true });

  const dir = await mkdtemp(path.join(tmpdir(), "socialos-"));
  try {
    const input = path.join(dir, "source.bin");
    await writeFile(input, bytes, { flag: "wx", mode: 0o600 });
    let result;
    if (detected.startsWith("image/")) {
      const meta = await sharp(input, { limitInputPixels: maxPixels, failOn: "error" }).metadata();
      if (!meta.width || !meta.height || meta.width * meta.height > maxPixels)
        throw Object.assign(new Error("Image pixel limit exceeded"), { code: "IMAGE_LIMIT" });
      const preview = path.join(dir, "preview.webp");
      await sharp(input, { limitInputPixels: maxPixels, failOn: "error" }).rotate()
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 84 }).toFile(preview);
      const derivative = await put(asset.organization_id + "/" + asset.brand_id + "/" + asset.id + "/preview.webp", preview, "image/webp");
      result = { kind: "image", width: meta.width, height: meta.height, derivatives: [derivative] };
    } else {
      const raw = await command("ffprobe", ["-v","error","-show_entries","format=duration:stream=codec_type,width,height,duration","-of","json",input], 30000);
      const probe = JSON.parse(raw.toString());
      const stream = (probe.streams || []).find(s => s.codec_type === "video");
      const duration = Number(probe.format?.duration || stream?.duration || 0);
      if (!stream || !Number.isFinite(duration) || duration <= 0 || duration > 7200 || stream.width * stream.height > maxPixels)
        throw Object.assign(new Error("Video stream, duration or dimensions exceed limits"), { code: "VIDEO_LIMIT" });
      const poster = path.join(dir, "poster.jpg");
      await command("ffmpeg", ["-nostdin","-v","error","-i",input,"-ss","1","-frames:v","1","-vf","scale=1280:-2","-q:v","3","-y",poster], 60000);
      const posterDerivative = await put(asset.organization_id + "/" + asset.brand_id + "/" + asset.id + "/poster.jpg", poster, "image/jpeg");

      // Create a broadly compatible H.264/AAC mezzanine for downstream platform adapters.
      const mezzanine = path.join(dir, "mezzanine.mp4");
      await command("ffmpeg", [
        "-nostdin","-v","error","-i",input,
        "-map","0:v:0","-map","0:a:0?",
        "-vf","scale='min(1920,iw)':-2",
        "-c:v","libx264","-preset","veryfast","-crf","23","-pix_fmt","yuv420p",
        "-c:a","aac","-b:a","128k","-movflags","+faststart","-f","mp4","-y",mezzanine
      ], 15 * 60 * 1000);
      const mezzanineInfo = await stat(mezzanine);
      if (!mezzanineInfo.size || mezzanineInfo.size > maxBytes) {
        throw Object.assign(new Error("Transcoded video exceeds the derivative size limit"), { code: "DERIVATIVE_SIZE_LIMIT" });
      }
      const videoDerivative = await put(asset.organization_id + "/" + asset.brand_id + "/" + asset.id + "/mezzanine.mp4", mezzanine, "video/mp4");
      result = {
        kind: "video", width: stream.width, height: stream.height,
        durationMs: Math.round(duration * 1000),
        derivatives: [posterDerivative, videoDerivative]
      };
    }
    await update("social_media_assets", asset.id, {
      processing_status: "ready", width: result.width, height: result.height,
      duration_ms: result.durationMs || null,
      checksum_sha256: createHash("sha256").update(bytes).digest("hex"),
      metadata: { ...(asset.metadata || {}), detectedMimeType: detected, processing: result, processedAt: new Date().toISOString() }
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function handle(job) {
  try {
    await update("social_media_assets", job.asset_id, { processing_status: "processing" });
    await processAsset(job);
    await update("media_processing_jobs", job.id, {
      status: "succeeded", locked_at: null, locked_by: null,
      completed_at: new Date().toISOString(), last_error_code: null, last_error_message: null
    });
  } catch (e) {
    const terminal = Boolean(e.quarantine) || job.attempt_count >= job.max_attempts;
    await update("media_processing_jobs", job.id, {
      status: terminal ? (e.quarantine ? "failed" : "dead_letter") : "retry",
      available_at: new Date(Date.now() + Math.min(60, 2 ** job.attempt_count) * 60000).toISOString(),
      locked_at: null, locked_by: null, completed_at: terminal ? new Date().toISOString() : null,
      last_error_code: e.code || "PROCESSING_ERROR", last_error_message: String(e.message || e).slice(0, 1500)
    });
    if (terminal) await update("social_media_assets", job.asset_id, { processing_status: e.quarantine ? "quarantined" : "failed" });
    process.stderr.write(JSON.stringify({ event: "job_failed", jobId: job.id, error: String(e.message || e) }) + "\n");
  }
}

async function poll() {
  const { error: recoveryError } = await db.rpc("recover_stale_media_processing_jobs", { p_lease_minutes: 20 });
  if (recoveryError) throw recoveryError;
  const { data, error } = await db.rpc("claim_media_processing_jobs", { p_worker_id: workerId, p_limit: 2 });
  if (error) throw error;
  for (const job of data || []) await handle(job);
  return (data || []).length;
}
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
console.log(JSON.stringify({ event: "worker_started", workerId }));
while (!stopping) {
  try { if ((await poll()) === 0) await new Promise(r => setTimeout(r, waitMs)); }
  catch (e) { process.stderr.write(String(e.message || e) + "\n"); await new Promise(r => setTimeout(r, 5000)); }
}
console.log(JSON.stringify({ event: "worker_stopped", workerId }));
