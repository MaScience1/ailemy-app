"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Demand capture — the only public write in the application.
 *
 * ============================================================================
 * ⚠ IT WRITES AS THE VISITOR, NOT AS THE SERVICE ROLE
 * ============================================================================
 * The client here holds the anon key, so 0040's
 * interest_registrations_insert_anon policy is what actually admits the row.
 * A service-role insert would bypass RLS entirely and this endpoint — which is
 * reachable by anything that can guess it — would become a way to write
 * arbitrary rows to a PII table with no policy in the path at all.
 *
 * ⚠ AND IT NEVER READS BACK. anon holds INSERT and NOT SELECT (0040), so
 * `.insert().select()` would fail with permission denied on a row that was in
 * fact written — a success reported as a failure, and a duplicate the moment
 * the parent pressed the button again. Success here is "PostgREST returned no
 * error", which is exactly what `return=minimal` gives us.
 *
 * ⚠ CONSENT IS STAMPED HERE, NEVER SUBMITTED. consent_at comes from the
 * server's clock. A timestamp a form could set is a timestamp that proves
 * nothing about when anyone agreed to anything, and this column exists
 * precisely to be able to answer that question later.
 */

export type InterestState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; error: string; fields: Record<string, string>; recoverable: boolean };

const REQUIRED = ["subject", "qualification", "student_name", "email"] as const;

const LABELS: Record<string, string> = {
  subject: "Subject",
  qualification: "Qualification",
  student_name: "Student name",
  email: "Email",
};

/** Optional free-text columns: blank means "not told", which is null, not "". */
const OPTIONAL = [
  "exam_board", "exam_session", "parent_name", "phone", "country", "timezone",
  "current_grade", "target_grade", "preferred_days", "preferred_times",
] as const;

const text = (fd: FormData, name: string): string => String(fd.get(name) ?? "").trim();

export async function registerInterest(
  _prev: InterestState,
  fd: FormData,
): Promise<InterestState> {
  // Everything typed so far, echoed back on any failure. A parent who filled in
  // eleven fields and hit a database error must not lose them.
  const fields: Record<string, string> = {};
  for (const k of [...REQUIRED, ...OPTIONAL]) fields[k] = text(fd, k);
  fields.ready_to_start = fd.get("ready_to_start") ? "on" : "";
  fields.consent = fd.get("consent") ? "on" : "";

  const fail = (error: string, recoverable = true): InterestState =>
    ({ status: "error", error, fields, recoverable });

  // ⚠ A BOT TRAP, NOT A VALIDATION. The field is hidden and unlabelled, so a
  // person never fills it. Refused quietly — telling a scraper which check it
  // tripped is how it learns to skip the field.
  if (text(fd, "website")) return fail("Something went wrong. Please try again.");

  for (const k of REQUIRED) {
    if (!fields[k]) return fail(`${LABELS[k]} is required.`);
  }

  // Mirrors 0040's interest_registrations_email_shape. Validated here so a
  // typo is a sentence rather than a constraint-violation stack trace.
  if (fields.email.indexOf("@") < 1 || fields.email.endsWith("@")) {
    return fail("That email address does not look right.");
  }

  // ⚠ NO CONSENT, NO ROW — refused before the network. 0040's CHECK and its
  // policy's WITH CHECK both enforce this again in the database; this arm
  // exists so an unticked box reads as a sentence about the box rather than as
  // "new row violates row-level security policy".
  if (!fd.get("consent")) {
    return fail("Please tick the consent box so we may contact you about this.");
  }

  const row: Record<string, unknown> = {
    subject: fields.subject,
    qualification: fields.qualification,
    student_name: fields.student_name,
    email: fields.email,
    consent_to_contact: true,
    consent_at: new Date().toISOString(),
    ready_to_start: fd.get("ready_to_start") ? true : null,
  };
  for (const k of OPTIONAL) row[k] = fields[k] || null;

  const supabase = await createClient();
  const { error } = await supabase.from("interest_registrations").insert(row);

  if (error) {
    // ⚠ THE ERROR IS SURFACED, NOT SWALLOWED. Logging this and returning
    // success would tell a parent we had their details when we had thrown them
    // away — the single worst outcome this page can produce.
    console.error("[interest] insert failed", { code: error.code, message: error.message });

    // PGRST205 / 42P01: 0040 is not applied. Nothing the visitor can fix by
    // retrying, so the message sends them somewhere that works today.
    const missing = error.code === "PGRST205" || error.code === "42P01";
    return fail(
      missing
        ? "Our registration form is not accepting entries just yet. Please email us instead — the link is below and we will reply personally."
        : "We could not save your registration. Please try again, or email us using the link below.",
      !missing,
    );
  }

  return { status: "ok" };
}
