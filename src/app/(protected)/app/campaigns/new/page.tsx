import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CampaignForm } from "@/components/app/campaign-form";
import { getActiveMembership } from "@/lib/workspace";

export default async function NewCampaignPage({searchParams}:{searchParams:Promise<{brand?:string}>}){
 const {brand:requested}=await searchParams;
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:member}=await getActiveMembership(supabase,user.id,"organization_id,role");
 if(!member)redirect("/onboarding");
 if(!["owner","administrator","manager","editor","publisher"].includes(member.role))redirect("/app/campaigns");
 const {data:brands,error}=await supabase.from("brands").select("id,name").eq("organization_id",member.organization_id).eq("is_active",true).order("name");
 if(error)throw new Error("Unable to load brands.");
 const selected=(brands??[]).find(b=>b.id===requested)??brands?.[0];
 return <div className="mx-auto max-w-4xl space-y-6"><Link href="/app/campaigns" className="text-xs font-semibold text-[#176b4b]">← All campaigns</Link><section><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">CAMPAIGN PLANNER</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Create a campaign</h1><p className="mt-2 text-sm text-[#77847b]">Establish a clear objective and coordinated content strategy for one brand.</p></section>{selected?<><div className="rounded-xl border border-[#e6ece6] bg-white px-4 py-3 text-xs text-[#617166]">Brand: <strong>{selected.name}</strong></div><CampaignForm organizationId={member.organization_id} brandId={selected.id} brandOptions={brands??[]}/></>:<section className="rounded-2xl border border-dashed border-[#d9e4da] bg-white p-10 text-center"><h2 className="text-sm font-semibold">Create a brand first</h2><p className="mt-2 text-xs text-[#89958d]">Campaigns are always attached to one brand.</p><Link href="/app/brands/new" className="mt-4 inline-flex rounded-xl bg-[#176b4b] px-4 py-2.5 text-xs font-semibold text-white">Add a brand</Link></section>}</div>;
}
