import { zonedTimeToInstant, CANONICAL_TZ } from "../schedule/timezone.ts";
import { isoWeekdayOf, type IsoWeekday } from "../schedule/recurrence.ts";

/**
 * Which 1-to-1 slots are genuinely bookable (§22, §25, §28).
 *
 * ============================================================================
 * ⚠ A SLOT IS OFFERED ONLY IF EVERY REASON TO WITHHOLD IT IS ABSENT
 * ============================================================================
 * Availability is where the teacher SAID they could work. A slot survives only
 * after subtracting, in order: blocked periods, group lessons, confirmed
 * bookings, live holds, the buffer around each of those, the booking horizon
 * and the cutoff. §25 is explicit that this must be enforced server-side and
 * that the UI is not to be trusted — so all of it lives here, pure, and the
 * server calls it before ever showing a price.
 *
 * ⚠ THE BUFFER APPLIES TO THE OBSTACLE, NOT TO THE SLOT. A 15-minute buffer
 * around a group lesson means the lesson occupies its own time PLUS fifteen
 * minutes either side; a candidate slot that touches that expanded range is
 * dropped. Expanding the slot instead would let two adjacent bookings sit
 * back-to-back with no gap, which is the thing the buffer exists to prevent.
 *
 * ⚠ AND IT INVENTS NOTHING. No availability rows means no slots — not a
 * default working week. §7 of the standing rails: no fake slots.
 */

export type AvailabilityRule = {
  id: string;
  teacherId: string;
  subject: string | null;
  /** Recurring; mutually exclusive with specificDate. */
  weekday: IsoWeekday | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  timezone: string;
  slotMinutes: number;
  bufferMinutes: number;
  validFrom: string | null;
  validUntil: string | null;
  bookingHorizonDays: number;
  bookingCutoffHours: number;
  isActive: boolean;
};

/** Anything that makes a time unusable: a block, a group lesson, a booking, a hold. */
export type Busy = { startsAt: Date; endsAt: Date; kind: "block" | "group" | "booking" | "hold" };

export type Slot = {
  teacherId: string;
  subject: string | null;
  startsAt: Date;
  endsAt: Date;
  minutes: number;
  /** Stable identity for a form field and for re-checking on submit. */
  key: string;
};

const MIN = 60_000;
const DAY = 86_400_000;

const overlaps = (aS: number, aE: number, bS: number, bE: number): boolean => aS < bE && bS < aE;

/**
 * Candidate slots from ONE rule on ONE date, before any subtraction.
 *
 * ⚠ SLOTS ADVANCE BY slot + buffer, NOT BY slot. A 16:00–19:00 window with
 * 60-minute slots and a 15-minute buffer yields 16:00, 17:15, 18:00-does-not-fit
 * — three would only fit with no buffer at all. Advancing by the slot alone
 * would publish adjacent lessons with no gap to breathe.
 */
export function slotsForDate(rule: AvailabilityRule, dateISO: string): Slot[] {
  if (!rule.isActive) return [];
  if (rule.validFrom && dateISO < rule.validFrom) return [];
  if (rule.validUntil && dateISO > rule.validUntil) return [];

  if (rule.specificDate !== null) {
    if (rule.specificDate !== dateISO) return [];
  } else if (rule.weekday !== null) {
    if (isoWeekdayOf(dateISO) !== rule.weekday) return [];
  } else {
    // Neither — 0045's CHECK forbids it, and a row that slipped through
    // generates nothing rather than everything.
    return [];
  }

  const windowStart = zonedTimeToInstant(dateISO, rule.startTime, rule.timezone);
  const windowEnd = zonedTimeToInstant(dateISO, rule.endTime, rule.timezone);
  if (!windowStart || !windowEnd || windowEnd <= windowStart) return [];
  if (rule.slotMinutes <= 0) return [];

  const out: Slot[] = [];
  const step = (rule.slotMinutes + rule.bufferMinutes) * MIN;
  const length = rule.slotMinutes * MIN;

  for (let t = windowStart.getTime(); t + length <= windowEnd.getTime(); t += step) {
    const startsAt = new Date(t);
    const endsAt = new Date(t + length);
    out.push({
      teacherId: rule.teacherId,
      subject: rule.subject,
      startsAt, endsAt,
      minutes: rule.slotMinutes,
      key: `${rule.teacherId}::${startsAt.toISOString()}::${rule.slotMinutes}`,
    });
  }
  return out;
}

export type OpenSlotsInput = {
  rules: readonly AvailabilityRule[];
  busy: readonly Busy[];
  /** Inclusive window. */
  from: string;
  to: string;
  now: Date;
  subject?: string;
};

/**
 * Every slot a student may actually book.
 *
 * ⚠ THE ORDER OF SUBTRACTION DOES NOT MATTER, BUT COMPLETENESS DOES. A slot
 * that survives this is one the server is willing to take money for, so a
 * missing category here is a double-booking. The caller supplies `busy` from
 * ALL sources — blocks, the group schedule, confirmed bookings and live holds —
 * and this function is deliberately ignorant of where each came from.
 */
export function openSlots(input: OpenSlotsInput): Slot[] {
  const { rules, busy, from, to, now } = input;
  const out: Slot[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (input.subject && rule.subject !== null && rule.subject !== input.subject) continue;

    // ⚠ THE HORIZON AND CUTOFF ARE PER RULE, because §24 makes them per
    // availability window. Clamp the walk to the narrower of the two.
    const horizonEnd = new Date(now.getTime() + rule.bookingHorizonDays * DAY)
      .toISOString().slice(0, 10);
    const walkTo = horizonEnd < to ? horizonEnd : to;
    const cutoff = now.getTime() + rule.bookingCutoffHours * 3_600_000;

    for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= walkTo; d = new Date(d.getTime() + DAY)) {
      const dateISO = d.toISOString().slice(0, 10);
      for (const slot of slotsForDate(rule, dateISO)) {
        // ⚠ TOO SOON IS NOT BOOKABLE. A lesson starting in ten minutes cannot
        // be prepared for, and §24 gives the operator the dial.
        if (slot.startsAt.getTime() < cutoff) continue;

        const blocked = busy.some((b) =>
          overlaps(
            slot.startsAt.getTime(), slot.endsAt.getTime(),
            // The buffer expands the OBSTACLE.
            b.startsAt.getTime() - rule.bufferMinutes * MIN,
            b.endsAt.getTime() + rule.bufferMinutes * MIN,
          ),
        );
        if (blocked) continue;

        // Two rules can legitimately produce the same slot; offer it once.
        if (seen.has(slot.key)) continue;
        seen.add(slot.key);
        out.push(slot);
      }
    }
  }

  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Re-check a single slot at submit time (§25).
 *
 * ⚠ THE LIST THE BROWSER WAS SHOWN IS ALREADY STALE. Between rendering and
 * clicking, someone else may have booked it, the teacher may have blocked it,
 * or a group lesson may have moved onto it. Every write path calls this again
 * with fresh `busy` before taking money.
 */
export function isStillOpen(slot: Slot, rules: readonly AvailabilityRule[], busy: readonly Busy[], now: Date): boolean {
  const dateISO = slot.startsAt.toISOString().slice(0, 10);
  return openSlots({
    rules, busy,
    from: dateISO, to: dateISO,
    now,
  }).some((s) => s.key === slot.key);
}
