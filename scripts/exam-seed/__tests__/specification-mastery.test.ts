/**
 * The Specification Explorer's domain layer may not claim more than the
 * marks support — and its recommendations must be checkable from the numbers.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/specification-mastery.test.ts
 *
 * ============================================================================
 * ⚠ EVERY THRESHOLD IS IMPORTED, NEVER RETYPED (AGENTS.md)
 * ============================================================================
 * The fixtures are built FROM the exported constants, so a change to the
 * 12-mark floor or the 0.5/0.75 bands moves the expectations with it. The one
 * place a number is typed out is where the test asserts a DERIVED value a
 * constant cannot express (a sum of two fixture rows).
 *
 * buildCourseMastery is an ADAPTER over academic.ts's masteryFor — these
 * tests assert the adapter's own contracts (unstarted vs insufficient, the
 * topic re-bucketing, malformed/foreign evidence set aside and counted), not
 * academic.ts's, which academic-read-model.test.ts already owns.
 */

import {
  MASTERY_EVIDENCE_FLOOR_MARKS,
  MASTERY_SECURE_AT,
  MASTERY_DEVELOPING_AT,
  EVIDENCE_HIGH_AT_MARKS,
  masteryPercent,
} from "../../../src/lib/account/academic.ts";
import { buildCourseMastery, unstartedFacts } from "../../../src/lib/specification/mastery.ts";
import { recommendNext } from "../../../src/lib/specification/recommend.ts";
import { compareSpecCodes } from "../../../src/lib/specification/codes.ts";
import type {
  MasteryEvidenceRow,
  SpecUnitNode,
} from "../../../src/lib/specification/types.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const FLOOR = MASTERY_EVIDENCE_FLOOR_MARKS;

// ── fixtures ────────────────────────────────────────────────────────────────

/** A minimal course: one unit, two topics, four points (plus a lesson-less
 *  second unit for ordering tests). */
const point = (code: string, live = false) => ({
  id: `p-${code}`,
  code,
  title: `Point ${code}`,
  description: `Statement for ${code}`,
  commandTerms: [],
  lessons: live ? [{ slug: `lesson-${code}`, title: `Lesson ${code}`, live: true }] : [],
});

const UNITS: SpecUnitNode[] = [
  {
    id: "u1", code: "WCH11", name: "Unit 1",
    topics: [
      { id: "t1", code: "T1", name: "Formulae", points: [point("1.1", true), point("1.2")] },
      { id: "t2", code: "T2", name: "Atomic structure", points: [point("2.1"), point("2.2", true)] },
    ],
  },
  { id: "u2", code: "WCH12", name: "Unit 2", topics: [] },
];

/** n one-mark answers on a code, k of them correct — the exact shape 0065
 *  records (mark_available is always 1 today; the adapter must not assume it).
 *  Defaults to lesson-practice provenance; exam rows override per test. */
const answers = (
  code: string, correct: number, total: number,
  opts?: { attemptId?: string; at?: string; source?: MasteryEvidenceRow["source"]; examConditions?: boolean },
): MasteryEvidenceRow[] =>
  Array.from({ length: total }, (_, i) => ({
    attemptId: opts?.attemptId ?? `a-${code}`,
    qIndex: i,
    specCode: code,
    markAwarded: i < correct ? 1 : 0,
    markAvailable: 1,
    attemptedAt: opts?.at ?? null,
    source: opts?.source ?? "lesson-practice",
    examConditions: opts?.examConditions ?? false,
  }));

// Band fixtures derived from the constants:
const secureCorrect = Math.ceil(FLOOR * MASTERY_SECURE_AT);       // ratio ≥ 0.75 at the floor
const developingCorrect = Math.ceil(FLOOR * MASTERY_DEVELOPING_AT); // ratio ≥ 0.5, and < 0.75 for FLOOR=12
const weakCorrect = Math.max(0, developingCorrect - 1);            // just under the developing band

// ============================================================================
console.log("\n=== 1. no evidence: everything is unstarted, nothing is claimed ===");
// ============================================================================
{
  const m = buildCourseMastery({ units: UNITS, evidence: [] });
  t("byCode is empty", Object.keys(m.byCode).length === 0);
  t("byTopic is empty", Object.keys(m.byTopic).length === 0);
  t("all 4 points counted unstarted", m.summary.unstarted === 4, m.summary.unstarted);
  t("pointsTotal is the specification's size", m.summary.pointsTotal === 4);
  t("no marks claimed", m.summary.awarded === 0 && m.summary.outOf === 0);
  t("nothing ignored", m.ignoredRows === 0);
  t("unstartedFacts is the no-evidence shape",
    unstartedFacts().state === "unstarted" && unstartedFacts().outOf === 0);
}

