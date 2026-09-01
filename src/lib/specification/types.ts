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
 * same 12-mark floor, the same "a state, not a percentage" doctrine (§21/§22).
 * This module adds exactly ONE state of its own — "unstarted" — because a
 * specification map must show every point of the course, and academic.ts only
 * ever speaks about points that have evidence. "Unstarted" is the absence of
 * evidence; "insufficient" is evidence below the floor. A student should be
 * able to tell those apart, so the type keeps them apart.
 */

import type { MasteryState } from "../account/academic.ts";

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
 * One recorded practice answer, reduced to what mastery may consume.
 * Today every row is one mark (lesson practice is 1-mark questions); the shape
 * does not assume that, so richer evidence sources can join later.
 */
export type PracticeEvidenceRow = {
  attemptId: string;
  qIndex: number;
  specCode: string;
  markAwarded: number;
  markAvailable: number;
  attemptedAt: string | null;
};

/** academic.ts's states plus the one addition this module owns. */
export type SpecMasteryState = MasteryState | "unstarted";

export type SpecMasteryFacts = {
  state: SpecMasteryState;
  /** Marks facts — the honest numbers a UI may always show ("7 of 9 marks"). */
  awarded: number;
  outOf: number;
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
