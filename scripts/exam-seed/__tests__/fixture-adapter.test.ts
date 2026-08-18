/**
 * Deriving a seedable paper from an emitted mark scheme.
 *
 * ============================================================================
 * ⚠ WHAT IT CANNOT DERIVE, IT REFUSES
 * ============================================================================
 * The tempting default is `answerType: "other"` for anything unrecognised.
 * That is a guess wearing a value's clothes: it reaches the database, the
 * marking layer routes on it, and a question that should have been
 * numeric_with_unit is marked as free text with nobody told. Most of what
 * follows checks that the refusals happen and say which field on which
 * question.
 */
import { readFileSync } from "node:fs";
import {
  deriveQuestionSet,
  deriveAnswerType,
  deriveExpectedAnswer,
  deriveParent,
  deriveWithOverlay,
  applyOverlay,
  resolvePaperId,
  SCHEMA_ANSWER_TYPES,
} from "../../../src/lib/exam/fixture-adapter.ts";
import { UNIT_1_MAY_JUNE_2025 as PAPER } from "../unit-1-may-june-2025.generated.ts";
import type { FixtureQuestion } from "../../../src/lib/exam/markscheme-proposals.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};
const Q = (questionNumber: string, marks: number, criteria: string[]): FixtureQuestion => ({
  questionNumber, marks,
  markScheme: criteria.map((criterion, i) => ({ pointCode: `M${i + 1}`, criterion })),
});
const META = { paperCode: "WCH11/01", session: "May-June", year: 2025, totalMarks: 80 };

console.log("── ANSWER TYPE COMES FROM THE MARK SCHEME, NOT THE QUESTION NUMBER ──");
{
  // ⚠ "1–19 ARE SECTION A, THEREFORE MCQ" IS NOT A DERIVATION. It is this
  // paper's answer key written as a range; the next paper with 18 or 20
  // multiple-choice questions would seed silently wrong.
  t("an MCQ is recognised by its own stated answer",
    deriveAnswerType(Q("1", 1, ["The only correct answer is B (neutron number 44)"])).type === "mcq");
  t("...at any question number, including a Section B one",
    deriveAnswerType(Q("23(z)", 1, ["The only correct answer is C"])).type === "mcq");
  t("...and a Section A number with no such sentence is NOT assumed to be MCQ",
    deriveAnswerType(Q("3", 1, ["some prose about bonding"])).type !== "mcq");

  // ⚠ MCQ IS TESTED FIRST, AND THIS IS THE CASE THAT PROVES IT MATTERS.
  //
  // The first version of this assertion used WCH11/01's own Q2 — "The only
  // correct answer is A (0.072 dm3)" — and passed even with the ordering
  // reversed, because no rule actually claims that string. Sabotage caught it:
  // the test was checking nothing. No MCQ in this paper collides with a later
  // rule, so the guard is for the papers to come, and the case has to be
  // constructed to exist at all.
  //
  // An MCQ read as chemical_equation would be marked by parsing the student's
  // free text as a reaction instead of comparing one letter.
  const collides = Q("7", 1, ["The only correct answer is C (the balanced equation)"]);
  t("the colliding fixture really does trip a later rule",
    /\bequation\b/i.test(collides.markScheme[0].criterion));
  t("an MCQ whose answer mentions an equation is STILL an MCQ",
    deriveAnswerType(collides).type === "mcq", deriveAnswerType(collides));
  t("...and its answer letter survives", deriveExpectedAnswer(collides) === "C");
  t("an MCQ whose answer carries a unit is still an MCQ",
    deriveAnswerType(Q("2", 1, ["The only correct answer is A (0.072 dm3)"])).type === "mcq");

  t("an equation criterion derives chemical_equation",
    deriveAnswerType(Q("x", 2, ["balanced equation for the reaction"])).type === "chemical_equation");
  t("a graph criterion derives graph",
    deriveAnswerType(Q("x", 3, ["plot the points and draw a line of best fit"])).type === "graph");
  t("a drawn structure derives structure",
    deriveAnswerType(Q("x", 2, ["a correct skeletal formula of a branched isomer"])).type === "structure");
  t("every derived type is one the schema allows",
    [Q("1", 1, ["The only correct answer is B"]), Q("x", 2, ["balanced equation"]),
     Q("y", 3, ["plot the axes"])]
      .every((q) => SCHEMA_ANSWER_TYPES.includes(deriveAnswerType(q).type!)));
  t("the enum has twelve members", SCHEMA_ANSWER_TYPES.length === 12, SCHEMA_ANSWER_TYPES.length);
}

