import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { postSignInTarget, safeNext } from "@/lib/auth/safe-next";

/**
 * Supabase auth callback. Receives `?code=...` after the user clicks the
 * verification link in their email, exchanges it for a session, and lands the
 * user on a validated `next` if one was passed, otherwise on "/".
 *
 * If something goes wrong (missing code, exchange failure), we redirect back
 * to /login with an error message rather than leaving the user on a blank
 * page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // safeNext lives in @/lib/auth/safe-next now — one definition shared with the
  // password form and the proxy, rather than a copy per sign-in path.
  const next = safeNext(searchParams.get("next"));

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

  // An explicit ?next= always wins — magic-link sign-ins pass
  // /intensive/dashboard (the gated cohort home, not the public /intensive
  // marketing page), and the proxy passes the gated page a student was trying
  // to reach. Everything else now lands on "/" rather than /dashboard: the
  // dashboard is still reachable at its own URL, it just is not where every
  // signed-in user belongs.
  //
  // This used to append ?welcome=true and land on /dashboard, which rendered a
  // one-line "account verified" banner. Both the param and that banner are gone
  // — nothing set the param once the default moved here, and a read with no
  // writer is just a trap for the next person to change this file.
  return NextResponse.redirect(new URL(postSignInTarget(next), origin));
}
