import { createServerClient } from "@supabase/ssr";
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
  return false;
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

  // Authenticated user hitting /login or /signup → /dashboard
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const dashUrl = url.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return forwardCookies(NextResponse.redirect(dashUrl), supabaseResponse);
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
