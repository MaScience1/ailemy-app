/**
 * Multi-subject tuition: what is live, what is not, and what must never render
 * for a subject we do not teach yet.
 */
import { readFileSync, existsSync } from "node:fs";

import {
  TUITION_SUBJECTS, DEFAULT_SUBJECT, readSubject, isTuitionSubject,
  subjectState, subjectStates, isComingSoon, SUBJECT_ACCENT,
} from "../../../src/lib/tuition/subjects.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ");

/** Real shape: chemistry has cohorts, nothing else does. */
const LIVE = [
  { subject: "chemistry", status: "interest", enrolmentUrl: null },
  { subject: "chemistry", status: "interest", enrolmentUrl: null },
  { subject: "chemistry", status: "interest", enrolmentUrl: null },
];

console.log("\n=== 1. §4 — legacy URLs still land on Chemistry ===");
{
  t("an absent subject defaults to chemistry", readSubject(undefined) === "chemistry");
  t("⚠ an UNKNOWN subject falls back, never 404s or blanks",
    readSubject("astrology") === "chemistry" && readSubject("") === "chemistry");
  t("the default is chemistry", DEFAULT_SUBJECT === "chemistry");
  t("a real subject is kept", readSubject("physics") === "physics");
  t("the five subjects are the five", TUITION_SUBJECTS.join(",") === "chemistry,biology,physics,maths,english");
  t("isTuitionSubject rejects junk", !isTuitionSubject("astrology") && !isTuitionSubject(null));
}

console.log("\n=== 2. §18/§19 — status is DERIVED, not declared ===");
{
  t("chemistry is active because the catalogue holds cohorts for it",
    subjectState("chemistry", LIVE as never).status === "active");
  for (const s of ["biology", "physics", "maths", "english"] as const) {
    t(`${s} is coming soon — no cohorts`, subjectState(s, LIVE as never).status === "interest");
  }
  /**
   * ⚠ THE ACTIVATION TEST (§18). Seed a Biology cohort and it becomes ACTIVE
   * with no code change. If this ever needs an edit to subjects.ts, the model
   * has become presentational and §19 is broken.
   */
  const withBio = [...LIVE, { subject: "biology", status: "interest", enrolmentUrl: null }];
  t("⚠ adding a Biology cohort flips it to ACTIVE with no code change",
    subjectState("biology", withBio as never).status === "active");
  t("and the real cohort count is reported, never invented",
    subjectState("chemistry", LIVE as never).cohorts === 3);
  t("an empty catalogue makes everything coming soon",
    subjectStates([]).every((s) => isComingSoon(s)));
}

console.log("\n=== 3. §36 — the design union was NOT widened ===");
{
  const colours = readFileSync("src/lib/design/subject-colours.ts", "utf8");
  /**
   * ⚠ SubjectKey IS SHARED WITH RESOURCES, PAST PAPERS AND THE LESSON TREES.
   * Widening it to carry maths/english would push two contentless subjects into
   * every one of those surfaces. Tuition keeps its own list instead.
   */
  t("⚠ SubjectKey is still chemistry | biology | physics",
    /SubjectKey = "chemistry" \| "biology" \| "physics"/.test(colours));
  t("⚠ and maths/english have no invented brand colour",
    !/maths|english/i.test(code(colours)));
  t("only the three with a real accent carry one",
    Object.keys(SUBJECT_ACCENT).sort().join(",") === "biology,chemistry,physics");
}

