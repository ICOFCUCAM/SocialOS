"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CalendarClock, CheckCircle2, FileImage, Loader2, Send, UploadCloud } from "lucide-react";

type Brand={id:string;name:string};
type Capability={publishingEnabled:boolean;supportedMedia:("image"|"video")[];maxMediaItems:number;textOnly:boolean;limitation:string|null};
type Account={id:string;brand_id:string;account_name:string;connection_status:string;platform:{code:string;name:string}|null;capability:Capability};
type Asset={id:string;brand_id:string;original_filename:string|null;mime_type:string;file_size_bytes:number;processing_status:string};
type Props={organizationId:string;brands:Brand[];accounts:Account[];assets:Asset[];initialBrandId?:string};

const MAX_BYTES=250*1024*1024;
function formatBytes(size:number){return size>=1024*1024?(size/1024/1024).toFixed(1)+" MB":Math.max(1,Math.round(size/1024))+" KB";}
function localDateTime(){const date=new Date(Date.now()+60*60*1000);date.setMinutes(Math.ceil(date.getMinutes()/5)*5,0,0);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}

export function SocialPostComposer({organizationId,brands,accounts,assets:initialAssets,initialBrandId}:Props){
  const router=useRouter();
  const [brandId,setBrandId]=useState(initialBrandId||brands[0]?.id||"");
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [selectedAccounts,setSelectedAccounts]=useState<string[]>([]);
  const [selectedAssets,setSelectedAssets]=useState<string[]>([]);
  const [accountVersions,setAccountVersions]=useState<Record<string,{body:string;assetIds:string[]}>>({});
  const [assets,setAssets]=useState(initialAssets);
  const [scheduleMode,setScheduleMode]=useState<"draft"|"schedule">("draft");
  const [scheduledAt,setScheduledAt]=useState(localDateTime);
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("socialos:composer-draft");
      if (!raw) return;
      const draft = JSON.parse(raw) as { brandId?: string; body?: string };
      if (draft.brandId && brands.some(brand => brand.id === draft.brandId)) {
        setBrandId(draft.brandId);
        setSelectedAccounts([]);
        setSelectedAssets([]);
      }
      if (typeof draft.body === "string") setBody(draft.body);
      sessionStorage.removeItem("socialos:composer-draft");
      setMessage("AI draft loaded. Review and select your publishing destinations.");
    } catch {
      sessionStorage.removeItem("socialos:composer-draft");
    }
  }, [brands]);
  const availableAccounts=useMemo(()=>accounts.filter(a=>a.brand_id===brandId&&a.connection_status==="connected"),[accounts,brandId]);
  const availableAssets=useMemo(()=>assets.filter(a=>a.brand_id===brandId),[assets,brandId]);
  const readyAssets=availableAssets.filter(a=>a.processing_status==="ready");
  const pendingAssets=availableAssets.filter(a=>a.processing_status!=="ready");
  const selectedMedia=readyAssets.filter(asset=>selectedAssets.includes(asset.id));
  function mediaIssue(account:Account){
    const capability=account.capability;
    if(!capability.publishingEnabled)return capability.limitation||"Publishing is not enabled.";
    if(selectedMedia.length>capability.maxMediaItems)return "This destination supports at most "+capability.maxMediaItems+" media item(s).";
    if(selectedMedia.some(asset=>!capability.supportedMedia.includes(asset.mime_type.startsWith("video/")?"video":"image")))
      return "One or more selected media formats are not supported by this destination.";
    if(capability.textOnly&&selectedMedia.length)return "Remove media to publish a text-only LinkedIn post.";
    return null;
  }
  const unsupportedSelected=availableAccounts.filter(account=>selectedAccounts.includes(account.id)&&mediaIssue(account));
  function changeBrand(id:string){setBrandId(id);setSelectedAccounts([]);setSelectedAssets([]);}

  async function uploadFiles(files:FileList|null){
    if(!files?.length)return;
    setUploading(true);setError("");setMessage("");
    const supabase=createClient();
    try{
      for(const file of Array.from(files)){
        if(file.size<1||file.size>MAX_BYTES)throw new Error(file.name+" exceeds the 250 MB upload limit.");
        const init=await fetch("/api/social/media/upload-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId,brandId,filename:file.name,mimeType:file.type,size:file.size})});
        const initData=await init.json();
        if(!init.ok)throw new Error(initData.error||"Unable to prepare upload.");
        const {error:uploadError}=await supabase.storage.from(initData.bucket).uploadToSignedUrl(initData.path,initData.token,file,{contentType:file.type,upsert:false});
        if(uploadError)throw new Error("Upload failed for "+file.name+": "+uploadError.message);
        const finalized=await fetch("/api/social/media/finalize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({assetId:initData.assetId})});
        const finalData=await finalized.json();
        if(!finalized.ok)throw new Error(finalData.error||"Unable to finalize media upload.");
        const asset:Asset={id:initData.assetId,brand_id:brandId,original_filename:file.name,mime_type:file.type,file_size_bytes:file.size,processing_status:"pending"};
        setAssets(current=>[asset,...current]);
        setMessage(file.name+" uploaded. It must pass malware scanning and media processing before it can be attached.");
      }
    }catch(e){setError(e instanceof Error?e.message:"Media upload failed.");}
    finally{setUploading(false);}
  }

  async function refreshAssets(){
    setError("");setMessage("");
    const updated=await Promise.all(availableAssets.map(async asset=>{
      try{const response=await fetch("/api/social/media/"+asset.id,{cache:"no-store"});if(!response.ok)return asset;const data=await response.json();return {...asset,processing_status:data.processingStatus};}
      catch{return asset;}
    }));
    setAssets(current=>current.map(asset=>updated.find(next=>next.id===asset.id)||asset));
    setMessage("Media status refreshed.");
  }

  async function submit(){
    setError("");setMessage("");
    if(!brandId) return setError("Select a brand.");
    if(!selectedAccounts.length)return setError("Select at least one connected destination account.");
    if(unsupportedSelected.length)return setError("Resolve unsupported destinations: "+unsupportedSelected.map(account=>account.platform?.name||account.account_name).join(", ")+".");
    if(scheduleMode==="schedule"&&(!scheduledAt||new Date(scheduledAt).getTime()<=Date.now()))return setError("Choose a future publishing date and time.");
    const unavailable=selectedAssets.filter(id=>!readyAssets.some(asset=>asset.id===id));
    const versionUnavailable=Object.values(accountVersions).flatMap(version=>version.assetIds).filter(id=>!readyAssets.some(asset=>asset.id===id));
    if(unavailable.length||versionUnavailable.length)return setError("One or more selected assets are not ready. Refresh media status or remove them.");
    setBusy(true);
    try{
      const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
      const response=await fetch("/api/social/posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        organizationId,brandId,title,body,timezone,
        scheduledAt:scheduleMode==="schedule"?new Date(scheduledAt).toISOString():null,
        targetAccountIds:selectedAccounts,assetIds:selectedAssets,
        accountVersions:selectedAccounts.filter(id=>accountVersions[id]).map(accountId=>({accountId,...accountVersions[accountId]}))
      })});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"The post could not be created.");
      setMessage(scheduleMode==="schedule"?"Post scheduled successfully.":"Draft saved successfully.");
      router.push("/app/calendar?created="+encodeURIComponent(data.id));
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"The post could not be created.");}
    finally{setBusy(false);}
  }

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#e6ece6] bg-white p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[.16em] text-[#176b4b]">CONTENT EDITOR</p><h2 className="mt-2 text-lg font-semibold">Create a social post</h2><p className="mt-1 text-xs text-[#89958d]">Write once, then choose the brand and connected destinations.</p></div><span className="rounded-xl bg-[#eff5f0] p-3 text-[#176b4b]"><Send size={18}/></span></div>
        <label className="mt-6 block text-xs font-semibold text-[#53665a]">Brand</label>
        <select value={brandId} onChange={e=>changeBrand(e.target.value)} className="mt-2 w-full rounded-xl border border-[#dfe7e0] bg-white px-4 py-3 text-sm outline-none focus:border-[#176b4b]">
          {brands.map(brand=><option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
        <label className="mt-5 block text-xs font-semibold text-[#53665a]">Post title <span className="font-normal text-[#9aa49d]">· Optional</span></label>
        <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} placeholder="Give this post an internal title" className="mt-2 w-full rounded-xl border border-[#dfe7e0] px-4 py-3 text-sm outline-none focus:border-[#176b4b]"/>
        <div className="mt-5 flex items-center justify-between"><label className="text-xs font-semibold text-[#53665a]">Caption / post text</label><span className="text-[10px] tabular-nums text-[#9aa49d]">{body.length.toLocaleString()} / 20,000</span></div>
        <textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={20000} rows={10} placeholder="What would you like to share with your audience?" className="mt-2 w-full resize-y rounded-xl border border-[#dfe7e0] px-4 py-3 text-sm leading-6 outline-none focus:border-[#176b4b]"/>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[#53665a]">Media library</p><p className="mt-1 text-[10px] text-[#9aa49d]">Only scanned and processed media can be attached.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#dfe7e0] px-3 py-2.5 text-xs font-semibold text-[#53665a] hover:bg-[#f7f9f6]"><UploadCloud size={14}/>{uploading?"Uploading…":"Upload media"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" multiple disabled={uploading||!brandId} onChange={e=>{void uploadFiles(e.target.files);e.currentTarget.value="";}} className="sr-only"/></label></div>
        {availableAssets.length?<div className="mt-4 space-y-2">{availableAssets.map(asset=><label key={asset.id} className="flex items-center gap-3 rounded-xl border border-[#edf1ed] px-3 py-3"><input type="checkbox" checked={selectedAssets.includes(asset.id)} disabled={asset.processing_status!=="ready"} onChange={e=>setSelectedAssets(current=>e.target.checked?[...current,asset.id]:current.filter(id=>id!==asset.id))} className="h-4 w-4 accent-[#176b4b]"/><FileImage size={16} className="text-[#718276]"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{asset.original_filename||"Media asset"}</span><span className="mt-0.5 block text-[10px] text-[#9aa49d]">{formatBytes(asset.file_size_bytes)} · {asset.mime_type}</span></span><span className={`rounded-full px-2 py-1 text-[9px] font-semibold capitalize ${asset.processing_status==="ready"?"bg-[#edf5ef] text-[#176b4b]":asset.processing_status==="failed"||asset.processing_status==="quarantined"?"bg-[#fbefed] text-[#9a4b3d]":"bg-[#faf5e8] text-[#8a6a28]"}`}>{asset.processing_status}</span></label>)}</div>:<div className="mt-4 rounded-xl border border-dashed border-[#dfe7df] px-5 py-7 text-center text-xs text-[#9aa49d]">No media assets for this brand yet.</div>}
        {pendingAssets.length>0&&<button type="button" onClick={()=>void refreshAssets()} className="mt-3 text-xs font-semibold text-[#176b4b]">Refresh processing status ({pendingAssets.length} waiting)</button>}
      </section>
    </div>
    <aside className="space-y-5">
      <section className="rounded-2xl border border-[#e6ece6] bg-white p-5">
        <h3 className="text-sm font-semibold">Publishing destinations</h3><p className="mt-1 text-xs leading-5 text-[#89958d]">Select connected accounts for this brand.</p>
        <div className="mt-4 space-y-2">{availableAccounts.length?availableAccounts.map(account=>{const issue=mediaIssue(account);return <label key={account.id} className={`flex items-start gap-3 rounded-xl border p-3 ${issue?"border-[#eee5d6] bg-[#fcfaf5]":"border-[#edf1ed]"}`}><input type="checkbox" checked={selectedAccounts.includes(account.id)} disabled={!account.capability.publishingEnabled} onChange={e=>setSelectedAccounts(current=>e.target.checked?[...current,account.id]:current.filter(id=>id!==account.id))} className="mt-0.5 h-4 w-4 accent-[#176b4b]"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{account.account_name}</span><span className="mt-0.5 block text-[10px] text-[#89958d]">{account.platform?.name||"Social channel"} · {account.capability.publishingEnabled?"Publishing supported":"Publishing unavailable"}</span>{issue&&<span className="mt-1 block text-[10px] leading-4 text-[#8a6a28]">{issue}</span>}</span>{account.capability.publishingEnabled?<CheckCircle2 size={14} className="text-[#176b4b]"/>:<span className="text-[10px] text-[#8a6a28]">Unavailable</span>}</label> }):<div className="rounded-xl border border-dashed border-[#dfe7df] p-4 text-xs leading-5 text-[#89958d]">No connected accounts for this brand. Connect a supported account before creating a post.</div>}</div>
      </section>
      {selectedAccounts.length>0&&<section className="rounded-2xl border border-[#e6ece6] bg-white p-5">
        <h3 className="text-sm font-semibold">Account-specific content</h3>
        <p className="mt-1 text-xs leading-5 text-[#89958d]">Give each destination its own caption and media. Leave an account unchanged to use the shared post content.</p>
        <div className="mt-4 space-y-4">{selectedAccounts.map(accountId=>{
          const account=availableAccounts.find(item=>item.id===accountId);
          const version=accountVersions[accountId];
          return <div key={accountId} className="rounded-xl border border-[#edf1ed] p-3">
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{account?.account_name||"Selected account"}</p><button type="button" onClick={()=>setAccountVersions(current=>{const next={...current};if(next[accountId])delete next[accountId];else next[accountId]={body,assetIds:[...selectedAssets]};return next;})} className="text-[10px] font-semibold text-[#176b4b]">{version?"Use shared content":"Edit version"}</button></div>
            {version&&<>
              <label className="mt-3 block text-[10px] font-semibold text-[#53665a]">Caption for this account</label>
              <textarea value={version.body} maxLength={20000} rows={4} onChange={e=>setAccountVersions(current=>({...current,[accountId]:{...version,body:e.target.value}}))} className="mt-2 w-full rounded-lg border border-[#dfe7e0] px-3 py-2 text-xs leading-5 outline-none focus:border-[#176b4b]"/>
              <p className="mt-3 text-[10px] font-semibold text-[#53665a]">Media for this account</p>
              <div className="mt-2 space-y-2">{readyAssets.length?readyAssets.map(asset=><label key={asset.id} className="flex items-center gap-2 text-[10px] text-[#66756a]">
                <input type="checkbox" checked={version.assetIds.includes(asset.id)} onChange={e=>setAccountVersions(current=>({...current,[accountId]:{...version,assetIds:e.target.checked?[...version.assetIds,asset.id]:version.assetIds.filter(id=>id!==asset.id)}}))} className="h-3.5 w-3.5 accent-[#176b4b]"/>
                <span className="truncate">{asset.original_filename||"Media asset"}</span>
              </label>):<p className="text-[10px] text-[#89958d]">No ready media assets. This version will publish without media.</p>}</div>
            </>}
          </div>;
        })}</div>
      </section>}
      <section className="rounded-2xl border border-[#e6ece6] bg-white p-5">
        <h3 className="text-sm font-semibold">When should it publish?</h3>
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setScheduleMode("draft")} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${scheduleMode==="draft"?"border-[#176b4b] bg-[#edf5ef] text-[#176b4b]":"border-[#e6ece6] text-[#7d8a80]"}`}>Save draft</button><button type="button" onClick={()=>setScheduleMode("schedule")} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${scheduleMode==="schedule"?"border-[#176b4b] bg-[#edf5ef] text-[#176b4b]":"border-[#e6ece6] text-[#7d8a80]"}`}>Schedule</button></div>
        {scheduleMode==="schedule"&&<div className="mt-4"><label className="text-xs font-semibold text-[#53665a]">Date and time</label><input type="datetime-local" value={scheduledAt} min={localDateTime()} onChange={e=>setScheduledAt(e.target.value)} className="mt-2 w-full rounded-xl border border-[#dfe7e0] px-3 py-3 text-sm"/><p className="mt-2 text-[10px] text-[#9aa49d]">Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}</p></div>}
        <button type="button" disabled={busy||uploading||!brands.length} onClick={()=>void submit()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-4 py-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy?<Loader2 size={14} className="animate-spin"/>:scheduleMode==="schedule"?<CalendarClock size={14}/>:<Send size={14}/>} {busy?"Saving…":scheduleMode==="schedule"?"Schedule post":"Save draft"}</button>
        {error&&<p role="alert" className="mt-3 rounded-lg bg-[#fbefed] px-3 py-2 text-xs leading-5 text-[#9a4b3d]">{error}</p>}
        {message&&<p role="status" className="mt-3 rounded-lg bg-[#edf5ef] px-3 py-2 text-xs leading-5 text-[#176b4b]">{message}</p>}
      </section>
      <p className="px-1 text-[10px] leading-5 text-[#9aa49d]">Publishing availability and media formats depend on each platform&apos;s approved API capabilities. Saving or scheduling a post does not guarantee provider acceptance.</p>
    </aside>
  </div>;
}
