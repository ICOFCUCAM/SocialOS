/**
 * Public, server-selected publishing capabilities for the SocialOS composer.
 * This is deliberately conservative: a connected account is not necessarily
 * publishable, and media support is only enabled where the current adapter
 * implements the complete upload/publish path.
 */
export type MediaKind = "image" | "video";

export type PlatformCapability = {
  platform: string;
  publishingEnabled: boolean;
  supportedMedia: MediaKind[];
  maxMediaItems: number;
  textOnly: boolean;
  limitation: string | null;
};

const CAPABILITIES: Record<string, PlatformCapability> = {
  facebook: {
    platform: "facebook",
    publishingEnabled: true,
    supportedMedia: ["image", "video"],
    maxMediaItems: 1,
    textOnly: false,
    limitation: "One image or one video per post; multi-photo posts are not enabled.",
  },
  instagram: {
    platform: "instagram",
    publishingEnabled: true,
    supportedMedia: ["image", "video"],
    maxMediaItems: 1,
    textOnly: false,
    limitation: "One image or one video/Reel per post.",
  },
  youtube: {
    platform: "youtube",
    publishingEnabled: true,
    supportedMedia: ["video"],
    maxMediaItems: 1,
    textOnly: false,
    limitation: "One prepared video is required.",
  },
  linkedin: {
    platform: "linkedin",
    publishingEnabled: true,
    supportedMedia: [],
    maxMediaItems: 0,
    textOnly: true,
    limitation:
      "The current adapter supports text-only publishing; media uploads are not implemented.",
  },
  tiktok: {
    platform: "tiktok",
    publishingEnabled: false,
    supportedMedia: [],
    maxMediaItems: 0,
    textOnly: false,
    limitation: "A publishing adapter is not implemented yet.",
  },
  threads: {
    platform: "threads",
    publishingEnabled: false,
    supportedMedia: [],
    maxMediaItems: 0,
    textOnly: false,
    limitation: "A publishing adapter is not implemented yet.",
  },
  pinterest: {
    platform: "pinterest",
    publishingEnabled: false,
    supportedMedia: [],
    maxMediaItems: 0,
    textOnly: false,
    limitation: "A publishing adapter is not implemented yet.",
  },
  x: {
    platform: "x",
    publishingEnabled: false,
    supportedMedia: [],
    maxMediaItems: 0,
    textOnly: false,
    limitation: "A publishing adapter is not implemented yet.",
  },
};

export function getPlatformCapability(platformCode: string | null | undefined): PlatformCapability {
  const code = (platformCode || "").toLowerCase();
  return (
    CAPABILITIES[code] ?? {
      platform: code || "unknown",
      publishingEnabled: false,
      supportedMedia: [],
      maxMediaItems: 0,
      textOnly: false,
      limitation: "No verified publishing capability is registered for this platform.",
    }
  );
}
