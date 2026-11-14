import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowDownRight, ArrowUpRight, FileDown, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { PrintReportButton } from "@/components/app/print-report-button";
import { getActiveMembership } from "@/lib/workspace";

type MetricRow = { target_id: string; metric_date: string; impressions: number | null; reach: number | null; engagements: number | null; clicks: number | null };
type AccountRow = { id: string; platform_id: string };
type PlatformRow = { id: string; code: string };
type TargetRow = { id: string; social_account_id: string };

const validDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z")));
const iso = (date: Date) => date.toISOString().slice(0, 10);
const fmt = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en", { notation: value >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
const sum = (rows: MetricRow[], key: "impressions" | "reach" | "engagements" | "clicks") => {
  const values = rows.map(row => row[key]).filter((value): value is number => typeof value === "number");
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
};
const delta = (current: number | null, previous: number | null) => {
  if (current === null || previous === null) return "Insufficient reported data";
  if (previous === 0) return current === 0 ? "No change from zero" : "Activity reported; no non-zero baseline";
  const change = ((current - previous) / previous) * 100;
  return (change > 0 ? "+" : "") + change.toFixed(1) + "%";
};
const platformName = (code: string) => ({ facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", linkedin: "LinkedIn" }[code] ?? code);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await getActiveMembership(supabase,user.id,"organization_id");
  if (!member) redirect("/onboarding");

  const today = iso(new Date());
  const defaultStart = new Date(Date.parse(today + "T00:00:00Z"));
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);
  const requestedTo = validDate(params.to) ? params.to! : today;
  const requestedFrom = validDate(params.from) ? params.from! : iso(defaultStart);
  const span = (Date.parse(requestedTo + "T00:00:00Z") - Date.parse(requestedFrom + "T00:00:00Z")) / 86400000;
  const validRange = requestedFrom <= requestedTo && span <= 89;
  const to = validRange ? requestedTo : today;
  const from = validRange ? requestedFrom : iso(defaultStart);
  const days = Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000) + 1;
  const previousTo = iso(new Date(Date.parse(from + "T00:00:00Z") - 86400000));
  const previousFrom = iso(new Date(Date.parse(from + "T00:00:00Z") - days * 86400000));

  const PAGE_SIZE = 1000;
  const MAX_TARGETS = 50000;
  const MAX_METRICS = 100000;
  const targetRows: TargetRow[] = [];
  for (let offset = 0; offset <= MAX_TARGETS; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("social_post_targets")
      .select("id,social_account_id").eq("organization_id", member.organization_id)
      .eq("status", "published").order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Reporting destinations are unavailable.");
    targetRows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    if (targetRows.length > MAX_TARGETS) throw new Error("This report exceeds the 50,000-destination interactive limit. Narrow the reporting scope.");
  }
  if (targetRows.length > MAX_TARGETS) throw new Error("This report exceeds the 50,000-destination interactive limit. Narrow the reporting scope.");
  const targetIds = targetRows.map(row => row.id);
  const accountIds = [...new Set(targetRows.map(row => row.social_account_id))];

  const accountRows: AccountRow[] = [];
  for (let index = 0; index < accountIds.length; index += 200) {
    const { data, error } = await supabase.from("social_accounts").select("id,platform_id")
      .eq("organization_id", member.organization_id).in("id", accountIds.slice(index, index + 200));
    if (error) throw new Error("Connected account metadata is unavailable.");
    accountRows.push(...(data ?? []));
  }

  const metricRows: MetricRow[] = [];
  for (let index = 0; index < targetIds.length; index += 200) {
    const ids = targetIds.slice(index, index + 200);
    for (let offset = 0; offset <= MAX_METRICS; offset += PAGE_SIZE) {
      const { data, error } = await supabase.from("social_post_analytics_daily")
        .select("target_id,metric_date,impressions,reach,engagements,clicks")
        .eq("organization_id", member.organization_id).eq("period_type", "daily")
        .in("target_id", ids).gte("metric_date", previousFrom).lte("metric_date", to)
        .order("metric_date", { ascending: true }).order("target_id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error("Provider reporting data is unavailable.");
      metricRows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
      if (metricRows.length > MAX_METRICS) throw new Error("This report exceeds the 100,000-row interactive limit. Narrow the reporting period.");
    }
    if (metricRows.length > MAX_METRICS) throw new Error("This report exceeds the 100,000-row interactive limit. Narrow the reporting period.");
  }
  const platformIds = [...new Set(accountRows.map(row => row.platform_id))];
  const platformRows: PlatformRow[] = [];
  for (let index = 0; index < platformIds.length; index += 200) {
    const { data, error } = await supabase.from("social_platforms").select("id,code").in("id", platformIds.slice(index, index + 200));
    if (error) throw new Error("Platform metadata is unavailable.");
    platformRows.push(...(data ?? []));
  }
  const codeById = new Map(platformRows.map(row => [row.id, row.code]));
  const platformByAccount = new Map(accountRows.map(row => [row.id, codeById.get(row.platform_id) ?? "unknown"]));
  const platformByTarget = new Map(targetRows.map(row => [row.id, platformByAccount.get(row.social_account_id) ?? "unknown"]));

  const rows = metricRows;
  const codes = [...new Set(rows.map(row => platformByTarget.get(row.target_id) ?? "unknown"))].sort();
  const reports = codes.map(code => {
    const providerRows = rows.filter(row => platformByTarget.get(row.target_id) === code);
    const current = providerRows.filter(row => row.metric_date >= from && row.metric_date <= to);
    const previous = providerRows.filter(row => row.metric_date >= previousFrom && row.metric_date <= previousTo);
    const currentDates = new Set(current.map(row => row.metric_date));
    const previousDates = new Set(previous.map(row => row.metric_date));
    const values = (["impressions", "reach", "engagements", "clicks"] as const).map(key => ({ key, current: sum(current, key), previous: sum(previous, key) }));
    return { code, current, currentDates: currentDates.size, previousDates: previousDates.size, values };
  }).filter(report => report.current.length || report.values.some(metric => metric.previous !== null));

  const totalRows = reports.reduce((total, report) => total + report.current.length, 0);
  const summary = reports.map(report => {
    const impressions = report.values.find(metric => metric.key === "impressions")!;
    const engagements = report.values.find(metric => metric.key === "engagements")!;
    if (!report.current.length) return `${platformName(report.code)}: no daily provider metrics were reported in the selected period.`;
    return `${platformName(report.code)}: ${fmt(impressions.current)} reported impressions and ${fmt(engagements.current)} reported engagements. Impressions changed ${delta(impressions.current, impressions.previous)}; engagements changed ${delta(engagements.current, engagements.previous)} versus the preceding ${days}-day period. These measures are provider-specific and are not compared with other platforms.`;
  });

  return <div className="report-print-root space-y-8">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">INSIGHT DISTRIBUTION</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Reports & exports</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#77847b]">Compare provider-reported daily performance across equivalent periods and prepare a factual executive brief.</p></div>
      <div className="report-print-hidden flex flex-wrap gap-2"><PrintReportButton/><Link href={`/api/social/reports/export?from=${from}&to=${to}`} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-4 py-3 text-xs font-semibold text-[#176b4b] hover:bg-[#f7faf7]"><FileDown size={15}/> Export CSV</Link></div>
    </section>

    <section className="report-print-hidden rounded-2xl border border-[#e6ece6] bg-white p-6 sm:p-7">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf5ef] text-[#176b4b]"><FileSpreadsheet size={19}/></span><div><h2 className="text-sm font-semibold">Reporting period</h2><p className="mt-1 text-[11px] text-[#89958d]">Comparison uses the immediately preceding period of equal length.</p></div></div>
      <form method="get" action="/app/reports" className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-medium text-[#536158]">From<input required type="date" name="from" max={to} defaultValue={from} className="mt-2 block w-full rounded-xl border border-[#e3eae3] px-3 py-3 text-sm outline-none focus:border-[#79a98a]"/></label>
        <label className="flex-1 text-xs font-medium text-[#536158]">To<input required type="date" name="to" min={from} defaultValue={to} className="mt-2 block w-full rounded-xl border border-[#e3eae3] px-3 py-3 text-sm outline-none focus:border-[#79a98a]"/></label>
        <button className="rounded-xl bg-[#176b4b] px-5 py-3 text-xs font-semibold text-white hover:bg-[#12583d]" type="submit">Run comparison</button>
      </form>
      {!validRange && <p className="mt-3 text-xs text-[#9a6b28]">The requested range was invalid or exceeded 90 days. Showing the default 30-day period instead.</p>}
      <p className="mt-4 text-[10px] text-[#89958d]">Current: {from} to {to} · Previous: {previousFrom} to {previousTo} · Maximum period: 90 days</p>
    </section>

    <section className="space-y-4"><div><h2 className="text-lg font-semibold">Executive brief</h2><p className="mt-1 text-xs text-[#89958d]">A rules-based summary of reported figures, not AI-generated assumptions or causal claims.</p></div>
      <article className="rounded-2xl border border-[#e6ece6] bg-white p-6 sm:p-7"><div className="flex items-center gap-2 text-xs font-semibold text-[#536158]"><ShieldCheck size={15} className="text-[#176b4b]"/> Reporting integrity</div>
        {totalRows ? <ul className="mt-4 space-y-3">{summary.map(line => <li key={line} className="text-sm leading-6 text-[#536158]">{line}</li>)}</ul> : <p className="mt-4 text-sm leading-6 text-[#89958d]">No daily provider analytics are available for the selected period. The brief will populate when verified provider data has been collected.</p>}
        <p className="mt-5 border-t border-[#edf1ed] pt-4 text-[10px] leading-5 text-[#89958d]">Coverage: {totalRows} daily metric rows across {reports.filter(report => report.current.length).length} providers. Reporting days can differ by provider. This summary does not combine metrics across platforms or use lifetime snapshots.</p>
      </article>
    </section>

    <section className="space-y-4"><div><h2 className="text-lg font-semibold">Period comparison by platform</h2><p className="mt-1 text-xs text-[#89958d]">Each provider is assessed against its own previous period. Metric definitions and availability may differ.</p></div>
      {reports.length ? <div className="grid gap-4 xl:grid-cols-2">{reports.map(report => <article key={report.code} className="rounded-2xl border border-[#e6ece6] bg-white p-5">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{platformName(report.code)}</h3><p className="mt-1 text-[10px] text-[#89958d]">{report.currentDates} current reporting days · {report.previousDates} previous reporting days</p></div><span className="rounded-full bg-[#edf5ef] px-2.5 py-1 text-[9px] font-semibold text-[#176b4b]">Provider-specific</span></div>
        <div className="mt-5 grid grid-cols-2 gap-3">{report.values.map(metric => { const change = delta(metric.current, metric.previous); const positive = metric.current !== null && metric.previous !== null && metric.current > metric.previous; const negative = metric.current !== null && metric.previous !== null && metric.current < metric.previous; return <div key={metric.key} className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] capitalize text-[#89958d]">{metric.key}</p><p className="mt-2 text-xl font-semibold tabular-nums text-[#26362c]">{fmt(metric.current)}</p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-[#7d8a80]">{positive ? <ArrowUpRight size={12} className="text-[#176b4b]"/> : negative ? <ArrowDownRight size={12} className="text-[#a66a38]"/> : null}{change}</div>
          <p className="mt-1 text-[9px] text-[#a0aaa3]">Previous: {fmt(metric.previous)}</p>
        </div>; })}</div>
      </article>)}</div> : <div className="rounded-2xl border border-dashed border-[#d9e4da] bg-white p-8 text-center text-xs text-[#89958d]">No daily provider analytics have been collected for either period.</div>}
    </section>

    <section className="rounded-2xl border border-[#e6ece6] bg-white p-6"><h2 className="text-sm font-semibold">How to read this report</h2><ul className="mt-3 grid gap-3 text-xs leading-5 text-[#7c8980] sm:grid-cols-2">
      <li>Daily rows are added within each platform and reporting period only.</li><li>Missing metrics are shown as unavailable, not zero.</li><li>Positive or negative movement describes reported volume, not proof of campaign causation.</li><li>Lifetime snapshots are excluded from period comparisons.</li>
    </ul></section>
  </div>;
}
