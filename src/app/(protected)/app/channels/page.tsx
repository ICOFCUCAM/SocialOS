import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AtSign, CheckCircle2, CircleAlert, Facebook, Globe2, Instagram, Linkedin, Pin, Plus, Video, Youtube } from "lucide-react";
import { SocialAccountControls } from "@/components/app/social-account-controls";
import { ProviderHealthPanel } from "@/components/app/provider-health-panel";
import { getActiveMembership } from "@/lib/workspace";

const providers = [
  {code:"instagram",name:"Instagram",group:"Meta",description:"Publish images, reels and supported media formats.",icon:Instagram,env:"META"},
  {code:"facebook",name:"Facebook Pages",group:"Meta",description:"Manage Page publishing and audience engagement.",icon:Facebook,env:"META"},
  {code:"tiktok",name:"TikTok",group:"TikTok",description:"Connect TikTok accounts for supported publishing workflows.",icon:Video,env:"TIKTOK"},
  {code:"youtube",name:"YouTube",group:"Google",description:"Connect channels for video publishing and channel insights.",icon:Youtube,env:"GOOGLE"},
  {code:"linkedin",name:"LinkedIn",group:"LinkedIn",description:"Connect a member profile. Organisation-page publishing requires separate approval.",icon:Linkedin,env:"LINKEDIN"},
  {code:"threads",name:"Threads",group:"Meta",description:"Connect Threads profiles for supported publishing.",icon:AtSign,env:"THREADS"},
  {code:"pinterest",name:"Pinterest",group:"Pinterest",description:"Manage Pins and supported board workflows.",icon:Pin,env:"PINTEREST"},
  {code:"x",name:"X",group:"X",description:"Connect accounts for supported posting and engagement.",icon:Globe2,env:"X"}
] as const;

