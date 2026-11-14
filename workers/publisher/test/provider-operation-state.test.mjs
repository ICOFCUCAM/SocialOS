import test from "node:test";
import assert from "node:assert/strict";
import {
  assertProviderOperationTransition,
  transitionProviderOperation,
  computeProviderPollDelay,
  classifyInstagramContainerStatus
} from "../src/provider-operation-state.mjs";

const operation = Object.freeze({
  id: "operation-1",
  organization_id: "org-1",
  job_id: "job-1",
  target_id: "target-1",
  provider: "instagram",
  operation_type: "instagram_video_publish",
  state: "prepared",
  poll_count: 0,
  created_at: "2026-01-01T00:00:00.000Z"
});

test("allows only forward lifecycle transitions", () => {
  assert.equal(assertProviderOperationTransition("prepared", "submit_started"), true);
  assert.equal(assertProviderOperationTransition("submit_started", "processing"), true);
  assert.equal(assertProviderOperationTransition("processing", "finalize_started"), true);
  assert.equal(assertProviderOperationTransition("finalize_started", "published"), true);
  assert.throws(() => assertProviderOperationTransition("published", "processing"), {
    code: "INVALID_PROVIDER_OPERATION_TRANSITION"
  });
});

test("processing may reschedule itself but cannot return to submission", () => {
  assert.equal(assertProviderOperationTransition("processing", "processing"), true);
  assert.throws(() => assertProviderOperationTransition("processing", "submit_started"));
  assert.throws(() => assertProviderOperationTransition("finalize_started", "processing"));
});

test("ambiguous submit and finalize outcomes have terminal unknown state", () => {
  assert.equal(assertProviderOperationTransition("submit_started", "outcome_unknown"), true);
  assert.equal(assertProviderOperationTransition("finalize_started", "outcome_unknown"), true);
  assert.throws(() => assertProviderOperationTransition("outcome_unknown", "processing"));
});

test("transition patch cannot rewrite identity or tenancy", () => {
  assert.throws(
    () => transitionProviderOperation(operation, "submit_started", { organization_id: "other-org" }),
    { code: "IMMUTABLE_PROVIDER_OPERATION_FIELD" }
  );
  assert.throws(
    () => transitionProviderOperation(operation, "submit_started", { state: "processing" }),
    { code: "IMMUTABLE_PROVIDER_OPERATION_FIELD" }
  );
});

test("transition returns a new immutable record and preserves operation identity", () => {
  const next = transitionProviderOperation(operation, "submit_started", { submit_started_at: "2026-01-01T00:01:00.000Z" });
  assert.equal(next.state, "submit_started");
  assert.equal(next.organization_id, operation.organization_id);
  assert.equal(next.submit_started_at, "2026-01-01T00:01:00.000Z");
  assert.notEqual(next, operation);
  assert.equal(Object.isFrozen(next), true);
});

test("poll delay respects Retry-After and remains bounded", () => {
  assert.equal(computeProviderPollDelay({ retryAfterMs: 500, random: () => 0.5 }), 1_000);
  assert.equal(computeProviderPollDelay({ retryAfterMs: 99_000_000 }), 15 * 60 * 1000);
  assert.equal(computeProviderPollDelay({ pollCount: 0, random: () => 0.5 }), 3_000);
  assert.equal(computeProviderPollDelay({ pollCount: 1, random: () => 0.5 }), 6_000);
  assert.equal(computeProviderPollDelay({ pollCount: 50, random: () => 0.5 }), 15 * 60 * 1000);
});

test("classifies documented Instagram container statuses without guessing unknown states", () => {
  assert.deepEqual(classifyInstagramContainerStatus("FINISHED"), { outcome: "ready" });
  assert.deepEqual(classifyInstagramContainerStatus("IN_PROGRESS"), { outcome: "pending" });
  assert.deepEqual(classifyInstagramContainerStatus("ERROR"), { outcome: "rejected", code: "MEDIA_CONTAINER_FAILED" });
  assert.deepEqual(classifyInstagramContainerStatus("EXPIRED"), { outcome: "rejected", code: "MEDIA_CONTAINER_FAILED" });
  assert.deepEqual(classifyInstagramContainerStatus("SOMETHING_NEW"), { outcome: "unknown", code: "UNRECOGNIZED_CONTAINER_STATUS" });
});
