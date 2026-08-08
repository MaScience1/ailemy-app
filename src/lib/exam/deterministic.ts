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

export type PointVerdict = {
  pointCode: string;
  awarded: boolean;
  /** Why, in one line, quoting what was compared. Shown to the student. */
  evidence: string;
};

export type DeterministicResult =
  | {
      markable: true;
      awarded: number;
      outOf: number;
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
      outOf: maxMarks,
      confidence: "deterministic",
      points: [{ pointCode: point.pointCode, awarded: false, evidence: "No option was selected." }],
    };
  }

  const chose = response.choice.trim().toUpperCase();
  const correct = chose === key;
  return {
    markable: true,
    awarded: correct ? maxMarks : 0,
    outOf: maxMarks,
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
     * Marks awarded when the final answer matches, as the SCHEME STATES IT.
     * null means the scheme is silent — award the final point only and report
     * the method marks as unmarked. Never a boolean: a boolean awards the full
     * tariff on a scheme that only granted part of it. See 0031.
     *
     * The caller has already capped this at maxMarks; capped again here so the
     * pure function is correct on its own terms rather than on trust.
     */
    marksOnCorrectAnswer: number | null;
    requiresUnit: boolean;
  },
  criteria: { pointCode: string; criterion: string }[],
): DeterministicResult {
  if (!spec.expectedValue) {
    // 0031's whole purpose. Without a transcribed answer there is nothing
    // trustworthy to compare against — see that migration for why parsing it
    // out of the guidance prose at runtime is not an acceptable substitute.
    return {
      markable: false,
      reason:
        "No expected answer has been recorded for this question, so it was not marked automatically.",
    };
  }

  const finalPoint = criteria[criteria.length - 1];
  if (!finalPoint) {
    return { markable: false, reason: "This question has no mark scheme." };
  }

  if (!response || response.kind !== "numeric" || !response.value.trim()) {
    return {
      markable: true,
      awarded: 0,
      outOf: maxMarks,
      confidence: "deterministic",
      points: [{ pointCode: finalPoint.pointCode, awarded: false, evidence: "No answer was given." }],
    };
  }

  const student = parseNumber(response.value);
  if (student === null) {
    // Unreadable is NOT wrong. A human should look rather than a parser
    // deciding a student who wrote "approx 307" scored zero.
    return {
      markable: false,
      reason: `"${response.value.trim()}" could not be read as a number, so this was left for a human to mark.`,
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

  // Unit is checked only where the scheme requires one. A percentage yield is
  // dimensionless: demanding a unit there would fail a correct answer, which
  // is why `numeric` and `numeric_with_unit` are separate answer types.
  let unitOk = true;
  let unitNote = "";
  if (spec.requiresUnit && spec.expectedUnit) {
    const given = normaliseUnit(response.unit ?? "");
    const want = normaliseUnit(spec.expectedUnit);
    unitOk = given === want;
    unitNote = unitOk
      ? ""
      : given
        ? ` The unit should be ${spec.expectedUnit}, not ${response.unit}.`
        : ` No unit was given; it should be ${spec.expectedUnit}.`;
  }

  const correct = Boolean(hit) && unitOk;

  // THE MARK-COUNT GUARD, in both directions.
  //
  // The student typed one value, so only the final point can be judged from
  // it. Awarding more than that requires the scheme to have SAID how many —
  // and to have said a number, not a yes. `Math.min(..., maxMarks)` is the
  // second half of the clamp the caller also applies: a transcription of "4"
  // onto a 3-mark question must never award 4.
  const stated = spec.marksOnCorrectAnswer;
  const awardable = stated === null ? 1 : Math.max(0, Math.min(stated, maxMarks));
  const awarded = correct ? awardable : 0;

  const points: PointVerdict[] = [
    {
      pointCode: finalPoint.pointCode,
      awarded: correct,
      evidence: correct
        ? `You answered ${response.value.trim()}${response.unit ? " " + response.unit : ""}, which matches ${hit!.raw}.`
        : `You answered ${response.value.trim()}${response.unit ? " " + response.unit : ""}. The expected answer is ${spec.expectedValue}${spec.expectedUnit ? " " + spec.expectedUnit : ""}.${unitNote}`,
    },
  ];

  // Method points the award did not cover are reported as unmarked rather
  // than failed — the student may well have earned them on paper, and this
  // marker cannot see the paper. 20(b)(iii) is the live case: its scheme
  // states no figure, so five of its six marks land here.
  if (awardable < criteria.length && criteria.length > 1) {
    for (const c of criteria.slice(0, -1)) {
      points.unshift({
        pointCode: c.pointCode,
        awarded: false,
        evidence:
          "Method mark — not awarded automatically, because only your final answer was captured.",
      });
    }
  }

  return {
    markable: true,
    awarded,
    outOf: maxMarks,
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
