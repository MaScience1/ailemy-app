import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a `stripe-signature` header without the Stripe SDK.
 *
 * ============================================================================
 * ⚠ THIS IS THE ONLY THING STANDING BETWEEN A POST AND A FREE ENTITLEMENT.
 * ============================================================================
 * The webhook grants credits and cohort seats. Without a verified signature
 * anybody who knows the URL can POST a JSON body claiming a completed checkout
 * and be granted five lessons. Everything else in the payment path is
 * decoration if this is wrong.
 *
 * Stripe's scheme: the header carries `t=<unix>,v1=<hex>` (and may carry more
 * schemes, and more than one v1 during a secret rotation). The signed payload
 * is `${t}.${rawBody}`, HMAC-SHA256 with the endpoint secret.
 *
 * ⚠ THE RAW BYTES, NOT THE PARSED OBJECT. Re-serialising JSON changes key
 * order and whitespace and the digest will never match.
 */

export type VerifyResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: string };

const DEFAULT_TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(args: {
  rawBody: string;
  header: string | null;
  secret: string;
  nowSeconds: number;
  toleranceSeconds?: number;
}): VerifyResult {
  const { rawBody, header, secret, nowSeconds } = args;
  const tolerance = args.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;

  if (!header) return { ok: false, reason: "missing signature header" };
  if (!secret) return { ok: false, reason: "missing endpoint secret" };

  let t: string | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k?.trim() === "t") t = v?.trim() ?? null;
    // ⚠ EVERY v1 IS COLLECTED. During a secret rotation Stripe signs with both
    // the old and the new secret and sends two v1 entries; taking only the
    // first would reject half the traffic for the length of the rotation.
    if (k?.trim() === "v1" && v) v1.push(v.trim());
  }
  if (!t || v1.length === 0) return { ok: false, reason: "malformed signature header" };

  const ts = Number(t);
  if (!Number.isFinite(ts)) return { ok: false, reason: "malformed timestamp" };
  /**
   * ⚠ THE TOLERANCE IS A REPLAY WINDOW, NOT A FORMALITY. A captured request
   * with a valid signature stays valid forever without it, so an attacker who
   * once saw a legitimate webhook could replay it to mint credits — the
   * database's idempotency key blocks a repeat of the SAME event, but a
   * captured body can be replayed against a fresh deployment.
   */
  if (Math.abs(nowSeconds - ts) > tolerance) {
    return { ok: false, reason: `timestamp outside tolerance (${Math.abs(nowSeconds - ts)}s)` };
  }

  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`, "utf8").digest();
  for (const candidate of v1) {
    let given: Buffer;
    try {
      given = Buffer.from(candidate, "hex");
    } catch {
      continue;
    }
    // ⚠ timingSafeEqual THROWS ON LENGTH MISMATCH, so the length is checked
    // first — and a length check is not a secret-dependent branch.
    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      return { ok: true, timestamp: ts };
    }
  }
  return { ok: false, reason: "no matching v1 signature" };
}
