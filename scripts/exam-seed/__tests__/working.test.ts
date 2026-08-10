/**
 * Working capture — the method marks become assessable, and a blank box costs
 * a student nothing.
 *
 * Run:  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *         scripts/exam-seed/__tests__/working.test.ts
 *
 * ============================================================================
 * THE TWO PROPERTIES, AND WHY THE SECOND IS THE HARDER ONE
 * ============================================================================
 * 15 of this paper's 25 seeded marks were unassessable because the editor took
 * one number and the schemes credit method steps. Working fixes that — and the
 * risk in fixing it is that a student who legitimately shows no working ends up
 * worse off than before the field existed.
 *
 * So every case below is asserted BOTH WAYS: with working and without. The
 * "without" half is not a formality, it is the guarantee. 20(a)'s scheme says
 * "Correct answer with no working scores (4)" in so many words, and a student
 * who writes 0.0172 and nothing else must still take 4/4.
 */
import {
  markNumeric,
  workingFrom,
  WORKING_NOT_CAPTURED,
  WORKING_UNDER_REVIEW,
  type DeterministicResult,
} from "../../../src/lib/exam/deterministic.ts";
import type { ResponsePayload } from "../../../src/lib/exam/attempts.ts";
import {
  narrowResponsePayload,
  MAX_WORKING,
} from "../../../src/lib/exam/response-payload.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const answer = (value: string, extra: { unit?: string; working?: string } = {}): ResponsePayload =>
  ({ kind: "numeric", value, ...extra });

// The two real questions this feature exists for.
const Q20A = {
  maxMarks: 4,
  spec: {
    expectedValue: "0.0172", expectedUnit: null, tolerance: 0.005,
    acceptedValues: null, marksOnCorrectAnswer: 4, requiresUnit: false,
  },
  criteria: [
    { pointCode: "M1", criterion: "conversion" }, { pointCode: "M2", criterion: "rearrangement" },
    { pointCode: "M3", criterion: "substitution" }, { pointCode: "M4", criterion: "evaluation" },
  ],
};
const Q20BIII = {
  maxMarks: 6,
  spec: {
    expectedValue: "307", expectedUnit: null, tolerance: 0.005,
    acceptedValues: null, marksOnCorrectAnswer: 1, requiresUnit: false,
  },
  criteria: [
    { pointCode: "M1", criterion: "litres of fuel" }, { pointCode: "M2", criterion: "mass of fuel" },
    { pointCode: "M3", criterion: "mol of fuel" }, { pointCode: "M4", criterion: "mol of CO2" },
    { pointCode: "M5", criterion: "mass of CO2" }, { pointCode: "M6", criterion: "mass per passenger" },
  ],
};
// 22(c): marksOnCorrectAnswer deliberately null — "Correct answer with SOME
// WORKING scores 3", a condition Tier 1 cannot test.
const Q22C = {
  maxMarks: 3,
  spec: {
    expectedValue: "3.591", expectedUnit: null, tolerance: 0.01,
    acceptedValues: null, marksOnCorrectAnswer: null as number | null, requiresUnit: false,
  },
  criteria: [
    { pointCode: "M1", criterion: "moles" }, { pointCode: "M2", criterion: "ratio" },
    { pointCode: "M3", criterion: "mass" },
  ],
};

type Question = {
  maxMarks: number;
  spec: Parameters<typeof markNumeric>[2];
  criteria: { pointCode: string; criterion: string }[];
};
const run = (q: Question, r: ResponsePayload | null): DeterministicResult =>
  markNumeric(r, q.maxMarks, q.spec, q.criteria);

console.log("── workingFrom(): absent and blank are ONE state ──");
{
  t("absent -> null", workingFrom(answer("307")) === null);
  t("empty string -> null", workingFrom(answer("307", { working: "" })) === null);
  t("whitespace -> null", workingFrom(answer("307", { working: "   \n\t " })) === null);
  t("real text -> the text, trimmed", workingFrom(answer("307", { working: "  n = pV/RT  " })) === "n = pV/RT");
  t("null response -> null", workingFrom(null) === null);
  t("an mcq payload -> null", workingFrom({ kind: "mcq", choice: "B" }) === null);
  t("a text payload -> null", workingFrom({ kind: "text", text: "some prose" }) === null);
  t("an unsupported payload -> null", workingFrom({ kind: "unsupported" }) === null);
}

