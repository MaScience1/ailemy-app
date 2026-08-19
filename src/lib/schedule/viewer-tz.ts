import "server-only";

import { cookies } from "next/headers";

import { isKnownTimeZone } from "./timezone.ts";

/** Set by TimezoneSync on first visit; changeable later by the visitor. */
export const TZ_COOKIE = "ailemy_tz";

/**
 * Where the visitor is, if we know (§45).
 *
 * ⚠ NULL IS A REAL ANSWER AND MUST STAY ONE. When we do not know, surfaces show
 * Doha time alone — which is correct and complete — rather than guessing a zone
 * and printing a second, wrong number beside it. A student who plans around an
 * invented local time misses a lesson; a student who reads only Doha time does
 * not.
 *
 * ⚠ VALIDATED, BECAUSE A COOKIE IS VISITOR INPUT. An unknown zone string would
 * throw inside Intl on every session on the page.
 */
export async function viewerTimeZone(): Promise<string | null> {
  try {
    const raw = (await cookies()).get(TZ_COOKIE)?.value ?? null;
    return isKnownTimeZone(raw) ? raw : null;
  } catch {
    return null;
  }
}
