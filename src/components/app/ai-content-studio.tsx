"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Sparkles, WandSparkles } from "lucide-react";

type Brand={id:string;name:string;brand_settings:unknown};
type Variant={label:string;caption:string;hashtags:string[];callToAction:string};
type Result={brand:string;platform:string;format:string;variants:Variant[];strategyNote:string;usage:{inputTokens:number|null;outputTokens:number|null;totalTokens:number|null}|null};

const platforms=[
  {value:"instagram",label:"Instagram"},{value:"facebook",label:"Facebook"},{value:"youtube",label:"YouTube"},
  {value:"linkedin",label:"LinkedIn"},{value:"threads",label:"Threads"},{value:"pinterest",label:"Pinterest"},
  {value:"tiktok",label:"TikTok"},{value:"x",label:"X"}
];
const formats=[
  {value:"caption",label:"Social caption"},{value:"educational",label:"Educational post"},
  {value:"promotional",label:"Promotional post"},{value:"story",label:"Story sequence"},
  {value:"reel_script",label:"Reel / short video script"},{value:"video_script",label:"Long-form video script"},
  {value:"carousel",label:"Carousel outline"},{value:"announcement",label:"Announcement"}
];

export function AIContentStudio({brands,initialBrandId}:{brands:Brand[];initialBrandId?:string}){
  const router=useRouter();
  const [brandId,setBrandId]=useState(initialBrandId||brands[0]?.id||"");
  const [platform,setPlatform]=useState("instagram");
  const [format,setFormat]=useState("caption");
  const [objective,setObjective]=useState("");
  const [additionalContext,setAdditionalContext]=useState("");
  const [callToAction,setCallToAction]=useState("");
  const [includeHashtags,setIncludeHashtags]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState<Result|null>(null);
  const [copied,setCopied]=useState<number|null>(null);
  const selectedBrand=useMemo(()=>brands.find(brand=>brand.id===brandId),[brands,brandId]);

  async function generate(){
    setError("");setResult(null);setCopied(null);
    if(!brandId)return setError("Select a brand first.");
    if(objective.trim().length<8)return setError("Describe what this content should achieve.");
    setBusy(true);
    try{
      const response=await fetch("/api/ai/content",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({brandId,platform,format,objective,additionalContext,callToAction,includeHashtags})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Content generation failed.");
      setResult(data as Result);
    }catch(e){setError(e instanceof Error?e.message:"Content generation failed.");}
    finally{setBusy(false);}
  }

  async function copyVariant(variant:Variant,index:number){
    const text=[variant.caption,variant.hashtags.join(" "),variant.callToAction].filter(Boolean).join("\n\n");
    try{await navigator.clipboard.writeText(text);setCopied(index);setTimeout(()=>setCopied(null),1800);}
    catch{setError("Clipboard access is unavailable. Select and copy the caption manually.");}
  }

  function openComposer(variant:Variant){
    const caption=[variant.caption,variant.hashtags.join(" "),variant.callToAction].filter(Boolean).join("\n\n");
    try{sessionStorage.setItem("socialos:composer-draft",JSON.stringify({brandId,body:caption,platform}));router.push("/app/compose?brand="+encodeURIComponent(brandId)+"&from=ai");}
    catch{void copyVariant(variant,result?.variants.indexOf(variant)??0);}
  }

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="rounded-2xl border border-[#e6ece6] bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf5ef] text-[#176b4b]"><WandSparkles size={20}/></span><div><p className="text-[10px] font-semibold tracking-[.16em] text-[#176b4b]">AI CREATIVE BRIEF</p><h2 className="mt-1 text-lg font-semibold">What should we create?</h2><p className="mt-1 text-xs text-[#89958d]">Your brand identity guides the voice, audience and message.</p></div></div>
      <label className="mt-7 block text-xs font-semibold text-[#53665a]">Brand</label>
      <select value={brandId} onChange={e=>{setBrandId(e.target.value);setResult(null);}} className="mt-2 w-full rounded-xl border border-[#dfe7e0] bg-white px-4 py-3 text-sm outline-none focus:border-[#176b4b]">{brands.map(brand=><option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label className="block text-xs font-semibold text-[#53665a]">Platform</label><select value={platform} onChange={e=>setPlatform(e.target.value)} className="mt-2 w-full rounded-xl border border-[#dfe7e0] bg-white px-3 py-3 text-sm">{platforms.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label className="block text-xs font-semibold text-[#53665a]">Content format</label><select value={format} onChange={e=>setFormat(e.target.value)} className="mt-2 w-full rounded-xl border border-[#dfe7e0] bg-white px-3 py-3 text-sm">{formats.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
      <label className="mt-5 block text-xs font-semibold text-[#53665a]">Content objective</label>
      <textarea value={objective} onChange={e=>setObjective(e.target.value)} rows={5} maxLength={1200} placeholder="What do you want this post to communicate or achieve? For example: introduce our new service, explain a customer problem, invite people to an event…" className="mt-2 w-full resize-y rounded-xl border border-[#dfe7e0] px-4 py-3 text-sm leading-6 outline-none focus:border-[#176b4b]"/>
      <label className="mt-5 block text-xs font-semibold text-[#53665a]">Additional facts or context <span className="font-normal text-[#9aa49d]">· Optional</span></label>
      <textarea value={additionalContext} onChange={e=>setAdditionalContext(e.target.value)} rows={3} maxLength={1200} placeholder="Product details, event information, approved facts, campaign context…" className="mt-2 w-full resize-y rounded-xl border border-[#dfe7e0] px-4 py-3 text-sm leading-6 outline-none focus:border-[#176b4b]"/>
      <label className="mt-5 block text-xs font-semibold text-[#53665a]">Call to action <span className="font-normal text-[#9aa49d]">· Optional</span></label>
      <input value={callToAction} onChange={e=>setCallToAction(e.target.value)} maxLength={240} placeholder="e.g. Learn more, book a consultation, visit our website" className="mt-2 w-full rounded-xl border border-[#dfe7e0] px-4 py-3 text-sm outline-none focus:border-[#176b4b]"/>
      <label className="mt-5 flex items-center gap-2 text-xs text-[#657269]"><input type="checkbox" checked={includeHashtags} onChange={e=>setIncludeHashtags(e.target.checked)} className="h-4 w-4 accent-[#176b4b]"/> Include relevant hashtags</label>
      <button type="button" onClick={()=>void generate()} disabled={busy||!brands.length} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#176b4b]/10 disabled:cursor-not-allowed disabled:opacity-50">{busy?<Loader2 size={16} className="animate-spin"/>:<Sparkles size={16}/>} {busy?"Creating content…":"Generate 3 content variations"}</button>
      {error&&<p role="alert" className="mt-4 rounded-xl border border-[#f0d9d5] bg-[#fbefed] px-4 py-3 text-xs leading-5 text-[#9a4b3d]">{error}</p>}
    </section>
    <aside className="space-y-5">
      <section className="rounded-2xl border border-[#e6ece6] bg-white p-5">
        <h3 className="text-sm font-semibold">Brand voice context</h3>
        {selectedBrand?<><p className="mt-1 text-xs text-[#89958d]">The AI uses the saved identity for {selectedBrand.name}.</p><div className="mt-4 space-y-3 text-xs">{(()=>{const s=selectedBrand.brand_settings as {voice?:{tone?:string;description?:string};audience?:string;positioning?:string;content_pillars?:string[]}|null;return <>{s?.voice?.tone&&<div><p className="font-semibold text-[#53665a]">Voice</p><p className="mt-1 leading-5 text-[#89958d]">{s.voice.tone}</p></div>}{s?.audience&&<div><p className="font-semibold text-[#53665a]">Audience</p><p className="mt-1 leading-5 text-[#89958d]">{s.audience}</p></div>}{s?.positioning&&<div><p className="font-semibold text-[#53665a]">Positioning</p><p className="mt-1 leading-5 text-[#89958d]">{s.positioning}</p></div>}{s?.content_pillars?.length&&<div><p className="font-semibold text-[#53665a]">Content pillars</p><div className="mt-2 flex flex-wrap gap-1.5">{s.content_pillars.slice(0,8).map(p=><span key={p} className="rounded-full bg-[#f1f5f1] px-2.5 py-1 text-[10px] text-[#617166]">{p}</span>)}</div></div>}{!s?.voice?.tone&&!s?.audience&&!s?.positioning&&!s?.content_pillars?.length&&<p className="leading-5 text-[#9aa49d]">No detailed brand voice saved yet. Add voice, audience and positioning in Brand Identity to improve consistency.</p>}</>;})()}</div><a href={"/app/brands/"+selectedBrand.id+"/identity"} className="mt-4 inline-flex text-xs font-semibold text-[#176b4b]">Edit brand identity →</a></>:<p className="mt-2 text-xs text-[#89958d]">Select a brand to view its context.</p>}
      </section>
      <section className="rounded-2xl bg-[#173f30] p-5 text-white"><p className="text-[10px] font-semibold tracking-[.16em] text-[#b9d9c3]">HUMAN REVIEW</p><h3 className="mt-2 text-base font-semibold">AI assists. You decide.</h3><p className="mt-2 text-xs leading-5 text-[#c3d6c9]">Generated content is a draft. Review facts, tone, rights and platform requirements before adding it to your publishing calendar.</p></section>
    </aside>
    {result&&<section className="xl:col-span-2 space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[.16em] text-[#176b4b]">GENERATED CONTENT</p><h2 className="mt-1 text-xl font-semibold">Choose your direction</h2><p className="mt-1 text-xs text-[#89958d]">Three variations for {platforms.find(p=>p.value===result.platform)?.label} · {formats.find(f=>f.value===result.format)?.label}</p></div>{result.usage?.totalTokens!=null&&<span className="text-[10px] text-[#9aa49d]">Usage: {result.usage.totalTokens.toLocaleString()} tokens</span>}</div>
      {result.variants.map((variant,index)=><article key={index} className="rounded-2xl border border-[#e6ece6] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf5ef] text-xs font-semibold text-[#176b4b]">0{index+1}</span><h3 className="text-sm font-semibold">{variant.label}</h3></div><div className="flex gap-2"><button type="button" onClick={()=>void copyVariant(variant,index)} className="inline-flex items-center gap-2 rounded-lg border border-[#e1e9e1] px-3 py-2 text-[11px] font-semibold text-[#617166]"><Copy size={13}/>{copied===index?"Copied":"Copy"}</button><button type="button" onClick={()=>openComposer(variant)} className="rounded-lg bg-[#176b4b] px-3 py-2 text-[11px] font-semibold text-white">Use in composer</button></div></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#34443a]">{variant.caption}</p>{variant.hashtags.length>0&&<p className="mt-3 text-xs leading-6 text-[#176b4b]">{variant.hashtags.map(tag=>tag.startsWith("#")?tag:"#"+tag.replace(/^#+/,"")).join(" ")}</p>}{variant.callToAction&&<p className="mt-3 text-xs font-semibold text-[#53665a]">{variant.callToAction}</p>}</article>)}
      {result.strategyNote&&<p className="rounded-xl bg-[#f1f5f1] px-4 py-3 text-xs leading-5 text-[#617166]"><strong>Creative direction:</strong> {result.strategyNote}</p>}
    </section>}
  </div>;
}
