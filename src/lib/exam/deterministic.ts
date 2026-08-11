import type { ResponsePayload } from "./attempts";

/**
 * Tier 1 — marking that needs no model and produces real marks.
 *
 * ============================================================================
 * EVERYTHING HERE IS PURE
 * ============================================================================
 * No database, no network, no `process`. Given a student's answer and the
 * mark-scheme facts, these functions return a verdict — the same verdict,
 * every time, on any machine. That is what makes Tier 1 authoritative where
 * Tier 2 is provisional, and it is why this file has no imports beyond a type.
 *
 * Purity is also what makes it testable: every rule below can be exercised
 * without a paper, an attempt, or a signed-in student.
 *
 * ============================================================================
 * THE RULE THIS FILE ENFORCES ABOVE ALL OTHERS
 * ============================================================================
 * When it cannot be certain, it awards NOTHING and says why. A deterministic
 * marker that guesses is worse than no marker: its marks carry the authority
 * of arithmetic while having the reliability of a heuristic. Every branch that
 * cannot reach a confident answer returns `markable: false`, which the caller
 * surfaces to the student as "not marked yet" rather than as a zero.
 */

// ============================================================================
// VERDICTS
// ============================================================================

/**
 * ============================================================================
 * ⚠ THE ONE DELIBERATE EXCEPTION TO THE MARK-SCHEME BOUNDARY
 * ============================================================================
 * `evidence` REACHES THE BROWSER, and Tier 1 builds it from the expected
 * answer: "You chose C. The correct answer is A." and "You answered 250. The
 * expected answer is 307 kg." Those sentences are derived from
 * question_expected_answers and mark_scheme_items — tables 0031 and 0028
 * deliberately place behind policies no student can satisfy.
 *
 * THIS IS ALLOWED, ON THESE TERMS, AND IT MUST NOT WIDEN:
 *
 *   ALLOWED   The correct FINAL ANSWER — a value, a unit, an option letter —
 *             in evidence shown AFTER SUBMISSION. Telling a student what the
 *             answer was is the entire purpose of a feedback screen.
 *
 *   NEVER     criterion text, accept[], reject[], or guidance prose. Not in
 *             evidence, not in a note, not in a field of any type this module
 *             returns. Those are the examiner's marking instructions, and a
 *             student holding them is holding the mark scheme.
 *
 * What keeps the "after submission" half true is not this comment: markAttempt
 * refuses an unsubmitted attempt outright, and the results route redirects one
 * back to the player. Both must stay. If a screen is ever added that shows
 * per-point feedback DURING a sitting, this exception does not extend to it —
 * it would hand a student the answer to a question they are still answering.
 *
 * Tier 2 is narrower and stays narrower: ai-marker.ts requires the model to
 * quote the STUDENT'S OWN WORDS, so mark-scheme text has no route into an AI
 * evidence string either.
 */
export type PointVerdict = {
  pointCode: string;
  awarded: boolean;
  /**
   * Why, in one line, quoting what was compared. SHOWN TO THE STUDENT — see
   * the boundary note above before putting anything new in here.
   */
  evidence: string;
};

/**
 * The canonical reason for tariff this marker cannot reach.
 *
 * One constant, not a phrase retyped at each site, because it is shown to
 * students and appears in review queues — two wordings would read as two
 * different situations.
 */
export const WORKING_NOT_CAPTURED = "working not captured — needs review";

/**
 * The counterpart, for tariff this marker cannot reach BUT Tier 2 now can.
 *
 * The distinction is the whole point of capturing working. Before, every
 * method mark on a multi-mark numeric question ended at WORKING_NOT_CAPTURED —
 * a dead end, and honest, because nothing had the evidence to judge it. When a
 * student HAS shown their method those same marks are assessable; saying "not
 * captured" over working the student can see on their own screen would be
 * plainly false.
 */
export const WORKING_UNDER_REVIEW = "method marks assessed from your working — provisional until reviewed";

/**
 * What Tier 1 says about method marks when the student HAS shown working.
 *
 * ⚠ IT STATES A FACT, IT DOES NOT MAKE A PROMISE, and the difference is the
 * whole reason this constant exists separately from WORKING_UNDER_REVIEW.
 *
 * markNumeric used to return WORKING_UNDER_REVIEW ("assessed from your
 * working") the moment working was present — a claim about something that had
 * not happened yet and might not. If Tier 2 then failed, or was skipped because
 * the scheme's point count and marks_on_correct_answer disagreed, the card read
 * "5 marks could not be assessed — method marks assessed from your working",
 * asserting both halves of a contradiction in one sentence.
 *
 * Tier 1 can only speak for Tier 1. markAttempt, which knows whether the method
 * pass actually ran and succeeded, is the only thing entitled to upgrade this
 * to WORKING_UNDER_REVIEW.
 */
