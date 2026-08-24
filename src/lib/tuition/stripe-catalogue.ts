import "server-only";

/**
 * The Stripe catalogue, read — never restated.
 *
 * ============================================================================
 * ⚠ STRIPE OWNS EVERY VALUE IN HERE.
 * ============================================================================
 * Active state, default price, currency options, unit amounts, recurring
 * interval, Price IDs, Product IDs. This module fetches them and normalises
 * the shape; it does not hold a copy of any of them. A constant in this file
 * that mirrored a Stripe amount would be a second source of commercial truth,
 * and the two would disagree the first time somebody edited one of them.
 *
 * ⚠ NO FX. There is no exchange rate here, no multiplier, and no currency
 * library. GBP comes from the `currency_options` of the SAME Price object that
 * Checkout will charge. If a Price has no GBP option, this reports that fact —
 * it does not compute one.
 *
 * ⚠ THE SECRET IS READ FROM process.env AND NEVER LEAVES THE SERVER.
 * `server-only` makes importing this from a client component a build error.
 */

const API = "https://api.stripe.com/v1";

export type PriceMoney = {
  currency: string;
  /** Minor units (fils, pence). Rounded when the source was a decimal string. */
  unitAmount: number;
  /** False when Stripe stored sub-minor-unit precision in unit_amount_decimal. */
  exact: boolean;
};

export type CataloguePrice = {
  id: string;
  productId: string;
  nickname: string | null;
  active: boolean;
  isDefault: boolean;
  /** "recurring" carries an interval; "one_off" does not. */
  kind: "recurring" | "one_off";
  interval: string | null;
  /** The price's own currency and amount — Stripe's `currency` / `unit_amount`. */
  base: PriceMoney;
  /**
   * Every currency this Price can be charged in, INCLUDING its base currency.
   * Read from `currency_options`; absent unless expanded on the request.
   */
  options: PriceMoney[];
  lookupKey: string | null;
  metadata: Record<string, string>;
};

export type CatalogueProduct = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  defaultPriceId: string | null;
  prices: CataloguePrice[];
};

export type CatalogueLoad = {
  products: CatalogueProduct[];
  /** Populated instead of throwing, so a page can degrade rather than 500. */
  reason?: string;
  livemode: boolean | null;
};

/**
 * ⚠ `unit_amount` IS null ON EVERY CONVERTED CURRENCY OPTION, AND THAT NEARLY
 * COST THIS FEATURE.
 *
 * A Stripe currency option carries the amount in `unit_amount_decimal` when it
 * has sub-minor-unit precision, and sets `unit_amount` to null. Every GBP
 * option on this catalogue is a converted amount, so every one of them looks
 * like this:
 *
 *     "gbp": { "unit_amount": null, "unit_amount_decimal": "6035.19" }
 *
 * Reading `unit_amount` alone reports "this Price has no GBP" for all thirteen
 * active prices — which is indistinguishable from GBP genuinely being absent,
 * and is precisely the wrong conclusion to reach when the next step would be
 * to compute one from QAR. There is no FX here and there must never be; the
 * number is Stripe's, read from the field Stripe actually put it in.
 *
 * ⚠ AND IT IS STILL DROPPED RATHER THAN DEFAULTED when neither field is
 * readable. A missing amount defaulted to 0 renders "free" against a real
 * product.
 */
function money(currency: unknown, amount: unknown, decimal: unknown): PriceMoney | null {
  const c = typeof currency === "string" ? currency.toLowerCase() : null;
  if (!c) return null;

  if (typeof amount === "number") {
    return { currency: c, unitAmount: amount, exact: true };
  }
  if (typeof decimal === "string" && decimal.trim() !== "") {
    const n = Number(decimal);
    if (!Number.isFinite(n)) return null;
    /**
     * ⚠ ROUNDED FOR DISPLAY, AND FLAGGED AS INEXACT. Stripe charges the decimal
     * amount and rounds at capture; 6035.19 pence is charged as £60.35. Showing
     * £60.3519 would be absurd and showing £60 would be wrong, so it is rounded
     * to the minor unit and `exact:false` records that the stored value carries
     * more precision than the display does.
     */
    return { currency: c, unitAmount: Math.round(n), exact: false };
  }
  return null;
}

async function stripeGet(path: string, secret: string): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; reason: string }> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Stripe-Version": "2024-06-20",
      },
      /**
       * ⚠ CACHED, BECAUSE A PRICING PAGE MUST NOT CALL STRIPE PER RENDER (§4).
       * Five minutes: long enough that a burst of traffic is one round trip,
       * short enough that changing an amount in the Stripe dashboard reaches
       * the site without a deploy. The tag lets a webhook or an admin action
       * revalidate deliberately rather than waiting the window out.
       */
      next: { revalidate: 300, tags: ["stripe-catalogue"] },
    });
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "network error" };
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const e = (body.error ?? {}) as Record<string, unknown>;
    /**
     * ⚠ THE MESSAGE IS SURFACED, THE KEY IS NOT. Stripe's error bodies never
     * contain the secret, and nothing here interpolates it into a string.
     */
    return { ok: false, reason: `stripe ${res.status}: ${String(e.message ?? "request failed")}` };
  }
  return { ok: true, body };
}

