import test from "node:test";
import assert from "node:assert/strict";
import {
  getProviderAdapter,
  listProviderAdapters,
  publishTarget
} from "../src/providers/index.mjs";
import { requireScopes } from "../src/errors.mjs";

test("unsupported platforms are rejected rather than silently accepted", async () => {
  await assert.rejects(
    publishTarget({ account: { platform: "tiktok" }, token: "token", post: { body: "Hello" } }),
    error => error.code === "PROVIDER_NOT_SUPPORTED"
  );
});

test("registry exposes only the currently implemented provider capabilities", () => {
  assert.deepEqual(listProviderAdapters().map(item => item.key).sort(), [
    "facebook", "instagram", "linkedin", "youtube"
  ]);
  assert.deepEqual(getProviderAdapter("linkedin").capabilities, {
    text: true, image: false, video: false, maxMediaItems: 0
  });
});

test("invalid provider inputs fail before adapter execution", async () => {
  await assert.rejects(
    publishTarget({ account: { platform: "facebook" }, token: "", post: { body: "Hello" } }),
    error => error.code === "INVALID_PUBLISH_INPUT"
  );
  await assert.rejects(
    publishTarget({ account: { platform: "facebook" }, token: "token", post: { body: "Hello" }, media: {} }),
    error => error.code === "INVALID_PUBLISH_INPUT"
  );
});

test("publishing requires the exact approved scope", () => {
  assert.throws(
    () => requireScopes(["https://www.googleapis.com/auth/youtube.readonly"], ["https://www.googleapis.com/auth/youtube.upload"], "YouTube"),
    error => error.code === "MISSING_PUBLISH_SCOPES"
  );
});

test("LinkedIn text-only adapter refuses media instead of dropping it", async () => {
  const { publishLinkedIn } = await import("../src/providers/linkedin.mjs");
  await assert.rejects(
    publishLinkedIn({ account: { granted_scopes: ["w_member_social"] }, token: "token", post: { body: "Hello" }, media: [{ kind: "image" }] }),
    error => error.code === "MEDIA_UPLOAD_NOT_IMPLEMENTED"
  );
});
