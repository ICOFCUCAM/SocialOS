import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Only same-origin paths are allowed after sign-in. Resolving the URL and
// comparing origins rejects "//evil.com", "/\evil.com" and similar tricks that
// browsers normalise into off-site redirects.
function safeRedirectPath(next: string | null, origin: string): string {
  if (!next) return "/app";
  try {
    const target = new URL(next, origin);
    if (target.origin !== origin) return "/app";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/app";
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(safeRedirectPath(url.searchParams.get("next"), url.origin), url.origin),
      );
    }
  }
  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", url.origin));
}
