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
    capabilities: Object.freeze({ text: true, image: true, video: true, maxMediaItems: 1 }),
    publish: publishFacebookPage
  }),
  instagram: Object.freeze({
    key: "instagram",
    capabilities: Object.freeze({ text: false, image: true, video: true, maxMediaItems: 1 }),
    publish: publishInstagram
  }),
  youtube: Object.freeze({
    key: "youtube",
    capabilities: Object.freeze({ text: false, image: false, video: true, maxMediaItems: 1 }),
    publish: publishYouTube
  }),
  linkedin: Object.freeze({
    key: "linkedin",
    capabilities: Object.freeze({ text: true, image: false, video: false, maxMediaItems: 0 }),
    publish: publishLinkedIn
  })
};

export function listProviderAdapters() {
  return Object.values(adapters).map(({ key, capabilities }) => ({
    key,
    capabilities: { ...capabilities }
  }));
}

export function getProviderAdapter(platform) {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new PublishError("No official publishing adapter is enabled for this platform.", {
      code: "PROVIDER_NOT_SUPPORTED"
    });
  }
  return adapter;
}

function validatePublishInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PublishError("A provider publishing input is required.", { code: "INVALID_PUBLISH_INPUT" });
  }
  if (!input.account || typeof input.account !== "object" || !input.account.platform) {
    throw new PublishError("A connected social account and platform are required.", { code: "INVALID_PUBLISH_INPUT" });
  }
  if (typeof input.token !== "string" || input.token.length === 0) {
    throw new PublishError("A provider access token is required.", { code: "INVALID_PUBLISH_INPUT" });
  }
  if (!input.post || typeof input.post !== "object" || Array.isArray(input.post)) {
    throw new PublishError("A post payload is required.", { code: "INVALID_PUBLISH_INPUT" });
  }
  if (input.media !== undefined && !Array.isArray(input.media)) {
    throw new PublishError("Media must be supplied as an array.", { code: "INVALID_PUBLISH_INPUT" });
  }
}

export async function publishTarget(input) {
  validatePublishInput(input);
  const adapter = getProviderAdapter(input.account.platform);
  return adapter.publish({ ...input, media: input.media || [] });
}