console.log("\n── 20(a): 'Correct answer with no working scores (4)'. STILL 4/4. ──");
{
  const bare = run(Q20A, answer("0.0172"));
  t("bare correct answer is markable", bare.markable === true);
  t("...awards the full 4", bare.markable && bare.awarded === 4, bare);
  t("...out of 4", bare.markable && bare.assessedOutOf === 4);
  t("...with nothing unassessed", bare.markable && bare.unassessedMarks === 0);
  t("...and no reason to give", bare.markable && bare.unassessedReason === null);

  const shown = run(Q20A, answer("0.0172", { working: "pV = nRT, n = 101000 x 4.15e-4 / (8.31 x 298)" }));
  t("the SAME answer with working is byte-identical",
    JSON.stringify(shown) === JSON.stringify(bare), { bare, shown });
  // ⚠ This is the guarantee, stated as an equality rather than as an intention:
  // working cannot change a verdict Tier 1 already reaches with certainty.
}

console.log("\n── 20(b)(iii) WITHOUT working: unchanged, and never a zero ──");
{
  const correct = run(Q20BIII, answer("307"));
  t("correct answer is markable", correct.markable === true);
  t("...confirms exactly marks_on_correct_answer (1)", correct.markable && correct.awarded === 1, correct);
  t("...shows 1 out of 1, not 1 out of 6", correct.markable && correct.assessedOutOf === 1);
  t("...and excludes the other 5 from the denominator", correct.markable && correct.unassessedMarks === 5);
  t("...saying they were not captured", correct.markable && correct.unassessedReason === WORKING_NOT_CAPTURED);

  const wrong = run(Q20BIII, answer("250"));
  t("a WRONG answer is not markable at all", wrong.markable === false, wrong);
  t("...so it can never be a confirmed zero", !("awarded" in wrong));
  t("...and says the working was not captured",
    !wrong.markable && wrong.reason.includes(WORKING_NOT_CAPTURED));

  const blank = run(Q20BIII, null);
  t("no answer at all is not markable", blank.markable === false);
  t("...also never a zero", !("awarded" in blank));
}

console.log("\n── 20(b)(iii) WITH working: the 5 method marks become assessable ──");
{
  const W = "1) 3600 x 0.038 = 136.8 L\n2) x 0.803 = 109.85 kg\n3) /170 = 0.646 kmol";
  const correct = run(Q20BIII, answer("307", { working: W }));
  t("still markable by Tier 1", correct.markable === true);
  // ⚠ THE DETERMINISTIC MARK IS UNTOUCHED. Working does not add to it, does not
  // subtract from it, and does not change the denominator shown.
  t("...still awards exactly 1", correct.markable && correct.awarded === 1, correct);
  t("...still 1 out of 1", correct.markable && correct.assessedOutOf === 1);
  t("...still 5 marks outside Tier 1", correct.markable && correct.unassessedMarks === 5);
  // ...but they are no longer a dead end.
  t("the 5 are now UNDER REVIEW, not 'not captured'",
    correct.markable && correct.unassessedReason === WORKING_UNDER_REVIEW, correct);
  t("...and the false claim is gone",
    correct.markable && correct.unassessedReason !== WORKING_NOT_CAPTURED);

  const wrong = run(Q20BIII, answer("250", { working: W }));
  t("a wrong answer with working is STILL not a confirmed zero", wrong.markable === false, wrong);
  t("...and says the working went for review",
    !wrong.markable && wrong.reason.includes(WORKING_UNDER_REVIEW));
  t("...without claiming the working was not captured",
    !wrong.markable && !wrong.reason.includes(WORKING_NOT_CAPTURED));

  const noFinal = run(Q20BIII, answer("", { working: W }));
  t("working but no final answer is not markable by Tier 1", noFinal.markable === false);
  t("...and is sent for review rather than dead-ended",
    !noFinal.markable && noFinal.reason.includes(WORKING_UNDER_REVIEW), noFinal);
  t("...never a zero", !("awarded" in noFinal));
}

