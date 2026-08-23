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

/**
 * GBP → QAR. GBP is what Stripe charges; QAR is a label a Doha parent can read.
 *
 * ⚠ NOT A LIVE RATE, AND DELIBERATELY NOT. There is no rate API in this system
 * and a price that moves with the market would change under a reader mid-visit.
 * QAR is pegged to USD, so this is stable in practice; it is reviewed by hand.
 */
export const QAR_PER_GBP = 4.7;

/** §19 — the one place a commitment discount is defined. */
export const DISCOUNTS = {
  monthly: 0,
  three_month: 0.10,
  /**
   * ⚠ CHANGE THIS ONE NUMBER TO MOVE THE LAUNCH OFFER TO 15%. Nothing else
   * needs editing: every price, saving and per-month equivalent recomputes.
   */
  academic_year: 0.20,
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
 * The academic programme's real teaching window (§7 of the header, §18, §47).
 *
 * ⚠ THIS IS COMMERCIAL CONFIGURATION, NOT SCHEDULE DATA, AND THE DISTINCTION
 * IS WHY IT LIVES HERE. `cohorts` carries onboarding_on and starts_on but no
 * end date, and the academic PROGRAMME — which months a family is billed for —
 * is a different fact from which evenings are taught. When an end date is
 * added to the cohort row this becomes a read; until then it is stated once,
 * here, rather than assumed as "12 months" anywhere.
 *
 * ⚠ AND NOTHING HARDCODES NINE. billableMonths() counts the calendar months
 * the window actually touches. Move the end date and the price follows.
 */
export const PROGRAMME_WINDOW: Record<string, { firstTeachingISO: string; lastTeachingISO: string }> = {
  "ial-chemistry-as-sep-2026": { firstTeachingISO: "2026-09-15", lastTeachingISO: "2027-05-21" },
};

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

/** The months a commitment covers, resolving "programme" against the window. */
export function monthsFor(commitment: Commitment, cohortSlug: string): number {
  const spec = COMMITMENT_MONTHS[commitment];
  if (spec !== "programme") return spec;
  const w = PROGRAMME_WINDOW[cohortSlug];
  // ⚠ NO WINDOW, NO ACADEMIC OPTION. Returning a guess here would price a
  // year-long commitment against a programme nobody has defined the end of.
  return w ? billableMonths(w.firstTeachingISO, w.lastTeachingISO) : 0;
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
export function quote(monthlyMinor: number, commitment: Commitment, cohortSlug: string): Quote | null {
  const months = monthsFor(commitment, cohortSlug);
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

/**
 * 1-to-1 prices, in GBP minor units, because GBP is what is charged.
 *
 * ⚠ THE QAR HEADLINES IN THE BRIEF IMPLY A DIFFERENT RATE — see this file's
 * header. These GBP figures are the brief's own GBP numbers; at QAR_PER_GBP
 * they display as ~282 and ~1175 rather than 300 and 1250. Raising the hourly
 * to 6400 makes the QAR headline read 300 exactly. One line, founder's call.
 */
export const ONE_TO_ONE_PRICES: Record<OneToOneLevel, { hourMinor: number; fiveHourMinor: number }> = {
  as_a_level: { hourMinor: 6000, fiveHourMinor: 25000 },
  gcse: { hourMinor: 5000, fiveHourMinor: 20000 },
};

export type PackQuote = {
  level: OneToOneLevel;
  hours: number;
  totalMinor: number;
  perHourMinor: number;
  /** Against buying the same hours singly. Zero for a single lesson. */
  savingMinor: number;
};

export function oneToOneQuote(level: OneToOneLevel, hours: 1 | 5): PackQuote {
  const p = ONE_TO_ONE_PRICES[level];
  const totalMinor = hours === 1 ? p.hourMinor : p.fiveHourMinor;
  return {
    level,
    hours,
    totalMinor,
    perHourMinor: Math.round(totalMinor / hours),
    savingMinor: hours === 1 ? 0 : p.hourMinor * hours - p.fiveHourMinor,
  };
}

// ── display ─────────────────────────────────────────────────────────────────

/**
 * GBP minor units → the figure to show, in the viewer's currency.
 *
 * ⚠ QAR IS ROUNDED TO WHOLE RIYALS. Showing 794.30 QAR implies a precision the
 * conversion does not have — it is a label on a sterling price, not a second
 * price. GBP keeps its pence because that is the amount actually charged.
 */
export function displayAmount(gbpMinor: number, currency: "GBP" | "QAR"): string {
  if (currency === "QAR") {
    const qar = Math.round((gbpMinor / 100) * QAR_PER_GBP);
    return `${qar.toLocaleString("en-GB")} QAR`;
  }
  const pounds = gbpMinor / 100;
  return pounds % 1 === 0
    ? `£${pounds.toLocaleString("en-GB")}`
    : `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The sterling amount, when the reader is being shown riyals.
 *
 * ⚠ THIS EXISTS BECAUSE GBP IS WHAT STRIPE CHARGES (§7). currency.ts states
 * the rule already — "whenever QAR is shown, the sterling price is too" — and
 * dropping it here would have let a parent read 1,175 QAR, be charged £250,
 * and find the two do not match at their bank's rate. The QAR figure is a
 * label; this is the price.
 *
 * Returns null in GBP, where the amount on screen is already the billed one.
 */
export function billingNote(gbpMinor: number, currency: "GBP" | "QAR"): string | null {
  return currency === "QAR" ? `Billed as ${displayAmount(gbpMinor, "GBP")}` : null;
}
