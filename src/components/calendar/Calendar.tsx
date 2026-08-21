import Link from "next/link";

import {
  MONTH_LONG, WEEKDAY_SHORT, addDays, bucketByDay, cellEvents, monthGrid,
  parseDate, periodLabel, stateToQuery, step, weekGrid,
  type CalendarState, type CalendarView, type GridDay,
  hourWindow, hourRows, hourLabel,
} from "@/lib/calendar/grid";
import type { CalendarEvent, CalendarMode } from "@/lib/calendar/types";
import type { Capacity } from "@/lib/public/capacity-rules";
import { LEVELS } from "@/lib/calendar/types";
import { SUBJECTS } from "@/lib/public/catalogue";
import { CANONICAL_LABEL, CANONICAL_TZ, hourIn } from "@/lib/schedule/timezone";

import { DayPanel } from "./DayPanel";
import { EventChip, TypeMarker, describeEvent } from "./EventChip";

/**
 * The one Ailemy calendar (§2, §5, §34).
 *
 * ============================================================================
 * ⚠ ONE COMPONENT, TWO MODES, SIX SURFACES
 * ============================================================================
 * The homepage preview, /calendar, /tuition, the three subject pages and the
 * student profile all render THIS. Public mode shows what Ailemy offers;
 * personal mode shows what this student is attending. §70 is explicit that
 * those are different questions — but they are the same calendar, so the
 * difference is a prop and a reader, never a second implementation.
 *
 * ============================================================================
 * ⚠ SERVER-RENDERED, WITH STATE IN THE URL
 * ============================================================================
 * View, date, filters and the open day are all query parameters. That buys
 * four things a client-state calendar does not get for free:
 *
 *   • §9's shareable links — a parent can send "?date=2026-10-10" to a student;
 *   • it works with JavaScript off, which matters on a school network;
 *   • no hydration flash on the most time-sensitive content on the site;
 *   • §60's range fetching is honest, because the server knows the window
 *     before it queries rather than fetching wide and filtering narrow.
 *
 * The only client JavaScript in the whole calendar is the timezone sync, which
 * renders nothing.
 *
 * ⚠ AND NO CALENDAR LIBRARY (§61). A month is six weeks of seven days; the hard
 * part is timezone correctness and that is a product rule, not a formatting
 * one. Adding a scheduler package would have bought bundle weight and an
 * opinion about days that disagrees with ours.
 */

export type CalendarProps = {
  events: readonly CalendarEvent[];
  state: CalendarState;
  todayISO: string;
  viewerTz: string | null;
  mode: CalendarMode;
  /** Where the calendar lives, so links stay on this page. */
  basePath: string;
  /** The day whose panel is open, if any. */
  openDay?: string | null;
  /** Hide the whole filter block (homepage preview, tight embeds). */
  showFilters?: boolean;
  /**
   * Seats taken per cohort slug, resolved SERVER-SIDE from 0063's
   * cohort_seats_taken.
   *
   * ⚠ OPTIONAL, AND ITS ABSENCE MEANS SILENCE RATHER THAN ZERO. Surfaces that
   * have not resolved it — the compact hero card, an embed — simply show no
   * capacity line. A default of an empty Map would be identical in behaviour
   * and would invite a caller to believe capacity had been checked.
   */
  capacityBySlug?: Map<string, Capacity>;
  /**
   * ⚠ FOR AN EMBED PART-WAY DOWN A LONG PAGE. Every link here is a real
   * navigation, so the browser lands at the top of the destination — fine at
   * /calendar, where the calendar IS the page, and wrong on the homepage, where
   * closing a day panel would leave the reader at the hero having lost their
   * place. An anchor puts them back at the section.
   *
   * Appended LAST, after the query string, because a fragment that precedes `?`
   * is part of the fragment and the query is silently lost.
   */
  anchor?: string;
  /**
   * ⚠ ON /chemistry THE SUBJECT IS THE PAGE, NOT A FILTER. Rendering the
   * subject row there would offer an "All" that silently turns the Chemistry
   * calendar into the school calendar — the same URL, a different promise.
   * Level and type still filter; subject is locked and stated.
   */
  lockedSubject?: string | null;
  /** Rendered when the whole range is empty — the caller knows why (§12, §57). */
  emptyMessage?: string;
  /**
   * ============================================================================
   * ⚠ "compact" IS A LIVE PREVIEW, NOT A PICTURE OF ONE
   * ============================================================================
   * Same events, same bucketing, same month maths, same two glyphs — rendered
   * small enough to sit in a hero card. What it drops is CHROME and
   * INTERACTION: no toolbar, no filters, no day links, no panel. Every cell is
   * a div, so nothing inside is focusable and the whole card can be wrapped in
   * one link without nesting anchors.
   *
   * ⚠ IT IS NOT A SECOND CALENDAR. The grid comes from monthGrid(), the events
   * from bucketByDay(), the markers from EventChip's TypeMarker — the only
   * thing this path owns is how small a cell is. Anything it decided for itself
   * would be a second opinion about what day a lesson falls on.
   */
  variant?: "full" | "compact";
};

