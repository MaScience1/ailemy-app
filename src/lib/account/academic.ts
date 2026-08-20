/**
 * The academic read model: what a student's record may claim about them.
 *
 * ============================================================================
 * COMPLETION, PERFORMANCE AND MASTERY ARE THREE DIFFERENT THINGS (§21)
 * ============================================================================
 * Watching every lesson is completion. Scoring 18 of 24 is performance.
 * Knowing the topic is mastery. A single "progress" number that blends them is
 * not a summary, it is a claim nobody can check — and a student revises from
 * it.
 *
 * So this module returns three shapes and never one. There is no combined
 * score, no overall percentage, and deliberately no function that produces one.
 *
 * ⚠ MASTERY IS A STATE, NOT A PERCENTAGE (§22). "73% mastery" asserts a
 * precision that 24 marks cannot support. A state can be wrong; a percentage is
 * wrong in a way that looks authoritative.
 *
 * ⚠ AND EVERY SHAPE CAN REFUSE (§96). Unavailable is imported from
 * results-insights rather than redefined, so there is ONE refusal shape in the
 * codebase and a caller that has learned to handle one has handled all of them.
 *
 * Pure: no database, no imports beyond a type. Callers do the reading — the
 * same split results-insights.ts uses, which is what lets a test assert every
 * rule here with no credentials.
 */

import type { Unavailable } from "@/lib/exam/results-insights";

export type { Unavailable };

// ============================================================================
// COMPLETION — how much of the course has been worked through
// ============================================================================

export type CompletionSummary = {
  lessonsCompleted: number;
  /**
   * ⚠ WHAT EXISTS, NOT WHAT IS PLANNED. Content stands at 1 lesson of 375
   * written. A denominator of 375 would render a real student who has finished
   * everything available as 0% done, which is both wrong and demoralising.
   */
  lessonsAvailable: number;
  /** Seconds of video actually watched. A fact, not a virtue. */
  watchedSeconds: number;
};

export function completionFor(rows: {
  lessonId: string;
  completed: boolean;
  watchedSeconds: number;
}[], lessonsAvailable: number): CompletionSummary {
  return {
    lessonsCompleted: rows.filter((r) => r.completed).length,
    lessonsAvailable,
    watchedSeconds: rows.reduce((n, r) => n + Math.max(0, r.watchedSeconds), 0),
  };
}

// ============================================================================
// PERFORMANCE — marks, weighted by marks (§95)
// ============================================================================

/**
 * One marked question, reduced to what a cross-paper view may use.
 *
 * ⚠ assessedOutOf IS NOT maxMarks, AND THE DIFFERENCE IS THE WHOLE POINT.
 * A question the marker could not assess has awardedMarks null. Counting its
 * full tariff in the denominator would drag every figure down in proportion to
 * how much of the paper the MARKER could not handle — a measure of the marking
 * engine's coverage, reported to the student as their performance.
 *
 * This is not hypothetical. gradeFor() had exactly this defect: a Tier-1-only
 * numerator placed against an 80-mark denominator, which would have told a
 * candidate who answered everything correctly that they were at the bottom of
 * the grade ladder. Fixed there; must not be reintroduced here.
 */
export type AssessedQuestion = {
  questionId: string;
  attemptId: string;
  /** null when the question could not be assessed at all. */
  awardedMarks: number | null;
  /** The tariff actually assessed. null alongside awardedMarks. */
  assessedOutOf: number | null;
  /** The question's full tariff, whether it was assessed or not. */
  maxMarks: number;
};

export type PerformanceSummary = {
  /** Marks earned across every question that was actually assessed. */
  awarded: number;
  /** The tariff of those questions ONLY. Never the paper total. */
  assessedOutOf: number;
  /** How many questions were assessed, and how many were not. */
  questionsAssessed: number;
  questionsUnassessed: number;
  /**
   * ⚠ THE COVERAGE FIGURE EXISTS SO A UI CAN BE HONEST ABOUT ITS OWN LIMITS.
   * Tariff assessed, over tariff attempted. A low number is a statement about
   * the marking engine, and the UI says so rather than letting the student
   * read it as a statement about themselves.
   */
  tariffAttempted: number;
};

export function performanceFor(questions: AssessedQuestion[]): PerformanceSummary {
  let awarded = 0;
  let assessedOutOf = 0;
  let questionsAssessed = 0;
  let questionsUnassessed = 0;
  let tariffAttempted = 0;

  for (const q of questions) {
    tariffAttempted += Math.max(0, q.maxMarks);
    // ⚠ BOTH MUST BE PRESENT. A row with an award and no assessed tariff, or
    // the reverse, is a broken row — counting either half of it invents the
    // other. Skipped as unassessed rather than half-counted.
    if (q.awardedMarks === null || q.assessedOutOf === null) {
      questionsUnassessed += 1;
      continue;
    }
    awarded += q.awardedMarks;
    assessedOutOf += q.assessedOutOf;
    questionsAssessed += 1;
  }

  return { awarded, assessedOutOf, questionsAssessed, questionsUnassessed, tariffAttempted };
}

