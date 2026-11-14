import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Token encryption matches the publisher worker and the OAuth callback:
// AES-256-GCM, 12-byte nonce, keys selected by encryption_key_version.

function bytea(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value !== "string") throw new Error("Encrypted token field is missing.");
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex))
    throw new Error("Encrypted token field has invalid bytea encoding.");
  return Buffer.from(hex, "hex");
}
const toBytea = (buffer) => "\\x" + buffer.toString("hex");

function encryptionKey(version, env = process.env) {
  let keys = {};
  if (env.SOCIAL_TOKEN_ENCRYPTION_KEYS) {
    try {
      keys = JSON.parse(env.SOCIAL_TOKEN_ENCRYPTION_KEYS);
    } catch {
      throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEYS must be a JSON object.");
    }
  }
  const raw =
    keys[version] ||
    (version === (env.SOCIAL_TOKEN_KEY_VERSION || "v1")
      ? env.SOCIAL_TOKEN_ENCRYPTION_KEY
      : undefined);
  if (!raw) throw new Error("OAuth encryption key version is unavailable.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("OAuth encryption key must decode to 32 bytes.");
  return key;
}

export function decryptStored(nonce, ciphertext, tag, version, env = process.env) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(version, env), bytea(nonce));
  decipher.setAuthTag(bytea(tag));
  return Buffer.concat([decipher.update(bytea(ciphertext)), decipher.final()]).toString("utf8");
}

export function encryptStored(value, env = process.env) {
  const keyVersion = env.SOCIAL_TOKEN_KEY_VERSION || "v1";
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyVersion, env), nonce);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { nonce, ciphertext, tag: cipher.getAuthTag(), keyVersion };
}

const decryptAccess = (row, env) =>
  decryptStored(
    row.access_token_nonce,
    row.access_token_ciphertext,
    row.access_token_tag,
    row.encryption_key_version,
    env,
  );

function tokenError(message, { reauthorize = false, retryable = false } = {}) {
  return Object.assign(new Error(message), { reauthorize, retryable });
}

const isFresh = (row) =>
  !row.access_token_expires_at || Date.parse(row.access_token_expires_at) > Date.now() + 120_000;

const REFRESH_ENDPOINTS = {
  youtube: {
    url: "https://oauth2.googleapis.com/token",
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
  },
  linkedin: {
    url: "https://www.linkedin.com/oauth/v2/accessToken",
    clientId: "LINKEDIN_CLIENT_ID",
    clientSecret: "LINKEDIN_CLIENT_SECRET",
  },
};

/**
 * Return a usable access token, refreshing short-lived YouTube/LinkedIn tokens
 * under the same database lock the publisher uses, so the two workers never
 * rotate a refresh token concurrently.
 */
export async function getAccessToken({
  db,
  account,
  platformCode,
  tokenRow,
  workerId,
  fetchImpl = fetch,
  env = process.env,
}) {
  // Meta Page tokens do not expire; older rows may still carry the user token's
  // expiry. A revoked token is reported by the provider as 401.
  if (platformCode === "facebook" || platformCode === "instagram" || isFresh(tokenRow)) {
    return decryptAccess(tokenRow, env);
  }
  const endpoint = REFRESH_ENDPOINTS[platformCode];
  if (!endpoint || !tokenRow.refresh_token_ciphertext) {
    throw tokenError(
      "The access token has expired and cannot be refreshed; reconnect the account.",
      { reauthorize: true },
    );
  }
  if (
    tokenRow.refresh_token_expires_at &&
    Date.parse(tokenRow.refresh_token_expires_at) <= Date.now()
  ) {
    throw tokenError("The provider refresh token has expired; reconnect the account.", {
      reauthorize: true,
    });
  }
  const clientId = env[endpoint.clientId];
  const clientSecret = env[endpoint.clientSecret];
  if (!clientId || !clientSecret)
    throw tokenError("OAuth client credentials are not configured for token refresh.");

  const claimed = await db.rpc("claim_social_token_refresh", {
    p_social_account_id: account.id,
    p_worker_id: workerId,
    p_stale_after_seconds: 120,
  });
  if (claimed.error)
    throw tokenError("Unable to acquire the token refresh lock.", { retryable: true });
  if (!claimed.data)
    throw tokenError("Another worker is refreshing this account token.", { retryable: true });
  try {
    const current = await db
      .from("social_account_tokens")
      .select("*")
      .eq("social_account_id", account.id)
      .eq("organization_id", account.organization_id)
      .single();
    if (current.error || !current.data)
      throw tokenError("Token lookup failed during refresh.", { retryable: true });
    // Another worker may have refreshed while this one waited for the lock.
    if (isFresh(current.data)) return decryptAccess(current.data, env);

    const refreshToken = decryptStored(
      current.data.refresh_token_nonce,
      current.data.refresh_token_ciphertext,
      current.data.refresh_token_tag,
      current.data.encryption_key_version,
      env,
    );
    const response = await fetchImpl(endpoint.url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    let result = {};
    try {
      result = await response.json();
    } catch {
      /* handled below */
    }
    if (!response.ok || !result.access_token) {
      const invalidGrant = response.status === 400 || response.status === 401;
      throw tokenError(
        invalidGrant
          ? "The provider rejected the refresh token; reconnect the account."
          : "OAuth token refresh failed.",
        { reauthorize: invalidGrant, retryable: !invalidGrant },
      );
    }
    const access = encryptStored(result.access_token, env);
    const refresh = encryptStored(result.refresh_token || refreshToken, env);
    const updated = await db
      .from("social_account_tokens")
      .update({
        access_token_nonce: toBytea(access.nonce),
        access_token_ciphertext: toBytea(access.ciphertext),
        access_token_tag: toBytea(access.tag),
        refresh_token_nonce: toBytea(refresh.nonce),
        refresh_token_ciphertext: toBytea(refresh.ciphertext),
        refresh_token_tag: toBytea(refresh.tag),
        access_token_expires_at: result.expires_in
          ? new Date(Date.now() + Number(result.expires_in) * 1000).toISOString()
          : null,
        refresh_token_expires_at: result.refresh_token_expires_in
          ? new Date(Date.now() + Number(result.refresh_token_expires_in) * 1000).toISOString()
          : current.data.refresh_token_expires_at,
        encryption_key_version: access.keyVersion,
        token_type: result.token_type || current.data.token_type || "Bearer",
        last_refreshed_at: new Date().toISOString(),
      })
      .eq("social_account_id", account.id)
      .eq("organization_id", account.organization_id);
    if (updated.error)
      throw tokenError("Unable to persist the refreshed OAuth token.", { retryable: true });
    return result.access_token;
  } finally {
    await db.rpc("release_social_token_refresh", {
      p_social_account_id: account.id,
      p_worker_id: workerId,
    });
  }
}
