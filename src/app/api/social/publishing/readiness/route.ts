import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSocialAdminClient } from "@/lib/social/admin";

type Finding = {
  code: string;
  severity: "blocker" | "warning" | "info";
  title: string;
  detail: string;
  accountId?: string;
};
const supported = new Set(["facebook", "instagram", "youtube", "linkedin"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const profiles = (platform: string, kind: string) => {
  if (kind === "video")
    return platform === "youtube" || platform === "linkedin"
      ? "landscape"
      : platform === "threads"
        ? "square"
        : "vertical";
  return platform === "youtube" || platform === "linkedin"
    ? "landscape"
    : platform === "pinterest"
      ? "pin"
      : platform === "threads"
        ? "square"
        : "portrait";
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request is required." }, { status: 400 });
  }
  const postId =
    input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    typeof (input as Record<string, unknown>).postId === "string"
      ? (input as Record<string, string>).postId
      : "";
  if (!uuid.test(postId))
    return NextResponse.json({ error: "A valid postId is required." }, { status: 400 });

  const { data: post, error: postError } = await supabase
    .from("social_posts")
    .select("id,organization_id,brand_id,title,body,status,scheduled_at")
    .eq("id", postId)
    .maybeSingle();
  if (postError || !post)
    return NextResponse.json({ error: "Post not found or unavailable." }, { status: 404 });
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", post.organization_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership)
    return NextResponse.json({ error: "Active workspace membership required." }, { status: 403 });
  const { data: targets, error: targetError } = await supabase
    .from("social_post_targets")
    .select("id,social_account_id,status,scheduled_at,caption_override,platform_options")
    .eq("post_id", post.id)
    .eq("organization_id", post.organization_id);
  if (targetError)
    return NextResponse.json(
      { error: "Unable to inspect publishing destinations." },
      { status: 500 },
    );
  const rows = targets ?? [];
  if (!rows.length)
    return NextResponse.json(
      { error: "This post has no publishing destinations." },
      { status: 422 },
    );
  const accountIds = rows.map((row) => row.social_account_id);
  const [{ data: accounts, error: accountError }, { data: versions, error: versionError }] =
    await Promise.all([
      supabase
        .from("social_accounts")
        .select(
          "id,account_name,connection_status,platform_id,last_error,platform:social_platforms(code,name,is_enabled,capabilities)",
        )
        .eq("organization_id", post.organization_id)
        .in("id", accountIds),
      supabase
        .from("social_post_versions")
        .select("id,social_account_id,is_default,body,platform_options")
        .eq("organization_id", post.organization_id)
        .eq("post_id", post.id),
    ]);
  if (accountError || versionError)
    return NextResponse.json(
      { error: "Unable to inspect account content and provider settings." },
      { status: 500 },
    );
  const accountRows = accounts ?? [],
    versionRows = versions ?? [];
  const accountMap = new Map(accountRows.map((a) => [a.id, a]));
  const versionMap = new Map(
    versionRows.filter((v) => !v.is_default).map((v) => [v.social_account_id, v]),
  );
  const defaultVersion = versionRows.find((v) => v.is_default);
  const findings: Finding[] = [];
  const admin = createSocialAdminClient();
  const { data: tokens, error: tokenError } = accountIds.length
    ? await admin
        .from("social_account_tokens")
        .select(
          "social_account_id,access_token_expires_at,refresh_token_expires_at,refresh_token_ciphertext",
        )
        .eq("organization_id", post.organization_id)
        .in("social_account_id", accountIds)
    : { data: [], error: null };
  if (tokenError)
    return NextResponse.json(
      { error: "Unable to inspect credential expiry metadata." },
      { status: 500 },
    );
  const tokenMap = new Map((tokens ?? []).map((t) => [t.social_account_id, t]));
  const now = Date.now();
  const readiness = await Promise.all(
    rows.map(async (target) => {
      const account = accountMap.get(target.social_account_id);
      if (!account) {
        findings.push({
          code: "ACCOUNT_UNAVAILABLE",
          severity: "blocker",
          title: "Destination account unavailable",
          detail: "The selected account could not be found in this workspace.",
        });
        return { targetId: target.id, accountId: target.social_account_id, status: "blocked" };
      }
      const platform = account.platform as unknown as {
        code: string;
        name: string;
        is_enabled: boolean;
        capabilities: Record<string, unknown>;
      } | null;
      const code = platform?.code ?? "unknown";
      const token = tokenMap.get(account.id);
      const expiry = token?.access_token_expires_at
        ? Date.parse(token.access_token_expires_at)
        : null;
      const accountFindings: Finding[] = [];
      const add = (code: string, severity: Finding["severity"], title: string, detail: string) =>
        accountFindings.push({ code, severity, title, detail, accountId: account.id });
      if (!supported.has(code))
        add(
          "PROVIDER_ADAPTER_UNAVAILABLE",
          "blocker",
          "Publishing adapter unavailable",
          "SocialOS does not currently have a publishing adapter enabled for " +
            (platform?.name ?? code) +
            ".",
        );
      if (!platform?.is_enabled)
        add(
          "PLATFORM_DISABLED",
          "blocker",
          "Platform disabled",
          "This platform is currently disabled in SocialOS.",
        );
      if (account.connection_status !== "connected")
        add(
          "ACCOUNT_NOT_CONNECTED",
          "blocker",
          "Account connection needs attention",
          account.last_error || "Reconnect or verify this account before publishing.",
        );
      if (!token)
        add(
          "TOKEN_MISSING",
          "blocker",
          "Credentials unavailable",
          "No encrypted credential record is available for this account.",
        );
      else if (expiry !== null && Number.isFinite(expiry) && expiry <= now)
        add(
          "ACCESS_TOKEN_EXPIRED",
          "blocker",
          "Access token expired",
          "The access token has expired. Reconnect this account or confirm provider refresh support.",
        );
      else if (expiry === null || !Number.isFinite(expiry))
        add(
          "TOKEN_EXPIRY_UNKNOWN",
          "warning",
          "Credential expiry unknown",
          "The provider did not supply a usable access-token expiry timestamp.",
        );
      else if (expiry <= now + 24 * 60 * 60 * 1000)
        add(
          "TOKEN_EXPIRING_SOON",
          "warning",
          "Access token expires within 24 hours",
          "The token may expire before a later scheduled delivery.",
        );
      const version = versionMap.get(account.id) ?? defaultVersion;
      if (!version)
        add(
          "CONTENT_VERSION_MISSING",
          "blocker",
          "Content version missing",
          "No default or account-specific content version exists.",
        );
      const body = version?.body ?? post.body ?? "";
      if (body.length > 20000)
        add(
          "TEXT_LENGTH_EXCEEDED",
          "blocker",
          "Caption too long",
          "The caption exceeds SocialOS's current 20,000-character storage limit.",
        );
      const { data: mediaRows, error: mediaError } = version
        ? await supabase
            .from("social_post_version_media")
            .select("asset_id,position")
            .eq("organization_id", post.organization_id)
            .eq("version_id", version.id)
            .order("position")
        : { data: [], error: null };
      if (mediaError)
        add(
          "MEDIA_LOOKUP_FAILED",
          "blocker",
          "Media could not be checked",
          "The selected version's media could not be inspected.",
        );
      const assets = (mediaRows ?? []).length
        ? await supabase
            .from("social_media_assets")
            .select("id,processing_status,metadata,original_filename,mime_type")
            .eq("organization_id", post.organization_id)
            .in(
              "id",
              (mediaRows ?? []).map((m) => m.asset_id),
            )
        : { data: [], error: null };
      if (assets.error)
        add(
          "ASSET_LOOKUP_FAILED",
          "blocker",
          "Media assets unavailable",
          "Media metadata could not be loaded.",
        );
      const assetRows = assets.data ?? [];
      for (const asset of assetRows) {
        if (asset.processing_status !== "ready")
          add(
            "MEDIA_NOT_READY",
            "blocker",
            "Media processing incomplete",
            "A selected asset is not ready for publishing.",
          );
        const processing = (asset.metadata as Record<string, unknown> | null)?.processing as
          { kind?: string; derivatives?: { profile?: string; objectKey?: string }[] } | undefined;
        const kind =
          processing?.kind ??
          (asset.mime_type?.startsWith("video/")
            ? "video"
            : asset.mime_type?.startsWith("image/")
              ? "image"
              : "unknown");
        if (!["image", "video"].includes(kind))
          add(
            "MEDIA_TYPE_UNKNOWN",
            "warning",
            "Media type not verified",
            "SocialOS could not determine the processed media type.",
          );
        if (code === "instagram" && assetRows.length > 1)
          add(
            "MEDIA_COUNT_UNSUPPORTED",
            "blocker",
            "Too many Instagram media items",
            "The current Instagram adapter supports one media item per publish job.",
          );
        if (code === "youtube" && kind !== "video")
          add(
            "YOUTUBE_VIDEO_REQUIRED",
            "blocker",
            "YouTube requires video",
            "The selected asset is not a video.",
          );
        const required = profiles(code, kind);
        if (
          processing?.derivatives &&
          !processing.derivatives.some((d) => d.profile === required && d.objectKey)
        )
          add(
            "MEDIA_DERIVATIVE_MISSING",
            "blocker",
            "Required media rendition missing",
            "A " + required + " rendition is not available for this destination.",
          );
      }
      if (["instagram", "youtube"].includes(code) && assetRows.length === 0)
        add(
          "PLATFORM_MEDIA_REQUIRED",
          "blocker",
          "Media required",
          "This destination requires a media asset.",
        );
      if (code === "linkedin" && assetRows.length > 0)
        add(
          "LINKEDIN_MEDIA_UNSUPPORTED",
          "blocker",
          "Media is not supported by the current LinkedIn adapter",
          "The currently registered LinkedIn adapter rejects media attachments; remove media or use a supported destination.",
        );
      if (!post.scheduled_at && !target.scheduled_at)
        add("NOT_SCHEDULED", "info", "Not scheduled", "This post has no scheduled delivery time.");
      const deliveryAt = target.scheduled_at || post.scheduled_at;
      if (deliveryAt && Date.parse(deliveryAt) <= now)
        add(
          "SCHEDULE_IN_PAST",
          "blocker",
          "Scheduled time is no longer in the future",
          "Reschedule this post before publishing.",
        );
      findings.push(...accountFindings);
      return {
        targetId: target.id,
        accountId: account.id,
        accountName: account.account_name,
        platform: code,
        status: accountFindings.some((f) => f.severity === "blocker")
          ? "blocked"
          : accountFindings.some((f) => f.severity === "warning")
            ? "review"
            : "ready",
        findings: accountFindings,
      };
    }),
  );
  const blockers = findings.filter((f) => f.severity === "blocker").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  return NextResponse.json({
    postId: post.id,
    assessedAt: new Date().toISOString(),
    summary: {
      destinations: rows.length,
      ready: readiness.filter((r) => r.status === "ready").length,
      review: readiness.filter((r) => r.status === "review").length,
      blocked: readiness.filter((r) => r.status === "blocked").length,
      blockers,
      warnings,
    },
    readiness,
    findings,
  });
}
