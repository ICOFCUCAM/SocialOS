import { providerFetch, providerJson, PublishError, requireScopes } from "../errors.mjs";

export async function publishLinkedIn({ account, token, post, media = [] }) {
  requireScopes(account.granted_scopes, ["w_member_social"], "LinkedIn");
  if (media.length) throw new PublishError("LinkedIn media publishing requires the media upload workflow; text-only publishing is supported in this adapter.", { code: "MEDIA_UPLOAD_NOT_IMPLEMENTED" });
  const version = process.env.LINKEDIN_API_VERSION;
  if (!version || !/^\d{6}$/.test(version)) throw new PublishError("LINKEDIN_API_VERSION must be configured as YYYYMM.", { code: "PROVIDER_NOT_CONFIGURED" });
  const response = await providerFetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "LinkedIn-Version": version,
      "X-Restli-Protocol-Version": "2.0.0"
    },
    body: JSON.stringify({
      author: "urn:li:person:" + account.external_account_id,
      commentary: post.body || "",
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false
    }),
    signal: AbortSignal.timeout(60000)
  }, "LinkedIn", { ambiguous: true });
  const result = await providerJson(response, "LinkedIn");
  const id = response.headers.get("x-restli-id") || result.id;
  if (!id) throw new PublishError("LinkedIn did not return a publication ID.", { code: "PROVIDER_RESPONSE_INVALID", ambiguous: true });
  return { externalPostId: String(id), permalink: null };
}
