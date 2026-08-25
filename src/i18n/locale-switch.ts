import { isLocalisedPath, UNLOCALISED_ROOTS } from "./localised-paths.ts";
import { routing } from "./routing.ts";

/**
 * WHERE THE LANGUAGE TOGGLE SHOULD SEND A READER — AND WHY IT IS NOT "HERE".
 *
 * ============================================================================
 * ⚠ THE TOGGLE PREFIXES WHATEVER PATH IT IS GIVEN, INCLUDING PATHS THAT
 *   CANNOT CARRY A PREFIX.
 * ============================================================================
 * next-intl's `Link locale="ar"` prepends the locale to whatever pathname it
 * receives. Twenty-four route folders deliberately live OUTSIDE the locale
 * segment, so on /calendar the toggle renders /ar/calendar — a route that does
 * not exist. Reproduced on production: pressing Arabic on /calendar,
 * /past-papers or /resources lands on a 404.
 *
 * ⚠ AND IT MUST NEVER DOUBLE THE PREFIX. next-intl's usePathname() returns the
 * pathname with the active locale already stripped, so passing it back through
 * a prefixing Link is correct — but only while that stripping holds. If a
 * caller ever hands this a path that still carries its locale, prefixing again
 * produces /ar/ar. stripLocale() below makes that impossible by construction
 * rather than by assumption, so the invariant does not depend on next-intl's
 * internals staying the way they are today.
 *
 * The answer for an unlocalisable path is the locale ROOT, not nothing: a
 * reader who presses العربية on the calendar should get an Arabic page, not a
 * 404 and not a dead control.
 */

/** Remove a leading locale segment if one is present. Idempotent. */
export function stripLocale(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const first = path.split("/")[1] ?? "";
  if ((routing.locales as readonly string[]).includes(first)) {
    const rest = path.slice(first.length + 1);
    return rest === "" ? "/" : rest;
  }
  return path;
}

/**
 * The locale-free path the toggle should hand to next-intl's Link.
 *
 * ⚠ ALWAYS LOCALE-FREE, whatever it is given. Passing a path that still has a
 * prefix is what produces /ar/ar, so the strip happens here unconditionally
 * instead of trusting the caller.
 */
export function localeSwitchPath(pathname: string): string {
  const bare = stripLocale(pathname);
  return isLocalisedPath(bare) ? bare : "/";
}

/**
 * The href a reader actually ends up with — what the browser will navigate to.
 *
 * ⚠ THIS EXISTS SO THE GUARD CAN ASSERT THE RESULT. A test that checked
 * "localeSwitchPath was called" would pass while the reader still landed on
 * /ar/ar. This mirrors next-intl's `localePrefix: "as-needed"` rule: the
 * default locale carries no prefix, every other locale carries exactly one.
 */
export function localeSwitchHref(pathname: string, locale: string): string {
  const p = localeSwitchPath(pathname);
  if (locale === routing.defaultLocale) return p;
  return p === "/" ? `/${locale}` : `/${locale}${p}`;
}

/** Exported for the guard, so the matrix is derived rather than typed out. */
export const UNLOCALISED_SAMPLE = Array.from(UNLOCALISED_ROOTS).map((r) => `/${r}`);