export const WORKING_BEYOND_TIER1 = "method marks — not assessed by automatic marking";

/**
 * The student's working, or null. ABSENT AND BLANK ARE THE SAME STATE.
 *
 * Every branch that changes behaviour keys off this one function, so "did the
 * student show working" cannot be answered two different ways in two places.
 * Whitespace does not count: a stray newline from a textarea must not flip a
 * question into a marking path the student did not ask for.
 *
 * ⚠ This returning null must leave EVERY downstream decision exactly as it was
 * before working existed. That is what "not penalised for leaving it blank"
 * means structurally, rather than as an intention.
 */
export function workingFrom(response: ResponsePayload | null): string | null {
  if (!response || response.kind !== "numeric") return null;
  const text = (response.working ?? "").trim();
  return text.length > 0 ? text : null;
}

export type DeterministicResult =
  | {
      markable: true;
      awarded: number;
      /**
       * THE DENOMINATOR SHOWN TO THE STUDENT. Only the tariff this marker
       * actually assessed — never the whole question.
       *
       * A correct 20(b)(iii) reads "2/2 confirmed, 4 marks need review", not
       * "2/6". Showing 2/6 would present unassessable marks as marks lost,
       * which is a worse lie than showing no mark at all.
       */
      assessedOutOf: number;
      /** Tariff excluded from BOTH numerator and denominator. */
      unassessedMarks: number;
      /** WORKING_NOT_CAPTURED, or null when nothing was excluded. */
      unassessedReason: string | null;
      points: PointVerdict[];
      /** 'deterministic' — the only confidence Tier 1 ever claims. */
      confidence: "deterministic";
    }
  | {
      markable: false;
      /** Why this could not be marked without a model or a human. */
      reason: string;
    };

// ============================================================================
// MCQ
// ============================================================================

/**
 * Pull the key out of an Edexcel MCQ criterion.
 *
 * The sentence is formulaic — "The only correct answer is B (neutron number
 * 44, electron number 36)" — so this is reading a contract, not mining prose.
 * It is still the one place Tier 1 depends on examiner wording, so it fails
 * CLOSED: anything that does not match exactly returns null, the question
 * becomes unmarkable, and a human sees it. It never falls back to "the first
 * capital letter in the string", which would happily return the A of "An
 * answer that…".
 *
 * Prefer paper_questions.expected_value where it is populated (0031); this is
 * the fallback for rows that predate it.
 */
export function extractMcqKey(criterion: string): string | null {
  const match = /\bonly correct answer is\s+([A-D])\b/i.exec(criterion);
  return match ? match[1].toUpperCase() : null;
}

