/**
 * The review accelerator: fast to confirm, never decided for you.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/review-accelerator.test.ts
 *
 * ============================================================================
 * WHAT IS BEING PROTECTED
 * ============================================================================
 * The founder is the signing examiner. Every mark a student receives rests on
 * a decision a person made, and this build exists to make those decisions fast
 * to CONFIRM — never to make them. So most of what follows is negative space:
 * a suggestion is not a ruling, a batch never touches ruled work, an approved
 * question is finished, and a line that might be carrying a flattened
 * superscript goes to a human whatever the bytes say.
 *
 * ⚠ FIXTURES AND THE REPO'S OWN ARTEFACT. No credentials, no database, and
 * every assertion that models the real paper DERIVES from it (AGENTS.md).
 * This suite opens the artefact read-only and writes nothing.
 */
import { readFileSync } from "node:fs";

import {
  suggestFor,
  matchPrecedent,
  classifyByVerb,
  superscriptRisk,
  canAutoVerify,
  spotCheckIndices,
  planBatch,
  mergeBatchIntoBook,
  SPOT_CHECK_FLOOR,
  CONFIDENCE_FLOOR,
  type PrecedentStore,
  type LineRulingLike,
} from "../../../src/lib/exam/precedent.ts";
import {
  isResolved,
  pointsFullyRuled,
  toFixture,
  buildReview,
  reconcileTariffs,
  tariffShortfalls,
  type ProposalSet,
  type RulingBook,
} from "../../../src/lib/exam/markscheme-proposals.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const ARTEFACT = "scripts/exam-seed/proposals/unit-1-may-june-2025.markscheme.json";
const file = JSON.parse(readFileSync(ARTEFACT, "utf8")) as ProposalSet & { rulings?: RulingBook };
const STORE = (JSON.parse(readFileSync("scripts/exam-seed/precedents.json", "utf8")) as PrecedentStore);
const P = STORE.precedents;
const keyOf = (q: { points: readonly { criterion: string }[] }) => {
  for (const p of q.points) {
    const m = /only correct answer is\s+([A-D])/i.exec(p.criterion);
    if (m) return m[1];
  }
  return null;
};

console.log("── THE PRECEDENT STORE IS A REVIEWABLE FILE ──");
{
  t("it is versioned", STORE.version >= 1);
  t("the four canon precedents are present",
    ["P1", "P2", "P3", "P4"].every((id) => P.some((p) => p.id === id)), P.map((p) => p.id));
  t("every precedent carries a rationale a human can argue with",
    P.every((p) => p.rationale.length > 40));
  t("every pattern compiles", P.every((p) => { try { new RegExp(p.pattern, "i"); return true; } catch { return false; } }));
  t("every precedent says where it came from", P.every((p) => Boolean(p.source)));
  // ⚠ ORDER IS THE TIE-BREAK. P3 must precede P2 and the verb rules, or
  // "Allow TE throughout" reads as an Accept — see below.
  t("P3 is ordered before P2",
    P.findIndex((p) => p.id === "P3") < P.findIndex((p) => p.id === "P2"), P.map((p) => p.id));
}

console.log("\n── THE MATCHER, ON THE REAL PAPER ──");
{
  const q1 = file.questions.find((q) => q.questionNumber === "1")!;
  const s = matchPrecedent(q1.requiresRuling[0].text, P, keyOf(q1));
  t("P1 matches a wrong-option explanation", s?.precedentId === "P1", s);
  t("...with the verdict distractor_feedback", s?.verdict === "distractor_feedback");
  t("...and names the option letter", s?.option === "A", s?.option);
  t("the reason is legible, not a score",
    typeof s?.reason === "string" && /P1/.test(s!.reason), s?.reason);

  // ⚠ ORDERING, PROVEN. "Allow TE throughout" opens with Allow; the verb
  // classifier alone calls it Accept, which would file a scope rule as a
  // concession. P3 must win.
  t("verb classifier alone would call 'Allow TE throughout' an accept",
    classifyByVerb("Allow TE throughout")?.verdict === "guidance" ||
    classifyByVerb("Allow TE throughout")?.verdict === "accept");
  t("but the precedent store rules it Guidance",
    suggestFor("Allow TE throughout", P, null)?.verdict === "guidance",
    suggestFor("Allow TE throughout", P, null));

  // Near-miss non-matches: ordinary prose that must NOT read as a distractor.
  t("'A student who writes…' is not a distractor",
    matchPrecedent("A student who writes mol dm-3 gains the mark", P, null)?.precedentId !== "P1");
  t("'Accept 2.5…' is not a distractor",
    matchPrecedent("Accept 2.5 to 2 significant figures", P, null)?.precedentId !== "P1");
  t("'D is the correct answer' is not a distractor",
    matchPrecedent("D is the correct answer", P, null)?.precedentId !== "P1");
  t("an unmatched line yields nothing at all",
    matchPrecedent("Award the mark for a balanced equation", P, null) === null);
}

