/**
 * What tuition a subject can actually offer, derived from the cohorts that
 * exist (§30).
 *
 * ============================================================================
 * ⚠ AVAILABILITY IS COMPUTED FROM COHORT ROWS, NEVER TYPED INTO A PAGE
 * ============================================================================
 * A hand-written "Chemistry: enrolling" on the tuition page is a claim that
 * survives the cohort closing, the payment link going dead, and the term
 * ending. Every one of those has to be a data change and nothing else, so the
 * page asks this function and the function asks the rows.
 *
 * ⚠ ENROLLING REQUIRES BOTH A STATUS AND A LINK. A cohort marked `enrolling`
 * with `enrolmentUrl: null` cannot be enrolled in — the button would go
 * nowhere. catalogue.ts already makes this point about its own CTA ("NULL
 * MEANS NO PAYMENT LINK YET"); this is the same rule at subject level, and it
 * is why `open` is an AND and not a status check.
 *
 * ⚠ THE INPUT IS STRUCTURAL, NOT `Cohort`. This module imports nothing, so a
 * bare-node suite can load it and exercise the real function rather than a
 * copy of its logic — the failure AGENTS.md describes, where a model of
 * production quietly pins yesterday's behaviour.
 */

export type CohortFacts = {
  subject: string;
  status: string;
  enrolmentUrl: string | null;
};

export type SubjectAvailability =
  /** A cohort is open AND has somewhere to enrol. */
  | { state: "enrolling"; cohorts: number }
  /** Cohorts exist for this subject, but none can be joined right now. */
  | { state: "interest"; cohorts: number }
  /** No cohort has ever been listed for this subject. */
  | { state: "none"; cohorts: 0 };

export function availabilityFor(subject: string, cohorts: readonly CohortFacts[]): SubjectAvailability {
  const mine = cohorts.filter((c) => c.subject === subject);
  if (mine.length === 0) return { state: "none", cohorts: 0 };

  const open = mine.some((c) => c.status === "enrolling" && !!c.enrolmentUrl);
  return { state: open ? "enrolling" : "interest", cohorts: mine.length };
}

/**
 * The sentence a student reads. Kept beside the derivation so a new state
 * cannot be added without someone deciding what it says out loud.
 */
export function availabilityLabel(a: SubjectAvailability): string {
  switch (a.state) {
    case "enrolling":
      return "Enrolment open";
    case "interest":
      // ⚠ NOT "COMING SOON". The cohort is real, dated and listed; what is
      // missing is the payment link. Saying so is more useful than a vague
      // holding phrase, and it is what the cohort cards below already say.
      return "Register interest";
    case "none":
      return "Not running yet";
  }
}
