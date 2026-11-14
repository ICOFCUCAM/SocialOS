import test from "node:test";
import assert from "node:assert/strict";
import { collectMetaInsights } from "../src/meta-insights.mjs";

process.env.META_GRAPH_API_VERSION = "v25.0";

const target = { id: "target-1", organization_id: "org-1", platform_post_id: "media-1" };

test("maps Instagram lifetime insights without inventing absent metrics", async () => {
  let requested;
  const fetchImpl = async url => {
    requested = new URL(url);
    return {
      ok: true,
      json: async () => ({ data: [
        { name: "views", values: [{ value: 1200 }] },
        { name: "reach", values: [{ value: 900 }] },
        { name: "likes", values: [{ value: 80 }] },
        { name: "comments", values: [{ value: 12 }] },
        { name: "saved", values: [{ value: 5 }] },
        { name: "shares", values: [{ value: 3 }] },
        { name: "total_interactions", values: [{ value: 100 }] }
      ] })
    };
  };
  const [record] = await collectMetaInsights(target, "instagram", "token", fetchImpl);
  assert.equal(requested.pathname, "/v25.0/media-1/insights");
  assert.equal(requested.searchParams.get("period"), "lifetime");
  assert.equal(record.impressions, 1200);
  assert.equal(record.reach, 900);
  assert.equal(record.engagements, 100);
  assert.equal(record.likes, 80);
  assert.equal(record.saves, 5);
  assert.equal(record.period_type, "lifetime");
  assert.equal(record.provider_metrics.provider, "meta");
});

test("maps current Facebook Page post media-view metrics", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ data: [
      { name: "post_media_view", values: [{ value: 600 }] },
      { name: "post_total_media_view_unique", values: [{ value: 450 }] }
    ] })
  });
  const [record] = await collectMetaInsights(target, "facebook", "token", fetchImpl);
  assert.equal(record.impressions, 600);
  assert.equal(record.reach, 450);
  assert.equal(record.likes, null);
  assert.equal(record.engagements, null);
});

test("marks permission failures for reconnect and does not emit zero metrics", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ data: [] }) });
  assert.deepEqual(await collectMetaInsights(target, "instagram", "token", fetchImpl), []);
  const denied = async () => ({ ok: false, status: 403, json: async () => ({ error: "denied" }) });
  await assert.rejects(
    collectMetaInsights(target, "instagram", "token", denied),
    error => error.reauthorize === true
  );
});
