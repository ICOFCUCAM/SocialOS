import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSocialAdminClient } from "@/lib/social/admin";
import { hasBrandAccess } from "@/lib/brand-permissions";

type Context={params:Promise<{jobId:string}>};
const allowedRoles=["owner","administrator","manager","publisher"];

export async function POST(_request:NextRequest,{params}:Context) {
  const {jobId}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Authentication required."},{status:401});

  // Find the job through tenant RLS before checking the user's role. A user may
  // belong to several organizations; never select an arbitrary membership.
  const {data:job}=await supabase.from("publish_jobs")
    .select("id,organization_id,post_id").eq("id",jobId).maybeSingle();
  if(!job) return NextResponse.json({error:"Publishing job not found."},{status:404});

  const {data:membership}=await supabase.from("organization_members")
    .select("organization_id,role")
    .eq("organization_id",job.organization_id).eq("user_id",user.id).eq("status","active").maybeSingle();
  if(!membership || !allowedRoles.includes(membership.role)) {
    return NextResponse.json({error:"Publishing manager permission required."},{status:403});
  }
  const {data:post}=await supabase.from("social_posts").select("brand_id")
    .eq("id",job.post_id).eq("organization_id",job.organization_id).maybeSingle();
  if(!post || !(await hasBrandAccess(supabase,user.id,job.organization_id,post.brand_id,"publish"))) {
    return NextResponse.json({error:"Publishing permission for this brand is required."},{status:403});
  }

  const admin=createSocialAdminClient();
  const {error}=await admin.rpc("retry_publish_job",{
    p_job_id:jobId,
    p_organization_id:job.organization_id,
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
