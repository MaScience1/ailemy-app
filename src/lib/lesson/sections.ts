/**
 * The six sections of a lesson, and the vocabulary everything else agrees on.
 *
 * ============================================================================
 * ⚠ COMPLETION IS NOT PERFORMANCE IS NOT MASTERY (§27)
 * ============================================================================
 * A section is COMPLETE when the student has covered it. That is all it means.
 * It carries no claim about how well they did: a student can complete the
 * practice section with 3/10, and the lesson can read "complete" while their
 * MCQ performance reads 30%. The three live in different places on purpose —
 * completion here, performance in lesson_practice_attempts / the exam attempt
 * tables, mastery derived from evidence in src/lib/account/academic.ts. Never
 * collapse them into one number, and never let a completion tick imply skill.
 *
 * ⚠ THE KEY IS A STRING WITH A CHECK, NOT SIX COLUMNS. A seventh section then
 * costs a CHECK amendment, not a re-issue of column-scoped grants (0064's
 * enumerated GRANT INSERT/UPDATE is exactly the trap a column-per-section
 * design walks into).
 *
 * This module is pure data — no imports, no server-only, no client hooks — so
 * the page, the client journey component, the server actions and the test
 * suite all read the SAME list rather than three copies that drift.
 */

export const LESSON_SECTIONS = [
  "video",
  "slides",
  "notes",
  "worked_examples",
  "practice",
  "exam_questions",
] as const;

export type LessonSectionKey = (typeof LESSON_SECTIONS)[number];

export type SectionStatus = "not_started" | "in_progress" | "complete";

/**
 * How a section can become complete.
 *
 * ⚠ "auto" REQUIRES REAL EVIDENCE (§25, §105). Automatic completion fires only
 * where the app genuinely observed the thing: every slide frame reached, an
 * attempt submitted, every worked example revealed. Where no such evidence
 * exists — notes, and video until playback progress is actually tracked — the
 * only honest route is the student saying so, which is what "manual" is. We do
 * not infer that a student read something because the section was on screen.
 */
export type CompletionSource = "manual" | "auto";

export const SECTION_META: Record<
  LessonSectionKey,
  {
    /** Stable anchor (§30) — deep links, journey nav, review actions. */
    anchor: string;
    /** The student-facing name. */
    label: string;
    /** The journey step verb — WATCH → LEARN → CONSOLIDATE → … */
    stage: string;
    /** What, if anything, can complete this section without the student saying so. */
    autoEvidence: string | null;
  }
> = {
  video: {
    anchor: "video",
    label: "Video",
    stage: "Watch",
    // Observed from the player's own timeupdate against its own duration —
    // see MuxLessonPlayer.onProgress, which refuses to report at all when the
    // duration is not a usable number. Nothing here is inferred from "the
    // section was on screen".
    autoEvidence: "90% of the video watched",
  },
  slides: {
    anchor: "slides",
    label: "Slides",
    stage: "Learn",
    autoEvidence: "every slide in the deck reached",
  },
  notes: {
    anchor: "notes",
    label: "Notes",
    stage: "Consolidate",
    autoEvidence: null, // reading is not observable; the student says so (§25)
  },
  worked_examples: {
    anchor: "worked-examples",
    label: "Worked examples",
    stage: "Understand",
    autoEvidence: "every example revealed to its answer",
  },
  practice: {
    anchor: "practice",
    label: "Practice",
    stage: "Check",
    // §18: ATTEMPTED, not passed. Completion must not require a score.
    autoEvidence: "one full attempt submitted",
  },
  exam_questions: {
    anchor: "exam-questions",
    label: "Exam questions",
    stage: "Apply",
    autoEvidence: "the configured number of questions attempted",
  },
};

export const isSectionKey = (v: unknown): v is LessonSectionKey =>
  typeof v === "string" && (LESSON_SECTIONS as readonly string[]).includes(v);

export type SectionState = {
  key: LessonSectionKey;
  status: SectionStatus;
  completedAt: string | null;
  source: CompletionSource | null;
};

/**
 * The lesson's completion headline.
 *
 * ⚠ THE DENOMINATOR IS THE SECTIONS THIS LESSON ACTUALLY HAS (§89, §90). A
 * lesson with no video and no exam questions is complete at 4/4, not stuck
 * forever at 4/6 waiting for content nobody has written. Passing the present
 * sections in is the caller's job precisely because presence is a page-level
 * fact — the store knows what a student did, not what exists to be done.
 */
export function summarise(
  present: readonly LessonSectionKey[],
  states: Partial<Record<LessonSectionKey, SectionState>>,
): { complete: number; total: number; percent: number; allComplete: boolean } {
  const total = present.length;
  const complete = present.filter((k) => states[k]?.status === "complete").length;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
  return { complete, total, percent, allComplete: total > 0 && complete === total };
}
