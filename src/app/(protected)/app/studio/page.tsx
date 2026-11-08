import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AIContentStudio } from "@/components/app/ai-content-studio";

export default async function ContentStudioPage({searchParams}:{searchParams:Promise<{brand?:string}>}) {
  const {brand:requestedBrand}=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:member}=await supabase.from("organization_members").select("organization_id,role")
    .eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(!member)redirect("/onboarding");
  if(!["owner","administrator","manager","editor","publisher"].includes(member.role)) {
    return <section className="rounded-2xl border border-[#e6ece6] bg-white p-8"><h1 className="text-xl font-semibold">AI Content Studio</h1><p className="mt-2 text-sm text-[#89958d]">Your workspace role does not include content creation permissions.</p></section>;
  }
  const {data:brands,error}=await supabase.from("brands").select("id,name,brand_settings")
    .eq("organization_id",member.organization_id).eq("is_active",true).order("name");
  if(error)throw new Error("Unable to load brand context for AI Studio.");
  const validBrand=(brands??[]).some(b=>b.id===requestedBrand)?requestedBrand:brands?.[0]?.id;
  return <div className="space-y-7">
    <section><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">SOCIALOS INTELLIGENCE</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">AI Content Studio</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#77847b]">Turn a campaign objective into platform-aware content, shaped by your saved brand voice and audience. Generate, review and refine before publishing.</p></section>
    {brands?.length?<AIContentStudio brands={brands as {id:string;name:string;brand_settings:unknown}[]} initialBrandId={validBrand}/>:<section className="rounded-2xl border border-dashed border-[#d9e4da] bg-white px-6 py-14 text-center"><h2 className="text-sm font-semibold">Create a brand to begin</h2><p className="mt-2 text-xs text-[#89958d]">AI content is grounded in a brand identity. Create an active brand and define its voice first.</p><a href="/app/brands/new" className="mt-5 inline-flex rounded-xl bg-[#176b4b] px-4 py-2.5 text-xs font-semibold text-white">Add a brand</a></section>}
  </div>;
}
