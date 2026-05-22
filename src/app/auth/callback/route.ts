import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Supabase auth callback. Receives `?code=...` after the user clicks the
 * verification link in their email, exchanges it for a session, and lands the
 * user in /dashboard with a welcome banner.
 *
 * If something goes wrong (missing code, exchange failure), we redirect back
 * to /login with an error message rather than leaving the user on a blank
 * page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "missing_code");
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "verification_failed");
    return NextResponse.redirect(url);
  }

  const success = new URL("/dashboard", origin);
  success.searchParams.set("welcome", "true");
  return NextResponse.redirect(success);
}
