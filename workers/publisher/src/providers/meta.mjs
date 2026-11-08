import { providerJson, PublishError, requireScopes } from "../errors.mjs";

const graph = () => {
  const version = process.env.META_GRAPH_API_VERSION;
  if (!version || !/^v\d+\.\d+$/.test(version)) throw new PublishError("META_GRAPH_API_VERSION must be explicitly configured.", { code: "PROVIDER_NOT_CONFIGURED" });
  return "https://graph.facebook.com/" + version;
};

export async function publishFacebookPage({ account, token, post, media = [] }) {
  requireScopes(account.granted_scopes, ["pages_manage_posts"], "Facebook");
  const base = graph();
  const first = media[0];
  let endpoint = base + "/" + encodeURIComponent(account.external_account_id);
  const params = new URLSearchParams({ access_token: token });
  if (!first) {
    params.set("message", post.body || "");
    endpoint += "/feed";
  } else {
    params.set("caption", post.body || "");
    params.set("url", first.signedUrl);
    endpoint += first.kind === "video" ? "/videos" : "/photos";
    if (first.kind === "video") params.set("file_url", first.signedUrl);
  }
  if (media.length > 1) throw new PublishError("Facebook multi-photo publishing is not enabled in this adapter yet.", { code: "UNSUPPORTED_MEDIA_SET" });
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params, signal: AbortSignal.timeout(120000) });
  const result = await providerJson(response, "Facebook");
  if (!result.id) throw new PublishError("Facebook did not return a publication ID.", { code: "PROVIDER_RESPONSE_INVALID", ambiguous: true });
  return { externalPostId: String(result.id), permalink: null };
}

export async function publishInstagram({ account, token, post, media = [] }) {
  requireScopes(account.granted_scopes, ["instagram_basic", "instagram_content_publish"], "Instagram");
  if (media.length !== 1) throw new PublishError("Instagram publishing currently requires exactly one media item.", { code: "UNSUPPORTED_MEDIA_SET" });
  const base = graph();
  const item = media[0];
  if (!item.signedUrl) throw new PublishError("Instagram requires a temporary fetchable media URL.", { code: "MEDIA_URL_REQUIRED" });
  const containerParams = new URLSearchParams({ access_token: token, caption: post.body || "" });
  if (item.kind === "video") {
    containerParams.set("media_type", "REELS");
    containerParams.set("video_url", item.signedUrl);
  } else {
    containerParams.set("image_url", item.signedUrl);
  }
  const create = await fetch(base + "/" + encodeURIComponent(account.external_account_id) + "/media", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: containerParams, signal: AbortSignal.timeout(60000)
  });
  const container = await providerJson(create, "Instagram");
  if (!container.id) throw new PublishError("Instagram did not return a media container ID.", { code: "PROVIDER_RESPONSE_INVALID" });

  if (item.kind === "video") {
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const statusUrl = new URL(base + "/" + encodeURIComponent(container.id));
      statusUrl.searchParams.set("fields", "status_code");
      statusUrl.searchParams.set("access_token", token);
      const status = await providerJson(await fetch(statusUrl, { signal: AbortSignal.timeout(15000) }), "Instagram");
      if (status.status_code === "FINISHED") { ready = true; break; }
      if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
        throw new PublishError("Instagram media container processing failed.", { code: "MEDIA_CONTAINER_FAILED" });
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    if (!ready) throw new PublishError("Instagram media container is still processing; publication was not attempted.", { code: "MEDIA_CONTAINER_PENDING", retryable: true });
  }
  const publishParams = new URLSearchParams({ creation_id: container.id, access_token: token });
  const publish = await fetch(base + "/" + encodeURIComponent(account.external_account_id) + "/media_publish", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: publishParams, signal: AbortSignal.timeout(60000)
  });
  const result = await providerJson(publish, "Instagram");
  if (!result.id) throw new PublishError("Instagram did not return a publication ID.", { code: "PROVIDER_RESPONSE_INVALID", ambiguous: true });
  return { externalPostId: String(result.id), permalink: null };
}