// ============================================================================
console.log("\n=== 2. the floor separates unstarted from insufficient from rated ===");
// ============================================================================
{
  const m = buildCourseMastery({
    units: UNITS,
    evidence: answers("1.1", 2, FLOOR - 1), // one short of the floor
  });
  const f = m.byCode["1.1"];
  t("below the floor → insufficient, never a band", f?.state === "insufficient", f?.state);
  t("shortfall names the missing marks", f?.marksShortOfFloor === 1, f?.marksShortOfFloor);
  t("the marks facts still travel", f?.awarded === 2 && f?.outOf === FLOOR - 1);
  t("untouched points stay unstarted, not insufficient", m.summary.unstarted === 3);
  t("summary counts it as insufficient", m.summary.insufficient === 1);
}

// ============================================================================
console.log("\n=== 3. the bands are academic.ts's, reached through the adapter ===");
// ============================================================================
{
  const m = buildCourseMastery({
    units: UNITS,
    evidence: [
      ...answers("1.1", weakCorrect, FLOOR),
      ...answers("1.2", developingCorrect, FLOOR),
      ...answers("2.1", secureCorrect, FLOOR),
    ],
  });
  t("under half at the floor → emerging", m.byCode["1.1"]?.state === "emerging", m.byCode["1.1"]?.state);
  t("half exactly → developing (boundary is inclusive)",
    m.byCode["1.2"]?.state === "developing", m.byCode["1.2"]?.state);
  t("three quarters exactly → secure (boundary is inclusive)",
    m.byCode["2.1"]?.state === "secure", m.byCode["2.1"]?.state);
  t("summary bands: 1 emerging, 1 developing, 1 secure, 1 unstarted",
    m.summary.emerging === 1 && m.summary.developing === 1 &&
    m.summary.secure === 1 && m.summary.unstarted === 1);
  t("summary marks are the sums of usable evidence",
    m.summary.awarded === weakCorrect + developingCorrect + secureCorrect &&
    m.summary.outOf === 3 * FLOOR,
    `${m.summary.awarded}/${m.summary.outOf}`);
}

// ============================================================================
console.log("\n=== 4. topic re-bucketing: same evidence, same arithmetic ===");
// ============================================================================
{
  // Two points of topic t1, each below the floor alone, together above it.
  const half = Math.ceil(FLOOR / 2);
  const m = buildCourseMastery({
    units: UNITS,
    evidence: [
      ...answers("1.1", half, half, { attemptId: "a1" }),
      ...answers("1.2", 0, half, { attemptId: "a2" }),
    ],
  });
  t("each point alone is insufficient",
    m.byCode["1.1"]?.state === "insufficient" && m.byCode["1.2"]?.state === "insufficient");
  const topic = m.byTopic["t1"];
  t("their topic pools the marks", topic?.outOf === 2 * half, topic?.outOf);
  t("and the pooled topic IS rated (floor met at topic level)",
    topic?.state === "developing", topic?.state);
  t("the untouched topic has no bucket at all", m.byTopic["t2"] === undefined);
}

// ============================================================================
console.log("\n=== 5. malformed and foreign evidence is set aside and counted ===");
// ============================================================================
{
  const good = answers("1.1", secureCorrect, FLOOR);
  const practice = { source: "lesson-practice" as const, examConditions: false };
  const bad: MasteryEvidenceRow[] = [
    { attemptId: "x", qIndex: 0, specCode: "1.1", markAwarded: -1, markAvailable: 1, attemptedAt: null, ...practice },
    { attemptId: "x", qIndex: 1, specCode: "1.1", markAwarded: 2, markAvailable: 1, attemptedAt: null, ...practice },
    { attemptId: "x", qIndex: 2, specCode: "1.1", markAwarded: 1, markAvailable: 0, attemptedAt: null, ...practice },
    { attemptId: "x", qIndex: 3, specCode: "1.1", markAwarded: NaN, markAvailable: 1, attemptedAt: null, ...practice },
    { attemptId: "x", qIndex: 4, specCode: "9.9", markAwarded: 1, markAvailable: 1, attemptedAt: null, ...practice },
  ];
  const m = buildCourseMastery({ units: UNITS, evidence: [...good, ...bad] });
  t("five rows ignored", m.ignoredRows === 5, m.ignoredRows);
  t("the good evidence still rates", m.byCode["1.1"]?.state === "secure");
  t("ignored rows contribute no marks",
    m.byCode["1.1"]?.outOf === FLOOR && m.summary.outOf === FLOOR);
  t("the foreign code never becomes a bucket", m.byCode["9.9"] === undefined);
}

