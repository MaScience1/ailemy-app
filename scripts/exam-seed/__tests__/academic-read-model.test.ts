/**
 * The academic read model may not claim more than the marks support.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/academic-read-model.test.ts
 *
 * ============================================================================
 * ⚠ THE DEFECT THIS EXISTS FOR HAS ALREADY SHIPPED ONCE, ONE LAYER UP
 * ============================================================================
 * gradeFor() was handed a Tier-1-only numerator and an 80-mark denominator: a
 * candidate who answered every question correctly would have been placed at the
 * bottom of the grade ladder and told it as a grade. The arithmetic was valid.
 * The measure was of the MARKING ENGINE'S COVERAGE, reported to the student as
 * their performance.
 *
 * masteryFor() and performanceFor() aggregate the same rows across papers, so
 * the same mistake is available to them per topic. Guard 3 is the one that
 * catches it, and it has been watched to fail.
 *
 * ⚠ EVERY THRESHOLD IS IMPORTED, NEVER RETYPED. A test that hardcodes 0.75
 * keeps passing when the constant moves and stops testing the code. The
 * fixtures below are built FROM the exported constants so a change to either
 * one moves the expectations with it — the rule AGENTS.md states as "any model
 * that stands in for production data has to be re-derived when it changes".
 */
import {
  completionFor,
  performanceFor,
  masteryFor,
  insufficientReason,
  masteryPercent,
  evidenceConfidenceFor,
  MASTERY_EVIDENCE_FLOOR_MARKS,
  MASTERY_SECURE_AT,
  MASTERY_DEVELOPING_AT,
  EVIDENCE_HIGH_AT_MARKS,
  type AssessedQuestion,
} from "../../../src/lib/account/academic.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const FLOOR = MASTERY_EVIDENCE_FLOOR_MARKS;

/** A question the marker handled. */
const ok = (id: string, awarded: number, outOf: number): AssessedQuestion =>
  ({ questionId: id, attemptId: "a1", awardedMarks: awarded, assessedOutOf: outOf, maxMarks: outOf });

/** A question the marker could NOT handle. Full tariff, no award. */
const unmarked = (id: string, tariff: number): AssessedQuestion =>
  ({ questionId: id, attemptId: "a1", awardedMarks: null, assessedOutOf: null, maxMarks: tariff });

// ============================================================================
console.log("\n=== 1. the three shapes stay three shapes (§21) ===");
// ============================================================================
{
  const c = completionFor(
    [{ lessonId: "l1", completed: true, watchedSeconds: 600 },
     { lessonId: "l2", completed: false, watchedSeconds: 120 }],
    1,
  );
  t("completion counts completed lessons, not watched ones", c.lessonsCompleted === 1, c.lessonsCompleted);
  t("...and reports seconds separately, never folded into the count",
    c.watchedSeconds === 720, c.watchedSeconds);
  t("⚠ the denominator is what EXISTS (1 of 375 written), not what is planned",
    c.lessonsAvailable === 1, c.lessonsAvailable);

  // ⚠ ASSERTED ON THE KEYS THEMSELVES, so a field added later that blends the
  // three shapes fails this without anybody remembering to update the test.
  t("completion carries no ratio, score or percentage field",
    !Object.keys(c).some((k) => /percent|ratio|score|overall|progress/i.test(k)),
    Object.keys(c).join(", "));
}

// ============================================================================
console.log("\n=== 2. performance is mark-weighted (§95) ===");
// ============================================================================
{
  // One 1-mark MCQ right, one 6-mark question 2/6. Marks say 3/7, questions
  // say "half of them" — and the marks are the honest answer.
  const p = performanceFor([ok("q1", 1, 1), ok("q2", 2, 6)]);
  t("awarded is the sum of marks, not of questions", p.awarded === 3, p.awarded);
  t("...and the denominator too", p.assessedOutOf === 7, p.assessedOutOf);
  t("⚠ NOT the question count — 3/7 by marks, which is not 1/2 by questions",
    p.awarded / p.assessedOutOf !== 0.5, `${p.awarded}/${p.assessedOutOf}`);
}

