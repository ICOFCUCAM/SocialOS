import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BarChart3 } from "lucide-react";

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
type Campaign = {
  id: string; name: string; status: string; start_date: string | null; end_date: string | null;
  social_campaign_posts: { post_id: string }[] | null;
};
type Target = { id: string; post_id: string; social_account_id: string };
type PlatformTotal = { code: string; rows: MetricRow[] };

const n = (value: number) => new Intl.NumberFormat("en", { notation: value >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
const total = (rows: MetricRow[], key: keyof MetricRow) => rows.reduce((sum, row) => sum + (typeof row[key] === "number" ? row[key] as number : 0), 0);
const reported = (rows: MetricRow[], key: keyof MetricRow) => rows.some(row => typeof row[key] === "number") ? n(total(rows, key)) : "—";
const platformName = (code: string) => ({ facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", linkedin: "LinkedIn" }[code] ?? code);
const dayLabel = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase.from("organization_members")
    .select("organization_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!member) redirect("/onboarding");

  const { data: campaigns, error } = await supabase.from("social_campaigns")
    .select("id,name,status,start_date,end_date,social_campaign_posts(post_id)")
    .eq("organization_id", member.organization_id)
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("Campaign analytics are unavailable. Ensure migrations 0015 and 0016 are applied.");

  const campaignRows = (campaigns ?? []) as Campaign[];
  const postIds = [...new Set(campaignRows.flatMap(c => (c.social_campaign_posts ?? []).map(link => link.post_id)))];
  const { data: targets } = postIds.length
    ? await supabase.from("social_post_targets").select("id,post_id,social_account_id").eq("organization_id", member.organization_id).in("post_id", postIds)
    : { data: [] as Target[] };
  const targetRows = (targets ?? []) as Target[];
  const targetIds = targetRows.map(target => target.id);
  const accountIds = [...new Set(targetRows.map(target => target.social_account_id))];

  const { data: accounts } = accountIds.length
    ? await supabase.from("social_accounts").select("id,platform_id").eq("organization_id", member.organization_id).in("id", accountIds)
    : { data: [] as { id: string; platform_id: string }[] };
  const platformIds = [...new Set((accounts ?? []).map(account => account.platform_id))];
  const { data: platforms } = platformIds.length
    ? await supabase.from("social_platforms").select("id,code").in("id", platformIds)
    : { data: [] as { id: string; code: string }[] };

  const platformByAccount = new Map<string, string>();
  const codeById = new Map((platforms ?? []).map(platform => [platform.id, platform.code]));
  for (const account of accounts ?? []) {
    const code = codeById.get(account.platform_id);
    if (code) platformByAccount.set(account.id, code);
  }
  const platformByTarget = new Map(targetRows.map(target => [target.id, platformByAccount.get(target.social_account_id) ?? "unknown"]));

  const { data: analytics } = targetIds.length
    ? await supabase.from("social_post_analytics_daily")
      .select("target_id,metric_date,period_type,impressions,reach,engagements,likes,comments,shares,saves,clicks,video_views")
      .eq("organization_id", member.organization_id).in("target_id", targetIds)
      .in("period_type", ["daily", "lifetime"]).order("metric_date", { ascending: true })
    : { data: [] as MetricRow[] };
  const metricRows = (analytics ?? []) as MetricRow[];
  const dailyRows = metricRows.filter(row => row.period_type === "daily");
  const lifetimeRows = metricRows.filter(row => row.period_type === "lifetime");

  const latestLifetimeByTarget = new Map<string, MetricRow>();
  for (const row of lifetimeRows) {
    const previous = latestLifetimeByTarget.get(row.target_id);
    if (!previous || row.metric_date > previous.metric_date) latestLifetimeByTarget.set(row.target_id, row);
  }

  const dailyByPlatform = new Map<string, MetricRow[]>();
  const lifetimeByPlatform = new Map<string, MetricRow[]>();
  for (const row of dailyRows) {
    const code = platformByTarget.get(row.target_id) ?? "unknown";
    dailyByPlatform.set(code, [...(dailyByPlatform.get(code) ?? []), row]);
  }
  for (const row of latestLifetimeByTarget.values()) {
    const code = platformByTarget.get(row.target_id) ?? "unknown";
    lifetimeByPlatform.set(code, [...(lifetimeByPlatform.get(code) ?? []), row]);
  }

  const dailyTotals: PlatformTotal[] = [...dailyByPlatform.entries()].map(([code, rows]) => ({ code, rows }));
  const lifetimeTotals: PlatformTotal[] = [...lifetimeByPlatform.entries()].map(([code, rows]) => ({ code, rows }));
  const measured = dailyRows.length > 0 || latestLifetimeByTarget.size > 0;

  const targetsByPost = new Map<string, string[]>();
  for (const target of targetRows) targetsByPost.set(target.post_id, [...(targetsByPost.get(target.post_id) ?? []), target.id]);
  const metricsByTarget = new Map<string, MetricRow[]>();
  for (const row of dailyRows) metricsByTarget.set(row.target_id, [...(metricsByTarget.get(row.target_id) ?? []), row]);

  const campaignStats = campaignRows.map(campaign => {
    const postIdsForCampaign = (campaign.social_campaign_posts ?? []).map(link => link.post_id);
    const ids = postIdsForCampaign.flatMap(postId => targetsByPost.get(postId) ?? []);
    const rows = ids.flatMap(id => metricsByTarget.get(id) ?? []).filter(row =>
      (!campaign.start_date || row.metric_date >= campaign.start_date) &&
      (!campaign.end_date || row.metric_date <= campaign.end_date)
    );
    const byPlatform = new Map<string, MetricRow[]>();
    for (const row of rows) {
      const code = platformByTarget.get(row.target_id) ?? "unknown";
      byPlatform.set(code, [...(byPlatform.get(code) ?? []), row]);
    }
    return { ...campaign, postCount: postIdsForCampaign.length, platforms: [...byPlatform.entries()].map(([code, values]) => ({ code, rows: values })) };
  });

  const dates = [...new Set(dailyRows.map(row => row.metric_date))].sort().slice(-14);
  const trend = dailyTotals.map(platform => {
    const values = dates.map(date => ({
      date,
      value: total(platform.rows.filter(row => row.metric_date === date), "impressions")
    }));
    return { ...platform, values, max: Math.max(1, ...values.map(value => value.value)) };
  });

  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">MEASUREMENT & PERFORMANCE</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77847b]">Understand how published content performs, with daily trends and lifetime snapshots kept distinct.</p></div>
      <span className="inline-flex items-center gap-2 rounded-full border border-[#e6ece7] bg-white px-3 py-2 text-[11px] text-[#657269]"><BarChart3 size={14}/> {measured ? "Provider data available" : "Awaiting provider data"}</span>
    </section>

    {!measured ? <section className="rounded-2xl border border-dashed border-[#d9e4da] bg-white px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#edf5ef] text-[#176b4b]"><BarChart3 size={21}/></span>
      <h2 className="mt-4 text-base font-semibold">Your performance data will appear here</h2>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-[#89958d]">No provider analytics have been imported yet. SocialOS will show verified platform results only—never estimated or invented performance.</p>
    </section> : <>
      <section className="space-y-4">
        <div><h2 className="text-lg font-semibold">Daily performance</h2><p className="mt-1 text-xs text-[#89958d]">Provider-reported impressions by day · latest 14 reported dates · platforms shown separately.</p></div>
        {trend.length ? <div className="grid gap-4 xl:grid-cols-2">
          {trend.map(platform => <article key={platform.code} className="rounded-2xl border border-[#e6ece6] bg-white p-5">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{platformName(platform.code)}</h3><span className="text-[10px] text-[#89958d]">Daily impressions</span></div>
            <div className="mt-5 flex h-36 items-end gap-1.5">
              {platform.values.map(point => <div key={point.date} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={dayLabel(point.date) + ": " + n(point.value)}>
                <div className="flex flex-1 items-end"><div className="w-full rounded-t-md bg-[#78a98b] transition-colors group-hover:bg-[#176b4b]" style={{ height: Math.max(point.value > 0 ? 5 : 0, point.value / platform.max * 100) + "%" }}/></div>
                <span className="mt-2 truncate text-center text-[9px] text-[#9aa49d]">{platform.values.length <= 7 || platform.values.indexOf(point) % 2 === 0 ? dayLabel(point.date) : ""}</span>
              </div>)}
            </div>
          </article>)}
        </div> : <div className="rounded-2xl border border-dashed border-[#d9e4da] bg-white p-6 text-xs text-[#89958d]">Daily trend data has not been reported yet.</div>}
      </section>

      <section className="space-y-4">
        <div><h2 className="text-lg font-semibold">Daily totals by platform</h2><p className="mt-1 text-xs text-[#89958d]">Additive daily reporting-period metrics. Values are not combined across providers.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dailyTotals.map(platform => <article key={platform.code} className="rounded-2xl border border-[#e6ece6] bg-white p-5">
            <div className="text-sm font-semibold">{platformName(platform.code)}</div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div><p className="text-[10px] text-[#89958d]">Impressions</p><p className="mt-1 text-xl font-semibold tabular-nums">{reported(platform.rows, "impressions")}</p></div>
              <div><p className="text-[10px] text-[#89958d]">Reach</p><p className="mt-1 text-xl font-semibold tabular-nums">{reported(platform.rows, "reach")}</p></div>
              <div><p className="text-[10px] text-[#89958d]">Engagements</p><p className="mt-1 text-lg font-semibold tabular-nums">{reported(platform.rows, "engagements")}</p></div>
              <div><p className="text-[10px] text-[#89958d]">Clicks</p><p className="mt-1 text-lg font-semibold tabular-nums">{reported(platform.rows, "clicks")}</p></div>
            </div>
          </article>)}
        </div>
      </section>

      <section className="space-y-4">
        <div><h2 className="text-lg font-semibold">Latest lifetime snapshots</h2><p className="mt-1 text-xs text-[#89958d]">Most recent snapshot per published destination. These values are not added across collection dates.</p></div>
        {lifetimeTotals.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {lifetimeTotals.map(platform => <article key={platform.code} className="rounded-2xl border border-[#e6ece6] bg-white p-5">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{platformName(platform.code)}</h3><span className="text-[10px] text-[#89958d]">{platform.rows.length} destinations</span></div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div><p className="text-[10px] text-[#89958d]">Views / impressions</p><p className="mt-1 text-xl font-semibold tabular-nums">{reported(platform.rows, "impressions")}</p></div>
              <div><p className="text-[10px] text-[#89958d]">Reach</p><p className="mt-1 text-xl font-semibold tabular-nums">{reported(platform.rows, "reach")}</p></div>
              <div><p className="text-[10px] text-[#89958d]">Engagements</p><p className="mt-1 text-lg font-semibold tabular-nums">{reported(platform.rows, "engagements")}</p></div>
              <div><p className="text-[10px] text-[#89958d]">Saves</p><p className="mt-1 text-lg font-semibold tabular-nums">{reported(platform.rows, "saves")}</p></div>
            </div>
          </article>)}
        </div> : <div className="rounded-2xl border border-dashed border-[#d9e4da] bg-white p-6 text-xs text-[#89958d]">No lifetime snapshots have been imported yet.</div>}
      </section>
    </>}

    <section className="space-y-4">
      <div><h2 className="text-lg font-semibold">Campaign performance</h2><p className="mt-1 text-xs text-[#89958d]">Daily provider metrics attributed to linked posts, separated by platform.</p></div>
      {campaignStats.length ? <div className="space-y-3">
        {campaignStats.map(campaign => <article key={campaign.id} className="overflow-hidden rounded-2xl border border-[#e6ece6] bg-white">
          <div className="border-b border-[#edf1ed] p-5"><p className="text-sm font-semibold">{campaign.name}</p><p className="mt-1 text-[11px] capitalize text-[#89958d]">{campaign.status} · {campaign.postCount} linked {campaign.postCount === 1 ? "post" : "posts"}</p></div>
          {campaign.platforms.length ? <div className="divide-y divide-[#edf1ed]">
            {campaign.platforms.map(platform => <div key={platform.code} className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] sm:items-center">
              <div className="text-xs font-semibold text-[#536158]">{platformName(platform.code)}</div>
              <div><p className="text-[10px] text-[#89958d]">Impressions</p><p className="mt-1 text-sm font-semibold tabular-nums">{reported(platform.rows, "impressions")}</p></div>
              <div><p className="text-[10px] text-[#89958d]">Reach</p><p className="mt-1 text-sm font-semibold tabular-nums">{reported(platform.rows, "reach")}</p></div>
              <div><p className="text-[10px] text-[#89958d]">Engagements</p><p className="mt-1 text-sm font-semibold tabular-nums">{reported(platform.rows, "engagements")}</p></div>
              <div><p className="text-[10px] text-[#89958d]">Clicks</p><p className="mt-1 text-sm font-semibold tabular-nums">{reported(platform.rows, "clicks")}</p></div>
            </div>)}
          </div> : <p className="p-5 text-xs text-[#89958d]">No daily analytics reported for this campaign yet.</p>}
        </article>)}
      </div> : <div className="rounded-2xl border border-dashed border-[#d9e4da] bg-white p-8 text-center text-xs text-[#89958d]">Create a campaign and link published posts to see its performance summary.</div>}
    </section>

    <p className="text-[11px] leading-5 text-[#89958d]">Daily values are additive within each provider. Lifetime values show the latest snapshot per destination and are not additive across collection dates. Metric definitions, eligibility and reporting windows differ by platform; SocialOS keeps provider totals separate rather than presenting misleading cross-platform sums.</p>
  </div>;
}
