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

/**
 * §51/0043. Written only when the columns exist — the page gates the inputs on
 * the same probe, so in practice these arrive empty before 0043 is applied.
 *
 * ⚠ THE RETRY BELOW IS A SECOND LINE, NOT THE PLAN. If a stale page or a
 * crafted POST sends them against a table without the columns, PostgREST
 * rejects the WHOLE insert with PGRST204 and a family's contact details would
 * be lost over three optional answers. The retry drops the three and keeps the
 * registration — and says loudly in the log exactly what it dropped, because a
 * silent drop is the thing this whole file exists to avoid.
 */
const DEMAND = ["year_group", "exam_year", "student_notes"] as const;

const text = (fd: FormData, name: string): string => String(fd.get(name) ?? "").trim();

export async function registerInterest(
  _prev: InterestState,
  fd: FormData,
): Promise<InterestState> {
  // Everything typed so far, echoed back on any failure. A parent who filled in
  // eleven fields and hit a database error must not lose them.
  const fields: Record<string, string> = {};
  for (const k of [...REQUIRED, ...OPTIONAL, ...DEMAND]) fields[k] = text(fd, k);
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

  // exam_year is a smallint with a plausibility CHECK (0043). A non-numeric or
  // out-of-range answer is dropped rather than sent — the database would refuse
  // the whole row, and losing a registration over a mistyped year is absurd.
  const examYear = Number(fields.exam_year);
  const demand: Record<string, unknown> = {
    year_group: fields.year_group || null,
    exam_year: Number.isInteger(examYear) && examYear >= 2024 && examYear <= 2040 ? examYear : null,
    student_notes: fields.student_notes || null,
  };
  const sendingDemand = Object.values(demand).some((v) => v !== null);

  const supabase = await createClient();
  let { error } = await supabase
    .from("interest_registrations")
    .insert(sendingDemand ? { ...row, ...demand } : row);

  // PGRST204 / 42703 = 0043 not applied. Keep the registration, drop the three.
  if (error && sendingDemand && (error.code === "PGRST204" || error.code === "42703")) {
    console.warn(
      "[interest] 0043 not applied — retrying without the demand fields. DROPPED:",
      JSON.stringify(demand),
    );
    ({ error } = await supabase.from("interest_registrations").insert(row));
  }

  if (error) {
    // ⚠ THE ERROR IS SURFACED, NOT SWALLOWED. Logging this and returning
    // success would tell a parent we had their details when we had thrown them
    // away — the single worst outcome this page can produce.
    console.error("[interest] insert failed", { code: error.code, message: error.message });

    // PGRST205 / 42P01 would mean the table is unreachable — 0040 is applied,
    // so in practice this is an outage or a revoked grant. Either way it is
    // nothing the visitor can fix by retrying, so the message sends them
    // somewhere that works instead of inviting a pointless second attempt.
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
