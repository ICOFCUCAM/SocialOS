import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const WORKSPACE_BRAND_ADMINS = ["owner", "administrator", "manager"];
const WORKSPACE_CONTRIBUTORS = ["editor", "publisher"];
const BRAND_CONTRIBUTORS = ["manager", "editor", "publisher"];
const BRAND_PUBLISHERS = ["manager", "publisher"];

/**
 * Mirrors the database rule in create_social_post_bundle: workspace owners,
 * administrators and managers act on every brand; editors and publishers also
 * need a contributing role on the specific brand. "publish" additionally needs
 * a publishing role in the workspace or on the brand.
 */
export async function hasBrandAccess(
  supabase: Supabase,
  userId: string,
  organizationId: string,
  brandId: string,
  mode: "edit" | "publish",
): Promise<boolean> {
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const orgRole = member?.role as string | undefined;
  if (!orgRole) return false;
  if (WORKSPACE_BRAND_ADMINS.includes(orgRole)) return true;
  if (!WORKSPACE_CONTRIBUTORS.includes(orgRole)) return false;
  const { data: brandMember } = await supabase
    .from("brand_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  const brandRole = brandMember?.role as string | undefined;
  if (!brandRole || !BRAND_CONTRIBUTORS.includes(brandRole)) return false;
  return mode === "edit" || orgRole === "publisher" || BRAND_PUBLISHERS.includes(brandRole);
}
