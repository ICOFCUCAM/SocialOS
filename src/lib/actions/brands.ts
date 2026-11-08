"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}
function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63);
}
function safeWebsite(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch { return null; }
}
async function currentWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member, error } = await supabase.from("organization_members")
    .select("organization_id,role")
    .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (error || !member) redirect("/onboarding");
  if (!["owner", "administrator", "manager"].includes(member.role)) {
    throw new Error("You do not have permission to manage brands.");
  }
  return { supabase, user, organizationId: member.organization_id };
}

export async function createBrand(formData: FormData) {
  const name = clean(formData.get("name"));
  const description = clean(formData.get("description"));
  const websiteRaw = clean(formData.get("website"));
  const slugInput = clean(formData.get("slug"));
  const slug = slugify(slugInput || name);
  if (name.length < 2 || name.length > 120) throw new Error("Brand name must be between 2 and 120 characters.");
  if (slug.length < 2) throw new Error("Please provide a valid brand address.");
  if (websiteRaw && !safeWebsite(websiteRaw)) throw new Error("Website must be a valid http or https address.");

  const { supabase, user, organizationId } = await currentWorkspace();
  const { data, error } = await supabase.from("brands").insert({
    organization_id: organizationId,
    name,
    slug,
    description: description || null,
    website_url: safeWebsite(websiteRaw),
    created_by: user.id
  }).select("id").single();
  if (error) throw new Error(error.code === "23505" ? "That brand address is already in use." : error.message);
  revalidatePath("/app");
  revalidatePath("/app/brands");
  redirect(`/app/brands/${data.id}`);
}

export async function updateBrand(brandId: string, formData: FormData) {
  const name = clean(formData.get("name"));
  const description = clean(formData.get("description"));
  const websiteRaw = clean(formData.get("website"));
  const slug = slugify(clean(formData.get("slug")) || name);
  if (name.length < 2 || name.length > 120) throw new Error("Brand name must be between 2 and 120 characters.");
  if (slug.length < 2) throw new Error("Please provide a valid brand address.");
  if (websiteRaw && !safeWebsite(websiteRaw)) throw new Error("Website must be a valid http or https address.");

  const { supabase, organizationId } = await currentWorkspace();
  const { error } = await supabase.from("brands").update({
    name, slug, description: description || null, website_url: safeWebsite(websiteRaw)
  }).eq("id", brandId).eq("organization_id", organizationId);
  if (error) throw new Error(error.code === "23505" ? "That brand address is already in use." : error.message);
  revalidatePath("/app");
  revalidatePath("/app/brands");
  revalidatePath(`/app/brands/${brandId}`);
  redirect("/app/brands");
}

export async function setBrandActive(brandId: string, active: boolean) {
  const { supabase, organizationId } = await currentWorkspace();
  const { error } = await supabase.from("brands").update({ is_active: active })
    .eq("id", brandId).eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/brands");
  revalidatePath(`/app/brands/${brandId}`);
}
