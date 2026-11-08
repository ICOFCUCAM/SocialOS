import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSocialAdminClient } from "@/lib/social/admin";
import { encryptToken, getProvider, oauthRedirectUri, toPgBytea, verifyOAuthState, type Provider } from "@/lib/social/oauth";

type TokenResponse={access_token?:string;refresh_token?:string;expires_in?:number;scope?:string;token_type?:string;error?:string};
type Profile={id?:string;sub?:string;name?:string;picture?:string};
function returnToApp(request:NextRequest,status:string) {
  const base=process.env.SOCIAL_OAUTH_REDIRECT_BASE_URL;
  if (!base) throw new Error("SOCIAL_OAUTH_REDIRECT_BASE_URL is not configured.");
  const url=new URL("/app/channels",base);url.searchParams.set("connection",status);
  const response=NextResponse.redirect(url);return response;
}
export async function GET(request:NextRequest) {
  const providerName=request.nextUrl.searchParams.get("provider")??"";
  if (!["youtube","linkedin","meta"].includes(providerName)) return returnToApp(request,"unsupported");
  const provider=getProvider(providerName);
  if (!provider) return returnToApp(request,"not_configured");
  const cookieName=`social_oauth_${providerName}`;
  const cookie=request.cookies.get(cookieName)?.value;
  const state=request.nextUrl.searchParams.get("state")??"";
  const code=request.nextUrl.searchParams.get("code");
  const oauthError=request.nextUrl.searchParams.get("error");
  const clear=(response:NextResponse)=>{response.cookies.set(cookieName,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/api/social/callback",maxAge:0});return response;};
  if (oauthError) return clear(returnToApp(request,"denied"));
  if (!cookie || !state || !code) return clear(returnToApp(request,"invalid_state"));
  let signed;
  try { signed=verifyOAuthState(cookie,state,providerName as Provider); } catch { return clear(returnToApp(request,"invalid_state")); }
  if (!signed) return clear(returnToApp(request,"invalid_state"));
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if (!user || user.id!==signed.userId) return clear(returnToApp(request,"session_expired"));
  const {data:member}=await supabase.from("organization_members").select("organization_id,role")
    .eq("user_id",user.id).eq("organization_id",signed.organizationId).eq("status","active").maybeSingle();
  if (!member || !["owner","administrator","manager"].includes(member.role)) return clear(returnToApp(request,"membership_changed"));
  const {data:brand}=await supabase.from("brands").select("id")
    .eq("id",signed.brandId).eq("organization_id",signed.organizationId).eq("is_active",true).maybeSingle();
  if (!brand) return clear(returnToApp(request,"brand_unavailable"));

  try {
    const tokenUrl=new URL(provider.tokenUrl);
    const tokenRequest=providerName==="meta"
      ? (tokenUrl.searchParams.set("client_id",provider.clientId),tokenUrl.searchParams.set("client_secret",provider.clientSecret),tokenUrl.searchParams.set("redirect_uri",oauthRedirectUri(providerName)),tokenUrl.searchParams.set("code",code),fetch(tokenUrl,{cache:"no-store",signal:AbortSignal.timeout(15000)}))
      : fetch(tokenUrl,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:oauthRedirectUri(providerName),client_id:provider.clientId,client_secret:provider.clientSecret,code_verifier:signed.verifier}),cache:"no-store",signal:AbortSignal.timeout(15000)});
    const tokenResponse=await tokenRequest;
    const tokens=await tokenResponse.json() as TokenResponse;
    if (!tokenResponse.ok || !tokens.access_token) return clear(returnToApp(request,"token_exchange_failed"));

    let externalId="",accountName="",picture:string|undefined;
    if (providerName==="meta") {
      const graphVersion=process.env.META_GRAPH_API_VERSION??"v25.0";
      const pagesUrl=new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`);
      pagesUrl.searchParams.set("fields","id,name,access_token,instagram_business_account{id,username,profile_picture_url}");
      pagesUrl.searchParams.set("access_token",tokens.access_token);
      const pagesResponse=await fetch(pagesUrl,{cache:"no-store",signal:AbortSignal.timeout(20000)});
      const pageData=await pagesResponse.json() as {data?:{id:string;name:string;access_token:string;instagram_business_account?:{id:string;username?:string;profile_picture_url?:string}}[];error?:{message?:string}};
      if (!pagesResponse.ok || !pageData.data) return clear(returnToApp(request,"meta_pages_unavailable"));
      if (pageData.data.length===0) return clear(returnToApp(request,"meta_no_pages"));
      const admin=createSocialAdminClient();
      const {data:platforms,error:platformError}=await admin.from("social_platforms").select("id,code").in("code",["facebook","instagram"]);
      if (platformError || !platforms) throw new Error("Meta platform records are missing.");
      const platformMap=new Map(platforms.map(p=>[p.code,p.id]));
      if (!platformMap.has("facebook")) throw new Error("Facebook platform record is missing.");
      let saved=0;
      for (const page of pageData.data) {
        const pageAccount=await admin.from("social_accounts").upsert({
          organization_id:signed.organizationId,brand_id:signed.brandId,platform_id:platformMap.get("facebook"),
          external_account_id:page.id,account_name:page.name,account_type:"facebook_page",
          connection_status:"connected",granted_scopes:provider.scopes,
          last_verified_at:new Date().toISOString(),connected_by:user.id,
          metadata:{provider:"meta",parent_page_id:page.id}
        },{onConflict:"organization_id,platform_id,external_account_id"}).select("id").single();
        if (pageAccount.error || !pageAccount.data) throw new Error("Unable to save Facebook Page.");
        const pageToken=encryptToken(page.access_token);
        const pageTokenWrite=await admin.from("social_account_tokens").upsert({
          organization_id:signed.organizationId,social_account_id:pageAccount.data.id,
          access_token_nonce:toPgBytea(pageToken.nonce),access_token_ciphertext:toPgBytea(pageToken.ciphertext),access_token_tag:toPgBytea(pageToken.tag),
          encryption_algorithm:pageToken.algorithm,encryption_key_version:pageToken.keyVersion,token_type:"Bearer"
        },{onConflict:"social_account_id"});
        if (pageTokenWrite.error) throw new Error("Unable to store Facebook Page credentials.");
        saved++;
        const instagram=page.instagram_business_account;
        if (instagram && platformMap.has("instagram")) {
          const igAccount=await admin.from("social_accounts").upsert({
            organization_id:signed.organizationId,brand_id:signed.brandId,platform_id:platformMap.get("instagram"),
            external_account_id:instagram.id,account_name:instagram.username??"Instagram professional account",
            account_username:instagram.username??null,account_type:"instagram_business",
            profile_image_url:instagram.profile_picture_url??null,connection_status:"connected",
            granted_scopes:provider.scopes,last_verified_at:new Date().toISOString(),connected_by:user.id,
            metadata:{provider:"meta",parent_page_id:page.id,facebook_page_name:page.name}
          },{onConflict:"organization_id,platform_id,external_account_id"}).select("id").single();
          if (igAccount.error || !igAccount.data) throw new Error("Unable to save Instagram account.");
          const igToken=encryptToken(page.access_token);
          const igTokenWrite=await admin.from("social_account_tokens").upsert({
            organization_id:signed.organizationId,social_account_id:igAccount.data.id,
            access_token_nonce:toPgBytea(igToken.nonce),access_token_ciphertext:toPgBytea(igToken.ciphertext),access_token_tag:toPgBytea(igToken.tag),
            encryption_algorithm:igToken.algorithm,encryption_key_version:igToken.keyVersion,token_type:"Bearer"
          },{onConflict:"social_account_id"});
          if (igTokenWrite.error) throw new Error("Unable to store Instagram credentials.");
          saved++;
        }
      }
      return clear(returnToApp(request,saved>0?"connected":"meta_no_accounts"));
    } else if (providerName==="youtube") {
      const response=await fetch(provider.profileUrl,{headers:{Authorization:`Bearer ${tokens.access_token}`},cache:"no-store",signal:AbortSignal.timeout(15000)});
      const data=await response.json() as {items?:{id?:string;snippet?:{title?:string;thumbnails?:{default?:{url?:string}}}}[]};
      const channel=data.items?.[0];
      if (!response.ok || !channel?.id) return clear(returnToApp(request,"no_channel"));
      externalId=channel.id;accountName=channel.snippet?.title??"YouTube channel";picture=channel.snippet?.thumbnails?.default?.url;
    } else {
      const response=await fetch(provider.profileUrl,{headers:{Authorization:`Bearer ${tokens.access_token}`},cache:"no-store",signal:AbortSignal.timeout(15000)});
      const profile=await response.json() as Profile;
      if (!response.ok || !(profile.sub||profile.id)) return clear(returnToApp(request,"profile_lookup_failed"));
      externalId=profile.sub??profile.id??"";accountName=profile.name??"LinkedIn member";picture=profile.picture;
    }

    const admin=createSocialAdminClient();
    const {data:platform,error:platformError}=await admin.from("social_platforms").select("id").eq("code",provider.platformCode).single();
    if (platformError || !platform) throw new Error("Social platform is not seeded in the database.");
    const {data:account,error:accountError}=await admin.from("social_accounts").upsert({
      organization_id:signed.organizationId,brand_id:signed.brandId,platform_id:platform.id,
      external_account_id:externalId,account_name:accountName,profile_image_url:picture??null,
      connection_status:"connected",granted_scopes:(tokens.scope??provider.scopes.join(" ")).split(/[ ,]+/).filter(Boolean),
      last_verified_at:new Date().toISOString(),connected_by:user.id,metadata:{provider:providerName}
    },{onConflict:"organization_id,platform_id,external_account_id"}).select("id").single();
    if (accountError || !account) throw new Error("Unable to save connected account.");
    const access=encryptToken(tokens.access_token);
    const refresh=tokens.refresh_token?encryptToken(tokens.refresh_token):null;
    const {error:tokenError}=await admin.from("social_account_tokens").upsert({
      organization_id:signed.organizationId,social_account_id:account.id,
      access_token_nonce:toPgBytea(access.nonce),access_token_ciphertext:toPgBytea(access.ciphertext),access_token_tag:toPgBytea(access.tag),
      refresh_token_nonce:refresh?toPgBytea(refresh.nonce):null,refresh_token_ciphertext:refresh?toPgBytea(refresh.ciphertext):null,refresh_token_tag:refresh?toPgBytea(refresh.tag):null,
      encryption_algorithm:access.algorithm,encryption_key_version:access.keyVersion,
      access_token_expires_at:tokens.expires_in?new Date(Date.now()+tokens.expires_in*1000).toISOString():null,
      token_type:"Bearer"
    },{onConflict:"social_account_id"});
    if (tokenError) {
      await admin.from("social_accounts").update({connection_status:"error",last_error:"Secure token storage failed."}).eq("id",account.id);
      throw new Error("Unable to securely store provider credentials.");
    }
    return clear(returnToApp(request,"connected"));
  } catch {
    return clear(returnToApp(request,"connection_failed"));
  }
}
