import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowUpRight, CalendarDays, CheckCircle2, CirclePlus, Clock3, Instagram, Layers3, Sparkles, Youtube } from "lucide-react";
import { getActiveMembership } from "@/lib/workspace";

export default async function Page(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await getActiveMembership(supabase,user.id,"organization_id,organizations(name)");
  if(!membership) redirect("/onboarding");
  const org=membership.organizations as unknown as {name:string}|null;
  const [{count:brandCount},{count:channelCount},{data:brand}] = await Promise.all([
    supabase.from("brands").select("*",{count:"exact",head:true}).eq("organization_id",membership.organization_id),
    supabase.from("social_accounts").select("*",{count:"exact",head:true}).eq("organization_id",membership.organization_id),
    supabase.from("brands").select("name").eq("organization_id",membership.organization_id).order("created_at").limit(1).maybeSingle()
  ]);
  const firstName=user.user_metadata?.full_name?.split(" ")[0]??"there";
  const cards=[
    {label:"Brands",value:String(brandCount??0).padStart(2,"0"),note:"Your brand identities",icon:Layers3},
    {label:"Connected channels",value:String(channelCount??0).padStart(2,"0"),note:"Social accounts linked",icon:Instagram},
    {label:"Scheduled posts",value:"—",note:"Publishing calendar",icon:CalendarDays},
    {label:"Published this month",value:"—",note:"Content performance",icon:CheckCircle2}
  ];
  return <div className="space-y-9">
    <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
      <div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">YOUR SOCIAL WORKSPACE</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[38px]">Good to see you, {firstName}.</h1><p className="mt-2 text-sm text-[#77847b]">Here is the current pulse of {org?.name??"your workspace"}.</p></div>
      <Link href="/onboarding" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#176b4b]/10"><CirclePlus size={16}/> Add a brand <ArrowUpRight size={15}/></Link>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">{cards.map(({label,value,note,icon:Icon})=><article key={label} className="rounded-2xl border border-[#e6ece6] bg-white p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-[#77847b]">{label}</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eff5f0] text-[#176b4b]"><Icon size={17}/></span></div><p className="mt-5 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-[11px] text-[#9aa49d]">{note}</p></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <article className="overflow-hidden rounded-2xl border border-[#e6ece6] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf1ed] px-6 py-5"><div><h2 className="text-sm font-semibold">Your workspace</h2><p className="mt-1 text-xs text-[#89958d]">Build the foundations of your social presence</p></div><span className="rounded-full bg-[#edf5ef] px-3 py-1.5 text-[10px] font-semibold text-[#176b4b]">Getting started</span></div>
        <div className="p-6"><div className="flex items-start gap-4 rounded-xl bg-[#f7f9f6] p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#176b4b] shadow-sm"><Sparkles size={20}/></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">Connect your first social channel</h3><p className="mt-1 max-w-lg text-xs leading-5 text-[#7b887f]">Bring your Instagram, Facebook, YouTube or LinkedIn presence into one workspace. Channel connections will be enabled after provider OAuth setup.</p><span className="mt-3 inline-flex rounded-lg border border-[#e2e9e2] bg-white px-3 py-2 text-[11px] font-medium text-[#87938b]">Channel connections · Coming next</span></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#edf1ed] p-4"><p className="text-xs font-semibold">Brand identity</p><p className="mt-1 text-xs text-[#89958d]">{brand?.name??"Main brand"} is ready for setup.</p></div><div className="rounded-xl border border-[#edf1ed] p-4"><p className="text-xs font-semibold">Team collaboration</p><p className="mt-1 text-xs text-[#89958d]">Invite colleagues when team management is enabled.</p></div></div>
        </div>
      </article>
      <article className="rounded-2xl border border-[#e6ece6] bg-white p-6"><div className="flex items-center gap-2"><Clock3 size={16} className="text-[#176b4b]"/><h2 className="text-sm font-semibold">Coming up</h2></div><div className="mt-6 rounded-xl border border-dashed border-[#dfe7df] px-5 py-8 text-center"><CalendarDays size={23} className="mx-auto text-[#9aa79d]"/><p className="mt-3 text-sm font-semibold">Your calendar is clear</p><p className="mx-auto mt-1 max-w-[220px] text-xs leading-5 text-[#89958d]">Once the planner is available, your scheduled content will appear here.</p></div><div className="mt-5 flex items-center justify-between text-xs text-[#87938b]"><span>Publishing calendar</span><span className="font-medium">In development</span></div></article>
    </section>
    <section className="rounded-2xl bg-[#173f30] p-6 text-white sm:flex sm:items-center sm:justify-between sm:p-8"><div><p className="text-[10px] font-semibold tracking-[.17em] text-[#b9d9c3]">SOCIALOS STUDIO</p><h2 className="mt-2 text-xl font-semibold">One place for every brand story.</h2><p className="mt-1 text-sm text-[#c3d6c9]">Your workspace is ready. The next step is connecting your channels.</p></div><div className="mt-5 flex gap-3 sm:mt-0"><Instagram size={22} className="text-[#d7eadc]"/><Youtube size={22} className="text-[#d7eadc]"/></div></section>
  </div>;
}
