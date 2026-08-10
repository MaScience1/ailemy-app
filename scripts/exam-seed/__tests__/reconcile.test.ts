/**
 * Reconciliation — the assertion the 200-response audit will run on.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/reconcile.test.ts
 *
 * These tests exist because every failure found on this stack so far reported
 * GREEN. The point of the module is to make "it came back" and "it worked"
 * different observations, so the tests are written to fail if the check ever
 * becomes satisfiable by a run that lost something.
 */
import {
  reconcileMarking,
  describeReconciliation,
  type ReconcilableQuestion,
} from "../../../src/lib/exam/reconcile.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};
// Marks default to a self-consistent 1-mark question, so the existing bucket
// tests stay about buckets. The mark cases below set them deliberately.
const q = (
  confidence: ReconcilableQuestion["confidence"],
  marks: Partial<Omit<ReconcilableQuestion, "confidence">> = {},
): ReconcilableQuestion => ({
  confidence,
  maxMarks: 1,
  assessedOutOf: 1,
  provisionalOutOf: 0,
  unassessedMarks: 0,
  ...marks,
});
const det = () => q("deterministic");
const ai = () => q("requires_review");
const none = () => q(null, { assessedOutOf: null, unassessedMarks: 1 });

console.log("── the healthy WCH11/01 shape must PASS (this is the cry-wolf guard) ──");
{
  // The real paper: 10 questions, 7 answered, and only 4 of them produce a
  // deterministic verdict. A naive "N responses in, N results out" assertion
  // would abort here — on a run that is entirely correct.
  const marked = [det(), det(), det(), det(), ai(), ai(), none(), none(), none(), none()];
  const r = reconcileMarking({ questionsIn: 10, responsesIn: 7, marked, persisted: 6, persistFailed: 0 });
  t("10 in / 10 out reconciles", r.ok, r.ok ? undefined : r);
  t("...even though only 7 responses went in", r.ok && r.reconciliation.responsesIn === 7);
  t("...and only 6 rows were persisted", r.ok && r.reconciliation.persisted === 6);
  t("buckets: 4 confirmed, 2 provisional, 4 not marked",
    r.ok && r.reconciliation.confirmed === 4 && r.reconciliation.provisional === 2 && r.reconciliation.notMarked === 4,
    r.reconciliation);
}

console.log("\n── A DROPPED QUESTION MUST ABORT. This is the whole point. ──");
{
  // The exact bug: `if (!q) continue` in the marking loop silently removed a
  // question from the output. Ten in, nine out, screen looked complete.
  const marked = [det(), det(), det(), det(), ai(), ai(), none(), none(), none()];
  const r = reconcileMarking({ questionsIn: 10, responsesIn: 7, marked, persisted: 6, persistFailed: 0 });
  t("10 in / 9 out FAILS", !r.ok, r);
  t("...and says how many are unaccounted for",
    !r.ok && /1 unaccounted for/.test(r.problem), !r.ok ? r.problem : undefined);
  t("...and still reports the counts it did see",
    !r.ok && r.reconciliation.questionsOut === 9 && r.reconciliation.questionsIn === 10);
}

console.log("\n── a drop AND a double-count must abort (either check alone would pass) ──");
{
  // 10 out of 10, so the length check is satisfied — but one verdict carries a
  // confidence outside the three buckets, so the sum falls short. A single
  // check would have called this healthy.
  const marked = [det(), det(), det(), det(), ai(), ai(), none(), none(), none(),
    q("high" as unknown as ReconcilableQuestion["confidence"])];
  const r = reconcileMarking({ questionsIn: 10, responsesIn: 7, marked, persisted: 6, persistFailed: 0 });
  t("length matches but buckets do not → FAILS", !r.ok, r);
  t("...names the bucket shortfall", !r.ok && /9 bucketed/.test(r.problem), !r.ok ? r.problem : undefined);
}

