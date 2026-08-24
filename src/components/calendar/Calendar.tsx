import Link from "next/link";

import {
  MONTH_LONG, WEEKDAY_SHORT, addDays, bucketByDay, cellEvents, dayKeyOf, monthGrid,
  parseDate, periodLabel, stateToQuery, step, weekGrid,
  type CalendarState, type CalendarView, type GridDay,
  hourWindow, hourRows, hourLabel, zoneTz, type CalendarZone,
  VIEWS,
} from "@/lib/calendar/grid";
import type { CalendarEvent, CalendarMode } from "@/lib/calendar/types";
import type { Capacity } from "@/lib/public/capacity-rules";
import { LEVELS } from "@/lib/calendar/types";
import { SUBJECTS } from "@/lib/public/catalogue";
import { CANONICAL_LABEL, CANONICAL_TZ, hourIn } from "@/lib/schedule/timezone";
import { actionFor, dayLabel, groupUpcoming, nextOf } from "@/lib/calendar/upcoming";

import { DayPanel } from "./DayPanel";
import { MonthEmptyState } from "./MonthEmptyState";
import { WeekTimetable } from "./WeekTimetable";
import { TimetableLegend, ZoneToggle } from "./TimetableLegend";
import { EventChip, TypeMarker, describeEvent } from "./EventChip";
import { ONE_TO_ONE, subjectColour, subjectVars } from "@/lib/design/subject-colours";
import { dualTime } from "@/lib/schedule/timezone";

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
   * ⚠ §40/§41 — WHERE "jump to the first teaching week" GOES, resolved by the
   * server from real sessions. Absent means no future teaching is known, and
   * the link is not rendered: a jump that lands on another empty month is
   * worse than no jump.
   */
  jumpToISO?: string | null;
  jumpToLabel?: string | null;
  /**
   * §50 — the next REAL group lesson, from the caller's forward read. When
   * present and the visible period is empty, the month explains itself above
   * the grid instead of below it. Null means the caller found none.
   */
  nextGroupAhead?: { event: CalendarEvent; dateISO: string } | null;
  /** §66 — a real open 1-to-1, or null. Never a placeholder. */
  nextPrivateAhead?: CalendarEvent | null;
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

  /**
   * ⚠ §50 — "EMPTY" MEANS THE PERIOD YOU ARE LOOKING AT, NOT THE WHOLE FETCH.
   *
   * This was `events.length === 0`, which is true only when the entire loaded
   * range is bare. A month with nothing in it, inside a range that has plenty,
   * satisfied neither branch: no empty state, and a grid of forty-two blank
   * cells with nothing to say why. That is the same §50 failure the panel was
   * written for, wearing the other face — and moving the panel above the grid
   * did not fix it, because the panel never rendered.
   *
   * It surfaced when the month grid became an agenda below `sm`: an empty
   * month stopped being forty-two blank cells and became NOTHING AT ALL, which
   * is louder. The condition is the actual defect either way.
   *
   * ⚠ COUNTED FROM buckets, WHICH IS THE REAL EVENTS — no separate query, no
   * second opinion about what falls on which day, nothing invented.
   */
  const visibleCount =
    state.view === "month"
      ? monthGrid(state.date).flat()
          .filter((d) => d.inMonth)
          .reduce((n, d) => n + (buckets.get(d.date)?.length ?? 0), 0)
      : state.view === "week"
        ? weekGrid(state.date).reduce((n, d) => n + (buckets.get(d.date)?.length ?? 0), 0)
        // ⚠ THE DAY VIEW GETS THE SAME TREATMENT. Without this arm an empty day
        // would fall through to events.length — the whole fetched range — and
        // render neither the timetable nor the §50 panel: a blank page.
        : state.view === "day"
          ? (buckets.get(state.date)?.length ?? 0)
          : events.length;

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

      {/* ⚠ FILTERS SIT BELOW THE EXPLANATION WHEN THERE IS NOTHING TO FILTER.
          At 375 the filter rows are 175px of controls for narrowing a set that
          is empty — enough on their own to push the explanation off the fold.
          They are moved, never removed: a filter can be the REASON the period
          looks empty, so taking them away would trap somebody in a state they
          cannot undo. */}
      {showFilters && visibleCount > 0 && (
        <Filters state={state} href={href} lockedSubject={lockedSubject} />
      )}

      {/* ── §50 — AN EMPTY MONTH EXPLAINS ITSELF BEFORE THE GRID ──────────
          ⚠ IT USED TO BE BELOW. The same sentence and jump link existed under
          the grid, where a six-row August fills a laptop viewport and pushes
          them off-screen — so the page read as an unexplained blank, which is
          precisely the failure §50 names. Position was the whole defect. */}
      {visibleCount === 0 && state.view !== "upcoming" && (
        <div className="mt-6">
          <MonthEmptyState
            periodNoun={state.view === "week" ? "week" : state.view === "day" ? "day" : "month"}
            nextGroup={props.nextGroupAhead ?? null}
            nextPrivate={props.nextPrivateAhead ?? null}
            viewerTz={viewerTz}
            jumpHref={(dateISO) => href({ date: dateISO, view: state.view, day: null })}
            upcomingHref={href({ view: "upcoming" })}
            oneToOneHref="/tuition/one-to-one"
            note={props.emptyMessage}
          />
        </div>
      )}

      {showFilters && visibleCount === 0 && (
        <Filters state={state} href={href} lockedSubject={lockedSubject} />
      )}

      {/* ⚠ THE KEY SITS WITH THE TIMETABLE, not at the top of the page. It is
          only meaningful next to the thing it decodes, and on the month view —
          where blocks are dots, not lanes — it would be a key to colours that
          are not on screen. */}
      {(state.view === "week" || state.view === "day") && visibleCount > 0 && (
        <div className="mt-5">
          <TimetableLegend />
        </div>
      )}

      <div className="mt-6">
        {state.view === "month" && (
          <MonthView weeks={monthGrid(state.date)} buckets={buckets} state={state}
            todayISO={todayISO} viewerTz={viewerTz} href={href}
            capacityBySlug={props.capacityBySlug} />
        )}
        {state.view === "week" && (
          <WeekView days={weekGrid(state.date)} buckets={buckets} state={state}
            todayISO={todayISO} viewerTz={viewerTz} href={href}
            capacityBySlug={props.capacityBySlug} />
        )}
        {/* ── §10 — one day, the same timetable ─────────────────────────────
            ⚠ THE SAME COMPONENT, ONE COLUMN. A separate day renderer would be
            a second opinion about where 7:30 PM sits, and the two would drift.
            WeekTimetable takes a list of days; a day view is that list with one
            entry in it. */}
        {state.view === "day" && (
          <WeekTimetable
            events={buckets.get(state.date) ?? []}
            dayISOs={[state.date]}
            tz={zoneTz(state.zone)}
            href={(dayISO) => href({ day: dayISO })}
          />
        )}
        {state.view === "upcoming" && (
          <UpcomingView events={events} viewerTz={viewerTz} href={href}
            emptyMessage={props.emptyMessage} todayISO={todayISO} />
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
          aria-label={`Previous ${state.view === "month" ? "month" : state.view === "week" ? "week" : state.view === "day" ? "day" : "period"}`}
          className="tap-44 grid h-9 w-9 place-items-center rounded-full border border-ink/15 text-ink/70 transition-colors hover:border-ink/35 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span aria-hidden>←</span>
        </Link>
        <Link
          href={href({ date: step(state.view, state.date, 1), day: null })}
          aria-label={`Next ${state.view === "month" ? "month" : state.view === "week" ? "week" : state.view === "day" ? "day" : "period"}`}
          className="tap-44 grid h-9 w-9 place-items-center rounded-full border border-ink/15 text-ink/70 transition-colors hover:border-ink/35 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span aria-hidden>→</span>
        </Link>
        <Link
          href={href({ date: todayISO, day: null })}
          className="tap-44 ml-1 inline-flex items-center justify-center rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:border-ink/35 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
      {/* ⚠ THIS WAS A LABEL. IT IS A CONTROL NOW (§8).
          "Times in Doha" told a student in London the one thing they could not
          act on. The zone is part of calendar state, so it is in the URL with
          the view and the filters — shareable, bookmarkable, and re-rendered
          server-side rather than nudged about on the client. */}
      <div className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto">
        <ZoneToggle zone={state.zone} hrefFor={(z) => href({ zone: z })} />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
          {state.zone === "doha" ? CANONICAL_LABEL : "London"}
        </span>
      </div>

      <div role="group" aria-label="Calendar view" className="inline-flex overflow-hidden rounded-full border border-ink/15">
        {/* ⚠ VIEWS, NOT A SECOND LIST. This was a literal
              ["month","week","upcoming"] — a copy of the union kept in step by
              hand, and it was not: adding the day view (§10) left it reachable
              only by typing ?view=day, because the switcher had never heard of
              it. Reading the exported list means a new view appears in the
              control the moment it exists. */}
          {VIEWS.map((v) => {
          const on = state.view === v;
          return (
            <Link
              key={v}
              href={href({ view: v, day: null })}
              aria-current={on ? "true" : undefined}
              className={`tap-44 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
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
      {/* §11 — the one filter that answers "show me what I can actually do". */}
      {row("Show", [
        { key: null, label: "Everything" },
        { key: "1", label: "Available only" },
      ], state.availableOnly ? "1" : null, (k) => ({ availableOnly: k === "1" }))}
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
  /** Seats taken per cohort slug (0063). Absent = show no capacity anywhere. */
  capacityBySlug?: Map<string, Capacity>;
};

/**
 * A month at 375 is an agenda, not a grid — and the repo already argued this.
 *
 * ============================================================================
 * ⚠ THE NUMBER THAT DECIDES IT: 45.9px.
 * ============================================================================
 * Measured, not estimated: at a 375px viewport the seven-column grid resolves
 * each cell to 45.85px wide. CompactMonth immediately below this file already
 * refuses to put chips in a cell — "a 480px CARD GIVES EACH DAY ABOUT 62px …
 * at 62px it would show two characters of a title and read as noise". The full
 * grid on a phone is NARROWER than the width that reasoning already rejected.
 * So the grid keeps its chips and its 112px rows from `sm` up, and below `sm`
 * the same events are listed vertically where a title has the whole width.
 *
 * WHAT IS LOST, SAID PLAINLY: the shape of the month. A grid shows that the
 * 14th is free at a glance; a list of days-with-lessons cannot. That is a real
 * loss and it is the reason the grid is kept everywhere it fits. What is
 * gained is that the events are readable at all, and that a month with two
 * lessons is ~2 rows instead of 677px of blank cells.
 *
 * ⚠ §79 — NOTHING IS INVENTED HERE. The list is `buckets`, filtered to days
 * inside the month that actually have events, in date order. A day with no
 * lesson is ABSENT; it is never rendered as an empty row or a placeholder. An
 * empty month never reaches this component at all — Calendar renders
 * MonthEmptyState before the view when `events.length === 0`.
 */
function MonthAgenda({ weeks, buckets, todayISO, viewerTz, href }: ViewProps & { weeks: GridDay[][] }) {
  const days = weeks
    .flat()
    .filter((d) => d.inMonth && (buckets.get(d.date) ?? []).length > 0);

  return (
    <ol className="flex flex-col gap-2">
      {days.map((day) => {
        const evs = buckets.get(day.date) ?? [];
        const d = parseDate(day.date);
        const isToday = day.date === todayISO;
        const dayNum = d ? d.getUTCDate() : "";
        const weekday = d ? WEEKDAY_SHORT[(((d.getUTCDay() + 6) % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7] : "";
        return (
          <li key={day.date}>
            <Link
              href={href({ day: day.date })}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${MONTH_LONG[d ? d.getUTCMonth() : 0]} ${dayNum}, ${evs.length} ${
                evs.length === 1 ? "lesson" : "lessons"
              }: ${evs.map((e) => describeEvent(e, viewerTz)).join("; ")}`}
              /* ⚠ tap-44 — the row is a touch target, not a line of text. */
              className="tap-44 flex w-full gap-3 rounded-xl bg-parchment p-3 text-left ring-1 ring-line
                transition-colors duration-150
                hover:bg-surface-cool focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink
                motion-reduce:transition-none"
            >
              {/* the date rail — fixed width so every row's chips start on one line */}
              <span className="flex w-11 shrink-0 flex-col items-center pt-0.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm tabular-nums ${
                    isToday ? "bg-ink text-parchment" : "text-ink/75"
                  }`}
                >
                  {dayNum}
                </span>
                <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
                  {weekday}
                </span>
                {isToday && <span className="sr-only">Today</span>}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                {evs.map((ev) => (
                  <EventChip key={ev.key} event={ev} viewerTz={viewerTz} />
                ))}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function MonthView({ weeks, ...p }: ViewProps & { weeks: GridDay[][] }) {
  return (
    <div>
      {/* ⚠ BELOW sm THE GRID IS NOT RENDERED NARROWER — IT IS NOT RENDERED.
          Hiding it with CSS would still cost the DOM 42 cells and 42 accessible
          names describing a layout nobody is looking at. */}
      <div className="sm:hidden">
        <MonthAgenda weeks={weeks} {...p} />
      </div>
      <div className="hidden sm:block">
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

function DayCell({ day, buckets, todayISO, viewerTz, href, capacityBySlug }: ViewProps & { day: GridDay }) {
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
        {shown.map((ev) => (
          <span key={ev.key} className="flex flex-col">
            <EventChip event={ev} viewerTz={viewerTz} dense />
            {/* ⚠ §6 — CAPACITY IN THE CELL, BUT ONLY WHERE IT IS REAL. The
                label is null at 0 paid seats and on a failed read, so the line
                is absent rather than reading "20 places left" on an empty
                cohort. One line, and only for the first chip of a cohort, so a
                Tuesday and a Saturday of the same class do not each claim
                their own count. */}
            {(() => {
              const cap = ev.cohortSlug ? capacityBySlug?.get(ev.cohortSlug) : undefined;
              if (!cap || cap.known !== true || !cap.label) return null;
              const firstOfCohort =
                shown.findIndex((x) => x.cohortSlug === ev.cohortSlug) === shown.indexOf(ev);
              if (!firstOfCohort) return null;
              return (
                <span
                  className={`font-mono text-[9px] uppercase tracking-[0.1em] ${
                    cap.state === "few-left" || cap.state === "full" ? "text-amber-800" : "text-ink/45"
                  }`}
                >
                  {cap.label}
                </span>
              );
            })()}
          </span>
        ))}
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
      {/* ── phone: a date selector, then one day (§23, §64) ──────────────
          ============================================================
          ⚠ THIS WAS SEVEN STACKED DAY CARDS. IT IS NOW ONE DAY.
          ============================================================
          §23 is explicit that a seven-column grid must not be shrunk onto a
          phone — but the list it replaced had the opposite problem: all seven
          days at once, most of them empty, so the two that had a lesson were
          buried under five that said "—". A student on a phone is asking
          about ONE day at a time.

          ⚠ THE SELECTED DAY IS `state.date`, NOT A NEW PARAMETER. Every day
          in a week shares a startOfWeek, so weekGrid renders the same seven
          days whichever one anchors it — which means the anchor is already a
          per-day cursor and costs no new URL surface, no new state, and no
          new thing that can disagree with the week being shown.

          ⚠ AND IT DOES NOT OPEN THE DAY PANEL. Tapping a date switches the
          list underneath; §16's panel is a different interaction, reached by
          tapping a session. Conflating them would mean a student could not
          look at Wednesday without a sheet covering the calendar. */}
      <div className="sm:hidden">
        {/* ⚠ overflow-x-auto ON ITS OWN ROW so the page body never scrolls
            sideways — the seven dates scroll, the layout does not. */}
        <div className="-mx-1 overflow-x-auto pb-1">
          <ul className="flex min-w-max gap-1.5 px-1">
            {days.map((day) => {
              const d = parseDate(day.date);
              const isToday = day.date === p.todayISO;
              const selected = day.date === p.state.date;
              const count = (p.buckets.get(day.date) ?? []).length;
              return (
                <li key={day.date}>
                  <Link
                    href={p.href({ date: day.date, day: null })}
                    aria-current={selected ? "date" : undefined}
                    aria-label={`${WEEKDAY_SHORT[day.weekday]} ${d?.getUTCDate()}, ${count} ${count === 1 ? "session" : "sessions"}`}
                    className={`flex min-h-[56px] w-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                      selected
                        ? "border-ink bg-ink text-parchment"
                        : "border-ink/15 text-ink/70 hover:border-ink/35"
                    }`}
                  >
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] opacity-70">
                      {WEEKDAY_SHORT[day.weekday]}
                    </span>
                    <span className={`font-mono text-sm tabular-nums ${isToday && !selected ? "underline underline-offset-2" : ""}`}>
                      {d?.getUTCDate()}
                    </span>
                    {/* ⚠ A DOT ONLY WHERE THERE IS SOMETHING — and never a
                        count of nothing dressed as a zero. */}
                    <span
                      aria-hidden
                      className={`h-1 w-1 rounded-full ${count > 0 ? (selected ? "bg-parchment/80" : "bg-ink/50") : "bg-transparent"}`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── the selected day, chronologically ──────────────────────────── */}
        {(() => {
          const selectedISO = days.some((d) => d.date === p.state.date) ? p.state.date : days[0].date;
          const dayEvents = p.buckets.get(selectedISO) ?? [];
          const labels = dayLabel(p.todayISO, selectedISO);
          return (
            <div className="mt-4">
              <h3 className="flex items-baseline gap-2">
                <span className="font-display text-lg font-medium tracking-tight">{labels.lead}</span>
                {labels.lead !== labels.exact && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                    {labels.exact}
                  </span>
                )}
              </h3>

              {dayEvents.length === 0 ? (
                /* §49 — never a dead end: say it, then offer the way out. */
                <div className="mt-3 rounded-lg border border-dashed border-ink/15 bg-ink/[0.015] px-4 py-4">
                  <p className="text-sm text-ink/70">No tuition on this day.</p>
                  <p className="mt-2 text-sm">
                    <Link
                      href={p.href({ view: "upcoming" })}
                      className="font-medium underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      See what is coming up →
                    </Link>
                  </p>
                </div>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {dayEvents.map((ev) => {
                    const action = actionFor(ev);
                    const tone = ev.type === "group" ? subjectColour(ev.subject) : ONE_TO_ONE;
                    return (
                      <li key={ev.key}>
                        {/* ⚠ §48 — THE WHOLE ROW IS THE TARGET, AND THE ACTION
                            IS VISIBLE WITHOUT HOVER. A phone has no hover, so
                            an action that only appears on it does not exist. */}
                        <Link
                          href={p.href({ day: selectedISO })}
                          data-cta={ev.type === "group" ? "group_session_opened" : "one_to_one_slot_opened"}
                          style={subjectVars(ev.status === "cancelled" ? null : tone)}
                          className="flex min-h-[44px] items-start gap-3 rounded-xl border border-ink/10 bg-snow p-3 transition-colors duration-200 hover:border-[var(--subject-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          <span
                            aria-hidden
                            className="mt-1 h-8 w-1 shrink-0 rounded-full bg-[var(--subject-accent)]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-mono text-xs tabular-nums text-ink">
                              {dualTime(ev.startsAt, p.viewerTz).canonical}
                            </span>
                            <span className="mt-0.5 block text-sm font-medium text-ink">{ev.title}</span>
                            {/* §38 — the type in words, never colour alone. */}
                            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
                              {ev.type === "group" ? "Group tuition" : "1-to-1"}
                            </span>
                          </span>
                          <span className="shrink-0 self-center text-[13px] font-medium text-ink">
                            {action.label} <span aria-hidden>→</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── tablet and up: the real timetable ─────────────────────────────
          ⚠ THIS WAS AN HOUR-CELL GRID AND THAT WAS THE DEFECT. Each event was
          rendered in the cell for the hour it STARTED and nowhere else, so a
          7:00–9:30 PM lesson and a 7:00–8:00 PM lesson drew the same box, and
          a 7:30 start sat flush against the 7 o'clock line. WeekTimetable
          positions a block against the axis from its real start and end, and
          gives overlapping events their own lanes instead of hiding one.

          ⚠ AND IT IS DRAWN IN THE SELECTED ZONE, not always in Doha. The old
          axis was Doha-only with a footnote; the zone control now decides, and
          every position is recomputed for each instant rather than shifted. */}
      <div className="hidden sm:block">
        <WeekTimetable
          events={days.flatMap((d) => p.buckets.get(d.date) ?? [])}
          dayISOs={days.map((d) => d.date)}
          tz={zoneTz(p.state.zone)}
          href={(dayISO) => p.href({ day: dayISO })}
        />
      </div>
    </>
  );
}

// ── upcoming ────────────────────────────────────────────────────────────────

function UpcomingView({
  events, viewerTz, href, emptyMessage, todayISO,
}: {
  events: readonly CalendarEvent[];
  viewerTz: string | null;
  href: (p: Partial<CalendarState> & { day?: string | null }) => string;
  emptyMessage?: string;
  todayISO: string;
}) {
  /**
   * ⚠ THIS WAS A SIXTY-ROW LIST UNDER THE HEADING "NEXT 60 DAYS" (§24, §25).
   * Every row carried the same weight: a date column, a time, a course, and
   * the word GROUP in small monospace. It was a query result with a
   * stylesheet — the reader had to scan all of it to find the two sessions
   * that were actually near.
   *
   * It is now banded by nearness, because that is the question being asked.
   * "Next 60 days" describes the FETCH; "This week" describes what a student
   * can go to. The window is unchanged — only the label and the hierarchy.
   */
  if (events.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink/60">
        {emptyMessage ?? "No tuition is scheduled in this period."}
      </p>
    );
  }

  const sections = groupUpcoming(events, todayISO, (e) => dayKeyOf(e.startsAt));

  return (
    <div className="grid gap-9">
      {sections.map((section) => (
        <section key={section.band} aria-labelledby={`band-${section.band}`}>
          <div className="flex items-baseline justify-between gap-4 border-b border-ink/10 pb-2">
            <h3 id={`band-${section.band}`} className="font-display text-lg font-medium tracking-tight">
              {section.label}
            </h3>
            {/* §35 — a count of what is really there, never a claim about it. */}
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
              {section.count} session{section.count === 1 ? "" : "s"}
            </span>
          </div>

          <ol className="mt-3 grid gap-5">
            {section.days.map((day) => (
              <li key={day.dayISO}>
                {/* ⚠ §29 — THE FRIENDLY WORD AND THE EXACT DATE, BOTH.
                    "Tomorrow" alone is ambiguous the moment a tab is left open
                    overnight; a bare "Tue 15 Sep" is colder than it needs to
                    be for something happening in a few hours. */}
                <Link
                  href={href({ day: day.dayISO })}
                  data-cta="calendar_day_selected"
                  className="group/day inline-flex items-baseline gap-2 rounded px-1 py-1 -mx-1 transition-colors hover:bg-parchment-2/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="text-sm font-medium text-ink">{day.lead}</span>
                  {day.lead !== day.exact && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                      {day.exact}
                    </span>
                  )}
                </Link>
                <ul className="mt-2 grid gap-1.5">
                  {day.events.map((ev) => (
                    <li key={ev.key}><EventChip event={ev} viewerTz={viewerTz} /></li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
