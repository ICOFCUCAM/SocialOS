import { PublishError } from "../errors.mjs";
import { publishFacebookPage, publishInstagram } from "./meta.mjs";
import { publishYouTube } from "./youtube.mjs";
import { publishLinkedIn } from "./linkedin.mjs";

export async function publishTarget(input) {
  const platform = input.account?.platform;
  switch (platform) {
    case "facebook": return publishFacebookPage(input);
    case "instagram": return publishInstagram(input);
    case "youtube": return publishYouTube(input);
    case "linkedin": return publishLinkedIn(input);
    default: throw new PublishError("No official publishing adapter is enabled for this platform.", { code: "PROVIDER_NOT_SUPPORTED" });
  }
}
