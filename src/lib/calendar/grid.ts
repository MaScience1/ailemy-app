import { CANONICAL_TZ, calendarDate } from "../schedule/timezone.ts";

/**
 * Calendar maths: months, weeks, and which day a lesson belongs to.
 *
 * ============================================================================
 * ⚠ A DAY IS A DOHA DAY, EVERYWHERE, FOR EVERYONE
 * ============================================================================
 * The single most consequential decision in this file. A lesson at 19:00
 * Asia/Qatar is 16:00 in London and 08:00 in New York — the same day in all
 * three. But a 01:00 Doha session is the PREVIOUS day in London, and if the
 * grid bucketed by viewer-local day, that lesson would sit on Monday for the
 * teacher and Sunday for the student.
 *
 * The teacher says "Tuesday's lesson". So Tuesday is the canonical Tuesday, and
 * the viewer's own time is shown BESIDE it rather than moving it. dualTime()
 * handles the clock; this file handles the calendar, and the two never disagree
 * about which square a lesson lives in.
 *
 * ⚠ EVERYTHING HERE IS PURE AND TAKES ITS DATES AS STRINGS. No `new Date()`
 * with no argument, no implicit "now", no reliance on the server's zone. That
 * is what lets month boundaries, year boundaries and DST weeks be tested
 * exhaustively without a clock.
 *
 * ⚠ AND NO CALENDAR LIBRARY. §61 asks for justification before adding one. A
 * month grid is six weeks of seven days; the hard part is timezone
 * correctness, which a date library would not solve because the rule above is
 * a product decision, not a formatting one. Intl does the zone work already.
 */

/** ISO weekday: Monday = 1 … Sunday = 7. Matches Postgres isodow and 0044. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAY_SHORT: Record<IsoWeekday, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};

export const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" → UTC-midnight Date, for date-only arithmetic. Null on junk. */
export function parseDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // ⚠ ROUND-TRIP CHECK. Date.UTC happily rolls 2026-02-31 into 3 March, so a
  // typo'd date would silently render the wrong month rather than being refused.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  return d ? toISO(new Date(d.getTime() + n * DAY_MS)) : iso;
}

/**
 * Add months, clamping the day to the target month's length.
 *
 * ⚠ 31 JANUARY + 1 MONTH IS 28 FEBRUARY, NOT 3 MARCH. Date.setMonth overflows,
 * so paging forward from a 31st would skip February entirely — the user presses
 * "next month" once and moves two.
 */
export function addMonths(iso: string, n: number): string {
  const d = parseDate(iso);
  if (!d) return iso;
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const target = new Date(Date.UTC(y, m + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return toISO(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay))));
}

export function isoWeekdayOf(iso: string): IsoWeekday | null {
  const d = parseDate(iso);
  if (!d) return null;
  const js = d.getUTCDay();
  return (js === 0 ? 7 : js) as IsoWeekday;
}

/** Monday of the week containing `iso`. Weeks start Monday, matching ISO. */
export function startOfWeek(iso: string): string {
  const wd = isoWeekdayOf(iso);
  return wd ? addDays(iso, -(wd - 1)) : iso;
}

export function startOfMonth(iso: string): string {
  const d = parseDate(iso);
  return d ? toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))) : iso;
}

export function endOfMonth(iso: string): string {
  const d = parseDate(iso);
  return d ? toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))) : iso;
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export type GridDay = {
  date: string;
  weekday: IsoWeekday;
  /** False for the leading/trailing days borrowed from the neighbouring month. */
  inMonth: boolean;
};

/**
 * A month as whole Monday-start weeks.
 *
 * ⚠ THE ROW COUNT VARIES — 4, 5 OR 6 — AND IS NOT PADDED TO SIX. A fixed
 * six-row grid leaves a whole empty week hanging under February most years,
 * which reads as a rendering fault. February 2026 starts on a Sunday and needs
 * five; a 28-day February starting Monday needs exactly four.
 */
