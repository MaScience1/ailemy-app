/**
 * The exam arm of the mastery evidence contract — and the WCH11/01 fixture's
 * spec mapping, verified against the specification it claims to map to.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/mastery-evidence-union.test.ts
 *
 * ============================================================================
 * ⚠ THE SPEC-CODE SET IS DERIVED FROM supabase/seed/004, NEVER COPIED
 * ============================================================================
 * AGENTS.md: a model of production data must be re-derived from the source.
 * The set of valid IAL AS Chemistry codes is parsed out of the seed file that
 * IS the applied specification (004, verified in 005) — so a spec revision
 * moves this suite's expectations with it, and a fixture code the catalogue
 * does not hold goes red here before the importer ever refuses it. The parse
 * is guarded against its own rot: a regex that stops matching yields a set
 * this suite refuses as implausibly small, not a vacuous pass.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { examEvidenceRows } from "../../../src/lib/specification/exam-evidence.ts";
import { validateQuestionSet, type QuestionSet } from "../../../src/lib/exam/question-set.ts";
import { WCH11_01_2025_MAY_JUNE } from "../wch11-01-2025-may-june.ts";
import { UNIT_1_MAY_JUNE_2025_SET } from "../unit-1-may-june-2025.set.ts";
import specOverlay from "../spec-points.unit-1-may-june-2025.json" with { type: "json" };

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

// ============================================================================
console.log("\n=== 1. examEvidenceRows: one question, one row, primary code, full tariff ===");
// ============================================================================
{
  const out = examEvidenceRows({
    attempts: [{ id: "ea1", mode: "exam", submittedAt: "2026-09-01T10:00:00Z" }],
    marked: [
      { questionAttemptId: "qa1", examAttemptId: "ea1", questionId: "q1", awardedMarks: 3, assessedOutOf: 4 },
    ],
    specLinks: [
      // Deliberately out of order: display_order decides, not array order.
      { questionId: "q1", specCode: "1.4", displayOrder: 1 },
      { questionId: "q1", specCode: "1.8", displayOrder: 0 },
    ],
  });
  t("exactly one evidence row per marked question", out.rows.length === 1, out.rows.length);
  t("the PRIMARY code gets the marks (lowest display_order)",
    out.rows[0]?.specCode === "1.8", out.rows[0]?.specCode);
  t("markAvailable is assessed_out_of, never a max tariff",
    out.rows[0]?.markAvailable === 4 && out.rows[0]?.markAwarded === 3);
  t("attemptedAt is the sitting's submitted_at",
    out.rows[0]?.attemptedAt === "2026-09-01T10:00:00Z");
  t("mode 'exam' → examConditions true", out.rows[0]?.examConditions === true);
  t("source is exam-paper", out.rows[0]?.source === "exam-paper");
  t("nothing unmapped", out.unmappedQuestions === 0);
}

{
  // A display_order tie breaks by code string, so the choice is deterministic.
  const out = examEvidenceRows({
    attempts: [{ id: "ea1", mode: "practice", submittedAt: null }],
    marked: [
      { questionAttemptId: "qa1", examAttemptId: "ea1", questionId: "q1", awardedMarks: 1, assessedOutOf: 1 },
    ],
    specLinks: [
      { questionId: "q1", specCode: "2.5", displayOrder: 0 },
      { questionId: "q1", specCode: "2.1", displayOrder: 0 },
    ],
  });
  t("display_order tie breaks by code — deterministic, not insertion order",
    out.rows[0]?.specCode === "2.1", out.rows[0]?.specCode);
  t("mode 'practice' → examConditions false", out.rows[0]?.examConditions === false);
}

// ============================================================================
console.log("\n=== 2. what cannot be attributed is counted, never silently dropped ===");
// ============================================================================
{
  const out = examEvidenceRows({
    attempts: [{ id: "ea1", mode: "exam", submittedAt: "2026-09-01T10:00:00Z" }],
    marked: [
      // No spec link at all.
      { questionAttemptId: "qa1", examAttemptId: "ea1", questionId: "q-unmapped", awardedMarks: 2, assessedOutOf: 2 },
      // An attempt id the read never returned.
      { questionAttemptId: "qa2", examAttemptId: "ea-foreign", questionId: "q2", awardedMarks: 1, assessedOutOf: 1 },
      // A healthy row, to prove the two above don't poison it.
      { questionAttemptId: "qa3", examAttemptId: "ea1", questionId: "q3", awardedMarks: 1, assessedOutOf: 1 },
    ],
    specLinks: [
      { questionId: "q2", specCode: "1.1", displayOrder: 0 },
      { questionId: "q3", specCode: "1.2", displayOrder: 0 },
    ],
  });
  t("unmapped question counted", out.unmappedQuestions === 2, out.unmappedQuestions);
  t("the healthy row still flows", out.rows.length === 1 && out.rows[0]?.specCode === "1.2");
}

// ============================================================================
console.log("\n=== 3. the fixture's spec mapping, against the real specification ===");
// ============================================================================
{
  // Derive the valid-code set from the applied seed file (004). The INSERT
  // lines all read: SELECT t.id, '<code>', '<title>', …
  const seedSql = readFileSync(
    resolve(import.meta.dirname, "../../../supabase/seed/004_ial_as_chem_specification.sql"),
    "utf8",
  );
  const codes = new Set(
    [...seedSql.matchAll(/SELECT t\.id, '(\d+\.\d+)', /g)].map((m) => m[1]),
  );
  t("the derived code set is plausibly the whole specification (≥ 100 codes)",
    codes.size >= 100, codes.size);
  t("known codes are in it; the archived 1.13 is not inserted by 004",
    codes.has("1.9") && codes.has("2.17") && codes.has("3.21") && !codes.has("1.13"));

  const set = WCH11_01_2025_MAY_JUNE;
  const isContainer = (n: string) =>
    set.questions.some((q) => q.parentQuestionNumber === n);
  const leaves = set.questions.filter((q) => !isContainer(q.questionNumber));
  const markedLeaves = leaves.filter((q) => q.marks > 0);

  t("every mark-carrying leaf is mapped to at least one spec code",
    markedLeaves.every((q) => (q.specPoints?.length ?? 0) > 0),
    markedLeaves.filter((q) => !(q.specPoints?.length)).map((q) => q.questionNumber).join(","));
  t("no container carries spec codes (marks live on leaves, mapping does too)",
    set.questions.filter((q) => isContainer(q.questionNumber))
      .every((q) => (q.specPoints?.length ?? 0) === 0));

  const fixtureCodes = markedLeaves.flatMap((q) => q.specPoints ?? []);
  const foreign = fixtureCodes.filter((c) => !codes.has(c));
  t("every fixture code exists in the specification the catalogue holds",
    foreign.length === 0, foreign.join(","));
  t("no leaf repeats a code",
    markedLeaves.every((q) => new Set(q.specPoints).size === (q.specPoints?.length ?? 0)));
  t("the validator passes the mapped fixture",
    validateQuestionSet(set).length === 0,
    validateQuestionSet(set).map((i) => `${i.where}: ${i.message}`).join(" | "));
}

// ============================================================================
console.log("\n=== 4. the validator's new rules bite ===");
// ============================================================================
{
  const base = (over: Record<string, unknown>): QuestionSet => ({
    paperId: "11111111-2222-3333-4444-555555555555",
    expect: { paperCode: "X", session: "s", year: 2025, totalMarks: 1 },
    complete: false,
    questions: [
      {
        questionNumber: "1",
        parentQuestionNumber: null,
        displayOrder: 10,
        marks: 1,
        answerType: "mcq",
        markScheme: [{ pointCode: "M1", criterion: "c" }],
        ...over,
      },
    ],
  } as QuestionSet);

  t("a blank spec code is refused",
    validateQuestionSet(base({ specPoints: [" "] })).some((i) => /blank code/.test(i.message)));
  t("a duplicated spec code is refused (0035 UNIQUE)",
    validateQuestionSet(base({ specPoints: ["1.1", "1.1"] })).some((i) => /duplicate spec code/.test(i.message)));

  const withContainer: QuestionSet = {
    ...base({}),
    questions: [
      { questionNumber: "20", parentQuestionNumber: null, displayOrder: 10, marks: 0,
        answerType: "other", specPoints: ["1.1"] },
      { questionNumber: "20(a)", parentQuestionNumber: "20", displayOrder: 20, marks: 1,
        answerType: "mcq", markScheme: [{ pointCode: "M1", criterion: "c" }] },
    ],
  } as QuestionSet;
  t("a container carrying specPoints is refused",
    validateQuestionSet(withContainer).some((i) => /container but carries specPoints/.test(i.message)));
}

// ============================================================================
console.log("\n=== 5. the seedable overlay agrees with the cited transcription ===");
// ============================================================================
// The SEEDABLE set (unit-1-may-june-2025-generated) takes its spec mappings
// from spec-points.unit-1-may-june-2025.json; the CITATIONS live in the hand
// transcription's // spec: comments. Two copies of one mapping can drift, so
// this section pins them together: every overlay entry must equal the same
// question's specPoints in the transcription, and vice versa — a change to
// either without the other goes red here.
{
  const overlayMap = (specOverlay as { specPoints: Record<string, string[]> }).specPoints;
  const hand = new Map(
    WCH11_01_2025_MAY_JUNE.questions
      .filter((q) => (q.specPoints?.length ?? 0) > 0)
      .map((q) => [q.questionNumber, q.specPoints!]),
  );

  t("the overlay maps exactly the questions the transcription maps",
    Object.keys(overlayMap).sort().join("|") === [...hand.keys()].sort().join("|"),
    `overlay: ${Object.keys(overlayMap).sort().join(",")} vs hand: ${[...hand.keys()].sort().join(",")}`);
  t("every mapping is identical, order included (order IS the primary ranking)",
    Object.entries(overlayMap).every(
      ([n, codes]) => (hand.get(n) ?? []).join("|") === codes.join("|"),
    ),
    Object.entries(overlayMap)
      .filter(([n, codes]) => (hand.get(n) ?? []).join("|") !== codes.join("|"))
      .map(([n]) => n).join(","));

  const seedable = UNIT_1_MAY_JUNE_2025_SET;
  const seedableByNumber = new Map(seedable.questions.map((q) => [q.questionNumber, q]));
  t("the seedable set carries the overlay's mappings on the right questions",
    Object.entries(overlayMap).every(
      ([n, codes]) => (seedableByNumber.get(n)?.specPoints ?? []).join("|") === codes.join("|"),
    ));
  t("the seedable set still validates with the mappings merged in",
    validateQuestionSet(seedable, { paperIdResolvedAtRuntime: true }).length === 0,
    validateQuestionSet(seedable, { paperIdResolvedAtRuntime: true })
      .map((i) => `${i.where}: ${i.message}`).join(" | "));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
