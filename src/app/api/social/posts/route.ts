import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "A post payload is required." }, { status: 400 });
  }

  const input = payload as Record<string, unknown>;
  const organizationId = typeof input.organizationId === "string" ? input.organizationId : "";
  const brandId = typeof input.brandId === "string" ? input.brandId : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body : "";
  const timezone = typeof input.timezone === "string" ? input.timezone : "UTC";
  const scheduledAt = typeof input.scheduledAt === "string" ? input.scheduledAt : null;
  const targetAccountIds = Array.isArray(input.targetAccountIds) ? input.targetAccountIds : [];
  const assetIds = Array.isArray(input.assetIds) ? input.assetIds : [];

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(organizationId) || !uuid.test(brandId)) {
    return NextResponse.json({ error: "Valid organizationId and brandId are required." }, { status: 400 });
  }
  if (body.length > 20_000 || title.length > 200) {
    return NextResponse.json({ error: "Post title or body exceeds the supported length." }, { status: 400 });
  }
  if (targetAccountIds.length < 1 || targetAccountIds.length > 20 ||
      !targetAccountIds.every((id) => typeof id === "string" && uuid.test(id))) {
    return NextResponse.json({ error: "Select between 1 and 20 valid destination accounts." }, { status: 400 });
  }
  if (assetIds.length > 20 || !assetIds.every((id) => typeof id === "string" && uuid.test(id))) {
    return NextResponse.json({ error: "Media asset selection is invalid." }, { status: 400 });
  }
  if (scheduledAt && (!Number.isFinite(Date.parse(scheduledAt)) || Date.parse(scheduledAt) <= Date.now())) {
    return NextResponse.json({ error: "scheduledAt must be a valid future date." }, { status: 400 });
  }
  if (timezone.length > 80) {
    return NextResponse.json({ error: "Timezone value is invalid." }, { status: 400 });
  }

  const { data: postId, error } = await supabase.rpc("create_social_post_bundle", {
    p_payload: {
      organization_id: organizationId,
      brand_id: brandId,
      title,
      body,
      timezone,
      scheduled_at: scheduledAt,
      target_account_ids: targetAccountIds,
      asset_ids: assetIds,
    },
  });

  if (error) {
    const forbidden = error.code === "42501";
    return NextResponse.json(
      { error: forbidden ? "You do not have permission to create this post or use one of its resources." : "The post could not be created." },
      { status: forbidden ? 403 : 400 },
    );
  }

  return NextResponse.json({ id: postId, status: scheduledAt ? "scheduled" : "draft" }, { status: 201 });
}
