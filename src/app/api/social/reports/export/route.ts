import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isoDate = (value: string | null) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z")));
const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership } = await getActiveMembership(supabase,user.id,"organization_id");
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

  // Fetch in explicit PostgREST range pages. A page size below the common
  // project max_rows setting makes the result independent of that setting.
  const PAGE_SIZE = 1000;
  const MAX_TARGETS = 50000;
  const MAX_METRICS = 100000;
  const targetRows: Array<{ id: string; post_id: string; social_account_id: string; status: string; published_at: string | null; platform_post_id: string | null }> = [];
  for (let offset = 0; offset <= MAX_TARGETS; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("social_post_targets")
      .select("id,post_id,social_account_id,status,published_at,platform_post_id")
      .eq("organization_id", membership.organization_id).eq("status", "published")
      .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ error: "Report destinations are temporarily unavailable." }, { status: 500 });
    targetRows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    if (targetRows.length > MAX_TARGETS) return NextResponse.json({ error: "This workspace exceeds the 50,000-destination synchronous export limit. Narrow the reporting scope or use a scheduled export." }, { status: 413 });
  }
  if (targetRows.length > MAX_TARGETS) return NextResponse.json({ error: "This workspace exceeds the 50,000-destination synchronous export limit." }, { status: 413 });

  const targetIds = targetRows.map(row => row.id);
  const accountIds = [...new Set(targetRows.map(row => row.social_account_id))];
  const postIds = [...new Set(targetRows.map(row => row.post_id))];
  const analytics: Array<{ target_id: string; metric_date: string; impressions: number | null; reach: number | null; engagements: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; clicks: number | null; video_views: number | null }> = [];
  for (let index = 0; index < targetIds.length; index += 200) {
    const ids = targetIds.slice(index, index + 200);
    for (let offset = 0; offset <= MAX_METRICS; offset += PAGE_SIZE) {
      const { data, error } = await supabase.from("social_post_analytics_daily")
        .select("target_id,metric_date,impressions,reach,engagements,likes,comments,shares,saves,clicks,video_views")
        .eq("organization_id", membership.organization_id).eq("period_type", "daily")
        .in("target_id", ids).gte("metric_date", from).lte("metric_date", to)
        .order("metric_date", { ascending: true }).order("target_id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) return NextResponse.json({ error: "Analytics data is temporarily unavailable." }, { status: 500 });
      analytics.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
      if (analytics.length > MAX_METRICS) return NextResponse.json({ error: "This export exceeds the 100,000-row synchronous limit. Narrow the date range and try again." }, { status: 413 });
    }
    if (analytics.length > MAX_METRICS) return NextResponse.json({ error: "This export exceeds the 100,000-row synchronous limit. Narrow the date range and try again." }, { status: 413 });
  }

  const accounts: Array<{ id: string; platform_id: string }> = [];
  for (let index = 0; index < accountIds.length; index += 200) {
    const { data, error } = await supabase.from("social_accounts").select("id,platform_id")
      .eq("organization_id", membership.organization_id).in("id", accountIds.slice(index, index + 200));
    if (error) return NextResponse.json({ error: "Account metadata is temporarily unavailable." }, { status: 500 });
    accounts.push(...(data ?? []));
  }
  const posts: Array<{ id: string; title: string | null }> = [];
  for (let index = 0; index < postIds.length; index += 200) {
    const { data, error } = await supabase.from("social_posts").select("id,title")
      .eq("organization_id", membership.organization_id).in("id", postIds.slice(index, index + 200));
    if (error) return NextResponse.json({ error: "Post metadata is temporarily unavailable." }, { status: 500 });
    posts.push(...(data ?? []));
  }

  const platformIds = [...new Set(accounts.map(row => row.platform_id))];
  const platforms: Array<{ id: string; code: string }> = [];
  for (let index = 0; index < platformIds.length; index += 200) {
    const { data, error } = await supabase.from("social_platforms").select("id,code").in("id", platformIds.slice(index, index + 200));
    if (error) return NextResponse.json({ error: "Platform metadata is temporarily unavailable." }, { status: 500 });
    platforms.push(...(data ?? []));
  }
  const platformById = new Map(platforms.map(row => [row.id, row.code]));
  const platformByAccount = new Map(accounts.map(row => [row.id, platformById.get(row.platform_id) ?? "unknown"]));
  const titleByPost = new Map(posts.map(row => [row.id, row.title ?? ""]));
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
  return new NextResponse(lines.join(String.fromCharCode(13, 10)), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store"
    }
  });
}
