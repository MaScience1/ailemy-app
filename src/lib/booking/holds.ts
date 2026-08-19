import type { Busy, Slot } from "./slots.ts";

/**
 * Temporary slot reservations during checkout (§28).
 *
 * ⚠ A HOLD IS A PROMISE WITH AN ALARM CLOCK. Two students click the same
 * Monday 17:00 within a second of each other; exactly one may end up owning it,
 * and the other must be told immediately rather than after paying. But a hold
 * that never expires means one abandoned checkout removes that slot forever —
 * §28 forbids both failures, so the hold has a deadline and the deadline is
 * enforced on read, not by a cron job that might not run.
 */

export type Hold = {
  id: string;
  teacherId: string;
  userId: string | null;
  email: string;
  startsAt: Date;
  endsAt: Date;
  expiresAt: Date;
  checkoutRef: string | null;
};

/** How long a student gets to finish paying. */
export const HOLD_MINUTES = 15;

/**
 * ⚠ EXPIRY IS EVALUATED AT READ TIME, ALWAYS.
 *
 * A sweep job that deletes stale holds is a fine optimisation and a terrible
 * guarantee: if it stops running, slots silently disappear from the site and
 * nothing errors. Treating an expired hold as absent the moment it is read
 * means the correct behaviour survives the job never running at all.
 */
export function isLive(hold: Hold, now: Date): boolean {
  return hold.expiresAt.getTime() > now.getTime();
}

export function liveHolds(holds: readonly Hold[], now: Date): Hold[] {
  return holds.filter((h) => isLive(h, now));
}

/** Live holds as obstacles for the slot generator. */
export function holdsAsBusy(holds: readonly Hold[], now: Date): Busy[] {
  return liveHolds(holds, now).map((h) => ({
    startsAt: h.startsAt, endsAt: h.endsAt, kind: "hold" as const,
  }));
}

export type HoldRefusal =
  | { ok: false; reason: "already-held"; until: Date }
  | { ok: false; reason: "slot-gone" };

export type HoldPlan = { ok: true; hold: Omit<Hold, "id"> };

/**
 * Take a slot, if it is still there.
 *
 * ⚠ THIS IS THE ADVISORY HALF. It refuses the common case cheaply and with a
 * useful message. It CANNOT win a true race — two requests can both read "no
 * live hold" microseconds apart — which is why the confirmed booking carries
 * 0046's exclusion constraint. Correctness is the constraint; this is courtesy.
 *
 * ⚠ RE-HOLDING YOUR OWN SLOT IS ALLOWED, and is not a double-hold. A student
 * who refreshes the checkout page must not be locked out by their own hold.
 * Identity is the email, because a parent may not have an account yet.
 */
export function planHold(args: {
  slot: Slot;
  email: string;
  userId: string | null;
  existingHolds: readonly Hold[];
  now: Date;
  minutes?: number;
}): HoldPlan | HoldRefusal {
  const { slot, email, userId, existingHolds, now } = args;

  const clash = liveHolds(existingHolds, now).find(
    (h) =>
      h.teacherId === slot.teacherId &&
      h.startsAt.getTime() < slot.endsAt.getTime() &&
      slot.startsAt.getTime() < h.endsAt.getTime(),
  );

  if (clash && clash.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, reason: "already-held", until: clash.expiresAt };
  }

  const minutes = args.minutes ?? HOLD_MINUTES;
  return {
    ok: true,
    hold: {
      teacherId: slot.teacherId,
      userId,
      email,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      expiresAt: new Date(now.getTime() + minutes * 60_000),
      checkoutRef: null,
    },
  };
}