// ============================================================================
console.log("\n=== 6. lastPractisedAt is the freshest contributing answer ===");
// ============================================================================
{
  const m = buildCourseMastery({
    units: UNITS,
    evidence: [
      ...answers("1.1", 1, 2, { attemptId: "a1", at: "2026-08-01T10:00:00Z" }),
      ...answers("1.1", 1, 2, { attemptId: "a2", at: "2026-08-20T10:00:00Z" }),
    ],
  });
  t("max timestamp wins", m.byCode["1.1"]?.lastPractisedAt === "2026-08-20T10:00:00Z",
    m.byCode["1.1"]?.lastPractisedAt);
}

// ============================================================================
console.log("\n=== 7. recommendNext: four bands, in order, checkable ===");
// ============================================================================
{
  const m = buildCourseMastery({
    units: UNITS,
    evidence: [
      ...answers("1.1", weakCorrect, FLOOR),        // emerging
      ...answers("1.2", developingCorrect, FLOOR),  // developing
      ...answers("2.1", 1, FLOOR - 2),              // insufficient
      // 2.2 unstarted
    ],
  });
  const rec = recommendNext({ units: UNITS, mastery: m, limit: 10 });
  t("order: weak → developing → finish-evidence → not-started",
    rec.map((r) => r.reason).join(",") === "weak,developing,finish-evidence,not-started",
    rec.map((r) => r.reason).join(","));
  t("the weak one is 1.1", rec[0]?.specCode === "1.1");
  t("facts travel with the recommendation", rec[0]?.facts.awarded === weakCorrect);
  t("limit is respected", recommendNext({ units: UNITS, mastery: m, limit: 2 }).length === 2);
  t("limit 0 → nothing", recommendNext({ units: UNITS, mastery: m, limit: 0 }).length === 0);
}

{
  // All rated secure → only not-started remains; live-lesson points float first.
  const m = buildCourseMastery({
    units: UNITS,
    evidence: [
      ...answers("1.1", FLOOR, FLOOR),
      ...answers("1.2", FLOOR, FLOOR),
    ],
  });
  const rec = recommendNext({ units: UNITS, mastery: m, limit: 10 });
  t("secure points are never recommended", rec.every((r) => r.specCode !== "1.1" && r.specCode !== "1.2"));
  t("not-started with a live lesson floats first (2.2 before 2.1)",
    rec[0]?.specCode === "2.2" && rec[1]?.specCode === "2.1",
    rec.map((r) => r.specCode).join(","));
}

{
  // Two emerging points: weakest ratio first.
  const m = buildCourseMastery({
    units: UNITS,
    evidence: [
      ...answers("1.1", weakCorrect, FLOOR),
      ...answers("1.2", Math.max(0, weakCorrect - 1), FLOOR),
    ],
  });
  const rec = recommendNext({ units: UNITS, mastery: m, limit: 2 });
  t("weakest emerging first", rec[0]?.specCode === "1.2" && rec[1]?.specCode === "1.1",
    rec.map((r) => r.specCode).join(","));
}

{
  // Two insufficient points: the one closest to the floor first.
  const m = buildCourseMastery({
    units: UNITS,
    evidence: [
      ...answers("1.1", 1, 2), // far from the floor
      ...answers("1.2", 1, FLOOR - 1), // one mark short
    ],
  });
  const rec = recommendNext({ units: UNITS, mastery: m, limit: 2 });
  t("closest-to-rating first among finish-evidence",
    rec[0]?.specCode === "1.2" && rec[1]?.specCode === "1.1",
    rec.map((r) => r.specCode).join(","));
}

