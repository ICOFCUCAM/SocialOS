import test from "node:test";
import assert from "node:assert/strict";
import {
  getProviderAdapter,
  listProviderAdapters,
  publishTarget,
  validateContentForProvider,
} from "../src/providers/index.mjs";
import { requireScopes } from "../src/errors.mjs";

test("unsupported platforms are rejected rather than silently accepted", async () => {
  await assert.rejects(
    publishTarget({ account: { platform: "tiktok" }, token: "token", post: { body: "Hello" } }),
    (error) => error.code === "PROVIDER_NOT_SUPPORTED",
  );
});

test("registry exposes only the currently implemented provider capabilities", () => {
  assert.deepEqual(
    listProviderAdapters()
      .map((item) => item.key)
      .sort(),
    ["facebook", "instagram", "linkedin", "youtube"],
  );
  assert.deepEqual(getProviderAdapter("linkedin").capabilities, {
    textOnly: true,
    caption: true,
    allowedMediaKinds: [],
    requiresMedia: false,
    maxMediaItems: 0,
    maxTextLength: null,
  });
});

test("invalid provider inputs fail before adapter execution", async () => {
  await assert.rejects(
    publishTarget({ account: { platform: "facebook" }, token: "", post: { body: "Hello" } }),
    (error) => error.code === "INVALID_PUBLISH_INPUT",
  );
  await assert.rejects(
    publishTarget({
      account: { platform: "facebook" },
      token: "token",
      post: { body: "Hello" },
      media: {},
    }),
    (error) => error.code === "INVALID_PUBLISH_INPUT",
  );
});

test("publishing requires the exact approved scope", () => {
  assert.throws(
    () =>
      requireScopes(
        ["https://www.googleapis.com/auth/youtube.readonly"],
        ["https://www.googleapis.com/auth/youtube.upload"],
        "YouTube",
      ),
    (error) => error.code === "MISSING_PUBLISH_SCOPES",
  );
});

test("LinkedIn text-only adapter refuses media instead of dropping it", async () => {
  const { publishLinkedIn } = await import("../src/providers/linkedin.mjs");
  await assert.rejects(
    publishLinkedIn({
      account: { granted_scopes: ["w_member_social"] },
      token: "token",
      post: { body: "Hello" },
      media: [{ kind: "image" }],
    }),
    (error) => error.code === "MEDIA_UPLOAD_NOT_IMPLEMENTED",
  );
});

test("provider content validation enforces media requirements and media types", () => {
  assert.throws(
    () => validateContentForProvider("instagram", { body: "Caption" }, []),
    (error) => error.code === "PLATFORM_MEDIA_REQUIRED",
  );
  assert.throws(
    () => validateContentForProvider("youtube", { body: "Description" }, [{ kind: "image" }]),
    (error) => error.code === "PLATFORM_MEDIA_TYPE_UNSUPPORTED",
  );
  assert.throws(
    () => validateContentForProvider("linkedin", { body: "Text" }, [{ kind: "image" }]),
    (error) => error.code === "PLATFORM_MEDIA_COUNT_EXCEEDED",
  );
  assert.equal(validateContentForProvider("facebook", { body: "Text" }, []), true);
  assert.equal(
    validateContentForProvider("youtube", { body: "Description" }, [{ kind: "video" }]),
    true,
  );
});
