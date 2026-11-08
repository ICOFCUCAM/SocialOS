import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app/app-shell";

export default async function ProtectedLayout({children}:{children:React.ReactNode}) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members")
    .select("organization_id,organizations(name)")
    .eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(!membership && !("/onboarding")) redirect("/onboarding");
  const org=membership?.organizations as unknown as {name:string}|null;
  const {data:brand}=membership ? await supabase.from("brands").select("name")
    .eq("organization_id",membership.organization_id).order("created_at").limit(1).maybeSingle() : {data:null};
  return <AppShell email={user.email??"Account"} workspaceName={org?.name??"Your workspace"} brandName={brand?.name??"Main brand"}>{children}</AppShell>;
}
