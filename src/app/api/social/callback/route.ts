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
  if (!["youtube","linkedin"].includes(providerName)) return returnToApp(request,"unsupported");
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
    const tokenResponse=await fetch(provider.tokenUrl,{
      method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},
      body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:oauthRedirectUri(providerName),client_id:provider.clientId,client_secret:provider.clientSecret,code_verifier:signed.verifier}),
      cache:"no-store",signal:AbortSignal.timeout(15000)
    });
    const tokens=await tokenResponse.json() as TokenResponse;
    if (!tokenResponse.ok || !tokens.access_token) return clear(returnToApp(request,"token_exchange_failed"));

    let externalId="",accountName="",picture:string|undefined;
    if (providerName==="youtube") {
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
