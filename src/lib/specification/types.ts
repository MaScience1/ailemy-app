/**
 * The Specification Explorer's shapes — a read model over tables that already
 * exist, carrying only what a page can stand behind.
 *
 * ============================================================================
 * ⚠ NO PARALLEL TAXONOMY, NO PARALLEL MASTERY MODEL
 * ============================================================================
 * The hierarchy is 0001's: courses → units → topics → spec_points, with
 * lessons attached through lesson_spec_points (a lesson has NO topic_id — see
 * src/lib/resources/taxonomy.ts for the 42703 that assumption once cost).
 *
 * Mastery is src/lib/account/academic.ts's, verbatim: the same states, the
 * same 12-mark floor, the same §21/§22 doctrine as amended 2026-09-03 (a
 * percentage only where the floor is met, always beside its marks and an
 * evidence-confidence label, produced only by masteryPercent()).
 * This module adds exactly ONE state of its own — "unstarted" — because a
 * specification map must show every point of the course, and academic.ts only
 * ever speaks about points that have evidence. "Unstarted" is the absence of
 * evidence; "insufficient" is evidence below the floor. A student should be
 * able to tell those apart, so the type keeps them apart.
 */

import type { EvidenceConfidence, MasteryState } from "../account/academic.ts";

// ============================================================================
// The specification tree (public catalogue data)
// ============================================================================

export type SpecLessonLink = {
  slug: string;
  title: string;
  /** Only a live lesson gets a link; a written-but-unpublished one gets a note. */
  live: boolean;
};

export type SpecPointNode = {
  id: string;
  /** "1.4" — the code every evidence row and lesson link joins on. */
  code: string;
  title: string | null;
  /** The specification statement itself, as the exam board words it. */
  description: string;
  commandTerms: string[];
  /** Lessons mapped to this point through lesson_spec_points. */
  lessons: SpecLessonLink[];
};

export type SpecTopicNode = {
  id: string;
  code: string | null;
  name: string;
  points: SpecPointNode[];
};

export type SpecUnitNode = {
  id: string;
  code: string | null;
  name: string;
  topics: SpecTopicNode[];
};

export type SpecificationTree = {
  courseId: string;
  courseSlug: string;
  courseName: string;
  coursePathway: string | null;
  curriculumName: string;
  subjectSlug: string;
  subjectName: string;
  units: SpecUnitNode[];
  /**
   * ⚠ A FAILED READ IS REPORTED, NEVER RENDERED AS AN EMPTY SPECIFICATION.
   * An empty course and an unreadable one must not look alike (taxonomy.ts
   * doctrine, learned the expensive way).
   */
  error: string | null;
};

// ============================================================================
// Mastery over the tree (the signed-in student's own evidence)
// ============================================================================

/**
 * ⚠ THE CANONICAL MASTERY EVIDENCE CONTRACT (Phase 1 of the Service 3 work).
 *
 * One assessed answer, whatever assessed it. Every evidence source enters
 * mastery through THIS shape and only this shape — lesson practice (0065)
 * today, marked exam questions (0028 + 0080's assessed_out_of) today, and
 * later sources (Hydrogen retrieval answers, once they exist) by writing
 * through the SAME underlying attempt tables, never by inventing a third
 * pipeline. buildCourseMastery() is the one consumer; nothing else in the
 * codebase interprets evidence into mastery.
 *
 *   markAvailable = the tariff ACTUALLY ASSESSED for this row (for exam
 *   questions that is assessed_out_of, never max_marks — charging a student
 *   for marks the marker could not reach is the gradeFor defect).
 */
export type MasteryEvidenceRow = {
  /** lesson_practice_attempts.id, or question_attempts.id for exam rows. */
  attemptId: string;
  /** Position within the attempt; 0 for exam rows (one row per question). */
  qIndex: number;
  specCode: string;
  markAwarded: number;
  markAvailable: number;
  attemptedAt: string | null;
  /** Where this evidence came from — a fact for display and later weighting,
   *  never a multiplier inside masteryFor() itself. */
  source: "lesson-practice" | "exam-paper";
  /** True only for exam_attempts.mode = 'exam' sittings — the seed of the
   *  future EXAM MASTERY dimension. Practice rows are always false. */
  examConditions: boolean;
};

/** @deprecated Renamed — the practice loader was the only producer when this
 *  shape was practice-only. Use MasteryEvidenceRow. */
export type PracticeEvidenceRow = MasteryEvidenceRow;

/** academic.ts's states plus the one addition this module owns. */
export type SpecMasteryState = MasteryState | "unstarted";

