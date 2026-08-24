import "server-only";

import { loadStripeCatalogue, type CatalogueProduct, type CataloguePrice } from "./stripe-catalogue";
import type { Course, Mode, Package, Currency } from "./tuition-types";
import { packageFitsMode } from "./tuition-types";
import { selectApprovedPrice, type SelectableProduct } from "./price-selection";

/**
 * Which Stripe Product is which course — and NOTHING else.
 *
 * ============================================================================
 * ⚠ THIS MAP HOLDS IDENTITY, NOT COMMERCE.
 * ============================================================================
 * A Product ID is a name for a thing. An amount, an active flag, a default
 * price, a currency option and a recurring interval are all COMMERCIAL FACTS,
 * and every one of them is read from Stripe at request time. Nothing in this
 * file restates a price, and no test in this repo asserts an amount against a
 * constant that lives here — that would be the codebase agreeing with itself
 * about a number Stripe owns.
 *
 * ⚠ IT IS A MAP RATHER THAN A NAME MATCH ON PURPOSE. Matching
 * "Ailemy Group Tuition — Year 11 GCSE/IGCSE Chemistry" by string would make a
 * typo in the Stripe dashboard silently unmap a product, and an em-dash is
 * exactly the character somebody retypes as a hyphen.
 */
const PRODUCT_BY_KEY: Record<string, string> = {
  "as:one_to_one": "prod_V86CfDRuhrr1nZ",
  "gcse:one_to_one": "prod_V87GLdbRzbjQbj",
  "year11:one_to_one": "prod_V87GLdbRzbjQbj",
  "year10:one_to_one": "prod_V87GLdbRzbjQbj",
  "as:group": "prod_V87SD7TNaBd0SH",
  "year11:group": "prod_V881CvSvGjtu10",
  "year10:group": "prod_V88Hk0nxg9ywNw",
};

export function productIdFor(course: Course, mode: Mode): string | null {
  return PRODUCT_BY_KEY[`${course}:${mode}`] ?? null;
}

/** Every mapped product id, for the report and for the coverage test. */
export const MAPPED_PRODUCT_IDS = [...new Set(Object.values(PRODUCT_BY_KEY))];

export type ResolveFailure =
  | { code: "no_product"; detail: string }
  | { code: "product_inactive"; detail: string }
  | { code: "no_match"; detail: string }
  | { code: "ambiguous"; detail: string }
  | { code: "price_inactive"; detail: string }
  | { code: "currency_unavailable"; detail: string }
  | { code: "kind_mismatch"; detail: string }
  | { code: "catalogue_unavailable"; detail: string };

export type Resolved = {
  price: CataloguePrice;
  product: CatalogueProduct;
  /** The amount that will actually be charged in the requested currency. */
  amountMinor: number;
};

/**
 * ⚠ SELECTORS READ STRIPE'S OWN FIELDS. Not a hardcoded price id, and not an
 * amount — a nickname Stripe stores, or the default price Stripe designates.
 *
 * `single` and `monthly` resolve to the PRODUCT'S DEFAULT PRICE, because Stripe
 * owns which price is default and §28 asks us to verify that rather than
 * assert our own copy of it. If somebody changes the default in the dashboard,
 * this follows — and the kind check below fails loudly if the new default is
 * the wrong shape.
 */

/**
 * Resolve one selection to one approved, active Stripe Price.
 *
 * ⚠ EVERY FAILURE MODE IS LOUD. No match, more than one candidate, an inactive
 * price, the wrong recurring shape, or a currency the Price cannot be charged
 * in — each returns a named failure and the caller renders an honest state.
 * There is no branch here that returns "the closest one".
 */
export async function resolvePrice(
  course: Course, mode: Mode, pkg: Package, currency: Currency,
): Promise<{ ok: true; value: Resolved } | { ok: false; error: ResolveFailure }> {
  if (!packageFitsMode(mode, pkg)) {
    return { ok: false, error: { code: "no_match", detail: `${mode} does not sell ${pkg}` } };
  }
  const productId = productIdFor(course, mode);
  if (!productId) return { ok: false, error: { code: "no_product", detail: `${course}:${mode}` } };

  const cat = await loadStripeCatalogue();
  if (cat.reason) return { ok: false, error: { code: "catalogue_unavailable", detail: cat.reason } };

  const product = cat.products.find((p) => p.id === productId);
  if (!product) return { ok: false, error: { code: "no_product", detail: productId } };
  if (!product.active) return { ok: false, error: { code: "product_inactive", detail: productId } };

  /**
   * ⚠ THE DECISION IS MADE BY THE PURE SELECTOR. Everything that can go wrong
   * — archived, ambiguous, wrong shape, missing currency — is decided there and
   * exercised directly by the suite against fixtures, including fixtures built
   * from this account's real archived prices.
   */
  const chosen = selectApprovedPrice(
    {
      id: product.id, active: product.active, defaultPriceId: product.defaultPriceId,
      prices: product.prices.map((p) => ({
        id: p.id, active: p.active, isDefault: p.isDefault, kind: p.kind,
        interval: p.interval, nickname: p.nickname,
        currencies: p.options.map((o) => o.currency),
      })),
    } satisfies SelectableProduct,
    pkg, currency,
  );
  if (!chosen.ok) return { ok: false, error: chosen.error };

  const price = product.prices.find((p) => p.id === chosen.price.id)!;
  const option = price.options.find((o) => o.currency === currency)!;

  return { ok: true, value: { price, product, amountMinor: option.unitAmount } };
}
