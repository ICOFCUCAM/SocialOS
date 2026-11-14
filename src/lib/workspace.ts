import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

/**
 * Workspace selection for users who belong to more than one organisation.
 *
 * Routes must never pick "any" active membership: the order is undefined, so a
 * user in two workspaces could act on the wrong one. Instead:
 * - general pages use the workspace the user selected (cookie), verified against
 *   their active memberships, falling back to the earliest-joined workspace;
 * - routes that act on a specific brand or organisation resolve the membership
 *   for that resource's own organisation.
 * The cookie is only a preference; membership and RLS remain the access boundary.
 */

export const ACTIVE_WORKSPACE_COOKIE = "socialos_workspace";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Result<T> = { data: T | null; error: { message: string } | null };
export type MembershipRow = { organization_id: string; role: string; [column: string]: unknown };

function memberships(supabase: Supabase, userId: string, columns: string) {
  return supabase
    .from("organization_members")
    .select(columns)
    .eq("user_id", userId)
    .eq("status", "active");
}

export async function getMembershipForOrganization<T = MembershipRow>(
  supabase: Supabase,
  userId: string,
  organizationId: string,
  columns = "organization_id,role",
): Promise<Result<T>> {
  if (!UUID.test(organizationId)) return { data: null, error: null };
  const result = await memberships(supabase, userId, columns)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return result as unknown as Result<T>;
}

export async function getActiveMembership<T = MembershipRow>(
  supabase: Supabase,
  userId: string,
  columns = "organization_id,role",
): Promise<Result<T>> {
  const preferred = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (preferred && UUID.test(preferred)) {
    const selected = await getMembershipForOrganization<T>(supabase, userId, preferred, columns);
    if (selected.error || selected.data) return selected;
  }
  const fallback = await memberships(supabase, userId, columns)
    .order("created_at", { ascending: true })
    .order("organization_id", { ascending: true })
    .limit(1)
    .maybeSingle();
  return fallback as unknown as Result<T>;
}

/** Membership in the organisation that owns this brand (RLS hides other brands). */
export async function getMembershipForBrand<T = MembershipRow>(
  supabase: Supabase,
  userId: string,
  brandId: string,
  columns = "organization_id,role",
): Promise<Result<T>> {
  if (!UUID.test(brandId)) return { data: null, error: null };
  const { data: brand, error } = await supabase
    .from("brands")
    .select("organization_id")
    .eq("id", brandId)
    .maybeSingle();
  if (error || !brand) return { data: null, error: error ? { message: error.message } : null };
  return getMembershipForOrganization<T>(
    supabase,
    userId,
    brand.organization_id as string,
    columns,
  );
}

export async function listActiveWorkspaces(supabase: Supabase, userId: string) {
  const { data } = await memberships(supabase, userId, "organization_id,organizations(name)").order(
    "created_at",
    { ascending: true },
  );
  return (
    (data ?? []) as unknown as { organization_id: string; organizations: { name: string } | null }[]
  ).map((row) => ({ id: row.organization_id, name: row.organizations?.name ?? "Workspace" }));
}
