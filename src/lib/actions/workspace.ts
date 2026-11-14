"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, getMembershipForOrganization } from "@/lib/workspace";

export async function switchWorkspace(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await getMembershipForOrganization(
    supabase,
    user.id,
    organizationId,
  );
  if (!membership) throw new Error("You are not an active member of that workspace.");
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/app");
}
