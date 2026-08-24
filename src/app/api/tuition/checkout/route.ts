import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { stripeConfig } from "@/lib/booking/config";
import { loadCohorts } from "@/lib/public/readers";
import { availabilityFor } from "@/lib/tuition/availability";
import { resolvePrice } from "@/lib/tuition/stripe-products";
import { parseSelection } from "@/lib/tuition/tuition-types";
import { grantFor } from "@/lib/tuition/entitlements";

/**
 * Create a Checkout Session. The server decides everything commercial.
 *
 * ============================================================================
 * ⚠ THE BROWSER SENDS FOUR ENUM MEMBERS AND NOTHING ELSE.
 * ============================================================================
 * course, mode, package, currency — each validated against a closed set by
 * parseSelection. There is no branch in this file that reads a price id, a
 * product id, a unit amount, an interval or a quantity from the request, so a
 * crafted body cannot buy a lesson for a penny or subscribe somebody to a
 * one-off package. The Price is resolved from Stripe by the server, and the
 * SAME Price is what the pricing page displayed.
 *
 * ⚠ AND STRIPE HAVING A PRICE IS NOT PERMISSION TO SELL IT. A group cohort
 * that is not open for enrolment stays closed no matter what the catalogue
 * contains — checked below against the cohort rows, not against Stripe.
 */

export const dynamic = "force-dynamic";

const STRIPE_API = "https://api.stripe.com/v1";

function form(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export async function POST(request: NextRequest) {
  const cfg = stripeConfig();
  if (!cfg.configured) {
    /**
     * ⚠ THE SAME GATE THE UI USES. A stale page can POST to an endpoint the UI
     * would not have rendered, so the server re-checks rather than trusting
     * that the button was only shown when it should have been.
     */
    return NextResponse.json(
      { error: "not_configured", missing: cfg.missing },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const sel = parseSelection(body);
  if (!sel) {
    return NextResponse.json({ error: "invalid_selection" }, { status: 400 });
  }

  // ── §15 — the cohort's own state decides whether a group seat is for sale ──
  if (sel.mode === "group") {
    const loaded = await loadCohorts().catch(() => null);
    if (!loaded || loaded.data.length === 0) {
      /**
       * ⚠ A FAILED READ IS NOT "NOTHING IS ON SALE" — it is "we do not know",
       * and the safe answer to not knowing is to refuse the sale rather than to
       * fall through to the in-code catalogue and take money against it.
       */
      return NextResponse.json({ error: "cohorts_unavailable" }, { status: 503 });
    }
    const facts = loaded.data.map((c) => ({
      subject: c.subject, status: c.status, enrolmentUrl: c.enrolmentUrl ?? null,
    }));
    const avail = availabilityFor("chemistry", facts);
    if (avail.state !== "enrolling") {
      /**
       * ⚠ 409, NOT 400. The request was well formed; the product is simply not
       * on sale. The UI keeps rendering "Register interest" from the same
       * derivation, so this is the belt to that page's braces — and the reason
       * a Stripe Payment Link must never be pasted into cohorts.enrolment_url
       * while a cohort is still `interest`.
       */
      return NextResponse.json(
        { error: "not_enrolling", state: avail.state },
        { status: 409 },
      );
    }
  }

  const resolved = await resolvePrice(sel.course, sel.mode, sel.package, sel.currency);
  if (!resolved.ok) {
    // ⚠ THE CODE IS RETURNED, THE STRIPE DETAIL IS NOT (§19). "currency_unavailable"
    // tells the UI what to say; the internal detail goes to the server log.
    console.error("[tuition/checkout] price resolution failed", resolved.error);
    return NextResponse.json({ error: resolved.error.code }, { status: 409 });
  }
  const { price } = resolved.value;

  const grant = grantFor(sel.course, sel.mode, sel.package);
  if (!grant) {
    return NextResponse.json({ error: "no_entitlement_for_selection" }, { status: 400 });
  }

  // ── §14 — attach the Ailemy identity, not just an email string ─────────────
  let userId: string | null = null;
  let email: string | null = null;
  try {
    const db = await createClient();
    const { data } = await db.auth.getUser();
    userId = data.user?.id ?? null;
    email = data.user?.email ?? null;
  } catch {
    // Not signed in is a legitimate state; Checkout collects the email and the
    // webhook falls back to it. A stronger id is used whenever one exists.
    userId = null;
  }

  const origin = request.nextUrl.origin;
  const params: Record<string, string> = {
    mode: price.kind === "recurring" ? "subscription" : "payment",
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": "1",
    // ⚠ THE CURRENCY IS PASSED EXPLICITLY (§12). Left off, Stripe would localise
    // by IP and could charge a currency the visitor did not choose on our page.
    currency: sel.currency,
    success_url: `${origin}/tuition/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/tuition?mode=${sel.mode === "one_to_one" ? "one-to-one" : "group"}&commitment=${sel.package}`,
    "metadata[course]": sel.course,
    "metadata[mode]": sel.mode,
    "metadata[package]": sel.package,
  };
  if (userId) {
    params.client_reference_id = userId;
    params["metadata[user_id]"] = userId;
  }
  if (email) params.customer_email = email;

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY ?? ""}`,
      "Content-Type": "application/x-www-form-urlencoded",
      /**
       * ⚠ IDEMPOTENT ON THE CREATE TOO (§21). A double-clicked button or a
       * retried fetch produces one session rather than two, and the key is
       * scoped to the identity plus the exact selection.
       */
      "Idempotency-Key": `checkout:${userId ?? "anon"}:${price.id}:${sel.currency}`,
    },
    body: form(params),
  });
  const session = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof session.url !== "string") {
    console.error("[tuition/checkout] stripe session failed", session);
    return NextResponse.json({ error: "checkout_unavailable" }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
