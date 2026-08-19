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
import { auditArtefact, moveLineToRuling, type AuditClass } from "../../../src/lib/exam/artefact-audit.ts";
import {
  emitFixtureSource,
  identifierFor,
  stampFrom,
  withdrawApproval,
  buildReview,
  toFixture,
  pointsFullyRuled,
  isResolved,
  type QuestionRulings,
  type RulingBook,
  type ProposalSet,
} from "../../../src/lib/exam/markscheme-proposals.ts";

// ⚠ REQUIRED, NOT OPTIONAL. emitFixtureSource used to accept a partial stamp,
// so a failed lookup wrote `paperCode: undefined` into a header that reported
// a green 48/80. Passing it is now a type error to omit.
const STAMP = { paperCode: "WCH11/01", session: "May-June", year: 2025 };

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

console.log("── THE SWEEP HAS BEEN RUN, SO THE AUDIT MUST HAVE SHRUNK ──");
{
  // ⚠ THIS SECTION USED TO PIN "20(b)(iii) HAS FOUR FINDINGS". It did, before
  // the founder restored them. Pinning the pre-sweep state made the suite go
  // red for the best possible reason — the work got done — so it now asserts
  // the DIRECTION instead: concessions are gone, and what remains is the
  // classes a sweep cannot fix.
  t("no concession is left buried",
    report.findings.filter((f) => f.cls === "concession-never-flagged").length === 0,
    report.findings.filter((f) => f.cls === "concession-never-flagged").slice(0, 3));
  t("20(b)(iii) is clear", forQ("20(b)(iii)").length === 0, forQ("20(b)(iii)"));

  // ⚠ AND WHAT A SWEEP CANNOT FIX IS STILL REPORTED. Restoring moves a line
  // into the ruling queue; it cannot invent a criterion for a drawing, and it
  // cannot rejoin a sentence the extractor split.
  t("empty marking points are still reported",
    report.findings.some((f) => f.cls === "empty-marking-point"));
  t("...on the two image-answer blocks",
    ["20(b)(iv)", "23(a)(iii)"].every((qn) =>
      forQ(qn).some((f) => f.cls === "empty-marking-point")),
    report.byQuestion.map((q) => q.questionNumber));
  t("truncations are still reported",
    report.findings.some((f) => f.cls === "mid-line-truncation"));
  t("ANTI-VACUITY — the audit still finds something", report.findings.length > 0,
    report.findings.length);
}

