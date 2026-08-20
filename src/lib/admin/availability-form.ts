// ⚠ RELATIVE, WITH THE .ts EXTENSION — same reason as schedule-form.ts. Node 26
// strips types but resolves ESM specifiers literally, so a suite running this
// under plain `node` cannot follow the "@/" alias.
import { canonicalTimeZone, tzError, zonedTimeToInstant, CANONICAL_TZ } from "../schedule/timezone.ts";
import type { IsoWeekday } from "../schedule/recurrence.ts";
import type { Validated } from "./schedule-form.ts";

/**
 * What a valid 1-to-1 availability edit is (§23, §24, §46).
 *
 * ============================================================================
 * ⚠ THESE MIRROR 0045's CONSTRAINTS — WITH ONE THAT 0045 PROMISES AND DOES NOT
 * ENFORCE
 * ============================================================================
 * 0045 names a constraint `teacher_availability_slot_fits` and comments it
 * "A SLOT MUST FIT INSIDE ITS WINDOW. slot_minutes longer than the window
 * yields zero slots and reads as 'the teacher published nothing'."
 *
 * The CHECK it actually carries is `slot_minutes > 0 AND slot_minutes <= 480`.
 * That is a sanity bound on the NUMBER, not a comparison with the window. A
 * 120-minute slot inside a 16:00–17:00 window satisfies the database and
 * generates zero bookable slots — the exact outcome the comment says it
 * prevents.
 *
 * So `slotFitsWindow` below is, for now, the ONLY thing enforcing it. That is
 * the wrong place for it to live alone: the app is a courtesy and the database
 * is the enforcement, and here the courtesy is all there is. The schema is
 * closed through 0049, so this is recorded rather than fixed — when it reopens
 * the CHECK should become a comparison against (end_time - start_time).
 *
 * ⚠ AND THE BUFFER COUNTS. A 60-minute slot with a 15-minute buffer needs 60
 * minutes of window for the first slot, not 75 — the buffer sits between slots,
 * not after the last one. Requiring 75 would refuse a legitimate single-slot
 * hour, which is the most common thing a teacher will publish.
 */

