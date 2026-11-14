import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../src/worker.mjs", import.meta.url), "utf8");
const migration = await readFile(new URL("../../../supabase/migrations/20261110001300_durable_provider_operations.sql", import.meta.url), "utf8");

test("Instagram video submission is persisted before provider polling begins", () => {
  const submit = worker.indexOf("submitInstagramVideoContainer({");
  const persist = worker.indexOf('state: "processing"', submit);
  const release = worker.indexOf('status: "awaiting_provider"', persist);
  assert.ok(submit >= 0);
  assert.ok(persist > submit);
  assert.ok(release > persist);
  assert.match(worker, /remote_operation_id: submitted\.remoteOperationId/);
});

test("provider polling claims only due durable operations through PostgreSQL", () => {
  assert.match(worker, /rpc\("claim_due_publish_provider_operations"/);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /where o\.state = 'processing'/);
  assert.match(migration, /next_action_at/);
});

test("ambiguous side-effect outcomes are never automatically replayed", () => {
  assert.match(worker, /state: "outcome_unknown"/);
  assert.match(migration, /state in \('submit_started','finalize_started'\)/);
  assert.match(migration, /Reconcile externally before retrying/);
  assert.doesNotMatch(migration, /set state = 'prepared'.*outcome_unknown/s);
});

test("provider operation records enforce tenant and target-account consistency", () => {
  assert.match(migration, /foreign key \(job_id, organization_id, target_id\)/);
  assert.match(migration, /foreign key \(target_id, organization_id, social_account_id\)/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /grant all on public\.publish_provider_operations to service_role/i);
  assert.match(migration, /revoke all on public\.publish_provider_operations from public, anon, authenticated/i);
});

test("finalization is delegated to a single database transaction", () => {
  assert.match(worker, /rpc\("finalize_publish_provider_operation"/);
  assert.match(migration, /create or replace function public\.finalize_publish_provider_operation/i);
  assert.match(migration, /for update;/i);
  assert.match(migration, /insert into public\.publish_job_events/i);
  assert.match(migration, /insert into public\.audit_events/i);
});
