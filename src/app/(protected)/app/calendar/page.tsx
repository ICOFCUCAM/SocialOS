import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, ArrowRight, CalendarDays, Plus } from "lucide-react";
import { PublishReadinessCheck } from "@/components/app/publish-readiness-check";

type Post={id:string;title:string|null;body:string;status:string;scheduled_at:string|null;published_at:string|null;created_at:string;brand_id:string};
function monthLabel(date:Date){return new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(date);}
function dayLabel(date:Date){return new Intl.DateTimeFormat(undefined,{day:"numeric"}).format(date);}
function dateKey(date:Date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");}
function statusTone(status:string){return status==="published"?"border-[#d9e9dc] bg-[#edf5ef] text-[#176b4b]":status==="failed"?"border-[#f0d9d5] bg-[#fbefed] text-[#9a4b3d]":status==="scheduled"?"border-[#eee4c9] bg-[#faf5e8] text-[#8a6a28]":"border-[#e7ece7] bg-[#f5f7f4] text-[#78867c]";}

export default async function CalendarPage({searchParams}:{searchParams:Promise<{month?:string;created?:string}>}){
  const {month:monthParam,created}=await searchParams;
  const now=new Date();
  const parsed=monthParam&&/^\d{4}-\d{2}$/.test(monthParam)?new Date(Number(monthParam.slice(0,4)),Number(monthParam.slice(5,7))-1,1):new Date(now.getFullYear(),now.getMonth(),1);
  const first=new Date(parsed.getFullYear(),parsed.getMonth(),1);
  const gridStart=new Date(first);gridStart.setDate(first.getDate()-((first.getDay()+6)%7));
  const gridEnd=new Date(gridStart);gridEnd.setDate(gridStart.getDate()+42);
  const prev=new Date(first);prev.setMonth(prev.getMonth()-1);
  const next=new Date(first);next.setMonth(next.getMonth()+1);
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:member}=await supabase.from("organization_members").select("organization_id")
    .eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(!member)redirect("/onboarding");
  const [{data:posts,error},{data:brands}] = await Promise.all([
    supabase.from("social_posts").select("id,title,body,status,scheduled_at,published_at,created_at,brand_id")
      .eq("organization_id",member.organization_id)
      .order("created_at",{ascending:false}).limit(500),
    supabase.from("brands").select("id,name").eq("organization_id",member.organization_id)
  ]);
  if(error)throw new Error("Unable to load the content calendar.");
  const brandMap=new Map((brands??[]).map(b=>[b.id,b.name]));
  const rows=(posts??[]) as Post[];
  const byDay=new Map<string,Post[]>();
  for(const post of rows){
    const when=post.scheduled_at||post.published_at||post.created_at;
    const date=new Date(when);
    const key=dateKey(date);
    byDay.set(key,[...(byDay.get(key)||[]),post]);
  }
  const days=Array.from({length:42},(_,i)=>{const d=new Date(gridStart);d.setDate(gridStart.getDate()+i);return d;});
  const monthPosts=rows.filter(p=>{const date=new Date(p.scheduled_at||p.published_at||p.created_at);return date.getFullYear()===first.getFullYear()&&date.getMonth()===first.getMonth();});
  const scheduled=monthPosts.filter(p=>p.status==="scheduled").length;
  const published=monthPosts.filter(p=>p.status==="published"||p.status==="partially_published").length;
  return <div className="space-y-7">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">CONTENT PLANNING</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Content calendar</h1><p className="mt-2 text-sm text-[#77847b]">Plan and review your brand publishing schedule.</p></div><Link href="/app/compose" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-5 py-3 text-xs font-semibold text-white"><Plus size={15}/> Create post</Link></section>
    {created&&<p role="status" className="rounded-xl border border-[#d9e9dc] bg-[#f1f8f2] px-4 py-3 text-xs text-[#176b4b]">Your post was created. It will appear below according to its schedule or creation date.</p>}
    <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Posts this month</p><p className="mt-3 text-3xl font-semibold">{monthPosts.length}</p></article><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Scheduled</p><p className="mt-3 text-3xl font-semibold">{scheduled}</p></article><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Published / partial</p><p className="mt-3 text-3xl font-semibold">{published}</p></article></section>
    <section className="overflow-hidden rounded-2xl border border-[#e6ece6] bg-white">
      <div className="flex items-center justify-between border-b border-[#edf1ed] px-4 py-4 sm:px-6"><div><h2 className="text-sm font-semibold">{monthLabel(first)}</h2><p className="mt-1 text-[10px] text-[#89958d]">Scheduled posts, drafts and publication activity</p></div><div className="flex items-center gap-2"><Link href={`/app/calendar?month=${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,"0")}`} aria-label="Previous month" className="rounded-lg border border-[#e6ece6] p-2 text-[#718076] hover:bg-[#f6f8f5]"><ArrowLeft size={15}/></Link><Link href="/app/calendar" className="rounded-lg border border-[#e6ece6] px-3 py-2 text-[10px] font-semibold text-[#718076]">Today</Link><Link href={`/app/calendar?month=${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}`} aria-label="Next month" className="rounded-lg border border-[#e6ece6] p-2 text-[#718076] hover:bg-[#f6f8f5]"><ArrowRight size={15}/></Link></div></div>
      <div className="grid grid-cols-7 border-b border-[#edf1ed] bg-[#fafbf9]">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=><div key={day} className="px-1 py-3 text-center text-[9px] font-semibold uppercase tracking-wider text-[#89958d] sm:text-[10px]">{day}</div>)}</div>
      <div className="grid grid-cols-7">{days.map(day=>{const key=dateKey(day);const entries=byDay.get(key)||[];const inMonth=day.getMonth()===first.getMonth();return <div key={key} className={`min-h-24 border-b border-r border-[#edf1ed] p-1.5 sm:min-h-32 sm:p-2 ${inMonth?"bg-white":"bg-[#fafbf9]"}`}><div className="flex items-center justify-between"><span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] ${key===dateKey(now)?"bg-[#176b4b] font-semibold text-white":inMonth?"text-[#53665a]":"text-[#b4bdb6]"}`}>{dayLabel(day)}</span>{entries.length>0&&<span className="text-[9px] text-[#9aa49d]">{entries.length}</span>}</div><div className="mt-1.5 space-y-1">{entries.slice(0,3).map(post=><Link key={post.id} href="/app/publishing" title={post.title||post.body||"Social post"} className={`block truncate rounded-md border px-1.5 py-1 text-[9px] leading-3 sm:text-[10px] ${statusTone(post.status)}`}><span className="hidden sm:inline">{brandMap.get(post.brand_id)||"Brand"} · </span>{post.title||post.body.slice(0,24)||"Untitled post"}</Link>)}{entries.length>3&&<p className="px-1 text-[9px] text-[#89958d]">+{entries.length-3} more</p>}</div></div>})}</div>
    </section>
    <section className="rounded-2xl border border-[#e6ece6] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">This month’s posts</h2><p className="mt-1 text-xs text-[#89958d]">A complete list of content in this calendar month</p></div><CalendarDays size={17} className="text-[#176b4b]"/></div>{monthPosts.length?<div className="mt-4 divide-y divide-[#edf1ed]">{monthPosts.map(post=><div key={post.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{post.title||post.body.slice(0,90)||"Untitled post"}</p><p className="mt-1 text-[10px] text-[#89958d]">{brandMap.get(post.brand_id)||"Brand"} · {new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(post.scheduled_at||post.published_at||post.created_at))}</p></div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold capitalize ${statusTone(post.status)}`}>{post.status.replaceAll("_"," ")}</span></div>)}</div>:<div className="py-10 text-center"><p className="text-sm font-semibold">No posts for this month</p><p className="mt-1 text-xs text-[#89958d]">Create your first post to start filling the calendar.</p><Link href="/app/compose" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#176b4b] px-4 py-2.5 text-xs font-semibold text-white"><Plus size={13}/> Create post</Link></div>}</section>
  </div>;
}
