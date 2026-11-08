import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FileDown, FileSpreadsheet, ShieldCheck } from "lucide-react";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase.from("organization_members")
    .select("organization_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!member) redirect("/onboarding");

  const today = new Date().toISOString().slice(0, 10);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 29);
  const from = start.toISOString().slice(0, 10);

  return <div className="space-y-8">
    <section>
      <p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">INSIGHT DISTRIBUTION</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Reports & exports</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77847b]">Turn verified publishing and provider analytics into portable reporting data for your team and stakeholders.</p>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
      <article className="rounded-2xl border border-[#e6ece6] bg-white p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf5ef] text-[#176b4b]"><FileSpreadsheet size={20}/></span>
          <div><h2 className="text-base font-semibold">Performance data export</h2><p className="mt-1 text-xs leading-5 text-[#89958d]">Download a CSV of daily provider-reported metrics for published destinations in your active workspace.</p></div>
        </div>
        <form action="/api/social/reports/export" method="get" className="mt-7 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[#536158]">From
              <input required type="date" name="from" defaultValue={from} className="mt-2 block w-full rounded-xl border border-[#e3eae3] bg-white px-3 py-3 text-sm text-[#25352b] outline-none focus:border-[#79a98a]"/>
            </label>
            <label className="block text-xs font-medium text-[#536158]">To
              <input required type="date" name="to" defaultValue={today} className="mt-2 block w-full rounded-xl border border-[#e3eae3] bg-white px-3 py-3 text-sm text-[#25352b] outline-none focus:border-[#79a98a]"/>
            </label>
          </div>
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#176b4b] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#12583d]"><FileDown size={15}/> Download CSV report</button>
          <p className="text-[10px] text-[#89958d]">Maximum range: 366 days. Export includes only rows reported by providers; unavailable metrics remain blank.</p>
        </form>
      </article>

      <aside className="rounded-2xl border border-[#e6ece6] bg-white p-6">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f5f1] text-[#617166]"><ShieldCheck size={19}/></span>
        <h2 className="mt-4 text-sm font-semibold">Reporting integrity</h2>
        <ul className="mt-3 space-y-3 text-xs leading-5 text-[#7c8980]">
          <li>Daily rows only—lifetime snapshots are not added into period totals.</li>
          <li>Platforms remain separately identified; unlike metrics are not blended.</li>
          <li>Empty values mean the provider did not report that metric, not zero.</li>
          <li>Export access follows the signed-in user's workspace and brand-level row permissions.</li>
        </ul>
      </aside>
    </section>

    <section className="rounded-2xl border border-dashed border-[#d9e4da] bg-white p-6">
      <h2 className="text-sm font-semibold">What this release includes</h2>
      <p className="mt-2 max-w-3xl text-xs leading-6 text-[#89958d]">A tenant-scoped CSV export covering published posts across the workspace, including posts not attached to a campaign. This release deliberately avoids generated executive conclusions, comparison claims or PDF layouts until the underlying provider data and reporting definitions have been validated in a live SocialOS environment.</p>
    </section>
  </div>;
}
