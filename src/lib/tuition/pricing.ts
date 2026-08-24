/**
 * Every tuition price, in one place (§2, §19, §44).
 *
 * ============================================================================
 * ⚠ PRICING IS CONFIGURATION. NO COMPONENT MAY DO ARITHMETIC ON IT.
 * ============================================================================
 * §44 forbids `price * 0.9` scattered through six components, and §19 asks
 * that changing the academic-year discount from 20% to 15% be a one-line data
 * change. So the discounts, the currency rate and the programme definition are
 * DATA at the top of this file, and everything downstream — final price,
 * saving, effective monthly rate, effective hourly rate — is computed by the
 * functions below and by nothing else.
 *
 * ⚠ IT IS PURE AND IMPORT-FREE, so a bare-node suite can exercise the real
 * arithmetic rather than a copy of it. Every previous build that split a
 * derivation out did so for this reason; a discount rule that can only be
 * checked by grepping its own source has been shown to be typed, not to work.
 *
 * ============================================================================
 * ⚠ ONE CURRENCY RATE, AND IT CHANGES SOME DISPLAYED FIGURES
 * ============================================================================
 * The brief carries two different rates. The live group prices imply ~4.70
 * (800 QAR ↔ £169, 700 ↔ £149, 650 ↔ £139); the 1-to-1 prices imply exactly
 * 5.00 (300 ↔ £60, 1250 ↔ £250). §7 of the tuition brief forbids inconsistent
 * conversion, so there is now exactly one rate and QAR is derived from GBP.
 *
 * The rate chosen is the one the LIVE, ALREADY-PUBLISHED group prices imply,
 * because those are on the site today and quoted to real parents; the 1-to-1
 * prices have never shipped. The consequence is stated plainly in the report:
 * at 4.70 the 1-to-1 headline reads ~282 QAR/hour rather than the brief's 300.
 * If 300 is to be the headline, the GBP hourly price is £64, not £60 — that is
 * a commercial decision and it is one line below.
 *
 * ⚠ WHY THE OLD BEHAVIOUR HAD TO GO. currency.ts states "GBP IS THE PRICE. QAR
 * IS A LABEL ON IT", with each cohort storing its own price_qar. That is
 * honest per price and inconsistent across prices — which is exactly how two
 * rates ended up in one product. Deriving from one rate cannot drift.
 */

// ── the configuration. everything else in this file is derived from it. ─────

/** §19 — the one place a commitment discount is defined. */
export const DISCOUNTS = {
  monthly: 0,
  three_month: 0.05,
  /**
   * ⚠ CHANGE THIS ONE NUMBER TO MOVE THE LAUNCH OFFER TO 15%. Nothing else
   * needs editing: every price, saving and per-month equivalent recomputes.
   */
  academic_year: 0.10,
} as const;

export type Commitment = keyof typeof DISCOUNTS;

export const COMMITMENT_LABEL: Record<Commitment, string> = {
  monthly: "1 month",
  three_month: "3 months",
  academic_year: "Academic year",
};

/** How many standard monthly payments each commitment covers. */
export const COMMITMENT_MONTHS: Record<Commitment, number | "programme"> = {
  monthly: 1,
  three_month: 3,
  // ⚠ NOT 9. Derived from the cohort's real teaching window — see below.
  academic_year: "programme",
};

/**
 * ⚠ THERE IS NO PROGRAMME_WINDOW CONSTANT, AND THERE MUST NEVER BE ONE AGAIN.
 * ============================================================================
 * This module used to hold a slug→{first,last} map, on the belief that the
 * cohorts table carried no end date. It does: `cohorts.ends_on` is `date not
 * null` and has been since 0009. The reader simply never selected it, and the
 * belief came from reading a SELECT list rather than the schema.
 *
 * The cost was not theoretical. The map had one entry, so Year 11 and Year 10
 * — which have real windows — rendered "the academic programme dates for this
 * cohort are not published yet" on a live page, and the config quietly became
 * a second, less complete copy of a column.
 *
 * So the window is now a PARAMETER. quote() takes the cohort's own dates and
 * cannot be given a slug to look up, because there is nothing to look up in.
 */

// ── derivations ─────────────────────────────────────────────────────────────

