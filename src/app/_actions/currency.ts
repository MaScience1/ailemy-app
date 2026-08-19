"use server";

import { cookies } from "next/headers";

import { CURRENCY_COOKIE, isCurrency } from "@/lib/public/currency";

/**
 * The currency toggle's only side effect.
 *
 * ⚠ IT VALIDATES BEFORE IT WRITES. This is a public POST endpoint reachable by
 * anything that can guess it, and the value it stores is read back on every
 * subsequent render. isCurrency() means the cookie can only ever hold "GBP" or
 * "QAR" — and resolveCurrency() ignores anything else anyway, so an unknown
 * value would fall back to GBP rather than break a page. Two layers, because
 * this one is the one a browser can reach.
 *
 * ⚠ NOT httpOnly:false. Nothing in the browser reads this — the currency is
 * resolved server-side and baked into the HTML. Keeping it httpOnly means a
 * script on the page cannot read or set a visitor's currency preference.
 *
 * A form submit re-renders the current route, so the new currency is on screen
 * in the same response. There is no client-side re-render and no layout shift.
 */
export async function setCurrency(formData: FormData): Promise<void> {
  const value = String(formData.get("currency") ?? "");
  if (!isCurrency(value)) return;

  (await cookies()).set(CURRENCY_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}
