import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(
  new URL("../../../src/app/(protected)/app/publishing/page.tsx", import.meta.url),
  "utf8"
);
const retry = await readFile(
  new URL("../../../src/components/app/publishing-job-retry.tsx", import.meta.url),
  "utf8"
);
const reconcile = await readFile(
  new URL("../../../src/components/app/publishing-job-reconcile.tsx", import.meta.url),
  "utf8"
);

test("publishing centre displays live operational metrics and event history", () => {
  assert.match(page, /get_publishing_operations_summary/);
  assert.match(page, /publish_job_events/);
  assert.match(page, /succeeded_24h/);
  assert.match(page, /dead_lettered_24h/);
  assert.match(page, /oldest_due_at/);
});

test("dashboard routes known-failure retry through guarded operations action", () => {
  assert.match(page, /PublishingJobRetry/);
  assert.match(retry, /action:"retry"/);
  assert.match(retry, /api\/social\/publishing\/operations/);
});

test("dashboard exposes a separate verified-ID reconciliation workflow", () => {
  assert.match(page, /PublishingJobReconcile/);
  assert.match(page, /unknown&&canRetry/);
  assert.match(reconcile, /action:"reconcile_published"/);
  assert.match(reconcile, /externalPostId/);
  assert.match(reconcile, /Only use this action after locating the published post/);
});
