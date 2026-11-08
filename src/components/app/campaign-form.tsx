"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

type Campaign={
  id?:string;name:string;description:string;objective:string;target_audience:string;
  key_message:string;call_to_action:string;content_pillars:string[];channels:string[];
  start_date:string|null;end_date:string|null;status:string;
  success_metrics:{name:string;target:string;unit:string}[];
};
const platforms=[["instagram","Instagram"],["facebook","Facebook"],["youtube","YouTube"],["linkedin","LinkedIn"],["threads","Threads"],["pinterest","Pinterest"],["tiktok","TikTok"],["x","X"]];
const field="mt-2 w-full rounded-xl border border-[#dfe7e0] bg-white px-4 py-3 text-sm outline-none focus:border-[#176b4b]";
const area=field+" min-h-24 resize-y leading-6";
const split=(value:string)=>[...new Set(value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))].slice(0,20);

export function CampaignForm({organizationId,brandId,initial,mode="create",brandOptions=[]}:{
 organizationId:string;brandId:string;initial?:Campaign;mode?:"create"|"edit";brandOptions?:{id:string;name:string}[];
}){
 const router=useRouter();
 const [selectedBrandId,setSelectedBrandId]=useState(brandId);\n const [name,setName]=useState(initial?.name??"");
 const [description,setDescription]=useState(initial?.description??"");
 const [objective,setObjective]=useState(initial?.objective??"");
 const [audience,setAudience]=useState(initial?.target_audience??"");
 const [message,setMessage]=useState(initial?.key_message??"");
 const [cta,setCta]=useState(initial?.call_to_action??"");
 const [pillars,setPillars]=useState((initial?.content_pillars??[]).join("\n"));
 const [channels,setChannels]=useState<string[]>(initial?.channels??[]);
 const [startDate,setStartDate]=useState(initial?.start_date??"");
 const [endDate,setEndDate]=useState(initial?.end_date??"");
 const [status,setStatus]=useState(initial?.status??"draft");
 const [metrics,setMetrics]=useState((initial?.success_metrics??[]).map(m=>[m.name,m.target,m.unit].join(" | ")).join("\n"));
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 function toggleChannel(value:string){setChannels(current=>current.includes(value)?current.filter(x=>x!==value):[...current,value]);}
 async function save(){
  setError("");
  if(name.trim().length<2)return setError("Give your campaign a name.");
  if(startDate&&endDate&&endDate<startDate)return setError("The end date cannot be earlier than the start date.");
  const successMetrics=metrics.split(/\r?\n/).map(line=>line.split("|").map(x=>x.trim())).filter(parts=>parts[0]).slice(0,10).map(parts=>({name:parts[0],target:parts[1]??"",unit:parts[2]??""}));
  setBusy(true);
  try{
   const payload={organizationId,brandId:selectedBrandId,name,description,objective,targetAudience:audience,keyMessage:message,callToAction:cta,contentPillars:split(pillars),channels,startDate,endDate,status,successMetrics};
   const url=mode==="create"?"/api/social/campaigns":"/api/social/campaigns/"+initial?.id;
   const response=await fetch(url,{method:mode==="create"?"POST":"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Campaign could not be saved.");
   router.push(mode==="create"?"/app/campaigns/"+data.id:"/app/campaigns/"+initial?.id);
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Campaign could not be saved.");}
  finally{setBusy(false);}
 }
 return <div className="space-y-6">
  <section className="rounded-2xl border border-[#e6ece6] bg-white p-5 sm:p-7">
   <div><h2 className="text-sm font-semibold">Campaign overview</h2><p className="mt-1 text-xs text-[#89958d]">Define what the campaign should achieve and the audience it serves.</p></div>
   {mode==="create"&&brandOptions.length>1&&<><label className="mt-5 block text-xs font-semibold text-[#53665a]">Brand</label><select value={selectedBrandId} onChange={e=>setSelectedBrandId(e.target.value)} className={field}>{brandOptions.map(brand=><option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></>}\n   <label className="mt-5 block text-xs font-semibold text-[#53665a]">Campaign name</label><input value={name} onChange={e=>setName(e.target.value)} maxLength={160} placeholder="e.g. Spring product launch" className={field}/>
   <label className="mt-5 block text-xs font-semibold text-[#53665a]">Description</label><textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={3000} rows={3} placeholder="A short internal overview of the campaign…" className={area}/>
   <label className="mt-5 block text-xs font-semibold text-[#53665a]">Primary objective</label><textarea value={objective} onChange={e=>setObjective(e.target.value)} maxLength={1600} rows={3} placeholder="What measurable change should this campaign create?" className={area}/>
   <label className="mt-5 block text-xs font-semibold text-[#53665a]">Target audience</label><textarea value={audience} onChange={e=>setAudience(e.target.value)} maxLength={1200} rows={3} placeholder="Who are you trying to reach? Include needs, interests and context." className={area}/>
   <label className="mt-5 block text-xs font-semibold text-[#53665a]">Key message</label><textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={1200} rows={3} placeholder="What is the one message the audience should remember?" className={area}/>
   <label className="mt-5 block text-xs font-semibold text-[#53665a]">Call to action</label><input value={cta} onChange={e=>setCta(e.target.value)} maxLength={300} placeholder="e.g. Register for the event" className={field}/>
  </section>
  <section className="rounded-2xl border border-[#e6ece6] bg-white p-5 sm:p-7">
   <h2 className="text-sm font-semibold">Content strategy</h2><p className="mt-1 text-xs text-[#89958d]">Keep the campaign consistent across channels and formats.</p>
   <label className="mt-5 block text-xs font-semibold text-[#53665a]">Content pillars <span className="font-normal text-[#9aa49d]">· One per line</span></label><textarea value={pillars} onChange={e=>setPillars(e.target.value)} rows={4} placeholder={"Education\nProduct stories\nCustomer outcomes"} className={area}/>
   <p className="mt-5 text-xs font-semibold text-[#53665a]">Channels</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{platforms.map(([value,label])=><label key={value} className="flex items-center gap-2 rounded-xl border border-[#edf1ed] px-3 py-3 text-xs text-[#617166]"><input type="checkbox" checked={channels.includes(value)} onChange={()=>toggleChannel(value)} className="h-4 w-4 accent-[#176b4b]"/>{label}</label>)}</div>
   <label className="mt-5 block text-xs font-semibold text-[#53665a]">Success metrics <span className="font-normal text-[#9aa49d]">· One per line: metric | target | unit</span></label><textarea value={metrics} onChange={e=>setMetrics(e.target.value)} rows={3} placeholder={"Reach | 50000 | people\nWebsite visits | 2000 | visits\nLeads | 100 | leads"} className={area}/>
  </section>
  <section className="rounded-2xl border border-[#e6ece6] bg-white p-5 sm:p-7">
   <h2 className="text-sm font-semibold">Campaign timeline and status</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="text-xs font-semibold text-[#53665a]">Start date</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className={field}/></div><div><label className="text-xs font-semibold text-[#53665a]">End date</label><input type="date" value={endDate} min={startDate||undefined} onChange={e=>setEndDate(e.target.value)} className={field}/></div></div>
   <label className="mt-5 block text-xs font-semibold text-[#53665a]">Status</label><select value={status} onChange={e=>setStatus(e.target.value)} className={field}>{(mode==="create"?["draft","planned"]:["draft","planned","active","paused","completed","archived"]).map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</select>
   {error&&<p role="alert" className="mt-4 rounded-xl bg-[#fbefed] px-4 py-3 text-xs text-[#9a4b3d]">{error}</p>}
   <div className="mt-6 flex justify-end"><button type="button" disabled={busy} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-[#176b4b] px-6 py-3 text-xs font-semibold text-white disabled:opacity-50">{busy?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>} {busy?"Saving…":mode==="create"?"Create campaign":"Save changes"}</button></div>
  </section>
 </div>;
}
