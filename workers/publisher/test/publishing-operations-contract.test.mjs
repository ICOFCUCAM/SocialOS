import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../../../supabase/migrations/20261110001200_publishing_operations.sql", import.meta.url),
  "utf8",
);
const api = await readFile(
  new URL("../../../src/app/api/social/publishing/operations/route.ts", import.meta.url),
  "utf8",
);
const worker = await readFile(new URL("../src/worker.mjs", import.meta.url), "utf8");

test("publishing operations event history is tenant scoped", () => {
  assert.match(migration, /create table public\.publish_job_events/);
  assert.match(migration, /private\.can_access_brand\(p\.brand_id,p\.organization_id\)/);
  assert.match(migration, /create policy publish_job_events_select_tenant/);
  assert.match(worker, /from\("publish_job_events"\)\.insert/);
});

test("workspace metrics require active membership and brand access", () => {
  assert.match(migration, /get_publishing_operations_summary/);
  assert.match(migration, /private\.is_org_member\(p_organization_id\)/);
  assert.match(migration, /private\.can_access_brand\(p\.brand_id,p\.organization_id\)/);
  assert.match(api, /get_publishing_operations_summary/);
});

test("tenant helpers are the private, active-workspace-aware versions", () => {
  // The public.* helpers are dropped by 20261108175641_private_tenant_helpers.
  assert.doesNotMatch(migration, /public\.(can_access_brand|has_org_role|is_org_member)\(/);
});

test("manual retry refuses ambiguous external outcomes", () => {
  assert.match(migration, /operator_retry_publish_job/);
  assert.match(migration, /Unknown provider outcomes require explicit reconciliation before retry/);
  assert.match(migration, /operator_retried/);
});

test("ambiguous outcomes require verified external ID to reconcile as published", () => {
  assert.match(migration, /operator_reconcile_publish_job/);
  assert.match(migration, /v_job\.last_error_code<>'PUBLISH_OUTCOME_UNKNOWN'/);
  assert.match(migration, /A verified external post ID is required/);
  assert.match(api, /reconcile_published/);
});
