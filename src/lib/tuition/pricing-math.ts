import type { Currency, Package } from "./tuition-types";

/**
 * Display formatting and derived comparisons. Pure, and FX-free by design.
 *
 * ⚠ NO EXCHANGE RATE LIVES HERE OR ANYWHERE ELSE IN THE TUITION LAYER. The
 * old module held QAR_PER_GBP = 4.7 and computed one currency from the other;
 * the customer saw a figure Stripe would never charge. Both currencies now
 * come from the same Stripe Price. Arithmetic WITHIN one currency — monthly ×
 * 3, total − package — is comparison, and is allowed.
 */

export function formatMinor(minor: number, currency: Currency): string {
  if (currency === "qar") {
    const whole = minor / 100;
    return `${new Intl.NumberFormat("en-GB", {
      maximumFractionDigits: Number.isInteger(whole) ? 0 : 2,
    }).format(whole)} QAR`;
  }
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
}

export type Saving = { normalMinor: number; payMinor: number; saveMinor: number; pct: number };

/** A saving, or null when the arithmetic does not support one. Never a badge. */
export function savingAgainst(normalMinor: number, payMinor: number): Saving | null {
  if (!Number.isFinite(normalMinor) || !Number.isFinite(payMinor)) return null;
  if (normalMinor <= 0 || payMinor <= 0) return null;
  const saveMinor = normalMinor - payMinor;
  if (saveMinor <= 0) return null;
  return { normalMinor, payMinor, saveMinor, pct: (saveMinor / normalMinor) * 100 };
}

/**
 * Which package is genuinely cheapest over `months`.
 *
 * ⚠ THE ACADEMIC YEAR IS NOT ASSUMED TO WIN, AND ON THIS CATALOGUE IT DOES NOT
 * AT NINE MONTHS. Three 3-month packages cover nine months of AS for 6,900 QAR
 * against 7,000 for the academic year. Badging the academic year "Best value"
 * would be the website making a false commercial claim about the founder's own
 * prices — so the badge goes to whatever this returns, or nowhere.
 */
export function cheapestFor(
  months: number,
  amounts: { monthly?: number; three_month?: number; academic_year?: number },
): Package | null {
  if (!Number.isFinite(months) || months <= 0) return null;
  const costs: { pkg: Package; total: number }[] = [];
  if (typeof amounts.monthly === "number") costs.push({ pkg: "monthly", total: amounts.monthly * months });
  if (typeof amounts.three_month === "number") {
    // Whole blocks only — you cannot buy two thirds of a package.
    costs.push({ pkg: "three_month", total: amounts.three_month * Math.ceil(months / 3) });
  }
  if (typeof amounts.academic_year === "number") {
    costs.push({ pkg: "academic_year", total: amounts.academic_year });
  }
  if (costs.length < 2) return null;
  costs.sort((a, b) => a.total - b.total);
  // A tie has no winner; picking one would be arbitrary.
  if (costs[0].total === costs[1].total) return null;
  return costs[0].pkg;
}
