/**
 * What to say when the visible window is empty (§40, §41, §63).
 *
 * ============================================================================
 * ⚠ "NOTHING IN THIS PERIOD" IS TRUE, USELESS, AND ARGUES AGAINST THE PRODUCT
 * ============================================================================
 * Teaching begins 15 September. For the whole of the summer the homepage
 * calendar opens on an empty August grid — and §63 is explicit that a visitor
 * meeting a blank month has been told the wrong thing. A blank calendar should
 * never feel broken; it should say when the next real lesson is and offer to go
 * there.
 *
 * ⚠ SO THIS ANSWERS FROM SESSIONS, NOT FROM A COHORT'S start DATE. The existing
 * emptyCalendarMessage reads cohorts[].firstClassOn, guarded on
 * scheduleSummary being non-empty — because Y11 and Y10 carry PLACEHOLDER
 * academic-year dates (2026-09-01) with no published timetable, and rendering
 * one of those would promise a lesson nobody scheduled.
 *
 * That guard is right and it is also indirect: it infers a lesson from a
 * cohort. Once the timetable is seeded — and the AS timetable is — the honest
 * answer is the next actual SESSION, with its real date, its real time and its
 * real subject. This prefers that, and falls back to the cohort sentence only
 * when no session exists at all.
 *
 * Pure: takes events and a clock, returns a shape. No database, no formatting
 * decisions — the caller renders, so the mobile app can render it differently.
 */

import type { CalendarEvent } from "./types";

export type NextSession =
  | { kind: "none"; reason: string }
  | {
      kind: "session";
      event: CalendarEvent;
      /** ISO date of the day it falls on, for a "jump to" link (§41). */
      dateISO: string;
      /** Whole days from today. 0 = today. Lets a caller say "in 3 weeks". */
      daysAway: number;
    };

/**
 * The soonest scheduled session at or after `now`.
 *
 * ⚠ CANCELLED SESSIONS ARE EXCLUDED, AND THAT IS NOT OBVIOUS. A cancelled
 * lesson is deliberately still IN the calendar — §48's rule, so a student who
 * remembers a Tuesday lesson sees it struck through rather than absent. But it
 * is not "the next lesson", and offering to jump to it would send somebody to a
 * day whose only content is a cancellation.
 *
 * ⚠ AND A 1-TO-1 SLOT IS NOT A LESSON EITHER. An open slot is an offer, not an
 * event — "next live lesson: 1-to-1 available" is a category error, and it
 * would displace the real teaching date §63 asks to surface. Group only.
 */
export function nextSession(
  events: readonly CalendarEvent[],
  now: Date,
  dayKeyOf: (d: Date) => string,
  todayISO: string,
): NextSession {
  const soonest = events
    .filter((e) => e.type === "group" && e.status === "scheduled")
    .filter((e) => e.endsAt.getTime() > now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];

  if (!soonest) {
    return {
      kind: "none",
      /**
       * ⚠ SAYS WHAT IS ABSENT, NOT THAT THE STUDENT IS. The window may simply
       * be before term, or the timetable may not be seeded — either way this is
       * a statement about the schedule.
       */
      reason: "No group lessons are scheduled yet.",
    };
  }

  const dateISO = dayKeyOf(soonest.startsAt);
  return { kind: "session", event: soonest, dateISO, daysAway: daysBetween(todayISO, dateISO) };
}

/**
 * ⚠ COUNTED IN CALENDAR DAYS, NOT IN 24-HOUR BLOCKS. A lesson at 19:00 tomorrow
 * is "tomorrow" whether it is now 08:00 or 23:00; dividing a millisecond
 * difference by 86,400,000 makes it "today" in one case and "tomorrow" in the
 * other. Both dates are already canonical-zone day keys, so this is pure
 * arithmetic on calendar days and carries no timezone of its own.
 */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * "in 3 weeks", "tomorrow", "today" — the human distance.
 *
 * ⚠ NO "in 24 days". Past a fortnight a day count stops being legible and
 * starts being arithmetic homework; weeks are how anyone actually thinks about
 * a date a month out. Under a week it stays in days, because "in 5 days" is
 * both precise and readable.
 */
export function distanceLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks === 1) return "next week";
  if (days < 60) return `in ${weeks} weeks`;
  return "later this term";
}
