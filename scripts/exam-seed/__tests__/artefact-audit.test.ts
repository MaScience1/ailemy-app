/**
 * The audit: lines the extractor filed where nobody could rule on them.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/artefact-audit.test.ts
 *
 * ============================================================================
 * ⚠ MISFILED IS WORSE THAN MISSING
 * ============================================================================
 * A dropped block leaves a hole the tariff arithmetic finds — that is how
 * 21(b)(i) was caught. A line sorted into `accept` or `guidance` leaves no
 * trace at all: only `requiresRuling` reaches a reviewer, so the question
 * still shows "0 to rule", still approves, and still emits. The examiner never
 * saw the line and nothing said so.
 *
 * "307 (kg)" is the ANSWER to a six-mark calculation, and it was sitting in a
 * bucket labelled examiner prose.
 *
 * ⚠ READ-ONLY, DERIVED FROM THE REAL ARTEFACT. No credentials, no writes.
 */
import { readFileSync } from "node:fs";
import { auditArtefact, type AuditClass } from "../../../src/lib/exam/artefact-audit.ts";
import {
  withdrawApproval,
  buildReview,
  toFixture,
  pointsFullyRuled,
  isResolved,
  type QuestionRulings,
  type ProposalSet,
} from "../../../src/lib/exam/markscheme-proposals.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const ARTEFACT = "scripts/exam-seed/proposals/unit-1-may-june-2025.markscheme.json";
const before = readFileSync(ARTEFACT, "utf8");
// ⚠ TYPED AS THE REAL ProposalSet, not the audit's narrower input. The audit
// accepts optional buckets so it can be handed a partial fixture; the artefact
// on disk always has them, and typing it loosely here made every access a
// possibly-undefined.
const set = JSON.parse(before) as ProposalSet;
const report = auditArtefact(set.questions);
const forQ = (qn: string) => report.findings.filter((f) => f.questionNumber === qn);
const has = (qn: string, text: string, cls?: AuditClass) =>
  forQ(qn).some((f) => f.text === text && (!cls || f.cls === cls));

console.log("── THE THREE THE FOUNDER NAMED ──");
{
  // ⚠ 20(b)(iii) — reported as "never captured". They WERE captured, into
  // buckets the review surface never asks about. That is the finding.
  t("20(b)(iii) has four findings", forQ("20(b)(iii)").length === 4, forQ("20(b)(iii)").length);
  t('  "307 (kg)" — the ANSWER, filed as guidance',
    has("20(b)(iii)", "307 (kg)", "answer-value-in-guidance"));
  t('  "Allow 306 (kg)" never reached the reviewer',
    has("20(b)(iii)", "Allow 306 (kg)", "concession-never-flagged"));
  t('  "Allow 307000 / 306000 g" never reached the reviewer',
    has("20(b)(iii)", "Allow 307000 / 306000 g", "concession-never-flagged"));
  t('  "(check mole ratio from 20bii)" never reached the reviewer',
    has("20(b)(iii)", "(check mole ratio from 20bii)"));

  // ⚠ 20(b)(iv) — two concessions AND the drawing-cell class.
  t('20(b)(iv): "Ignore any names even if incorrect"',
    has("20(b)(iv)", "Ignore any names even if incorrect", "concession-never-flagged"));
  t('20(b)(iv): "Allow 1 mark for two correct non skeletal formulae"',
    has("20(b)(iv)", "Allow 1 mark for two correct non skeletal formulae", "concession-never-flagged"));
  t("20(b)(iv) also has empty marking points — the answer cell is a drawing",
    forQ("20(b)(iv)").filter((f) => f.cls === "empty-marking-point").length === 2,
    forQ("20(b)(iv)").filter((f) => f.cls === "empty-marking-point").length);

  // ⚠ 22(c) — the truncation the founder hand-completed, found independently,
  // together with the orphaned tail it was split from.
  t("22(c) has a mid-line truncation",
    forQ("22(c)").some((f) => f.cls === "mid-line-truncation"), forQ("22(c)"));
  t('  ...and it is the "must be less than" line',
    forQ("22(c)").some((f) => f.cls === "mid-line-truncation" && /less than$/.test(f.text)),
    forQ("22(c)").map((f) => f.text));
  t('  ...and the orphaned tail "100%" is found too',
    has("22(c)", "100%", "answer-value-in-guidance"));
}