export function monthGrid(anchorISO: string): GridDay[][] {
  const first = startOfMonth(anchorISO);
  const last = endOfMonth(anchorISO);
  if (!parseDate(first) || !parseDate(last)) return [];

  let cursor = startOfWeek(first);
  const weeks: GridDay[][] = [];

  while (cursor <= last) {
    const week: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(cursor, i);
      week.push({
        date,
        weekday: (isoWeekdayOf(date) ?? 1),
        inMonth: sameMonth(date, first),
      });
    }
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** The seven days of the week containing `anchorISO`. */
export function weekGrid(anchorISO: string): GridDay[] {
  const start = startOfWeek(anchorISO);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, weekday: (isoWeekdayOf(date) ?? 1), inMonth: true };
  });
}

/** The inclusive date range a view needs to fetch. §60: never the whole year. */
export function rangeFor(view: CalendarView, anchorISO: string): { from: string; to: string } {
  switch (view) {
    case "month": {
      const weeks = monthGrid(anchorISO);
      if (weeks.length === 0) return { from: anchorISO, to: anchorISO };
      return { from: weeks[0][0].date, to: weeks[weeks.length - 1][6].date };
    }
    case "week": {
      const w = weekGrid(anchorISO);
      return { from: w[0].date, to: w[6].date };
    }
    case "upcoming":
    default:
      // ⚠ BOUNDED. "Upcoming" is a rolling window, not "everything from now on";
      // an unbounded query is the one §60 explicitly forbids.
      return { from: anchorISO, to: addDays(anchorISO, UPCOMING_DAYS) };
  }
}

export const UPCOMING_DAYS = 60;

export type CalendarView = "month" | "week" | "upcoming";
export const VIEWS: CalendarView[] = ["month", "week", "upcoming"];

export function isView(v: unknown): v is CalendarView {
  return typeof v === "string" && (VIEWS as string[]).includes(v);
}

/**
 * Which day an event belongs to.
 *
 * ⚠ ALWAYS THE CANONICAL ZONE — see this file's header. Passing the viewer's
 * zone here is the bug this signature exists to make awkward.
 */
export function dayKeyOf(startsAt: Date): string {
  return calendarDate(startsAt, CANONICAL_TZ);
}

export type Bucketed<T> = Map<string, T[]>;

/** Group events by canonical day, each day's list sorted by start. */
export function bucketByDay<T extends { startsAt: Date }>(events: readonly T[]): Bucketed<T> {
  const out: Bucketed<T> = new Map();
  for (const ev of events) {
    const key = dayKeyOf(ev.startsAt);
    const list = out.get(key);
    if (list) list.push(ev);
    else out.set(key, [ev]);
  }
  for (const list of out.values()) {
    list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }
  return out;
}

export type CellEvents<T> = { shown: T[]; hidden: number };

/**
 * What fits in a month cell, and how many did not.
 *
 * ⚠ "+2 more" IS SHOWN, NEVER SILENT TRUNCATION (§6). A cell that quietly drops
 * the third lesson tells a parent their child has two classes that day. And the
 * overflow badge itself takes a slot, so four events with a limit of three
 * shows two plus "+2" rather than three plus "+1" — otherwise the badge would
 * cover the row it replaced.
 */
export function cellEvents<T>(events: readonly T[], limit: number): CellEvents<T> {
  if (limit <= 0) return { shown: [], hidden: events.length };
  if (events.length <= limit) return { shown: [...events], hidden: 0 };
  const shown = events.slice(0, limit - 1);
  return { shown, hidden: events.length - shown.length };
}

/**
 * The URL's calendar state, validated.
 *
 * ⚠ EVERY FIELD FALLS BACK RATHER THAN THROWING. These are query parameters —
 * a shared link, a typo, a stale bookmark. `?date=banana` must render today's
 * calendar, not a 500.
 */
export type CalendarState = {
  view: CalendarView;
  date: string;
  subject: string | null;
  level: string | null;
  type: "all" | "group" | "private";
  /**
   * §11 — hide anything the student cannot act on: cancelled lessons, full
   * cohorts, and slots that are not open.
   *
   * ⚠ IT IS OFF BY DEFAULT, AND THAT IS DELIBERATE. A calendar that silently
   * hides a cancelled lesson generates the email it was meant to prevent —
   * "Cancelled — Winter break" answers the question before it is asked, which
   * is why includeCancelled is true in the reader. This filter is the student
   * CHOOSING to see only what is actionable, never the page deciding for them.
   */
  availableOnly: boolean;
};

