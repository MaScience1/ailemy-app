import "server-only";

import { resolvePrice } from "./stripe-products";
/**
 * ⚠ RE-EXPORTED, NOT REIMPLEMENTED. The pure half lives in pricing-math.ts so
 * the suites — bare `node`, no bundler — can load it; a second copy here would
 * be two formatters that drift.
 */
import { formatMinor } from "./pricing-math";
export { formatMinor, savingAgainst, type Saving } from "./pricing-math";
import type { Course, Mode, Package, Currency, PriceView } from "./tuition-types";
import { PACKAGES_FOR } from "./tuition-types";

/**
 * Display amounts and derived comparisons — no FX, no restated prices.
 *
 * ============================================================================
 * ⚠ THERE IS NO EXCHANGE RATE IN THIS FILE AND THERE MUST NEVER BE ONE.
 * ============================================================================
 * The previous pricing module held `QAR_PER_GBP = 4.7` and computed one
 * currency from the other. That number was always going to drift from what
 * Stripe charges, and the customer would have seen one figure and been billed
 * another. Both currencies now come from the SAME Stripe Price object that
 * Checkout uses, so the two cannot disagree by construction.
 *
 * Arithmetic on amounts of the SAME currency — monthly × 3, total − package —
 * is ordinary comparison and is allowed. Arithmetic ACROSS currencies is not.
 */

/**
 * ⚠ Intl, NOT A HAND-ROLLED FORMATTER (§8). QAR renders without decimals
 * because the approved amounts are whole riyals and "300.00 QAR" reads as a
 * system that does not know its own prices; GBP keeps two, because Stripe's
 * converted amounts genuinely land on pennies.
 */

export type PricingLoad = {
  views: Partial<Record<Package, PriceView>>;
  /** Named failures, so a surface can say WHY rather than showing nothing. */
  failures: { package: Package; code: string; detail: string }[];
};

/** Every package a mode sells, resolved for both currencies in one pass. */
export async function loadPricing(course: Course, mode: Mode): Promise<PricingLoad> {
  const views: Partial<Record<Package, PriceView>> = {};
  const failures: PricingLoad["failures"] = [];

  for (const pkg of PACKAGES_FOR[mode]) {
    // Resolve once for QAR; the same Price carries every currency it supports,
    // so a second resolve per currency would be a second chance to disagree.
    const r = await resolvePrice(course, mode, pkg, "qar");
    if (!r.ok) {
      failures.push({ package: pkg, code: r.error.code, detail: r.error.detail });
      continue;
    }
    const { price } = r.value;
    const amounts: Partial<Record<Currency, number>> = {};
    const formatted: Partial<Record<Currency, string>> = {};
    for (const cur of ["qar", "gbp"] as const) {
      const opt = price.options.find((o) => o.currency === cur);
      // ⚠ A CURRENCY THE PRICE CANNOT BE CHARGED IN IS OMITTED, NOT COMPUTED.
      if (!opt) continue;
      amounts[cur] = opt.unitAmount;
      formatted[cur] = formatMinor(opt.unitAmount, cur);
    }
    views[pkg] = {
      course, mode, package: pkg,
      stripePriceId: price.id,
      type: price.kind,
      interval: price.interval,
      amounts, formatted,
    };
  }
  return { views, failures };
}

/**
 * Which package is genuinely cheapest for a given number of months.
 *
 * ⚠ THE ACADEMIC YEAR IS NOT ASSUMED TO WIN, AND ON THIS CATALOGUE IT OFTEN
 * DOES NOT. Buying three 3-month packages covers nine months for 3 × 2,300 =
 * 6,900 QAR on the AS course, against 7,000 for the academic year. A "Best
 * value" badge on the academic year would be a false commercial claim made by
 * the website about the founder's own prices.
 *
 * So the badge is awarded to whichever option this function finds cheapest for
 * the months actually being taught, and if that is not the academic year, the
 * academic year does not get a badge. The price is not touched either way.
 */
