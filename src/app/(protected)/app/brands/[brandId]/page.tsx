import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setBrandActive } from "@/lib/actions/brands";
import { BrandForm } from "@/components/brands/brand-form";
import { ChevronLeft, Globe2 } from "lucide-react";

export default async function BrandDetailPage({params}:{params:Promise<{brandId:string}>}){
  const {brandId}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:member}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(!member) redirect("/onboarding");
  const {data:brand,error}=await supabase.from("brands").select("id,name,slug,description,website_url,is_active,created_at")
    .eq("id",brandId).eq("organization_id",member.organization_id).maybeSingle();
  if(error||!brand) notFound();
  const canManage=["owner","administrator","manager"].includes(member.role);
  const toggle=setBrandActive.bind(null,brand.id,!brand.is_active);
  return <div className="mx-auto max-w-3xl space-y-7"><Link href="/app/brands" className="inline-flex items-center gap-2 text-xs font-medium text-[#77847b] hover:text-[#176b4b]"><ChevronLeft size={15}/> Back to brands</Link><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">BRAND PROFILE</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{brand.name}</h1><p className="mt-2 text-sm text-[#77847b]">Manage this brand's core identity.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${brand.is_active?"bg-[#edf5ef] text-[#176b4b]":"bg-[#f2f3f2] text-[#89958d]"}`}>{brand.is_active?"Active":"Inactive"}</span></div><section className="rounded-2xl border border-[#e6ece6] bg-white p-6 sm:p-8"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Brand details</h2><p className="mt-1 text-xs text-[#89958d]">Name, address and public identity</p></div>{brand.website_url&&<a href={brand.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#176b4b]"><Globe2 size={13}/> Visit website</a>}</div>{canManage?<BrandForm brand={brand}/>:<div className="space-y-4 text-sm"><p><span className="text-[#89958d]">Address</span><br/>{brand.slug}</p><p><span className="text-[#89958d]">Description</span><br/>{brand.description||"No description added."}</p></div>}</section>{canManage&&<section className="flex items-center justify-between rounded-2xl border border-[#e6ece6] bg-white p-5"><div><h2 className="text-sm font-semibold">{brand.is_active?"Deactivate brand":"Activate brand"}</h2><p className="mt-1 text-xs text-[#89958d]">{brand.is_active?"An inactive brand is retained but removed from active workflows.":"Reactivate this brand for future workflows."}</p></div><form action={toggle}><button className={`rounded-xl px-4 py-2.5 text-xs font-semibold ${brand.is_active?"border border-[#e8dede] text-[#9b5555]":"bg-[#176b4b] text-white"}`}>{brand.is_active?"Deactivate":"Activate"}</button></form></section>}</div>;
}