export function readState(
  params: { view?: string; date?: string; subject?: string; level?: string; type?: string; available?: string },
  todayISO: string,
  /**
   * ⚠ THE DEFAULT VIEW IS A PARAMETER, NOT A CONSTANT (§58). A 7-column month
   * grid at 375px gives each day about 46px — legible, but not the view a
   * student wants first on a phone. The caller decides; this stays pure.
   */
  defaultView: CalendarView = "month",
): CalendarState {
  const date = params.date && parseDate(params.date) ? params.date : todayISO;
  const type = params.type === "group" || params.type === "private" ? params.type : "all";
  return {
    view: isView(params.view) ? params.view : defaultView,
    date,
    subject: params.subject?.trim() || null,
    level: params.level?.trim() || null,
    type,
    availableOnly: params.available === "1",
  };
}

/** Serialise state back to a query string, omitting defaults so URLs stay short. */
export function stateToQuery(s: CalendarState, todayISO: string, base = "/calendar"): string {
  const p = new URLSearchParams();
  if (s.view !== "month") p.set("view", s.view);
  if (s.date !== todayISO) p.set("date", s.date);
  if (s.subject) p.set("subject", s.subject);
  if (s.level) p.set("level", s.level);
  if (s.type !== "all") p.set("type", s.type);
  if (s.availableOnly) p.set("available", "1");
  const q = p.toString();
  if (!q) return base;
  /**
   * ⚠ THE BASE MAY ALREADY CARRY A QUERY, AND JOINING WITH "?" TWICE BREAKS IT
   * SILENTLY. The homepage's expanded calendar lives at `/?calendar=open`, so
   * every link inside it has to keep that parameter — `/?calendar=open?view=week`
   * would parse as a single parameter named `calendar` whose value is
   * "open?view=week", the overlay would close on the first click, and nothing
   * would error.
   */
  return `${base}${base.includes("?") ? "&" : "?"}${q}`;
}

/** Where "previous" and "next" go, per view. */
export function step(view: CalendarView, dateISO: string, direction: -1 | 1): string {
  if (view === "month") return addMonths(dateISO, direction);
  if (view === "week") return addDays(dateISO, 7 * direction);
  return addDays(dateISO, UPCOMING_DAYS * direction);
}

