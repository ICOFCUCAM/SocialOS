import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AtSign, BriefcaseBusiness, CheckCircle2, CircleAlert, Facebook, Globe2, Instagram, Linkedin, Pin, Plus, Video, Youtube } from "lucide-react";

const providers = [
  {code:"instagram",name:"Instagram",group:"Meta",description:"Publish images, reels and supported media formats.",icon:Instagram,env:"META"},
  {code:"facebook",name:"Facebook Pages",group:"Meta",description:"Manage Page publishing and audience engagement.",icon:Facebook,env:"META"},
  {code:"tiktok",name:"TikTok",group:"TikTok",description:"Connect TikTok accounts for supported publishing workflows.",icon:Video,env:"TIKTOK"},
  {code:"youtube",name:"YouTube",group:"Google",description:"Connect channels for video publishing and channel insights.",icon:Youtube,env:"GOOGLE"},
  {code:"linkedin",name:"LinkedIn",group:"LinkedIn",description:"Publish to eligible member or organisation profiles.",icon:Linkedin,env:"LINKEDIN"},
  {code:"threads",name:"Threads",group:"Meta",description:"Connect Threads profiles for supported publishing.",icon:AtSign,env:"THREADS"},
  {code:"pinterest",name:"Pinterest",group:"Pinterest",description:"Manage Pins and supported board workflows.",icon:Pin,env:"PINTEREST"},
  {code:"x",name:"X",group:"X",description:"Connect accounts for supported posting and engagement.",icon:Globe2,env:"X"}
] as const;

function configured(provider:string) {
  const pairs:Record<string,[string,string]> = {
    META:["META_CLIENT_ID","META_CLIENT_SECRET"],
    TIKTOK:["TIKTOK_CLIENT_KEY","TIKTOK_CLIENT_SECRET"],
    GOOGLE:["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"],
    LINKEDIN:["LINKEDIN_CLIENT_ID","LINKEDIN_CLIENT_SECRET"],
    THREADS:["THREADS_CLIENT_ID","THREADS_CLIENT_SECRET"],
    PINTEREST:["PINTEREST_APP_ID","PINTEREST_APP_SECRET"],
    X:["X_CLIENT_ID","X_CLIENT_SECRET"]
  };
  const [id,secret]=pairs[provider];
  return Boolean(process.env[id]&&process.env[secret]);
}

export default async function ChannelsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:member}=await supabase.from("organization_members").select("organization_id")
    .eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
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
  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">SOCIAL CHANNELS</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Connected accounts</h1><p className="mt-2 text-sm text-[#77847b]">Bring your social profiles into one secure workspace.</p></div><span className="rounded-xl border border-[#e6ece6] bg-white px-4 py-3 text-xs text-[#77847b]">{active} active connections</span></section>
    <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Connected accounts</p><p className="mt-3 text-3xl font-semibold">{active}</p></article><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Needs attention</p><p className="mt-3 text-3xl font-semibold">{connected.filter(a=>["expired","reauthorization_required","error"].includes(a.connection_status)).length}</p></article><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Available platforms</p><p className="mt-3 text-3xl font-semibold">{providers.length}</p></article></section>
    <section className="space-y-4"><div><h2 className="text-sm font-semibold">Platform directory</h2><p className="mt-1 text-xs text-[#89958d]">Each provider requires its own approved developer application and OAuth permissions.</p></div><div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{providers.map(p=>{const Icon=p.icon;const count=connected.filter(a=>(a.platform as unknown as {code:string}|null)?.code===p.code).length;const ready=configured(p.env);return <article key={p.code} className="rounded-2xl border border-[#e6ece6] bg-white p-5"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f1f5f1] text-[#304b3b]"><Icon size={21}/></span><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${ready?"bg-[#edf5ef] text-[#176b4b]":"bg-[#f4f5f3] text-[#89958d]"}`}>{ready?<CheckCircle2 size={12}/>:<CircleAlert size={12}/>} {ready?"Credentials configured":"Setup required"}</span></div><h3 className="mt-4 text-sm font-semibold">{p.name}</h3><p className="mt-1 min-h-10 text-xs leading-5 text-[#89958d]">{p.description}</p><div className="mt-4 flex items-center justify-between border-t border-[#edf1ed] pt-4"><span className="text-xs text-[#89958d]">{count} linked {count===1?"account":"accounts"}</span><span className="text-[10px] font-medium text-[#89958d]">{p.group}</span></div></article>})}</div></section>
    <section className="rounded-2xl border border-[#e6ece6] bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Your connected accounts</h2><p className="mt-1 text-xs text-[#89958d]">Accounts linked to brands in this workspace.</p></div><span className="text-xs text-[#89958d]">{connected.length} total</span></div>{connected.length?<div className="mt-4 divide-y divide-[#edf1ed]">{connected.map(account=>{const platform=account.platform as unknown as {name:string;code:string}|null;return <div key={account.id} className="flex items-center gap-3 py-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#f1f5f1] text-[#53685a]"><Plus size={17}/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{account.account_name}</span><span className="mt-0.5 block text-xs text-[#89958d]">{platform?.name??"Social account"} · {brandNames.get(account.brand_id)??"Brand"}</span></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${account.connection_status==="connected"?"bg-[#edf5ef] text-[#176b4b]":"bg-[#f4f5f3] text-[#89958d]"}`}>{account.connection_status.replaceAll("_"," ")}</span></div>})}</div>:<div className="mt-5 rounded-xl border border-dashed border-[#d9e4da] px-5 py-10 text-center"><p className="text-sm font-semibold">No social accounts connected</p><p className="mt-1 text-xs text-[#89958d]">Configure a platform developer application to begin secure account linking.</p></div>}</section>
    <p className="text-xs leading-5 text-[#98a39b]">Platform APIs have different approval, publishing and account eligibility rules. SocialOS will expose only capabilities approved by each provider. Credentials are not yet enabled in this environment, so OAuth connection actions are intentionally not available.</p>
  </div>;
}