export type SpecMasteryFacts = {
  state: SpecMasteryState;
  /** Marks facts — the honest numbers a UI may always show ("7 of 9 marks"). */
  awarded: number;
  outOf: number;
  /**
   * academic.ts's masteryPercent(): null below the evidence floor, so a UI
   * physically cannot print a premature percentage (§22 as amended).
   */
  percent: number | null;
  /**
   * academic.ts's confidence bands, plus "none" — this module's own addition
   * for points with no evidence at all, the same move as "unstarted".
   */
  evidenceConfidence: EvidenceConfidence | "none";
  questionCount: number;
  /** > 0 only when state is "insufficient". */
  marksShortOfFloor: number;
  /** ISO timestamp of the most recent contributing answer, when known. */
  lastPractisedAt: string | null;
};

export type CourseMastery = {
  /** Per spec point, keyed by spec code. Codes with no evidence are absent. */
  byCode: Record<string, SpecMasteryFacts>;
  /** Per topic, keyed by topic id — the same evidence re-bucketed. */
  byTopic: Record<string, SpecMasteryFacts>;
  /**
   * State counts across the WHOLE specification (unstarted included), so a
   * summary can say "3 secure · 2 developing · 8 not started" without any
   * combined percentage — §21 forbids the blend, and nothing here computes one.
   */
  summary: {
    unstarted: number;
    insufficient: number;
    emerging: number;
    developing: number;
    secure: number;
    pointsTotal: number;
    awarded: number;
    outOf: number;
  };
  /**
   * Evidence rows that could not be used: malformed marks, or a spec code
   * this course's specification does not contain. Counted so the page can be
   * honest that something was set aside, never silently absorbed.
   */
  ignoredRows: number;
  /**
   * Usable evidence, counted per source — so a UI can say what feeds the map
   * ("includes 18 marks from marked exam papers") instead of implying one
   * source is everything. Facts for display; no weighting happens here.
   */
  bySource: {
    practice: { rows: number; outOf: number };
    exam: { rows: number; outOf: number };
  };
};

// ============================================================================
// Recommended next (deterministic V1 — a future engine replaces the FUNCTION,
// not these shapes)
// ============================================================================

export type RecommendReason =
  | "weak" /* emerging with the evidence floor met — revise this first */
  | "developing" /* partial mastery — push it over */
  | "finish-evidence" /* below the floor — a little more practice rates it */
  | "not-started"; /* untouched, in curriculum order */

export type RecommendedItem = {
  specCode: string;
  topicId: string;
  reason: RecommendReason;
  facts: SpecMasteryFacts;
};

// ============================================================================
// Phase 2+ seams — TYPES ONLY, deliberately unimplemented
// ============================================================================
// The Service 3 plan (owner-approved 2026-09-03) names four future functions:
// trendFor(), retentionFor(), retrievalQueue(), masteryContextForHydrogen().
// Their OUTPUT shapes are settled here so Phase 1 code (and Hydrogen, on its
// own branch) can be written against them, but no implementation exists yet —
// a stub that returns invented states would be worse than an absent function.
// All four are pure calculations over MasteryEvidenceRow history: the
// append-only 0065/0028 tables carry timestamps, so every one of these is
// derivable with no new storage.

/** trendFor(): recent evidence vs earlier evidence, per bucket. */
export type TrendState =
  | "improving"
  | "declining"
  | "stable"
  | "stalled"
  | "insufficient-evidence";

/**
 * retentionFor(): confidence that demonstrated competence is still available
 * now. ⚠ ORTHOGONAL TO MASTERY, BY DECISION — a stale strong topic keeps its
 * demonstrated percent and gains a retention flag; history is never silently
 * rewritten downward.
 */
export type RetentionBand = "fresh" | "aging" | "at-risk" | "stale";

/** retrievalQueue(): one entry per spec code worth retrieving, ranked. */
export type RetrievalCandidate = {
  specCode: string;
  topicId: string;
  retention: RetentionBand;
  lastDemonstratedAt: string | null;
  facts: SpecMasteryFacts;
};

/**
 * masteryContextForHydrogen(): the structured academic state Hydrogen reads.
 * Hydrogen INTERPRETS this and decides what to do; it never writes mastery —
 * its evidence enters through the same attempt tables as everything else.
 */
export type MasteryContext = {
  courseId: string;
  weakestAreas: RecommendedItem[];
  strongestAreas: { specCode: string; topicId: string; facts: SpecMasteryFacts }[];
  retrievalDue: RetrievalCandidate[];
  recentlyImproved: { specCode: string; topicId: string; trend: TrendState }[];
  stalledAreas: { specCode: string; topicId: string; trend: TrendState }[];
  summary: CourseMastery["summary"];
};
