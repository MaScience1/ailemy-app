import type { Course, Mode, Package, EntitlementGrant } from "./tuition-types";

/**
 * What a paid selection is worth — a pure function, so it can be tested
 * without Stripe, without a database and without a webhook.
 *
 * ============================================================================
 * ⚠ A GROUP PURCHASE NEVER BECOMES 1-to-1 CREDITS.
 * ============================================================================
 * They are different products with different economics: a credit books an hour
 * of the teacher's time alone, a cohort seat does not. Crossing them would let
 * somebody buy a month of group tuition at 700 QAR and spend it as private
 * hours worth 300 QAR each. The union below makes the two shapes structurally
 * different so the mistake cannot be made by assignment.
 *
 * ⚠ AND THE CREDIT COUNTS ARE THE PACKAGE'S DEFINITION, NOT A PRICE.
 * "five_hour" means five lessons because that is what the package IS; the
 * number does not vary with what Stripe charges, and reading it from an amount
 * would make a price change silently change how many lessons somebody owns.
 */
export function grantFor(course: Course, mode: Mode, pkg: Package): EntitlementGrant | null {
  if (mode === "one_to_one") {
    // The 1-to-1 catalogue splits by level, not by year group: the GCSE product
    // serves year10 and year11 alike.
    const level = course === "as" ? "as_a_level" : "gcse";
    if (pkg === "single") return { kind: "one_to_one_credits", level, credits: 1 };
    if (pkg === "five_hour") return { kind: "one_to_one_credits", level, credits: 5 };
    return null;
  }
  if (mode === "group") {
    if (pkg === "monthly" || pkg === "three_month" || pkg === "academic_year") {
      return { kind: "group_enrolment", course, term: pkg };
    }
    return null;
  }
  return null;
}

/**
 * The idempotency key a grant is written under.
 *
 * ⚠ THE STRIPE EVENT ID, AND NOTHING ELSE. lesson_credit_transactions carries a
 * unique index on this column, so a replayed webhook — which Stripe WILL send,
 * by design, on any non-2xx or timeout — fails the insert instead of issuing a
 * second batch of credits. The key is the event, not the session: Stripe
 * retries the same event id, and two different events about one session are
 * two different facts.
 */
export function idempotencyKeyFor(eventId: string): string {
  return `stripe:${eventId}`;
}