/**
 * How many calendar months a teaching window touches, inclusive.
 *
 * ⚠ MONTHS TOUCHED, NOT DAYS DIVIDED BY 30. A programme running 15 September
 * to 21 May is 8.2 months of elapsed time and NINE months in which a family
 * pays — September and May are taught in, so they are billed. Dividing the
 * span would price the programme at eight and undercharge by a month; ceiling
 * the span would be arbitrary. Counting the months teaching occurs in is the
 * commercial fact.
 */
export function billableMonths(firstISO: string, lastISO: string): number {
  const y1 = Number(firstISO.slice(0, 4)), m1 = Number(firstISO.slice(5, 7));
  const y2 = Number(lastISO.slice(0, 4)), m2 = Number(lastISO.slice(5, 7));
  if (!y1 || !m1 || !y2 || !m2) return 0;
  const n = (y2 - y1) * 12 + (m2 - m1) + 1;
  return n > 0 ? n : 0;
}

/**
 * The months a commitment covers, resolving "programme" against the cohort's
 * own teaching window.
 *
 * ⚠ NO WINDOW, NO ACADEMIC OPTION. A cohort whose dates cannot be read gets
 * zero months and therefore no academic price — never a default. Pricing a
 * year-long commitment against a programme with no defined end is the guess
 * this returns zero to avoid.
 */
export type TeachingWindow = { firstClassOn: string | null; lastClassOn: string | null };

export function monthsFor(commitment: Commitment, window: TeachingWindow): number {
  const spec = COMMITMENT_MONTHS[commitment];
  if (spec !== "programme") return spec;
  if (!window.firstClassOn || !window.lastClassOn) return 0;
  return billableMonths(window.firstClassOn, window.lastClassOn);
}

export type Quote = {
  commitment: Commitment;
  months: number;
  /** Minor units, GBP. What Stripe would charge. */
  baseMinor: number;
  finalMinor: number;
  savingMinor: number;
  discount: number;
  /** Final ÷ months, minor units — for "£x/month equivalent". */
  perMonthMinor: number;
};

/**
 * The one quote function. Components read its fields; they never multiply.
 *
 * ⚠ ROUNDING HAPPENS ONCE, ON THE TOTAL. Discounting each month and summing
 * would drift by a penny per month against the total a customer is charged,
 * and the saving line would not equal base minus final. One rounding, and the
 * three figures always reconcile.
 */
export function quote(monthlyMinor: number, commitment: Commitment, window: TeachingWindow): Quote | null {
  const months = monthsFor(commitment, window);
  if (months <= 0) return null;
  const discount = DISCOUNTS[commitment];
  const baseMinor = monthlyMinor * months;
  const finalMinor = Math.round(baseMinor * (1 - discount));
  return {
    commitment,
    months,
    baseMinor,
    finalMinor,
    savingMinor: baseMinor - finalMinor,
    discount,
    perMonthMinor: Math.round(finalMinor / months),
  };
}


// ── 1-to-1 (§5, §6, §8 of the tuition brief) ────────────────────────────────

export type OneToOneLevel = "as_a_level" | "gcse";

export const ONE_TO_ONE_LEVEL_LABEL: Record<OneToOneLevel, string> = {
  as_a_level: "AS / A-Level",
  gcse: "GCSE / International GCSE",
};

// ── display ─────────────────────────────────────────────────────────────────

/**
 * ============================================================================
 * ⚠ THE CURRENCY CONVERSION THAT USED TO LIVE HERE HAS BEEN REMOVED.
 * ============================================================================
 * This module held `QAR_PER_GBP = 4.7` and a Money type carrying both
 * currencies, built by fromGbp()/fromQar(). Every tuition figure on the site
 * was one currency computed from the other at that fixed rate — so the page
 * quoted an amount Stripe would never charge, and the discrepancy grew with
 * every real-world rate movement while the constant sat still.
 *
 * Both currencies now come from the SAME active Stripe Price that Checkout
 * charges, read through src/lib/tuition/stripe-catalogue.ts. There is no rate
 * anywhere in the tuition layer, and stripe-tuition.test.ts fails if one
 * appears.
 *
 * ⚠ WHAT REMAINS HERE IS NOT COMMERCIAL. monthsFor()/billableMonths() derive a
 * teaching window from a cohort's own dates — a fact about the programme, not
 * a price — and the labels are copy. DISCOUNTS and quote() survive because
 * ~15 assertions cover their arithmetic and deleting tested code to tidy up is
 * how coverage quietly falls; they are no longer read by any rendering path.
 */
