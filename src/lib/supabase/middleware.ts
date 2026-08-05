import { createServerClient } from "@supabase/ssr";

import { postSignInTarget } from "@/lib/auth/safe-next";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Public paths reachable without an authenticated session. Anything not in
 * this set and matched by isProtectedPath() requires auth.
 */
const PUBLIC_PATHS = new Set<string>([
  "/",
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/verify-email",
]);

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname === "/app" || pathname.startsWith("/app/")) return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  return false;
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Refreshes the Supabase session cookie on every request and enforces route
 * protection for /app/* and /dashboard. Called from src/proxy.ts.
 *
 * IMPORTANT: per @supabase/ssr docs, do not put logic between createServerClient
 * and the first supabase.auth.getUser() call — it must run unbroken so the
 * server can refresh tokens written via setAll().
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl;
  const pathname = url.pathname;

  // Unauthenticated user trying to reach a protected route → /login?next=<path>
  if (!user && isProtectedPath(pathname)) {
    const loginUrl = url.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);
    return forwardCookies(NextResponse.redirect(loginUrl), supabaseResponse);
  }

  // Authenticated user hitting /admin/* who is NOT the configured admin →
  // bounce to /dashboard. This is the first line of defence; every admin
  // server action ALSO re-checks via assertAdmin() (see src/lib/admin/auth.ts)
  // because middleware doesn't protect direct server-action invocations.
  if (user && isAdminPath(pathname)) {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const userEmail = user.email?.trim().toLowerCase();
    if (!adminEmail || !userEmail || adminEmail !== userEmail) {
      const dashUrl = url.clone();
      dashUrl.pathname = "/dashboard";
      dashUrl.search = "";
      return forwardCookies(NextResponse.redirect(dashUrl), supabaseResponse);
    }
  }

  // Authenticated user hitting /login or /signup → they have no business on a
  // sign-in page, so bounce them onward.
  //
  // Honours ?next=. This used to hardcode /dashboard AND clear the query
  // string, so someone who followed a gated link, got sent to
  // /login?next=/gated-page, and arrived already signed in (session refreshed
  // in another tab, back button, a stale link) lost their destination and
  // landed on the dashboard instead. Now an explicit next still wins, exactly
  // as it does on the other two sign-in paths.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const target = url.clone();
    const dest = postSignInTarget(url.searchParams.get("next"));
    const [destPath, destQuery = ""] = dest.split("?");
    target.pathname = destPath;
    target.search = destQuery;
    return forwardCookies(NextResponse.redirect(target), supabaseResponse);
  }

  // Pages outside the public set or protected set fall through — neutral pass.
  // (Kept explicit so future readers see the policy.)
  void PUBLIC_PATHS;

  return supabaseResponse;
}

/**
 * Copy the session cookies Supabase wrote onto the supabaseResponse over to
 * a redirect response. Without this, a freshly-refreshed token can be lost
 * when we bounce the user to /login or /dashboard.
 */
function forwardCookies(
  destination: NextResponse,
  source: NextResponse,
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    destination.cookies.set(cookie.name, cookie.value);
  });
  return destination;
}
