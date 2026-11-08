import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SocialPostComposer } from "@/components/app/social-post-composer";

export default async function ComposePage({searchParams}:{searchParams:Promise<{brand?:string}>}) {
  const {brand:requestedBrand}=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:member}=await supabase.from("organization_members").select("organization_id,role")
    .eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(!member) redirect("/onboarding");
  const [{data:brands,error:brandError},{data:accounts,error:accountError},{data:assets,error:assetError}] = await Promise.all([
    supabase.from("brands").select("id,name").eq("organization_id",member.organization_id).eq("is_active",true).order("name"),
    supabase.from("social_accounts").select("id,brand_id,account_name,connection_status,platform:social_platforms(code,name)")
      .eq("organization_id",member.organization_id).eq("connection_status","connected").order("account_name"),
    supabase.from("social_media_assets").select("id,brand_id,original_filename,mime_type,file_size_bytes,processing_status")
      .eq("organization_id",member.organization_id).order("created_at",{ascending:false}).limit(100)
  ]);
  if(brandError||accountError||assetError) throw new Error("Unable to load the post composer.");
  const validBrand=(brands??[]).some(b=>b.id===requestedBrand)?requestedBrand:brands?.[0]?.id;
  return <div className="space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">CONTENT WORKFLOW</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Post composer</h1><p className="mt-2 text-sm text-[#77847b]">Create content, select destinations and save or schedule it.</p></div><Link href="/app/calendar" className="text-xs font-semibold text-[#176b4b]">View content calendar →</Link></div>
    {brands?.length?<SocialPostComposer organizationId={member.organization_id} brands={brands} accounts={(accounts??[]).map(a=>({...a,platform:a.platform as unknown as {code:string;name:string}|null}))} assets={assets??[]} initialBrandId={validBrand}/>:<section className="rounded-2xl border border-dashed border-[#d9e4da] bg-white px-6 py-14 text-center"><h2 className="text-sm font-semibold">Create a brand first</h2><p className="mt-2 text-xs text-[#89958d]">Every post belongs to a brand. Add an active brand before creating content.</p><Link href="/app/brands/new" className="mt-5 inline-flex rounded-xl bg-[#176b4b] px-4 py-2.5 text-xs font-semibold text-white">Add a brand</Link></section>}
  </div>;
}