console.log("\n── EVERY UNRULED LINE IN THE PAPER GETS THE INTENDED PRECEDENT ──");
{
  const expected: Record<string, string> = {
    "Ignore SF except 1 SF": "P2",
    "TE on M1 and M2 but no TE from M3 to M4": "P3",
    "Correct answer with no working scores (4)": "P4",
    "If all six operations have not been carried out ignore SF": "P2",
    "Allow TE throughout": "P3",
    "TE throughout, but final answer must be less than": "P3",
    "Correct answer with some working scores 3": "P4",
    "Ignore SF except for 1 SF": "P2",
  };
  // ⚠ NOT "THE LINES THAT ARE STILL UNRULED". They all are ruled now — the
  // founder finished the paper — and a loop over the unruled set silently
  // became a loop over nothing, which is a test that passes by doing no work.
  // These eight lines are checked because they EXIST in the paper, whatever
  // their ruling state.
  const present: { q: string; text: string }[] = [];
  for (const q of file.questions) {
    for (const l of q.requiresRuling) {
      if (expected[l.text]) present.push({ q: q.questionNumber, text: l.text });
    }
  }
  t("all eight scope lines are present in the paper",
    present.length === Object.keys(expected).length, present.length);
  for (const u of present) {
    const want = expected[u.text];
    const got = suggestFor(u.text, P, null);
    t(`Q${u.q}: "${u.text.slice(0, 42)}…" -> ${want}`, got?.precedentId === want, got);
    t(`   …and its verdict is Guidance`, got?.verdict === "guidance", got?.verdict);
  }
}

console.log("\n── THE SUPERSCRIPT TRAP ──");
{
  // ⚠ THE LIVE CASE THE SPEC NAMES. "1.672 × 10²¹" reaches the text layer as
  // "1.672 × 1021". Proposal and source agree perfectly and are both wrong.
  const flattened = "1.672 × 1021";
  t("the 1.672 × 1021 case is byte-identical to its source",
    flattened === flattened);
  const decision = canAutoVerify(flattened, flattened);
  t("...and is REFUSED auto-verification anyway", decision.eligible === false, decision);
  t("...flagged as superscript-risk, manual only",
    !decision.eligible && decision.risky && /superscript-risk/.test(decision.reason),
    !decision.eligible ? decision.reason : "");

  const cases: [string, string][] = [
    ["scientific notation", "1.672 × 1021"],
    ["scientific notation", "6.02 x 1023 mol-1"],
    ["letter-then-digit", "C11H24"],
    ["digit-then-letter", "79Br atom"],
    ["letter-then-digit", "concentration in mol dm3"],
    ["reaction arrow", "N2 + 3H2 → 2NH3"],
    ["charge after digit", "the 81Br- ion"],
    ["charge before digit", "a charge of -2 overall"],
  ];
  for (const [why, text] of cases) {
    const r = superscriptRisk(text);
    t(`"${text}" is risky (${why})`, r.risky, r);
    t(`   …and cannot be auto-verified`, canAutoVerify(text, text).eligible === false);
  }

  // ⚠ AND SOMETHING MUST STILL PASS, or the exclusion is just "never verify".
  const safe = "The only correct answer is B";
  t("ANTI-VACUITY — plain prose is not flagged", !superscriptRisk(safe).risky, superscriptRisk(safe));
  t("...and IS eligible when byte-identical", canAutoVerify(safe, safe).eligible === true);
  t("...but not when the proposal differs from the source",
    canAutoVerify(safe, safe + " (neutron number 44)").eligible === false);
  t("a differing proposal is refused for MISMATCH, not risk",
    (() => { const d = canAutoVerify(safe, "something else"); return !d.eligible && d.risky === false; })());
}

