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

  const key = (expectedValue?.trim().toUpperCase() || null) ?? extractMcqKey(point.criterion);
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
export function parseNumber(raw: string): number | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;

  s = s
    .replace(/[−–—]/g, "-") // unicode minus / dashes
    .replace(/[×✕✖]/g, "x") // × → x
    .replace(/[\s  ,]/g, "") // spaces (incl. nbsp/thin) and comma separators
    .replace(/%$/, "");

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
function normaliseUnit(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s ]/g, "")
    .replace(/[·⋅*]/g, "") // middle dots / asterisks in compound units
    .replace(/\^/g, "")
    .replace(/[⁻−]/g, "-") // superscript minus
    .replace(/³/g, "3")
    .replace(/²/g, "2");
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
  const window = Math.max(Math.abs(expected) * tolerance, slack);
  return Math.abs(student - expected) <= window;
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
  if (spec.marksOnCorrectAnswer === null) {
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

  // Multi-mark numeric questions carry method marks this app cannot see: the
  // editor captured one value, not the student's working. That is what makes
  // a mismatch unassessable rather than wrong — transferred error might have
  // earned most of the tariff on paper.
  const hasUnseeableWorking = maxMarks > 1;

  const answered =
    response !== null && response.kind === "numeric" && response.value.trim().length > 0;

  if (!answered) {
    if (hasUnseeableWorking) {
      return {
        markable: false,
        reason: `Nothing was entered for this question and ${WORKING_NOT_CAPTURED}.`,
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

  const hit = candidates.find((c) => withinTolerance(student, c.num, spec.tolerance));

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
    unassessedReason: unassessed > 0 ? WORKING_NOT_CAPTURED : null,
    confidence: "deterministic",
    points,
  };
}

// ============================================================================
// ROUTING
// ============================================================================

/** Answer types Tier 1 can mark for real marks. */
export const DETERMINISTIC_TYPES = ["mcq", "numeric", "numeric_with_unit"] as const;
/** Answer types Tier 2 marks provisionally, with a model. */
export const AI_MARKED_TYPES = ["short_text", "long_text"] as const;

export type MarkingTier = "deterministic" | "ai" | "unmarkable";

export function tierFor(answerType: string): MarkingTier {
  if ((DETERMINISTIC_TYPES as readonly string[]).includes(answerType)) return "deterministic";
  if ((AI_MARKED_TYPES as readonly string[]).includes(answerType)) return "ai";
  // structure, graph, chemical_equation, mechanism, apparatus, freehand, other:
  // no editor collected an answer, so there is nothing to mark. Marking these
  // would mean inventing a judgement about work the student made on paper.
  return "unmarkable";
}
