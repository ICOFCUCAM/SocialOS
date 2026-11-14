"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Plus } from "lucide-react";

type Post={id:string;title:string|null;body:string;status:string;scheduled_at:string|null;published_at:string|null;created_at:string};
export function CampaignPostManager({campaignId,attached,available}:{campaignId:string;attached:Post[];available:Post[]}){
 const router=useRouter();const [postId,setPostId]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function attach(){
  if(!postId)return setError("Select a post to add.");
  setBusy(true);setError("");
  try{const response=await fetch("/api/social/campaigns/"+campaignId+"/posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({postId})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not add post.");setPostId("");router.refresh();}
  catch(e){setError(e instanceof Error?e.message:"Could not add post.");}
  finally{setBusy(false);}
 }
 const linked=new Set(attached.map(p=>p.id));const candidates=available.filter(p=>!linked.has(p.id));
 return <section className="rounded-2xl border border-[#e6ece6] bg-white p-5 sm:p-6">
  <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Campaign content</h2><p className="mt-1 text-xs text-[#89958d]">Connect existing posts from this brand to the campaign.</p></div><span className="inline-flex items-center gap-1 text-xs text-[#718076]"><Link2 size={13}/>{attached.length} linked</span></div>
  {attached.length?<div className="mt-4 divide-y divide-[#edf1ed]">{attached.map(post=><div key={post.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{post.title||post.body.slice(0,100)||"Untitled post"}</p><p className="mt-1 text-[10px] capitalize text-[#89958d]">{post.status.replaceAll("_"," ")} · {new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(new Date(post.scheduled_at||post.published_at||post.created_at))}</p></div><span className="rounded-full bg-[#f1f5f1] px-2.5 py-1 text-[9px] text-[#617166]">{post.status}</span></div>)}</div>:<p className="mt-5 rounded-xl border border-dashed border-[#dfe7df] px-4 py-7 text-center text-xs text-[#89958d]">No posts linked yet. Create posts for this brand and add them here.</p>}
  <div className="mt-5 flex flex-col gap-2 sm:flex-row"><select value={postId} onChange={e=>setPostId(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#dfe7e0] bg-white px-3 py-3 text-xs"><option value="">Choose a post to link…</option>{candidates.map(post=><option key={post.id} value={post.id}>{(post.title||post.body.slice(0,70)||"Untitled post")+" · "+post.status}</option>)}</select><button type="button" disabled={busy||!postId} onClick={()=>void attach()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{busy?<Loader2 size={13} className="animate-spin"/>:<Plus size={13}/>} Add to campaign</button></div>
  {error&&<p role="alert" className="mt-3 text-xs text-[#9a4b3d]">{error}</p>}
 </section>;
}