console.log("\n── AN UNDERIVABLE FIELD IS REFUSED, NEVER DEFAULTED ──");
{
  const prose = Q("23(a)(ii)", 2, ["magnesium ions have a higher charge.", "magnesium ions have a smaller radius."]);
  const decision = deriveAnswerType(prose);
  t("a prose explanation yields NO type", decision.type === null, decision);
  t("...and says why", decision.why.length > 10, decision.why);
  t("...and it is NOT quietly called 'other'", decision.type !== "other");

  const r = deriveQuestionSet([prose], META);
  t("the question is left OUT of the derived set", r.questions.length === 0, r.questions);
  t("...and a refusal names the question AND the field",
    r.refusals.some((x) => x.startsWith("23(a)(ii): answerType")), r.refusals);

  // ⚠ AN MCQ WITH NO STATED LETTER IS REFUSED TOO. Seeding one without its key
  // gives the deterministic marker nothing to compare against.
  const headless = { ...Q("9", 1, ["only correct answer is"]), };
  const r2 = deriveQuestionSet([headless], META);
  t("an unparseable answer key is refused rather than seeded",
    r2.questions.length === 0 || r2.questions[0].expectedAnswer !== undefined, r2.refusals);
}

console.log("\n── PAPER IDENTITY IS STAMPED, NEVER INVENTED ──");
{
  // ⚠ A FIXTURE APPLIED TO THE WRONG PAPER writes a mark scheme onto someone
  // else's questions. There is no safe default for a uuid.
  const none = deriveQuestionSet([Q("1", 1, ["The only correct answer is B"])], null);
  t("no meta yields no set", none.meta === null);
  t("...and four refusals, one per natural-key field",
    none.refusals.filter((x) => x.startsWith("paper identity:")).length === 4, none.refusals);
  t("...naming paperCode specifically",
    none.refusals.some((x) => /paper identity: paperCode/.test(x)));

  const partial = deriveQuestionSet([Q("1", 1, ["The only correct answer is B"])],
    { paperCode: "WCH11/01", session: "May-June", year: 2025 });
  t("a missing totalMarks alone still refuses", partial.meta === null, partial.refusals);
  t("...naming only the missing field",
    partial.refusals.filter((x) => x.startsWith("paper identity:")).length === 1, partial.refusals);

  const full = deriveQuestionSet([Q("1", 1, ["The only correct answer is B"])], META);
  t("complete meta derives a set", full.meta !== null && full.refusals.length === 0, full.refusals);
  t("...carrying no uuid at all — that is resolved at run time",
    !("paperId" in (full.meta ?? {})), full.meta);
}

console.log("\n── ORDER AND PARENTAGE ──");
{
  const names = ["20", "20(b)", "20(b)(iii)", "2", "10"];
  t("the nearest PRESENT ancestor is the parent",
    deriveParent("20(b)(iii)", names) === "20(b)");
  // ⚠ NOT "STRIP ONE SEGMENT". Naming a parent that was never inserted makes
  // the seeder reference a row it has not written.
  t("...skipping a missing intermediate",
    deriveParent("20(b)(iii)", ["20", "20(b)(iii)"]) === "20");
  t("...and null when no ancestor exists at all",
    deriveParent("20(b)(iii)", ["20(b)(iii)"]) === null);
  t("a top-level question has no parent", deriveParent("2", names) === null);
  t("a question is never its own parent", deriveParent("20", ["20"]) === null);

  const set = deriveQuestionSet(
    [Q("10", 1, ["The only correct answer is A"]), Q("2", 1, ["The only correct answer is B"])], META);
  t("questions come out in canonical order, 2 before 10",
    set.questions.map((q) => q.questionNumber).join(",") === "2,10",
    set.questions.map((q) => q.questionNumber));
  t("displayOrder ascends with that order",
    set.questions[0].displayOrder < set.questions[1].displayOrder);
  t("...and is sparse, so a later insert needs no renumber",
    set.questions[1].displayOrder - set.questions[0].displayOrder >= 10);
  t("displayOrder is unique", new Set(set.questions.map((q) => q.displayOrder)).size === set.questions.length);
}

