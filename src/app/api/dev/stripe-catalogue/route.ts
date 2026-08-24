import { NextResponse } from "next/server";

import { loadStripeCatalogue } from "@/lib/tuition/stripe-catalogue";

/**
 * ⚠ DEVELOPMENT ONLY. 404s in production — this exists so a developer can see
 * what the live catalogue actually contains while building the mapping, using
 * the application's own server-side env mechanism rather than a scratch script
 * holding the secret. It returns Product/Price IDs and amounts, which are not
 * secrets; it never returns the key.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const { searchParams } = new URL(_req.url);
  if (searchParams.get("raw") === "1") {
    // Raw passthrough for one price, to prove whether currency_options is
    // genuinely present on the object rather than inferred by our normaliser.
    const secret = process.env.STRIPE_SECRET_KEY ?? "";
    const id = searchParams.get("price") ?? "";
    const r = await fetch(`https://api.stripe.com/v1/prices/${id}?expand[]=currency_options`, {
      headers: { Authorization: `Bearer ${secret}` }, cache: "no-store",
    });
    const b = await r.json();
    return NextResponse.json({
      status: r.status,
      id: b.id, active: b.active, currency: b.currency, unit_amount: b.unit_amount,
      hasCurrencyOptionsKey: Object.prototype.hasOwnProperty.call(b, "currency_options"),
      currencyOptionKeys: b.currency_options ? Object.keys(b.currency_options) : null,
      currency_options: b.currency_options ?? null,
    });
  }
  const cat = await loadStripeCatalogue();
  return NextResponse.json(cat);
}
