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
import { parseNumber, markNumeric, markMcq } from "../../../src/lib/exam/deterministic.ts";
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


// ══════════════════════════════════════════════════════════════════════════
// SIX MORE THAT COULD PUT A WRONG MARK IN FRONT OF A STUDENT
//
// Selected from the audit's remaining findings by ONE test: can it produce a
// wrong mark a student actually sees? The rest — attribution, labelling,
// stale rows, a misleading note on an abstention — are real and are filed as
// issues, but none of them changes a number on the card.
// ══════════════════════════════════════════════════════════════════════════

console.log("\n── 4. accepted_values must not merge into one wide band ──");
{
  // The live 20(b)(iii) row. 0.5% of 306 is 1.53, so the windows around 306
  // and 307 merged into 304.47–308.53 and 305 was awarded a REAL mark.
  const spec = {
    expectedValue: "307", expectedUnit: null, tolerance: 0.005,
    acceptedValues: ["306"], marksOnCorrectAnswer: 1, requiresUnit: false,
  };
  const C = [{ pointCode: "M6", criterion: "evaluation" }];
  const at = (v: string) => markNumeric({ kind: "numeric", value: v } as never, 6, spec, C);
  t("307 (the expected value) is awarded", at("307").markable === true);
  t("306 (a listed alternative) is awarded", at("306").markable === true);
  t("306.4 — inside half the gap — is still awarded", at("306.4").markable === true);
  t("305 is NOT awarded: the scheme lists 306 and 307, not 305", at("305").markable === false, at("305"));
  t("304.5 is NOT awarded", at("304.5").markable === false);

  // SABOTAGE: the old rule, each candidate carrying the full relative window.
  const merged = (student: number) =>
    [307, 306].some((c) => Math.abs(student - c) <= Math.abs(c) * 0.005);
  t("SABOTAGE — per-candidate windows award 305 for a scheme that allows 306 or 307",
    merged(305) === true);
}

console.log("\n── 5. the same value to fewer figures is not a zero ──");
{
  // 20(a) expects 0.0172 and the scheme says "Ignore SF except 1 SF", so 0.017
  // is a correct answer — but it is 1.16% away and the tolerance is 0.5%.
  const spec = {
    expectedValue: "0.0172", expectedUnit: null, tolerance: 0.005,
    acceptedValues: null, marksOnCorrectAnswer: 1, requiresUnit: false,
  };
  const C = [{ pointCode: "M4", criterion: "evaluation" }];
  const at = (v: string) => markNumeric({ kind: "numeric", value: v } as never, 1, spec, C);
  t("the exact value is awarded", at("0.0172").markable === true);
  t("0.017 (2 s.f.) is NOT scored a confirmed zero", at("0.017").markable === false, at("0.017"));
  t("0.02 (1 s.f.) also abstains — that rule is one of the 68 still unruled",
    at("0.02").markable === false);
  // ⚠ ANTI-VACUITY. A rule that abstained on everything would pass the two
  // above and stop Tier 1 marking anything at all.
  const wrong = at("0.9");
  t("a genuinely wrong answer is STILL a confirmed zero",
    wrong.markable === true && wrong.awarded === 0, wrong);
}

console.log("\n── 6. a unit-bearing question with no recorded unit is not markable ──");
{
  const spec = {
    expectedValue: "307", expectedUnit: null, tolerance: 0.005,
    acceptedValues: null, marksOnCorrectAnswer: 1, requiresUnit: true,
  };
  const C = [{ pointCode: "M1", criterion: "evaluation" }];
  const at = (u?: string) =>
    markNumeric({ kind: "numeric", value: "307", ...(u ? { unit: u } : {}) } as never, 1, spec, C);
  t("a wrong unit is not awarded", at("furlongs").markable === false);
  t("NO unit at all is not awarded", at().markable === false, at());
  t("...and a plausible unit is not awarded either — we don't know what to check",
    at("kg").markable === false);

  // Anti-vacuity: with the unit actually recorded, marking resumes.
  const known = { ...spec, expectedUnit: "kg" };
  const withUnit = (u: string) =>
    markNumeric({ kind: "numeric", value: "307", unit: u } as never, 1, known, C);
  t("with expected_unit recorded, the right unit IS awarded", withUnit("kg").markable === true);
  const bad = withUnit("g");
  t("...and the wrong unit is a confirmed zero", bad.markable === true && bad.awarded === 0, bad);
}

console.log("\n── 7. an absurd relative tolerance is a transcription fault ──");
{
  // "accept ± 0.5" typed into a field that means "± 50%".
  const spec = {
    expectedValue: "307", expectedUnit: null, tolerance: 0.5,
    acceptedValues: null, marksOnCorrectAnswer: 1, requiresUnit: false,
  };
  const C = [{ pointCode: "M1", criterion: "evaluation" }];
  const at = (v: string) => markNumeric({ kind: "numeric", value: v } as never, 1, spec, C);
  const right = at("307");
  t("the correct answer is still awarded", right.markable === true && right.awarded === 1);
  const far = at("460");
  t("460 is no longer awarded for an expected 307", far.markable === true && far.awarded === 0, far);
  const low = at("160");
  t("160 is no longer awarded either", low.markable === true && low.awarded === 0);

  // Anti-vacuity: a real chemistry tolerance still works.
  const sane = { ...spec, tolerance: 0.01 };
  const near = markNumeric({ kind: "numeric", value: "309" } as never, 1, sane, C);
  t("a sane 1% tolerance still awards a near value", near.markable === true && near.awarded === 1, near);
}