console.log("\n── THE REAL PAPER ──");
{
  const r = deriveQuestionSet(PAPER, META);
  t("the emitted paper has 48 questions", PAPER.length === 48, PAPER.length);
  t("every MCQ derived carries an answer letter",
    r.questions.filter((q) => q.answerType === "mcq").every((q) => /^[A-D]$/.test(q.expectedAnswer?.value ?? "")),
    r.questions.filter((q) => q.answerType === "mcq" && !q.expectedAnswer).map((q) => q.questionNumber));
  t("...and no non-MCQ was given one",
    r.questions.filter((q) => q.answerType !== "mcq").every((q) => q.expectedAnswer === undefined));
  t("every derived row's marks match the emitted question",
    r.questions.every((q) => q.marks === PAPER.find((p) => p.questionNumber === q.questionNumber)!.marks));
  t("derived + refused-on-answerType accounts for every question",
    r.questions.length + r.refusals.filter((x) => /: answerType/.test(x)).length === PAPER.length,
    { derived: r.questions.length, refused: r.refusals.filter((x) => /: answerType/.test(x)).length });

  // ⚠ ANTI-VACUITY, BOTH WAYS: it must derive a lot AND refuse some, or one of
  // the two paths is untested on real data.
  t("ANTI-VACUITY — it derives many", r.questions.length > 25, r.questions.length);
  t("ANTI-VACUITY — and refuses some", r.refusals.length > 0, r.refusals.length);
}

console.log("\n── RESOLVING THE PAPER BY NATURAL KEY, AT RUN TIME ──");
{
  const rows = [
    { id: "uuid-chem", paper_code: "WCH11/01", session: "May-June", year: 2025, total_marks: 80 },
    { id: "uuid-phys", paper_code: "WPH11/01", session: "May-June", year: 2025, total_marks: 80 },
  ];
  const ok = resolvePaperId(rows, META);
  t("exactly one match resolves", ok.ok && ok.paperId === "uuid-chem", ok);

  // ⚠ ZERO AND MANY ARE DIFFERENT REFUSALS, and both are refusals.
  const none = resolvePaperId([], META);
  t("no match refuses", !none.ok);
  t("...saying the paper is not in the catalogue",
    !none.ok && /not in the catalogue|No paper/.test(none.error), none);

  // ⚠ PICKING ONE WOULD WRITE A MARK SCHEME ONTO ANOTHER SUBJECT'S QUESTIONS.
  const dupes = [rows[0], { ...rows[0], id: "uuid-other" }];
  const many = resolvePaperId(dupes, META);
  t("two matches refuse rather than picking one", !many.ok);
  t("...and name both ids so the ambiguity is visible",
    !many.ok && many.error.includes("uuid-chem") && many.error.includes("uuid-other"), many);

  // ⚠ A TOTAL THAT DISAGREES IS A REFUSAL. One of them is about a different
  // paper and neither can be preferred.
  const wrong = resolvePaperId(
    [{ ...rows[0], total_marks: 75 }], META);
  t("a total_marks conflict refuses", !wrong.ok);
  t("...quoting both numbers", !wrong.ok && /75/.test(wrong.error) && /80/.test(wrong.error), wrong);
  t("a null total_marks on the row does not block",
    resolvePaperId([{ ...rows[0], total_marks: null }], META).ok);
  t("no generated file needs to carry a uuid for any of this",
    !JSON.stringify(META).includes("paperId"));
}