export function markMcq(
  response: ResponsePayload | null,
  maxMarks: number,
  expectedValue: string | null,
  criteria: { pointCode: string; criterion: string }[],
): DeterministicResult {
  const point = criteria[0];
  if (!point) {
    return { markable: false, reason: "This question has no mark scheme." };
  }

  // ⚠ TWO INDEPENDENT RECORDS OF THE ANSWER, AND THEY MUST AGREE.
  //
  // The correct option is written down TWICE: once in
  // question_expected_answers.expected_value, and once inside the mark
  // scheme's own criterion ("The only correct answer is B (neutron number 44,
  // electron number 36)"). expected_value simply won, with no validation and
  // no cross-check, so a stale or mistyped row silently marked the right
  // answer wrong — expected_value "A" against a criterion saying B scored a
  // correct B as zero, and "Banana" did the same, both as REAL deterministic
  // marks with nothing logged.
  //
  // Having the same fact in two places is only useful if the disagreement is
  // an error rather than a precedence question. Where they disagree this
  // REFUSES and says so, because there is no basis for preferring either.
  const stated = expectedValue?.trim().toUpperCase() || null;
  const fromCriterion = extractMcqKey(point.criterion);

  if (stated && fromCriterion && stated !== fromCriterion) {
    console.error(
      `[marking] MCQ ${point.pointCode}: expected_value "${stated}" disagrees with the mark ` +
        `scheme criterion, which says "${fromCriterion}". Refusing to mark. Fix the transcription.`,
    );
    return {
      markable: false,
      reason:
        "This question's recorded answer doesn't match its mark scheme, so it hasn't been marked automatically — a person needs to check it.",
    };
  }

  // ⚠ A STATED VALUE THAT IS NOT AN OPTION LETTER IS NOT AN ANSWER. "Banana"
  // used to be accepted as the key and marked every real choice wrong.
  if (stated && !/^[A-Z]$/.test(stated)) {
    console.error(
      `[marking] MCQ ${point.pointCode}: expected_value "${stated}" is not a single option letter. Refusing to mark.`,
    );
    return {
      markable: false,
      reason:
        "This question's recorded answer isn't a valid option, so it hasn't been marked automatically — a person needs to check it.",
    };
  }

  const key = stated ?? fromCriterion;
  if (!key) {
    return {
      markable: false,
      reason:
        "The correct option could not be read from the mark scheme, so this was not marked automatically.",
    };
  }

  if (!response || response.kind !== "mcq" || !response.choice) {
    return {
      markable: true,
      awarded: 0,
      assessedOutOf: maxMarks,
      unassessedMarks: 0,
      unassessedReason: null,
      confidence: "deterministic",
      points: [{ pointCode: point.pointCode, awarded: false, evidence: "No option was selected." }],
    };
  }

  const chose = response.choice.trim().toUpperCase();
  const correct = chose === key;
  return {
    markable: true,
    awarded: correct ? maxMarks : 0,
    // An MCQ has no working to assess: a wrong option is definitively wrong,
    // so the whole tariff is assessed and a zero here is a real zero.
    assessedOutOf: maxMarks,
    unassessedMarks: 0,
    unassessedReason: null,
    confidence: "deterministic",
    points: [
      {
        pointCode: point.pointCode,
        awarded: correct,
        evidence: correct
          ? `You chose ${chose}, which is correct.`
          : `You chose ${chose}. The correct answer is ${key}.`,
      },
    ],
  };
}

// ============================================================================
// NUMERIC
// ============================================================================

/**
 * Turn a student's typed value into a number, or null if it isn't one.
 *
 * Handles what students actually type on a chemistry paper and a keyboard:
 * thin/normal spaces as thousands separators ("245 310 000"), a comma
 * separator, unicode minus and multiplication sign, "x10^-3" and "× 10-3"
 * exponent forms Edexcel prints, and a trailing percent sign.
 *
 * Returns null — never NaN and never 0 — for anything it cannot read, so an
 * unparseable answer becomes "not marked" rather than "wrong". A student who
 * types "about 307" should not be marked incorrect by a parser's silence.
 */
/**
 * Resolve a comma in a typed number, or refuse.
 *
 *   thousands   1,234,567  — every comma separates exactly three digits, and
 *               there are TWO OR MORE of them. Nobody writes two decimal
 *               commas, so this reading is unambiguous.
 *   thousands   1,234.56   — a decimal POINT is already present, so the comma
 *               cannot also be one.
 *   decimal     3,07 / 0,0172 / 1,5  — one comma whose tail is not a group of
 *               three, so it cannot be a thousands separator.
 *   REFUSED     1,234      — one comma, exactly three digits after it, nothing
 *               else to disambiguate. This is 1234 to a British candidate and
 *               1.234 to a French one and there is NO evidence in the string
 *               that picks between them.
 *
 * ⚠ THE LAST CASE RETURNS null, WHICH MEANS "NOT MARKED", NOT "WRONG".
 * That is the same contract parseNumber already documents for "about 307": an
 * answer this layer cannot read goes to a human. A 1-in-2 guess on a mark is
 * not marking, and the failure it replaces was exactly such a guess made
 * silently and confidently.
 */
function readCommas(s: string): string | null {
  if (!s.includes(",")) return s;
  const strip = () => s.replace(/,/g, "");
  // A decimal point settles it: the comma must be grouping.
  if (s.includes(".")) {
    return /^[+-]?\d{1,3}(,\d{3})+\.\d+$/.test(s) ? strip() : null;
  }
  // Two or more well-formed groups: unambiguously thousands.
  if (/^[+-]?\d{1,3}(,\d{3}){2,}$/.test(s)) return strip();
  // Exactly one comma.
  const one = /^([+-]?\d+),(\d+)$/.exec(s);
  if (one) {
    // A three-digit tail is ambiguous and only ambiguous — refuse it.
    if (one[2].length === 3) return null;
    return `${one[1]}.${one[2]}`;
  }
  return null;
}

