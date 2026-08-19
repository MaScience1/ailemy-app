import { priceLabel, type Cohort } from "./catalogue.ts";

/**
 * Which currency a visitor sees, and what a price says.
 *
 * ============================================================================
 * ⚠ GBP IS THE PRICE. QAR IS A LABEL ON IT.
 * ============================================================================
 * price_pence is the only amount anyone is ever billed (0042). Everything here
 * decides what a visitor READS, and three rules keep that from drifting into a
 * claim the business cannot honour:
 *
 *   1. NO CONVERSION, EVER. There is no FX rate in this file, no rate in the
 *      database, and no external rate API anywhere in this system. A QAR price
 *      exists only because the founder typed it. A converted price moves on its
 *      own between the moment a parent reads it and the moment they pay.
 *   2. NO QAR FIGURE, NO QAR DISPLAY. A cohort whose price_qar is NULL renders
 *      GBP no matter where the visitor is or what they toggled. There is no
 *      fallback conversion to fill the gap, because the gap is the answer.
 *   3. THE GBP TRUTH IS ALWAYS ON SCREEN. Whenever QAR is shown, the sterling
 *      amount is shown beneath it. A parent must never have to change a setting
 *      to discover what they will actually be charged.
 *
 * ⚠ ALL OF THIS IS PURE AND RESOLVED ON THE SERVER. No client-side FX, no
 * currency guessing after hydration, and therefore no layout shift: the first
 * bytes the browser receives already say the right thing.
 */

export type Currency = "GBP" | "QAR";
export type CurrencySource = "cookie" | "geo" | "default";

/** Read server-side only. A display preference, not a security boundary. */
export const CURRENCY_COOKIE = "ailemy_currency";

/** The header Vercel sets at the edge. Absent everywhere else, which is fine. */
export const COUNTRY_HEADER = "x-vercel-ip-country";

/** ISO-3166-1 alpha-2 for Qatar — the only country that changes the default. */
const QATAR = "QA";

export function isCurrency(v: unknown): v is Currency {
  return v === "GBP" || v === "QAR";
}

/**
 * ⚠ THE CHOICE ORDER IS DELIBERATE: cookie, then geography, then GBP.
 *
 * A person who has touched the toggle has told us what they want, and no
 * amount of IP geolocation should overrule that — including on their next
 * visit, which is the whole reason it is a cookie and not request state.
 * Geography is a GUESS used only when nobody has said otherwise: a Qatari
 * visitor should not have to hunt for a toggle, and everyone else gets the
 * currency they are actually billed in.
 *
 * An unrecognised cookie value is ignored rather than trusted — it is the one
 * input here that a browser can set to anything at all.
 */
export function resolveCurrency(input: {
  country?: string | null;
  cookie?: string | null;
}): { currency: Currency; source: CurrencySource } {
  const cookie = input.cookie?.trim();
  if (isCurrency(cookie)) return { currency: cookie, source: "cookie" };

  // Case-insensitive: the header is documented uppercase, and a lowercase
  // proxy rewrite should not silently switch a visitor's currency.
  const country = input.country?.trim().toUpperCase();
  if (country === QATAR) return { currency: "QAR", source: "geo" };

  return { currency: "GBP", source: "default" };
}

export type PriceDisplay = {
  /** The headline figure. */
  primary: string;
  /**
   * ⚠ NULL ONLY WHEN primary IS ALREADY THE BILLED AMOUNT. Whenever primary is
   * QAR this is the sterling line, and a caller that forgets to render it puts
   * an unbilled number on screen alone.
   */
  billedIn: string | null;
  /** Which currency `primary` is actually in, after the NULL rule is applied. */
  shown: Currency;
};

/**
 * What one cohort's price should say.
 *
 * ⚠ `currency` IS A REQUEST, NOT A RESULT. Asking for QAR on a cohort with no
 * price_qar returns GBP, and `shown` says so. That asymmetry is the point: it
 * makes rule 2 above impossible to bypass from a template, because a template
 * never gets to decide.
 */
export function priceDisplay(
  cohort: Pick<Cohort, "pricePence" | "currency" | "priceQar">,
  currency: Currency,
): PriceDisplay {
  const gbp = priceLabel(cohort as Cohort);

  if (currency === "QAR" && cohort.priceQar !== null && cohort.priceQar > 0) {
    return {
      primary: `${cohort.priceQar} QAR/month`,
      billedIn: `Billed in GBP (${gbp})`,
      shown: "QAR",
    };
  }
  return { primary: gbp, billedIn: null, shown: "GBP" };
}

/**
 * Whether a currency toggle should appear at all on a page showing these
 * cohorts.
 *
 * ⚠ A TOGGLE THAT CHANGES NOTHING IS A DEAD CONTROL. If not one cohort on the
 * page has a QAR price, switching to QAR would redisplay the identical page and
 * leave the visitor wondering what they did wrong. Hidden is honest.
 */
export function offersCurrencyChoice(cohorts: readonly Pick<Cohort, "priceQar">[]): boolean {
  return cohorts.some((c) => c.priceQar !== null && c.priceQar > 0);
}
