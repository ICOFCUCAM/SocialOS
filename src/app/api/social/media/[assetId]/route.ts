import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  if (!UUID.test(assetId)) return NextResponse.json({ error: "Invalid asset ID." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: asset, error } = await supabase.from("social_media_assets")
    .select("id,brand_id,original_filename,mime_type,file_size_bytes,width,height,duration_ms,processing_status,metadata,created_at")
    .eq("id", assetId).maybeSingle();
  if (error || !asset) return NextResponse.json({ error: "Media asset not found." }, { status: 404 });

  const metadata = asset.metadata && typeof asset.metadata === "object"
    ? asset.metadata as Record<string, unknown> : {};
  return NextResponse.json({
    id: asset.id,
    brandId: asset.brand_id,
    filename: asset.original_filename,
    mimeType: asset.mime_type,
    sizeBytes: asset.file_size_bytes,
    dimensions: asset.width && asset.height ? { width: asset.width, height: asset.height } : null,
    durationMs: asset.duration_ms,
    processingStatus: asset.processing_status,
    uploadState: metadata.upload_state ?? "unknown",
    createdAt: asset.created_at,
  });
}