console.log("\n── THE SPOT-CHECK QUEUE ──");
{
  t("nothing to check yields nothing", spotCheckIndices(0).length === 0);
  t("fewer than the floor: every one is checked", spotCheckIndices(2).length === 2);
  t("exactly the floor: all three", spotCheckIndices(3).length === 3);
  // ⚠ 10% OF 40 IS 4, WHICH IS ABOVE THE FLOOR.
  t("40 cards -> 4 checked", spotCheckIndices(40).length === 4, spotCheckIndices(40));
  t("100 cards -> 10 checked", spotCheckIndices(100).length === 10);
  // ⚠ THE FLOOR BITES WHERE THE PERCENTAGE WOULD NOT.
  t("10 cards -> 3 checked, not 1", spotCheckIndices(10).length === SPOT_CHECK_FLOOR, spotCheckIndices(10));
  t("indices are unique", new Set(spotCheckIndices(40)).size === 4);
  t("indices are in range", spotCheckIndices(40).every((i) => i >= 0 && i < 40));
  t("indices are sorted", JSON.stringify(spotCheckIndices(40)) === JSON.stringify([...spotCheckIndices(40)].sort((a, b) => a - b)));
  // ⚠ DETERMINISTIC. A queue that resamples mid-check changes under the hands.
  t("the same input gives the same queue every time",
    JSON.stringify(spotCheckIndices(37)) === JSON.stringify(spotCheckIndices(37)));
  // ⚠ SPREAD, NOT THE FIRST N — which would only ever check the top of a paper.
  t("the sample is spread across the paper, not clustered at the top",
    Math.max(...spotCheckIndices(100)) > 50, spotCheckIndices(100));
}

console.log("\n── A SUGGESTION IS NOT A RULING ──");
{
  const q = file.questions.find((x) => x.questionNumber === "20(a)")!;
  const line = q.requiresRuling[0];
  const s = suggestFor(line.text, P, null);
  t("this line HAS a suggestion", Boolean(s), s);

  // ⚠ THE POINT. A suggested line is unruled everywhere that matters.
  const noRulings: RulingBook = {};
  t("isResolved says an absent ruling is unresolved", !isResolved(undefined));
  t("the question still counts the line as unruled",
    buildReview({ ...file, questions: [q] }, noRulings)[0].unruled.length === q.requiresRuling.length,
    buildReview({ ...file, questions: [q] }, noRulings)[0].unruled.length);
  t("pointsFullyRuled is false — a suggestion verifies nothing",
    !pointsFullyRuled(q, noRulings[q.questionNumber]));
  const emit = toFixture({ ...file, questions: [q] }, {
    "20(a)": { points: {}, lines: {}, approvedAt: "2026-08-17T00:00:00.000Z", approvedBy: "test" },
  });
  t("Emit REFUSES the question by name",
    emit.ok === false && emit.refusals.some((r) => r.startsWith("20(a):")),
    emit.ok ? "" : emit.refusals);
  t("...naming the unruled lines specifically",
    emit.ok === false && emit.refusals.some((r) => /still unruled/.test(r)),
    emit.ok ? "" : emit.refusals);
}