// ============================================================================
// MASTERY — a state per topic, with an evidence floor
// ============================================================================

/**
 * ⚠ THE FLOOR IS A JUDGEMENT AND IT IS WRITTEN DOWN HERE SO IT CAN BE ARGUED
 * WITH. Twelve marks is roughly two typical structured questions: enough that
 * one bad question does not decide a topic, few enough that a student sees
 * states rather than "not enough evidence" everywhere.
 *
 * It is deliberately counted in MARKS, not in questions or attempts (§95). Two
 * one-mark multiple-choice answers are not the same evidence as a six-mark
 * explanation, and a floor counted in questions would treat them as equal.
 */
export const MASTERY_EVIDENCE_FLOOR_MARKS = 12;

/**
 * Three bands, not five.
 *
 * ⚠ MORE BANDS IS MORE PRECISION CLAIMED, and the evidence does not support
 * five. The thresholds are round numbers on purpose: a boundary at 0.7314 would
 * imply the underlying measure is accurate to four decimal places.
 */
export const MASTERY_SECURE_AT = 0.75;
export const MASTERY_DEVELOPING_AT = 0.5;

export type MasteryState = "insufficient" | "emerging" | "developing" | "secure";

export type MasteryRow = {
  topic: string;
  state: MasteryState;
  /**
   * ⚠ THE MARKS TRAVEL WITH THE STATE, ALWAYS. "18 of 24 marks" is a fact and
   * a UI may show it. "75% mastery" is a claim and it may not. Carrying both
   * numbers means the honest version is always the easier one to render.
   */
  awarded: number;
  outOf: number;
  /** How far short of the floor, when the state is `insufficient`. 0 otherwise. */
  marksShortOfFloor: number;
  questionIds: string[];
};

export type MasteryVerdict = Unavailable | { available: true; rows: MasteryRow[] };

export function masteryFor(input: {
  questions: AssessedQuestion[];
  /** (questionId → topic). Empty when nothing has been mapped. */
  topics: { questionId: string; topic: string }[];
}): MasteryVerdict {
  if (input.topics.length === 0) {
    return {
      available: false,
      reason:
        "No question in this course has been mapped to a topic yet, so mastery cannot be broken down. This appears once the question bank is tagged.",
    };
  }

  const byQuestion = new Map<string, string>();
  for (const t of input.topics) byQuestion.set(t.questionId, t.topic);

  const buckets = new Map<string, { awarded: number; outOf: number; questionIds: string[] }>();

  for (const q of input.questions) {
    const topic = byQuestion.get(q.questionId);
    // ⚠ AN UNMAPPED QUESTION IS DROPPED, NOT BUCKETED AS "Other". An "Other"
    // row looks like a topic a student could revise and is not one.
    if (topic === undefined) continue;
    // Unassessed questions contribute NOTHING — not a zero. See AssessedQuestion.
    if (q.awardedMarks === null || q.assessedOutOf === null) continue;

    const b = buckets.get(topic) ?? { awarded: 0, outOf: 0, questionIds: [] };
    b.awarded += q.awardedMarks;
    b.outOf += q.assessedOutOf;
    b.questionIds.push(q.questionId);
    buckets.set(topic, b);
  }

  if (buckets.size === 0) {
    return {
      available: false,
      reason:
        "None of the questions attempted so far belongs to a mapped topic, so there is nothing to break down yet.",
    };
  }

  const rows: MasteryRow[] = [];
  for (const [topic, b] of buckets) {
    rows.push({
      topic,
      state: stateFor(b.awarded, b.outOf),
      awarded: b.awarded,
      outOf: b.outOf,
      marksShortOfFloor: Math.max(0, MASTERY_EVIDENCE_FLOOR_MARKS - b.outOf),
      questionIds: b.questionIds,
    });
  }

  // Weakest evidence first: the topics a student can do something about.
  rows.sort((a, b) => a.awarded / Math.max(1, a.outOf) - b.awarded / Math.max(1, b.outOf));
  return { available: true, rows };
}

function stateFor(awarded: number, outOf: number): MasteryState {
  // ⚠ THE FLOOR IS CHECKED BEFORE THE RATIO, NOT AFTER. Six out of six marks is
  // a ratio of 1.0 and is not evidence of a secure topic; checking the ratio
  // first and the floor second would let it be reported as one.
  if (outOf < MASTERY_EVIDENCE_FLOOR_MARKS) return "insufficient";
  const ratio = awarded / outOf;
  if (ratio >= MASTERY_SECURE_AT) return "secure";
  if (ratio >= MASTERY_DEVELOPING_AT) return "developing";
  return "emerging";
}

/**
 * The sentence a UI shows instead of a state it may not claim.
 *
 * ⚠ IT NAMES THE SHORTFALL. "Not enough evidence" invites a student to assume
 * the system is broken; "9 more marks of assessed work" tells them what to do.
 */
export function insufficientReason(row: MasteryRow): string {
  return `${row.outOf} mark${row.outOf === 1 ? "" : "s"} of assessed work so far — ${row.marksShortOfFloor} more needed before this topic can be rated.`;
}
