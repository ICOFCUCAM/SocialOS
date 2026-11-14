import { providerJson, PublishError, requireScopes } from "../errors.mjs";

export async function publishYouTube({ account, token, post, media = [] }) {
  requireScopes(
    account.granted_scopes,
    ["https://www.googleapis.com/auth/youtube.upload"],
    "YouTube",
  );
  if (media.length !== 1 || media[0].kind !== "video" || !media[0].bytes) {
    throw new PublishError("YouTube publishing requires one prepared video file.", {
      code: "VIDEO_REQUIRED",
    });
  }
  const metadata = {
    snippet: {
      title: (post.title || post.body || "Untitled").slice(0, 100),
      description: post.body || "",
      categoryId: String(post.platformOptions?.categoryId || "22"),
    },
    status: {
      privacyStatus: post.platformOptions?.privacyStatus || "private",
      selfDeclaredMadeForKids: Boolean(post.platformOptions?.madeForKids),
    },
  };
  const start = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(media[0].bytes.length),
      },
      body: JSON.stringify(metadata),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!start.ok) await providerJson(start, "YouTube");
  const uploadUrl = start.headers.get("location");
  // Validate the resumable endpoint before forwarding OAuth credentials or media bytes.
  let uploadHost = "";
  try {
    uploadHost = new URL(uploadUrl).hostname;
  } catch {
    /* rejected below */
  }
  if (!uploadUrl || !["www.googleapis.com", "youtube.googleapis.com"].includes(uploadHost)) {
    throw new PublishError("YouTube did not return a trusted resumable upload URL.", {
      code: "UPLOAD_URL_INVALID",
    });
  }
  let response;
  try {
    response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "video/mp4",
        "Content-Length": String(media[0].bytes.length),
      },
      body: media[0].bytes,
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });
  } catch {
    throw new PublishError("YouTube upload outcome is unknown; reconcile before retrying.", {
      code: "UPLOAD_OUTCOME_UNKNOWN",
      ambiguous: true,
    });
  }
  const result = await providerJson(response, "YouTube");
  if (!result.id)
    throw new PublishError("YouTube did not return a video ID.", {
      code: "PROVIDER_RESPONSE_INVALID",
      ambiguous: true,
    });
  return {
    externalPostId: String(result.id),
    permalink: "https://www.youtube.com/watch?v=" + encodeURIComponent(result.id),
  };
}
