import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowUpRight, Globe2, Layers3, Plus, Search } from "lucide-react";

export default async function BrandsPage() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:member}=await supabase.from("organization_members").select("organization_id,role")
    .eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(!member) redirect("/onboarding");
  const {data:brands,error}=await supabase.from("brands").select("id,name,slug,description,website_url,is_active,created_at")
    .eq("organization_id",member.organization_id).order("created_at",{ascending:false});
  if(error) throw new Error("Unable to load brands.");
  const canManage=["owner","administrator","manager"].includes(member.role);
  const active=(brands??[]).filter(b=>b.is_active).length;
  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">BRAND PORTFOLIO</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Brands</h1><p className="mt-2 text-sm text-[#77847b]">Manage the identities your team creates and publishes for.</p></div>{canManage&&<Link href="/app/brands/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-5 py-3 text-sm font-semibold text-white"><Plus size={16}/> Add brand</Link>}</section>
    <section className="grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Total brands</p><p className="mt-3 text-3xl font-semibold">{brands?.length??0}</p></article><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Active brands</p><p className="mt-3 text-3xl font-semibold">{active}</p></article><article className="rounded-2xl border border-[#e6ece6] bg-white p-5"><p className="text-xs text-[#7c8980]">Inactive brands</p><p className="mt-3 text-3xl font-semibold">{(brands?.length??0)-active}</p></article></section>
    {brands?.length?<section className="overflow-hidden rounded-2xl border border-[#e6ece6] bg-white"><div className="flex items-center justify-between border-b border-[#edf1ed] px-6 py-4"><div><h2 className="text-sm font-semibold">All brands</h2><p className="mt-1 text-xs text-[#89958d]">Your workspace brand directory</p></div><span className="text-xs text-[#89958d]">{brands.length} {brands.length===1?"brand":"brands"}</span></div><div className="divide-y divide-[#edf1ed]">{brands.map(brand=><Link key={brand.id} href={`/app/brands/${brand.id}`} className="flex items-center gap-4 px-5 py-5 transition hover:bg-[#fafcf9] sm:px-6"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf5ef] text-[#176b4b]"><Layers3 size={19}/></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{brand.name}</span><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${brand.is_active?"bg-[#edf5ef] text-[#176b4b]":"bg-[#f2f3f2] text-[#89958d]"}`}>{brand.is_active?"Active":"Inactive"}</span></span><span className="mt-1 block truncate text-xs text-[#89958d]">{brand.description||brand.slug}</span></span>{brand.website_url&&<span className="hidden items-center gap-1 text-xs text-[#89958d] md:flex"><Globe2 size={13}/> Website</span>}<ArrowUpRight size={16} className="text-[#9aa49d]"/></Link>)}</div></section>:<section className="rounded-2xl border border-dashed border-[#d9e4da] bg-white px-6 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf5ef] text-[#176b4b]"><Layers3 size={24}/></span><h2 className="mt-5 text-lg font-semibold">Your brand portfolio starts here</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#89958d]">Create a brand for each business, client or identity you manage. Keep its content, channels and voice organised in one place.</p>{canManage&&<Link href="/app/brands/new" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#176b4b] px-5 py-3 text-sm font-semibold text-white"><Plus size={16}/> Create your first brand</Link>}</section>}
  </div>;
}
