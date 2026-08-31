/**
 * THE SLUG-CLASH PATH AT bulk-import-papers.ts:1421. Nothing covered it, and it
 * is now load-bearing for eight real sittings.
 *
 * ============================================================================
 * ⚠ WHAT IT PROTECTS. An IAL slug is `unit-N-session-year` — it carries the
 * unit, never the entry. When one sitting publishes two entry variants (WMA11/01
 * and WMA11/01A, or /01 and /01R) they are DIFFERENT papers that mint the SAME
 * slug. Without the clash branch the second would reach the insert and lose to
 * a unique-constraint violation, or overwrite the first, with nothing recorded.
 *
 * ⚠ THIS PATH HAD NEVER RUN IN PRODUCTION. All 233 existing IAL papers come
 * from a single entry code — 241 (unit, session, year) groups, zero with a
 * second entry. The 2024 and 2025 May-June Maths sittings are the first to
 * publish variants, so the branch went from theoretical to load-bearing without
 * ever being exercised or tested.
 *
 * ⚠ WHY THIS ASSERTS ON SOURCE. planRows is not exported and reaching it needs
 * loadCatalogue, a live database and a service-role key. A test must not hold
 * that key, so the shape is asserted against the source text — the same
 * approach import-catalogue.test.ts already uses for its guarded-lookup checks.
 * Comments are stripped first, so a promise in prose cannot satisfy it.
 *
 * ⚠ SABOTAGE-PROVEN. Deleting the `continue` at :1429 reds assertion 4.
 */
import { readFileSync } from "node:fs";

import { SUBJECTS } from "../../bulk-import-papers.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

/** Comments stripped: a guard described in prose must not satisfy these. */
const src = readFileSync("scripts/bulk-import-papers.ts", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

console.log("\n=== the clash branch exists and behaves ===");

/** Restated for R34: the lookup now carries the course, asserted exactly in 8. */
t("⚠ 1. the slug is looked up against rows already planned in this run",
  /const clash = bySlug\.get\(/.test(src), "no bySlug.get(...) lookup found");

t("⚠ 2. a clash pushes a SKIP rather than throwing or inserting",
  /if \(clash\) \{[\s\S]{0,400}skips\.push\(/.test(src), "no skips.push inside if (clash)");

/**
 * ⚠ THE REASON MUST NAME THE WINNER. "duplicate slug" would tell an operator a
 * paper was dropped but not which file replaced it, and with two variants of
 * one sitting that is the only fact that matters.
 */
t("⚠ 3. the skip reason names the WINNING file, not just the slug",
  /reason: `slug \$\{slug\} already claimed in this run by \$\{clash\.questionPaper\.fileName\}`/.test(src),
  "reason does not interpolate clash.questionPaper.fileName");

/**
 * ⚠ THE `continue` IS THE WHOLE GUARD. Without it execution falls through and
 * the losing group is pushed as a second row with the same slug — the failure
 * the branch exists to prevent. This is the assertion the sabotage removes.
 */
t("⚠ 4. it CONTINUES, so the loser never becomes a row",
  /if \(clash\) \{[\s\S]{0,400}continue;[\s\S]{0,20}\}/.test(src),
  "no continue inside if (clash)");

/**
 * ⚠ EVERY COMPONENT OF THE LOSER IS SKIPPED, not only its question paper.
 * Skipping the QU alone would leave its MS and ER unaccounted for, and the run
 * arithmetic would stop closing.
 */
t("⚠ 5. ALL components of the losing group are skipped, not only the QU",
  /if \(clash\) \{\s*for \(const f of all\)/.test(src),
  "the clash branch does not iterate `all`");

/** Restated for R34: both sides now use slugKey(resolved.courseId, slug). */
t("⚠ 6. the branch sits BEFORE the row is pushed",
  src.indexOf("const clash = bySlug.get(") < src.indexOf("bySlug.set("),
  "clash check appears after bySlug.set");

console.log("\n=== the clash key is (courseId, slug), not slug alone (R34) ===");

/**
 * ⚠ past_papers ENFORCES UNIQUE (course_id, slug). A slug is unique PER COURSE.
 * The planner's map is the mirror of that constraint and must use the same key,
 * or it treats two rows in DIFFERENT courses as a clash and discards one.
 *
 * ⚠ THIS IS NOT HYPOTHETICAL. IAL Maths numbers units per course — AS 1-5,
 * A2 1-6 — so `unit-1-may-june-2025` is legitimately minted by WMA11 (P1, AS)
 * AND WMA13 (P3, A2). Keyed on slug alone the planner skipped P3, P4, M2, S1,
 * S2 and FP2 as duplicates of unrelated AS units: 114 components lost.
 *
 * ⚠ SCIENCE CANNOT EXERCISE THIS. It numbers 1-6 continuously across AS and A2,
 * so no Science slug ever collides across courses. 233 papers went through the
 * broken path without once triggering it.
 */
t("⚠ 7. the map is keyed on courseId AND slug",
  /const slugKey = \(courseId: string, slug: string\) => `\$\{courseId\}::\$\{slug\}`;/.test(src),
  "no slugKey(courseId, slug) helper");

t("⚠ 8. the clash LOOKUP uses the composite key",
  /const clash = bySlug\.get\(slugKey\(resolved\.courseId, slug\)\);/.test(src),
  "clash lookup is not keyed on courseId");

t("⚠ 9. the row is STORED under the composite key",
  /bySlug\.set\(slugKey\(resolved\.courseId, slug\), row\);/.test(src),
  "row is not stored under the composite key");

/**
 * ⚠ AND THE CONDITION IS REAL, so none of the above is vacuous. If no two
 * courses ever minted the same slug, the composite key would be untestable
 * decoration. This asserts from SUBJECTS that the collision genuinely exists.
 */
{
  const byCourse: Record<string, number[]> = {};
  for (const cfg of Object.values(SUBJECTS))
    for (const i of Object.values(cfg.paperCodes))
      if (i.unitNumber !== undefined) (byCourse[i.courseSlug] ||= []).push(i.unitNumber);
  const pairs: [string, string][] = [
    ["edexcel-ial-as-mathematics", "edexcel-ial-a2-mathematics"],
    ["edexcel-ial-as-further-mathematics", "edexcel-ial-a2-further-mathematics"],
  ];
  const overlapping = pairs.filter(([a, b]) =>
    (byCourse[a] ?? []).some((u) => (byCourse[b] ?? []).includes(u)));
  t("⚠ 10. AS and A2 Maths really do share unit numbers (the guard is not vacuous)",
    overlapping.length === 2,
    overlapping.map(([a]) => a).join(", "));

  /** …while Science does not, which is exactly why it never caught this. */
  const sci: [string, string][] = [
    ["edexcel-ial-as-chemistry", "edexcel-ial-a2-chemistry"],
    ["edexcel-ial-as-physics", "edexcel-ial-a2-physics"],
    ["edexcel-ial-as-biology", "edexcel-ial-a2-biology"],
  ];
  const sciOverlap = sci.filter(([a, b]) =>
    (byCourse[a] ?? []).some((u) => (byCourse[b] ?? []).includes(u)));
  t("⚠ 11. Science AS/A2 share NO unit number, so it can never exercise this path",
    sciOverlap.length === 0, sciOverlap.map(([a]) => a).join(", "));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
