import type { CalendarEvent } from "@/lib/calendar/types";

/**
 * The one answer to "when is the next 1-to-1?" (§24).
 *
 * ============================================================================
 * ⚠ FIVE SURFACES WERE EACH DERIVING THIS THEIR OWN WAY
 * ============================================================================
 * The homepage, /calendar, /tuition, the calendar shortcuts and the hero card
 * all called `nextOf(events, "private_open", now)` — over five DIFFERENT event
 * sets. Two used the visible window, two used a 120-day forward read, one used
 * a ternary between them. They agree today only because teacher_availability
 * has no rows; the morning a slot is published they will disagree about which
 * one is "next", and each will be defensibly wrong.
 *
 * §24 names this failure and the codebase has paid for it twice already: the
 * slug→window map that told two programmes their dates were unpublished, and
 * the shortcut that rendered nothing all through August. One rule, here.
 *
 * ⚠ IT IS A PURE FUNCTION OVER EVENTS, NOT A QUERY. Every caller already loads
 * the events it needs for something else; making this fetch its own would add
 * a round trip per surface to answer a question the page can already answer.
 * What must not be duplicated is the RULE — what counts as available, what
 * counts as eligible, what counts as next — and that lives only in this file.
 *
 * ⚠ SERVER TIME, ALWAYS (§66). `now` is a parameter so a caller cannot
 * accidentally pass a browser clock, and every caller is a server component.
 * A student whose device clock is slow must not be shown a slot that has
 * already started.
 */

/** What a viewer is entitled to book. Absent means "show everything public". */
export type Eligibility = {
  /** Course level the student's package covers — "AS", "A2", "GCSE"… */
  level?: string | null;
  /** Subject slug their package covers. */
  subject?: string | null;
};

/**
 * ⚠ ELIGIBILITY FILTERS ONLY WHEN IT IS KNOWN (§21).
 * A logged-out visitor has no entitlement, so they see every published slot —
 * that is the shop window. A student holding a GCSE package is shown only what
 * their credits can actually buy, because a gold slot they cannot book is a
 * dead CTA wearing a price tag.
 *
 * ⚠ AND THIS IS A DISPLAY FILTER, NEVER A PERMISSION. §84 requires the server
 * to reject an ineligible booking on its own; hiding a slot is a courtesy to
 * the reader, not a control. The booking action must check again.
 */
function eligible(ev: CalendarEvent, e: Eligibility | null): boolean {
  if (!e) return true;
  if (e.subject && ev.subject && ev.subject !== e.subject) return false;
  return true;
}

/**
 * Every bookable 1-to-1 slot from `now`, soonest first.
 *
 * ⚠ "BOOKABLE" IS THE READER'S OWN JUDGEMENT, NOT A SECOND OPINION. The
 * calendar reader already computes `bookable` as an AND of Stripe keys, a real
 * price and an open slot; a slot that is merely `private_open` may still be
 * unpayable. This filters on the same field rather than forming its own view.
 *
 * ⚠ A BOOKED SLOT IS SIMPLY ABSENT (§55, §71). loadOpenSlots subtracts
 * confirmed bookings and live holds before these events are built, so another
 * student's booking reaches this function as nothing at all — never as a slot
 * marked taken, which would leak that somebody took it.
 */
export function nextAvailableSlots(
  events: readonly CalendarEvent[],
  opts: { now: Date; eligibility?: Eligibility | null; limit?: number },
): CalendarEvent[] {
  const { now, eligibility = null, limit } = opts;
  const out = events
    .filter((e) => e.type === "private_open")
    .filter((e) => e.status === "scheduled")
    // §66 — a slot that has already started is not available.
    .filter((e) => e.startsAt.getTime() > now.getTime())
    .filter((e) => eligible(e, eligibility))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return typeof limit === "number" ? out.slice(0, limit) : out;
}

/**
 * The single next one, or null.
 *
 * ⚠ null IS THE ANSWER TODAY AND MUST RENDER AS ONE (§79). There are no rows
 * in teacher_availability, so every surface calling this gets null and has to
 * say so. The guard fails on a hardcoded date or clock time in any of them —
 * a sabotage run walked past that check this morning because it scanned the
 * calendar directory rather than the feature.
 */
export function nextAvailableSlot(
  events: readonly CalendarEvent[],
  opts: { now: Date; eligibility?: Eligibility | null },
): CalendarEvent | null {
  return nextAvailableSlots(events, { ...opts, limit: 1 })[0] ?? null;
}

/**
 * The next group lesson, by the same rule (§58).
 *
 * ⚠ GROUP IS A DIFFERENT ENTITLEMENT AND THE FUNCTIONS STAY SEPARATE (§46,
 * §91). A group session is attended by enrolment, not booked with a credit;
 * folding both into one "next session" helper is how the two models start
 * leaking into each other. Same file so the sort rule is shared, different
 * function so the products cannot be confused.
 */
export function nextGroupSession(
  events: readonly CalendarEvent[],
  opts: { now: Date },
): CalendarEvent | null {
  return events
    .filter((e) => e.type === "group" && e.status === "scheduled")
    .filter((e) => e.startsAt.getTime() > opts.now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null;
}
