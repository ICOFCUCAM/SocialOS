import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveRenditionProfiles,
  IMAGE_PROFILES,
  VIDEO_PROFILES,
} from "../src/rendition-profiles.mjs";

test("maps selected platforms to deduplicated output profiles", () => {
  const result = resolveRenditionProfiles(["instagram", "facebook", "youtube", "pinterest"]);
  assert.deepEqual(result.image.sort(), ["landscape", "pin", "portrait"].sort());
  assert.deepEqual(result.video.sort(), ["landscape", "vertical"].sort());
});

test("rejects unknown platforms rather than silently generating a wrong asset", () => {
  assert.throws(() => resolveRenditionProfiles(["unknown-network"]), /Unsupported target platform/);
});

test("all output profiles have bounded even dimensions", () => {
  for (const profile of Object.values(IMAGE_PROFILES)) {
    assert.equal(profile.width % 2, 0);
    assert.ok(profile.width <= 1920 && profile.height <= 1920);
  }
  for (const profile of Object.values(VIDEO_PROFILES)) {
    assert.equal(profile.width % 2, 0);
    assert.equal(profile.height % 2, 0);
    assert.ok(profile.width <= 1920 && profile.height <= 1920);
  }
});
