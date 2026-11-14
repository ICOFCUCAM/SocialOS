import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encryptStored, getAccessToken } from "../src/oauth-token.mjs";
import { isGoogleQuotaError } from "../src/provider-errors.mjs";

const env = {
  SOCIAL_TOKEN_KEY_VERSION: "v1",
  SOCIAL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  GOOGLE_CLIENT_ID: "client",
  GOOGLE_CLIENT_SECRET: "secret",
};
const hex = (buf) => "\\x" + buf.toString("hex");

function tokenRow({ access = "old-access", refresh = "refresh-1", expiresAt } = {}) {
  const a = encryptStored(access, env);
  const r = refresh ? encryptStored(refresh, env) : null;
  return {
    access_token_nonce: hex(a.nonce),
    access_token_ciphertext: hex(a.ciphertext),
    access_token_tag: hex(a.tag),
    refresh_token_nonce: r ? hex(r.nonce) : null,
    refresh_token_ciphertext: r ? hex(r.ciphertext) : null,
    refresh_token_tag: r ? hex(r.tag) : null,
    encryption_key_version: "v1",
    access_token_expires_at: expiresAt,
    refresh_token_expires_at: null,
    token_type: "Bearer",
  };
}

function fakeDb(row, { claim = true } = {}) {
  const calls = { rpc: [], updates: [] };
  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    async single() {
      return { data: row, error: null };
    },
    update(values) {
      calls.updates.push(values);
      return {
        eq() {
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };
  return {
    calls,
    async rpc(name, args) {
      calls.rpc.push(name);
      return { data: name === "claim_social_token_refresh" ? claim : null, error: null };
    },
    from() {
      return query;
    },
  };
}

const account = { id: "acct-1", organization_id: "org-1" };
const expired = new Date(Date.now() - 60_000).toISOString();

test("Meta Page tokens are used even when an old expiry is stored", async () => {
  const db = fakeDb(null);
  const token = await getAccessToken({
    db,
    account,
    platformCode: "instagram",
    tokenRow: tokenRow({ expiresAt: expired }),
    workerId: "w",
    env,
    fetchImpl: async () => {
      throw new Error("must not refresh");
    },
  });
  assert.equal(token, "old-access");
  assert.deepEqual(db.calls.rpc, []);
});

test("an expired YouTube token is refreshed under the shared lock and persisted", async () => {
  const row = tokenRow({ expiresAt: expired });
  const db = fakeDb(row);
  let body;
  const token = await getAccessToken({
    db,
    account,
    platformCode: "youtube",
    tokenRow: row,
    workerId: "w",
    env,
    fetchImpl: async (_url, init) => {
      body = init.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "new-access", expires_in: 3599 }),
      };
    },
  });
  assert.equal(token, "new-access");
  assert.equal(body.get("refresh_token"), "refresh-1");
  assert.deepEqual(db.calls.rpc, ["claim_social_token_refresh", "release_social_token_refresh"]);
  assert.equal(db.calls.updates.length, 1);
  assert.ok(Date.parse(db.calls.updates[0].access_token_expires_at) > Date.now());
});

test("a rejected refresh token asks for reconnection and still releases the lock", async () => {
  const row = tokenRow({ expiresAt: expired });
  const db = fakeDb(row);
  await assert.rejects(
    getAccessToken({
      db,
      account,
      platformCode: "youtube",
      tokenRow: row,
      workerId: "w",
      env,
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "invalid_grant" }),
      }),
    }),
    (error) => error.reauthorize === true,
  );
  assert.deepEqual(db.calls.rpc, ["claim_social_token_refresh", "release_social_token_refresh"]);
});

test("a held refresh lock is retryable, not a reconnect", async () => {
  const row = tokenRow({ expiresAt: expired });
  await assert.rejects(
    getAccessToken({
      db: fakeDb(row, { claim: false }),
      account,
      platformCode: "youtube",
      tokenRow: row,
      workerId: "w",
      env,
    }),
    (error) => error.retryable === true && error.reauthorize === false,
  );
});

test("Google quota 403 reasons are recognised as quota, not revoked access", () => {
  assert.equal(isGoogleQuotaError({ error: { errors: [{ reason: "quotaExceeded" }] } }), true);
  assert.equal(isGoogleQuotaError({ error: { errors: [{ reason: "forbidden" }] } }), false);
  assert.equal(isGoogleQuotaError({}), false);
});