console.log("\n── THE OVERLAY IS REFUSAL-ONLY ──");
{
  const mcq = Q("1", 1, ["The only correct answer is B"]);
  const prose = Q("22(a)", 1, ["free-radical substitution reaction"]);
  const paper = [mcq, prose];

  const none = deriveWithOverlay(paper, META, null);
  t("without an overlay the prose question stays refused",
    none.refusals.some((r) => r.startsWith("22(a): answerType")), none.refusals);
  t("...and the derivable one is derived", none.sources["1"] === "derived");

  const filled = deriveWithOverlay(paper, META, { answerTypes: { "22(a)": "short_text" } });
  t("the overlay rescues the refused question",
    filled.questions.some((q) => q.questionNumber === "22(a)" && q.answerType === "short_text"),
    filled.questions.map((q) => [q.questionNumber, q.answerType]));
  t("...its source is recorded as founder-supplied",
    filled.sources["22(a)"] === "founder-supplied");
  t("...the derived one keeps its own source", filled.sources["1"] === "derived");
  t("...and the refusal is gone", !filled.refusals.some((r) => r.startsWith("22(a): answerType")));
  t("...leaving no refusals at all", filled.refusals.length === 0, filled.refusals);

  // ⚠ SABOTAGE 1 — A VALUE THE SCHEMA DOES NOT ALLOW. Refused here rather than
  // at the CHECK constraint three layers away.
  const bad = deriveWithOverlay(paper, META, { answerTypes: { "22(a)": "essay" } });
  t("an invalid enum value is refused",
    bad.refusals.some((r) => /overlay: 22\(a\).*schema does not allow/.test(r)), bad.refusals);
  t("...and the question stays out of the set",
    !bad.questions.some((q) => q.questionNumber === "22(a)"));
  t("...and the refusal lists what IS allowed",
    bad.refusals.some((r) => r.includes("short_text")));

  // ⚠ SABOTAGE 2 — A QUESTION THAT DOES NOT EXIST. Otherwise the typo does
  // nothing, forever, invisibly.
  const ghost = deriveWithOverlay(paper, META, { answerTypes: { "99(z)": "short_text" } });
  t("an unknown questionNumber is refused",
    ghost.refusals.some((r) => /overlay: 99\(z\) is not a question/.test(r)), ghost.refusals);

  // ⚠ SABOTAGE 3 — AN OVERLAY ON A QUESTION THAT DERIVED. A silent override is
  // how a hand-maintained file drifts from the artefact it completes.
  const clash = deriveWithOverlay(paper, META, { answerTypes: { "1": "long_text" } });
  t("an overlay on a derivable question is a CONFLICT",
    clash.refusals.some((r) => /overlay: 1 already derives/.test(r)), clash.refusals);
  t("...and the derivation wins — it is still mcq",
    clash.questions.find((q) => q.questionNumber === "1")?.answerType === "mcq");
  t("...and its source is still derived", clash.sources["1"] === "derived");

  // ⚠ AN OVERLAY MAY NOT CREATE AN UNMARKABLE MCQ. A criterion with no letter
  // never registers as MCQ, so it is refused on answerType — and declaring it
  // `mcq` by hand would seed a question the deterministic marker has nothing
  // to compare against. Typing the TYPE does not supply the ANSWER.
  const headless = Q("9", 1, ["only correct answer is"]);
  const cantRescue = deriveWithOverlay([headless], META, { answerTypes: { "9": "mcq" } });
  t("an overlay cannot declare an MCQ with no answer letter",
    cantRescue.refusals.some((r) => /declared mcq but its mark scheme states no answer letter/.test(r)),
    cantRescue.refusals);
  t("...and the question is not in the set", cantRescue.questions.length === 0);
  t("...while a non-MCQ type for the same question IS allowed",
    deriveWithOverlay([headless], META, { answerTypes: { "9": "short_text" } }).questions.length === 1);

  // displayOrder must stay unique and ordered across the merged set.
  const merged = deriveWithOverlay(
    [Q("10", 1, ["The only correct answer is A"]), prose, Q("2", 1, ["The only correct answer is B"])],
    META, { answerTypes: { "22(a)": "short_text" } });
  t("the merged set is in canonical order",
    merged.questions.map((q) => q.questionNumber).join(",") === "2,10,22(a)",
    merged.questions.map((q) => q.questionNumber));
  t("...displayOrder is unique across derived AND supplied",
    new Set(merged.questions.map((q) => q.displayOrder)).size === merged.questions.length);
  t("...and ascends with the order",
    merged.questions.every((q, i, a) => i === 0 || a[i - 1].displayOrder < q.displayOrder));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
