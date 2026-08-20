"use server";

import { cookies } from "next/headers";

import { canonicalTimeZone } from "@/lib/schedule/timezone";
import { TZ_COOKIE } from "@/lib/schedule/viewer-tz";

/**
 * Remember the visitor's timezone (§45).
 *
 * ⚠ VALIDATED BEFORE IT IS STORED. This is a public endpoint and the value is
 * read back on every render that shows a lesson time; an unvalidated string
 * would throw inside Intl on every session at once.
 *
 * ⚠ AND "DOES Intl ACCEPT IT" IS NOT THE TEST. Intl accepts "BST" and quietly
 * means Asia/Dhaka, so a browser sending an abbreviation would give this
 * visitor a second clock five hours out with nothing erroring.
 * canonicalTimeZone requires the Region/City form for exactly that reason.
 *
 * ⚠ A CONVENIENCE, NOT A SOURCE OF TRUTH. Doha time is rendered whether or not
 * this ever succeeds. Failing silently is correct here: a visitor does not need
 * to be told that an optional second clock could not be added.
 */
export async function rememberTimeZone(tz: string): Promise<void> {
  // ⚠ THE CANONICAL FORM IS STORED, not what the browser sent. A cookie read on
  // every render should not carry a casing variant that makes two sessions
  // disagree about the same zone.
  const canonical = canonicalTimeZone(tz);
  if (!canonical) return;
  (await cookies()).set(TZ_COOKIE, canonical, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}