function configured(provider:string) {
  const pairs:Record<string,[string,string]> = {
    META:["META_CLIENT_ID","META_CLIENT_SECRET"],TIKTOK:["TIKTOK_CLIENT_KEY","TIKTOK_CLIENT_SECRET"],
    GOOGLE:["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"],LINKEDIN:["LINKEDIN_CLIENT_ID","LINKEDIN_CLIENT_SECRET"],
    THREADS:["THREADS_CLIENT_ID","THREADS_CLIENT_SECRET"],PINTEREST:["PINTEREST_APP_ID","PINTEREST_APP_SECRET"],
    X:["X_CLIENT_ID","X_CLIENT_SECRET"]
  };
  const [id,secret]=pairs[provider];
  return Boolean(process.env[id]&&process.env[secret]);
}
function canStart(provider:string) {
  return ["GOOGLE","LINKEDIN","META"].includes(provider) && configured(provider) &&
    Boolean(process.env.SOCIAL_OAUTH_REDIRECT_BASE_URL && process.env.SOCIAL_OAUTH_STATE_SECRET &&
      (process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || process.env.SOCIAL_TOKEN_ENCRYPTION_KEYS) && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
const messages:Record<string,string> = {
  connected:"Social account connected and credentials encrypted successfully.",
  meta_pages_unavailable:"Meta did not return the Pages available to this account. Check the requested permissions and Page access.",
  meta_no_pages:"No Facebook Pages were available to this account. Connect a Facebook Page and try again.",
  meta_permissions_unavailable:"Meta did not confirm which permissions were granted. Please try connecting again.",
  meta_no_accounts:"Meta authorization succeeded, but no eligible social account was discovered.",
  denied:"The provider authorization was declined.",
  invalid_state:"The connection could not be verified. Please try again.",
  session_expired:"Your session expired during authorization. Sign in and try again.",
  membership_changed:"Your workspace permissions changed during authorization.",
  brand_unavailable:"The selected brand is no longer available.",
  token_exchange_failed:"The provider did not complete token exchange.",
  no_channel:"No eligible YouTube channel was found for this Google account.",
  profile_lookup_failed:"The provider profile could not be retrieved.",
  connection_failed:"The connection could not be completed. Check provider setup and server logs.",
  not_configured:"This provider's OAuth credentials are not configured.",
  unsupported:"This provider is not enabled yet."
};

export default async function ChannelsPage({searchParams}:{searchParams:Promise<{connection?:string}>}){
  const {connection}=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:member}=await getActiveMembership(supabase,user.id,"organization_id,role");
  if(!member) redirect("/onboarding");
  const [{data:accounts,error},{data:brands}] = await Promise.all([
    supabase.from("social_accounts").select("id,brand_id,account_name,account_username,connection_status,profile_image_url,platform:social_platforms(code,name)")
      .eq("organization_id",member.organization_id).order("created_at",{ascending:false}),
    supabase.from("brands").select("id,name").eq("organization_id",member.organization_id).eq("is_active",true)
  ]);
  if(error) throw new Error("Unable to load connected social channels.");
  const connected=accounts??[];
  const active=connected.filter(a=>a.connection_status==="connected").length;
  const brandNames=new Map((brands??[]).map(b=>[b.id,b.name]));
  const canManage=["owner","administrator","manager"].includes(member.role);
  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">SOCIAL CHANNELS</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Connected accounts</h1><p className="mt-2 text-sm text-[#77847b]">Bring your social profiles into one secure workspace.</p></div><span className="rounded-xl border border-[#e6ece6] bg-white px-4 py-3 text-xs text-[#77847b]">{active} active connections</span></section>
    {connection&&messages[connection]&&<p role="status" className={`rounded-xl border px-4 py-3 text-sm ${connection==="connected"?"border-[#d9e9dc] bg-[#f1f8f2] text-[#176b4b]":"border-[#e9e4d8] bg-[#faf8f1] text-[#75633c]"}`}>{messages[connection]}</p>}
    <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Connected accounts</p><p className="mt-3 text-3xl font-semibold">{active}</p></article><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Needs attention</p><p className="mt-3 text-3xl font-semibold">{connected.filter(a=>["expired","reauthorization_required","error"].includes(a.connection_status)).length}</p></article><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Planned platforms</p><p className="mt-3 text-3xl font-semibold">{providers.length}</p></article></section>
    <ProviderHealthPanel/>
    <section className="space-y-4"><div><h2 className="text-sm font-semibold">Platform directory</h2><p className="mt-1 text-xs text-[#89958d]">Connectors are enabled only when their OAuth adapter and credentials are configured.</p></div><div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{providers.map(p=>{const Icon=p.icon;const count=connected.filter(a=>(a.platform as unknown as {code:string}|null)?.code===p.code).length;const ready=canStart(p.env);const supported=["youtube","linkedin","facebook","instagram"].includes(p.code);const connectProvider=p.env==="META"?"meta":p.code;return <article key={p.code} className="rounded-2xl border border-[#e6ece6] bg-white p-5"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f1f5f1] text-[#304b3b]"><Icon size={21}/></span><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${ready?"bg-[#edf5ef] text-[#176b4b]":"bg-[#f4f5f3] text-[#89958d]"}`}>{ready?<CheckCircle2 size={12}/>:<CircleAlert size={12}/>} {ready?"Ready to connect":supported?"Setup required":"Integration planned"}</span></div><h3 className="mt-4 text-sm font-semibold">{p.name}</h3><p className="mt-1 min-h-10 text-xs leading-5 text-[#89958d]">{p.description}</p><div className="mt-4 flex items-center justify-between border-t border-[#edf1ed] pt-4"><span className="text-xs text-[#89958d]">{count} linked {count===1?"account":"accounts"}</span><span className="text-[10px] font-medium text-[#89958d]">{p.group}</span></div>{ready&&canManage&&brands?.length?<form method="get" action={`/api/social/connect/${connectProvider}`} className="mt-4 flex gap-2"><select name="brandId" required defaultValue="" className="min-w-0 flex-1 rounded-lg border border-[#e2e9e2] bg-white px-2 py-2 text-xs"><option value="" disabled>Select a brand</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><button className="inline-flex items-center gap-1 rounded-lg bg-[#176b4b] px-3 py-2 text-xs font-semibold text-white"><Plus size={13}/> Connect</button></form>:<p className="mt-4 text-[10px] text-[#a0aaa3]">{!canManage?"Workspace manager permission required":!brands?.length?"Create an active brand first":supported?"Configure provider credentials to connect":"Provider adapter not enabled yet"}</p>}</article>})}</div></section>
    <section className="rounded-2xl border border-[#e6ece6] bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Your connected accounts</h2><p className="mt-1 text-xs text-[#89958d]">Accounts linked to brands in this workspace.</p></div><span className="text-xs text-[#89958d]">{connected.length} total</span></div>{connected.length?<div className="mt-4 divide-y divide-[#edf1ed]">{connected.map(account=>{const platform=account.platform as unknown as {name:string;code:string}|null;return <article key={account.id} className="py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#f1f5f1] text-[#53685a]">{account.profile_image_url?<img src={account.profile_image_url} alt="" className="h-full w-full object-cover"/>:<Plus size={17}/>}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{account.account_name}</span><span className="mt-0.5 block text-xs text-[#89958d]">{platform?.name??"Social account"} · {brandNames.get(account.brand_id)??"Brand"}{account.account_username? ` · @${account.account_username}`:""}</span></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${account.connection_status==="connected"?"bg-[#edf5ef] text-[#176b4b]":account.connection_status==="reauthorization_required"||account.connection_status==="expired"?"bg-[#faf5e8] text-[#8a6a28]":"bg-[#f4f5f3] text-[#89958d]"}`}>{account.connection_status.replaceAll("_"," ")}</span></div><SocialAccountControls accountId={account.id} brandId={account.brand_id} platformCode={platform?.code??"unknown"} canManage={canManage}/></article>})}</div>:<div className="mt-5 rounded-xl border border-dashed border-[#d9e4da] px-5 py-10 text-center"><p className="text-sm font-semibold">No social accounts connected</p><p className="mt-1 text-xs text-[#89958d]">Configure a platform developer application to begin secure account linking.</p></div>}</section>
    <p className="text-xs leading-5 text-[#98a39b]">Basic account identification does not imply publishing access. Each platform requires separate review of permissions, account eligibility and approved API capabilities.</p>
  </div>;
}
