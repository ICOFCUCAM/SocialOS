import { PublishError } from "../errors.mjs";
import { publishFacebookPage, publishInstagram } from "./meta.mjs";
import { publishYouTube } from "./youtube.mjs";
import { publishLinkedIn } from "./linkedin.mjs";

/**
 * SocialOS-owned provider contract.
 * Capability declarations describe implemented publishing surfaces; they do
 * not imply provider app approval or production access.
 */
const adapters = {
  facebook: Object.freeze({
    key: "facebook",
    capabilities: Object.freeze({
      textOnly: true,
      caption: true,
      allowedMediaKinds: Object.freeze(["image", "video"]),
      requiresMedia: false,
      maxMediaItems: 1,
      maxTextLength: null,
    }),
    publish: publishFacebookPage,
  }),
  instagram: Object.freeze({
    key: "instagram",
    capabilities: Object.freeze({
      textOnly: false,
      caption: true,
      allowedMediaKinds: Object.freeze(["image", "video"]),
      requiresMedia: true,
      maxMediaItems: 1,
      maxTextLength: null,
    }),
    publish: publishInstagram,
  }),
  youtube: Object.freeze({
    key: "youtube",
    capabilities: Object.freeze({
      textOnly: false,
      caption: true,
      allowedMediaKinds: Object.freeze(["video"]),
      requiresMedia: true,
      maxMediaItems: 1,
      maxTextLength: null,
    }),
    publish: publishYouTube,
  }),
  linkedin: Object.freeze({
    key: "linkedin",
    capabilities: Object.freeze({
      textOnly: true,
      caption: true,
      allowedMediaKinds: Object.freeze([]),
      requiresMedia: false,
      maxMediaItems: 0,
      maxTextLength: null,
    }),
    publish: publishLinkedIn,
  }),
};

export function listProviderAdapters() {
  return Object.values(adapters).map(({ key, capabilities }) => ({
    key,
    capabilities: { ...capabilities },
  }));
}

export function getProviderAdapter(platform) {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new PublishError("No official publishing adapter is enabled for this platform.", {
      code: "PROVIDER_NOT_SUPPORTED",
    });
  }
  return adapter;
}

/**
 * Enforce only capabilities verified by the currently implemented adapter.
 * Provider-specific character limits remain null until verified against the
 * applicable official API/version and account permissions.
 */
export function validateContentForProvider(platform, post, media = []) {
  const adapter = getProviderAdapter(platform);
  const caps = adapter.capabilities;
  const body = typeof post?.body === "string" ? post.body : "";
  if (caps.requiresMedia && media.length === 0) {
    throw new PublishError("This destination requires media for the selected publishing format.", {
      code: "PLATFORM_MEDIA_REQUIRED",
    });
  }
  if (media.length > caps.maxMediaItems) {
    throw new PublishError(
      "The selected content contains more media items than this adapter supports.",
      { code: "PLATFORM_MEDIA_COUNT_EXCEEDED" },
    );
  }
  if (body.length && !caps.caption && !caps.textOnly) {
    throw new PublishError("This publishing format does not accept caption text.", {
      code: "PLATFORM_CAPTION_UNSUPPORTED",
    });
  }
  for (const item of media) {
    if (!caps.allowedMediaKinds.includes(item.kind)) {
      throw new PublishError(
        "The selected media type is not supported by this destination adapter.",
        { code: "PLATFORM_MEDIA_TYPE_UNSUPPORTED" },
      );
    }
  }
  if (Number.isInteger(caps.maxTextLength) && body.length > caps.maxTextLength) {
    throw new PublishError("The destination caption exceeds its supported text length.", {
      code: "PLATFORM_TEXT_LIMIT",
    });
  }
  return true;
}

function validatePublishInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PublishError("A provider publishing input is required.", {
      code: "INVALID_PUBLISH_INPUT",
    });
  }
  if (!input.account || typeof input.account !== "object" || !input.account.platform) {
    throw new PublishError("A connected social account and platform are required.", {
      code: "INVALID_PUBLISH_INPUT",
    });
  }
  if (typeof input.token !== "string" || input.token.length === 0) {
    throw new PublishError("A provider access token is required.", {
      code: "INVALID_PUBLISH_INPUT",
    });
  }
  if (!input.post || typeof input.post !== "object" || Array.isArray(input.post)) {
    throw new PublishError("A post payload is required.", { code: "INVALID_PUBLISH_INPUT" });
  }
  if (input.media !== undefined && !Array.isArray(input.media)) {
    throw new PublishError("Media must be supplied as an array.", {
      code: "INVALID_PUBLISH_INPUT",
    });
  }
}

export async function publishTarget(input) {
  validatePublishInput(input);
  const adapter = getProviderAdapter(input.account.platform);
  const media = input.media || [];
  validateContentForProvider(input.account.platform, input.post, media);
  return adapter.publish({ ...input, media });
}
