/**
 * Distractor feedback: kept for the student, invisible to the marking engine.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/distractor-feedback.test.ts
 *
 * ============================================================================
 * WHAT IS BEING PROTECTED
 * ============================================================================
 * "A is incorrect because the number of electrons is for a 79Br atom" is worth
 * keeping — a student who picked A can be told exactly what they did. It is
 * also, precisely, NOT marking content. The whole risk in this feature is that
 * an explanation leaks into the mark scheme and changes a mark: as a criterion
 * it would award one, as a reject it would withhold one, and either way a
 * student's total moves because of a sentence written to explain a mistake.
 *
 * So the assertions below are mostly negative, and they are the point.
 *
 * ============================================================================
 * ⚠ THE MCQ FIXTURE IS DERIVED FROM THE REAL ARTEFACT, NOT TYPED OUT
 * ============================================================================
 * AGENTS.md: a model of production data that is hand-copied pins yesterday's
 * behaviour. Q1's three explanations and its 1-mark tariff are READ from
 * unit-1-may-june-2025.markscheme.json, and the facts the test depends on are
 * asserted separately, so a change to the paper fails loudly and names the
 * number rather than quietly passing.
 *
 * ⚠ READ-ONLY. This suite opens the artefact and never writes it. The rulings
 * it exercises are built in memory.
 */
import { readFileSync } from "node:fs";

import {
  detectOption,
  resolveDistractorOption,
  isValidOption,
  OPTION_ALPHABET,
} from "../../../src/lib/exam/distractor.ts";
import {
  toFixture,
  emitFixtureSource,
  buildReview,
  isResolved,
  nextRevision,
  type ProposalSet,
  type RulingBook,
  type LineRuling,
} from "../../../src/lib/exam/markscheme-proposals.ts";
import {
  sortByQuestionNumber,
  compareQuestionNumbers,
} from "../../../src/lib/exam/question-nav.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const ARTEFACT = "scripts/exam-seed/proposals/unit-1-may-june-2025.markscheme.json";
const file = JSON.parse(readFileSync(ARTEFACT, "utf8")) as ProposalSet & { rulings?: RulingBook };
const Q1 = file.questions.find((q) => q.questionNumber === "1")!;