console.log("\n── IT IS A SYSTEMIC PROBLEM, NOT THREE CASES ──");
{
  t("findings span many questions, not three",
    report.byQuestion.length > 10, report.byQuestion.length);
  t("all four classes occur",
    new Set(report.findings.map((f) => f.cls)).size === 4,
    [...new Set(report.findings.map((f) => f.cls))]);
  t("concessions are the bulk of it",
    report.findings.filter((f) => f.cls === "concession-never-flagged").length > 40,
    report.findings.filter((f) => f.cls === "concession-never-flagged").length);
  t("every finding names its bucket", report.findings.every((f) => f.bucket.length > 0));
  t("every finding says why", report.findings.every((f) => f.why.length > 20));
  t("byQuestion totals match the findings",
    report.byQuestion.reduce((n, q) => n + q.count, 0) === report.findings.length);
}

console.log("\n── WHAT IT MUST *NOT* FLAG ──");
{
  // ⚠ A LINE THE REVIEWER ALREADY SAW IS NOT MISFILED.
  const flaggedTexts = new Set(
    set.questions.flatMap((q) => (q.requiresRuling ?? []).map((l) => l.text.trim())));
  const wrongly = report.findings.filter(
    (f) => f.bucket !== "requiresRuling" && flaggedTexts.has(f.text));
  t("a line that IS flagged for ruling is never reported as misfiled",
    wrongly.length === 0, wrongly.slice(0, 3));

  // ⚠ WORKED EXAMPLE ARITHMETIC IS GUIDANCE AND BELONGS THERE.
  t('"(11400) × 9.25 = 105 450 (1.0545 × 105)" is not called an answer',
    !report.findings.some((f) => f.text.includes("× 9.25 =")),
    report.findings.filter((f) => f.text.includes("9.25")));
  t('"Example of calculation" is not a finding',
    !report.findings.some((f) => f.text === "Example of calculation"));

  // ⚠ A HAND-TRANSCRIBED LINE WAS CLASSIFIED BY A PERSON. 21(b)(i) was typed
  // in by the founder, who chose each field; reporting it back is noise, and
  // noise is how real findings stop being read.
  t("the hand-transcribed block is excluded entirely",
    forQ("21(b)(i)").length === 0, forQ("21(b)(i)"));
  t("...even though it does contain Allow/Ignore lines",
    (set.questions.find((q) => q.questionNumber === "21(b)(i)")?.guidance ?? [])
      .some((l) => /^(allow|ignore)/i.test(l.text)));
}

console.log("\n── ANTI-VACUITY AND READ-ONLINESS ──");
{
  const empty = auditArtefact([]);
  t("no questions yields no findings", empty.findings.length === 0);
  const clean = auditArtefact([{
    questionNumber: "X", points: [{ pointCode: "M1", criterion: "a real criterion" }],
    guidance: [{ text: "Example of calculation" }], requiresRuling: [{ text: "Allow 2.5" }],
  }]);
  t("a clean block yields no findings", clean.findings.length === 0, clean.findings);
  t("ANTI-VACUITY — the real artefact DOES yield findings", report.findings.length > 50,
    report.findings.length);
  t("the audit wrote nothing", readFileSync(ARTEFACT, "utf8") === before);
}

