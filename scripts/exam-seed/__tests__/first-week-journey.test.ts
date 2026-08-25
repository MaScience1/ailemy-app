/**
 * THE FIRST WEEK A PAYING STUDENT ACTUALLY HAS.
 *
 * ============================================================================
 * ⚠ THREE DEFECTS A STUDENT HITS BETWEEN 13 AND 15 SEPTEMBER.
 * ============================================================================
 * A · every link on /profile led back to the catalogue root, including the one
 *     labelled "Continue course →"
 * B · student_courses has one SELECT and zero writes, so "My courses" is
 *     permanently empty for everybody who pays
 * C · a full cohort set is_public=false — the obvious admin action once 20
 *     seats are gone — blanked the calendar of every student enrolled on it
 *
 * ⚠ THESE ASSERT BEHAVIOUR. The deep link is checked as a resolved URL over
 * every shape of input, not as a string in JSX; the is_public fix is checked at
 * both filters, because fixing one and not the other looks fixed and is not.
 */
import { readFileSync } from "node:fs";

import { continueHref, isDeepLink, CATALOGUE_ROOT } from "../../../src/lib/account/continue-href.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

console.log("\n=== A · the deep link resolves, over every shape of input ===");
{
  const full = { subjectSlug: "chemistry", pathway: "international-a-level",
                 courseSlug: "edexcel-ial-as-chemistry", liveLessonSlug: "definitions-formulae-and-the-mole" };

  t("⚠ a course with a published lesson links straight to that lesson",
    continueHref(full) === "/learn/chemistry/international-a-level/edexcel-ial-as-chemistry/definitions-formulae-and-the-mole",
    continueHref(full));

  /**
   * ⚠ THE FAILURE THIS PREVENTS. 1 of 82 lessons is published. A link built
   * from the course alone would happily point at a coming_soon lesson, and the
   * student would land on "We're organising this lesson now" with a disabled
   * Notify me button — which reads as "my course is empty", not "wrong turn".
   */
  t("⚠ no published lesson falls back to the lessons INDEX, never a guessed lesson",
    continueHref({ ...full, liveLessonSlug: null })
      === "/learn/chemistry/international-a-level/edexcel-ial-as-chemistry/lessons",
    continueHref({ ...full, liveLessonSlug: null }));

  for (const [name, patch] of [
    ["subject", { subjectSlug: null }],
    ["pathway", { pathway: null }],
    ["course", { courseSlug: null }],
  ] as const) {
    t(`a missing ${name} degrades to the catalogue root, never a broken URL`,
      continueHref({ ...full, ...patch }) === CATALOGUE_ROOT,
      continueHref({ ...full, ...patch }));
  }

  t("⚠ the resolved href is a real deep link, not the root",
    isDeepLink(continueHref(full)) && !isDeepLink(CATALOGUE_ROOT));

  /**
   * ⚠ AND THE COMPONENT USES IT. MyCourses hardcoded href={`/learn`} on the
   * Continue button; a pure-function test alone would have passed against that
   * unchanged component.
   */
  const my = code(readFileSync("src/components/account/MyCourses.tsx", "utf8"));
  t("⚠ MyCourses renders the row's own destination", /href=\{c\.continueHref\}/.test(my));
  t("⚠ and no longer hardcodes the root on the Continue control",
    !/href=\{`\/learn`\}/.test(my));

  const reader = code(readFileSync("src/lib/account/profile-reader.ts", "utf8"));
  t("the reader derives it, so the component cannot guess wrong",
    /continueHref\(\{/.test(reader) && /liveLessonSlug:/.test(reader));
  t("⚠ and it resolves the FIRST live lesson by lesson_number, not by row order",
    /lesson_number/.test(reader) && /firstLive/.test(reader));
}

console.log("\n=== B · the founder paste writes BOTH rows ===");
{
  const sql = readFileSync("ENROLMENT_PASTE.sql", "utf8");
  const exec = sql.replace(/^\s*--[^\n]*$/gm, " ");

  t("the paste inserts a cohort_enrolments row", /INSERT INTO public\.cohort_enrolments/.test(exec));
  t("⚠ and a student_courses row, in the same paste", /INSERT INTO public\.student_courses/.test(exec));

  /**
   * ⚠ THE TRAP, ASSERTED. student_courses.student_id REFERENCES profiles(id),
   * not auth.users(id). Joining auth.users and using u.id inserts against an id
   * that satisfies no foreign key — or worse, silently matches nothing and
   * writes no row while reporting success.
   */
  t("⚠ student_id comes from profiles, NOT auth.users",
    /INSERT INTO public\.student_courses[\s\S]{0,400}JOIN public\.profiles p ON p\.id = u\.id/.test(exec)
    && /SELECT p\.id, c\.id/.test(exec));

  t("⚠ the course row has its own positive control", /course_row_present/.test(sql));
  t("no ON CONFLICT — a second run must collide visibly",
    !/student_courses[\s\S]{0,300}ON CONFLICT/.test(exec));
  t("still no destructive verb anywhere in the executable SQL",
    !/\b(DELETE|DROP|TRUNCATE|ALTER)\b/i.test(exec));
}

console.log("\n=== C · a full cohort must not blank its students' calendars ===");
{
  const pub = code(readFileSync("src/lib/public/readers.ts", "utf8"));
  const sch = code(readFileSync("src/lib/schedule/readers.ts", "utf8"));
  const stu = code(readFileSync("src/lib/booking/student.ts", "utf8"));

  /**
   * ⚠ BOTH FILTERS, OR NEITHER. There were two independent `.eq("is_public",
   * true)` reads on the path to a student's own sessions — the catalogue list
   * and the cohort_id→slug map. Fixing one leaves the calendar just as blank,
   * and the code looks correct. This fails unless both are entitlement-aware.
   */
  t("⚠ the catalogue read is entitlement-aware", /entitledSlugs/.test(pub) && /is_public\.eq\.true,slug\.in\./.test(pub));
  t("⚠ the cohort id→slug map is entitlement-aware TOO",
    /entitledSlugs/.test(sch) && /is_public\.eq\.true,slug\.in\./.test(sch));
  t("⚠ neither read still filters is_public unconditionally",
    !/\.eq\("is_public", true\)/.test(pub) && !/\.eq\("is_public", true\)/.test(sch));

  t("⚠ the student's OWN enrolled slugs are what is passed",
    /entitledSlugs:\s*slugs/.test(stu));

  /**
   * ⚠ AND IT IS NOT AN AUTHORISATION HOLE. The slugs come from the viewer's own
   * cohort_enrolments read; the widened query only runs under a client that has
   * a session. An anon caller passes nothing and gets the public catalogue.
   */
  t("⚠ the widened read requires an authenticated client",
    /createServerClient\(\)/.test(pub) && /entitled\.length > 0 \?/.test(pub));
  t("slugs are validated before interpolation — no injection into the filter",
    /\/\^\[a-z0-9-\]\+\$\/\.test/.test(pub) && /\/\^\[a-z0-9-\]\+\$\/\.test/.test(sch));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
