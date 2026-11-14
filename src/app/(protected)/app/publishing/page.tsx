import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublishingJobRetry } from "@/components/app/publishing-job-retry";
import { Activity, AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Clock3, Radio, Send, Video } from "lucide-react";

type SearchParams=Promise<{view?:string}>;
const views=["all","queued","published","failed"] as const;
type View=typeof views[number];
function label(value:string) { return value.replaceAll("_"," "); }
function dateLabel(value:string|null) {
  if(!value) return "Not scheduled";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Date unavailable":new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(date);
}
function statusClass(status:string) {
  if(["published","succeeded"].includes(status)) return "bg-[#edf5ef] text-[#176b4b]";
  if(["failed","dead_letter"].includes(status)) return "bg-[#fbefed] text-[#9a4b3d]";
  if(["queued","retry","running","publishing","processing","scheduled"].includes(status)) return "bg-[#faf5e8] text-[#8a6a28]";
  return "bg-[#f1f3f1] text-[#77847b]";
}

export default async function PublishingPage({searchParams}:{searchParams:SearchParams}) {
  const {view:rawView="all"}=await searchParams;
  const view=(views as readonly string[]).includes(rawView)?rawView as View:"all";
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:member}=await supabase.from("organization_members").select("organization_id,role")
    .eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(!member) redirect("/onboarding");

  const monthStart=new Date();
  monthStart.setDate(1);monthStart.setHours(0,0,0,0);
  const [{count:scheduledCount},{count:publishedCount},{count:failedCount},{count:queueCount},{data:posts,error:postsError},{data:accounts}] = await Promise.all([
    supabase.from("social_posts").select("id",{count:"exact",head:true}).eq("organization_id",member.organization_id).eq("status","scheduled"),
    supabase.from("social_post_targets").select("id",{count:"exact",head:true}).eq("organization_id",member.organization_id).eq("status","published").gte("published_at",monthStart.toISOString()),
    supabase.from("publish_jobs").select("id",{count:"exact",head:true}).eq("organization_id",member.organization_id).eq("status","dead_letter"),
    supabase.from("publish_jobs").select("id",{count:"exact",head:true}).eq("organization_id",member.organization_id).in("status",["queued","retry","running"]),
    supabase.from("social_posts").select("id,title,body,status,scheduled_at,published_at,created_at,last_error_code,last_error_message")
      .eq("organization_id",member.organization_id).order("created_at",{ascending:false}).limit(60),
    supabase.from("social_accounts").select("id,account_name,platform:social_platforms(code,name)")
      .eq("organization_id",member.organization_id)
  ]);
  if(postsError) throw new Error("Unable to load publishing operations.");
  const postRows=posts??[];
  const postIds=postRows.map(p=>p.id);
  const [{data:targets},{data:jobs}] = postIds.length?await Promise.all([
    supabase.from("social_post_targets").select("id,post_id,social_account_id,status,platform_post_id,platform_permalink,published_at,attempt_count,last_error_code,last_error_message")
      .eq("organization_id",member.organization_id).in("post_id",postIds),
    supabase.from("publish_jobs").select("id,post_id,target_id,status,attempt_count,max_attempts,available_at,last_error_code,last_error_message,created_at")
      .eq("organization_id",member.organization_id).in("post_id",postIds).order("created_at",{ascending:false})
  ]):[{data:[]},{data:[]}];
  const targetRows=targets??[];
  const jobRows=jobs??[];
  const accountMap=new Map((accounts??[]).map(a=>[a.id,a]));
  const postMap=new Map(postRows.map(p=>[p.id,p]));
  const targetMap=new Map(targetRows.map(t=>[t.id,t]));
  const jobByTarget=new Map<string,typeof jobRows[number]>();
  for(const job of jobRows) if(!jobByTarget.has(job.target_id)) jobByTarget.set(job.target_id,job);
  const canRetry=["owner","administrator","manager","publisher"].includes(member.role);
  const visibleJobs=jobRows.filter(job=>{
    if(view==="queued") return ["queued","retry","running"].includes(job.status);
    if(view==="failed") return job.status==="dead_letter";
    if(view==="published") return job.status==="succeeded";
    return true;
  });
  const stats=[
    {label:"Scheduled posts",value:scheduledCount??0,note:"Awaiting publication",icon:CalendarClock},
    {label:"In the queue",value:queueCount??0,note:"Queued, retrying or running",icon:Activity},
    {label:"Published this month",value:publishedCount??0,note:"Successful channel deliveries",icon:CheckCircle2},
    {label:"Needs attention",value:failedCount??0,note:"Dead-letter jobs",icon:AlertTriangle}
  ];
  const viewLabels:Record<View,string>={all:"All activity",queued:"Queue",published:"Published",failed:"Needs attention"};
  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">PUBLISHING OPERATIONS</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Publishing centre</h1><p className="mt-2 text-sm text-[#77847b]">Monitor delivery across your connected social channels.</p></div>
      <Link href="/app/channels" className="inline-flex items-center gap-2 rounded-xl border border-[#dfe7e0] bg-white px-4 py-3 text-xs font-semibold text-[#53665a]"><Radio size={15}/> Manage channels <ArrowUpRight size={14}/></Link>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">{stats.map(({label:heading,value,note,icon:Icon})=><article key={heading} className="rounded-2xl border border-[#e6ece6] bg-white p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-[#77847b]">{heading}</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eff5f0] text-[#176b4b]"><Icon size={17}/></span></div><p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-[11px] text-[#9aa49d]">{note}</p></article>)}</section>
    <section className="rounded-2xl border border-[#e6ece6] bg-white">
      <div className="flex flex-col justify-between gap-4 border-b border-[#edf1ed] px-5 py-5 sm:flex-row sm:items-center sm:px-6"><div><h2 className="text-sm font-semibold">Publishing activity</h2><p className="mt-1 text-xs text-[#89958d]">Latest scheduled posts and channel delivery jobs</p></div><nav className="flex flex-wrap gap-1 rounded-xl bg-[#f5f7f4] p-1">{views.map(item=><Link key={item} href={item==="all"?"/app/publishing":`/app/publishing?view=${item}`} className={`rounded-lg px-3 py-2 text-[11px] font-semibold capitalize ${view===item?"bg-white text-[#176b4b] shadow-sm":"text-[#839087] hover:text-[#53665a]"}`}>{viewLabels[item]}</Link>)}</nav></div>
      {visibleJobs.length?<div className="divide-y divide-[#edf1ed]">{visibleJobs.slice(0,60).map(job=>{
        const target=targetMap.get(job.target_id);
        const post=postMap.get(job.post_id);
        const account=target?accountMap.get(target.social_account_id):null;
        const platform=account?.platform as unknown as {code:string;name:string}|null;
        const unknown=job.last_error_code==="PUBLISH_OUTCOME_UNKNOWN"||target?.last_error_code==="PUBLISH_OUTCOME_UNKNOWN";
        const retryable=job.status==="dead_letter"&&!unknown&&Boolean(target)&&target?.status==="failed";
        return <article key={job.id} className="grid gap-3 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusClass(job.status)}`}>{label(job.status)}</span><span className="text-[10px] text-[#9aa49d]">{platform?.name??"Social channel"}</span><span className="text-[10px] text-[#9aa49d]">·</span><span className="text-[10px] text-[#9aa49d]">{dateLabel(job.available_at)}</span></div>
            <h3 className="mt-2 truncate text-sm font-semibold">{post?.title||post?.body?.slice(0,100)||"Untitled social post"}</h3>
            <p className="mt-1 text-xs text-[#89958d]">{account?.account_name??"Account unavailable"} · Attempt {job.attempt_count}/{job.max_attempts}</p>
            {(job.last_error_message||target?.last_error_message)&&<p className="mt-2 max-w-3xl text-xs leading-5 text-[#9a6258]">{unknown?"Provider outcome uncertain. Check the social platform before taking any retry action.":job.last_error_message||target?.last_error_message}</p>}
            {target?.platform_permalink&&<a href={target.platform_permalink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#176b4b]">View published post <ArrowUpRight size={12}/></a>}
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">{retryable&&canRetry?<PublishingJobRetry jobId={job.id}/>:unknown?<span className="max-w-40 text-right text-[10px] leading-4 text-[#9a6258]">Manual reconciliation required</span>:null}</div>
        </article>;
      })}</div>:<div className="px-6 py-16 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#eff5f0] text-[#176b4b]"><Send size={20}/></span><h3 className="mt-4 text-sm font-semibold">No {view==="all"?"publishing activity":view==="failed"?"failed jobs":view==="published"?"published jobs":"queued jobs"} yet</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#89958d]">When posts enter the publishing workflow, their delivery status and platform results will appear here.</p><Link href="/app/channels" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#176b4b] px-4 py-2.5 text-xs font-semibold text-white">Review connected channels <ArrowUpRight size={13}/></Link></div>}
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><div className="flex items-center gap-2"><Clock3 size={16} className="text-[#176b4b]"/><h2 className="text-sm font-semibold">Queue health</h2></div><p className="mt-2 text-xs leading-5 text-[#89958d]">Queued and retrying jobs are processed by the publisher worker. Jobs that exceed retry limits move to dead-letter for operator review.</p><p className="mt-4 text-xs font-semibold text-[#53665a]">{queueCount??0} active queue jobs</p></article>
      <article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-[#9a6a37]"/><h2 className="text-sm font-semibold">Safe retry policy</h2></div><p className="mt-2 text-xs leading-5 text-[#89958d]">Jobs with uncertain provider outcomes are never automatically or manually retried here. Verify publication on the platform first to avoid duplicate posts.</p><p className="mt-4 text-xs font-semibold text-[#53665a]">Unknown outcomes require manual reconciliation</p></article>
    </section>
  </div>;
}