// ============================================================================
console.log("\n=== 8. spec-code ordering is natural, not lexicographic ===");
// ============================================================================
{
  t("1.2 before 1.10", compareSpecCodes("1.2", "1.10") < 0);
  t("1.10 after 1.9", compareSpecCodes("1.10", "1.9") > 0);
  t("equal codes tie", compareSpecCodes("2.3", "2.3") === 0);
  t("2.x after 1.y", compareSpecCodes("2.1", "1.13") > 0);
  const sorted = ["1.10", "1.2", "1.1", "2.1", "1.13"].sort(compareSpecCodes);
  t("a shuffled list sorts into reading order",
    sorted.join(",") === "1.1,1.2,1.10,1.13,2.1", sorted.join(","));
}

// ============================================================================
console.log("\n=== 9. the derivation bites: a moved threshold moves the verdicts ===");
// ============================================================================
{
  // Not a test of a constant's value — a proof this suite is wired to the real
  // one. If someone hardcodes 12 into the adapter, this fails.
  const m = buildCourseMastery({ units: UNITS, evidence: answers("1.1", FLOOR, FLOOR) });
  t("exactly the floor, all correct → rated (floor is not exclusive)",
    m.byCode["1.1"]?.state === "secure", m.byCode["1.1"]?.state);
  const under = buildCourseMastery({ units: UNITS, evidence: answers("1.1", FLOOR - 1, FLOOR - 1) });
  t("one mark under, even at 100% → not rated",
    under.byCode["1.1"]?.state === "insufficient", under.byCode["1.1"]?.state);
}

// ============================================================================
console.log("\n=== 10. §22 as amended: a percentage only where the floor is met ===");
// ============================================================================
{
  const m = buildCourseMastery({
    units: UNITS,
    evidence: [
      ...answers("1.1", 2, FLOOR - 1),           // below the floor
      ...answers("1.2", developingCorrect, FLOOR), // at the floor
    ],
  });
  t("below the floor → percent is null, not 0 and not the raw ratio",
    m.byCode["1.1"]?.percent === null, m.byCode["1.1"]?.percent);
  t("at the floor → percent is masteryPercent's, passed through not recomputed",
    m.byCode["1.2"]?.percent === masteryPercent(developingCorrect, FLOOR),
    m.byCode["1.2"]?.percent);
  t("unstarted facts carry no percent and no confidence claim",
    unstartedFacts().percent === null && unstartedFacts().evidenceConfidence === "none");

  // Confidence bands, derived from the exported constant — never retyped.
  const limited = buildCourseMastery({
    units: UNITS, evidence: answers("1.1", 0, EVIDENCE_HIGH_AT_MARKS - 1),
  });
  const high = buildCourseMastery({
    units: UNITS, evidence: answers("1.1", 0, EVIDENCE_HIGH_AT_MARKS),
  });
  t("one mark under the high bar → limited",
    limited.byCode["1.1"]?.evidenceConfidence === "limited",
    limited.byCode["1.1"]?.evidenceConfidence);
  t("at the high bar → high (boundary inclusive)",
    high.byCode["1.1"]?.evidenceConfidence === "high",
    high.byCode["1.1"]?.evidenceConfidence);
  t("confidence never adjusts the marks or the percent",
    high.byCode["1.1"]?.percent === masteryPercent(0, EVIDENCE_HIGH_AT_MARKS) &&
    high.byCode["1.1"]?.awarded === 0);
}

// ============================================================================
console.log("\n=== 11. bySource counts usable evidence per arm, and only usable ===");
// ============================================================================
{
  const m = buildCourseMastery({
    units: UNITS,
    evidence: [
      ...answers("1.1", 3, 4, { attemptId: "prac" }),
      ...answers("2.1", 2, 3, { attemptId: "exam", source: "exam-paper", examConditions: true }),
      // A malformed exam row: must land in ignoredRows, never in bySource.
      { attemptId: "exam", qIndex: 99, specCode: "2.1", markAwarded: 9, markAvailable: 1,
        attemptedAt: null, source: "exam-paper", examConditions: true },
    ],
  });
  t("practice arm counted", m.bySource.practice.rows === 4 && m.bySource.practice.outOf === 4,
    JSON.stringify(m.bySource.practice));
  t("exam arm counted", m.bySource.exam.rows === 3 && m.bySource.exam.outOf === 3,
    JSON.stringify(m.bySource.exam));
  t("the malformed exam row was ignored, not counted", m.ignoredRows === 1);
  t("both sources feed ONE calculation — the exam code is rated by the same bands",
    m.byCode["2.1"]?.state === "insufficient" && m.byCode["2.1"]?.outOf === 3);
  t("summary marks pool across sources",
    m.summary.outOf === 7, m.summary.outOf);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