console.log("\n── THE SUGGESTER NEVER SAYS DISCARD, AND NEVER GUESSES ──");
{
  // ⚠ A WRONG DISCARD DESTROYS CONTENT SILENTLY — every other wrong verdict
  // still shows the text on the question.
  const probes = [
    "Ignore SF except 1 SF", "Allow TE throughout", "Do not accept bromine atom",
    "Reject 2.5", "Correct answer with no working scores (4)", "Award one mark for the equation",
    "A is incorrect because x", "Accept 2.5", "some entirely unclassifiable prose here",
    "", "   ", "M1 the correct answer is B",
  ];
  t("no input produces a Discard suggestion",
    probes.every((x) => suggestFor(x, P, null)?.verdict !== "discard"),
    probes.map((x) => [x.slice(0, 20), suggestFor(x, P, null)?.verdict]));

  // ⚠ THE ASSERTION ABOVE IS NOT ENOUGH ON ITS OWN, AND THAT WAS FOUND BY
  // SABOTAGE. Every probe in it matches a PRECEDENT first, so it never reaches
  // the verb classifier — pointing a verb rule at Discard left it green. The
  // guard has to be exercised where it actually lives, so the classifier is
  // called DIRECTLY, over every line in the real paper as well as the probes.
  const everyLine = [
    ...probes,
    ...file.questions.flatMap((q) => q.requiresRuling.map((l) => l.text)),
    ...file.questions.flatMap((q) => q.points.map((pt) => pt.criterion)),
  ];
  t("the corpus reaching the verb classifier is substantial", everyLine.length > 100, everyLine.length);
  t("classifyByVerb NEVER returns Discard, on any line in the paper",
    everyLine.every((x) => classifyByVerb(x)?.verdict !== "discard"),
    everyLine.filter((x) => classifyByVerb(x)?.verdict === "discard").slice(0, 3));
  t("...nor does suggestFor, on any line in the paper",
    everyLine.every((x) => suggestFor(x, P, keyOf({ points: [] }))?.verdict !== "discard"),
    everyLine.filter((x) => suggestFor(x, P, null)?.verdict === "discard").slice(0, 3));
  // ANTI-VACUITY: the classifier must actually be classifying some of these.
  t("ANTI-VACUITY — the classifier does return verdicts for some of them",
    everyLine.some((x) => classifyByVerb(x) !== null));
  t("unclassifiable prose produces NO suggestion at all",
    suggestFor("some entirely unclassifiable prose here", P, null) === null);
  t("empty text produces no suggestion", suggestFor("", P, null) === null);
  t("every suggestion clears the confidence floor",
    probes.map((x) => suggestFor(x, P, null)).filter(Boolean)
      .every((s) => s!.confidence >= CONFIDENCE_FLOOR));

  // ⚠ NEGATIVES BEFORE POSITIVES. "Do not accept X" contains "accept".
  t("'Do not accept…' is a Reject, not an Accept",
    suggestFor("Do not accept bromine atom", P, null)?.verdict === "reject",
    suggestFor("Do not accept bromine atom", P, null));
  t("'Allow…' is an Accept", suggestFor("Allow 2.5", P, null)?.verdict === "accept");
  t("Criterion is only offered when the line names what earns the mark",
    suggestFor("Award one mark for the balanced equation", P, null)?.verdict === "criterion");
  t("...and ordinary prose is not promoted to Criterion",
    suggestFor("the student may write either form", P, null) === null);
}

console.log("\n── BATCH PLANNING TOUCHES NOTHING IT SHOULD NOT ──");
{
  const q20a = file.questions.find((x) => x.questionNumber === "20(a)")!;
  const q22c = file.questions.find((x) => x.questionNumber === "22(c)")!;
  const qs = [q20a, q22c];

  const plan = planBatch(qs, {}, P, keyOf);
  t("it finds the unruled matches", plan.all.length > 0, plan.all.length);
  t("every candidate carries a precedent id", plan.all.every((c) => Boolean(c.suggestion.precedentId)));
  t("every candidate carries its source location",
    plan.all.every((c) => typeof c.page === "number" && typeof c.y === "number"));
  t("candidates are grouped by precedent", plan.groups.length > 0 && plan.groups.every((g) => g.candidates.length > 0));
  t("each group names the precedent's title", plan.groups.every((g) => g.title.length > 0));

  // ⚠ AN APPROVED QUESTION IS NEVER PLANNED AGAINST.
  const approvedPlan = planBatch(qs, {
    "20(a)": { lines: {}, approvedAt: "2026-08-17T00:00:00.000Z" },
  }, P, keyOf);
  t("an approved question contributes NO candidates",
    approvedPlan.all.every((c) => c.questionNumber !== "20(a)"),
    approvedPlan.all.map((c) => c.questionNumber));
  t("...and the skip is REPORTED, not silent",
    approvedPlan.skipped.some((s) => s.questionNumber === "20(a)" && /approved/.test(s.reason)),
    approvedPlan.skipped);

  // ⚠ AN ALREADY-RULED LINE IS NEVER PLANNED AGAINST.
  const first = q20a.requiresRuling[0];
  const partial = planBatch(qs, {
    "20(a)": { lines: { [first.sourceLine]: { kind: "guidance" } } },
  }, P, keyOf);
  t("a ruled line produces no candidate",
    !partial.all.some((c) => c.sourceLine === first.sourceLine), partial.all.map((c) => c.sourceLine));
  t("...while its unruled siblings still do",
    partial.all.some((c) => c.questionNumber === "20(a)"));

  // ⚠ ONLY WRITTEN PRECEDENTS BATCH. The verb classifier advises one card at a
  // time, where it is read; it never drives a bulk write.
  const verbOnly = planBatch([{
    questionNumber: "X", points: [],
    requiresRuling: [{ sourceLine: "s", text: "Allow 2.5 as an answer", page: 1, y: 1 }],
  }], {}, P, keyOf);
  t("a verb-classifier-only match is NOT batchable",
    verbOnly.all.length === 0, verbOnly.all);
  t("...even though it does produce a suggestion on the card",
    suggestFor("Allow 2.5 as an answer", P, null)?.verdict === "accept");
}

