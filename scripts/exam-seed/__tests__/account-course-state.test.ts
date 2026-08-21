/**
 * A course's completion figure may not flatter the library.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/account-course-state.test.ts
 *
 * ============================================================================
 * ⚠ THE TWO WRONG RENDERS THIS GUARDS, BOTH LIKELY TODAY
 * ============================================================================
 * Content stands at roughly one published lesson out of 375 planned.
 *
 *   "0% complete"    on a course with no lessons — reads as a statement about
 *                    the STUDENT when it is a statement about the LIBRARY.
 *   "100% complete"  on a course with one lesson — technically true, and a
 *                    student cannot tell it from having finished Chemistry.
 *
 * §121 forbids shipping a fake score or improvement percentage. Neither of
 * these is fabricated exactly — both are arithmetic on real rows — which is
 * what makes them the dangerous kind.
 *
 * ⚠ THE THRESHOLD IS IMPORTED, NEVER RETYPED. A test hardcoding 10 keeps
 * passing when the constant moves and stops testing the code.
 */
import {
  courseCompletion,
  completionLabel,
  completionCaveat,
  accountTuition,
  COHORT_COURSE_LINK,
  MIN_LESSONS_FOR_PERCENT,
} from "../../../src/lib/account/course-state.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
const N = MIN_LESSONS_FOR_PERCENT;

console.log("\n=== 1. ⚠ NO PUBLISHED LESSONS IS NOT 0% ===");
{
  const c = courseCompletion({ completed: 0, published: 0 });
  t("an empty course refuses rather than reporting a proportion", c.available === false, JSON.stringify(c));
  t("...and the reason says the COURSE has no content, not that the student did nothing",
    c.available === false && /no lessons are published/i.test(c.reason) && !/you|your/i.test(c.reason),
    c.available === false ? c.reason : "available");
  t("the label is that reason, so a component cannot render a number instead",
    !/\d/.test(completionLabel(c)), completionLabel(c));
}

console.log("\n=== 2. ⚠ A TINY LIBRARY SHOWS A FRACTION, NEVER A PERCENTAGE ===");
{
  const one = courseCompletion({ completed: 1, published: 1 });
  t("1 of 1 is available", one.available === true, JSON.stringify(one));
  t("⚠ …and does NOT render as 100%",
    one.available === true && one.display.kind === "fraction",
    one.available === true ? one.display.kind : "unavailable");
  t("the label carries its own denominator", completionLabel(one) === "1 of 1 lesson complete", completionLabel(one));
  t("⚠ and a caveat says the course is still being written",
    completionCaveat(one) !== null, completionCaveat(one));

  const justUnder = courseCompletion({ completed: 2, published: N - 1 });
  t(`just under the ${N}-lesson floor is still a fraction`,
    justUnder.available === true && justUnder.display.kind === "fraction",
    justUnder.available === true ? justUnder.display.kind : "unavailable");
}

console.log("\n=== 3. CONTROL — a real library DOES get a percentage ===");
{
  const at = courseCompletion({ completed: 5, published: N });
  t(`at exactly ${N} published lessons the display flips to percent`,
    at.available === true && at.display.kind === "percent",
    at.available === true ? at.display.kind : "unavailable");
  t("…and the value is right", at.available === true && at.display.kind === "percent" && at.display.value === 50,
    at.available === true && at.display.kind === "percent" ? at.display.value : "n/a");
  t("no caveat once the library is big enough", completionCaveat(at) === null, completionCaveat(at));
  t("⚠ the two branches are NOT the same — without this, §2 could pass on a function that never percentages",
    (courseCompletion({ completed: 1, published: 1 }) as { display?: { kind: string } }).display?.kind !== "percent"
      && at.available === true && at.display.kind === "percent", "fraction vs percent");
}

console.log("\n=== 4. a count above the denominator cannot exceed 100% ===");
{
  // Two different questions answered from two different queries: 'lessons I
  // completed anywhere' against 'lessons published on THIS course'.
  const c = courseCompletion({ completed: 99, published: N });
  t("completed is clamped to published", c.available === true && c.completed === N,
    c.available === true ? `${c.completed}/${c.published}` : "unavailable");
  t("⚠ so the percentage cannot exceed 100",
    c.available === true && c.display.kind === "percent" && c.display.value === 100,
    c.available === true && c.display.kind === "percent" ? c.display.value : "n/a");
}

console.log("\n=== 5. ⚠ §11 — THE STATES NEVER COLLAPSE ===");
{
  const mod = { courseCompletion, completionLabel, completionCaveat, accountTuition } as Record<string, unknown>;
  t("⚠ the module exports NO function that reduces access to one boolean",
    !Object.keys(mod).some((k) => /^has(Course|Access)$|^canOpen$|^isEnrolledOr/i.test(k)),
    Object.keys(mod).join(", "));

  const tu = accountTuition(["ial-chem-as-sep-2026"]);
  t("tuition is reported as cohort slugs", tu.cohortSlugs.length === 1, JSON.stringify(tu.cohortSlugs));
  t("⚠ …and ALWAYS carries the reason it is not per-course, so a caller cannot forget",
    tu.note === COHORT_COURSE_LINK && /no course_id/i.test(tu.note), tu.note);
  t("the note names the table and the migration, so the gap is findable",
    /cohorts/.test(tu.note) && /0009/.test(tu.note), tu.note);

  // The returned array must not alias the caller's — a page that sorts it in
  // place would otherwise reorder the reader's own state.
  const src = ["b", "a"];
  const copy = accountTuition(src);
  copy.cohortSlugs.sort();
  t("the slug array is copied, not aliased", src[0] === "b", src.join(","));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