/** How many chips fit in a month cell before "+N more" (§6). */
const MONTH_CELL_LIMIT = 3;

export function Calendar(props: CalendarProps) {
  const { events, state, todayISO, viewerTz, basePath, showFilters = true } = props;
  const lockedSubject = props.lockedSubject ?? null;
  const buckets = bucketByDay(events);

  if (props.variant === "compact") {
    return <CompactMonth weeks={monthGrid(state.date)} buckets={buckets} todayISO={todayISO} state={state} />;
  }

  const href = (patch: Partial<CalendarState> & { day?: string | null }) => {
    const next: CalendarState = { ...state, ...patch };
    const q = stateToQuery(next, todayISO, basePath);
    const withDay = patch.day
      ? (q.includes("?") ? `${q}&day=${patch.day}` : `${q}?day=${patch.day}`)
      : q;
    return props.anchor ? `${withDay}${props.anchor}` : withDay;
  };

  return (
    <section
      className="w-full"
      aria-label={`${props.mode === "personal" ? "Your" : "Ailemy"} calendar, ${periodLabel(state.view, state.date)}`}
    >
      <Toolbar state={state} todayISO={todayISO} href={href} viewerTz={viewerTz} />

      {showFilters && <Filters state={state} href={href} lockedSubject={lockedSubject} />}

      <div className="mt-6">
        {state.view === "month" && (
          <MonthView weeks={monthGrid(state.date)} buckets={buckets} state={state}
            todayISO={todayISO} viewerTz={viewerTz} href={href} />
        )}
        {state.view === "week" && (
          <WeekView days={weekGrid(state.date)} buckets={buckets} state={state}
            todayISO={todayISO} viewerTz={viewerTz} href={href} />
        )}
        {state.view === "upcoming" && (
          <UpcomingView events={events} viewerTz={viewerTz} href={href}
            emptyMessage={props.emptyMessage} />
        )}

        {/*
          ⚠ AN EMPTY GRID DOES NOT EXPLAIN ITSELF (§12, §57). An empty LIST
          reads as "nothing here"; a month of blank cells with a Year 11 filter
          applied reads as "the calendar is broken". The note says which filter
          emptied it, so the fix is one tap away rather than a guess.
        */}
        {events.length > 0 || state.view === "upcoming" ? null : (
          <p className="mt-5 text-sm leading-relaxed text-ink/60">
            {props.emptyMessage ?? "No lessons are scheduled in this period."}
          </p>
        )}
      </div>

      {props.openDay && (
        <DayPanel
          dayISO={props.openDay}
          events={buckets.get(props.openDay) ?? []}
          viewerTz={viewerTz}
          mode={props.mode}
          closeHref={href({ day: null })}
          capacityBySlug={props.capacityBySlug}
        />
      )}
    </section>
  );
}

// ── toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({
  state, todayISO, href, viewerTz,
}: {
  state: CalendarState;
  todayISO: string;
  href: (p: Partial<CalendarState> & { day?: string | null }) => string;
  viewerTz: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      <nav className="flex items-center gap-1" aria-label="Change period">
        <Link
          href={href({ date: step(state.view, state.date, -1), day: null })}
          aria-label={`Previous ${state.view === "month" ? "month" : state.view === "week" ? "week" : "period"}`}
          className="grid h-9 w-9 place-items-center rounded-full border border-ink/15 text-ink/70 transition-colors hover:border-ink/35 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span aria-hidden>←</span>
        </Link>
        <Link
          href={href({ date: step(state.view, state.date, 1), day: null })}
          aria-label={`Next ${state.view === "month" ? "month" : state.view === "week" ? "week" : "period"}`}
          className="grid h-9 w-9 place-items-center rounded-full border border-ink/15 text-ink/70 transition-colors hover:border-ink/35 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span aria-hidden>→</span>
        </Link>
        <Link
          href={href({ date: todayISO, day: null })}
          className="ml-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:border-ink/35 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Today
        </Link>
      </nav>

      <h2 className="font-display min-w-0 flex-1 text-xl font-medium tracking-tight sm:text-2xl">
        {periodLabel(state.view, state.date)}
      </h2>

      {/*
        ⚠ THE VIEWER IS ALWAYS TOLD WHICH CLOCK THEY ARE READING (§21). Silent
        conversion is how a student turns up an hour late and blames us.

        ⚠ AND IT IS VIEW-AWARE, BECAUSE THE MONTH CELLS SHOW ONE CLOCK. Saying
        "+ your local time" over a grid that only prints Doha would be a small
        lie in the one place a lie costs an hour. Month says where to find it.
      */}
      <p className="order-last w-full font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45 sm:order-none sm:w-auto">
        Times in {CANONICAL_LABEL}
        {viewerTz && viewerTz !== "Asia/Qatar"
          ? state.view === "month" ? " · open a day for yours" : " + your local time"
          : ""}
      </p>

      <div role="group" aria-label="Calendar view" className="inline-flex overflow-hidden rounded-full border border-ink/15">
        {(["month", "week", "upcoming"] as CalendarView[]).map((v) => {
          const on = state.view === v;
          return (
            <Link
              key={v}
              href={href({ view: v, day: null })}
              aria-current={on ? "true" : undefined}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                on ? "bg-ink text-parchment" : "text-ink/70 hover:bg-ink/[0.06]"
              } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink`}
            >
              {v}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Filters({
  state, href, lockedSubject,
}: {
  state: CalendarState;
  href: (p: Partial<CalendarState> & { day?: string | null }) => string;
  lockedSubject: string | null;
}) {
  const row = (
    legend: string,
    options: { key: string | null; label: string }[],
    active: string | null,
    patch: (k: string | null) => Partial<CalendarState>,
  ) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
        {legend}
      </span>
      {options.map((o) => {
        const on = (o.key ?? null) === active;
        return (
          <Link
            key={o.key ?? "all"}
            href={href({ ...patch(o.key), day: null })}
            aria-current={on ? "true" : undefined}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              on ? "border-ink bg-ink text-parchment" : "border-ink/15 text-ink/65 hover:border-ink/35"
            } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="mt-5 space-y-2" role="group" aria-label="Filter the calendar">
      {lockedSubject === null &&
        row("Subject", [{ key: null, label: "All" }, ...SUBJECTS.map((s) => ({ key: s.slug, label: s.name }))],
          state.subject, (k) => ({ subject: k }))}
      {row("Level", [{ key: null, label: "All" }, ...LEVELS.map((l) => ({ key: l.slug, label: l.label }))],
        state.level, (k) => ({ level: k }))}
      {row("Type", [
        { key: "all", label: "All" }, { key: "group", label: "Group" }, { key: "private", label: "1-to-1" },
      ], state.type, (k) => ({ type: (k ?? "all") as CalendarState["type"] }))}
    </div>
  );
}

// ── month ───────────────────────────────────────────────────────────────────

type ViewProps = {
  buckets: Map<string, CalendarEvent[]>;
  state: CalendarState;
  todayISO: string;
  viewerTz: string | null;
  href: (p: Partial<CalendarState> & { day?: string | null }) => string;
};

function MonthView({ weeks, ...p }: ViewProps & { weeks: GridDay[][] }) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-px border-b border-ink/10 pb-2" aria-hidden>
        {([1, 2, 3, 4, 5, 6, 7] as const).map((w) => (
          <div key={w} className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
            {WEEKDAY_SHORT[w]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-ink/10">
        {weeks.flat().map((day) => (
          <DayCell key={day.date} day={day} {...p} />
        ))}
      </div>
    </div>
  );
}

/**
 * The hero card's month: dots, not chips.
 *
 * ⚠ A 480px CARD GIVES EACH DAY ABOUT 62px. A dense chip already truncates at
 * 112px in the full grid; at 62px it would show two characters of a title and
 * read as noise. A dot per lesson says the one thing this size can say
 * honestly — something is on, and which kind — and the card's whole job is to
 * make somebody open the real calendar.
 *
 * ⚠ NOTHING HERE IS FOCUSABLE. Every cell is a div and every marker is
 * aria-hidden, so the card is one tab stop and one link, which is what lets it
 * be wrapped without nesting interactive elements. The grid carries
 * aria-hidden and the wrapping link carries the description, because a screen
 * reader user gains nothing from 42 unreachable cells.
 */
function CompactMonth({
  weeks, buckets, todayISO, state,
}: {
  weeks: GridDay[][]; buckets: Map<string, CalendarEvent[]>; todayISO: string; state: CalendarState;
}) {
  const MAX_DOTS = 3;
  return (
    <div aria-hidden>
      <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
        {periodLabel("month", state.date)}
      </p>
      <div className="grid grid-cols-7 gap-px pb-1.5">
        {([1, 2, 3, 4, 5, 6, 7] as const).map((w) => (
          <div key={w} className="text-center font-mono text-[9px] uppercase tracking-[0.14em] text-ink/35">
            {WEEKDAY_SHORT[w].slice(0, 1)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md bg-ink/10">
        {weeks.flat().map((day) => {
          const all = buckets.get(day.date) ?? [];
          const d = parseDate(day.date);
          const isToday = day.date === todayISO;
          return (
            <div
              key={day.date}
              className={`flex min-h-[52px] flex-col items-center gap-1 px-1 pt-1.5 ${
                day.inMonth ? "bg-parchment" : "bg-parchment/55"
              }`}
            >
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  day.inMonth ? "text-ink/65" : "text-ink/25"
                } ${isToday ? "rounded-full bg-ink px-1 text-parchment" : ""}`}
              >
                {d ? d.getUTCDate() : ""}
              </span>
              <span className="flex flex-wrap justify-center gap-0.5">
                {all.slice(0, MAX_DOTS).map((ev) => (
                  <TypeMarker key={ev.key} type={ev.type} />
                ))}
                {all.length > MAX_DOTS && (
                  <span className="font-mono text-[9px] leading-none text-ink/45">+{all.length - MAX_DOTS}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayCell({ day, buckets, todayISO, viewerTz, href }: ViewProps & { day: GridDay }) {
  const all = buckets.get(day.date) ?? [];
  const { shown, hidden } = cellEvents(all, MONTH_CELL_LIMIT);
  const isToday = day.date === todayISO;
  const d = parseDate(day.date);
  const dayNum = d ? d.getUTCDate() : "";

  /**
   * ⚠ THE ACCESSIBLE NAME CARRIES THE EVENTS, NOT JUST THE DATE (§59). A screen
   * reader user should not have to open every cell to find out which ones have
   * lessons — that is the whole advantage a sighted user gets from §6's large
   * cells, and it has to be matched in text.
   */
  const label = all.length === 0
    ? `${MONTH_LONG[d ? d.getUTCMonth() : 0]} ${dayNum}, no lessons scheduled`
    : `${MONTH_LONG[d ? d.getUTCMonth() : 0]} ${dayNum}, ${all.length} ${all.length === 1 ? "lesson" : "lessons"}: ${
        all.map((e) => describeEvent(e, viewerTz)).join("; ")
      }`;

  return (
    <Link
      href={href({ day: day.date })}
      aria-label={label}
      aria-current={isToday ? "date" : undefined}
      /**
       * ⚠ MOTION IS SUBTLE, FAST, AND OPT-OUT (§7, §59). ~160ms, a 2px lift and
       * a hairline shadow. motion-reduce:transform-none honours the OS setting
       * rather than asking the user to tolerate it.
       */
      className={`group relative flex min-h-[112px] flex-col gap-1 p-2 text-left transition-[transform,box-shadow,background-color] duration-150 ease-out
        hover:z-10 hover:-translate-y-0.5 hover:shadow-[0_2px_10px_-4px_rgba(15,20,25,0.28)]
        focus-visible:z-10 focus-visible:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink
        motion-reduce:transform-none motion-reduce:transition-none
        sm:min-h-[132px]
        ${day.inMonth ? "bg-parchment" : "bg-parchment/55"}`}
    >
      <span className="flex items-baseline justify-between">
        <span
          className={`font-mono text-xs tabular-nums ${
            day.inMonth ? "text-ink/70" : "text-ink/30"
          } ${isToday ? "rounded-full bg-ink px-1.5 py-0.5 text-parchment" : ""}`}
        >
          {dayNum}
        </span>
        {/* ⚠ TODAY IS MARKED IN TEXT AS WELL AS IN FILL, so the state survives
            greyscale and colour-blindness (§59). */}
        {isToday && <span className="sr-only">Today</span>}
      </span>

      <span className="flex flex-col gap-0.5">
        {shown.map((ev) => <EventChip key={ev.key} event={ev} viewerTz={viewerTz} dense />)}
        {hidden > 0 && (
          <span className="font-mono text-[10px] text-ink/50">+{hidden} more</span>
        )}
      </span>
    </Link>
  );
}

// ── week ────────────────────────────────────────────────────────────────────

/**
 * The week as an actual timetable (§8).
 *
 * ============================================================================
 * ⚠ SEVEN COLUMNS OF LISTS IS NOT A TIMETABLE
 * ============================================================================
 * The previous week view stacked each day's lessons in a list. That answers
 * "what is on Tuesday" and cannot answer the question §8 actually asks — "is
 * 8 PM free" — because nothing is positioned in time. Two lessons an hour apart
 * and two lessons back to back looked identical.
 *
 * An hour axis answers both, and it makes an EMPTY slot visible, which is the
 * whole point when half the product is bookable 1-to-1 time.
 *
 * ⚠ THE AXIS IS DERIVED FROM THE WEEK'S OWN LESSONS (grid.ts hourWindow), so
 * teaching at 19:00–21:30 gets a compact five-row grid rather than sixteen
 * empty rows, and a morning mock stretches it rather than being cropped.
 *
 * ⚠ ON A PHONE IT IS NOT A GRID AT ALL. Seven columns × five rows at 375px
 * gives 45px cells — unreadable, and the brief says explicitly not to shrink
 * desktop UI until text becomes unreadable. Below `sm` this falls back to the
 * day-by-day list, which is the right shape for a narrow screen.
 */
function WeekView({ days, ...p }: ViewProps & { days: GridDay[] }) {
  const all = days.flatMap((d) => p.buckets.get(d.date) ?? []);
  // ⚠ CANONICAL HOURS, ALWAYS — see hourIn's own note. The rows are Doha's.
  const canonicalHour = (d: Date) => hourIn(d, CANONICAL_TZ);
  const win = hourWindow(all, canonicalHour);
  const rows = hourRows(win);

  return (
    <>
      {/* ── phone: the list, unchanged ─────────────────────────────────── */}
      <div className="grid gap-px overflow-hidden rounded-lg bg-ink/10 sm:hidden">
        {days.map((day) => {
          const dayEvents = p.buckets.get(day.date) ?? [];
          const d = parseDate(day.date);
          const isToday = day.date === p.todayISO;
          return (
            <div key={day.date} className="flex min-h-[64px] flex-col bg-parchment">
              <Link
                href={p.href({ day: day.date })}
                className="flex items-baseline gap-2 border-b border-ink/10 px-2 py-2 transition-colors hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
                aria-label={`${WEEKDAY_SHORT[day.weekday]} ${d?.getUTCDate()}, ${dayEvents.length} ${dayEvents.length === 1 ? "session" : "sessions"}`}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                  {WEEKDAY_SHORT[day.weekday]}
                </span>
                <span className={`font-mono text-xs tabular-nums ${isToday ? "rounded-full bg-ink px-1.5 text-parchment" : "text-ink/70"}`}>
                  {d?.getUTCDate()}
                </span>
              </Link>
              <div className="flex flex-1 flex-col gap-1.5 p-2">
                {dayEvents.length === 0 ? (
                  <span className="font-mono text-[10px] text-ink/30">—</span>
                ) : (
                  dayEvents.map((ev) => <EventChip key={ev.key} event={ev} viewerTz={p.viewerTz} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── tablet and up: the hour grid ───────────────────────────────── */}
      <div className="hidden sm:block">
        <div className="overflow-hidden rounded-lg border border-ink/10">
          {/* Day header row */}
          <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-ink/10 bg-parchment-2/40">
            <div aria-hidden />
            {days.map((day) => {
              const d = parseDate(day.date);
              const isToday = day.date === p.todayISO;
              return (
                <Link
                  key={day.date}
                  href={p.href({ day: day.date })}
                  className="flex items-baseline justify-center gap-1.5 border-l border-ink/10 py-2 transition-colors hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                    {WEEKDAY_SHORT[day.weekday]}
                  </span>
                  <span className={`font-mono text-xs tabular-nums ${isToday ? "rounded-full bg-ink px-1.5 text-parchment" : "text-ink/70"}`}>
                    {d?.getUTCDate()}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Hour rows */}
          {rows.map((h) => (
            <div
              key={h}
              className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-ink/[0.06] last:border-b-0"
            >
              <div className="flex items-start justify-end pr-2 pt-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/35">
                  {hourLabel(h)}
                </span>
              </div>
              {days.map((day) => {
                const dayEvents = p.buckets.get(day.date) ?? [];
                /**
                 * ⚠ AN EVENT IS RENDERED IN ITS STARTING ROW ONLY. Repeating it
                 * in every hour it spans would announce the same lesson three
                 * times to a screen reader and triple-count it by eye.
                 */
                const starting = dayEvents.filter((ev) => canonicalHour(ev.startsAt) === h);
                return (
                  <div
                    key={day.date + h}
                    className="min-h-[42px] border-l border-ink/10 p-1"
                  >
                    {starting.map((ev) => (
                      <EventChip key={ev.key} event={ev} viewerTz={p.viewerTz} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ⚠ THE AXIS IS DOHA, SAID OUT LOUD. A grid of hours with no zone on it
            is the silent-wrong-hour failure this project already fixed once in
            the timezone work. */}
        <p className="mt-2 text-right font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40">
          Hours shown in Doha
        </p>
      </div>
    </>
  );
}

// ── upcoming ────────────────────────────────────────────────────────────────

function UpcomingView({
  events, viewerTz, href, emptyMessage,
}: {
  events: readonly CalendarEvent[];
  viewerTz: string | null;
  href: (p: Partial<CalendarState> & { day?: string | null }) => string;
  emptyMessage?: string;
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink/60">
        {emptyMessage ?? "No lessons are scheduled in this period."}
      </p>
    );
  }

  const byDay = bucketByDay(events);
  const days = [...byDay.keys()].sort();

  return (
    <ol className="divide-y divide-ink/10 border-y border-ink/10">
      {days.map((dayISO) => {
        const d = parseDate(dayISO)!;
        return (
          <li key={dayISO} className="flex flex-wrap gap-x-6 gap-y-2 py-4 sm:flex-nowrap">
            <Link
              href={href({ day: dayISO })}
              className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {WEEKDAY_SHORT[((d.getUTCDay() === 0 ? 7 : d.getUTCDay()) as 1)]} {d.getUTCDate()}{" "}
              {MONTH_LONG[d.getUTCMonth()].slice(0, 3)}
            </Link>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {byDay.get(dayISO)!.map((ev) => (
                <li key={ev.key}><EventChip event={ev} viewerTz={viewerTz} /></li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