export function parseNumber(raw: string): number | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;

  s = s
    .replace(/[−–—]/g, "-") // unicode minus / dashes
    .replace(/[×✕✖]/g, "x") // × → x
    .replace(/[\s  ]/g, "") // spaces (incl. nbsp/thin) as thousands separators
    .replace(/%$/, "");

  // ⚠ A COMMA IS NOT ALWAYS A THOUSANDS SEPARATOR, AND GUESSING AWARDED A
  // REAL MARK FOR AN ANSWER TWO ORDERS OF MAGNITUDE WRONG.
  //
  // This used to strip every comma along with the spaces. WCH11/01 is an
  // INTERNATIONAL A Level and most of Europe writes 3.07 as "3,07", so a
  // candidate answering 20(b)(iii) (expected 307) with "3,07" — meaning 3.07 —
  // parsed to 307, matched, and was awarded a DETERMINISTIC mark. The evidence
  // printed on their own results card read "You answered 3,07, which matches
  // 307." The contradiction was on the screen and nothing acted on it.
  //
  // The same keystroke was already handled correctly one module away:
  // chemistry/equation.ts maps /(\d),(\d)/ to a decimal point and says why.
  // Two Tier 1 parsers disagreeing about one character is not a policy.
  //
  // So the comma is now READ, and where it genuinely cannot be read the answer
  // is REFUSED rather than guessed. Refusing costs a review; guessing costs a
  // wrong mark on a real paper.
  const commas = readCommas(s);
  if (commas === null) return null;
  s = commas;

  // "4.15x10-4" / "4.15x10^-4" / "4.15e-4" → 4.15e-4
  const sci = /^([+-]?\d*\.?\d+)x10\^?([+-]?\d+)$/i.exec(s);
  if (sci) {
    const mantissa = Number(sci[1]);
    const exponent = Number(sci[2]);
    if (!Number.isFinite(mantissa) || !Number.isFinite(exponent)) return null;
    return mantissa * 10 ** exponent;
  }

  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

/** Units differ only by presentation far more often than by meaning. */
const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};

/**
 * `mol/dm3` and `mol dm-3` are the SAME UNIT. Rewrite the solidus form.
 *
 * Each term after a `/` has its exponent negated: dm3 -> dm-3, dm -> dm-1.
 * Chained divisions negate each in turn, so `J/mol/K` becomes `jmol-1k-1`,
 * which is exactly what `J mol-1 K-1` normalises to.
 *
 * ⚠ A TERM IT CANNOT PARSE IS RETURNED UNCHANGED, slash and all — so it fails
 * to match rather than matching something else. An unrecognised shape must
 * become a mark sent for review, never a false accept.
 */
function expandSolidus(s: string): string {
  if (!s.includes("/")) return s;
  const [head, ...rest] = s.split("/");
  let out = head;
  for (const term of rest) {
    const m = /^([a-z]+)(-?\d+)?$/.exec(term);
    if (!m) return s;
    const negated = -(m[2] ? Number(m[2]) : 1);
    out += m[1] + (negated === 1 ? "" : String(negated));
  }
  return out;
}


function normaliseUnit(raw: string): string {
  const mapped = raw
    .toLowerCase()
    .replace(/[\s ]/g, "")
    .replace(/[·⋅*]/g, "") // middle dots / asterisks in compound units
    .replace(/\^/g, "")
    // ⚠ EVERY SUPERSCRIPT DIGIT, NOT JUST ² AND ³. The ¹ in "J mol⁻¹ K⁻¹"
    // survived as a superscript and never matched "J mol-1 K-1".
    .replace(/[⁰¹²³⁴-⁹]/g, (c) => SUPERSCRIPT_DIGITS[c] ?? c)
    // ⚠ AND EVERY DASH. parseNumber has mapped [−–—] to "-" since it was
    // written; this mapped only [⁻−], so an EN DASH — what a word processor
    // and several keyboards produce for a minus — failed here while the
    // number half of the same answer accepted it. Two halves of one answer
    // disagreeing about one character.
    .replace(/[⁻−–—]/g, "-");
  return expandSolidus(mapped);
}

