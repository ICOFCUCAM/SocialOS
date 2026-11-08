import "server-only";
import { createHmac, randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";

export type Provider = "youtube" | "linkedin" | "meta";
type ProviderConfig = {
  clientId: string; clientSecret: string; authorizeUrl: string; tokenUrl: string;
  profileUrl: string; scopes: string[]; name: string; platformCode: string;
};
export function getProvider(provider: string): ProviderConfig | null {
  if (provider === "meta") {
    const clientId=process.env.META_CLIENT_ID, clientSecret=process.env.META_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {clientId,clientSecret,authorizeUrl:"https://www.facebook.com/v25.0/dialog/oauth",
      tokenUrl:"https://graph.facebook.com/v25.0/oauth/access_token",profileUrl:"https://graph.facebook.com/v25.0/me",
      scopes:["pages_show_list","pages_read_engagement","pages_manage_posts","pages_read_user_content","instagram_basic","instagram_content_publish"],
      name:"Meta",platformCode:"facebook"};
  }
  if (provider === "youtube") {
    const clientId=process.env.GOOGLE_CLIENT_ID, clientSecret=process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {clientId,clientSecret,authorizeUrl:"https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl:"https://oauth2.googleapis.com/token",profileUrl:"https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      scopes:["openid","https://www.googleapis.com/auth/youtube.readonly"],name:"YouTube",platformCode:"youtube"};
  }
  if (provider === "linkedin") {
    const clientId=process.env.LINKEDIN_CLIENT_ID, clientSecret=process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {clientId,clientSecret,authorizeUrl:"https://www.linkedin.com/oauth/v2/authorization",
      tokenUrl:"https://www.linkedin.com/oauth/v2/accessToken",profileUrl:"https://api.linkedin.com/v2/userinfo",
      scopes:["openid","profile"],name:"LinkedIn",platformCode:"linkedin"};
  }
  return null;
}
export function oauthRedirectUri(provider: string) {
  const base=process.env.SOCIAL_OAUTH_REDIRECT_BASE_URL;
  if (!base) throw new Error("SOCIAL_OAUTH_REDIRECT_BASE_URL is not configured.");
  const url=new URL("/api/social/callback",base);
  url.searchParams.set("provider",provider);
  return url.toString();
}
function stateSecret() {
  const secret=process.env.SOCIAL_OAUTH_STATE_SECRET;
  if (!secret || secret.length<32) throw new Error("SOCIAL_OAUTH_STATE_SECRET must contain at least 32 characters.");
  return secret;
}
export function createOAuthState(data:{provider:Provider;userId:string;organizationId:string;brandId:string;verifier:string}) {
  const payload=Buffer.from(JSON.stringify({...data,nonce:randomBytes(24).toString("base64url"),issuedAt:Date.now()})).toString("base64url");
  const signature=createHmac("sha256",stateSecret()).update(payload).digest("base64url");
  return {cookie:payload+"."+signature,nonce:JSON.parse(Buffer.from(payload,"base64url").toString()).nonce as string};
}
export function verifyOAuthState(cookie:string,expectedState:string,provider:Provider) {
  const [payload,signature,...rest]=cookie.split(".");
  if (!payload || !signature || rest.length) return null;
  const expected=createHmac("sha256",stateSecret()).update(payload).digest();
  let actual:Buffer;
  try { actual=Buffer.from(signature,"base64url"); } catch { return null; }
  if (actual.length!==expected.length || !timingSafeEqual(actual,expected)) return null;
  try {
    const data=JSON.parse(Buffer.from(payload,"base64url").toString()) as {
      provider:Provider;userId:string;organizationId:string;brandId:string;verifier:string;nonce:string;issuedAt:number
    };
    if (data.provider!==provider || data.nonce!==expectedState || Date.now()-data.issuedAt>10*60*1000 || data.issuedAt>Date.now()+30_000) return null;
    return data;
  } catch { return null; }
}
export function createPkceVerifier() { return randomBytes(32).toString("base64url"); }
export function createPkceChallenge(verifier:string) { return createHash("sha256").update(verifier).digest("base64url"); }
function encryptionKey() {
  const raw=process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured.");
  const key=Buffer.from(raw,"base64");
  if (key.length!==32) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}
export function encryptToken(token:string) {
  const nonce=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",encryptionKey(),nonce);
  const ciphertext=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
  return {nonce,ciphertext,tag:cipher.getAuthTag(),algorithm:"AES-256-GCM",keyVersion:process.env.SOCIAL_TOKEN_KEY_VERSION??"v1"};
}
export function toPgBytea(value:Buffer) { return `\\x${value.toString("hex")}`; }
export function decryptToken(nonce:Buffer,ciphertext:Buffer,tag:Buffer) {
  const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString("utf8");
}