console.log("\n=== 4. §6/§30/§31 — a coming-soon subject sells nothing ===");
{
  const panel = code(readFileSync("src/components/tuition/SubjectComingSoon.tsx", "utf8"));
  t("⚠ the panel contains no price at all", !/QAR|£|\bprice\b|unitAmount/i.test(panel));
  t("⚠ no checkout, no Stripe", !/checkout|stripe|price_/i.test(panel));
  t("⚠ and no calendar", !/Calendar|slot|availability/i.test(panel));
  /**
   * ⚠ THE CALENDAR SECTION LEAKED ONTO THE MATHS PAGE before it was gated —
   * real Chemistry slots under a heading that implied they were maths slots.
   * Real data, false claim. This is the assertion that caught it.
   */
  const page = code(readFileSync("src/app/[locale]/tuition/page.tsx", "utf8"));
  t("⚠ the tuition page gates its calendar section on comingSoon",
    /\{!comingSoon && \(/.test(page));
  t("⚠ and gates the whole pricing experience on it too",
    /comingSoon \? \(/.test(page));
  /**
   * ⚠ §6 FORBIDS LINKING TO A DEAD PAGE. /resources/<subject> exists for the
   * three subjects that have content and does not for maths or english, so the
   * secondary CTA is behind a membership test rather than always rendered.
   */
  t("§6 — the secondary link is gated on a real destination",
    /HAS_RESOURCES\.includes\(subject\) &&/.test(panel));
  t("⚠ and that list is exactly the three subjects with resources",
    /HAS_RESOURCES[^=]*=\s*\["chemistry", "biology", "physics"\]/.test(panel));
}

console.log("\n=== 5. override 5 — no fake success, no local fallback ===");
{
  const cap = code(readFileSync("src/lib/tuition/interest-capability.ts", "utf8"));
  const panel = code(readFileSync("src/components/tuition/SubjectComingSoon.tsx", "utf8"));
  /**
   * ⚠ A PROBE SHAPED WITH head:true SWALLOWS A MISSING COLUMN and reports
   * success against a schema that cannot hold the data. select(col).limit(1)
   * surfaces it as 42703.
   */
  t("⚠ the capability probe uses select().limit(1), not head/count",
    /\.select\(SENTINEL_COLUMN\)\.limit\(1\)/.test(cap) && !/head:\s*true/.test(cap));
  t("⚠ a missing column is reported as unapplied schema, not as an outage",
    /42703/.test(cap));
  t("⚠ no localStorage or JSON fallback anywhere in the funnel",
    !/localStorage|sessionStorage|writeFileSync/.test(cap + panel));
  t("⚠ the CTA is replaced by an honest line when it cannot store",
    /canRegister \?/.test(panel) && /interestUnavailable/.test(panel));
}

console.log("\n=== 6. the proposed schema, and its erasure ===");
{
  const P = "supabase/migrations/_PROPOSED_tuition_subject_interest.sql";
  t("the proposed file exists", existsSync(P));
  const sql = readFileSync(P, "utf8");
  /**
   * ⚠ SQL COMMENTS STRIPPED. This file EXPLAINS in prose that it could have
   * been a CREATE TABLE and was deliberately not; a raw scan reads that
   * explanation as the thing it is warning about. Ninth time in this repo.
   */
  const sqlCode = sql.replace(/^\s*--.*$/gm, " ");
  t("⚠ it is UNNUMBERED and says it is not applied",
    !/^\d{4}_/.test(P.split("/").pop() ?? "") && /NOT APPLIED/.test(sql));
  /**
   * ⚠ AN ALTER, NOT A SECOND LEAD STORE. interest_registrations is live and
   * already takes inserts; a parallel table would split real leads in two.
   */
  t("⚠ it ALTERs the existing table rather than creating a parallel one",
    /ALTER TABLE public\.interest_registrations/.test(sqlCode) && !/CREATE TABLE/.test(sqlCode));
  t("override 4 — the erase_user extension is in the SAME file",
    /ERASE_USER/.test(sql) && /DELETE FROM public\.interest_registrations WHERE user_id = p_user_id/.test(sql));
  t("⚠ and it also reaches rows with no account, matched by email",
    /user_id IS NULL AND lower\(email\)/.test(sql));
  t("override 8 — marketing consent is separate and defaults false",
    /consent_to_marketing boolean NOT NULL DEFAULT false/.test(sql));
  t("§12 — the upsert key is partial on user_id and includes the mode",
    /interest_registrations_one_per_user_subject_mode/.test(sql)
      && /\(user_id, subject, tuition_mode\)/.test(sql) && /WHERE user_id IS NOT NULL/.test(sql));
  t("⚠ 'withdrawn' is added to the status vocabulary it would otherwise violate",
    /'duplicate', 'withdrawn'/.test(sql));
  t("⚠ UPDATE is column-level — RLS filters rows, never columns",
    /GRANT UPDATE \(/.test(sql) && /REVOKE UPDATE ON public\.interest_registrations FROM authenticated/.test(sql));
  t("the three dangerous privileges are revoked",
    /REVOKE TRUNCATE, TRIGGER, REFERENCES/.test(sql));
  t("every verification step returns a count",
    (sql.match(/EXPECT \d+/g) ?? []).length >= 5);
}

console.log("\n=== 7. guards that must still hold ===");
{
  const avail = readFileSync("src/lib/tuition/availability.ts", "utf8");
  /**
   * ⚠ availabilityFor IS CALLED, NEVER MODIFIED. It is what flips every CTA.
   */
  t("⚠ availabilityFor still derives from status AND enrolmentUrl",
    /status === "enrolling"/.test(avail) && /enrolmentUrl/.test(avail));
  const subjects = code(readFileSync("src/lib/tuition/subjects.ts", "utf8"));
  t("⚠ the subject model CALLS availabilityFor rather than reimplementing it",
    /availabilityFor\(/.test(subjects));
  t("§30 — no Stripe product/price was invented for a coming-soon subject",
    !/prod_|price_/.test(subjects + code(readFileSync("src/components/tuition/SubjectComingSoon.tsx", "utf8"))));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
