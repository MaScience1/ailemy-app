/**
 * What a student may cancel, and what happens to the money (§38–§42).
 *
 * ============================================================================
 * ⚠ WHO PAID, AND HOW, DECIDES EVERYTHING
 * ============================================================================
 * A credit-paid lesson cancelled in good time is arithmetic: give the credit
 * back and free the slot. Nobody has to decide anything, so nobody should have
 * to — §40 makes that path self-service.
 *
 * A CASH-paid lesson is a refund, and a refund is a decision about money that
 * has already left a card. A student cannot make that decision, and neither can
 * this file: it routes to a cancellation_requests row (0052) where a human
 * answers it.
 *
 * A lesson inside the cutoff is the same shape — a request, not an action —
 * whatever it was paid with. The teacher has already reserved the time.
 *
 * ⚠ AND A GROUP LESSON IS NOT CANCELLABLE AT ALL. A student cannot cancel one
 * seat in a class of twenty; that is a withdrawal, and it is a conversation.
 * The caller never passes one here, and this file has no branch for one.
 */

/**
 * ⚠ 24 HOURS COMES FROM §39 OF THE BUILD SPEC, AND WAS RATIFIED 2026-08-20.
 *
 * Recorded because I first documented it as an invented placeholder, which was
 * wrong and is the kind of wrong that gets a number changed casually. §39 sets
 * self-cancellation at 24 hours or more; this constant IS that rule, not a
 * guess standing in for it.
 *
 * It lives here alone and exported so a policy change is one line and no second
 * copy can drift. It is deliberately NOT read from
 * teacher_availability.booking_cutoff_hours: that column is how late you may
 * BOOK, a different question with a different right answer — booking 3 hours
 * ahead can be fine while cancelling 3 hours ahead is not.
 */
export const CANCELLATION_CUTOFF_HOURS = 24;

export type CancellableBooking = {
  id: string;
  userId: string | null;
  startsAt: Date;
  status: string;
  /** 'single' = cash. 'credit' = redeemed a credit. 0046's paid_with. */
  paidWith: string;
};

export type CancelOutcome =
  /** Self-service: cancel it now and put the credit back. */
  | { ok: true; action: "cancel-and-restore"; hoursNotice: number }
  /** Needs a human: opens a cancellation_requests row instead. */
  | { ok: false; action: "request"; reason: "cash-paid" | "inside-cutoff"; hoursNotice: number }
  /** Not a thing that can be cancelled at all. */
  | { ok: false; action: "refuse"; reason: "not-yours" | "already-cancelled" | "already-happened" };

/**
 * ⚠ PURE, AND `now` IS AN ARGUMENT. Every rule below is provable with no
 * database and no clock, which is what lets the cutoff be sabotaged in a test
 * rather than reasoned about.
 */
export function planCancellation(args: {
  booking: CancellableBooking;
  viewerId: string;
  now: Date;
  cutoffHours?: number;
}): CancelOutcome {
  const { booking, viewerId, now } = args;
  const cutoff = args.cutoffHours ?? CANCELLATION_CUTOFF_HOURS;

  // ⚠ OWNERSHIP FIRST, AND IT IS NOT A COURTESY. A booking whose user_id is
  // NULL was made by someone with no account — it is nobody's to cancel from a
  // session, and matching on email here would let anyone who knows an address
  // cancel a stranger's lesson.
  if (booking.userId === null || booking.userId !== viewerId) {
    return { ok: false, action: "refuse", reason: "not-yours" };
  }

  if (booking.status !== "confirmed") {
    return { ok: false, action: "refuse", reason: "already-cancelled" };
  }

  const msNotice = booking.startsAt.getTime() - now.getTime();
  // ⚠ ROUNDED DOWN. 23.9 hours of notice is 23, not 24 — rounding up would
  // hand out the self-service path six minutes inside the cutoff.
  const hoursNotice = Math.floor(msNotice / 3_600_000);

  // A lesson that has started is not cancelled, it is missed. Cancelling it
  // would free a slot that was actually consumed and, worse, restore a credit
  // for a lesson the teacher turned up to.
  if (msNotice <= 0) {
    return { ok: false, action: "refuse", reason: "already-happened" };
  }

  if (hoursNotice < cutoff) {
    return { ok: false, action: "request", reason: "inside-cutoff", hoursNotice };
  }

  // ⚠ CASH IS A REFUND AND A REFUND IS A HUMAN DECISION. Checked AFTER the
  // cutoff so the message names the more actionable problem: a student 3 hours
  // out should be told about the cutoff, not sent down a refund path that would
  // have been refused for the notice period anyway.
  if (booking.paidWith !== "credit") {
    return { ok: false, action: "request", reason: "cash-paid", hoursNotice };
  }

  return { ok: true, action: "cancel-and-restore", hoursNotice };
}

/**
 * Can this student redeem a credit for this slot, right now? (§31, §80)
 *
 * ============================================================================
 * ⚠ REDEEMING A CREDIT IS NOT A PAYMENT, AND STRIPE BEING KEYLESS MUST NOT
 * BLOCK IT
 * ============================================================================
 * The standing rule is that no PAYABLE CTA may render while Stripe has no keys.
 * A credit is money that has ALREADY been taken — the card was charged when the
 * package was bought, and the credit is the receipt. Refusing to let a student
 * spend one because today's deployment cannot take a NEW payment strands a
 * customer who has already paid.
 *
 * So the keyless gate belongs on Buy, and only on Buy. This function never
 * consults Stripe configuration, and that omission is the point.
 */
export type RedeemRefusal =
  | { ok: false; reason: "not-signed-in" }
  | { ok: false; reason: "no-credits"; balance: number };

export function canRedeem(args: {
  signedIn: boolean;
  creditBalance: number;
}): { ok: true } | RedeemRefusal {
  if (!args.signedIn) return { ok: false, reason: "not-signed-in" };
  if (args.creditBalance < 1) return { ok: false, reason: "no-credits", balance: args.creditBalance };
  return { ok: true };
}

/** What to say to a student, given a refusal. Never a code, never a constraint. */
export function explainCancellation(o: CancelOutcome, cutoffHours = CANCELLATION_CUTOFF_HOURS): string {
  if (o.ok) return "This lesson will be cancelled and your credit put back.";
  switch (o.reason) {
    case "not-yours":
      return "This booking is not on your account.";
    case "already-cancelled":
      return "This lesson is already cancelled.";
    case "already-happened":
      return "This lesson has already started. Contact us if something went wrong.";
    case "inside-cutoff":
      return `This lesson starts in under ${cutoffHours} hours, so it needs a quick word with us rather than a button. We will come back to you.`;
    case "cash-paid":
      return "This lesson was paid for directly, so cancelling it means a refund — we will sort that out with you.";
  }
}