console.log("── THE FIXTURE IS THE REAL PAPER (facts this suite rests on) ──");
{
  t("Q1 exists in the artefact", Boolean(Q1));
  t("Q1 is worth 1 mark", Q1.marks?.value === 1, Q1.marks?.value);
  t("Q1 has exactly one marking point", Q1.points.length === 1, Q1.points.length);
  t("...whose criterion names B as the only correct answer",
    /only correct answer is\s+B\b/i.test(Q1.points[0].criterion), Q1.points[0].criterion);
  t("Q1 has exactly three lines needing a ruling", Q1.requiresRuling.length === 3,
    Q1.requiresRuling.length);
  t("...and they are the A, C and D explanations",
    Q1.requiresRuling.map((l) => l.text.trim()[0]).join("") === "ACD",
    Q1.requiresRuling.map((l) => l.text.slice(0, 20)));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── (1) A Q1-STYLE MCQ WITH THREE WRONG-OPTION EXPLANATIONS ──");
const detected = Q1.requiresRuling.map((l) => resolveDistractorOption(l.text, "B"));
{
  t("all three are detected without help",
    detected.every((d) => d.status === "detected"), detected);
  t("they resolve to A, C and D — in the paper's own order",
    detected.map((d) => d.option ?? "?").join("") === "ACD", detected.map((d) => d.option));
  t("none of them resolves to B, the correct answer",
    detected.every((d) => d.option !== "B"));
}

/** Q1 ruled the way the acceptance test says it should be. */
const q1Rulings: Record<string, LineRuling> = {};
Q1.requiresRuling.forEach((l, i) => {
  q1Rulings[l.sourceLine] = { kind: "distractor_feedback", option: detected[i].option! };
});
const approvedQ1: RulingBook = {
  "1": {
    points: { [Q1.points[0].pointCode]: { verdict: "accept" } },
    lines: q1Rulings,
    approvedAt: "2026-08-17T00:00:00.000Z",
    approvedBy: "test",
    revision: 3,
  },
};
const emitted = toFixture({ ...file, questions: [Q1] }, approvedQ1);
const fq = emitted.ok ? emitted.questions[0] : null;

console.log("\n── (2) IT DOES NOT INCREASE MARKS ──");
{
  t("emit succeeded", emitted.ok === true, emitted.ok ? "" : emitted);
  t("the tariff is still 1, exactly as extracted", fq?.marks === 1, fq?.marks);
  t("the tariff equals the artefact's own value", fq?.marks === Q1.marks?.value);
  t("the mark scheme still has ONE point, not four",
    fq?.markScheme.length === 1, fq?.markScheme.length);
}

console.log("\n── (3) IT DOES NOT BECOME A CRITERION ──");
{
  const criteria = (fq?.markScheme ?? []).map((p) => p.criterion);
  t("only the original criterion is present", criteria.length === 1, criteria);
  t("no criterion contains an explanation's words",
    !criteria.some((c) => /is incorrect because/i.test(c)), criteria);
  t("the point code is untouched",
    fq?.markScheme[0].pointCode === Q1.points[0].pointCode);
}

console.log("\n── (4) IT DOES NOT BECOME A REJECT RULE (nor accept, nor guidance) ──");
{
  const p = fq?.markScheme[0];
  t("reject is empty", !p?.reject?.length, p?.reject);
  t("accept is empty", !p?.accept?.length, p?.accept);
  t("guidance is empty", !p?.guidance, p?.guidance);
  // ⚠ THE WHOLE MARKING SURFACE, CHECKED AT ONCE. A future field would be
  // caught by this even if the three above were not updated.
  t("no explanation text appears ANYWHERE in the mark scheme",
    !JSON.stringify(fq?.markScheme).includes("is incorrect because"),
    JSON.stringify(fq?.markScheme).slice(0, 160));
}

console.log("\n── (5) THE CORRECT OPTION LETTER IS STORED ──");
{
  t("three distractor entries were emitted", fq?.distractors?.length === 3, fq?.distractors?.length);
  t("their options are A, C, D",
    (fq?.distractors ?? []).map((d) => d.option).join("") === "ACD",
    fq?.distractors?.map((d) => d.option));
  t("each entry keeps the examiner's words",
    (fq?.distractors ?? []).every((d) => /is incorrect because/i.test(d.text)));
  t("the A entry is the A explanation, not merely 'an' explanation",
    /electrons/i.test(fq?.distractors?.find((d) => d.option === "A")?.text ?? ""),
    fq?.distractors?.find((d) => d.option === "A")?.text);
}

console.log("\n── (6) IT REMAINS TRACEABLE TO ITS SOURCE ──");
{
  const lines = Q1.requiresRuling.map((l) => l.sourceLine);
  t("every entry carries its original sourceLine",
    (fq?.distractors ?? []).every((d) => lines.includes(d.sourceLine)),
    fq?.distractors?.map((d) => d.sourceLine));
  t("the sourceLine is the artefact's, so page/y provenance still resolves",
    Q1.requiresRuling.every((l) => typeof l.page === "number" && typeof l.y === "number"));
}

console.log("\n── (7) APPROVAL UNLOCKS ONCE EVERY YELLOW LINE IS RESOLVED ──");
{
  t("a distractor ruling WITH an option counts as resolved",
    isResolved({ kind: "distractor_feedback", option: "A" }));
  // ⚠ AND WITHOUT ONE IT DOES NOT. Otherwise Approve would enable and emit
  // would then refuse — the reviewer told they had finished, and finding out
  // afterwards that they had not.
  t("a distractor ruling WITHOUT an option does NOT",
    !isResolved({ kind: "distractor_feedback" }));
  t("an invalid option does not count either",
    !isResolved({ kind: "distractor_feedback", option: "Z" }) &&
    !isResolved({ kind: "distractor_feedback", option: "" }));
  t("every other kind is resolved as soon as it is chosen",
    ["criterion", "accept", "reject", "guidance", "discard"]
      .every((k) => isResolved({ kind: k as LineRuling["kind"] })));
  t("no ruling at all is not resolved", !isResolved(undefined));

  const review = buildReview({ ...file, questions: [Q1] }, approvedQ1);
  t("Q1 shows 0 remaining rulings once all three are filed",
    review[0].unruled.length === 0, review[0].unruled.length);

  const halfDone: RulingBook = {
    "1": { ...approvedQ1["1"], lines: { ...q1Rulings, [Q1.requiresRuling[0].sourceLine]: { kind: "distractor_feedback" } } },
  };
  t("...and 1 remaining while one option is unanswered",
    buildReview({ ...file, questions: [Q1] }, halfDone)[0].unruled.length === 1);
  t("emit REFUSES that one rather than filing it under no option",
    toFixture({ ...file, questions: [Q1] }, halfDone).ok === false);
}

console.log("\n── (8) EXISTING APPROVED QUESTIONS ARE UNCHANGED ──");
{
  // ⚠ THE FOUNDER'S REAL Q2 RULING, RUN THROUGH THE CHANGED EMITTER.
  const rulings = file.rulings ?? {};
  const real = toFixture(file, rulings);
  t("the founder's approved questions still emit", real.ok === true, real.ok ? "" : real);
  if (real.ok) {
    t("something was actually emitted — an empty pass proves nothing",
      real.questions.length > 0, real.questions.length);

    // ⚠ DERIVED, NOT PINNED. Every claim below is computed from the artefact
    // as it stands, so the founder ruling more questions changes the numbers
    // and not the assertions.
    for (const emittedQ of real.questions) {
      const src = file.questions.find((q) => q.questionNumber === emittedQ.questionNumber)!;
      const book = rulings[emittedQ.questionNumber];
      const wanted = Object.values(book.lines ?? {})
        .filter((r) => r.kind === "distractor_feedback").length;

      t(`Q${emittedQ.questionNumber}: tariff is the extractor's, unchanged`,
        emittedQ.marks === src.marks?.value, { got: emittedQ.marks, want: src.marks?.value });
      t(`Q${emittedQ.questionNumber}: ${wanted} distractor ruling(s) -> ${wanted} entr(y/ies)`,
        (emittedQ.distractors?.length ?? 0) === wanted,
        { got: emittedQ.distractors?.length ?? 0, want: wanted });
      t(`Q${emittedQ.questionNumber}: no explanation reached the mark scheme`,
        !JSON.stringify(emittedQ.markScheme).includes("is incorrect because"));
      t(`Q${emittedQ.questionNumber}: every point still carries a criterion`,
        emittedQ.markScheme.every((pt) => Boolean(pt.criterion.trim())));
    }
  }
  // ⚠ NOT "Q1 HAS NO RULINGS". It had none when this was written; the founder
  // has since ruled Section A, and an assertion pinned to that would fail for
  // a reason that has nothing to do with the code. What matters is that this
  // suite builds its own rulings and never reads or writes theirs.
  t("this suite builds its own rulings rather than borrowing the founder's",
    approvedQ1["1"] !== (file.rulings ?? {})["1"]);
  t("the artefact on disk was not modified by this suite",
    readFileSync(ARTEFACT, "utf8") === JSON.stringify(file, null, 2) + "\n");
}

console.log("\n── (9)+(10) NAVIGATION AND ORDERING ARE UNAFFECTED ──");
{
  // The new kind must not disturb the list j/k walks.
  const items = buildReview(file, file.rulings ?? {});
  const ordered = sortByQuestionNumber(items, (i) => i.question.questionNumber);
  t("every question still appears", ordered.length === file.questions.length, ordered.length);
  t("the list is in canonical exam order",
    ordered.every((it, i) =>
      i === 0 ||
      compareQuestionNumbers(
        ordered[i - 1].question.questionNumber, it.question.questionNumber) <= 0),
    ordered.slice(0, 6).map((i) => i.question.questionNumber));
  t("Q1 is first, so j/k start where the paper does",
    ordered[0].question.questionNumber === "1", ordered[0].question.questionNumber);
  t("j from Q1 lands on Q2", ordered[1].question.questionNumber === "2");
  t("k from Q2 lands back on Q1", ordered[0].question.questionNumber === "1");
  t("20 still precedes 20(a) and 20(a) precedes 20(b)",
    compareQuestionNumbers("20", "20(a)") < 0 && compareQuestionNumbers("20(a)", "20(b)") < 0);
}

console.log("\n── (11)+(12) A RULING SURVIVES A SAVE, A REFRESH AND A RE-OPEN ──");
{
  // A save is a JSON round-trip through the artefact file.
  const stored = JSON.parse(JSON.stringify({ ...file, rulings: approvedQ1 })) as
    ProposalSet & { rulings: RulingBook };
  const reopened = stored.rulings["1"].lines;
  t("the kind survives the round-trip",
    Object.values(reopened).every((r) => r.kind === "distractor_feedback"));
  t("the option survives the round-trip",
    Object.values(reopened).map((r) => r.option).join("") === "ACD",
    Object.values(reopened).map((r) => r.option));
  t("the approval survives", stored.rulings["1"].approvedBy === "test");

  // Re-opening = buildReview over what was stored.
  const back = buildReview({ ...stored, questions: [Q1] }, stored.rulings);
  t("re-opening shows the saved classification, not an empty card",
    back[0].unruled.length === 0 && back[0].ruledCount === 3,
    { unruled: back[0].unruled.length, ruled: back[0].ruledCount });

  // ⚠ AND A SECOND TAB CANNOT SILENTLY OVERWRITE IT. The stored ruling is at
  // revision 3; a tab that last saw revision 0 is a tab that would clobber two
  // saves it never displayed.
  t("a save from a stale tab is refused, not applied",
    nextRevision(stored.rulings["1"], 0).ok === false, nextRevision(stored.rulings["1"], 0));
  t("...while an up-to-date save proceeds to the next revision",
    nextRevision(stored.rulings["1"], 3).ok === true);
}

console.log("\n── (13) EMIT + DRY RUN CARRY DISTRACTORS, NEVER DROP THEM ──");
{
  const source = emitFixtureSource(emitted, "unit-1-may-june-2025", "2026-08-17T00:00:00.000Z");
  t("the generated module mentions every option", /option: "A"/.test(source) &&
    /option: "C"/.test(source) && /option: "D"/.test(source));
  // ⚠ COUNT ENTRIES, NOT SUBSTRINGS. Each distractor now emits `text` AND
  // `sourceLine` — the traceability the DistractorFeedback type requires — and
  // for these lines the two are identical, so a substring count doubled.
  t("the explanations are written out, not summarised",
    (source.match(/^\s+\{ option: /gm) ?? []).length === 3,
    (source.match(/^\s+\{ option: /gm) ?? []).length);
  t("...each carrying its source line for traceability",
    (source.match(/sourceLine: "/g) ?? []).length === 3);
  t("they are labelled as feedback the marking layer never reads",
    /FEEDBACK ONLY/.test(source));
  t("they sit OUTSIDE markScheme",
    source.indexOf("distractors:") > source.indexOf("markScheme:"));

  // ⚠ THE SEEDER READS markScheme. This proves the part it reads is byte-for
  // -byte what it would have been with the feature absent — so a dry run
  // cannot behave differently because distractors are present.
  const withoutDistractors = toFixture({ ...file, questions: [Q1] }, {
    "1": { ...approvedQ1["1"], lines: Object.fromEntries(
      Object.entries(q1Rulings).map(([k]) => [k, { kind: "discard" as const }])) },
  });
  t("control emit (same lines discarded) succeeds", withoutDistractors.ok === true);
  if (withoutDistractors.ok && emitted.ok) {
    t("markScheme is IDENTICAL with and without distractor entries",
      JSON.stringify(withoutDistractors.questions[0].markScheme) ===
        JSON.stringify(emitted.questions[0].markScheme),
      { with: emitted.questions[0].markScheme, without: withoutDistractors.questions[0].markScheme });
    t("marks are identical too",
      withoutDistractors.questions[0].marks === emitted.questions[0].marks);
    t("...and only the discarded run lacks the entries",
      withoutDistractors.questions[0].distractors === undefined);
  }

  // ⚠ NEVER SILENTLY DROPPED. An option-less entry is REPORTED.
  const orphan = toFixture({ ...file, questions: [Q1] }, {
    "1": { ...approvedQ1["1"], lines: { ...q1Rulings,
      [Q1.requiresRuling[1].sourceLine]: { kind: "distractor_feedback" } } },
  });
  // ⚠ IT IS STOPPED AT THE FIRST GATE, NOT THE LAST. isResolved() makes an
  // option-less distractor count as UNRULED, so toFixture refuses at the
  // "still unruled" check before it ever reaches the switch — which is the
  // behaviour the review surface shows too, since both read that predicate.
  // The switch's own guard stays as defence for rulings written into the JSON
  // by hand, bypassing the surface entirely.
  t("an entry with no option is refused, and the refusal names the question",
    orphan.ok === false && orphan.refusals.some((r) => r.startsWith("1:")),
    orphan.ok ? "" : orphan.refusals);
  t("...and nothing was emitted for it — a refusal, never a silent drop",
    orphan.ok === false);
  t("...and the refusal is the unruled gate, which the UI shows identically",
    orphan.ok === false && orphan.refusals.some((r) => /still unruled/.test(r)),
    orphan.ok ? "" : orphan.refusals);
}

console.log("\n── DETECTION REFUSES RATHER THAN GUESSES ──");
{
  t("A is incorrect because…", detectOption("A is incorrect because X").option === "A");
  t("the ellipsis form Pearson prints",
    detectOption("C …is incorrect because the number of neutrons").option === "C");
  t("Option D is incorrect", detectOption("Option D is incorrect because Y").option === "D");
  t("B is wrong because…", detectOption("B is wrong because Z").option === "B");
  t("A is not correct because…", detectOption("A is not correct because W").option === "A");
  t("case is normalised", detectOption("a IS INCORRECT because q").option === "A");

  // ⚠ THE FIRST CHARACTER IS NOT THE OPTION. These are ordinary mark-scheme
  // prose; attaching them to option A would tell a student they were wrong
  // about something they never said.
  t("'A student who writes…' is NOT option A",
    detectOption("A student who writes mol dm-3 gains the mark").option === null);
  t("'Accept 2.5…' is NOT option A",
    detectOption("Accept 2.5 to 2 significant figures").option === null);
  t("'Allow ecf' is NOT option A", detectOption("Allow ecf from 20(a)").option === null);
  t("'Do not accept…' is NOT option D",
    detectOption("Do not accept bromine atom").option === null);

  // ⚠ A POSITIVE STATEMENT IS RECOGNISED AND REFUSED WITH ITS OWN REASON.
  const positive = detectOption("D is the correct answer");
  t("'D is the correct answer' is not a distractor explanation", positive.option === null);
  t("...and the reason SAYS it is a correct-answer line, so it is not hand-filed",
    /is CORRECT/.test(positive.reason), positive.reason);

  // ⚠ TWO OPTIONS IN ONE LINE CANNOT BE FILED UNDER ONE.
  const multi = detectOption("A and C are incorrect because they use the wrong isotope");
  t("'A and C are incorrect' refuses rather than taking the first",
    multi.option === null, multi);
  t("...and says why", /more than one option/i.test(multi.reason), multi.reason);

  t("empty text refuses", detectOption("").option === null);
  t("confidence is 1 or 0, never a guessable middle",
    [detectOption("A is incorrect because x"), detectOption("Accept 5")]
      .every((d) => d.confidence === 1 || d.confidence === 0));
}

console.log("\n── THE CROSS-CHECK AGAINST THE QUESTION'S OWN ANSWER ──");
{
  // ⚠ "B is incorrect" when the scheme says B is correct: one reading is
  // wrong and there is no basis for preferring either. Storing it would tell
  // the student who answered correctly that they were wrong.
  const clash = resolveDistractorOption("B is incorrect because of the neutron count", "B");
  t("a line contradicting the correct answer requires manual resolution",
    clash.status === "manual", clash);
  t("...and names both letters so the reviewer can see the clash",
    /B/.test(clash.reason) && /correct answer/i.test(clash.reason), clash.reason);

  t("a non-clashing line still resolves",
    resolveDistractorOption("A is incorrect because x", "B").status === "detected");
  // ⚠ RULINGS HAPPEN BEFORE SEEDING, so the key is usually absent entirely.
  t("a missing answer key skips the cross-check, it does not block",
    resolveDistractorOption("A is incorrect because x", null).status === "detected");
  t("...and an empty one behaves the same",
    resolveDistractorOption("A is incorrect because x", "").status === "detected");
}

console.log("\n── OPTION VALIDITY ──");
{
  t("A–D are options", ["A", "B", "C", "D"].every(isValidOption));
  t("the alphabet extends past D for papers that need it",
    OPTION_ALPHABET.length > 4 && isValidOption("E"));
  t("lowercase is accepted", isValidOption("a"));
  t("a word is not an option", !isValidOption("AB") && !isValidOption("option A"));
  t("a non-string is not an option", !isValidOption(null) && !isValidOption(1));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
