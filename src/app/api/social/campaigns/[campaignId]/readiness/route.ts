import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSocialAdminClient } from "@/lib/social/admin";

type Finding={code:string;severity:"blocker"|"warning"|"info";title:string;detail:string;postId?:string;accountId?:string};
const supported=new Set(["facebook","instagram","youtube","linkedin"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(_request:NextRequest,{params}:{params:Promise<{campaignId:string}>}){
 const {campaignId}=await params;
 if(!uuid.test(campaignId))return NextResponse.json({error:"A valid campaign ID is required."},{status:400});
 const supabase=await createClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)return NextResponse.json({error:"Authentication required."},{status:401});
 const {data:campaign,error:campaignError}=await supabase.from("social_campaigns")
  .select("id,organization_id,brand_id,name,status,channels,start_date,end_date")
  .eq("id",campaignId).maybeSingle();
 if(campaignError||!campaign)return NextResponse.json({error:"Campaign not found."},{status:404});
 const {data:member}=await supabase.from("organization_members").select("role")
  .eq("organization_id",campaign.organization_id).eq("user_id",user.id).eq("status","active").maybeSingle();
 if(!member)return NextResponse.json({error:"Active workspace membership required."},{status:403});
 const {data:links,error:linkError}=await supabase.from("social_campaign_posts")
  .select("post_id").eq("campaign_id",campaign.id).eq("organization_id",campaign.organization_id);
 if(linkError)return NextResponse.json({error:"Unable to load campaign posts."},{status:500});
 const postIds=[...new Set((links??[]).map(row=>row.post_id))];
 const findings:Finding[]=[];
 const now=new Date();
 const today=now.toISOString().slice(0,10);
 if(!postIds.length)findings.push({code:"CAMPAIGN_HAS_NO_POSTS",severity:"blocker",title:"No posts linked",detail:"Attach posts to this campaign before assessing delivery readiness."});
 if(campaign.status==="draft")findings.push({code:"CAMPAIGN_DRAFT",severity:"warning",title:"Campaign is still a draft",detail:"Review and plan the campaign before launch."});
 if(!campaign.start_date)findings.push({code:"CAMPAIGN_START_MISSING",severity:"warning",title:"Campaign start date missing",detail:"A start date helps identify posts outside the intended campaign window."});
 if(campaign.start_date&&campaign.start_date<today&&campaign.status==="planned")findings.push({code:"CAMPAIGN_START_PASSED",severity:"warning",title:"Planned campaign start has passed",detail:"Review the campaign status and remaining schedule."});
 if(campaign.end_date&&campaign.end_date<today&&campaign.status!=="completed")findings.push({code:"CAMPAIGN_END_PASSED",severity:"blocker",title:"Campaign end date has passed",detail:"Reschedule or complete this campaign before further delivery."});
 const {data:posts,error:postsError}=postIds.length?await supabase.from("social_posts")
  .select("id,title,status,scheduled_at,created_at").eq("organization_id",campaign.organization_id).in("id",postIds):{data:[],error:null};
 if(postsError)return NextResponse.json({error:"Unable to load campaign post status."},{status:500});
 const postRows=posts??[];
 const {data:targets,error:targetsError}=postIds.length?await supabase.from("social_post_targets")
  .select("id,post_id,social_account_id,status,scheduled_at,last_error_code")
  .eq("organization_id",campaign.organization_id).in("post_id",postIds):{data:[],error:null};
 if(targetsError)return NextResponse.json({error:"Unable to load destination status."},{status:500});
 const targetRows=targets??[];
 const accountIds=[...new Set(targetRows.map(t=>t.social_account_id))];
 const [{data:accounts,error:accountsError},{data:versions,error:versionsError}]=await Promise.all([
  accountIds.length?supabase.from("social_accounts").select("id,account_name,connection_status,platform:social_platforms(code,name,is_enabled)").eq("organization_id",campaign.organization_id).in("id",accountIds):Promise.resolve({data:[],error:null}),
  postIds.length?supabase.from("social_post_versions").select("post_id,social_account_id,is_default").eq("organization_id",campaign.organization_id).in("post_id",postIds):Promise.resolve({data:[],error:null})
 ]);
 if(accountsError||versionsError)return NextResponse.json({error:"Unable to inspect campaign destinations."},{status:500});
 const accountMap=new Map((accounts??[]).map(a=>[a.id,a]));
 const admin=createSocialAdminClient();
 const {data:tokens,error:tokenError}=accountIds.length?await admin.from("social_account_tokens").select("social_account_id,access_token_expires_at").eq("organization_id",campaign.organization_id).in("social_account_id",accountIds):{data:[],error:null};
 if(tokenError)return NextResponse.json({error:"Unable to inspect credential metadata."},{status:500});
 const tokenMap=new Map((tokens??[]).map(t=>[t.social_account_id,t]));
 const postSummaries=postRows.map(post=>{
  const ownTargets=targetRows.filter(t=>t.post_id===post.id);
  const postFindings:Finding[]=[];
  if(!ownTargets.length)postFindings.push({code:"POST_NO_DESTINATIONS",severity:"blocker",title:"Post has no destinations",detail:"Select at least one connected social account.",postId:post.id});
  const deliveryDates=ownTargets.map(t=>t.scheduled_at||post.scheduled_at).filter(Boolean) as string[];
  for(const date of deliveryDates){const day=date.slice(0,10);if(campaign.start_date&&day<campaign.start_date)postFindings.push({code:"POST_BEFORE_CAMPAIGN",severity:"warning",title:"Post scheduled before campaign",detail:"The delivery date falls before the campaign start date.",postId:post.id});if(campaign.end_date&&day>campaign.end_date)postFindings.push({code:"POST_AFTER_CAMPAIGN",severity:"blocker",title:"Post scheduled after campaign",detail:"The delivery date falls after the campaign end date.",postId:post.id});}
  if(!deliveryDates.length&&post.status!=="published")postFindings.push({code:"POST_UNSCHEDULED",severity:"warning",title:"Post is not scheduled",detail:"This post has no destination delivery time.",postId:post.id});
  if(post.status==="failed")postFindings.push({code:"POST_FAILED",severity:"blocker",title:"Post delivery failed",detail:"Review the publishing centre and resolve failed destinations.",postId:post.id});
  for(const target of ownTargets){
   const account=accountMap.get(target.social_account_id);
   const platform=account?.platform as unknown as {code:string;name:string;is_enabled:boolean}|null;
   if(!account||account.connection_status!=="connected")postFindings.push({code:"DESTINATION_DISCONNECTED",severity:"blocker",title:"Destination disconnected",detail:account?.account_name+" is not connected.",postId:post.id,accountId:target.social_account_id});
   if(!platform||!supported.has(platform.code)||!platform.is_enabled)postFindings.push({code:"DESTINATION_UNSUPPORTED",severity:"blocker",title:"Destination adapter unavailable",detail:"The selected platform is not currently enabled for publishing.",postId:post.id,accountId:target.social_account_id});
   const token=tokenMap.get(target.social_account_id);const expiry=token?.access_token_expires_at?Date.parse(token.access_token_expires_at):null;
   if(!token)postFindings.push({code:"CREDENTIAL_MISSING",severity:"blocker",title:"Credential record missing",detail:"Reconnect this account before delivery.",postId:post.id,accountId:target.social_account_id});
   else if(expiry!==null&&Number.isFinite(expiry)&&expiry<=now.getTime())postFindings.push({code:"CREDENTIAL_EXPIRED",severity:"blocker",title:"Access token expired",detail:"Reconnect or refresh this account before delivery.",postId:post.id,accountId:target.social_account_id});
   else if(expiry===null||!Number.isFinite(expiry)||expiry<=now.getTime()+24*60*60*1000)postFindings.push({code:"CREDENTIAL_EXPIRY_WARNING",severity:"warning",title:"Credential expiry needs review",detail:"The token expiry is unknown or within 24 hours.",postId:post.id,accountId:target.social_account_id});
   if(target.status==="failed")postFindings.push({code:"DESTINATION_FAILED",severity:"blocker",title:"Destination delivery failed",detail:target.last_error_code||"Review this destination's publishing error.",postId:post.id,accountId:target.social_account_id});
   if(target.status==="queued"||target.status==="pending")postFindings.push({code:"DESTINATION_PENDING",severity:"info",title:"Destination awaiting delivery",detail:"This destination has not completed publication.",postId:post.id,accountId:target.social_account_id});
   const hasVersion=(versions??[]).some(v=>v.post_id===post.id&&(v.is_default||v.social_account_id===target.social_account_id));
   if(!hasVersion)postFindings.push({code:"CONTENT_VERSION_MISSING",severity:"blocker",title:"Content version missing",detail:"This destination has no account-specific version or shared fallback.",postId:post.id,accountId:target.social_account_id});
  }
  return {postId:post.id,title:post.title,status:post.status,destinations:ownTargets.length,findings:postFindings,status:postFindings.some(f=>f.severity==="blocker")?"blocked":postFindings.some(f=>f.severity==="warning")?"review":"ready"};
 });
 findings.push(...postSummaries.flatMap(p=>p.findings));
 const scheduled=postRows.filter(p=>p.scheduled_at||targetRows.some(t=>t.post_id===p.id&&t.scheduled_at)).length;
 const failed=targetRows.filter(t=>t.status==="failed").length;
 const pending=targetRows.filter(t=>["queued","pending","publishing"].includes(t.status)).length;
 const blockers=findings.filter(f=>f.severity==="blocker").length,warnings=findings.filter(f=>f.severity==="warning").length;
 const status=blockers?"blocked":warnings?"review":"ready";
 return NextResponse.json({campaignId:campaign.id,campaignName:campaign.name,assessedAt:now.toISOString(),status,summary:{posts:postRows.length,scheduledPosts:scheduled,destinations:targetRows.length,failedDestinations:failed,pendingDestinations:pending,readyPosts:postSummaries.filter(p=>p.status==="ready").length,reviewPosts:postSummaries.filter(p=>p.status==="review").length,blockedPosts:postSummaries.filter(p=>p.status==="blocked").length,blockers,warnings},posts:postSummaries,findings});
}
