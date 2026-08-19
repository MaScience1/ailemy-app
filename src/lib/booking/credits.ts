/**
 * Lesson credits: a balance derived from an append-only ledger (§33, §61).
 *
 * ============================================================================
 * ⚠ THERE IS NO credits_remaining ANYWHERE, AND THERE MUST NOT BE
 * ============================================================================
 * A stored counter can be wrong and cannot say why. A ledger can be audited,
 * and — far more important here — a webhook retry that tries to add the same
 * four credits twice is refused by a UNIQUE constraint on the idempotency key
 * rather than by the handler remembering it already ran.
 *
 * ⚠ EVERY FUNCTION HERE IS PURE AND TAKES `now`. The database enforces the
 * invariants; these mirror them so a student sees a sentence instead of a
 * constraint violation, and so all of it can be sabotaged with no credentials.
 */

export type CreditReason =
  | "purchase" | "booking" | "cancellation_refund" | "admin_adjustment" | "expiry";

export type CreditTx = {
  id: string;
  userId: string;
  /** Positive adds, negative consumes. Never zero — 0047 refuses it. */
  delta: number;
  reason: CreditReason;
  bookingId: string | null;
  idempotencyKey: string | null;
  /** Null means these credits never expire. */
  expiresAt: string | null;
  createdAt: string;
};

/**
 * What a student may spend right now.
 *
 * ⚠ EXPIRED PURCHASES DO NOT COUNT, BUT THEIR SPEND STILL DOES. A +4 that has
 * expired is dropped; the -1 that was spent from it is not. Dropping both would
 * hand back a credit the student already used, and is how a balance drifts
 * upward every time a package lapses.
 */
export function balance(txs: readonly CreditTx[], now: Date): number {
  let total = 0;
  for (const tx of txs) {
    if (tx.delta > 0 && tx.expiresAt !== null && new Date(tx.expiresAt) <= now) continue;
    total += tx.delta;
  }
  return total;
}

/** The ledger as a student reads it — newest first. */
export function ledgerLines(txs: readonly CreditTx[]): CreditTx[] {
  return [...txs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type SpendRefusal =
  | { ok: false; reason: "no-credits"; balance: number }
  | { ok: false; reason: "already-spent-on-this-booking" };

export type SpendPlan = { ok: true; tx: Omit<CreditTx, "id" | "createdAt"> };

/**
 * Consume exactly one credit for a booking (§31, §36).
 *
 * ⚠ IT REFUSES AT ZERO, AND THE DATABASE REFUSES AGAIN. §33: never a negative
 * balance, never one credit spent twice, never client-side manipulation. This
 * is the readable half; 0047's partial unique index on (booking_id) WHERE
 * delta < 0 is the half that survives a replayed request.
 */
export function planSpend(
  txs: readonly CreditTx[],
  userId: string,
  bookingId: string,
  now: Date,
): SpendPlan | SpendRefusal {
  // ⚠ CHECKED BEFORE THE BALANCE. Replaying a booking request must be a no-op,
  // not a second debit — and saying "you have no credits" to someone whose
  // credit was already spent on this very lesson would be a lie.
  if (txs.some((t) => t.bookingId === bookingId && t.delta < 0)) {
    return { ok: false, reason: "already-spent-on-this-booking" };
  }

  const available = balance(txs, now);
  if (available < 1) return { ok: false, reason: "no-credits", balance: available };

  return {
    ok: true,
    tx: {
      userId, delta: -1, reason: "booking",
      bookingId, idempotencyKey: null, expiresAt: null,
    },
  };
}

/**
 * Credits from a completed purchase (§31).
 *
 * ⚠ THE IDEMPOTENCY KEY IS REQUIRED, NOT OPTIONAL. Stripe retries on any
 * non-2xx and on timeouts, so this WILL be called more than once for one
 * payment. Without a key the second call issues four more credits and nothing
 * anywhere notices.
 */
export function planPurchase(args: {
  userId: string;
  credits: number;
  eventId: string;
  packageId: string | null;
  validityMonths: number | null;
  now: Date;
}): SpendPlan | { ok: false; reason: "invalid-credits" } {
  if (!Number.isInteger(args.credits) || args.credits < 1) {
    return { ok: false, reason: "invalid-credits" };
  }
  const expiresAt =
    args.validityMonths === null
      ? null
      : new Date(new Date(args.now).setMonth(args.now.getMonth() + args.validityMonths)).toISOString();

  return {
    ok: true,
    tx: {
      userId: args.userId, delta: args.credits, reason: "purchase",
      bookingId: null,
      // ⚠ NAMESPACED BY EVENT. Two different Stripe events must never collide,
      // and the same event must always collide with itself.
      idempotencyKey: `stripe:${args.eventId}`,
      expiresAt,
    },
  };
}

/**
 * Give a credit back when the TEACHER cancels (§39, §74.55).
 *
 * ⚠ ONLY FOR A LESSON THAT ACTUALLY CONSUMED ONE, AND ONLY ONCE. Restoring a
 * credit for a booking paid in cash would mint one from nothing; restoring
 * twice would mint one from a rounding of good intentions. Both are refused
 * here and again by 0047's index, which allows a POSITIVE row for a booking
 * that already has a negative one — that asymmetry is exactly the refund.
 */
export function planRestore(
  txs: readonly CreditTx[],
  userId: string,
  bookingId: string,
): SpendPlan | { ok: false; reason: "nothing-was-spent" | "already-restored" } {
  const spent = txs.some((t) => t.bookingId === bookingId && t.delta < 0);
  if (!spent) return { ok: false, reason: "nothing-was-spent" };
  const restored = txs.some((t) => t.bookingId === bookingId && t.delta > 0);
  if (restored) return { ok: false, reason: "already-restored" };

  return {
    ok: true,
    tx: {
      userId, delta: 1, reason: "cancellation_refund",
      bookingId, idempotencyKey: `restore:${bookingId}`, expiresAt: null,
    },
  };
}

/**
 * Has this Stripe event already been handled? (§63)
 *
 * The authoritative answer is the unique index on payment_events; this is the
 * cheap pre-check so the common retry costs one SELECT rather than an
 * exception.
 */
export function alreadyProcessed(seenEventIds: readonly string[], eventId: string): boolean {
  return seenEventIds.includes(eventId);
}
