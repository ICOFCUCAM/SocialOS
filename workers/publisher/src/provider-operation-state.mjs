const TRANSITIONS = Object.freeze({
  prepared: new Set(["submit_started"]),
  submit_started: new Set(["processing", "rejected", "outcome_unknown"]),
  processing: new Set(["processing", "finalize_started", "rejected", "outcome_unknown"]),
  finalize_started: new Set(["published", "rejected", "outcome_unknown"]),
  published: new Set(),
  rejected: new Set(),
  outcome_unknown: new Set(),
});

export class ProviderOperationStateError extends Error {
  constructor(message, code = "INVALID_PROVIDER_OPERATION_TRANSITION") {
    super(message);
    this.name = "ProviderOperationStateError";
    this.code = code;
  }
}

export function assertProviderOperationTransition(from, to) {
  if (!Object.hasOwn(TRANSITIONS, from) || !Object.hasOwn(TRANSITIONS, to)) {
    throw new ProviderOperationStateError(
      "Unknown provider-operation state.",
      "UNKNOWN_PROVIDER_OPERATION_STATE",
    );
  }
  if (!TRANSITIONS[from].has(to)) {
    throw new ProviderOperationStateError(
      `Provider operation cannot transition from ${from} to ${to}.`,
    );
  }
  return true;
}

export function transitionProviderOperation(operation, nextState, patch = {}) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
    throw new ProviderOperationStateError(
      "A provider operation record is required.",
      "INVALID_PROVIDER_OPERATION",
    );
  }
  assertProviderOperationTransition(operation.state, nextState);

  const forbidden = new Set([
    "id",
    "organization_id",
    "job_id",
    "target_id",
    "provider",
    "operation_type",
    "created_at",
  ]);
  for (const key of Object.keys(patch)) {
    if (forbidden.has(key) || key === "state") {
      throw new ProviderOperationStateError(
        `Operation field cannot be changed through a transition patch: ${key}.`,
        "IMMUTABLE_PROVIDER_OPERATION_FIELD",
      );
    }
  }

  return Object.freeze({
    ...operation,
    ...patch,
    state: nextState,
    updated_at: patch.updated_at || new Date().toISOString(),
  });
}

const MAX_POLL_DELAY_MS = 15 * 60 * 1000;
const BASE_POLL_DELAY_MS = 3_000;

export function computeProviderPollDelay({
  pollCount = 0,
  retryAfterMs = null,
  random = Math.random,
} = {}) {
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(MAX_POLL_DELAY_MS, Math.max(1_000, retryAfterMs));
  }
  const attempt = Number.isInteger(pollCount) ? Math.max(0, pollCount) : 0;
  const base = Math.min(MAX_POLL_DELAY_MS, BASE_POLL_DELAY_MS * 2 ** Math.min(attempt, 9));
  const randomValue = random();
  const sample = Number.isFinite(randomValue) ? Math.min(1, Math.max(0, randomValue)) : 0.5;
  return Math.round(base * (0.8 + sample * 0.4));
}

export function classifyInstagramContainerStatus(statusCode) {
  switch (statusCode) {
    case "FINISHED":
      return Object.freeze({ outcome: "ready" });
    case "IN_PROGRESS":
      return Object.freeze({ outcome: "pending" });
    case "ERROR":
    case "EXPIRED":
      return Object.freeze({ outcome: "rejected", code: "MEDIA_CONTAINER_FAILED" });
    default:
      return Object.freeze({ outcome: "unknown", code: "UNRECOGNIZED_CONTAINER_STATUS" });
  }
}
