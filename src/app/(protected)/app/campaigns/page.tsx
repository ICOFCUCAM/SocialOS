import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Megaphone, Plus, Target } from "lucide-react";
import { getActiveMembership } from "@/lib/workspace";

const tone=(status:string)=>status==="active"?"bg-[#edf5ef] text-[#176b4b]":status==="completed"?"bg-[#f1f2f0] text-[#667269]":status==="paused"?"bg-[#faf5e8] text-[#8a6a28]":"bg-[#f1f4f1] text-[#718076]";

export default async function CampaignsPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:member}=await getActiveMembership(supabase,user.id,"organization_id");
 if(!member)redirect("/onboarding");
 const [{data:campaigns,error},{data:brands}]=await Promise.all([
  supabase.from("social_campaigns").select("id,name,description,objective,status,start_date,end_date,channels,brand_id,created_at,social_campaign_posts(count)")
   .eq("organization_id",member.organization_id).order("created_at",{ascending:false}).limit(200),
  supabase.from("brands").select("id,name").eq("organization_id",member.organization_id)
 ]);
 if(error)throw new Error("Campaigns are unavailable. Ensure migration 0015 has been applied.");
 const brandMap=new Map((brands??[]).map(b=>[b.id,b.name]));
 const rows=campaigns??[];
 const active=rows.filter(c=>c.status==="active").length;
 const planned=rows.filter(c=>c.status==="planned").length;
 return <div className="space-y-7">
  <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">CAMPAIGN STRATEGY</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Campaigns</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#77847b]">Coordinate objectives, audiences, key messages, content pillars, channels and the posts that deliver each campaign.</p></div><Link href="/app/campaigns/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-5 py-3 text-xs font-semibold text-white"><Plus size={15}/> New campaign</Link></section>
  <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">All campaigns</p><p className="mt-3 text-3xl font-semibold">{rows.length}</p></article><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Active</p><p className="mt-3 text-3xl font-semibold">{active}</p></article><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Planned</p><p className="mt-3 text-3xl font-semibold">{planned}</p></article></section>
  {rows.length?<section className="grid gap-4 lg:grid-cols-2">{rows.map(c=><Link key={c.id} href={"/app/campaigns/"+c.id} className="group rounded-2xl border border-[#e6ece6] bg-white p-5 transition hover:border-[#c8d9cc] hover:shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8b988e]">{brandMap.get(c.brand_id)||"Brand"}</p><h2 className="mt-2 truncate text-base font-semibold group-hover:text-[#176b4b]">{c.name}</h2></div><span className={"shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold capitalize "+tone(c.status)}>{c.status}</span></div><p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-[#89958d]">{c.objective||c.description||"No campaign objective has been added yet."}</p><div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] text-[#7d8a80]"><span className="inline-flex items-center gap-1"><Target size={12}/>{c.social_campaign_posts?.[0]?.count??0} posts</span>{c.start_date&&<span>· {c.start_date}{c.end_date?" – "+c.end_date:""}</span>}</div><div className="mt-4 flex flex-wrap gap-1.5">{(c.channels??[]).slice(0,5).map((ch: string)=><span key={ch} className="rounded-md bg-[#f1f5f1] px-2 py-1 text-[9px] capitalize text-[#617166]">{ch}</span>)}</div></Link>)}</section>:<section className="rounded-2xl border border-dashed border-[#d9e4da] bg-white px-6 py-16 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#edf5ef] text-[#176b4b]"><Megaphone size={21}/></span><h2 className="mt-4 text-base font-semibold">Start with a campaign</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#89958d]">Define the outcome, audience and message. Then connect the posts you create to the campaign as your publishing plan takes shape.</p><Link href="/app/campaigns/new" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#176b4b] px-4 py-3 text-xs font-semibold text-white"><Plus size={14}/> Create your first campaign</Link></section>}
 </div>;
}
