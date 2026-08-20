import "server-only";

import { loadCalendar } from "@/lib/schedule/readers";
import { loadOpenSlots } from "@/lib/booking/readers";
import { stripeConfig } from "@/lib/booking/config";
import { CANONICAL_TZ } from "@/lib/schedule/timezone";

import { matchesFilters, type CalendarEvent, type CalendarQuery } from "./types.ts";

/**
 * The one reader every calendar surface calls (§2).
 *
 * ============================================================================
 * ⚠ IT COMPOSES THE EXISTING READERS RATHER THAN REPLACING THEM
 * ============================================================================
 * loadCalendar() already serves seven callers and is the schedule source of
 * truth; loadOpenSlots() already computes bookable 1-to-1 times against group
 * lessons, blocks, bookings and holds. This adds no third source — it
 * normalises both into ONE event shape so the calendar component never asks
 * where an event came from.
 *
 * That is what makes §2 enforceable: a new surface cannot invent its own event
 * type, because there is only one and only this function produces it.
 *
 * ⚠ PUBLIC MODE NEVER RECEIVES ANOTHER STUDENT'S BOOKING. Not filtered out at
 * the end — never fetched. A taken slot reaches the public calendar as an
 * ABSENCE (loadOpenSlots subtracts it), which is §22's "simply not appear"
 * option and the one that cannot leak a name by accident (§72).
 */

const MIN = 60_000;

export type CalendarLoad = {
  events: CalendarEvent[];
  /** True once the database has real schedule rows; false means code fallback. */
  fromDatabase: boolean;
  /** Why we fell back, for a dev banner. Never shown to a visitor. */
  reason?: string;
  /** Rows the mappers refused, travelling with the result rather than logged away. */
  refusals: string[];
  /** False when Stripe is keyless — no slot may render a payable CTA (§80). */
  payable: boolean;
};

export async function loadCalendarEvents(q: CalendarQuery): Promise<CalendarLoad> {
  const wantGroup = q.type !== "private";
  const wantPrivate = q.type !== "group";
  const payable = stripeConfig().configured;

  const events: CalendarEvent[] = [];
  const refusals: string[] = [];
  let fromDatabase = false;
  let reason: string | undefined;

  // ── group lessons ─────────────────────────────────────────────────────────
  if (wantGroup) {
    const cal = await loadCalendar({
      from: q.from, to: q.to,
      subject: q.subject ?? undefined,
      // ⚠ CANCELLED LESSONS ARE INCLUDED, DELIBERATELY (§48). A lesson that
      // silently vanishes reads as a bug and generates an email; "Cancelled —
      // Winter break" answers the question before it is asked. The homepage
      // preview is the one surface that asks for live-only.
      includeCancelled: true,
    });
    fromDatabase = cal.source === "database";
    reason = cal.reason;
    refusals.push(...cal.refusals);

    for (const s of cal.sessions) {
      events.push({
        key: `g:${s.key}`,
        type: "group",
        status: s.status,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        title: s.title ?? s.cohort.title,
        subject: s.cohort.subject,
        // ⚠ STRUCTURED, NOT PARSED OUT OF THE TITLE (§73). qualification is a
        // real column; year_group is NOT one on cohorts yet, so it stays null
        // rather than being guessed from a slug.
        qualification: s.cohort.qualification,
        yearGroup: null,
        cohortSlug: s.cohort.slug,
        teacherName: null,
        cancelledReason: s.cancelledReason,
        cohort: s.cohort,
      });
    }
  }

  // ── bookable 1-to-1 slots ─────────────────────────────────────────────────
  if (wantPrivate) {
    const open = await loadOpenSlots({
      from: q.from, to: q.to,
      now: new Date(),
      subject: q.subject ?? undefined,
    });
    if (open.reason) refusals.push(`slots: ${open.reason}`);

    /**
     * ⚠ A SLOT IS ONLY "BOOKABLE" IF SOMEONE COULD ACTUALLY PAY FOR IT.
     * Three conditions, all required: Stripe has keys, a package exists with a
     * real Stripe price, and the slot is open. Missing any one and the chip
     * renders "Booking opens soon" instead of Book — never a disabled button,
     * which reads as "full" rather than "not open yet" (§64, §98).
     */
    const sellable = open.packages.filter((p) => p.stripePriceId !== null);
    const cheapest = sellable.length > 0
      ? sellable.reduce((a, b) => (a.priceMinor / a.credits <= b.priceMinor / b.credits ? a : b))
      : null;
    const bookable = payable && cheapest !== null;

    for (const slot of open.slots) {
      events.push({
        key: `p:${slot.key}`,
        type: "private_open",
        status: "scheduled",
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        title: slot.subject ? `1-to-1 ${cap(slot.subject)}` : "1-to-1 tuition",
        subject: slot.subject,
        qualification: null,
        yearGroup: null,
        cohortSlug: null,
        teacherName: null,
        cancelledReason: null,
        priceMinor: cheapest ? Math.round(cheapest.priceMinor / cheapest.credits) : null,
        currency: cheapest?.currency ?? null,
        bookable,
      });
    }
  }

  // ⚠ FILTERED ONCE, AT THE END, BY A PURE FUNCTION. Level cannot be pushed
  // into loadCalendar (it has no level parameter) so doing it here keeps ONE
  // filter implementation rather than two that can disagree.
  const filtered = events.filter((e) => matchesFilters(e, q));
  filtered.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.key.localeCompare(b.key));

  return { events: filtered, fromDatabase, reason, refusals, payable };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The next N live events, for a compact preview (§4, §18).
 *
 * ⚠ CANCELLED LESSONS ARE NEVER "NEXT". A preview that shows a cancelled class
 * as the next lesson is worse than showing nothing, and this is the one place
 * the include-cancelled default is deliberately reversed.
 */
export function nextLive(events: readonly CalendarEvent[], now: Date, limit: number): CalendarEvent[] {
  return events
    .filter((e) => e.status === "scheduled" && e.endsAt.getTime() > now.getTime())
    .slice(0, limit);
}

/** Canonical zone, re-exported so surfaces do not re-import the schedule layer. */
export { CANONICAL_TZ };
