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

// ── what the homepage may say about tuition (§2 of the conversion brief) ────

/**
 * A tuition call to action whose WORDS are derived from whether the thing it
 * offers can actually be done.
 *
 * ============================================================================
 * ⚠ THE BRIEF ASKED FOR "BOOK TUITION" AND "BOOK 1-TO-1". NEITHER IS TRUE YET.
 * ============================================================================
 * As of this build: CHECKOUT_BUILT is false, Stripe holds no keys, every
 * cohort in the catalogue is `status: "interest"` with `enrolmentUrl: null`,
 * and nothing in src/ ever inserts a booking. A homepage button reading "Book
 * tuition" would be the dead CTA this codebase has spent six builds removing —
 * and the calendar component two files away already says out loud that it
 * cannot take a booking. The homepage and the calendar would have been calling
 * each other liars on the same screen.
 *
 * So the WORD is derived, not chosen. The day a cohort gets a payment link, or
 * checkout ships, these functions return "Book" on their own and every surface
 * that calls them changes together. Nobody has to remember, and nobody has to
 * edit copy in four components.
 *
 * ⚠ THE INPUTS ARE STRUCTURAL SO A BARE-NODE SUITE CAN RUN THEM. Same reason
 * as qualifications/derive.ts: a rule that can only be checked by grepping its
 * own source has been shown to be TYPED, not to WORK.
 */
export type TuitionOffer = {
  /** Can a visitor complete this without talking to a human? */
  bookable: boolean;
  label: string;
  href: string;
  /** Analytics source — see CTA_SOURCES. */
  cta: string;
};

/**
 * Group tuition. Bookable only when some cohort is enrolling AND has somewhere
 * to enrol — the same AND as availabilityFor, for the same reason.
 */
export function groupOffer(cohorts: readonly CohortFacts[]): TuitionOffer {
  const bookable = cohorts.some((c) => c.status === "enrolling" && !!c.enrolmentUrl);
  return {
    bookable,
    // §39 — "group tuition", one phrase, not four competing ones.
    label: bookable ? "Book group tuition" : "See group tuition",
    href: "/tuition",
    cta: "hero_group_tuition_clicked",
  };
}

/**
 * 1-to-1. Two independent routes to a real booking, and it takes either:
 *   · BUYING needs checkout built, Stripe configured, and a sellable time.
 *   · REDEEMING needs none of that — a signed-in student holding a credit can
 *     book instantly through BookWithCredit, which never consults Stripe.
 *
 * ⚠ WHICH IS WHY viewerCanRedeem IS A PARAMETER. "Booking is shut" is false to
 * the customer who has already paid us and holds a credit; "Book 1-to-1" is
 * false to everyone else. The honest answer differs per viewer, so the caller
 * passes the viewer in rather than this guessing a single sentence for both.
 */
export function oneToOneOffer(input: {
  checkoutBuilt: boolean;
  stripeConfigured: boolean;
  sellableTimes: number;
  viewerCanRedeem: boolean;
}): TuitionOffer {
  const canBuy = input.checkoutBuilt && input.stripeConfigured && input.sellableTimes > 0;
  const bookable = canBuy || input.viewerCanRedeem;
  return {
    bookable,
    // §40 — "1-to-1", the existing Ailemy spelling, never "1-on-1"/"private".
    label: bookable ? "Book 1-to-1" : "See 1-to-1 availability",
    href: "/tuition/one-to-one",
    cta: "hero_book_one_to_one_clicked",
  };
}

/**
 * The hero's secondary action, which stands for tuition as a whole.
 *
 * §5 asked for "Book tuition →", preferring it "if the booking experience is
 * sufficiently functional". It is not, for anyone without a credit — so the
 * label falls back to something equally active and actually true. It is one
 * function so that A/B testing this wording later (§46) is a one-line change,
 * not an edit across the hero, the calendar block and the final CTA.
 */
export function heroTuitionOffer(group: TuitionOffer, oneToOne: TuitionOffer): TuitionOffer {
  const bookable = group.bookable || oneToOne.bookable;
  return {
    bookable,
    label: bookable ? "Book tuition" : "See tuition times",
    href: "/tuition",
    cta: "hero_book_tuition_clicked",
  };
}
