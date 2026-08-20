/**
 * Whether this deployment can take a payment (§26, and the founder's hard gate).
 *
 * ============================================================================
 * ⚠ ONE FLAG, DERIVED FROM THE KEYS THEMSELVES
 * ============================================================================
 * Not a boolean env var somebody can set to "true" without the keys behind it.
 * Stripe is configured exactly when all three values are present; there is no
 * way to claim it is configured and be wrong, because the claim IS the keys.
 *
 * ⚠ WHEN IT IS FALSE, NOTHING CUSTOMER-PAYABLE RENDERS. Not a disabled Book
 * button, not a "coming soon" modal that opens a broken checkout — the page
 * shows an honest register-interest state instead. A dead Book button is the
 * failure the standing rails name explicitly.
 *
 * ⚠ AND THE SERVER CHECKS AGAIN. Every booking action re-reads this before
 * doing anything, because a stale page can POST to an endpoint the UI would
 * not have shown.
 */

export type StripeConfig = {
  configured: boolean;
  /** Which of the three are missing — for an admin banner, never for a visitor. */
  missing: string[];
  /** True only when the keys are live rather than test. */
  live: boolean;
};

const KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
] as const;

export function stripeConfig(env: Record<string, string | undefined> = process.env): StripeConfig {
  const missing = KEYS.filter((k) => !env[k] || env[k]!.trim().length === 0);
  const secret = env.STRIPE_SECRET_KEY ?? "";
  return {
    configured: missing.length === 0,
    missing,
    // ⚠ TEST KEYS ARE sk_test_…, LIVE ARE sk_live_…. Surfaced so an admin
    // screen can say which mode it is in — a test-mode deployment quietly
    // taking real bookings is a support incident waiting to happen.
    live: secret.startsWith("sk_live_"),
  };
}

/** Convenience for the many call sites that only want the boolean. */
export function stripeConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return stripeConfig(env).configured;
}
