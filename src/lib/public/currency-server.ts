import "server-only";

import { cookies, headers } from "next/headers";

import {
  COUNTRY_HEADER, CURRENCY_COOKIE, resolveCurrency,
  type Currency, type CurrencySource,
} from "@/lib/public/currency";

/**
 * The visitor's currency, decided on the server before a byte is sent.
 *
 * ⚠ THIS IS THE ONLY PLACE THE REQUEST IS READ. resolveCurrency() holds the
 * decision and is pure; this function does nothing but fetch two strings and
 * hand them over. That split is what lets the rules be tested — cookie beats
 * geo, QA means QAR, junk is ignored — without a request object.
 *
 * ⚠ IT FAILS TO GBP, NEVER TO QAR. If headers() or cookies() throw in some
 * future rendering context, the visitor sees the currency they are actually
 * billed in. The wrong direction of failure would put an unbilled number on a
 * page with no sterling line beside it.
 */
export async function currentCurrency(): Promise<{ currency: Currency; source: CurrencySource }> {
  try {
    const [h, c] = await Promise.all([headers(), cookies()]);
    return resolveCurrency({
      country: h.get(COUNTRY_HEADER),
      cookie: c.get(CURRENCY_COOKIE)?.value ?? null,
    });
  } catch {
    return { currency: "GBP", source: "default" };
  }
}