console.log("\n── WHAT A BATCH CONFIRM ACTUALLY WRITES ──");
{
  const R = (r: LineRulingLike) => isResolved(r as never);

  const fresh = mergeBatchIntoBook(undefined, [
    { sourceLine: "a", kind: "guidance", precedentId: "P2" },
    { sourceLine: "b", kind: "guidance", precedentId: "P3" },
  ], R);
  t("both are written", fresh.added === 2, fresh);
  t("provenance records the batch route", fresh.lines.a.provenance?.method === "batch");
  t("...and which precedent decided it", fresh.lines.a.provenance?.precedentId === "P2");
  t("each line keeps its own precedent", fresh.lines.b.provenance?.precedentId === "P3");

  // ⚠ AN APPROVED QUESTION: NOTHING IS WRITTEN, AND IT IS SAID SO.
  const onApproved = mergeBatchIntoBook(
    { lines: { z: { kind: "accept" } }, approvedAt: "2026-08-17T00:00:00.000Z" },
    [{ sourceLine: "a", kind: "guidance", precedentId: "P2" }], R);
  t("nothing is added to an approved question", onApproved.added === 0);
  t("...its existing rulings are untouched",
    JSON.stringify(onApproved.lines) === JSON.stringify({ z: { kind: "accept" } }), onApproved.lines);
  t("...and the refusal names the reason",
    onApproved.skipped[0]?.reason === "question already approved", onApproved.skipped);

  // ⚠ AN ALREADY-RULED LINE IS LEFT EXACTLY AS IT WAS.
  const existing = { kind: "criterion" as const, provenance: { method: "manual" as const } };
  const onRuled = mergeBatchIntoBook({ lines: { a: existing } },
    [{ sourceLine: "a", kind: "guidance", precedentId: "P2" }], R);
  t("a ruled line is not overwritten", onRuled.lines.a.kind === "criterion", onRuled.lines.a);
  t("...its manual provenance survives", onRuled.lines.a.provenance?.method === "manual");
  t("...nothing was counted as added", onRuled.added === 0);
  t("...and the skip is reported", /already ruled/.test(onRuled.skipped[0]?.reason ?? ""), onRuled.skipped);

  // ⚠ A DISTRACTOR WITH NO OPTION IS NOT WRITTEN.
  const noOption = mergeBatchIntoBook(undefined,
    [{ sourceLine: "a", kind: "distractor_feedback", precedentId: "P1" }], R);
  t("an option-less distractor is refused", noOption.added === 0, noOption);
  t("...and says the founder must pick the letter",
    /option letter/.test(noOption.skipped[0]?.reason ?? ""), noOption.skipped);
  const withOption = mergeBatchIntoBook(undefined,
    [{ sourceLine: "a", kind: "distractor_feedback", option: "C", precedentId: "P1" }], R);
  t("...while one WITH a letter is written", withOption.added === 1);
  t("...carrying the option", withOption.lines.a.option === "C");
  t("...and resolving", isResolved(withOption.lines.a as never));

  // ⚠ NOTHING CONFIRMED, NOTHING WRITTEN. An empty confirm is not a no-op bug.
  const none = mergeBatchIntoBook({ lines: { a: existing } }, [], R);
  t("an empty confirmation writes nothing", none.added === 0 && none.skipped.length === 0);
  t("...and leaves the book intact", none.lines.a.kind === "criterion");
}