console.log("\n── persistence failures are VISIBLE but not fatal ──");
{
  // The verdicts are sound and already surfaced to the student; the audit must
  // be able to read the shortfall without doing the subtraction itself,
  // because that subtraction is exactly what nobody did the first time.
  const marked = [det(), det(), det(), det(), ai(), ai(), none(), none(), none(), none()];
  const r = reconcileMarking({ questionsIn: 10, responsesIn: 7, marked, persisted: 0, persistFailed: 6 });
  t("still reconciles (the verdicts are all present)", r.ok);
  t("...but persisted is 0, not 6", r.ok && r.reconciliation.persisted === 0, r.reconciliation.persisted);
  t("...and persistFailed is 6", r.ok && r.reconciliation.persistFailed === 6);
  t("PERSISTED AND questionsOut ARE DIFFERENT NUMBERS — a run can produce a full set of verdicts and store none",
    r.ok && r.reconciliation.questionsOut === 10 && r.reconciliation.persisted === 0);
  t("the one-liner shouts about it",
    /6 FAILED TO PERSIST/.test(describeReconciliation(r.reconciliation)),
    describeReconciliation(r.reconciliation));
}

console.log("\n── the empty attempt: 0 in, 0 out is coherent, not a pass by accident ──");
{
  const r = reconcileMarking({ questionsIn: 0, responsesIn: 0, marked: [], persisted: 0, persistFailed: 0 });
  t("0/0 reconciles", r.ok);
  const r2 = reconcileMarking({ questionsIn: 3, responsesIn: 0, marked: [], persisted: 0, persistFailed: 0 });
  t("3 in / 0 out FAILS — an empty result for a non-empty attempt is the loudest case", !r2.ok, r2);
  t("...names all three as unaccounted for",
    !r2.ok && /3 unaccounted for/.test(r2.problem), !r2.ok ? r2.problem : undefined);
}


console.log("\n── MARKS, NOT JUST QUESTIONS. A census cannot see an over-report. ──");
{
  // ⚠ THE CASE WORKING CAPTURE MADE POSSIBLE. Tier 1 confirms k marks by
  // judging ONE mark-scheme point, so k-1 marks are attributable to points it
  // never judged — and if every remaining point then goes to Tier 2, those same
  // marks are counted twice. One question in, one question out: the old
  // question-census reconciliation returned ok on all of it.
  const overreporting = {
    confidence: "deterministic" as const,
    maxMarks: 6, assessedOutOf: 2, provisionalOutOf: 5, unassessedMarks: 0,
  };
  const r = reconcileMarking({
    questionsIn: 1, responsesIn: 1, marked: [overreporting], persisted: 1, persistFailed: 0,
  });
  t("a 6-mark question reporting 7 marks of outcome ABORTS", !r.ok, r);
  t("...and the problem names both numbers",
    !r.ok && /worth 6 mark\(s\) reports 7/.test(r.problem), !r.ok ? r.problem : "");
  t("...even though the question census is perfect",
    r.reconciliation.questionsIn === 1 && r.reconciliation.questionsOut === 1);
}
{
  // The honest 20(b)(iii) shape: 1 confirmed + 5 provisional = 6 of 6.
  const honest = {
    confidence: "deterministic" as const,
    maxMarks: 6, assessedOutOf: 1, provisionalOutOf: 5, unassessedMarks: 0,
  };
  const r = reconcileMarking({
    questionsIn: 1, responsesIn: 1, marked: [honest], persisted: 1, persistFailed: 0,
  });
  t("the real hybrid shape reconciles", r.ok, r);
  t("...and reports the marks it accounted for",
    r.reconciliation.marksIn === 6 && r.reconciliation.marksAccountedFor === 6,
    r.reconciliation);
}
{
  // Under-reporting is NOT a failure: marks nobody could reach are a real
  // outcome, and 21(c)(i) is 3 marks of unmarkable answer type.
  const under = {
    confidence: null, maxMarks: 3, assessedOutOf: null, provisionalOutOf: 0, unassessedMarks: 3,
  };
  const r = reconcileMarking({
    questionsIn: 1, responsesIn: 0, marked: [under], persisted: 0, persistFailed: 0,
  });
  t("a wholly unassessable question reconciles", r.ok, r);
}
{
  // Two questions, each individually fine, whose paper-wide sum is fine too —
  // but one alone would breach. Per-question is the check that catches it.
  const bad = { confidence: "deterministic" as const, maxMarks: 2, assessedOutOf: 2, provisionalOutOf: 2, unassessedMarks: 0 };
  const slack = { confidence: null, maxMarks: 10, assessedOutOf: null, provisionalOutOf: 0, unassessedMarks: 0 };
  const r = reconcileMarking({
    questionsIn: 2, responsesIn: 1, marked: [bad, slack], persisted: 1, persistFailed: 0,
  });
  t("one question over-reporting aborts even when the PAPER total has slack",
    !r.ok, r.ok ? r.reconciliation : r.problem);
}

