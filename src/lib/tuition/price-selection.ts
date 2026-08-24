import type { Package } from "./tuition-types";

/**
 * Choosing one approved Price from a Product — pure, so it can be tested
 * against archived prices, ambiguity and wrong shapes without a network.
 *
 * ⚠ THE IO LIVES ELSEWHERE ON PURPOSE. The rule that must never regress is
 * "an archived price is never selected", and a rule you can only exercise by
 * calling Stripe is a rule you will not exercise.
 */

export type SelectablePrice = {
  id: string;
  active: boolean;
  isDefault: boolean;
  kind: "recurring" | "one_off";
  interval: string | null;
  nickname: string | null;
  currencies: string[];
};

export type SelectableProduct = {
  id: string;
  active: boolean;
  defaultPriceId: string | null;
  prices: SelectablePrice[];
};

export type SelectionFailure =
  | { code: "product_inactive"; detail: string }
  | { code: "no_match"; detail: string }
  | { code: "ambiguous"; detail: string }
  | { code: "price_inactive"; detail: string }
  | { code: "kind_mismatch"; detail: string }
  | { code: "currency_unavailable"; detail: string };

export const EXPECTED_KIND: Record<Package, "recurring" | "one_off"> = {
  single: "one_off",
  five_hour: "one_off",
  monthly: "recurring",
  three_month: "one_off",
  academic_year: "one_off",
};

const NICKNAME: Partial<Record<Package, RegExp>> = {
  five_hour: /^5-hour package/i,
  three_month: /^3-month package/i,
  academic_year: /^Academic year package/i,
};

/**
 * ⚠ EVERY CANDIDATE LIST IS FILTERED TO active FIRST, WITHOUT EXCEPTION.
 * This account carries archived GBP-denominated prices for every product —
 * exactly the shape a lenient selector picks up when the active one is missing.
 * There is no fallback branch below that can reach one.
 */
export function selectApprovedPrice(
  product: SelectableProduct, pkg: Package, currency: string,
): { ok: true; price: SelectablePrice } | { ok: false; error: SelectionFailure } {
  if (!product.active) return { ok: false, error: { code: "product_inactive", detail: product.id } };

  const active = product.prices.filter((p) => p.active);
  const re = NICKNAME[pkg];

  let candidates: SelectablePrice[];
  if (re) {
    candidates = active.filter((p) => p.nickname !== null && re.test(p.nickname));
  } else {
    // single / monthly — Stripe's own default price for the product.
    candidates = active.filter((p) => p.isDefault);
    if (candidates.length === 0 && product.prices.some((p) => p.isDefault && !p.active)) {
      return { ok: false, error: { code: "price_inactive", detail: `${product.id}: default is archived` } };
    }
  }

  if (candidates.length === 0) return { ok: false, error: { code: "no_match", detail: `${product.id}/${pkg}` } };
  if (candidates.length > 1) {
    return {
      ok: false,
      error: { code: "ambiguous", detail: `${product.id}/${pkg}: ${candidates.map((c) => c.id).join(", ")}` },
    };
  }

  const price = candidates[0];
  if (!price.active) return { ok: false, error: { code: "price_inactive", detail: price.id } };

  const want = EXPECTED_KIND[pkg];
  if (price.kind !== want) {
    return { ok: false, error: { code: "kind_mismatch", detail: `${price.id}: ${price.kind} != ${want}` } };
  }
  if (want === "recurring" && price.interval !== "month") {
    return { ok: false, error: { code: "kind_mismatch", detail: `${price.id}: interval ${price.interval}` } };
  }
  if (!price.currencies.includes(currency)) {
    return { ok: false, error: { code: "currency_unavailable", detail: `${price.id}: no ${currency}` } };
  }
  return { ok: true, price };
}
