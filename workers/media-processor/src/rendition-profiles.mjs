// Internal delivery profiles. These are production presets, not a guarantee of
// current platform acceptance; each publishing adapter must validate live API rules.
export const PLATFORM_PROFILES = Object.freeze({
  instagram: Object.freeze({ image: "portrait", video: "vertical" }),
  facebook: Object.freeze({ image: "portrait", video: "vertical" }),
  youtube: Object.freeze({ image: "landscape", video: "landscape" }),
  linkedin: Object.freeze({ image: "landscape", video: "landscape" }),
  pinterest: Object.freeze({ image: "pin", video: "vertical" }),
  threads: Object.freeze({ image: "square", video: "square" }),
});

export const IMAGE_PROFILES = Object.freeze({
  portrait: Object.freeze({ width: 1080, height: 1350, quality: 86 }),
  square: Object.freeze({ width: 1080, height: 1080, quality: 86 }),
  landscape: Object.freeze({ width: 1920, height: 1080, quality: 86 }),
  pin: Object.freeze({ width: 1000, height: 1500, quality: 86 }),
});

export const VIDEO_PROFILES = Object.freeze({
  vertical: Object.freeze({
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: "8M",
    audioBitrate: "192k",
  }),
  square: Object.freeze({
    width: 1080,
    height: 1080,
    fps: 30,
    videoBitrate: "8M",
    audioBitrate: "192k",
  }),
  landscape: Object.freeze({
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: "12M",
    audioBitrate: "192k",
  }),
});

export function resolveRenditionProfiles(targetPlatforms = Object.keys(PLATFORM_PROFILES)) {
  if (!Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
    throw new TypeError("targetPlatforms must be a non-empty array");
  }
  const selected = new Set();
  for (const platform of targetPlatforms) {
    if (typeof platform !== "string" || !Object.hasOwn(PLATFORM_PROFILES, platform)) {
      throw new TypeError("Unsupported target platform: " + String(platform));
    }
    const profile = PLATFORM_PROFILES[platform];
    selected.add(profile.image);
    selected.add(profile.video);
  }
  return {
    platforms: [...new Set(targetPlatforms)],
    image: [...selected].filter((key) => Object.hasOwn(IMAGE_PROFILES, key)),
    video: [...selected].filter((key) => Object.hasOwn(VIDEO_PROFILES, key)),
  };
}
