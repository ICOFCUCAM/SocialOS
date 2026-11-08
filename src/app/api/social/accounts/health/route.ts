import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSocialAdminClient } from "@/lib/social/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "Active workspace membership required." }, { status: 403 });

  const { data: accounts, error: accountsError } = await supabase
    .from("social_accounts")
    .select("id,brand_id,account_name,account_username,connection_status,last_verified_at,last_error,platform:social_platforms(code,name)")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });
  if (accountsError) return NextResponse.json({ error: "Unable to load connected account health." }, { status: 500 });

  const accountRows = accounts ?? [];
  const admin = createSocialAdminClient();
  const { data: tokens, error: tokensError } = accountRows.length
    ? await admin.from("social_account_tokens")
        .select("social_account_id,access_token_expires_at,refresh_token_expires_at,last_refreshed_at,refresh_token_ciphertext")
        .eq("organization_id", membership.organization_id)
        .in("social_account_id", accountRows.map(account => account.id))
    : { data: [], error: null };
  if (tokensError) return NextResponse.json({ error: "Unable to evaluate credential health." }, { status: 500 });

  const tokenMap = new Map((tokens ?? []).map(token => [token.social_account_id, token]));
  const now = Date.now();
  const rows = accountRows.map(account => {
    const token = tokenMap.get(account.id);
    const expiry = token?.access_token_expires_at ? Date.parse(token.access_token_expires_at) : null;
    const refreshExpiry = token?.refresh_token_expires_at ? Date.parse(token.refresh_token_expires_at) : null;
    let tokenHealth = "unknown";
    if (!token) tokenHealth = "missing";
    else if (expiry !== null && Number.isFinite(expiry)) {
      tokenHealth = expiry <= now ? "expired" : expiry <= now + 7 * 86400000 ? "expiring_soon" : "healthy";
    }
    const refreshHealth = !token ? "missing" : !token.refresh_token_ciphertext
      ? "not_available"
      : refreshExpiry !== null && Number.isFinite(refreshExpiry) && refreshExpiry <= now
        ? "expired" : "available";
    let health = "healthy";
    let reason = null;
    if (account.connection_status === "disconnected") {
      health = "disconnected"; reason = "Account is disconnected.";
    } else if (account.connection_status === "reauthorization_required" || tokenHealth === "expired" || refreshHealth === "expired") {
      health = "action_required"; reason = account.last_error || "Reconnect this account to restore publishing.";
    } else if (account.connection_status === "error" || tokenHealth === "missing") {
      health = "error"; reason = account.last_error || "Account credentials or connection need attention.";
    } else if (account.connection_status !== "connected") {
      health = "pending"; reason = account.last_error || "Account connection is not yet verified.";
    } else if (tokenHealth === "expiring_soon") {
      health = "warning"; reason = "Access token expires within seven days; automatic refresh may be attempted when supported.";
    } else if (tokenHealth === "unknown") {
      health = "warning"; reason = "Provider token expiry is not available; verify connection before critical campaigns.";
    }
    const platform = account.platform as unknown as { code: string; name: string } | null;
    return {
      accountId: account.id,
      brandId: account.brand_id,
      accountName: account.account_name,
      username: account.account_username,
      platform: platform?.code ?? "unknown",
      platformName: platform?.name ?? "Social channel",
      connectionStatus: account.connection_status,
      health,
      reason,
      tokenHealth,
      refreshHealth,
      accessTokenExpiresAt: token?.access_token_expires_at ?? null,
      refreshTokenExpiresAt: token?.refresh_token_expires_at ?? null,
      lastRefreshedAt: token?.last_refreshed_at ?? null,
      lastVerifiedAt: account.last_verified_at,
      lastError: account.last_error
    };
  });

  const summary = {
    total: rows.length,
    healthy: rows.filter(row => row.health === "healthy").length,
    warning: rows.filter(row => row.health === "warning").length,
    actionRequired: rows.filter(row => row.health === "action_required").length,
    error: rows.filter(row => row.health === "error").length,
    disconnected: rows.filter(row => row.health === "disconnected").length,
    pending: rows.filter(row => row.health === "pending").length
  };
  return NextResponse.json({ summary, accounts: rows, generatedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "no-store, max-age=0", "Vary": "Cookie" }
  });
}
