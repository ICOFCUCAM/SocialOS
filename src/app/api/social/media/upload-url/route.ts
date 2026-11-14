import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createSocialAdminClient } from "@/lib/social/admin";
import { hasBrandAccess } from "@/lib/brand-permissions";

export const runtime = "nodejs";

const BUCKET = "social-media";
const MAX_FILE_BYTES = 250 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/quicktime", "video/webm",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const organizationId = typeof input.organizationId === "string" ? input.organizationId : "";
  const brandId = typeof input.brandId === "string" ? input.brandId : "";
  const filename = typeof input.filename === "string" ? input.filename.trim() : "";
  const mimeType = typeof input.mimeType === "string" ? input.mimeType.toLowerCase() : "";
  const size = typeof input.size === "number" ? input.size : 0;
  if (!UUID.test(organizationId) || !UUID.test(brandId)) {
    return NextResponse.json({ error: "Valid workspace and brand IDs are required." }, { status: 400 });
  }
  if (!filename || filename.length > 240 || /[\\/\u0000-\u001f]/.test(filename)) {
    return NextResponse.json({ error: "Filename is invalid." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "This image or video format is not supported." }, { status: 415 });
  }
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File must be between 1 byte and 250 MB." }, { status: 413 });
  }

  const { data: member } = await supabase.from("organization_members")
    .select("role").eq("organization_id", organizationId).eq("user_id", user.id)
    .eq("status", "active").maybeSingle();
  if (!member || !["owner", "administrator", "manager", "editor", "publisher"].includes(member.role)) {
    return NextResponse.json({ error: "You do not have permission to upload media to this workspace." }, { status: 403 });
  }
  const { data: brand } = await supabase.from("brands").select("id")
    .eq("id", brandId).eq("organization_id", organizationId).eq("is_active", true).maybeSingle();
  if (!brand) return NextResponse.json({ error: "Active brand not found." }, { status: 404 });
  if (!(await hasBrandAccess(supabase, user.id, organizationId, brandId, "edit"))) {
    return NextResponse.json({ error: "You do not have permission to upload media to this brand." }, { status: 403 });
  }

  const assetId = randomUUID();
  const safeExtension = filename.includes(".") ? filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) : "";
  const objectKey = `${organizationId}/${brandId}/${assetId}${safeExtension ? `.${safeExtension}` : ""}`;
  const admin = createSocialAdminClient();

  const { error: insertError } = await admin.from("social_media_assets").insert({
    id: assetId, organization_id: organizationId, brand_id: brandId, uploaded_by: user.id,
    storage_bucket: BUCKET, storage_object_key: objectKey, original_filename: filename,
    mime_type: mimeType, file_size_bytes: size, processing_status: "pending",
    metadata: { upload_state: "awaiting_upload" },
  });
  if (insertError) return NextResponse.json({ error: "Unable to initialise media asset." }, { status: 500 });

  const { data: signed, error: signError } = await admin.storage.from(BUCKET)
    .createSignedUploadUrl(objectKey, { upsert: false });
  if (signError || !signed) {
    await admin.from("social_media_assets").delete().eq("id", assetId);
    return NextResponse.json({ error: "Unable to issue a secure upload URL." }, { status: 503 });
  }

  return NextResponse.json({
    assetId,
    bucket: BUCKET,
    path: signed.path,
    token: signed.token,
    signedUrl: signed.signedUrl,
    maxBytes: MAX_FILE_BYTES,
  }, { status: 201 });
}