console.log("\n── RETRODICTION AGAINST THE FOUNDER'S OWN RULINGS ──");
{
  const rows: { q: string; text: string; actual: string; actualOpt?: string; sug?: string; sugOpt?: string }[] = [];
  for (const q of file.questions) {
    const book = (file.rulings ?? {})[q.questionNumber];
    if (!book) continue;
    for (const l of q.requiresRuling) {
      const ruled = book.lines?.[l.sourceLine];
      if (!ruled) continue;
      const s = suggestFor(l.text, P, keyOf(q));
      rows.push({ q: q.questionNumber, text: l.text, actual: ruled.kind, actualOpt: ruled.option,
                  sug: s?.verdict, sugOpt: s?.option });
    }
  }
  t("there is a corpus to retrodict against", rows.length > 0, rows.length);
  const disagreements = rows.filter((r) => r.sug !== undefined && r.sug !== r.actual);
  const wrongOption = rows.filter((r) => r.sug === r.actual && r.actualOpt !== undefined && r.sugOpt !== r.actualOpt);

  // ⚠ THE REGRESSION GUARD. This is the number the founder is being asked to
  // trust; if a precedent edit breaks it, the suite says so by name.
  t("the suggester disagrees with the examiner on NO ruled line",
    disagreements.length === 0,
    disagreements.map((d) => ({ q: d.q, examiner: d.actual, suggested: d.sug, text: d.text.slice(0, 60) })));
  t("every option letter it proposed matches the examiner's",
    wrongOption.length === 0,
    wrongOption.map((d) => ({ q: d.q, examiner: d.actualOpt, suggested: d.sugOpt })));

  // ⚠ THE COVERAGE CAVEAT, PINNED AS AN ASSERTION — AND IT HAS ALREADY FIRED
  // ONCE, WHICH IS THE POINT.
  //
  // It first read "the corpus is a single verdict kind", because every ruled
  // line was distractor feedback and the agreement figure therefore validated
  // P1 and nothing else. When 20(a) was ruled — three scope lines, all
  // Guidance — this assertion went red and forced the claim to be rewritten
  // instead of quietly inheriting a number that no longer meant what it said.
  //
  // What is validated against real examiner decisions TODAY:
  //   distractor_feedback (P1)        60 lines
  //   guidance            (P2/P3/P4)   3 lines
  // What is NOT: accept, reject and criterion. No line in this paper has been
  // ruled any of those, so the verb classifier's Accept/Reject/Criterion arms
  // have never been checked against a human. When the first one is ruled, this
  // fails again and the claim gets rewritten again.
  const kinds = [...new Set(rows.map((r) => r.actual))].sort();
  t("COVERAGE CAVEAT: the ruled corpus covers exactly these verdict kinds",
    JSON.stringify(kinds) === JSON.stringify(["distractor_feedback", "guidance"]), kinds);
  t("...distractor feedback is validated on a substantial corpus",
    rows.filter((r) => r.actual === "distractor_feedback").length >= 60);
  t("...guidance is validated, but on very few lines — treat P2/P3/P4 as young",
    rows.filter((r) => r.actual === "guidance").length >= 3 &&
    rows.filter((r) => r.actual === "guidance").length < 10,
    rows.filter((r) => r.actual === "guidance").length);
  t("...and accept/reject/criterion remain UNVALIDATED by any human ruling",
    !kinds.some((k) => ["accept", "reject", "criterion"].includes(k)), kinds);
}