{
  // ⚠ THE CRY-WOLF GUARD FOR THIS CHECK ITSELF. A wholly AI-marked question
  // reports assessedOutOf AND provisionalOutOf over the same marks — 23(c)(ii)
  // is 2 marks and 2 points. Summing both would abort a healthy paper.
  const pureAi = {
    confidence: "requires_review" as const,
    maxMarks: 2, assessedOutOf: 2, provisionalOutOf: 2, unassessedMarks: 0,
  };
  const r = reconcileMarking({
    questionsIn: 1, responsesIn: 1, marked: [pureAi], persisted: 1, persistFailed: 0,
  });
  t("a wholly AI-marked question counts its marks ONCE", r.ok, r.ok ? "" : r.problem);
  t("...so its 2 marks are accounted for as 2, not 4",
    r.reconciliation.marksAccountedFor === 2, r.reconciliation);
}

{
  // ⚠ THE WHOLE OF WCH11/01, AS IT ACTUALLY MARKS. The mark check added above
  // is new, and a reconciliation that aborts a healthy paper is worse than none
  // — so the real paper's ten answerable questions are asserted directly, in
  // the shapes markAttempt produces for them. Reconstructed from the fixture
  // rather than the database, because this suite must run with no credentials.
  const paper: ReconcilableQuestion[] = [
    // mcq, marked outright
    { confidence: "deterministic", maxMarks: 1, assessedOutOf: 1, provisionalOutOf: 0, unassessedMarks: 0 },
    { confidence: "deterministic", maxMarks: 1, assessedOutOf: 1, provisionalOutOf: 0, unassessedMarks: 0 },
    // 20(a): moca 4 of 4, so nothing is left for Tier 2 even with working
    { confidence: "deterministic", maxMarks: 4, assessedOutOf: 4, provisionalOutOf: 0, unassessedMarks: 0 },
    // 20(b)(i) short_text, unanswered -> wholly provisional
    { confidence: "requires_review", maxMarks: 1, assessedOutOf: 1, provisionalOutOf: 0, unassessedMarks: 0 },
    // 20(b)(ii) chemical_equation — unmarkable answer type
    { confidence: null, maxMarks: 2, assessedOutOf: null, provisionalOutOf: 0, unassessedMarks: 2 },
    // 20(b)(iii): 1 confirmed by arithmetic + 5 method marks from working
    { confidence: "deterministic", maxMarks: 6, assessedOutOf: 1, provisionalOutOf: 5, unassessedMarks: 0 },
    // 20(b)(iv) structure, 21(c)(i) graph — unmarkable
    { confidence: null, maxMarks: 2, assessedOutOf: null, provisionalOutOf: 0, unassessedMarks: 2 },
    { confidence: null, maxMarks: 3, assessedOutOf: null, provisionalOutOf: 0, unassessedMarks: 3 },
    // 22(c): moca null, so Tier 1 abstains and the whole question goes to Tier 2
    { confidence: "requires_review", maxMarks: 3, assessedOutOf: 3, provisionalOutOf: 3, unassessedMarks: 0 },
    // 23(c)(ii) long_text, wholly AI-marked
    { confidence: "requires_review", maxMarks: 2, assessedOutOf: 2, provisionalOutOf: 2, unassessedMarks: 0 },
  ];
  const r = reconcileMarking({
    questionsIn: paper.length, responsesIn: 4, marked: paper, persisted: 6, persistFailed: 0,
  });
  t("the real WCH11/01 paper reconciles — the mark check does not cry wolf",
    r.ok, r.ok ? "" : r.problem);
  t("...over its full 25-mark tariff",
    r.reconciliation.marksIn === 25, r.reconciliation.marksIn);
  t("...accounting for every mark exactly once",
    r.reconciliation.marksAccountedFor === 25, r.reconciliation);
}

console.log("\n── describeReconciliation states what LANDED, not just what was computed ──");
{
  const marked = [det(), ai(), none()];
  const r = reconcileMarking({ questionsIn: 3, responsesIn: 2, marked, persisted: 2, persistFailed: 0 });
  const line = describeReconciliation(r.reconciliation);
  t("mentions persisted", /2 persisted/.test(line), line);
  t("mentions the in->out mapping", /3 in -> 3 out/.test(line), line);
  t("silent about failures when there are none", !/FAILED/.test(line), line);
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