/**
 * Floating-point slack that exists only to undo IEEE-754 representation error.
 *
 * NOT an examiner tolerance. `4.15x10-4` parses to 0.00041500000000000006, and
 * an expected "0.000415" parses to 0.000415 — the same answer, written two
 * ways the mark scheme itself uses interchangeably, and `===` calls them
 * different. At 1e-9 relative this cannot bridge any gap a chemist would care
 * about; it only makes equality mean equality.
 */
const FLOAT_SLACK = 1e-9;

/**
 * NO SIGNIFICANT-FIGURES RULE EXISTS HERE, AND ONE MUST NOT BE ADDED.
 *
 * WCH11/01 makes every SF instruction conditional on working this app does not
 * capture: 20(b)(iii) says "If all six operations have not been carried out
 * ignore SF", and 20(a) and 22(c) both say "Ignore SF except 1 SF" — a rule
 * that penalises only a 1-s.f. answer, not any answer with the wrong count.
 * A strict gate would fail 306.64 and 306.5 on 20(b)(iii), which this scheme
 * would accept. Tolerance is the whole comparison; revisit only if working
 * capture ever lands.
 */

/**
 * ⚠ A RELATIVE TOLERANCE THIS WIDE IS A TRANSCRIPTION FAULT, NOT A WINDOW.
 *
 * answer_tolerance is a FRACTION — 0.005 means 0.5%. The database only checks
 * `>= 0`, so someone transcribing "accept +/- 0.5" into the field writes 0.5
 * and opens a +/-50% window: on 20(b)(iii) that awards 160 and 460 for an
 * expected 307, both as REAL deterministic marks. No chemistry mark scheme
 * means that, so the value cannot be honoured as written.
 */
const MAX_SANE_TOLERANCE = 0.25;

function withinTolerance(
  student: number,
  expected: number,
  tolerance: number | null,
): boolean {
  // Relative windows, with an absolute floor so an expected value of 0 is
  // comparable at all — a purely relative window around zero is never
  // satisfiable.
  const slack = Math.max(Math.abs(expected) * FLOAT_SLACK, Number.MIN_VALUE);
  if (Math.abs(student - expected) <= slack) return true;
  if (tolerance === null || tolerance <= 0) return false;
  if (tolerance > MAX_SANE_TOLERANCE) return false;
  const window = Math.max(Math.abs(expected) * tolerance, slack);
  return Math.abs(student - expected) <= window;
}

/**
 * Is the student's value just the expected value written to fewer figures?
 *
 * ⚠ THIS DOES NOT IMPLEMENT AN SF RULE, and the comment above about not adding
 * one still stands. It answers a narrower question: could this answer be
 * RIGHT? 20(a) expects 0.0172 and the scheme says "Ignore SF except 1 SF", so
 * 0.017 is a correct answer — but the relative tolerance is 0.5% and 0.017 is
 * 1.16% away, so on a ONE-MARK numeric it was scored a CONFIRMED ZERO. The
 * marker asserting a correct answer is wrong is the one thing Tier 1 must
 * never do.
 *
 * Where this is true the question ABSTAINS rather than awarding or zeroing.
 * That deliberately also covers the 1-s.f. case the scheme rejects: "Ignore SF
 * except 1 SF" is one of the 68 lines still awaiting an examiner ruling, and
 * deferring an unruled rule to a human is this codebase's standing answer.
 */
function looksLikeSameValueToFewerFigures(studentRaw: string, expected: number): boolean {
  const digits = studentRaw.replace(/[^0-9]/g, "").replace(/^0+/, "");
  const sf = digits.length;
  if (sf < 1 || sf > 15) return false;
  const student = parseNumber(studentRaw);
  if (student === null || student === 0 || expected === 0) return false;
  // Round the EXPECTED value to the number of figures the student used.
  const rounded = Number(expected.toPrecision(sf));
  return Math.abs(student - rounded) <= Math.abs(rounded) * 1e-9;
}

