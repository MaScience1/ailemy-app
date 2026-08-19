"use server";

import { cookies } from "next/headers";

import { isKnownTimeZone } from "@/lib/schedule/timezone";
import { TZ_COOKIE } from "@/lib/schedule/viewer-tz";

/**
 * Remember the visitor's timezone (§45).
 *
 * ⚠ VALIDATED BEFORE IT IS STORED. This is a public endpoint and the value is
 * read back on every render that shows a lesson time; an unvalidated string
 * would throw inside Intl on every session at once. isKnownTimeZone asks the
 * platform whether the zone exists rather than pattern-matching a shape.
 *
 * ⚠ A CONVENIENCE, NOT A SOURCE OF TRUTH. Doha time is rendered whether or not
 * this ever succeeds. Failing silently is correct here: a visitor does not need
 * to be told that an optional second clock could not be added.
 */
export async function rememberTimeZone(tz: string): Promise<void> {
  if (!isKnownTimeZone(tz)) return;
  (await cookies()).set(TZ_COOKIE, tz, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}
