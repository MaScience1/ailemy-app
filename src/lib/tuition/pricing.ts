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

// ── money: two anchors, one rate ────────────────────────────────────────────

/**
 * An amount, carried in both currencies.
 *
 * ============================================================================
 * ⚠ WHICH SIDE IS THE ANCHOR IS A COMMERCIAL DECISION, NOT A TECHNICAL ONE
 * ============================================================================
 * Group programmes are priced in sterling — £169/£149/£139 are what Stripe
 * charges and what has been published — so QAR is derived from them.
 * 1-to-1 is priced in riyals: 300 and 250 an hour are the figures quoted to
 * families in Doha, so those are exact and the sterling is derived.
 *
 * ⚠ AND THE ANCHOR MUST SURVIVE DISPLAY, WHICH IS WHY THIS TYPE EXISTS.
 * Deriving £64 from 300 QAR and then re-deriving QAR from £64 gives 301 — the
 * rounding is not reversible. Storing both sides means each currency shows the
 * number that was actually decided, and neither is a round trip through the
 * other. There is still exactly ONE rate (§3); it is applied once, at the
 * moment the amount is created.
 */
export type Money = { gbpMinor: number; qarMinor: number };

/** GBP is the decided figure; QAR is a label on it. Whole riyals. */
export function fromGbp(gbpMinor: number): Money {
  return { gbpMinor, qarMinor: Math.round((gbpMinor / 100) * QAR_PER_GBP) * 100 };
}

/**
 * QAR is the decided figure; sterling is derived. Whole pounds.
 *
 * ⚠ ROUNDED TO WHOLE POUNDS, matching the rule QAR already follows — a price
 * list reading £63.83 an hour would be an artefact of arithmetic rather than a
 * price anybody chose. 300 → £64, 250 → £53.
 */
export function fromQar(qarWhole: number): Money {
  return { qarMinor: qarWhole * 100, gbpMinor: Math.round(qarWhole / QAR_PER_GBP) * 100 };
}

export const scale = (m: Money, n: number): Money => ({
  gbpMinor: m.gbpMinor * n, qarMinor: m.qarMinor * n,
});
export const minus = (a: Money, b: Money): Money => ({
  gbpMinor: a.gbpMinor - b.gbpMinor, qarMinor: a.qarMinor - b.qarMinor,
});
export const divide = (m: Money, n: number): Money => ({
  gbpMinor: Math.round(m.gbpMinor / n), qarMinor: Math.round(m.qarMinor / n),
});

// ── 1-to-1 (§5, §6, §8 of the tuition brief) ────────────────────────────────

export type OneToOneLevel = "as_a_level" | "gcse";

export const ONE_TO_ONE_LEVEL_LABEL: Record<OneToOneLevel, string> = {
  as_a_level: "AS / A-Level",
  gcse: "GCSE / International GCSE",
};

/**
 * 1-to-1 prices, anchored in RIYALS because that is how they are quoted.
 *
 * ⚠ THESE FOUR NUMBERS ARE THE PRICE LIST. Everything else about 1-to-1 —
 * the per-hour rate, the saving, the sterling equivalent — is computed from
 * them. Changing a price is changing one of these.
 *
 * Derived sterling at 4.70: 300→£64, 250→£53, 1250→£266, 1000→£213.
 */
export const ONE_TO_ONE_QAR: Record<OneToOneLevel, { hour: number; fiveHour: number }> = {
  as_a_level: { hour: 300, fiveHour: 1250 },
  gcse: { hour: 250, fiveHour: 1000 },
};

export type PackQuote = {
  level: OneToOneLevel;
  hours: number;
  total: Money;
  perHour: Money;
  /** Against buying the same hours singly. Zero for a single lesson. */
  saving: Money;
};

export function oneToOneQuote(level: OneToOneLevel, hours: 1 | 5): PackQuote {
  const p = ONE_TO_ONE_QAR[level];
  const hour = fromQar(p.hour);
  const total = hours === 1 ? hour : fromQar(p.fiveHour);
  return {
    level,
    hours,
    total,
    perHour: divide(total, hours),
    // ⚠ COMPUTED PER CURRENCY, so each side is the saving in that currency:
    // 250 QAR and £54, not one converted into the other.
    saving: hours === 1 ? { gbpMinor: 0, qarMinor: 0 } : minus(scale(hour, hours), total),
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
export function show(m: Money, currency: "GBP" | "QAR"): string {
  if (currency === "QAR") {
    return `${Math.round(m.qarMinor / 100).toLocaleString("en-GB")} QAR`;
  }
  const pounds = m.gbpMinor / 100;
  return pounds % 1 === 0
    ? `£${pounds.toLocaleString("en-GB")}`
    : `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Convenience for the GBP-anchored group prices. */
export function displayAmount(gbpMinor: number, currency: "GBP" | "QAR"): string {
  return show(fromGbp(gbpMinor), currency);
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
export function billingNote(m: Money, currency: "GBP" | "QAR"): string | null {
  return currency === "QAR" ? `Billed as ${show(m, "GBP")}` : null;
}
