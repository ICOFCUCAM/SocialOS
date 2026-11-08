"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";

type Health={
  status:string;
  lastVerifiedAt:string|null;
  lastError:string|null;
  grantedScopes:string[];
  tokenHealth:"missing"|"unknown"|"expired"|"expiring_soon"|"healthy";
  accessTokenExpiresAt:string|null;
  refreshTokenExpiresAt:string|null;
  lastRefreshedAt:string|null;
  hasRefreshToken:boolean;
  encryptionKeyVersion:string|null;
};

function dateLabel(value:string|null) {
  if(!value) return "Not available";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Not available":new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(date);
}

const healthLabels:Record<Health["tokenHealth"],string>={
  healthy:"Credentials healthy",
  expiring_soon:"Access token expires soon",
  expired:"Access token expired",
  missing:"Credentials missing",
  unknown:"Expiry not supplied by provider"
};

export function SocialAccountControls({accountId,brandId,platformCode,canManage}:{
  accountId:string;brandId:string;platformCode:string;canManage:boolean;
}) {
  const router=useRouter();
  const [health,setHealth]=useState<Health|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function load() {
    setLoading(true);setError("");
    try {
      const response=await fetch(`/api/social/accounts/${accountId}`,{cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to load account health.");
      setHealth(data as Health);
    } catch(e) {setError(e instanceof Error?e.message:"Unable to load account health.");}
    finally {setLoading(false);}
  }
  useEffect(()=>{void load();},[accountId]);

  async function disconnect() {
    if(!window.confirm("Disconnect this account from SocialOS? Stored access and refresh credentials will be permanently deleted. You may also need to revoke access with the social platform.")) return;
    setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch(`/api/social/accounts/${accountId}`,{method:"DELETE"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to disconnect account.");
      setNotice(data.message||"Account disconnected.");
      router.refresh();
    } catch(e) {setError(e instanceof Error?e.message:"Unable to disconnect account.");}
    finally {setBusy(false);}
  }

  const statusTone=health?.tokenHealth==="healthy"?"text-[#176b4b] bg-[#edf5ef]":health?.tokenHealth==="expiring_soon"||health?.tokenHealth==="unknown"?"text-[#8a6a28] bg-[#faf5e8]":"text-[#9a4b3d] bg-[#fbefed]";
  return <div className="mt-3 rounded-xl border border-[#edf1ed] bg-[#fbfcfb] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone}`}>
        {health?.tokenHealth==="healthy"?<CheckCircle2 size={12}/>:<AlertTriangle size={12}/>}
        {loading?"Checking credentials…":health?healthLabels[health.tokenHealth]:"Health unavailable"}
      </span>
      <button type="button" onClick={()=>void load()} disabled={loading||busy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-[#647268] hover:bg-[#eef3ef] disabled:opacity-50">
        {loading?<Loader2 size={12} className="animate-spin"/>:<RefreshCw size={12}/>} Refresh
      </button>
    </div>
    {health&&<div className="mt-3 grid gap-2 text-[11px] text-[#758178] sm:grid-cols-2">
      <p className="flex items-center gap-2"><Clock3 size={12}/> Access expiry: {dateLabel(health.accessTokenExpiresAt)}</p>
      <p className="flex items-center gap-2"><ShieldCheck size={12}/> Last refreshed: {dateLabel(health.lastRefreshedAt)}</p>
      <p>Refresh token: {health.hasRefreshToken?"Available":"Not supplied"}</p>
      <p>Last verified: {dateLabel(health.lastVerifiedAt)}</p>
    </div>}
    {health?.lastError&&<p className="mt-2 text-[11px] text-[#9a4b3d]">{health.lastError}</p>}
    {health?.grantedScopes?.length? <details className="mt-3 text-[11px] text-[#758178]"><summary className="cursor-pointer font-medium">Granted permissions ({health.grantedScopes.length})</summary><ul className="mt-2 space-y-1 pl-4">{health.grantedScopes.map(scope=><li key={scope} className="list-disc break-all">{scope}</li>)}</ul></details>:null}
    {error&&<p role="alert" className="mt-2 text-xs text-[#9a4b3d]">{error}</p>}
    {notice&&<p role="status" className="mt-2 text-xs text-[#176b4b]">{notice}</p>}
    {canManage&&<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#edf1ed] pt-3">
      {health&&["reauthorization_required","expired","disconnected","error"].includes(health.status)&&<a href={`/api/social/connect/${["facebook","instagram"].includes(platformCode)?"meta":platformCode}?brandId=${encodeURIComponent(brandId)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#176b4b] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#12583d]"><RefreshCw size={12}/> Reconnect</a>}
      <button type="button" onClick={()=>void disconnect()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-[#eadbd8] px-3 py-2 text-[11px] font-semibold text-[#9a4b3d] hover:bg-[#fbefed] disabled:opacity-50">
        {busy?<Loader2 size={12} className="animate-spin"/>:<Unplug size={12}/>} Disconnect
      </button>
    </div>}
  </div>;
}
