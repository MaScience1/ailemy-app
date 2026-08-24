import { NextResponse, type NextRequest } from "next/server";

import { stripeConfig } from "@/lib/booking/config";
import { verifyStripeSignature } from "@/lib/tuition/stripe-signature";
import { applyGrant, GRANTING_EVENTS, ACKNOWLEDGED_EVENTS } from "@/lib/tuition/webhook-grant";

/**
 * The Stripe webhook endpoint (§27, §63).
 *
 * ============================================================================
 * ⚠ THIS IS THE ONLY THING THAT MAY CONFIRM A BOOKING OR ISSUE A CREDIT
 * ============================================================================
 * §63 is explicit: a browser redirect saying `success=true` is not proof of
 * payment. Anyone can type that URL. Payment state is established here, from a
 * signed event, or it is not established at all.
 *
 * ⚠ THE ROUTE EXISTS BEFORE THE KEYS DO, DELIBERATELY. Registering a webhook in
 * the Stripe dashboard requires a URL that already answers; an endpoint that
 * 404s until a deploy is how a first live payment gets lost. Unconfigured, it
 * answers 503 and writes nothing — Stripe retries a 503, so no event is dropped
 * on the floor while the keys are being set up.
 *
 * ============================================================================
 * ⚠ WHAT IS DELIBERATELY NOT BUILT YET
 * ============================================================================
 * Signature verification and event handling need the `stripe` package, which is
 * not a dependency of this project — installing it and writing a handler that
 * has never seen a real event would be inventing the part that most needs to be
 * tested against reality. The DECISION LOGIC those handlers will call is built
 * and tested: planPurchase's idempotency key, planSpend's one-credit-per-
 * booking rule, and the hold lifecycle all live in src/lib/booking with 70
 * assertions and seven proven sabotages.
 *
 * The remaining work is the adapter: verify the signature, map the event to a
 * plan, insert inside a transaction. It is written the day the keys arrive.
 *
 * ⚠ IT MUST NEVER TRUST req.json() BEFORE VERIFYING THE SIGNATURE. The raw body
 * is required for verification, so the handler reads text(), verifies, and only
 * then parses. Parsing first and verifying later is the classic mistake and it
 * makes the signature check decorative.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cfg = stripeConfig();

  if (!cfg.configured) {
    // ⚠ 503, NOT 200. A 200 tells Stripe the event was handled and it will
    // never be sent again — silently losing a real payment. 503 is retried.
    console.warn("[stripe] webhook received while unconfigured; missing:", cfg.missing.join(", "));
    return NextResponse.json(
      { error: "Stripe is not configured on this deployment.", missing: cfg.missing },
      { status: 503 },
    );
  }

  // ⚠ RAW BODY FIRST — signature verification needs the exact bytes.
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const verified = verifyStripeSignature({
    rawBody: raw,
    header: signature,
    secret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!verified.ok) {
    /**
     * ⚠ 400, AND STRIPE MUST NOT RETRY THIS. A bad signature is not a transient
     * fault — retrying it cannot make it valid. The reason is logged, never
     * returned: telling a caller WHY their forgery failed is a hint.
     */
    console.error("[stripe] signature rejected", { reason: verified.reason });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: { id?: unknown; type?: unknown; data?: { object?: unknown } };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const eventId = typeof event.id === "string" ? event.id : null;
  const eventType = typeof event.type === "string" ? event.type : null;
  if (!eventId || !eventType) {
    return NextResponse.json({ error: "Malformed event." }, { status: 400 });
  }

  if ((ACKNOWLEDGED_EVENTS as readonly string[]).includes(eventType)) {
    // Acknowledged so Stripe stops retrying; logged so a human can see it.
    console.info("[stripe] acknowledged", { eventId, eventType });
    return NextResponse.json({ received: true, handled: false });
  }
  if (!(GRANTING_EVENTS as readonly string[]).includes(eventType)) {
    return NextResponse.json({ received: true, handled: false });
  }

  const outcome = await applyGrant({
    eventId, eventType,
    session: (event.data?.object ?? {}) as Parameters<typeof applyGrant>[0]["session"],
  });

  if (outcome.status === "failed") {
    /**
     * ⚠ 500 SO STRIPE RETRIES. A payment was taken and the entitlement was not
     * written; acknowledging that with a 200 loses it permanently.
     */
    console.error("[stripe] grant failed", { eventId, eventType, detail: outcome.detail });
    return NextResponse.json({ error: "Grant failed." }, { status: 500 });
  }
  /**
   * ⚠ already_granted IS A 200. It means the unique index refused a replay,
   * which is the system working; returning an error would make Stripe retry a
   * grant that has already happened.
   */
  console.info("[stripe] webhook handled", { eventId, eventType, status: outcome.status, detail: outcome.detail });
  return NextResponse.json({ received: true, handled: true, status: outcome.status });
}

/**
 * ⚠ NO GET HANDLER. Stripe only POSTs, and a GET that returned 200 would let
 * an uptime checker report this endpoint healthy while POST was broken.
 */
