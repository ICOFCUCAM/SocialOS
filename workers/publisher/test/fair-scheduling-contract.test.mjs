import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../../../supabase/migrations/0018_fair_publisher_scheduling.sql", import.meta.url),
  "utf8"
);
const worker = await readFile(new URL("../src/worker.mjs", import.meta.url), "utf8");

test("fair scheduler preserves the existing two-argument worker RPC", () => {
  assert.match(migration, /create or replace function public\.claim_publish_jobs\(p_worker_id text,p_limit integer default 10\)/);
  assert.match(migration, /select \* from public\.claim_publish_jobs\(p_worker_id,p_limit,3\)/);
  assert.match(worker, /rpc\("claim_publish_jobs", \{ p_worker_id: workerId, p_limit: workerConcurrency \}\)/);
});

test("claims serialize concurrency accounting and rotate workspaces", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /publish_organization_fairness/);
  assert.match(migration, /order by fairness_at,oldest_due,j\.organization_id/);
  assert.match(migration, /running\.organization_id=j\.organization_id/);
  assert.match(migration, /v_org_limit integer := greatest\(1,least\(coalesce\(p_org_concurrency_limit,3\),20\)\)/);
});

test("publisher processes a bounded batch concurrently", () => {
  assert.match(worker, /PUBLISH_CONCURRENCY/);
  assert.match(worker, /Promise\.all\(\(data \|\| \[\]\)\.map\(job => handleJob\(job\)\)\)/);
});
