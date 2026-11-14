import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandForm } from "@/components/brands/brand-form";
import { ChevronLeft } from "lucide-react";
import { getActiveMembership } from "@/lib/workspace";

export default async function NewBrandPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:member}=await getActiveMembership(supabase,user.id,"role");
  if(!member) redirect("/onboarding");
  if(!["owner","administrator","manager"].includes(member.role)) redirect("/app/brands");
  return <div className="mx-auto max-w-3xl space-y-7"><Link href="/app/brands" className="inline-flex items-center gap-2 text-xs font-medium text-[#77847b] hover:text-[#176b4b]"><ChevronLeft size={15}/> Back to brands</Link><div><p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">BRAND PORTFOLIO / NEW</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Create a brand</h1><p className="mt-2 text-sm text-[#77847b]">Set up a distinct identity for a business, client or project.</p></div><section className="rounded-2xl border border-[#e6ece6] bg-white p-6 sm:p-8"><BrandForm/></section></div>;
}
