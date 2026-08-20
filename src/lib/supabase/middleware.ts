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
  // ⚠ /profile CARRIES A STUDENT'S OWN LESSONS AND CREDIT BALANCE. The page
  // redirects an anonymous visitor itself, but a gated route must not depend on
  // its own render to be gated — the proxy is the boundary.
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return true;
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

  // Authenticated user hitting /admin/* who does not hold the `admin` ROLE →
  // bounce to /dashboard. This is the first line of defence; every admin
  // server action ALSO re-checks via assertAdmin() (see src/lib/admin/auth.ts)
  // because middleware doesn't protect direct server-action invocations.
  //
  // ⚠ READS user_roles, NOT ADMIN_EMAIL. Authorisation is a row in the
  // database — the same row 0028's write policies check — so the page gate and
  // the write gate cannot disagree. See lib/admin/auth.ts for why the env var
  // went. The read is safe under RLS: 0027's user_roles_read_own is a bare
  // `user_id = auth.uid()` comparison, so a session sees its own roles and
  // nobody else's, and no EXECUTE grant is involved.
  //
  // ⚠ THE REDIRECT IS UNCHANGED — /dashboard, exactly as before. Someone who
  // is not an admin must land where they always landed. A 404 here would be a
  // lie about the route existing and sends people debugging the wrong thing;
  // a 403 page would confirm the path to anyone probing for it.
  if (user && isAdminPath(pathname)) {
    const { data, error } = await supabase.from("user_roles").select("role");

    // ⚠ FAIL CLOSED, AND SAY SO IN THE LOG.
    //
    // An outage is not "you are not an admin", and everywhere else in this
    // codebase that distinction is preserved for the user. Here it cannot be:
    // the only two things middleware can do are admit and redirect, and
    // admitting on a failed check would turn a database blip into an open
    // admin area. So it redirects — but it must never do that SILENTLY, or a
    // locked-out admin has nothing to go on but a bounce that looks exactly
    // like a permissions problem with their account.
    if (error) {
      console.error(
        `[proxy] admin role check failed for ${user.id} on ${pathname} — ` +
          `redirecting (fail closed): ${error.code ?? "?"}: ${error.message}`,
      );
    }

    const isAdmin =
      !error && ((data ?? []) as { role: string }[]).some((r) => r.role === "admin");

    if (!isAdmin) {
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
