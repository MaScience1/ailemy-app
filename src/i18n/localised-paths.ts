/**
 * WHICH PATHS LIVE INSIDE THE LOCALE SEGMENT — ONE DECLARATION, TWO CONSUMERS.
 *
 * ============================================================================
 * ⚠ THIS LIST USED TO LIVE ONLY IN proxy.ts, AND THE LINK LAYER GUESSED.
 * ============================================================================
 * The proxy decides which requests get rewritten into `app/[locale]`. A link
 * component has to make the SAME decision from the other side: next-intl's
 * `Link` prefixes every href it is given, so pointing it at `/login` produces
 * `/ar/login`, a route that does not exist. Two copies of this rule would
 * drift, and the failure is a 404 in Arabic on a page that works in English.
 *
 * So the rule is declared once, here, and both sides import it.
 */

/**
 * ⚠ EVERY ROUTE FOLDER THAT STAYS OUTSIDE THE LOCALE SEGMENT.
 *
 * These resolve to their own static folders and must never be rewritten: a
 * rewrite of /calendar to /en/calendar lands on a route that does not exist
 * under [locale] and takes a working page down. Anything NOT in this list is
 * handled inside the locale segment — which is what keeps the admin-authored
 * pages catch-all reachable after it moved to app/[locale]/(site)/[...slug].
 *
 * ⚠ IF A NEW TOP-LEVEL ROUTE FOLDER IS ADDED, IT BELONGS HERE OR UNDER
 * [locale]. i18n-routing.test.ts fails if a root folder is in neither, so this
 * list cannot silently fall out of step with the filesystem.
 */
export const UNLOCALISED_ROOTS = new Set([
  "_actions", "admin", "api", "auth", "biology", "calendar", "chemistry",
  "dashboard", "dev", "exam-builder", "forgot-password", "intensive", "learn",
  "login", "my-tuition", "past-papers", "physics", "privacy", "profile",
  "reset-password", "resources", "signup", "terms", "welcome",
]);

/**
 * True when `pathname` is served from inside `app/[locale]`.
 *
 * ⚠ ACCEPTS A FULL HREF, NOT ONLY A PATHNAME. The proxy passes a bare pathname;
 * a link passes whatever the JSX wrote, which routinely carries a query string
 * or a hash (`/tuition?mode=group`, `/#try`). Those are stripped before the
 * first segment is read, so both callers get the same answer for the same page.
 */
export function isLocalisedPath(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0] ?? "";
  if (path === "" || path === "/") return true;
  const first = path.split("/")[1] ?? "";
  // A path with a file extension is an asset, never a page.
  if (first.includes(".")) return false;
  return !UNLOCALISED_ROOTS.has(first);
}
