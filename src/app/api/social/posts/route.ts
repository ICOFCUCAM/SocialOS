import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlatformCapability } from "@/lib/social/capabilities";

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
  const accountVersions = Array.isArray(input.accountVersions) ? input.accountVersions : [];

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
  if (accountVersions.length > 20 || !accountVersions.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    return NextResponse.json({ error: "Account-specific versions are invalid." }, { status: 400 });
  }
  const versionAccountIds = accountVersions.map((item) => (item as Record<string, unknown>).accountId);
  if (new Set(versionAccountIds).size !== versionAccountIds.length || versionAccountIds.some((id) => typeof id !== "string" || !targetAccountIds.includes(id))) {
    return NextResponse.json({ error: "Each account version must target one selected account exactly once." }, { status: 400 });
  }
  for (const item of accountVersions as Record<string, unknown>[]) {
    if (typeof item.body !== "string" || item.body.length > 20000 ||
        (item.assetIds !== undefined && (!Array.isArray(item.assetIds) || item.assetIds.length > 20 || !item.assetIds.every((id) => typeof id === "string" && uuid.test(id))))) {
      return NextResponse.json({ error: "Account-specific copy or media selection is invalid." }, { status: 400 });
    }
    if (item.platformOptions !== undefined && (!item.platformOptions || typeof item.platformOptions !== "object" || Array.isArray(item.platformOptions))) {
      return NextResponse.json({ error: "Platform options must be an object." }, { status: 400 });
    }
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

  // Revalidate adapter and media compatibility on the server; client-side checks
  // are UX only and must never be the security or correctness boundary.
  const { data: destinations, error: destinationError } = await supabase.from("social_accounts")
    .select("id,brand_id,connection_status,platform:social_platforms(code)")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .in("id", targetAccountIds as string[]);
  if (destinationError || !destinations || destinations.length !== targetAccountIds.length) {
    return NextResponse.json({ error: "One or more destination accounts are unavailable for this brand." }, { status: 400 });
  }
  if (destinations.some(account => account.connection_status !== "connected")) {
    return NextResponse.json({ error: "Reconnect every destination account before creating this post." }, { status: 409 });
  }

  // Each destination publishes either its account-specific media or the shared media.
  const versionByAccount = new Map(
    (accountVersions as Record<string, unknown>[]).map((item) => [item.accountId as string, item])
  );
  const mediaForAccount = (accountId: string): string[] =>
    (versionByAccount.get(accountId)?.assetIds as string[] | undefined) ?? (assetIds as string[]);
  const allAssetIds = [...new Set([
    ...(assetIds as string[]),
    ...(accountVersions as Record<string, unknown>[]).flatMap((item) => (item.assetIds as string[] | undefined) ?? []),
  ])];
  const { data: mediaRows, error: mediaError } = allAssetIds.length
    ? await supabase.from("social_media_assets").select("id,brand_id,mime_type,processing_status")
        .eq("organization_id", organizationId).eq("brand_id", brandId).in("id", allAssetIds)
    : { data: [], error: null };
  if (mediaError || !mediaRows || mediaRows.length !== allAssetIds.length) {
    return NextResponse.json({ error: "One or more media assets are unavailable for this brand." }, { status: 400 });
  }
  if (mediaRows.some(asset => asset.processing_status !== "ready")) {
    return NextResponse.json({ error: "All selected media must finish scanning and processing before scheduling." }, { status: 409 });
  }
  const mediaKindById = new Map(mediaRows.map(asset => [asset.id as string, asset.mime_type.startsWith("video/") ? "video" : "image"]));
  for (const account of destinations) {
    const platform = account.platform as unknown as { code: string } | null;
    const capability = getPlatformCapability(platform?.code);
    if (!capability.publishingEnabled) {
      return NextResponse.json({ error: capability.limitation || "Publishing is not enabled for one of the selected platforms." }, { status: 422 });
    }
    const mediaKinds = mediaForAccount(account.id as string).map(id => mediaKindById.get(id));
    if (mediaKinds.length > capability.maxMediaItems ||
        mediaKinds.some(kind => !capability.supportedMedia.includes(kind as "image" | "video"))) {
      return NextResponse.json({ error: "Selected media is not supported by every destination. Review platform requirements before scheduling." }, { status: 422 });
    }
  }

  const { data: postId, error } = await supabase.rpc("create_social_post_bundle_with_versions", {
    p_payload: {
      organization_id: organizationId,
      brand_id: brandId,
      title,
      body,
      timezone,
      scheduled_at: scheduledAt,
      target_account_ids: targetAccountIds,
      asset_ids: assetIds,
      account_versions: (accountVersions as Record<string, unknown>[]).map((item) => ({
        account_id: item.accountId,
        body: item.body,
        asset_ids: item.assetIds ?? assetIds,
        platform_options: item.platformOptions ?? {},
      })),
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