/**
 * Load every active product with its prices and currency options.
 *
 * ⚠ `expand[]=data.currency_options` ON THE PRICE LIST IS THE WHOLE POINT.
 * Without it Stripe returns only the base currency and the GBP option is
 * simply absent — which would look exactly like "this Price has no GBP" and
 * push somebody toward computing one. It is requested explicitly.
 */
export async function loadStripeCatalogue(): Promise<CatalogueLoad> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || secret.trim().length === 0) {
    return { products: [], livemode: null, reason: "STRIPE_SECRET_KEY absent" };
  }

  const prods = await stripeGet("/products?limit=100&active=true", secret);
  if (!prods.ok) return { products: [], livemode: null, reason: prods.reason };

  /**
   * ⚠ THE LIST ENDPOINT SILENTLY IGNORES expand[]=data.currency_options.
   *
   * It returns 200 with no currency_options key at all — not an error, not a
   * warning, just the base currency. Trusting it makes every Price look
   * single-currency, which reads exactly like "there is no GBP here" and is the
   * one conclusion that would push somebody into computing GBP from QAR.
   *
   * So the list is used only for identity and active state, and each ACTIVE
   * price is retrieved individually, where the expand is honoured. Archived
   * prices are kept in the shape (the mapping has to be able to SEE them in
   * order to refuse them) but are not re-fetched — nothing may select one, so
   * their currency options are never needed.
   */
  const prices = await stripeGet("/prices?limit=100", secret);
  if (!prices.ok) return { products: [], livemode: null, reason: prices.reason };

  const listed = Array.isArray(prices.body.data) ? (prices.body.data as Record<string, unknown>[]) : [];
  const priceRows: Record<string, unknown>[] = [];
  for (const row of listed) {
    if (row.active !== true || typeof row.id !== "string") { priceRows.push(row); continue; }
    const full = await stripeGet(`/prices/${row.id}?expand[]=currency_options`, secret);
    // A retrieve that fails leaves the listed row in place; its GBP option will
    // be absent and the mapping will refuse it loudly rather than guess.
    priceRows.push(full.ok ? full.body : row);
  }
  const prodRows = Array.isArray(prods.body.data) ? (prods.body.data as Record<string, unknown>[]) : [];

  const byProduct = new Map<string, CataloguePrice[]>();
  for (const p of priceRows) {
    const id = typeof p.id === "string" ? p.id : null;
    const productId = typeof p.product === "string" ? p.product : null;
    const base = money(p.currency, p.unit_amount, p.unit_amount_decimal);
    if (!id || !productId || !base) continue;

    const recurring = (p.recurring ?? null) as Record<string, unknown> | null;
    const optsRaw = (p.currency_options ?? {}) as Record<string, unknown>;
    const options: PriceMoney[] = [];
    for (const [cur, val] of Object.entries(optsRaw)) {
      const o = val as Record<string, unknown>;
      const m = money(cur, o?.unit_amount, o?.unit_amount_decimal);
      if (m) options.push(m);
    }
    // The base currency is always chargeable even when currency_options omits it.
    if (!options.some((o) => o.currency === base.currency)) options.push(base);

    byProduct.set(productId, [
      ...(byProduct.get(productId) ?? []),
      {
        id, productId,
        nickname: typeof p.nickname === "string" ? p.nickname : null,
        active: p.active !== false,
        isDefault: false, // filled in from the product below — Stripe owns it
        kind: recurring ? "recurring" : "one_off",
        interval: recurring && typeof recurring.interval === "string" ? recurring.interval : null,
        base,
        options: options.sort((a, b) => a.currency.localeCompare(b.currency)),
        lookupKey: typeof p.lookup_key === "string" ? p.lookup_key : null,
        metadata: (p.metadata ?? {}) as Record<string, string>,
      },
    ]);
  }

  const products: CatalogueProduct[] = [];
  for (const pr of prodRows) {
    const id = typeof pr.id === "string" ? pr.id : null;
    if (!id) continue;
    const defaultPriceId = typeof pr.default_price === "string" ? pr.default_price : null;
    products.push({
      id,
      name: typeof pr.name === "string" ? pr.name : "(unnamed)",
      description: typeof pr.description === "string" ? pr.description : null,
      active: pr.active !== false,
      defaultPriceId,
      // ⚠ DEFAULT IS STRIPE'S OPINION, COPIED FROM THE PRODUCT — not a local list.
      prices: (byProduct.get(id) ?? []).map((p) => ({ ...p, isDefault: p.id === defaultPriceId })),
    });
  }

  const livemode = priceRows.length > 0 ? priceRows[0].livemode === true : null;

  return { products: products.sort((a, b) => a.name.localeCompare(b.name)), livemode };
}