console.log("\n── 8. the MCQ answer is recorded twice and the two must agree ──");
{
  const crit = [{
    pointCode: "M1",
    criterion: "The only correct answer is B (neutron number 44, electron number 36)",
  }];
  const at = (expected: string | null, chose: string) =>
    markMcq({ kind: "mcq", choice: chose } as never, 1, expected, crit);

  t("both sources agreeing on B awards a B", at("B", "B").markable === true);
  t("...and marks a D wrong", at("B", "D").markable === true);

  // ⚠ THE DEFECT. expected_value won unconditionally, so a stale "A" scored a
  // correct B as zero — a real, authoritative, persisted wrong mark.
  t("expected_value 'A' against a criterion saying B is REFUSED, not obeyed",
    at("A", "B").markable === false, at("A", "B"));
  t("a non-letter expected_value is refused rather than used as the key",
    at("Banana", "B").markable === false);
  t("a blank expected_value falls back to the criterion and still marks",
    at("", "B").markable === true);
  t("...as does a missing one", at(null, "B").markable === true);

  // SABOTAGE: the old precedence.
  const oldKey = (expected: string | null) => (expected?.trim().toUpperCase() || null) ?? "B";
  t("SABOTAGE — expected_value winning unconditionally makes 'A' the key and zeroes a correct B",
    oldKey("A") === "A");
}


// ══════════════════════════════════════════════════════════════════════════
// 9. A UNIT WRITTEN CORRECTLY MUST NOT LOSE THE MARK
//
// Re-tested from the PR's filed findings and reproduced: five of ten ways of
// writing a real chemistry unit were refused. normaliseUnit mapped only ² and
// ³ and only [⁻−], and did not handle the solidus at all — so mol/dm³,
// mol dm–3 (en dash) and J mol⁻¹ K⁻¹ all scored zero on the unit.
//
// ⚠ parseNumber HAS MAPPED [−–—] SINCE IT WAS WRITTEN. The two halves of one
// answer disagreed about one character: the number accepted an en dash, the
// unit did not.
// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 9. UNIT EQUIVALENCE ──");
{
  const C = [{ pointCode: "M1", criterion: "evaluation" }];
  const spec = (expectedUnit: string) => ({
    expectedValue: "0.12", expectedUnit, tolerance: 0.01,
    acceptedValues: null, marksOnCorrectAnswer: 1, requiresUnit: true,
  });
  const mark = (expected: string, typed: string) => {
    const r = markNumeric({ kind: "numeric", value: "0.12", unit: typed } as never, 1, spec(expected), C);
    return r.markable === true && r.awarded === 1;
  };

  const CONC = "mol dm-3";
  t("mol dm-3 — the transcribed form", mark(CONC, "mol dm-3"));
  t("mol dm⁻³ — superscript minus and superscript three", mark(CONC, "mol dm⁻³"));
  t("mol/dm3 — the solidus form of the same unit", mark(CONC, "mol/dm3"));
  t("mol/dm³ — solidus and superscript together", mark(CONC, "mol/dm³"));
  t("mol dm–3 — an EN DASH, which parseNumber already accepted", mark(CONC, "mol dm–3"));

  const GAS = "J mol-1 K-1";
  t("J mol⁻¹ K⁻¹ — the superscript ONE that was never mapped", mark(GAS, "J mol⁻¹ K⁻¹"));
  t("J/mol/K — chained division negates each term in turn", mark(GAS, "J/mol/K"));

  t("dm³ still matches dm3", mark("dm3", "dm³"));
  t("dm^3 still matches dm3", mark("dm3", "dm^3"));
  t("case is still ignored", mark("cm3", "CM3"));

  // ⚠ ANTI-VACUITY. A normaliser that collapsed everything would pass all ten
  // above and award a unit mark for any string a student typed.
  t("ANTI-VACUITY — mol dm3 does NOT match mol dm-3: dm³ is a volume, dm⁻³ is not",
    !mark(CONC, "mol dm3"));
  t("ANTI-VACUITY — g does not match kg", !mark("kg", "g"));
  t("ANTI-VACUITY — a bare mol does not match mol dm-3", !mark(CONC, "mol"));
  t("an unparseable solidus form refuses rather than guessing", !mark(CONC, "mol/(dm3)"));

  // SABOTAGE: the old normaliser, reproduced.
  const oldNormalise = (u: string) =>
    u.toLowerCase().replace(/[\s]/g, "").replace(/\^/g, "")
     .replace(/[⁻−]/g, "-").replace(/³/g, "3").replace(/²/g, "2");
  t("SABOTAGE — the old rule read 'mol/dm³' as 'mol/dm3', which never matched 'moldm-3'",
    oldNormalise("mol/dm³") === "mol/dm3" && oldNormalise("mol dm-3") === "moldm-3");
  t("SABOTAGE — and left the superscript ONE untouched",
    oldNormalise("J mol⁻¹ K⁻¹").includes("¹"));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
