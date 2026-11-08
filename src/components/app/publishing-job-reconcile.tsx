"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

export function PublishingJobReconcile({jobId}:{jobId:string}) {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [externalPostId,setExternalPostId]=useState("");
  const [permalink,setPermalink]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/social/publishing/operations",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"reconcile_published",jobId,externalPostId:externalPostId.trim(),permalink:permalink.trim()||null})
      });
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"Unable to reconcile this publication.");
      setOpen(false);setExternalPostId("");setPermalink("");router.refresh();
    } catch(reason) {
      setError(reason instanceof Error?reason.message:"Unable to reconcile this publication.");
    } finally {setBusy(false);}
  }

  return <div className="flex flex-col items-end gap-2">
    {!open?<button type="button" onClick={()=>setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#ead8cf] px-3 py-2 text-[11px] font-semibold text-[#9a4b3d] hover:bg-[#fbf3f0]"><ShieldAlert size={13}/> Reconcile result</button>:
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-xl border border-[#ead8cf] bg-[#fffaf8] p-4 text-left">
        <div><p className="text-xs font-semibold text-[#733f36]">Confirm publication on the platform</p><p className="mt-1 text-[11px] leading-4 text-[#8e6a63]">Only use this action after locating the published post on the destination platform. Enter its actual platform post ID.</p></div>
        <label className="block text-[11px] font-semibold text-[#53665a]">Verified external post ID<input required maxLength={500} value={externalPostId} onChange={event=>setExternalPostId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e7d8d3] bg-white px-3 py-2 text-xs font-normal outline-none focus:border-[#9a6258]" placeholder="Platform post ID"/></label>
        <label className="block text-[11px] font-semibold text-[#53665a]">Post permalink <span className="font-normal text-[#9aa49d]">· optional</span><input type="url" maxLength={2000} value={permalink} onChange={event=>setPermalink(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e7d8d3] bg-white px-3 py-2 text-xs font-normal outline-none focus:border-[#9a6258]" placeholder="https://..."/></label>
        {error&&<p role="alert" className="text-[11px] text-[#9a4b3d]">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={()=>{setOpen(false);setError("");}} disabled={busy} className="rounded-lg px-3 py-2 text-[11px] font-semibold text-[#78847c]">Cancel</button><button type="submit" disabled={busy||!externalPostId.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#176b4b] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50">{busy?<Loader2 size={12} className="animate-spin"/>:<CheckCircle2 size={12}/>} Confirm published</button></div>
      </form>}
  </div>;
}
