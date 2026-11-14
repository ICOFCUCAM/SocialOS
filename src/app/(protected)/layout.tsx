import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app/app-shell";
import { getActiveMembership, listActiveWorkspaces } from "@/lib/workspace";

export default async function ProtectedLayout({children}:{children:React.ReactNode}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await getActiveMembership(supabase,user.id,"organization_id,organizations(name)");
  const org=membership?.organizations as unknown as {name:string}|null;
  const workspaces=await listActiveWorkspaces(supabase,user.id);
  const {data:brand}=membership ? await supabase.from("brands").select("name")
    .eq("organization_id",membership.organization_id).order("created_at").limit(1).maybeSingle() : {data:null};
  return <AppShell email={user.email??"Account"} workspaceName={org?.name??"Your workspace"} brandName={brand?.name??"Main brand"} workspaceId={membership?.organization_id} workspaces={workspaces}>{children}</AppShell>;
}
