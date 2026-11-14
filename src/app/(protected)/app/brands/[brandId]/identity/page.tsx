import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandIdentityForm } from "@/components/brands/brand-identity-form";
import { ChevronLeft, Sparkles } from "lucide-react";
import { getMembershipForBrand } from "@/lib/workspace";

export default async function BrandIdentityPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { brandId } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await getMembershipForBrand(
    supabase,
    user.id,
    brandId,
    "organization_id,role",
  );
  if (!member) notFound();
  const { data: brand, error } = await supabase
    .from("brands")
    .select("id,name,brand_settings")
    .eq("id", brandId)
    .eq("organization_id", member.organization_id)
    .maybeSingle();
  if (error || !brand) notFound();
  if (!["owner", "administrator", "manager"].includes(member.role))
    redirect(`/app/brands/${brandId}`);

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <Link
        href={`/app/brands/${brandId}`}
        className="inline-flex items-center gap-2 text-xs font-medium text-[#77847b] hover:text-[#176b4b]"
      >
        <ChevronLeft size={15} /> Back to {brand.name}
      </Link>
      <div>
        <p className="text-xs font-semibold tracking-[.16em] text-[#176b4b]">
          BRAND STUDIO / IDENTITY
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Brand identity</h1>
        <p className="mt-2 text-sm text-[#77847b]">
          Build the visual and strategic foundation for {brand.name}.
        </p>
      </div>
      {saved === "1" && (
        <p
          role="status"
          className="rounded-xl border border-[#d9e9dc] bg-[#f1f8f2] px-4 py-3 text-sm text-[#176b4b]"
        >
          Brand identity saved successfully.
        </p>
      )}
      <div className="flex items-start gap-3 rounded-xl border border-[#e6ece6] bg-white p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#edf5ef] text-[#176b4b]">
          <Sparkles size={17} />
        </span>
        <div>
          <p className="text-sm font-semibold">AI-ready brand context</p>
          <p className="mt-1 text-xs leading-5 text-[#89958d]">
            These guidelines now inform AI-generated captions, campaign content and creative briefs
            in the AI Content Studio.
          </p>
        </div>
      </div>
      <section className="rounded-2xl border border-[#e6ece6] bg-white p-6 sm:p-8">
        <BrandIdentityForm brandId={brandId} identity={(brand.brand_settings ?? {}) as never} />
      </section>
    </div>
  );
}
