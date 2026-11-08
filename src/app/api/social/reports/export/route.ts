import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isoDate = (value: string | null) => Boolean(value && /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z")));
const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\\s\\u0000-\\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership } = await supabase.from("organization_members")
    .select("organization_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ error: "An active workspace is required." }, { status: 403 });

  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFromDate = new Date(now);
  defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 29);
  const defaultFrom = defaultFromDate.toISOString().slice(0, 10);
  const from = request.nextUrl.searchParams.get("from") ?? defaultFrom;
  const to = request.nextUrl.searchParams.get("to") ?? defaultTo;
  if (!isoDate(from) || !isoDate(to) || from > to) {
    return NextResponse.json({ error: "Provide a valid date range using YYYY-MM-DD." }, { status: 400 });
  }
  const span = (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000;
  if (span > 365) return NextResponse.json({ error: "Date ranges are limited to 366 days." }, { status: 400 });

  const { data: targets, error: targetsError } = await supabase.from("social_post_targets")
    .select("id,post_id,social_account_id,status,published_at,platform_post_id")
    .eq("organization_id", membership.organization_id).eq("status", "published")
    .gte("published_at", from + "T00:00:00.000Z")
    .lt("published_at", new Date(Date.parse(to + "T00:00:00Z") + 86400000).toISOString())
    .limit(5000);
  if (targetsError) return NextResponse.json({ error: "Report data is temporarily unavailable." }, { status: 500 });

  const targetRows = targets ?? [];
  const targetIds = targetRows.map(row => row.id);
  const accountIds = [...new Set(targetRows.map(row => row.social_account_id))];
  const postIds = [...new Set(targetRows.map(row => row.post_id))];

  const [{ data: analytics, error: analyticsError }, { data: accounts }, { data: posts }] = await Promise.all([
    targetIds.length ? supabase.from("social_post_analytics_daily")
      .select("target_id,metric_date,impressions,reach,engagements,likes,comments,shares,saves,clicks,video_views")
      .eq("organization_id", membership.organization_id).eq("period_type", "daily")
      .in("target_id", targetIds).gte("metric_date", from).lte("metric_date", to)
      .order("metric_date", { ascending: true }).limit(20000) : Promise.resolve({ data: [], error: null }),
    accountIds.length ? supabase.from("social_accounts").select("id,platform_id").eq("organization_id", membership.organization_id).in("id", accountIds) : Promise.resolve({ data: [] }),
    postIds.length ? supabase.from("social_posts").select("id,title").eq("organization_id", membership.organization_id).in("id", postIds) : Promise.resolve({ data: [] })
  ]);
  if (analyticsError) return NextResponse.json({ error: "Analytics data is temporarily unavailable." }, { status: 500 });

  const platformIds = [...new Set((accounts ?? []).map(row => row.platform_id))];
  const { data: platforms } = platformIds.length
    ? await supabase.from("social_platforms").select("id,code").in("id", platformIds)
    : { data: [] as { id: string; code: string }[] };
  const platformById = new Map((platforms ?? []).map(row => [row.id, row.code]));
  const platformByAccount = new Map((accounts ?? []).map(row => [row.id, platformById.get(row.platform_id) ?? "unknown"]));
  const titleByPost = new Map((posts ?? []).map(row => [row.id, row.title ?? ""]));
  const targetById = new Map(targetRows.map(row => [row.id, row]));

  const columns = ["reporting_date","platform","post_title","published_at","platform_post_id","impressions","reach","engagements","likes","comments","shares","saves","clicks","video_views"];
  const lines = [columns.map(csvCell).join(",")];
  for (const metric of analytics ?? []) {
    const target = targetById.get(metric.target_id);
    if (!target) continue;
    lines.push([
      metric.metric_date,
      platformByAccount.get(target.social_account_id) ?? "unknown",
      titleByPost.get(target.post_id) ?? "",
      target.published_at,
      target.platform_post_id,
      metric.impressions, metric.reach, metric.engagements, metric.likes,
      metric.comments, metric.shares, metric.saves, metric.clicks, metric.video_views
    ].map(csvCell).join(","));
  }

  const filename = `socialos-performance-${from}-to-${to}.csv`;
  return new NextResponse("\\uFEFF" + lines.join("\\r\\n"), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store"
    }
  });
}