console.log("\n── IT IS A SYSTEMIC PROBLEM, NOT THREE CASES ──");
{
  // ⚠ WAS "concessions are the bulk of it", WHICH WAS TRUE OF AN UNSWEPT
  // PAPER. What is durable is that the audit reports classes, not a count.
  t("every finding carries one of the four classes",
    report.findings.every((f) =>
      ["concession-never-flagged", "answer-value-in-guidance",
       "mid-line-truncation", "empty-marking-point"].includes(f.cls)),
    [...new Set(report.findings.map((f) => f.cls))]);
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
  // ⚠ WAS "> 50". The sweep has been run, so the count is now small — but it
  // must not be zero while image answers and truncations remain unfixed.
  t("ANTI-VACUITY — the real artefact still yields findings", report.findings.length > 0,
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
  // ⚠ A SYNTHETIC LINE, NOT A REAL ONE. This used to add "Ignore any names
  // even if incorrect" — which the founder has since restored AND ruled, so
  // the fixture's own book resolved it and the test measured nothing. The
  // property under test is "a newly added line is unruled", so the line has to
  // be one nothing could already have a ruling for.
  const ADDED = "a line added by this test that no ruling can exist for";
  const withNewLine = {
    ...q,
    requiresRuling: [...q.requiresRuling, {
      page: q.page, y: 0, sourceLine: ADDED,
      derivedFrom: "hand-transcribed", confidence: 1,
      text: ADDED,
      requiresRuling: ["hand-transcribed from the mark scheme — classify it"],
    }],
  };
  const review = buildReview({ ...set, questions: [withNewLine] } as never, { "20(b)(iv)": after });
  t("the added line counts as unruled", review[0].unruled.length === 1, review[0].unruled.length);
  t("...and it is the added one", review[0].unruled[0]?.text === ADDED);
  t("isResolved says so directly", !isResolved(after.lines[ADDED]));

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
  // ⚠ WAS "the original points alone were fully ruled". They are not, and
  // that is the fix: 20(b)(iv)'s two points have EMPTY criteria, and this
  // fixture rules them "accept". Accepting nothing is no longer a ruling, so
  // the question is correctly unresolved until someone Edits in the words.
  t("...and the original empty points are NOT fully ruled either, being blank",
    !pointsFullyRuled(q, after), q.points.map((pt) => pt.criterion));
  t("...whereas an EDIT supplying the words does resolve them",
    pointsFullyRuled(q, {
      ...after,
      points: Object.fromEntries(q.points.map((pt) => [pt.pointCode,
        { verdict: "edit" as const, criterion: "hand-transcribed from the drawing" }])),
    }));

  // ⚠ ANTI-VACUITY: withdrawApproval must not simply return an empty object.
  t("ANTI-VACUITY — the returned book is not empty",
    Object.keys(after).length >= 3, Object.keys(after));
  t("withdrawing from an already-unapproved book is a no-op",
    JSON.stringify(withdrawApproval(after)) === JSON.stringify(after));
}

console.log("\n── RESTORING A MISFILED LINE IS A MOVE, SO DEDUP IS STRUCTURAL ──");
{
  // ⚠ toFixture READS ONLY requiresRuling. It never looks at accept[],
  // guidance[] or reject[] — which is why 22 of 23 bucket lines in this paper
  // never reached the emitted fixture. A COPY would leave the sentence in two
  // places and the audit would report the buried one forever; a MOVE leaves
  // exactly one, in the only array anything downstream reads.
  type Q = Parameters<typeof moveLineToRuling>[0] & {
    accept: { text: string }[]; guidance: { text: string }[];
    requiresRuling: { text: string; sourceLine: string; requiresRuling?: string[] }[];
  };
  const q: Q = {
    accept: [{ text: "Allow 306 (kg)" }, { text: "Allow 307000 / 306000 g" }],
    guidance: [{ text: "307 (kg)" }],
    requiresRuling: [{ text: "Allow TE throughout", sourceLine: "Allow TE throughout" }],
  };

  const moved = moveLineToRuling(q, "Allow 306 (kg)");
  t("the line moves", moved.ok === true, moved);
  t("...and says which bucket it came from",
    moved.ok && moved.movedFrom === "accept", moved);
  t("it is GONE from accept — not copied",
    !q.accept.some((l) => l.text === "Allow 306 (kg)"), q.accept.map((l) => l.text));
  t("accept still holds its other line", q.accept.length === 1);
  t("it is now in the ruling queue",
    q.requiresRuling.some((l) => l.text === "Allow 306 (kg)"));
  t("...exactly once", q.requiresRuling.filter((l) => l.text === "Allow 306 (kg)").length === 1);
  t("...with a sourceLine, which is the key its ruling is stored under",
    q.requiresRuling.find((l) => l.text === "Allow 306 (kg)")?.sourceLine === "Allow 306 (kg)");
  t("...and a reason saying it was filed away",
    (q.requiresRuling.find((l) => l.text === "Allow 306 (kg)")?.requiresRuling ?? [])
      .some((r) => /filed under accept/.test(r)));

  // ⚠ THE DOUBLING CASE, AND IT HAD TO BE BUILT DELIBERATELY. Simply moving
  // the same line twice proves nothing: the second call fails on "not in any
  // bucket", because the first call removed it. That assertion passed even
  // with the duplicate guard deleted — found by sabotage.
  //
  // The case that actually matters is a line sitting in a bucket AND already
  // in the queue, which is exactly what a COPY-based restore would leave
  // behind, and what a re-run of the extractor over a half-swept artefact
  // could produce.
  const both: Q = {
    accept: [{ text: "Allow 306 (kg)" }],
    guidance: [],
    requiresRuling: [{ text: "Allow 306 (kg)", sourceLine: "Allow 306 (kg)" }],
  };
  const dupe = moveLineToRuling(both, "Allow 306 (kg)");
  t("a line already in the queue is REFUSED even though a bucket still holds it",
    dupe.ok === false, dupe);
  t("...saying it is already waiting",
    dupe.ok === false && /already waiting/.test(dupe.error), dupe);
  t("...and the queue still holds exactly one copy",
    both.requiresRuling.filter((l) => l.text === "Allow 306 (kg)").length === 1,
    both.requiresRuling.length);
  t("...and the bucket copy is left alone rather than silently dropped",
    both.accept.length === 1);

  const again = moveLineToRuling(q, "Allow 306 (kg)");
  t("moving an already-moved line is refused (bucket is empty now)", again.ok === false, again);
  t("...and it is still there exactly once",
    q.requiresRuling.filter((l) => l.text === "Allow 306 (kg)").length === 1);

  const fromGuidance = moveLineToRuling(q, "307 (kg)");
  t("a guidance line moves too", fromGuidance.ok && fromGuidance.movedFrom === "guidance");
  t("...leaving guidance empty", q.guidance.length === 0);

  t("a line in no bucket is refused",
    moveLineToRuling(q, "something never printed").ok === false);
  t("empty text is refused", moveLineToRuling(q, "   ").ok === false);

  // ⚠ THE WHOLE POINT: ONE COPY REACHES EMIT.
  const totalCopies =
    [...q.accept, ...q.guidance].filter((l) => l.text === "Allow 306 (kg)").length +
    q.requiresRuling.filter((l) => l.text === "Allow 306 (kg)").length;
  t("across the WHOLE question the sentence exists exactly once",
    totalCopies === 1, totalCopies);

  // ⚠ AND THE AUDIT STOPS REPORTING WHAT HAS BEEN RESTORED.
  const auditedAfter = auditArtefact([{
    questionNumber: "T", points: [{ pointCode: "M1", criterion: "x" }],
    accept: q.accept, guidance: q.guidance, requiresRuling: q.requiresRuling,
  }]);
  t("a restored line is no longer reported as misfiled",
    !auditedAfter.findings.some((f) => f.text === "Allow 306 (kg)"),
    auditedAfter.findings.map((f) => f.text));
  t("...while a still-buried one is",
    auditedAfter.findings.some((f) => f.text === "Allow 307000 / 306000 g"));
}

console.log("\n── A WHOLE SWEEP IN ONE PASS ──");
{
  // ⚠ THE BATCH IS THE SAME MOVE, APPLIED TO ONE IN-MEMORY COPY, THEN WRITTEN
  // ONCE. Restoring 58 lines with a page reload each is a sweep nobody
  // finishes — and an unfinished sweep leaves the sentences buried, which is
  // the failure the audit exists to end.
  const sweep = () => ({
    accept: [{ text: "Allow 306 (kg)" }, { text: "Ignore any names even if incorrect" }],
    guidance: [{ text: "307 (kg)" }],
    reject: [{ text: "Do not award ions move" }],
    requiresRuling: [] as { text: string; sourceLine: string; requiresRuling?: string[] }[],
  });

  const q = sweep();
  const wanted = ["Allow 306 (kg)", "307 (kg)", "Do not award ions move",
                  "Ignore any names even if incorrect"];
  const results = wanted.map((text) => moveLineToRuling(q, text));

  t("every selected line moves", results.every((r) => r.ok), results);
  t("all four are in the queue", q.requiresRuling.length === 4, q.requiresRuling.length);
  t("...each exactly once",
    new Set(q.requiresRuling.map((l) => l.text)).size === 4);
  t("every bucket is emptied of what was taken",
    q.accept.length === 0 && q.guidance.length === 0 && q.reject.length === 0,
    { accept: q.accept.length, guidance: q.guidance.length, reject: q.reject.length });
  t("each records which bucket it came from",
    q.requiresRuling.every((l) => (l.requiresRuling ?? []).some((r) => /filed under/.test(r))));

  // ⚠ A PARTIAL SELECTION LEAVES THE REST ALONE — the panel lets the founder
  // sweep one question at a time, and the untouched lines must stay put.
  const partial = sweep();
  moveLineToRuling(partial, "307 (kg)");
  t("an unselected line stays in its bucket",
    partial.accept.length === 2 && partial.reject.length === 1,
    { accept: partial.accept.length, reject: partial.reject.length });
  t("...and only the selected one is queued", partial.requiresRuling.length === 1);

  // ⚠ ONE BAD ENTRY DOES NOT SINK THE BATCH. The caller reports it and keeps
  // the rest; a sweep that aborted on the first oddity would be unusable too.
  const mixed = sweep();
  const outcomes = ["Allow 306 (kg)", "never printed anywhere", "307 (kg)"]
    .map((text) => moveLineToRuling(mixed, text));
  t("the good ones still move", outcomes[0].ok && outcomes[2].ok);
  t("the bad one is refused, with a reason",
    !outcomes[1].ok && (outcomes[1] as { error: string }).error.length > 10, outcomes[1]);
  t("...and the batch still restored two", mixed.requiresRuling.length === 2);

  // ⚠ RE-SWEEPING A DONE QUESTION MUST NOT DOUBLE ANYTHING.
  const again = wanted.map((text) => moveLineToRuling(q, text));
  t("a second sweep over the same question moves nothing",
    again.every((r) => !r.ok), again);
  t("...and the queue is still exactly four", q.requiresRuling.length === 4);
}

console.log("\n── A PARTIAL SUCCESS IS NOT A SUCCESS ──");
{
  // ⚠ THE FAILURE THIS PINS. toFixture returned {ok:true, questions} and threw
  // its refusals away whenever anything emitted. 23(a)(iii) — an image-answer
  // cell whose two points had empty criteria — was refused three times and the
  // emitter reported "47 questions" without a word. Two marks left a paper the
  // screen called 48/48 approved.
  const emit = toFixture(set as never, (set as unknown as { rulings: RulingBook }).rulings ?? {});
  t("something emitted", emit.ok === true);
  t("...and refusals are STILL REPORTED alongside the success",
    emit.ok && Array.isArray(emit.refusals), emit.ok ? typeof emit.refusals : "");
  // ⚠ NOT "23(a)(iii) IS REFUSED". It was, until it was hand-transcribed; an
  // assertion pinned to the broken state fails the moment the break is fixed,
  // and one pinned to the fixed state would have hidden the break. The
  // invariant that holds in BOTH directions is that a refusal, if there is
  // one, names a question that is genuinely absent from the emitted set.
  t("every refusal names a question that is NOT in the emitted set",
    emit.ok && emit.refusals.every((r) => {
      const named = /^([^:]+?)(?: [A-Z]\d+)?:/.exec(r)?.[1]?.trim();
      return !named || !emit.questions.some((x) => x.questionNumber === named);
    }),
    emit.ok ? emit.refusals : "");
  t("...and conversely, nothing emitted is silently short of a criterion",
    emit.ok && emit.questions.every((x) =>
      x.markScheme.length > 0 && x.markScheme.some((pt) => pt.criterion.trim().length > 0)),
    emit.ok ? emit.questions.filter((x) => !x.markScheme.some((pt) => pt.criterion.trim())).map((x) => x.questionNumber) : "");

  // ⚠ AND THE EMITTED FILE SAYS SO IN ITS OWN HEADER, because the reviewer may
  // read the file rather than the screen.
  const src = emitFixtureSource(emit, "unit-1-may-june-2025", "2026-08-18T00:00:00.000Z", STAMP);
  // ⚠ THE HEADER'S NUMBERS ARE RECOMPUTED FROM THE EMITTED DATA, not compared
  // against a constant. A header that agreed with a hardcoded 48/80 would stop
  // meaning anything the day a different paper was emitted.
  const emittedCount = emit.ok ? emit.questions.length : 0;
  const emittedMarks = emit.ok ? emit.questions.reduce((n, x) => n + x.marks, 0) : 0;
  t("the header's counts equal the sums computed from the emitted questions",
    src.includes(`${emittedCount} question(s), ${emittedMarks} mark(s)`),
    src.split("\n").find((l) => /question\(s\), /.test(l)));
  t("...and a refusal block appears exactly when there are refusals",
    /REFUSAL\(S\)/.test(src) === (emit.ok ? emit.refusals.length > 0 : true),
    { inHeader: /REFUSAL\(S\)/.test(src), count: emit.ok ? emit.refusals.length : "n/a" });
  t("...names the question", /23\(a\)\(iii\)/.test(src));
  t("...and states the emitted mark total to check against the paper",
    /mark\(s\)/.test(src), src.split("\n").find((l) => /mark\(s\)/.test(l)));
}

console.log("\n── THE EMITTED FILE IS A REAL MODULE ──");
{
  const emit = toFixture(set as never, (set as unknown as { rulings: RulingBook }).rulings ?? {});
  const src = emitFixtureSource(emit, "unit-1-may-june-2025", "2026-08-18T00:00:00.000Z", STAMP);

  // ⚠ IT USED TO BE PASTE-IN FRAGMENTS — bare `markScheme: [...]` properties
  // with no wrapper and no export. It did not parse, could not be imported,
  // and turned `npm run typecheck` red the moment a paper was emitted, while
  // the emitter's docstring claimed the seeder consumed it.
  t("it exports a named const", /^export const [A-Z0-9_]+: FixtureQuestion\[\] = \[$/m.test(src),
    src.split("\n").find((l) => l.startsWith("export const")));
  t("the identifier is derived from the slug",
    src.includes(`export const ${identifierFor("unit-1-may-june-2025")}`));
  t("it type-imports the shape it claims", /^import type \{ FixtureQuestion \}/m.test(src));
  t("every entry carries its question number as DATA, not a comment",
    (src.match(/^\s+questionNumber: "/gm) ?? []).length === (emit.ok ? emit.questions.length : -1),
    (src.match(/^\s+questionNumber: "/gm) ?? []).length);
  t("...and its tariff", (src.match(/^\s+marks: \d+,$/gm) ?? []).length === (emit.ok ? emit.questions.length : -1));
  t("it closes the array", /^\];$/m.test(src));
  t("it warns against hand-editing", /GENERATED\. Do not edit/.test(src));

  // ⚠ BALANCED BRACKETS ARE NOT ENOUGH, AND SABOTAGE PROVED IT. Replacing the
  // quoter with a raw `"${s}"` left every bracket balanced while emitting an
  // unterminated string literal three lines long — the exact bug that shipped.
  const body = src.split("\n").filter((l) => !l.trim().startsWith("//"));
  const open = (body.join("\n").match(/[[{]/g) ?? []).length;
  const close = (body.join("\n").match(/[\]}]/g) ?? []).length;
  t("brackets balance", open === close, { open, close });

  // ⚠ NO STRING MAY SPAN A LINE. A raw newline inside a double-quoted literal
  // leaves that line with an ODD number of unescaped quotes, which is exactly
  // what a multi-line `guidance` produced before the quoter used
  // JSON.stringify.
  const oddQuoteLines = body.filter(
    (l) => ((l.match(/(?<!\\)"/g) ?? []).length % 2) === 1);
  t("every emitted string closes on its own line",
    oddQuoteLines.length === 0, oddQuoteLines.slice(0, 2));

  // And the live case that broke it: a multi-line guidance value.
  t("a multi-line guidance is escaped, not split",
    !/guidance: "[^"]*$/m.test(body.join("\n")),
    body.filter((l) => /guidance: "/.test(l)).slice(0, 1));
  t("...and its newlines survive as \\n",
    src.includes("\\n") || !src.includes("guidance:"),
    body.find((l) => /guidance: /.test(l)));

  t("identifierFor handles a leading digit", identifierFor("2025-paper").startsWith("PAPER_"));
  t("identifierFor uppercases and underscores", identifierFor("unit-1-may-june-2025") === "UNIT_1_MAY_JUNE_2025");

  // A refusal-only emit still returns something a human can read.
  const none = emitFixtureSource({ ok: false, refusals: ["X: not approved"] }, "s", "t", STAMP);
  t("a total refusal explains itself", /NOTHING EMITTED/.test(none) && /X: not approved/.test(none));
}

console.log("\n── ACCEPTING NOTHING IS NOT A RULING ──");
{
  // ⚠ HOW 23(a)(iii) WAS LOST: "Accept as-is" on a card with no text accepts
  // the empty string, so the question read as fully ruled and was approved.
  const blank = { questionNumber: "T", points: [{ pointCode: "M1", criterion: "" }] };
  t("accept-as-is on an empty criterion does NOT resolve the point",
    !pointsFullyRuled(blank as never, { points: { M1: { verdict: "accept" } }, lines: {} }));
  t("...nor does an edit that supplies nothing",
    !pointsFullyRuled(blank as never, { points: { M1: { verdict: "edit", criterion: "  " } }, lines: {} }));
  t("an EDIT that supplies the words DOES resolve it",
    pointsFullyRuled(blank as never, {
      points: { M1: { verdict: "edit", criterion: "a hand-transcribed criterion" } }, lines: {} }));
  t("a reject resolves it too — the point was looked at",
    pointsFullyRuled(blank as never, { points: { M1: { verdict: "reject", why: "not a point" } }, lines: {} }));

  // ⚠ AND A NORMAL CARD IS UNAFFECTED, or this rule would block the whole paper.
  const real = { questionNumber: "T", points: [{ pointCode: "M1", criterion: "a real criterion" }] };
  t("accept-as-is still resolves a card that HAS text",
    pointsFullyRuled(real as never, { points: { M1: { verdict: "accept" } }, lines: {} }));

  // The live case, on the real artefact.
  const q = set.questions.find((x) => x.questionNumber === "23(a)(iii)");
  if (q) {
    const book = (set as unknown as { rulings: RulingBook }).rulings?.["23(a)(iii)"];
    // ⚠ LOOKED UP, NOT ASSUMED EITHER WAY. The property is that a question is
    // fully ruled EXACTLY WHEN every one of its points ends up with text —
    // whether that text came from the extractor or from a human typing it in.
    const resolvedText = q.points.every((pt) => {
      const r = book?.points?.[pt.pointCode];
      const text = r?.verdict === "edit" ? r.criterion : pt.criterion;
      return Boolean(text?.trim());
    });
    t("23(a)(iii) is fully ruled exactly when all its points have text",
      pointsFullyRuled(q, book) === resolvedText,
      { fullyRuled: pointsFullyRuled(q, book), allHaveText: resolvedText });
    t("...it carries its 2-mark tariff and is present by lookup",
      q.marks?.value === 2, q.marks?.value);
  }
}

console.log("\n── THE IDENTITY STAMP FAILS LOUDLY, OR NOT AT ALL ──");
{
  const ID = "f7577346-3c45-4b3a-b944-d52542863358";
  const row = { id: ID, paper_code: "WCH11/01", session: "May-June", year: 2025 };

  const ok = stampFrom([row], ID);
  t("one row stamps", ok.ok && ok.stamped.paperCode === "WCH11/01", ok);
  t("...carrying session and year", ok.ok && ok.stamped.session === "May-June" && ok.stamped.year === 2025);

  // ⚠ THE BUG THAT SHIPPED. The first version re-queried by SLUG and stamped
  // only on exactly one row. A slug is unique within a COURSE, not globally —
  // "unit-1-may-june-2025" is Chemistry, Physics AND Biology — so the query
  // matched three, the guard declined to guess, and the stamp was left
  // undefined INSIDE a try/catch that reported success. The header read
  // `paperCode: undefined` under a green "48 question(s), 80 mark(s)".
  const zero = stampFrom([], ID);
  t("ZERO rows is a refusal, not an empty stamp", !zero.ok, zero);
  t("...naming the id it could not find", !zero.ok && zero.error.includes(ID), zero);
  t("...and saying nothing was emitted", !zero.ok && /Nothing was emitted|No past_papers/.test(zero.error));

  const many = stampFrom([row, { ...row }], ID);
  t("MULTIPLE rows is a refusal, not the first one", !many.ok, many);
  t("...saying the identity is not unique",
    !many.ok && /not unique/.test(many.error), many);

  // ⚠ A ROW THAT EXISTS BUT IS INCOMPLETE IS ALSO A REFUSAL. Stamping
  // `paperCode: null` would put a hole in a file that claims to be complete.
  for (const [field, bad] of [
    ["paper_code", { ...row, paper_code: null }],
    ["session", { ...row, session: null }],
    ["year", { ...row, year: null }],
  ] as const) {
    const r = stampFrom([bad], ID);
    t(`a row missing ${field} refuses`, !r.ok, r);
    t(`   ...and names ${field}`, !r.ok && r.error.includes(field), r);
  }

  // ⚠ AND THE HEADER CAN NO LONGER CARRY undefined AT ALL. The stamp is a
  // REQUIRED argument, so a partial one is a compile error rather than a hole
  // — but assert the rendered output too, since that is what a person reads.
  const emit = toFixture(set as never, (set as unknown as { rulings: RulingBook }).rulings ?? {});
  const src = emitFixtureSource(emit, "unit-1-may-june-2025", "2026-08-19T00:00:00.000Z", STAMP);
  t("the emitted header carries a real paperCode", /paperCode: "WCH11\/01"/.test(src),
    src.split("\n").find((l) => /paperCode:/.test(l)));
  t("...a real session", /session: "May-June"/.test(src));
  t("...a real year", /year: 2025,/.test(src));
  t("...and the word `undefined` appears nowhere in it",
    !src.includes("undefined"),
    src.split("\n").filter((l) => l.includes("undefined")).slice(0, 2));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
