/**
 * Turning a flat list of sessions into something a student can read (§24–§30).
 *
 * ============================================================================
 * ⚠ THE VIEW THIS REPLACES LOOKED LIKE A DATABASE, AND IT WAS ONE
 * ============================================================================
 * "Next 60 days" rendered every event as a row of date, time, course, GROUP —
 * sorted, uniform, and offering the reader no way in. That is a query result
 * with a stylesheet. A student asking "what can I go to?" had to scan sixty
 * rows to find the two that were this week.
 *
 * The fix is not a nicer row. It is admitting that the reader's question is
 * about NEARNESS — this week, next week, later — and that "Tue 15 Sep" answers
 * a different question from "Tomorrow". Both are printed, because losing the
 * exact date to a friendly word is the opposite failure (§29).
 *
 * ⚠ EVERYTHING HERE IS PURE AND IMPORT-FREE ON PURPOSE. The suites are plain
 * node programs with no bundler, so a module reaching for `@/lib/...` cannot be
 * loaded by one — and a grouping rule that can only be checked by grepping its
 * own source has been shown to be typed, not to work. See qualifications/
 * derive.ts, which was split out for exactly this reason.
 *
 * ⚠ DATES ARE HANDLED AS UTC CALENDAR DAYS, NOT LOCAL ONES. Every ISO day
 * string in this codebase is produced by the calendar layer in the canonical
 * zone; re-deriving one with getDay()/getMonth() on the server would silently
 * shift by a day for half the world. The functions below take day strings and
 * compare them as strings, or use getUTC* — never the local variants.
 */

export type UpcomingBand = "this_week" | "next_week" | "later";

export const BAND_LABEL: Record<UpcomingBand, string> = {
  this_week: "This week",
  next_week: "Next week",
  // ⚠ NOT "The rest of the 60 days". §25 is explicit that the fetch window is
  // an implementation detail and must not be the product label.
  later: "Later",
};

