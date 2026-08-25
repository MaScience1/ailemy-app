import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { updateSession } from "@/lib/supabase/middleware";
import { isLocalisedPath } from "@/i18n/localised-paths";
import { LOCALE_COOKIE } from "@/i18n/locale-cookie";
import { routing } from "@/i18n/routing";

/**
 * Next.js 16 Proxy (formerly Middleware — renamed in v16 to clarify network
 * boundary). Runs on every request, refreshes the Supabase session cookie,
 * and enforces protection for /app/* and /dashboard.
 *
 * ============================================================================
 * ⚠ ONE PROXY FILE PER PROJECT. THE TWO CONCERNS ARE COMPOSED, NOT SEPARATED.
 * ============================================================================
 * Next allows exactly one proxy — "While only one `proxy.ts` file is supported
 * per project, you can still organize your proxy logic into modules"
 * (16-proxy.md). So the locale rewrite cannot live in its own file; adding one
 * would either be ignored or silently replace this one, and replacing it stops
 * the Supabase session cookie refreshing on every page load. That is not a
 * visible failure — it is a slow one, where sessions expire and students are
 * logged out mid-lesson with nothing in the logs.
 *
 * ORDER MATTERS. The auth refresh runs FIRST and its response is returned
 * whenever it decides to redirect (an unauthenticated visitor to /dashboard).
 * The locale rewrite only runs for requests auth has let through, and only for
 * the paths phase 1 actually localises.
 */

const intl = createMiddleware(routing);

/**
 * ⚠ THE LOCALE LAYER IS SCOPED BY PATH, INSIDE ONE GLOBAL MATCHER.
 *
 * The matcher below must keep matching everything, because that is what auth
 * needs. So the locale decision is made here instead: only the homepage and
 * /tuition are localised in phase 1. Handing /calendar to next-intl would
 * rewrite it to /en/calendar — a route that does not exist under the locale
 * segment — and take a working page down.
 */
export async function proxy(request: NextRequest) {
  const authResponse = await updateSession(request);

  /**
   * ⚠ A REDIRECT FROM AUTH WINS OUTRIGHT. If updateSession has decided to send
   * somebody to /login, rewriting that response through the locale layer would
   * discard the redirect and serve the page they were being kept out of.
   */
  if (authResponse && authResponse.headers.get("location")) return authResponse;

  if (!isLocalisedPath(request.nextUrl.pathname)) return authResponse;

  /**
   * ==========================================================================
   * ⚠ A RETURNING VISITOR'S OWN CHOICE IS HONOURED. A GUESS ABOUT THEM IS NOT.
   * ==========================================================================
   * If somebody deliberately pressed العربية on an earlier visit, the toggle
   * wrote NEXT_LOCALE=ar, and they should land back in Arabic rather than
   * pressing it again every time. That is remembering a decision they made.
   *
   * ⚠ Accept-Language IS NEVER READ, AND THAT IS THE WHOLE POINT. Redirecting
   * on the browser header would push a first-time visitor with an Arabic
   * system into Arabic they never asked for — and this catalogue is still
   * UNREVIEWED, so English is the version we can stand behind for a stranger.
   * next-intl's `localeDetection` switch would turn on the cookie AND the
   * header together, which is exactly why it stays false and this is done here.
   *
   * ⚠ AND IT CANNOT TRAP ANYBODY IN ARABIC. Pressing English writes
   * NEXT_LOCALE=en before navigating, so the read below finds "en" and this
   * branch does nothing. Without that write the English link would redirect
   * straight back to /ar and the toggle would be a one-way door.
   */
  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
  const alreadyPrefixed = routing.locales.some(
    (l) => request.nextUrl.pathname === `/${l}` || request.nextUrl.pathname.startsWith(`/${l}/`),
  );
  if (
    !alreadyPrefixed &&
    remembered !== undefined &&
    remembered !== routing.defaultLocale &&
    (routing.locales as readonly string[]).includes(remembered)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = url.pathname === "/" ? `/${remembered}` : `/${remembered}${url.pathname}`;
    const redirect = NextResponse.redirect(url);
    /** ⚠ The refreshed Supabase cookies must survive this redirect too. */
    if (authResponse) {
      for (const cookie of authResponse.cookies.getAll()) redirect.cookies.set(cookie);
    }
    return redirect;
  }

  /**
   * ⚠ THE AUTH COOKIES ARE CARRIED ONTO THE LOCALE RESPONSE. updateSession
   * writes refreshed Supabase cookies onto its response object; returning
   * next-intl's response instead would drop them, which is the same expired
   * session failure by a different route.
   */
  const intlResponse = intl(request);
  if (authResponse) {
    for (const cookie of authResponse.cookies.getAll()) {
      intlResponse.cookies.set(cookie);
    }
  }
  return intlResponse;
}

export const config = {
  /**
   * Match all paths except Next internals and static assets. Auth cookies need
   * to refresh on real page loads, not on /_next/* or image requests.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
