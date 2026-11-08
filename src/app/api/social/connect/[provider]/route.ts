import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOAuthState, createPkceChallenge, createPkceVerifier, getProvider, oauthRedirectUri, type Provider } from "@/lib/social/oauth";

export async function GET(request:NextRequest,{params}:{params:Promise<{provider:string}>}) {
  const {provider:providerName}=await params;
  if (!["youtube","linkedin","meta"].includes(providerName)) return NextResponse.json({error:"This provider is not enabled in the OAuth foundation."},{status:404});
  const provider=getProvider(providerName);
  if (!provider) return NextResponse.json({error:"Provider credentials are not configured."},{status:503});
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login",request.url));
  const {data:member}=await supabase.from("organization_members").select("organization_id,role")
    .eq("user_id",user.id).eq("status","active").limit(1).maybeSingle();
  if (!member) return NextResponse.redirect(new URL("/onboarding",request.url));
  if (!["owner","administrator","manager"].includes(member.role)) return NextResponse.json({error:"Only workspace managers can connect social accounts."},{status:403});
  const brandId=request.nextUrl.searchParams.get("brandId");
  if (!brandId) return NextResponse.json({error:"A brandId is required."},{status:400});
  const {data:brand}=await supabase.from("brands").select("id")
    .eq("id",brandId).eq("organization_id",member.organization_id).eq("is_active",true).maybeSingle();
  if (!brand) return NextResponse.json({error:"Brand not found or inactive."},{status:404});
  const verifier=createPkceVerifier();
  const state=createOAuthState({provider:providerName as Provider,userId:user.id,organizationId:member.organization_id,brandId,verifier});
  const url=new URL(provider.authorizeUrl);
  url.searchParams.set("client_id",provider.clientId);
  url.searchParams.set("redirect_uri",oauthRedirectUri(providerName));
  url.searchParams.set("response_type","code");
  url.searchParams.set("scope",provider.scopes.join(" "));
  url.searchParams.set("state",state.nonce);
  if (providerName!=="meta") {
    url.searchParams.set("code_challenge",createPkceChallenge(verifier));
    url.searchParams.set("code_challenge_method","S256");
  }
  if (providerName==="youtube") {
    url.searchParams.set("access_type","offline");
    url.searchParams.set("prompt","consent");
    url.searchParams.set("include_granted_scopes","true");
  }
  const response=NextResponse.redirect(url);
  response.cookies.set(`social_oauth_${providerName}`,state.cookie,{
    httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/api/social/callback",maxAge:600
  });
  return response;
}
