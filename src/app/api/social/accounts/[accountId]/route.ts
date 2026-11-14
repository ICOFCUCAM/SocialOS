import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSocialAdminClient } from "@/lib/social/admin";

type Context = { params: Promise<{ accountId: string }> };
const managerRoles = ["owner", "administrator", "manager"];

export async function GET(_request: NextRequest, { params }: Context) {
  const { accountId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: account, error } = await supabase
    .from("social_accounts")
    .select(
      "id,organization_id,brand_id,account_name,connection_status,granted_scopes,last_verified_at,last_error,platform:social_platforms(code,name)",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (error || !account)
    return NextResponse.json({ error: "Social account not found." }, { status: 404 });

  const admin = createSocialAdminClient();
  const { data: token, error: tokenError } = await admin
    .from("social_account_tokens")
    .select(
      "access_token_expires_at,refresh_token_expires_at,last_refreshed_at,encryption_key_version,refresh_token_ciphertext",
    )
    .eq("social_account_id", account.id)
    .eq("organization_id", account.organization_id)
    .maybeSingle();
  if (tokenError)
    return NextResponse.json({ error: "Unable to load credential health." }, { status: 500 });

  const expiry = token?.access_token_expires_at ? Date.parse(token.access_token_expires_at) : null;
  const now = Date.now();
  const tokenHealth = !token
    ? "missing"
    : expiry === null
      ? "unknown"
      : expiry <= now
        ? "expired"
        : expiry <= now + 7 * 86400000
          ? "expiring_soon"
          : "healthy";
  return NextResponse.json(
    {
      accountId: account.id,
      status: account.connection_status,
      lastVerifiedAt: account.last_verified_at,
      lastError: account.last_error,
      grantedScopes: account.granted_scopes ?? [],
      tokenHealth,
      accessTokenExpiresAt: token?.access_token_expires_at ?? null,
      refreshTokenExpiresAt: token?.refresh_token_expires_at ?? null,
      lastRefreshedAt: token?.last_refreshed_at ?? null,
      hasRefreshToken: Boolean(token?.refresh_token_ciphertext),
      encryptionKeyVersion: token?.encryption_key_version ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { accountId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  // Resolve the account through the caller's RLS-visible rows first, then check
  // membership in that exact tenant. Users may belong to multiple workspaces.
  const { data: account, error: accountError } = await supabase
    .from("social_accounts")
    .select("id,organization_id,brand_id,account_name,platform:social_platforms(code,name)")
    .eq("id", accountId)
    .maybeSingle();
  if (accountError || !account)
    return NextResponse.json({ error: "Social account not found." }, { status: 404 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id,role")
    .eq("organization_id", account.organization_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership || !managerRoles.includes(membership.role)) {
    return NextResponse.json({ error: "Workspace manager permission required." }, { status: 403 });
  }

  const admin = createSocialAdminClient();
  const { error: disconnectError } = await admin.rpc("disconnect_social_account", {
    p_account_id: account.id,
    p_organization_id: account.organization_id,
    p_actor_user_id: user.id,
  });
  if (disconnectError)
    return NextResponse.json(
      {
        error:
          "Unable to disconnect the account. Stored credentials and account status were left unchanged.",
      },
      { status: 500 },
    );

  return NextResponse.json({
    ok: true,
    message:
      "Stored SocialOS credentials have been removed. You may also revoke SocialOS access in the platform's security settings.",
  });
}