export function markNumeric(
  response: ResponsePayload | null,
  maxMarks: number,
  spec: {
    expectedValue: string | null;
    expectedUnit: string | null;
    tolerance: number | null;
    acceptedValues: string[] | null;
    /**
     * Marks awarded when the final answer matches, TRANSCRIBED PER QUESTION
     * from that question's own mark scheme.
     *
     * ⚠ THERE IS NO DEFAULT AND THERE MUST NOT BE ONE. Pearson's usual shape
     * is 1 mark for the answer, 1 for the unit, the rest for working — but
     * 20(a) contradicts it outright ("Correct answer with no working scores
     * (4)"), so any rule this layer invented would be wrong on a real question
     * in this very paper. null therefore means "not transcribed", and the
     * question is reported unmarkable rather than marked by a guess.
     */
    marksOnCorrectAnswer: number | null;
    requiresUnit: boolean;
  },
  criteria: { pointCode: string; criterion: string }[],
): DeterministicResult {
  // ── TWO DIFFERENT NULLS, AND THE STUDENT MUST NOT SEE THEM AS ONE ────────
  //
  // NOT YET TRANSCRIBED: no row exists in question_expected_answers, so
  // expectedValue is null. Nobody has read this question's mark scheme into
  // the database yet. That is our backlog, not a fact about the question.
  if (!spec.expectedValue) {
    return {
      markable: false,
      reason:
        "This question hasn't been set up for automatic marking yet, so it needs review.",
    };
  }
  // DELIBERATELY NULL: a row EXISTS — someone transcribed this question — and
  // chose to record no figure, because the scheme grants those marks only on
  // a condition this app cannot test. 22(c) is the case: "Correct answer with
  // SOME WORKING scores 3", where 20(a) four questions earlier says "with NO
  // working". The difference is the examiner's, and it is load-bearing.
  //
  // So the message is about the working, not about a missing record. Saying
  // "hasn't been recorded" here would send a reviewer hunting for a
  // transcription that is already correct and complete.
  //
  // The two states are distinguishable only because the seed fixture types
  // marksOnCorrectAnswer as `number | null` REQUIRED — omitting it is a
  // compile error, so a null in the database is always a keystroke somebody
  // made on purpose. Do not make that field optional again.
  //
  // ⚠ AND THIS IS THE BRANCH WORKING WAS BUILT FOR. "Correct answer with SOME
  // WORKING scores 3" is a condition this app could not test, which is exactly
  // why the figure is null. With the working in hand the question is no longer
  // unanswerable — it is answerable by a reader, which is Tier 2. Tier 1 still
  // awards nothing here, because "some working" is a judgement and Tier 1 does
  // not make judgements.
  if (spec.marksOnCorrectAnswer === null) {
    if (workingFrom(response) !== null) {
      return {
        markable: false,
        reason:
          "The marks for this question depend on your working, which automatic marking can't judge — so it wasn't marked here.",
      };
    }
    return {
      markable: false,
      reason:
        "The marks for this question depend on your working, which we can't see yet — so it's gone for review rather than being marked here.",
    };
  }

  const finalPoint = criteria[criteria.length - 1];
  if (!finalPoint) {
    return { markable: false, reason: "This question has no mark scheme." };
  }

  // Multi-mark numeric questions carry method marks Tier 1 cannot judge: it
  // compares one number against one expected value, and M1–M5 of 20(b)(iii)
  // are five separate calculation steps. That is what makes a mismatch
  // unassessable rather than wrong — transferred error might have earned most
  // of the tariff on paper.
  //
  // ⚠ THE ONLY THING WORKING CHANGES HERE IS WHO IS ASKED NEXT.
  //
  // Tier 1's own verdicts are untouched by it: the final-answer mark is still
  // decided by comparing the value against expected_value, and
  // marks_on_correct_answer is still what a correct answer scores. 20(a) takes
  // 4/4 on a bare correct answer with or without working, because its scheme
  // says "Correct answer with no working scores (4)" and nothing below reads
  // the working to decide that.
  //
  // What changes is the SUCCESSOR of the marks Tier 1 leaves: with working
  // they go to Tier 2 as provisional method marks; without it they stay
  // exactly where they were, unassessed. Never a confirmed zero either way.
  const working = workingFrom(response);
  const hasUnseeableWorking = maxMarks > 1 && working === null;

  const answered =
    response !== null && response.kind === "numeric" && response.value.trim().length > 0;

  if (!answered) {
    if (hasUnseeableWorking) {
      return {
        markable: false,
        reason: `Nothing was entered for this question and ${WORKING_NOT_CAPTURED}.`,
      };
    }
    // Working but no final answer — a student who ran out of time mid-method.
    // Tier 1 has nothing to compare, but the method marks are real and the
    // evidence for them is on the page.
    if (maxMarks > 1 && working !== null) {
      return {
        markable: false,
        reason:
          "No final answer was given. Your working is the only thing here to mark, and automatic marking can't judge it.",
      };
    }
    return {
      markable: true,
      awarded: 0,
      assessedOutOf: maxMarks,
      unassessedMarks: 0,
      unassessedReason: null,
      confidence: "deterministic",
      points: [{ pointCode: finalPoint.pointCode, awarded: false, evidence: "No answer was given." }],
    };
  }

  const given = response as { kind: "numeric"; value: string; unit?: string };
  const student = parseNumber(given.value);
  if (student === null) {
    // Unreadable is NOT wrong — a human should look, rather than a parser
    // deciding that "approx 307" scored zero.
    return {
      markable: false,
      reason: `"${given.value.trim()}" could not be read as a number, so this was left for a human to mark.`,
    };
  }

  const candidates = [spec.expectedValue, ...(spec.acceptedValues ?? [])]
    .map((v) => ({ raw: v, num: parseNumber(v) }))
    .filter((c): c is { raw: string; num: number } => c.num !== null);
  if (candidates.length === 0) {
    return {
      markable: false,
      reason: "The recorded expected answer is not a number, so this was not marked automatically.",
    };
  }

  // ⚠ A TOLERANCE WIDER THAN THE GAP BETWEEN LISTED ANSWERS IS SELF-CONTRADICTORY.
  //
  // The window is RELATIVE, and it was applied to every candidate
  // independently. On the live 20(b)(iii) row — expected 307, accepted_values
  // ["306"], tolerance 0.005 — 0.5% of 306 is 1.53, so the two windows merged
  // into one band covering 304.47 to 308.53. A student answering 305 was
  // awarded a REAL deterministic mark for a value the scheme does not allow.
  //
  // If the examiner had to list 306 SEPARATELY from 307, the scheme plainly
  // distinguishes them at one-unit granularity, so no window may be wider than
  // half the smallest gap between the values it lists. With one candidate
  // there is no gap and the tolerance stands as transcribed.
  const gaps = candidates
    .map((c) => c.num)
    .sort((a, b) => a - b)
    .flatMap((n, i, arr) => (i === 0 ? [] : [Math.abs(n - arr[i - 1])]))
    .filter((g) => g > 0);
  const maxWindow = gaps.length ? Math.min(...gaps) / 2 : Infinity;

  const hit = candidates.find(
    (c) =>
      withinTolerance(student, c.num, spec.tolerance) &&
      Math.abs(student - c.num) <= maxWindow,
  );

  // ⚠ A UNIT-BEARING QUESTION WITH NO EXPECTED UNIT IS NOT MARKABLE.
  //
  // The gate below was `requiresUnit && expectedUnit`, and unitOk starts true,
  // so an answer_type of numeric_with_unit whose expected_unit was never
  // transcribed skipped the comparison entirely and awarded full marks for ANY
  // unit — "furlongs", or none at all. The question asks for a unit; if we do
  // not know which, we do not know whether they got it right. Same rule as
  // marks_on_correct_answer being null: report it, do not guess it.
  if (spec.requiresUnit && !spec.expectedUnit) {
    return {
      markable: false,
      reason:
        "This question needs a unit, but the expected unit hasn't been recorded for it — so it's gone for review rather than being marked here.",
    };
  }

  // Unit is checked only where the scheme requires one — a percentage yield is
  // dimensionless, and demanding a unit there would fail a correct answer.
  let unitOk = true;
  let unitNote = "";
  if (spec.requiresUnit && spec.expectedUnit) {
    const wanted = normaliseUnit(spec.expectedUnit);
    const supplied = normaliseUnit(given.unit ?? "");
    unitOk = supplied === wanted;
    unitNote = unitOk
      ? ""
      : supplied
        ? ` The unit should be ${spec.expectedUnit}, not ${given.unit}.`
        : ` No unit was given; it should be ${spec.expectedUnit}.`;
  }

  const shown = `${given.value.trim()}${given.unit ? " " + given.unit : ""}`;

  if (!hit || !unitOk) {
    // MISMATCH.
    if (hasUnseeableWorking) {
      // NEVER a confirmed zero. Award nothing at all — not even a correct
      // unit — because without the working there is no way to tell whether
      // transferred error carried most of the marks. A confirmed 0 here would
      // be this marker asserting something it cannot know.
      return {
        markable: false,
        reason: `Your answer (${shown}) doesn't match the expected one, and ${WORKING_NOT_CAPTURED}. Your method may still have earned marks.`,
      };
    }
    if (maxMarks > 1 && working !== null) {
      // Same abstention, different successor. Tier 1 still refuses to call
      // this a zero — with transferred error the method may have earned most
      // of the tariff, and now there is something to read that against.
      return {
        markable: false,
        reason: `Your answer (${shown}) doesn't match the expected one. Your method may still have earned marks, which automatic marking can't judge.`,
      };
    }
    // ⚠ NOT A ZERO IF IT IS THE SAME NUMBER TO FEWER FIGURES.
    //
    // The tolerance is the whole comparison, and it is far tighter than this
    // paper's SF instructions. On a one-mark numeric that turned a correct
    // 0.017 (2 s.f. of 0.0172) into a CONFIRMED zero — a real, authoritative
    // mark asserting a right answer was wrong.
    if (hit === undefined && unitOk && looksLikeSameValueToFewerFigures(given.value, candidates[0].num)) {
      return {
        markable: false,
        reason:
          `Your answer (${shown}) is the expected value to fewer significant figures. ` +
          `Whether that earns the mark is an examiner's decision, so it's gone for review rather than being marked here.`,
      };
    }

    // One mark, no working to assess: a genuine zero.
    return {
      markable: true,
      awarded: 0,
      assessedOutOf: maxMarks,
      unassessedMarks: 0,
      unassessedReason: null,
      confidence: "deterministic",
      points: [
        {
          pointCode: finalPoint.pointCode,
          awarded: false,
          evidence: `You answered ${shown}. The expected answer is ${spec.expectedValue}${spec.expectedUnit ? " " + spec.expectedUnit : ""}.${unitNote}`,
        },
      ],
    };
  }

  // MATCH. Award exactly what this question's scheme states, capped against
  // the tariff — a transcription of "4" onto a 3-mark question must not award
  // 4. The caller applies the same cap; doing it here too keeps the pure
  // function correct on its own terms rather than on trust.
  const awarded = Math.max(0, Math.min(spec.marksOnCorrectAnswer, maxMarks));
  const unassessed = maxMarks - awarded;

  const points: PointVerdict[] = [
    {
      pointCode: finalPoint.pointCode,
      awarded: true,
      evidence: `You answered ${shown}, which matches ${hit.raw}${spec.expectedUnit ? " " + spec.expectedUnit : ""}.`,
    },
  ];

  return {
    markable: true,
    awarded,
    // The remainder is excluded from the denominator, not counted as lost.
    assessedOutOf: awarded,
    unassessedMarks: unassessed,
    // ⚠ WHICH REASON DEPENDS ON WHAT THE STUDENT ACTUALLY DID. Saying "working
    // not captured" over working the student can see on their own screen is
    // false, and it is the kind of false that makes a reader stop reading. The
    // marks are unassessed BY TIER 1 either way; what differs is whether
    // anything can assess them next.
    unassessedReason:
      unassessed > 0 ? (working !== null ? WORKING_BEYOND_TIER1 : WORKING_NOT_CAPTURED) : null,
    confidence: "deterministic",
    points,
  };
}

// ============================================================================
// ROUTING
// ============================================================================

/** Answer types Tier 1 can mark for real marks. */
export const DETERMINISTIC_TYPES = [
  "mcq",
  "numeric",
  "numeric_with_unit",
  // Marked by chemistry/equation.ts, structurally and with no model: species,
  // balancing, states, charges and arrows. It earns its place in Tier 1 the
  // same way the others do — the same answer always produces the same marks.
  "chemical_equation",
] as const;
/** Answer types Tier 2 marks provisionally, with a model. */
export const AI_MARKED_TYPES = ["short_text", "long_text"] as const;

export type MarkingTier = "deterministic" | "ai" | "unmarkable";

export function tierFor(answerType: string): MarkingTier {
  if ((DETERMINISTIC_TYPES as readonly string[]).includes(answerType)) return "deterministic";
  if ((AI_MARKED_TYPES as readonly string[]).includes(answerType)) return "ai";
  // structure, graph, mechanism, apparatus, freehand, other:
  // no editor collected an answer, so there is nothing to mark. Marking these
  // would mean inventing a judgement about work the student made on paper.
  return "unmarkable";
}
