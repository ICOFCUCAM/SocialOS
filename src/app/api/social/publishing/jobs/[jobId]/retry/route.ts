import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSocialAdminClient } from "@/lib/social/admin";

type Context={params:Promise<{jobId:string}>};
const allowedRoles=["owner","administrator","manager","publisher"];

export async function POST(_request:NextRequest,{params}:Context) {
  const {jobId}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Authentication required."},{status:401});

  const {data:membership}=await supabase.from("organization_members")
    .select("organization_id,role")
    .eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if(!membership || !allowedRoles.includes(membership.role)) {
    return NextResponse.json({error:"Publishing manager permission required."},{status:403});
  }

  const admin=createSocialAdminClient();
  const {error}=await admin.rpc("retry_publish_job",{
    p_job_id:jobId,
    p_organization_id:membership.organization_id,
    p_actor_user_id:user.id
  });
  if(error) {
    const denied=error.code==="42501";
    const missing=error.code==="P0002";
    return NextResponse.json(
      {error:denied?"This job cannot be retried safely. Reconcile uncertain provider outcomes or reconnect the account first.":missing?"Publishing job not found.":"Unable to retry this publishing job."},
      {status:denied?409:missing?404:400}
    );
  }
  return NextResponse.json({ok:true,message:"The job has been returned to the publishing queue."},{headers:{"Cache-Control":"no-store"}});
}
