/**
 * Four ways the marking engine gave a wrong answer a real mark, or gave a
 * student the mark scheme. All found by audit against a live paper.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/marking-integrity.test.ts
 *
 * ============================================================================
 * WHY THESE FOUR
 * ============================================================================
 * Every one of them produced a plausible screen. None raised an error, none
 * failed a test, and two of them printed their own contradiction in front of
 * the student:
 *
 *   1. "You answered 3,07, which matches 307."   a decimal comma deleted
 *   2. the model's sentence, unfiltered           the mark scheme, back out
 *   3. three ticks over "2 marks"                 clamped total, unclamped rows
 *   4. a letter grade from 6 marks out of 80      a partial mark on a full ladder
 *
 * The engine's own defence is that a wrong answer becomes "not marked" rather
 * than "wrong". These are the cases where it became RIGHT instead.
 */
import { parseNumber, markNumeric } from "../../../src/lib/exam/deterministic.ts";
import { groundedEvidence } from "../../../src/lib/exam/evidence.ts";
import { gradeFor, type GradeBoundary } from "../../../src/lib/exam/results-insights.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

// ══════════════════════════════════════════════════════════════════════════
console.log("── 1. A DECIMAL COMMA IS NOT A THOUSANDS SEPARATOR ──");
{
  // ⚠ THE ONE THAT AWARDED A REAL MARK. WCH11/01 is an INTERNATIONAL A Level;
  // most of Europe writes 3.07 as "3,07". 20(b)(iii) expects 307.
  t("3,07 reads as 3.07, not 307", parseNumber("3,07") === 3.07, parseNumber("3,07"));
  t("0,0172 reads as 0.0172, not 172", parseNumber("0,0172") === 0.0172, parseNumber("0,0172"));
  t("18,5 reads as 18.5 — the same as the equation parser already did",
    parseNumber("18,5") === 18.5, parseNumber("18,5"));

  // Thousands still work: two or more well-formed groups is unambiguous.
  t("245,310,000 is still thousands", parseNumber("245,310,000") === 245310000, parseNumber("245,310,000"));
  t("1,234.56 is thousands — a decimal point settles it",
    parseNumber("1,234.56") === 1234.56, parseNumber("1,234.56"));

  // ⚠ THE REFUSAL. "1,234" is 1234 to a British candidate and 1.234 to a French
  // one, and NOTHING in the string decides. null means "not marked", which is
  // this module's documented contract for anything it cannot read.
  t("1,234 is genuinely ambiguous and is REFUSED, not guessed",
    parseNumber("1,234") === null, parseNumber("1,234"));
  t("a malformed grouping is refused too", parseNumber("1,23,456") === null, parseNumber("1,23,456"));

  // End to end on the real production spec for 20(b)(iii).
  const spec = {
    expectedValue: "307", expectedUnit: null, tolerance: 0.005,
    acceptedValues: ["306"], marksOnCorrectAnswer: 1, requiresUnit: false,
  };
  const C = [{ pointCode: "M6", criterion: "evaluation" }];
  const commaAnswer = markNumeric({ kind: "numeric", value: "3,07" } as never, 6, spec, C);
  t("3,07 on the real 20(b)(iii) spec no longer earns a deterministic mark",
    commaAnswer.markable === false, commaAnswer);
  const right = markNumeric({ kind: "numeric", value: "307" } as never, 6, spec, C);
  t("...while 307 still earns it (anti-vacuity)",
    right.markable === true && right.awarded === 1, right);

  // SABOTAGE: the old behaviour, reproduced.
  const oldParse = (s: string) => Number(s.replace(/[\s,]/g, ""));
  t("SABOTAGE — stripping every comma turns 3.07 into 307", oldParse("3,07") === 307);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 2. THE MODEL'S SENTENCE MUST NOT CARRY THE MARK SCHEME OUT ──");
{
  // 20(b)(i)'s real accept[] — a concession that tells a candidate how to answer.
  const scheme = [
    "(burned / reacted) in sufficient / excess oxygen",
    "Allow a reaction in which all of the atoms in the fuel are fully oxidised",
    "Ignore any reference to carbon dioxide and water",
  ];
  const answer = "It burns in excess oxygen so everything is fully burned.";

  // ⚠ A NOT-AWARDED POINT NEVER CARRIES THE MODEL'S WORDS. There are no student
  // words to quote, so the only material the model holds is the scheme itself.
  const injected = groundedEvidence({
    awarded: false, studentAnswer: answer, schemeText: scheme,
    evidence: "Allow a reaction in which all of the atoms in the fuel are fully oxidised",
  });
  t("a not-awarded point gets a fixed sentence, never the model's",
    !injected.includes("Allow a reaction"), injected);

  // ⚠ THE INJECTION. A student who asks the model to echo the scheme back.
  const exfil = groundedEvidence({
    awarded: true, studentAnswer: answer, schemeText: scheme,
    evidence: "Allow a reaction in which all of the atoms in the fuel are fully oxidised.",
  });
  t("an AWARDED point quoting the mark scheme verbatim is replaced",
    !exfil.includes("all of the atoms in the fuel"), exfil);

  // Quoted material must be the student's own words.
  const fakeQuote = groundedEvidence({
    awarded: true, studentAnswer: answer, schemeText: scheme,
    evidence: 'You wrote "in sufficient / excess oxygen", which earns the mark.',
  });
  t("a quotation the student never wrote is replaced",
    !fakeQuote.includes("sufficient"), fakeQuote);

  // ⚠ ANTI-VACUITY. A rule that replaced everything would pass all three above
  // and make the feature useless. A genuine quote of the student must survive.
  const genuine = groundedEvidence({
    awarded: true, studentAnswer: answer, schemeText: scheme,
    evidence: 'You wrote "in excess oxygen", which earns the mark.',
  });
  t("a genuine quote of the STUDENT'S OWN words passes through untouched",
    genuine === 'You wrote "in excess oxygen", which earns the mark.', genuine);

  t("empty evidence on an awarded point does not become an empty card",
    groundedEvidence({ awarded: true, studentAnswer: answer, schemeText: scheme, evidence: "" }).length > 10);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 3. A GRADE NEEDS THE WHOLE PAPER, NOT THE PART WE COULD MARK ──");
{
  const PAPER = "p1";
  const ladder: GradeBoundary[] = [
    { paperId: PAPER, grade: "A", rawMarkMin: 58, boundarySource: "official", sourceNote: "published" },
    { paperId: PAPER, grade: "E", rawMarkMin: 24, boundarySource: "official", sourceNote: "published" },
  ];

  // ⚠ THE LIVE SHAPE. Tier 1 confirms at most 6 marks on WCH11/01 today; the
  // paper total is 80. Placing 6/80 on the ladder returns a real grade band
  // and means nothing — and it fails in the direction a student believes.
  const partial = gradeFor({
    paperId: PAPER, confirmedMarks: 6, confirmedAvailable: 6, paperTotal: 80, boundaries: ladder,
  });
  t("6 confirmed marks of a possible 6, on an 80-mark paper -> REFUSED",
    partial.available === false, partial);
  t("...and the reason names both numbers so it is actionable",
    !partial.available && /6 of this paper's 80/.test(partial.reason), partial);

  // Anti-vacuity: a fully marked paper still gets its grade.
  const full = gradeFor({
    paperId: PAPER, confirmedMarks: 60, confirmedAvailable: 80, paperTotal: 80, boundaries: ladder,
  });
  t("a WHOLLY marked paper still receives its grade", full.available === true && full.grade === "A", full);

  // ⚠ SABOTAGE — the old call, which ignored what was actually assessed.
  //
  // A student who scored 30 out of the 30 marks anybody managed to mark is
  // perfect on everything measured. Told that confirmedAvailable is the full
  // 80, gradeFor places 30/80 on the ladder and returns E — a confident,
  // official-looking grade, three bands below the truth, from a denominator
  // containing 50 marks nobody ever assessed.
  const perfectOnWhatWasMarked = gradeFor({
    paperId: PAPER, confirmedMarks: 30, confirmedAvailable: 80, paperTotal: 80, boundaries: ladder,
  });
  t("SABOTAGE — a perfect 30/30 reported as the whole paper becomes a confident E",
    perfectOnWhatWasMarked.available === true && perfectOnWhatWasMarked.grade === "E",
    perfectOnWhatWasMarked);
  const honest = gradeFor({
    paperId: PAPER, confirmedMarks: 30, confirmedAvailable: 30, paperTotal: 80, boundaries: ladder,
  });
  t("...and the same marks, reported honestly, refuse instead of grading",
    honest.available === false, honest);
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
