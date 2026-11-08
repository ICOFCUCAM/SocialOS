import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BarChart3, Eye, Heart, MousePointerClick, Play, Users } from "lucide-react";

type MetricRow = {
  target_id: string;
  metric_date: string;
  period_type: "daily" | "lifetime";
  impressions: number | null;
  reach: number | null;
  engagements: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  video_views: number | null;
};

const n = (value: number) => new Intl.NumberFormat("en", { notation: value >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
const sum = (rows: MetricRow[], key: keyof MetricRow) => rows.reduce((total, row) => total + (typeof row[key] === "number" ? row[key] as number : 0), 0);

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase.from("organization_members")
    .select("organization_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!member) redirect("/onboarding");

  const { data: campaigns, error } = await supabase.from("social_campaigns")
    .select("id,name,status,brand_id,start_date,end_date,social_campaign_posts(post_id)")
    .eq("organization_id", member.organization_id)
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("Campaign analytics are unavailable. Ensure migrations 0015 and 0016 are applied.");

  const campaignRows = campaigns ?? [];
  const postIds = [...new Set(campaignRows.flatMap(c => (c.social_campaign_posts ?? []).map((link: { post_id: string }) => link.post_id)))];
  const { data: targets } = postIds.length
    ? await supabase.from("social_post_targets").select("id,post_id").eq("organization_id", member.organization_id).in("post_id", postIds)
    : { data: [] as { id: string; post_id: string }[] };
  const targetRows = targets ?? [];
  const targetIds = targetRows.map(t => t.id);
  const { data: analytics } = targetIds.length
    ? await supabase.from("social_post_analytics_daily")
      .select("target_id,metric_date,period_type,impressions,reach,engagements,likes,comments,shares,saves,clicks,video_views")
      .eq("organization_id", member.organization_id).eq("period_type", "daily")
      .in("target_id", targetIds).order("metric_date", { ascending: true })
    : { data: [] as MetricRow[] };
  const metricRows = (analytics ?? []) as MetricRow[];
  const metricsByTarget = new Map<string, MetricRow[]>();
  for (const row of metricRows) metricsByTarget.set(row.target_id, [...(metricsByTarget.get(row.target_id) ?? []), row]);
  const targetsByPost = new Map<string, string[]>();
  for (const target of targetRows) targetsByPost.set(target.post_id, [...(targetsByPost.get(target.post_id) ?? []), target.id]);

  const campaignStats = campaignRows.map(campaign => {
    const campaignPosts = (campaign.social_campaign_posts ?? []).map((link: { post_id: string }) => link.post_id);
    const ids = campaignPosts.flatMap(postId => targetsByPost.get(postId) ?? []);
    const rows = ids.flatMap(id => metricsByTarget.get(id) ?? []).filter(row =>
      (!campaign.start_date || row.metric_date >= campaign.start_date) &&
      (!campaign.end_date || row.metric_date <= campaign.end_date)
    );
    return { id: campaign.id, name: campaign.name, status: campaign.status, posts: campaignPosts.length, rows };
  });
  const allRows = [...new Map(campaignStats.flatMap(c => c.rows).map(row => [row.target_id + ":" + row.metric_date, row])).values()];
  const measured = allRows.length > 0;
  const cards = [
    { label: "Impressions", value: sum(allRows, "impressions"), icon: Eye },
    { label: "Reach", value: sum(allRows, "reach"), icon: Users },
    { label: "Engagements", value: sum(allRows, "engagements"), icon: Heart },
    { label: "Link clicks", value: sum(allRows, "clicks"), icon: MousePointerClick },
    { label: "Video views", value: sum(allRows, "video_views"), icon: Play },
  ];

  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">MEASUREMENT & PERFORMANCE</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77847b]">Understand how published campaign content performs using provider-reported metrics.</p></div>
      <span className="inline-flex items-center gap-2 rounded-full border border-[#e6ece7] bg-white px-3 py-2 text-[11px] text-[#657269]"><BarChart3 size={14}/> {measured ? "Provider data available" : "Awaiting provider data"}</span>
    </section>

    {measured ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(card => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-[#e6ece6] bg-white p-5">
        <div className="flex items-center justify-between text-xs text-[#7c8980]"><span>{card.label}</span><Icon size={15}/></div>
        <p className="mt-4 text-2xl font-semibold tabular-nums">{n(card.value)}</p>
      </article>; })}
    </section> : <section className="rounded-2xl border border-dashed border-[#d9e4da] bg-white px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#edf5ef] text-[#176b4b]"><BarChart3 size={21}/></span>
      <h2 className="mt-4 text-base font-semibold">Your performance data will appear here</h2>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-[#89958d]">Campaigns and publishing are ready to be connected to measurement. No provider analytics have been imported yet, so SocialOS is not displaying estimated or invented results.</p>
    </section>}

    <section className="space-y-4">
      <div><h2 className="text-lg font-semibold">Campaign performance</h2><p className="mt-1 text-xs text-[#89958d]">Daily provider metrics attributed to posts linked to each campaign.</p></div>
      {campaignStats.length ? <div className="overflow-hidden rounded-2xl border border-[#e6ece6] bg-white">
        {campaignStats.map(campaign => <article key={campaign.id} className="grid gap-3 border-b border-[#edf1ed] p-5 last:border-0 sm:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] sm:items-center">
          <div><p className="text-sm font-semibold">{campaign.name}</p><p className="mt-1 text-[11px] capitalize text-[#89958d]">{campaign.status} · {campaign.posts} linked {campaign.posts === 1 ? "post" : "posts"}</p></div>
          <div><p className="text-[10px] text-[#89958d]">Impressions</p><p className="mt-1 text-sm font-semibold tabular-nums">{campaign.rows.length ? n(sum(campaign.rows, "impressions")) : "—"}</p></div>
          <div><p className="text-[10px] text-[#89958d]">Reach</p><p className="mt-1 text-sm font-semibold tabular-nums">{campaign.rows.length ? n(sum(campaign.rows, "reach")) : "—"}</p></div>
          <div><p className="text-[10px] text-[#89958d]">Engagements</p><p className="mt-1 text-sm font-semibold tabular-nums">{campaign.rows.length ? n(sum(campaign.rows, "engagements")) : "—"}</p></div>
          <div><p className="text-[10px] text-[#89958d]">Clicks</p><p className="mt-1 text-sm font-semibold tabular-nums">{campaign.rows.length ? n(sum(campaign.rows, "clicks")) : "—"}</p></div>
        </article>)}
      </div> : <div className="rounded-2xl border border-dashed border-[#d9e4da] bg-white p-8 text-center text-xs text-[#89958d]">Create a campaign and link published posts to see its performance summary.</div>}
    </section>

    <p className="text-[11px] leading-5 text-[#89958d]">Metrics are sourced from connected platforms. Daily totals are additive; lifetime snapshots are intentionally excluded from these totals. Platform definitions and availability can differ, so cross-platform figures should be interpreted as reported—not perfectly equivalent—measurements.</p>
  </div>;
}
