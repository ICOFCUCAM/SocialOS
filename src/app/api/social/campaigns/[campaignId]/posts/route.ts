import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:NextRequest,{params}:{params:Promise<{campaignId:string}>}){
  const {campaignId}=await params;
  if(!uuid.test(campaignId))return NextResponse.json({error:"Invalid campaign."},{status:400});
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
  let input:unknown;try{input=await request.json();}catch{return NextResponse.json({error:"A valid JSON body is required."},{status:400});}
  const postId=input&&typeof input==="object"&&!Array.isArray(input)?(input as Record<string,unknown>).postId:null;
  if(typeof postId!=="string"||!uuid.test(postId))return NextResponse.json({error:"Select a valid post."},{status:400});
  const {data,error}=await supabase.rpc("attach_post_to_campaign",{p_campaign_id:campaignId,p_post_id:postId});
  if(error){const forbidden=error.code==="42501";return NextResponse.json({error:forbidden?"Post and campaign must belong to the same brand and workspace.":"Post could not be added to this campaign."},{status:forbidden?403:400});}
  return NextResponse.json({attached:Boolean(data)});
}