console.log("\n── 22(c): marks_on_correct_answer is deliberately null ──");
{
  // "Correct answer with SOME WORKING scores 3" — the condition Tier 1 could
  // not test is exactly the thing that is now on the page.
  const bare = run(Q22C, answer("3.591"));
  t("without working: not markable, unchanged", bare.markable === false);
  t("...and still says we can't see the working",
    !bare.markable && /can't see/.test(bare.reason), bare);

  const shown = run(Q22C, answer("3.591", { working: "n(CaCO3) = 5.00/100.1 = 0.04995 mol" }));
  t("with working: still not markable BY TIER 1", shown.markable === false);
  t("...because 'some working' is a judgement, and Tier 1 does not judge",
    !("awarded" in shown));
  t("...but it now goes to review with the working",
    !shown.markable && shown.reason.includes(WORKING_UNDER_REVIEW), shown);
}

console.log("\n── A ONE-MARK NUMERIC HAS NO METHOD MARKS, WITH OR WITHOUT WORKING ──");
{
  const one = {
    maxMarks: 1,
    spec: { ...Q20BIII.spec, marksOnCorrectAnswer: 1 },
    criteria: [{ pointCode: "M1", criterion: "the answer" }],
  };
  const wrongBare = run(one, answer("250"));
  const wrongShown = run(one, answer("250", { working: "some method" }));
  t("a wrong one-mark answer is a genuine zero", wrongBare.markable === true && wrongBare.awarded === 0);
  t("...and working does not change that",
    JSON.stringify(wrongShown) === JSON.stringify(wrongBare), { wrongBare, wrongShown });
  // maxMarks > 1 is the whole test for "does this question have method marks",
  // and it is the same test the editor uses to decide whether to show the box.
}

console.log("\n── WORKING NEVER TURNS A CORRECT ANSWER INTO A WORSE OUTCOME ──");
{
  // The property that matters most, swept across every question shape: adding
  // working must never reduce the confirmed marks or the assessed denominator.
  const cases: { name: string; q: Question; value: string }[] = [
    { name: "20(a) correct", q: Q20A, value: "0.0172" },
    { name: "20(a) wrong", q: Q20A, value: "9.9" },
    { name: "20(b)(iii) correct", q: Q20BIII, value: "307" },
    { name: "20(b)(iii) wrong", q: Q20BIII, value: "250" },
    { name: "22(c) correct", q: Q22C, value: "3.591" },
  ];
  for (const c of cases) {
    const bare = run(c.q, answer(c.value));
    const shown = run(c.q, answer(c.value, { working: "a method the student wrote" }));
    const bareMarks = bare.markable ? bare.awarded : 0;
    const shownMarks = shown.markable ? shown.awarded : 0;
    const bareOutOf = bare.markable ? bare.assessedOutOf : 0;
    const shownOutOf = shown.markable ? shown.assessedOutOf : 0;
    t(`${c.name}: confirmed marks not reduced by showing working`,
      shownMarks >= bareMarks, { bareMarks, shownMarks });
    t(`${c.name}: assessed denominator not reduced either`,
      shownOutOf >= bareOutOf, { bareOutOf, shownOutOf });
  }
}


console.log("\n── THE SERVER BOUNDARY MUST NOT DROP IT ──");
{
  // ⚠ THIS IS THE ONE THAT WAS ACTUALLY BROKEN. The editor collected working,
  // the server action narrowed the payload to a union that did not mention it,
  // and the database stored a numeric answer with no method. Every layer was
  // individually correct and the feature silently did not happen — which is
  // why the narrowing function now lives somewhere it can be tested at all.
  const kept = narrowResponsePayload({ kind: "numeric", value: "307", working: "11400 x 9.25" });
  t("working survives the server boundary",
    kept !== null && kept.kind === "numeric" && kept.working === "11400 x 9.25", kept);

  const withUnit = narrowResponsePayload({
    kind: "numeric", value: "0.0172", unit: "mol", working: "n = pV/RT",
  });
  t("...alongside a unit",
    withUnit?.kind === "numeric" && withUnit.unit === "mol" && withUnit.working === "n = pV/RT",
    withUnit);

  // Blank must produce the SAME STORED OBJECT as never having typed anything,
  // so "not penalised for leaving it blank" is true of the data too.
  const untouched = narrowResponsePayload({ kind: "numeric", value: "307" });
  for (const blank of ["", "   ", "\n\t "]) {
    const got = narrowResponsePayload({ kind: "numeric", value: "307", working: blank });
    t(`blank working (${JSON.stringify(blank)}) stores exactly what an untouched box stores`,
      JSON.stringify(got) === JSON.stringify(untouched), { untouched, got });
  }
  t("...and that object has no working key at all",
    untouched !== null && !("working" in untouched), untouched);

  t("a non-string working is dropped rather than coerced",
    !("working" in (narrowResponsePayload({ kind: "numeric", value: "1", working: 42 }) ?? {})));
  t("working is capped",
    (narrowResponsePayload({ kind: "numeric", value: "1", working: "x".repeat(MAX_WORKING + 500) }) as
      { working?: string } | null)?.working?.length === MAX_WORKING);
  t("a numeric payload with no value is still rejected outright",
    narrowResponsePayload({ kind: "numeric", working: "method only" }) === null);
  t("working on an mcq payload is not smuggled through",
    !("working" in (narrowResponsePayload({ kind: "mcq", choice: "B", working: "x" }) ?? {})));
}

console.log(`\n${fail === 0 ? "✓ ALL" : "✗"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
