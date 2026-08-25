import type { CohortFacts } from "./availability.ts";
import { availabilityFor } from "./availability.ts";

/**
 * Which subjects Online Tuition offers, and whether each is live yet.
 *
 * ============================================================================
 * ⚠ STATUS IS DERIVED FROM COHORT ROWS, NOT DECLARED HERE.
 * ============================================================================
 * §19 forbids `if (subject === "chemistry")` scattered through the render, and
 * §18 requires a subject to move from coming-soon to active without a redesign.
 * So a subject is ACTIVE when the catalogue actually holds cohorts for it, and
 * INTEREST when it does not. Seed a Biology cohort and the badge changes on the
 * next read — no code edit, no deploy.
 *
 * ⚠ availabilityFor IS CALLED, NEVER MODIFIED. It is sabotage-proven in both
 * directions and is what flips every CTA; this file passes it the same
 * CohortFacts every other surface does and reads its answer. No condition of
 * its has been added, tightened or reordered.
 *
 * ⚠ AND IT DOES NOT WIDEN SubjectKey. The design system's union is
 * chemistry | biology | physics and is shared with Resources, Past Papers and
 * the lesson trees (§36). Maths and English are tuition subjects that do not
 * yet exist anywhere else in the product, so they live in THIS list with an
 * optional accent, and the design union is left exactly as it was.
 */

/** The canonical slugs. chemistry/biology/physics match the `subjects` table. */
export const TUITION_SUBJECTS = ["chemistry", "biology", "physics", "maths", "english"] as const;
export type TuitionSubject = (typeof TUITION_SUBJECTS)[number];

export function isTuitionSubject(v: unknown): v is TuitionSubject {
  return typeof v === "string" && (TUITION_SUBJECTS as readonly string[]).includes(v);
}

/**
 * ⚠ THE DEFAULT IS CHEMISTRY, AND THAT IS A BACKWARDS-COMPATIBILITY RULE (§4).
 * /tuition?mode=group has been linked from WhatsApp, receipts and the existing
 * marketing since before subjects existed. It must keep landing on the live
 * Chemistry experience, not on a subject picker with nothing selected.
 */
export const DEFAULT_SUBJECT: TuitionSubject = "chemistry";

export function readSubject(v: unknown): TuitionSubject {
  return isTuitionSubject(v) ? v : DEFAULT_SUBJECT;
}

/**
 * ⚠ ONLY chemistry/biology/physics CARRY A DESIGN ACCENT. Those three are the
 * design system's existing SubjectKey values. Maths and English render on the
 * neutral card treatment until somebody chooses their colours deliberately —
 * inventing two here would put unreviewed brand colours on a live page.
 */
export const SUBJECT_ACCENT: Partial<Record<TuitionSubject, "chemistry" | "biology" | "physics">> = {
  chemistry: "chemistry",
  biology: "biology",
  physics: "physics",
};

export type SubjectStatus = "active" | "interest";

export type SubjectState = {
  subject: TuitionSubject;
  status: SubjectStatus;
  /** How many cohorts the catalogue holds for it. Real count, never invented. */
  cohorts: number;
};

/**
 * ⚠ ACTIVE MEANS THE CATALOGUE HAS COHORTS FOR IT — not that they are
 * purchasable. availabilityFor decides purchasability separately and still
 * returns "interest" for a cohort with no enrolment url, which is why every
 * Chemistry CTA currently reads "Register interest" while Chemistry is ACTIVE.
 * The two ideas are deliberately distinct: ACTIVE is "we teach this", and the
 * CTA is "can you buy it today".
 */
export function subjectState(
  subject: TuitionSubject, cohorts: readonly CohortFacts[],
): SubjectState {
  const mine = cohorts.filter((c) => c.subject === subject);
  if (mine.length === 0) return { subject, status: "interest", cohorts: 0 };
  const avail = availabilityFor(subject, mine);
  return {
    subject,
    status: avail.state === "none" ? "interest" : "active",
    cohorts: mine.length,
  };
}

export function subjectStates(cohorts: readonly CohortFacts[]): SubjectState[] {
  return TUITION_SUBJECTS.map((s) => subjectState(s, cohorts));
}

/** True when the subject has nothing to sell and the funnel is interest-only. */
export function isComingSoon(state: SubjectState): boolean {
  return state.status === "interest";
}