const str = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const orNull = (fd: FormData, k: string): string | null => str(fd, k) || null;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minutes since midnight, for a validated HH:MM. */
function minutesOf(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

/**
 * ⚠ EXPORTED SO THE TEST CAN AIM AT IT DIRECTLY, and so the reader can use the
 * same arithmetic when it decides how many slots a window yields. Two
 * implementations of "does this fit" is how a form accepts a window the reader
 * then renders as empty.
 */
export function slotFitsWindow(
  startTime: string, endTime: string, slotMinutes: number,
): boolean {
  return minutesOf(endTime) - minutesOf(startTime) >= slotMinutes;
}

function intField(
  fd: FormData, key: string, label: string, lo: number, hi: number, fallback: number,
): Validated<number> {
  const raw = str(fd, key);
  if (!raw) return { ok: true, value: fallback };
  const n = Number(raw);
  if (!Number.isInteger(n)) return { ok: false, error: `${label} must be a whole number.` };
  if (n < lo || n > hi) return { ok: false, error: `${label} must be between ${lo} and ${hi}.` };
  return { ok: true, value: n };
}

export type AvailabilityInput = {
  teacherId: string;
  subject: string | null;
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

export function readAvailabilityForm(fd: FormData): Validated<AvailabilityInput> {
  const teacherId = str(fd, "teacher_id");
  // ⚠ SHAPE-CHECKED, NOT JUST PRESENT. A non-uuid reaches Postgres as 22P02
  // "invalid input syntax for type uuid", which tells an admin nothing about
  // which of six fields was wrong.
  if (!UUID_RE.test(teacherId)) return { ok: false, error: "Choose a teacher." };

  const startTime = str(fd, "start_time").slice(0, 5);
  const endTime = str(fd, "end_time").slice(0, 5);
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return { ok: false, error: "Times must be in 24-hour HH:MM form." };
  }
  if (endTime <= startTime) return { ok: false, error: "The window must end after it starts." };

  /**
   * ⚠ RECURRING XOR ONE-OFF, MIRRORING teacher_availability_recurring_xor_dated.
   * Both set is ambiguous — does the weekday repeat, or is it one date that
   * happens to fall on it? Neither set generates nothing and looks like a UI
   * bug rather than an invalid row.
   */
  const weekdayRaw = str(fd, "weekday");
  const specificDate = orNull(fd, "specific_date");
  const hasWeekday = weekdayRaw !== "";
  if (hasWeekday === (specificDate !== null)) {
    return {
      ok: false,
      error: hasWeekday
        ? "Choose either a repeating weekday or a single date — not both."
        : "Choose a repeating weekday, or give a single date.",
    };
  }

  let weekday: IsoWeekday | null = null;
  if (hasWeekday) {
    const n = Number(weekdayRaw);
    // ISO, Monday = 1 … Sunday = 7 — the same convention as cohort_schedules.
    // A 0 is the JS getDay() convention leaking in, and would store a Sunday
    // window the reader never matches.
    if (!Number.isInteger(n) || n < 1 || n > 7) {
      return { ok: false, error: "Weekday must be Monday–Sunday." };
    }
    weekday = n as IsoWeekday;
  }
  if (specificDate !== null && !DATE_RE.test(specificDate)) {
    return { ok: false, error: "That date is not a date." };
  }

  const timezoneRaw = str(fd, "timezone") || CANONICAL_TZ;
  const timezone = canonicalTimeZone(timezoneRaw);
  if (!timezone) return { ok: false, error: tzError(timezoneRaw) };

  const slot = intField(fd, "slot_minutes", "Slot length", 1, 480, 60);
  if (!slot.ok) return slot;
  const buffer = intField(fd, "buffer_minutes", "Buffer", 0, 240, 15);
  if (!buffer.ok) return buffer;
  const horizon = intField(fd, "booking_horizon_days", "Booking horizon", 1, 365, 42);
  if (!horizon.ok) return horizon;
  const cutoff = intField(fd, "booking_cutoff_hours", "Booking cutoff", 0, 720, 12);
  if (!cutoff.ok) return cutoff;

  // ⚠ THE CHECK 0045 NAMES BUT DOES NOT MAKE. See the header.
  if (!slotFitsWindow(startTime, endTime, slot.value)) {
    const window = minutesOf(endTime) - minutesOf(startTime);
    return {
      ok: false,
      error: `A ${slot.value}-minute slot does not fit in a ${window}-minute window — this would publish nothing.`,
    };
  }

  const validFrom = orNull(fd, "valid_from");
  const validUntil = orNull(fd, "valid_until");
  for (const [v, name] of [[validFrom, "start"], [validUntil, "end"]] as const) {
    if (v !== null && !DATE_RE.test(v)) return { ok: false, error: `The ${name} date is not a date.` };
  }
  if (validFrom !== null && validUntil !== null && validUntil < validFrom) {
    return { ok: false, error: "The window cannot end before it starts." };
  }

  return {
    ok: true,
    value: {
      teacherId, subject: orNull(fd, "subject"), weekday, specificDate,
      startTime, endTime, timezone,
      slotMinutes: slot.value, bufferMinutes: buffer.value,
      validFrom, validUntil,
      bookingHorizonDays: horizon.value, bookingCutoffHours: cutoff.value,
      isActive: fd.get("is_active") !== null,
    },
  };
}

export type BlockInput = {
  teacherId: string;
  startsAtISO: string;
  endsAtISO: string;
  reason: string | null;
};

/**
 * A time a teacher is NOT available.
 *
 * ⚠ THE ADMIN TYPES A WALL CLOCK; WHICH INSTANT THAT IS DEPENDS ON THE ZONE.
 * availability_blocks stores timestamptz, so resolving "9 Dec, 14:00" through
 * the named zone is the whole job. Reading it as the server's local time would
 * silently shift every block by the offset between Doha and wherever this is
 * deployed — three hours, every time, in the direction nobody checks.
 *
 * ⚠ AND `reason` IS OPTIONAL ON PURPOSE. 0045 grants anon SELECT on
 * (id, teacher_id, starts_at, ends_at) and deliberately NOT on reason, so
 * "hospital appointment" never reaches a visitor. Requiring it would push an
 * admin to type something into a column they may not want filled.
 */
export function readBlockForm(fd: FormData): Validated<BlockInput> {
  const teacherId = str(fd, "teacher_id");
  if (!UUID_RE.test(teacherId)) return { ok: false, error: "Choose a teacher." };

  const startsOn = str(fd, "starts_on");
  const endsOn = str(fd, "ends_on") || startsOn;
  const startTime = str(fd, "start_time").slice(0, 5) || "00:00";
  const endTime = str(fd, "end_time").slice(0, 5) || "23:59";

  if (!DATE_RE.test(startsOn) || !DATE_RE.test(endsOn)) {
    return { ok: false, error: "Give the date this block covers." };
  }
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return { ok: false, error: "Times must be in 24-hour HH:MM form." };
  }

  const timezoneRaw = str(fd, "timezone") || CANONICAL_TZ;
  const timezone = canonicalTimeZone(timezoneRaw);
  if (!timezone) return { ok: false, error: tzError(timezoneRaw) };

  const startsAt = zonedTimeToInstant(startsOn, startTime, timezone);
  const endsAt = zonedTimeToInstant(endsOn, endTime, timezone);
  if (!startsAt || !endsAt) return { ok: false, error: "That is not a real date and time." };

  // Mirrors availability_blocks_ordered. A zero-length block blocks nothing and
  // looks like it worked.
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "The block must end after it starts." };
  }

  return {
    ok: true,
    value: {
      teacherId,
      startsAtISO: startsAt.toISOString(),
      endsAtISO: endsAt.toISOString(),
      reason: orNull(fd, "reason"),
    },
  };
}
