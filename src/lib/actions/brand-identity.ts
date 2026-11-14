"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForBrand } from "@/lib/workspace";

const value = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const list = (v: string) =>
  [
    ...new Set(
      v
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);
const validColor = (v: string, fallback: string) =>
  /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback;
const validUrl = (v: string) => {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

export async function updateBrandIdentity(brandId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await getMembershipForBrand(
    supabase,
    user.id,
    brandId,
    "organization_id, role",
  );
  if (!member) redirect("/onboarding");
  if (!["owner", "administrator", "manager"].includes(member.role)) {
    throw new Error("You do not have permission to edit brand identity.");
  }

  const logoInput = value(formData.get("logo_url"));
  if (logoInput && !validUrl(logoInput))
    throw new Error("Logo URL must be a valid HTTP or HTTPS address.");

  const identity = {
    version: 1,
    logo_url: validUrl(logoInput),
    colors: {
      primary: validColor(value(formData.get("primary_color")), "#176B4B"),
      secondary: validColor(value(formData.get("secondary_color")), "#EAF2EC"),
      accent: validColor(value(formData.get("accent_color")), "#D6A84B"),
    },
    typography: {
      heading: value(formData.get("heading_font")).slice(0, 80),
      body: value(formData.get("body_font")).slice(0, 80),
    },
    voice: {
      tone: value(formData.get("voice_tone")).slice(0, 80),
      description: value(formData.get("voice_description")).slice(0, 1000),
    },
    audience: value(formData.get("target_audience")).slice(0, 1000),
    positioning: value(formData.get("positioning")).slice(0, 1000),
    content_pillars: list(value(formData.get("content_pillars"))),
    key_messages: list(value(formData.get("key_messages"))),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("brands")
    .update({ brand_settings: identity })
    .eq("id", brandId)
    .eq("organization_id", member.organization_id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/brands");
  revalidatePath(`/app/brands/${brandId}`);
  redirect(`/app/brands/${brandId}/identity?saved=1`);
}
