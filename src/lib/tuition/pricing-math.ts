import type { Currency } from "./tuition-types";

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