// ============================================================================
console.log("\n=== 3. ⚠ AN UNASSESSED QUESTION CONTRIBUTES NOTHING, NOT A ZERO ===");
// ============================================================================
{
  const withUnmarked = performanceFor([ok("q1", 5, 6), unmarked("q2", 20)]);
  const withoutIt = performanceFor([ok("q1", 5, 6)]);

  t("the assessed figures are IDENTICAL with and without the unmarked question",
    withUnmarked.awarded === withoutIt.awarded
      && withUnmarked.assessedOutOf === withoutIt.assessedOutOf,
    `${withUnmarked.awarded}/${withUnmarked.assessedOutOf} vs ${withoutIt.awarded}/${withoutIt.assessedOutOf}`);

  t("⚠ its 20-mark tariff is NOT in the denominator — that was gradeFor's defect",
    withUnmarked.assessedOutOf === 6, withUnmarked.assessedOutOf);

  t("...but it IS counted as unassessed, so the shortfall is visible",
    withUnmarked.questionsUnassessed === 1, withUnmarked.questionsUnassessed);

  t("...and tariffAttempted keeps the full 26, so coverage can be stated honestly",
    withUnmarked.tariffAttempted === 26, withUnmarked.tariffAttempted);

  // A half-broken row invents the missing half if it is counted at all.
  const halfBroken = performanceFor([
    { questionId: "q9", attemptId: "a1", awardedMarks: 4, assessedOutOf: null, maxMarks: 6 },
  ]);
  t("a row with an award and no assessed tariff is skipped, not half-counted",
    halfBroken.awarded === 0 && halfBroken.questionsUnassessed === 1,
    `${halfBroken.awarded} / unassessed ${halfBroken.questionsUnassessed}`);
}

// ============================================================================
console.log("\n=== 4. mastery refuses before it guesses (§96) ===");
// ============================================================================
{
  const noTopics = masteryFor({ questions: [ok("q1", 6, 6)], topics: [] });
  t("no topic mapping at all → unavailable, with a reason",
    noTopics.available === false && noTopics.reason.length > 20,
    noTopics.available === false ? noTopics.reason : "AVAILABLE");

  const noneMapped = masteryFor({
    questions: [ok("q1", 6, 6)],
    topics: [{ questionId: "SOMEONE-ELSES-QUESTION", topic: "Bonding" }],
  });
  t("⚠ a mapping that matches NO attempted question → unavailable, not an empty table",
    noneMapped.available === false,
    noneMapped.available === true ? `${noneMapped.rows.length} rows` : "unavailable");

  // The positive control: the same call with a matching mapping succeeds. Without
  // it, both results above are consistent with a function that never returns rows.
  const works = masteryFor({
    questions: [ok("q1", 6, 6)],
    topics: [{ questionId: "q1", topic: "Bonding" }],
  });
  t("CONTROL — a matching mapping DOES produce a row",
    works.available === true, works.available === false ? works.reason : "ok");
}

// ============================================================================
console.log("\n=== 5. ⚠ THE EVIDENCE FLOOR IS CHECKED BEFORE THE RATIO (§22) ===");
// ============================================================================
{
  // Full marks, below the floor. Ratio 1.0; evidence still too thin to rate.
  const thin = FLOOR - 1;
  const perfectButThin = masteryFor({
    questions: [ok("q1", thin, thin)],
    topics: [{ questionId: "q1", topic: "Bonding" }],
  });
  const row = perfectButThin.available === true ? perfectButThin.rows[0] : null;

  t(`${thin}/${thin} — a perfect ratio below the ${FLOOR}-mark floor is INSUFFICIENT, not secure`,
    row?.state === "insufficient", row?.state);
  t("...and it says how many marks short", row?.marksShortOfFloor === 1, row?.marksShortOfFloor);
  t("...in a sentence that names the number rather than saying 'not enough'",
    row !== null && insufficientReason(row).includes("1 more"),
    row ? insufficientReason(row) : "no row");

  // One more mark of evidence, same perfect ratio, and it may now be rated.
  const atFloor = masteryFor({
    questions: [ok("q1", FLOOR, FLOOR)],
    topics: [{ questionId: "q1", topic: "Bonding" }],
  });
  const atRow = atFloor.available === true ? atFloor.rows[0] : null;
  t(`CONTROL — at exactly ${FLOOR} marks the same ratio IS rated`,
    atRow?.state === "secure", atRow?.state);
}