console.log("\n── ADDING A LINE TO AN APPROVED QUESTION WITHDRAWS THE APPROVAL ──");
{
  // ⚠ THE LIVE CASE: 20(b)(iv) is approved and is missing two of its own
  // guidance lines. Once they are added, the signature covers content the
  // examiner never saw — and Emit gates on exactly that field.
  const q = set.questions.find((x) => x.questionNumber === "20(b)(iv)")!;
  const approved: QuestionRulings = {
    points: Object.fromEntries(q.points.map((p) => [p.pointCode, { verdict: "accept" as const }])),
    lines: Object.fromEntries(q.requiresRuling.map((l) => [l.text, { kind: "guidance" as const }])),
    approvedAt: "2026-08-18T00:00:00.000Z",
    approvedBy: "self",
    revision: 2,
  };
  t("the fixture question really is approved to begin with",
    Boolean(approved.approvedAt && approved.approvedBy));

  const after = withdrawApproval(approved);
  t("the approval timestamp is gone", after.approvedAt === undefined, after.approvedAt);
  t("the approver is gone", after.approvedBy === undefined, after.approvedBy);

  // ⚠ AND THE RULINGS SURVIVE. Making the founder redo their earlier decisions
  // would be a punishment for the extractor's mistake.
  t("every line ruling survives",
    JSON.stringify(after.lines) === JSON.stringify(approved.lines), after.lines);
  t("every point ruling survives",
    JSON.stringify(after.points) === JSON.stringify(approved.points));
  t("the revision survives, so a stale tab still conflicts", after.revision === 2);

  // ⚠ FOUND WHILE WRITING THIS TEST: 20(b)(iv) CANNOT EMIT AT ALL, APPROVED OR
  // NOT. Its two marking points have EMPTY criteria — the answer cell is a
  // drawing, so the extractor produced points with no text — and toFixture
  // refuses "empty criterion" and then "every point was rejected, leaving no
  // mark scheme". The question is approved on screen and would never reach the
  // seeder. That is Emit doing its job, and it is also the clearest possible
  // statement that this block needs hand-transcription.
  const emitApproved = toFixture({ ...set, questions: [q] } as never, { "20(b)(iv)": approved });
  t("20(b)(iv) is REFUSED by Emit even while approved",
    emitApproved.ok === false, emitApproved.ok ? "" : "");
  t("...because its marking points have no criterion",
    emitApproved.ok === false && emitApproved.refusals.some((r) => /empty criterion/.test(r)),
    emitApproved.ok ? "" : emitApproved.refusals);
  t("...which is exactly what the audit flags as empty-marking-point",
    forQ("20(b)(iv)").filter((f) => f.cls === "empty-marking-point").length === 2);

  // The withdrawal consequence, shown on a question that DOES emit.
  const good = set.questions.find((x) => x.questionNumber === "1")!;
  const goodBook: QuestionRulings = {
    points: Object.fromEntries(good.points.map((p) => [p.pointCode, { verdict: "accept" as const }])),
    lines: Object.fromEntries(good.requiresRuling.map((l) => [l.text, { kind: "discard" as const }])),
    approvedAt: "2026-08-18T00:00:00.000Z", approvedBy: "self", revision: 1,
  };
  const before = toFixture({ ...set, questions: [good] } as never, { "1": goodBook });
  const emitAfter = toFixture({ ...set, questions: [good] } as never, { "1": withdrawApproval(goodBook) });
  t("a sound question emits while approved", before.ok === true, before.ok ? "" : before);
  t("...and Emit REFUSES once the approval is withdrawn", emitAfter.ok === false);
  t("...naming it as not approved",
    emitAfter.ok === false && emitAfter.refusals.some((r) => /not approved/.test(r)),
    emitAfter.ok ? "" : emitAfter.refusals);

  // ⚠ AND A NEWLY ADDED LINE IS UNRULED, so the question cannot simply be
  // re-approved without looking at it.
  const withNewLine = {
    ...q,
    requiresRuling: [...q.requiresRuling, {
      page: q.page, y: 0, sourceLine: "Ignore any names even if incorrect",
      derivedFrom: "hand-transcribed", confidence: 1,
      text: "Ignore any names even if incorrect",
      requiresRuling: ["hand-transcribed from the mark scheme — classify it"],
    }],
  };
  const review = buildReview({ ...set, questions: [withNewLine] } as never, { "20(b)(iv)": after });
  t("the added line counts as unruled", review[0].unruled.length === 1, review[0].unruled.length);
  t("...and it is the added one",
    review[0].unruled[0]?.text === "Ignore any names even if incorrect");
  t("isResolved says so directly", !isResolved(after.lines["Ignore any names even if incorrect"]));

  // ⚠ A POINT ADDED THE SAME WAY MAKES pointsFullyRuled FALSE.
  const withNewPoint = {
    ...q,
    points: [...q.points, {
      page: q.page, y: 0, sourceLine: "H1", derivedFrom: "hand-transcribed", confidence: 1,
      pointCode: "H1", criterion: "a hand-added marking point", marks: null, route: 1, methodBlock: null,
    }],
  };
  t("a hand-added point leaves the question unverified",
    !pointsFullyRuled(withNewPoint as never, after));
  t("...while the original points alone were fully ruled",
    pointsFullyRuled(q, after));

  // ⚠ ANTI-VACUITY: withdrawApproval must not simply return an empty object.
  t("ANTI-VACUITY — the returned book is not empty",
    Object.keys(after).length >= 3, Object.keys(after));
  t("withdrawing from an already-unapproved book is a no-op",
    JSON.stringify(withdrawApproval(after)) === JSON.stringify(after));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