/** Days from `todayISO` to `dayISO`, as whole calendar days. */
export function daysBetween(todayISO: string, dayISO: string): number {
  const a = Date.parse(`${todayISO}T00:00:00Z`);
  const b = Date.parse(`${dayISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Which band a day falls in.
 *
 * ⚠ "THIS WEEK" MEANS THE NEXT SEVEN DAYS, NOT THE REST OF THE CALENDAR WEEK.
 * A student reading this on a Saturday has one day left in the calendar week;
 * a band that empties itself every Friday afternoon is worse than useless. The
 * question behind the label is "can I go to something soon", and seven days
 * answers it the same way on every weekday.
 */
export function bandFor(todayISO: string, dayISO: string): UpcomingBand {
  const d = daysBetween(todayISO, dayISO);
  if (Number.isNaN(d)) return "later";
  if (d < 7) return "this_week";
  if (d < 14) return "next_week";
  return "later";
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * The two halves of a date label (§29).
 *
 * ⚠ THE EXACT DATE IS NEVER DROPPED. "Tomorrow" alone is ambiguous the moment
 * a page is left open overnight, screenshotted, or read in another timezone,
 * and it is useless to somebody planning a fortnight ahead. So "Tomorrow" is
 * the lead and "Tue 15 Sep" always rides with it.
 */
export function dayLabel(todayISO: string, dayISO: string): { lead: string; exact: string } {
  const d = daysBetween(todayISO, dayISO);
  const t = Date.parse(`${dayISO}T00:00:00Z`);
  const date = new Date(t);
  const exact = `${WEEKDAY[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH[date.getUTCMonth()]}`;
  if (d === 0) return { lead: "Today", exact };
  if (d === 1) return { lead: "Tomorrow", exact };
  return { lead: exact, exact };
}

export type UpcomingDay<E> = {
  dayISO: string;
  lead: string;
  exact: string;
  events: E[];
};

export type UpcomingSection<E> = {
  band: UpcomingBand;
  label: string;
  days: UpcomingDay<E>[];
  /** Every event under this band — for a count in the heading. */
  count: number;
};

/**
 * Group events into bands, then days, preserving order within a day.
 *
 * ⚠ AN EMPTY BAND IS NOT RENDERED. A "Next week" heading over nothing tells a
 * student there is nothing next week, which is true but reads as a loading
 * failure sitting between two populated sections. The caller gets only the
 * bands that have something in them, and §49/§50's empty states handle the
 * case where that is none of them.
 */
export function groupUpcoming<E extends { startsAt: Date }>(
  events: readonly E[],
  todayISO: string,
  dayOf: (e: E) => string,
): UpcomingSection<E>[] {
  const bands: UpcomingBand[] = ["this_week", "next_week", "later"];
  const byBand = new Map<UpcomingBand, Map<string, E[]>>();
  for (const b of bands) byBand.set(b, new Map());

  for (const e of events) {
    const dayISO = dayOf(e);
    const band = bandFor(todayISO, dayISO);
    const days = byBand.get(band)!;
    const list = days.get(dayISO) ?? [];
    list.push(e);
    days.set(dayISO, list);
  }

  const out: UpcomingSection<E>[] = [];
  for (const band of bands) {
    const days = byBand.get(band)!;
    if (days.size === 0) continue;
    const dayList: UpcomingDay<E>[] = [...days.keys()].sort().map((dayISO) => ({
      dayISO,
      ...dayLabel(todayISO, dayISO),
      events: days.get(dayISO)!,
    }));
    out.push({
      band,
      label: BAND_LABEL[band],
      days: dayList,
      count: dayList.reduce((n, d) => n + d.events.length, 0),
    });
  }
  return out;
}

/**
 * The two shortcuts at the top of the calendar (§12, §13).
 *
 * ⚠ THEY RETURN null RATHER THAN A PLACEHOLDER, AND §66 IS WHY. There is no
 * stored 1-to-1 availability today, so "Next available 1-to-1" has no answer.
 * The honest render of no answer is nothing — not "Coming soon" dressed as a
 * slot, not a greyed example time, and above all not a fabricated Tuesday.
 * The caller is required to handle null; the guard in calendar-booking.test.ts
 * fails if a literal time ever appears in the component.
 */
export function nextOf<E extends { type: string; startsAt: Date }>(
  events: readonly E[],
  type: string,
  now: Date,
): E | null {
  let best: E | null = null;
  for (const e of events) {
    if (e.type !== type) continue;
    if (e.startsAt.getTime() < now.getTime()) continue;
    if (!best || e.startsAt.getTime() < best.startsAt.getTime()) best = e;
  }
  return best;
}

/**
 * What a student can actually do with one event (§3 of the header, §57).
 *
 * ============================================================================
 * ⚠ §57 ASKS FOR "Reserve your place →" AND "Book this slot →". BOTH ARE
 * CONDITIONAL, AND THE CONDITION IS THE DATA.
 * ============================================================================
 * A group lesson can be reserved only if its cohort is enrolling AND has
 * somewhere to enrol — the same AND `groupOffer` applies on the homepage, for
 * the same reason: a cohort marked enrolling with no payment link cannot be
 * joined, and a button saying otherwise leads nowhere. A 1-to-1 slot can be
 * booked only if the reader already computed `bookable`, which folds in Stripe
 * keys, a real price and an open time.
 *
 * Everything else gets a truthful verb — "View lesson", "See details" — rather
 * than a booking verb the product cannot honour. When checkout ships, these
 * labels change on their own.
 *
 * ⚠ THE VIEWER'S OWN BOOKING IS NOT AN OFFER. It is a fact about their
 * timetable, so it says so rather than inviting them to book what they hold.
 */
export type EventAction = { label: string; bookable: boolean };

export function actionFor(ev: {
  type: string;
  status?: string;
  bookable?: boolean;
  cohort?: { status?: string; enrolmentUrl?: string | null } | null;
}): EventAction {
  if (ev.status === "cancelled") return { label: "Cancelled", bookable: false };
  if (ev.type === "private_booked") return { label: "Your booking", bookable: false };
  if (ev.type === "private_open") {
    return ev.bookable
      ? { label: "Book this slot", bookable: true }
      : { label: "See details", bookable: false };
  }
  const c = ev.cohort;
  const canEnrol = c?.status === "enrolling" && !!c.enrolmentUrl;
  return canEnrol
    ? { label: "Reserve your place", bookable: true }
    : { label: "View lesson", bookable: false };
}