console.log("\n── THE MARKS EDEXCEL'S TYPESETTING LOST ──");
{
  // ⚠ DERIVED FROM THE ARTEFACT. The blocks all look fine individually; only
  // the arithmetic knows one is missing.
  // ⚠ THE GAP HAS BEEN CLOSED, SO THE TEST NOW RUNS IN BOTH DIRECTIONS. The
  // founder hand-entered 21(b)(i) through the review surface; asserting "one
  // question does not add up" would now fail for the best possible reason.
  t("the paper reconciles today", tariffShortfalls(file).length === 0,
    tariffShortfalls(file).map((r) => r.question));
  t("21(b)(i) is present, and hand-transcribed",
    file.questions.find((q) => q.questionNumber === "21(b)(i)")?.marks?.derivedFrom === "hand-transcribed");

  // ⚠ AND THE GUARD IS STILL SHOWN TO BITE, by removing it again in memory.
  // Otherwise "it reconciles" is a claim no failing case supports.
  const withoutBlock: ProposalSet = {
    ...file, questions: file.questions.filter((q) => q.questionNumber !== "21(b)(i)"),
  };
  const short = tariffShortfalls(withoutBlock);
  t("remove the hand-added block and exactly one question stops adding up",
    short.length === 1, short.map((r) => r.question));
  const q21 = short[0];
  t("it is Q21", q21.question === "21", q21.question);
  t("the paper prints 13", q21.printed === 13, q21.printed);
  t("the blocks add to 11 without it", q21.extracted === 11, q21.extracted);
  t("so 2 marks would be missing", q21.shortfall === 2, q21.shortfall);
  t("...while its siblings are present",
    ["21(a)", "21(b)(ii)", "21(c)(i)"].every((n) => file.questions.some((q) => q.questionNumber === n)));

  // ⚠ THE GUARD MUST RECOGNISE A HAND-TRANSCRIBED BLOCK CLOSING THE GAP. A
  // mark a person read off the page is not worth less than one a parser found.
  const withBlock: ProposalSet = {
    ...withoutBlock,
    questions: [...withoutBlock.questions, {
      questionNumber: "21(b)(i)",
      page: 19,
      marks: { value: 2, page: 19, y: 0, sourceLine: "21(b)(i) — transcribed by hand (2 marks)", derivedFrom: "hand-transcribed", confidence: 1 },
      points: [{ page: 19, y: 0, sourceLine: "M1", derivedFrom: "hand-transcribed", confidence: 1,
                 pointCode: "M1", criterion: "hand-entered criterion", marks: null, route: 1, methodBlock: null }],
      accept: [], reject: [], guidance: [], requiresRuling: [], marksAvailable: 2,
    }],
  };
  const after = reconcileTariffs(withBlock).find((r) => r.question === "21")!;
  t("adding the block returns Q21 to 13", after.extracted === 13, after.extracted);
  t("...and the shortfall is gone", after.shortfall === 0, after.shortfall);
  t("...so the whole paper reconciles", tariffShortfalls(withBlock).length === 0,
    tariffShortfalls(withBlock).map((r) => r.question));
  t("the added block is marked hand-transcribed in the reconciliation",
    after.blocks.some((b) => b.questionNumber === "21(b)(i)" && b.handTranscribed));
  t("...and the extracted blocks are NOT",
    after.blocks.filter((b) => b.questionNumber !== "21(b)(i)").every((b) => !b.handTranscribed));

  // ⚠ ANTI-VACUITY. A reconciler that always said "fine" would pass the
  // after-check above and miss the before-check entirely.
  t("ANTI-VACUITY — the reconciler reports a shortfall before the block is added",
    tariffShortfalls(withoutBlock).length === 1 && tariffShortfalls(withBlock).length === 0);

  // ⚠ A WRONG TARIFF IS CAUGHT TOO, in the other direction.
  const tooMany: ProposalSet = {
    ...withoutBlock,
    questions: [...withoutBlock.questions, { ...withBlock.questions[withBlock.questions.length - 1],
      marks: { ...withBlock.questions[withBlock.questions.length - 1].marks!, value: 5 } }],
  };
  const over = reconcileTariffs(tooMany).find((r) => r.question === "21")!;
  t("a block with too big a tariff overshoots and is reported",
    over.shortfall === -3, over.shortfall);

  // Every other question already reconciles, which is why one shortfall stands out.
  const rows = reconcileTariffs(file);
  // ⚠ ONE ROW PER PRINTED TOTAL THE EXTRACTOR FOUND — derived, not guessed. It
  // found four "Total for Question N" lines, so four questions can be checked
  // at all. That is itself worth stating: reconciliation covers the questions
  // whose totals were read, and says nothing about the rest.
  t("there is one row per printed total", rows.length === file.questionTotals.length, rows.length);
  t("more than one question is being checked", rows.length > 1, rows.length);
  t("every row carries its contributing blocks", rows.every((r) => Array.isArray(r.blocks)));
  t("the questions NOT covered are visible as an absence, not a pass",
    file.questions.length > rows.length,
    { blocks: file.questions.length, checkable: rows.length });
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