/** Human label for the current position: "September 2026", "15–21 Sep 2026". */
export function periodLabel(view: CalendarView, dateISO: string): string {
  const d = parseDate(dateISO);
  if (!d) return "";
  if (view === "month") return `${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (view === "week") {
    const w = weekGrid(dateISO);
    const a = parseDate(w[0].date)!, b = parseDate(w[6].date)!;
    const mA = MONTH_LONG[a.getUTCMonth()].slice(0, 3), mB = MONTH_LONG[b.getUTCMonth()].slice(0, 3);
    // A week that straddles a month or a year names both sides, so "29 Dec –
    // 4 Jan 2027" cannot be mistaken for a week inside one month.
    if (a.getUTCFullYear() !== b.getUTCFullYear()) {
      return `${a.getUTCDate()} ${mA} ${a.getUTCFullYear()} – ${b.getUTCDate()} ${mB} ${b.getUTCFullYear()}`;
    }
    if (a.getUTCMonth() !== b.getUTCMonth()) {
      return `${a.getUTCDate()} ${mA} – ${b.getUTCDate()} ${mB} ${b.getUTCFullYear()}`;
    }
    return `${a.getUTCDate()}–${b.getUTCDate()} ${mA} ${a.getUTCFullYear()}`;
  }
  /**
   * ⚠ §25/§60 — "Next 60 days" NAMED THE QUERY, NOT THE VIEW. It sat as the
   * page's period heading beside the view switcher, which is the most
   * prominent label on the screen — a student reading it learns the size of a
   * fetch window. The window is unchanged at UPCOMING_DAYS; only what the
   * heading calls it has moved from the database's vocabulary to theirs.
   */
  return "Upcoming tuition";
}

// ============================================================================
// HOUR GRID — the week timetable (§8)
// ============================================================================

/**
 * ⚠ THE HOUR RANGE IS DERIVED FROM THE LESSONS, NOT HARDCODED.
 *
 * Ailemy teaches 7:00–9:30 PM Doha today, so a fixed 06:00–22:00 axis would be
 * sixteen rows of empty to show two of content — a timetable that looks like
 * nothing is happening, which is the §63 failure in a different view. And a
 * fixed 18:00–22:00 axis would silently CROP a morning mock the day somebody
 * schedules one.
 *
 * So the window is the events' own span, padded by an hour each side for air,
 * clamped to a sane minimum height so a single lesson does not become one
 * enormous row.
 *
 * ⚠ HOURS ARE IN THE CANONICAL ZONE, ALWAYS. A grid whose rows are the
 * viewer's hours and whose events are placed by Doha hours puts a 7pm lesson in
 * the 4pm row for a student in London. Same rule as dayKeyOf, same reason.
 */
export const DEFAULT_HOUR_FROM = 17;
export const DEFAULT_HOUR_TO = 22;
export const MIN_HOUR_SPAN = 4;

export type HourWindow = { from: number; to: number };

export function hourWindow(
  events: readonly { startsAt: Date; endsAt: Date }[],
  hourOf: (d: Date) => number,
): HourWindow {
  if (events.length === 0) return { from: DEFAULT_HOUR_FROM, to: DEFAULT_HOUR_TO };

  let lo = 23;
  let hi = 0;
  for (const e of events) {
    const s = hourOf(e.startsAt);
    // ⚠ CEIL THE END. A lesson finishing at 21:30 occupies the 21:00 row and
    // must not be cut off at 21:00 — the row it ends inside is still its row.
    const endH = hourOf(e.endsAt);
    const endsExactlyOnTheHour =
      e.endsAt.getTime() % 3_600_000 === 0 && e.endsAt.getMinutes() === 0;
    const eH = endsExactlyOnTheHour ? endH : endH + 1;
    if (s < lo) lo = s;
    if (eH > hi) hi = eH;
  }

  let from = Math.max(0, lo - 1);
  let to = Math.min(24, hi + 1);
  // Keep the grid from collapsing to one or two rows.
  while (to - from < MIN_HOUR_SPAN) {
    if (to < 24) to += 1;
    else if (from > 0) from -= 1;
    else break;
  }
  return { from, to };
}

/** The rows, top to bottom. */
export function hourRows(w: HourWindow): number[] {
  const out: number[] = [];
  for (let h = w.from; h < w.to; h++) out.push(h);
  return out;
}

/**
 * Which hour row an event starts in, and how many rows it spans.
 *
 * ⚠ SPAN IS AT LEAST 1. A 30-minute clinic must still occupy a visible cell;
 * a span of 0 renders as nothing and the session vanishes from the timetable
 * while remaining in the data — the worst kind of missing.
 */
export function hourSpan(
  ev: { startsAt: Date; endsAt: Date },
  hourOf: (d: Date) => number,
  w: HourWindow,
): { row: number; span: number } | null {
  const s = hourOf(ev.startsAt);
  /**
   * ⚠ BOTH BOUNDS, AND THE LOWER ONE IS THE DANGEROUS OMISSION. Checking only
   * `s >= w.to` let a 09:00 session against an 18:00–22:00 window fall through
   * to Math.max(w.from, s), which clamped it to row 0 — rendering a morning
   * mock at 6 PM. A missing session is obvious; a session shown at the wrong
   * hour is a wrong time stated confidently, which is worse.
   *
   * ⚠ OVERLAP, NOT CONTAINMENT. A 17:00–19:00 session against an 18:00 window
   * genuinely belongs on the grid, clipped to row 0. Only something entirely
   * outside is refused.
   */
  const endsAtHour = hourOf(ev.endsAt);
  const endsExactlyOnTheHour = ev.endsAt.getUTCMinutes() === 0;
  const endBoundary = endsExactlyOnTheHour ? endsAtHour : endsAtHour + 1;
  if (s >= w.to) return null;
  if (endBoundary <= w.from) return null;
  const minutes = Math.max(1, (ev.endsAt.getTime() - ev.startsAt.getTime()) / 60_000);
  const rawSpan = Math.max(1, Math.ceil((s * 60 + minutesOf(ev.startsAt) + minutes) / 60) - s);
  const row = Math.max(w.from, s) - w.from;
  const span = Math.max(1, Math.min(rawSpan, w.to - Math.max(w.from, s)));
  return { row, span };
}

function minutesOf(d: Date): number {
  return d.getUTCMinutes();
}

/** "7 PM", "12 PM", "9 AM" — the row label. */
export function hourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
