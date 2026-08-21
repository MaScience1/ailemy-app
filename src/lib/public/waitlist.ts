"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * Joining the waiting list for a full cohort (§65).
 *
 * ============================================================================
 * ⚠ public.waitlist (0001) — THE EXISTING TABLE, NOT A NEW ONE
 * ============================================================================
 * §39 forbids a parallel lead database and the governance header names this
 * table specifically. It holds exactly four useful columns — email, course_id,
 * source, created_at — and that is all this feature may store.
 *
 * ⚠ SO THE COHORT SLUG GOES IN `source`, NOT IN A NEW COLUMN. waitlist has no
 * cohort reference and adding one is schema, which is parked. `source` is free
 * text and already exists for exactly this kind of provenance.
 *
 * ⚠ WRITTEN WITH THE ANON KEY, THROUGH RLS. 0001's waitlist_public_insert
 * permits INSERT and 0003 grants it to anon — so the policy is in the path.
 * Using the service role would bypass RLS entirely and turn a guessable
 * endpoint into a way to write arbitrary rows into a table holding addresses.
 * Same rule interest/actions.ts already documents.
 *
 * ⚠ AND NO .select() ON THE INSERT. anon holds INSERT and no SELECT, so a
 * read-back returns permission denied on a row that was in fact written — a
 * success reported as a failure, and a duplicate the moment anyone retries.
 */

export type WaitlistState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; error: string };

const EMAIL_OK = (v: string) => v.includes("@") && v.length >= 5 && v.length <= 320;

export async function joinWaitlist(
  _prev: WaitlistState,
  fd: FormData,
): Promise<WaitlistState> {
  const email = String(fd.get("email") ?? "").trim();
  const cohort = String(fd.get("cohort") ?? "").trim();

  // ⚠ A BOT TRAP, NOT A VALIDATION. Hidden and unlabelled, so a person never
  // fills it. Refused quietly — naming the tripped check teaches a scraper to
  // skip the field.
  if (String(fd.get("website") ?? "")) return { status: "ok" };

  if (!EMAIL_OK(email)) {
    return { status: "error", error: "Please enter a valid email address." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { status: "error", error: "We could not reach the waiting list. Please try again later." };
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.from("waitlist").insert({
    email,
    // ⚠ course_id STAYS NULL. It is a FK to public.courses, and a cohort is not
    // a course — 0009's cohorts table has no course_id either. Inventing a
    // mapping here would be the inference §10 forbids.
    course_id: null,
    source: cohort ? `cohort:${cohort}` : "waitlist",
  });

  if (error) {
    /**
     * ⚠ THE MESSAGE NEVER LEAKS THE CAUSE. A 42501 or a constraint name on a
     * public form tells an attacker about the schema; it also tells a parent
     * nothing they can act on.
     */
    return {
      status: "error",
      error: "We could not add you to the list just now. Please try again in a moment.",
    };
  }
  return { status: "ok" };
}
