/**
 * What it means to "have" a course — three things, kept apart (§11).
 *
 * ============================================================================
 * ⚠ STUDYING IT, BEING TAUGHT IT, AND BEING ALLOWED TO OPEN IT ARE DIFFERENT
 * ============================================================================
 *   enrolled     public.student_courses — the student says they study this.
 *   tuition      public.cohort_enrolments — they hold a seat in a live class.
 *   entitled     public.entitlements (0058) — they may open the paid content.
 *
 * §11 says these are "not necessarily the same thing" and to architect
 * accordingly. So there is no `hasCourse` boolean anywhere in this file, and
 * there is deliberately no function that reduces the three to one — the moment
 * such a function exists, every caller uses it and the distinction is gone.
 *
 * ⚠ AND TUITION CANNOT BE ATTACHED TO A COURSE TODAY. public.cohorts (0009) has
 * a slug, a title and a price — and NO course_id or subject_id. There is no
 * foreign key from a live class to the course it teaches. So `tuition` is an
 * ACCOUNT-LEVEL fact ("you are in these cohorts"), never a per-course one.
 *
 * Matching `ial-chem-as-sep-2026` against a Chemistry course by substring would
 * be exactly the inference §10 forbids — "do not infer ownership merely because
 * a student visited a course page" — with a slug standing in for the visit. It
 * would also be wrong the first time a cohort is renamed. The gap is recorded
 * for the schema backlog rather than papered over; see COHORT_COURSE_LINK.
 *
 * Pure: no database, no imports beyond a type. Callers do the reading.
 */

import type { Unavailable } from "@/lib/exam/results-insights";

export type { Unavailable };

/**
 * ⚠ A NAMED SCHEMA GAP, NOT A TODO. Written here so the reason survives: any
 * future `cohorts.course_id` migration makes per-course tuition state possible,
 * and until then a UI that shows "your Chemistry class" beside a Chemistry
 * course is asserting a link the database cannot make.
 */
export const COHORT_COURSE_LINK =
  "public.cohorts has no course_id (0009), so a live class cannot be attached to a course. Tuition is reported at account level until that column exists.";

// ============================================================================
// THE THREE STATES
// ============================================================================

export type CourseAccess = {
  /** student_courses row exists. They say they study it. */
  enrolled: boolean;
  /**
   * entitlements row, active, for this course. They may open paid content.
   *
   * ⚠ FALSE IS THE CORRECT VALUE FOR EVERY STUDENT TODAY and does not mean
   * anything is broken: Stripe is keyless, so the only rows 0058 can hold are
   * admin grants. A UI must read false as "not purchased", never as an outage.
   */
  entitled: boolean;
};

export type AccountTuition = {
  /** Cohort slugs the student holds a seat in. Account level — see the header. */
  cohortSlugs: string[];
  /** ⚠ Always present, so a caller cannot forget why this is not per-course. */
  note: string;
};

export function accountTuition(cohortSlugs: string[]): AccountTuition {
  return { cohortSlugs: [...cohortSlugs], note: COHORT_COURSE_LINK };
}

// ============================================================================
// COMPLETION — a ratio only when the denominator can carry one
// ============================================================================

/**
 * ⚠ THE THRESHOLD EXISTS BECAUSE "100% COMPLETE" ON A ONE-LESSON COURSE IS
 * TECHNICALLY TRUE AND ACTIVELY MISLEADING.
 *
 * Content stands at roughly one published lesson out of 375 planned. A student
 * who opens that lesson is not 100% through Chemistry, and a percentage says
 * they are — with no way for them to tell it apart from a real one. Below this
 * many published lessons the honest rendering is the raw fraction, which
 * carries its own denominator and cannot be misread.
 *
 * Ten is a judgement, written down here so it can be argued with rather than
 * discovered in a component.
 */
export const MIN_LESSONS_FOR_PERCENT = 10;

export type CourseCompletion =
  | Unavailable
  | {
      available: true;
      completed: number;
      published: number;
      /**
       * ⚠ THE READ MODEL DECIDES THIS, NOT THE COMPONENT (§92). The mobile app
       * consumes the same shape, and an honesty rule that lives in a React file
       * is a rule the other client does not have.
       */
      display: { kind: "percent"; value: number } | { kind: "fraction" };
    };

export function courseCompletion(input: {
  completed: number;
  published: number;
}): CourseCompletion {
  const { completed, published } = input;

  if (published <= 0) {
    /**
     * ⚠ NOT 0%. Zero published lessons means the COURSE has no content yet, and
     * "0% complete" reads as a statement about the student. This is the single
     * most likely wrong render on the profile today, because it is true of
     * almost every course.
     */
    return {
      available: false,
      reason: "No lessons are published on this course yet, so there is nothing to be a proportion of.",
    };
  }

  // A count above the denominator means the two came from different questions.
  const done = Math.max(0, Math.min(completed, published));

  return {
    available: true,
    completed: done,
    published,
    display:
      published >= MIN_LESSONS_FOR_PERCENT
        ? { kind: "percent", value: Math.round((done / published) * 100) }
        : { kind: "fraction" },
  };
}

/** The sentence a UI shows. One place, so both clients say the same thing. */
export function completionLabel(c: CourseCompletion): string {
  if (!c.available) return c.reason;
  if (c.display.kind === "percent") return `${c.display.value}% complete`;
  return `${c.completed} of ${c.published} lesson${c.published === 1 ? "" : "s"} complete`;
}

/**
 * ⚠ AND THE CAVEAT TRAVELS WITH IT WHILE THE LIBRARY IS SMALL. A student
 * looking at "1 of 1 lessons complete" should be told the course is still being
 * written, or they will read it as having finished Chemistry.
 */
export function completionCaveat(c: CourseCompletion): string | null {
  if (!c.available) return null;
  if (c.published >= MIN_LESSONS_FOR_PERCENT) return null;
  return "This course is still being written — more lessons are on the way.";
}
