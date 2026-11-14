import test from "node:test";
import assert from "node:assert/strict";
import { collectLinkedInInsights } from "../src/linkedin-insights.mjs";

process.env.LINKEDIN_API_VERSION = "202610";
const target = {
  id: "target-1",
  organization_id: "org-1",
  platform_post_id: "urn:li:share:123456789",
};

test("requests lifetime LinkedIn member post metrics and maps normalized fields", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(new URL(url));
    const metric = new URL(url).searchParams.get("queryType");
    const counts = {
      IMPRESSION: 1200,
      MEMBERS_REACHED: 900,
      REACTION: 80,
      COMMENT: 12,
      RESHARE: 3,
      POST_SAVE: 5,
      LINK_CLICKS: 20,
      FOLLOWER_GAINED_FROM_CONTENT: 2,
      PROFILE_VIEW_FROM_CONTENT: 7,
    };
    return {
      ok: true,
      json: async () => ({ elements: [{ count: counts[metric], metricType: metric }] }),
    };
  };
  const [record] = await collectLinkedInInsights(target, "token", fetchImpl);
  assert.equal(requested.length, 9);
  assert.equal(requested[0].pathname, "/rest/memberCreatorPostAnalytics");
  assert.equal(requested[0].searchParams.get("q"), "entity");
  assert.equal(requested[0].searchParams.get("entity"), "(share:urn:li:share:123456789)");
  assert.equal(requested[0].searchParams.get("aggregation"), "TOTAL");
  assert.equal(record.period_type, "lifetime");
  assert.equal(record.impressions, 1200);
  assert.equal(record.reach, 900);
  assert.equal(record.likes, 80);
  assert.equal(record.comments, 12);
  assert.equal(record.shares, 3);
  assert.equal(record.engagements, 95);
  assert.equal(record.saves, 5);
  assert.equal(record.clicks, 20);
  assert.equal(record.followers_gained, 2);
  assert.equal(record.profile_visits, 7);
});

test("supports ugcPost URNs and preserves unavailable metric values as null", async () => {
  let count = 0;
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    assert.match(parsed.searchParams.get("entity"), /^\(ugcPost:/);
    count++;
    return {
      ok: true,
      json: async () => ({
        elements: parsed.searchParams.get("queryType") === "IMPRESSION" ? [{ count: 50 }] : [],
      }),
    };
  };
  const [record] = await collectLinkedInInsights(
    { ...target, platform_post_id: "urn:li:ugcPost:987654321" },
    "token",
    fetchImpl,
  );
  assert.equal(count, 9);
  assert.equal(record.impressions, 50);
  assert.equal(record.likes, null);
  assert.equal(record.comments, null);
});

test("rejects malformed post URNs and marks authorization failures", async () => {
  await assert.rejects(
    collectLinkedInInsights({ ...target, platform_post_id: "not-a-urn" }, "token"),
    /valid ugcPost or share URN/,
  );
  const denied = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: "forbidden" }),
  });
  await assert.rejects(
    collectLinkedInInsights(target, "token", denied),
    (error) => error.reauthorize === true,
  );
});
