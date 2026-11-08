import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSocialAdminClient } from "@/lib/social/admin";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }
  const assetId = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).assetId : null;
  if (typeof assetId !== "string" || !UUID.test(assetId)) {
    return NextResponse.json({ error: "A valid assetId is required." }, { status: 400 });
  }

  // RLS proves that this user can access the asset's brand and tenant.
  const { data: asset, error: assetError } = await supabase.from("social_media_assets")
    .select("id,organization_id,brand_id,storage_bucket,storage_object_key,mime_type,file_size_bytes,processing_status,metadata")
    .eq("id", assetId).maybeSingle();
  if (assetError || !asset) return NextResponse.json({ error: "Media asset not found." }, { status: 404 });

  const admin = createSocialAdminClient();
  const segments = asset.storage_object_key.split("/");
  const filename = segments.pop();
  const folder = segments.join("/");
  if (!filename || asset.storage_bucket !== "social-media") {
    return NextResponse.json({ error: "Media object reference is invalid." }, { status: 409 });
  }
  const { data: objects, error: listError } = await admin.storage.from(asset.storage_bucket)
    .list(folder, { search: filename, limit: 10 });
  if (listError) return NextResponse.json({ error: "Unable to verify uploaded media." }, { status: 503 });
  const object = objects?.find((entry) => entry.name === filename);
  if (!object) return NextResponse.json({ error: "Upload has not completed yet." }, { status: 409 });

  const actualSize = Number(object.metadata?.size ?? object.metadata?.contentLength ?? 0);
  const actualType = String(object.metadata?.mimetype ?? object.metadata?.contentType ?? "");
  if (!actualSize || actualSize !== asset.file_size_bytes || actualSize > 250 * 1024 * 1024) {
    await admin.storage.from(asset.storage_bucket).remove([asset.storage_object_key]);
    await admin.from("social_media_assets").update({
      processing_status: "failed",
      metadata: { ...((asset.metadata as Record<string, unknown>) ?? {}), upload_state: "rejected", rejection_reason: "size_mismatch" },
    }).eq("id", asset.id);
    return NextResponse.json({ error: "Uploaded file size did not match the declared size." }, { status: 422 });
  }
  if (actualType && actualType.toLowerCase() !== asset.mime_type.toLowerCase()) {
    await admin.storage.from(asset.storage_bucket).remove([asset.storage_object_key]);
    await admin.from("social_media_assets").update({
      processing_status: "failed",
      metadata: { ...((asset.metadata as Record<string, unknown>) ?? {}), upload_state: "rejected", rejection_reason: "mime_mismatch" },
    }).eq("id", asset.id);
    return NextResponse.json({ error: "Uploaded file type did not match the declared type." }, { status: 422 });
  }

  const { error: updateError } = await admin.from("social_media_assets").update({
    metadata: { ...((asset.metadata as Record<string, unknown>) ?? {}), upload_state: "uploaded", uploaded_at: new Date().toISOString() },
  }).eq("id", asset.id);
  if (updateError) return NextResponse.json({ error: "Upload verified but asset state could not be updated." }, { status: 500 });

  return NextResponse.json({
    assetId: asset.id,
    status: "uploaded",
    processingStatus: "pending",
    message: "Upload verified. Media processing is the next stage; the asset cannot be published until it passes processing and safety checks.",
  });
}