// ============================================================================
console.log("\n=== 6. the bands are the exported constants, not retyped ===");
// ============================================================================
{
  // Built FROM the constants: floor-sized samples landing just each side of
  // each threshold. If a constant moves, these move with it.
  const band = (ratio: number) => {
    const outOf = FLOOR * 4;
    const awarded = Math.round(ratio * outOf);
    const v = masteryFor({
      questions: [ok("q1", awarded, outOf)],
      topics: [{ questionId: "q1", topic: "Bonding" }],
    });
    return v.available === true ? v.rows[0].state : "UNAVAILABLE";
  };

  t(`at ${MASTERY_SECURE_AT} → secure`, band(MASTERY_SECURE_AT) === "secure", band(MASTERY_SECURE_AT));
  t("just under it → developing, not secure",
    band(MASTERY_SECURE_AT - 0.02) === "developing", band(MASTERY_SECURE_AT - 0.02));
  t(`at ${MASTERY_DEVELOPING_AT} → developing`,
    band(MASTERY_DEVELOPING_AT) === "developing", band(MASTERY_DEVELOPING_AT));
  t("just under it → emerging", band(MASTERY_DEVELOPING_AT - 0.02) === "emerging",
    band(MASTERY_DEVELOPING_AT - 0.02));

  t("⚠ the two thresholds are ordered — secure above developing",
    MASTERY_SECURE_AT > MASTERY_DEVELOPING_AT, `${MASTERY_SECURE_AT} vs ${MASTERY_DEVELOPING_AT}`);
}

// ============================================================================
console.log("\n=== 7. unmapped and unassessed questions never become a topic ===");
// ============================================================================
{
  const v = masteryFor({
    questions: [
      ok("mapped", FLOOR, FLOOR),
      ok("unmapped", 0, 30),          // real marks, no topic
      unmarked("mapped-unmarked", 40), // has a topic, no assessment
    ],
    topics: [
      { questionId: "mapped", topic: "Bonding" },
      { questionId: "mapped-unmarked", topic: "Bonding" },
    ],
  });
  const rows = v.available === true ? v.rows : [];

  t("⚠ an unmapped question is DROPPED, never bucketed as 'Other'",
    !rows.some((r) => /other|unknown|misc/i.test(r.topic)), rows.map((r) => r.topic).join(", "));
  t("...and its 30 marks are nowhere in the totals",
    rows.reduce((n, r) => n + r.outOf, 0) === FLOOR,
    rows.map((r) => `${r.topic} ${r.awarded}/${r.outOf}`).join(", "));
  t("⚠ a MAPPED but unassessed question adds no zero to its topic",
    rows[0]?.outOf === FLOOR && rows[0]?.state === "secure",
    `${rows[0]?.awarded}/${rows[0]?.outOf} ${rows[0]?.state}`);
}

// ============================================================================
console.log("\n=== 8. §22 as amended: a percentage only where the floor is met ===");
// ============================================================================
// The original guard here asserted NO percent field could exist. The 2026-09-03
// amendment (owner decision, Service 3 Mastery work) replaced that with a
// narrower rule this section now pins: percent is null below the floor, is
// masteryPercent's figure at or above it, and always travels with the marks
// and an evidence-confidence label that never adjusts it.
{
  const v = masteryFor({
    questions: [ok("q1", FLOOR, FLOOR * 2)],
    topics: [{ questionId: "q1", topic: "Bonding" }],
  });
  const row = v.available === true ? v.rows[0] : null;
  t("at the floor the row carries masteryPercent's figure",
    row?.percent === masteryPercent(FLOOR, FLOOR * 2), row?.percent);
  t("...and the marks that produced it travel with it",
    row?.awarded === FLOOR && row?.outOf === FLOOR * 2, `${row?.awarded}/${row?.outOf}`);
  t("...and an evidence-confidence label rides beside it",
    row?.evidenceConfidence === evidenceConfidenceFor(FLOOR * 2), row?.evidenceConfidence);

  const under = masteryFor({
    questions: [ok("q1", FLOOR - 1, FLOOR - 1)],
    topics: [{ questionId: "q1", topic: "Bonding" }],
  });
  const urow = under.available === true ? under.rows[0] : null;
  t("below the floor percent is null — even at 100% raw",
    urow !== null && urow.percent === null, urow?.percent);

  t("masteryPercent refuses below the floor", masteryPercent(5, FLOOR - 1) === null);
  t("masteryPercent rounds to a whole percent (no false precision)",
    masteryPercent(1, FLOOR) === Math.round((1 / FLOOR) * 100));
  t("confidence bands: one under the bar is limited, at the bar is high",
    evidenceConfidenceFor(EVIDENCE_HIGH_AT_MARKS - 1) === "limited" &&
    evidenceConfidenceFor(EVIDENCE_HIGH_AT_MARKS) === "high");
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
