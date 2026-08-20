import Link from "next/link";

import {
  MONTH_LONG, WEEKDAY_SHORT, addDays, bucketByDay, cellEvents, monthGrid,
  parseDate, periodLabel, stateToQuery, step, weekGrid,
  type CalendarState, type CalendarView, type GridDay,
} from "@/lib/calendar/grid";
import type { CalendarEvent, CalendarMode } from "@/lib/calendar/types";
import { LEVELS } from "@/lib/calendar/types";
import { SUBJECTS } from "@/lib/public/catalogue";
import { CANONICAL_LABEL } from "@/lib/schedule/timezone";

import { DayPanel } from "./DayPanel";
import { EventChip, describeEvent } from "./EventChip";

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
   * ⚠ ON /chemistry THE SUBJECT IS THE PAGE, NOT A FILTER. Rendering the
   * subject row there would offer an "All" that silently turns the Chemistry
   * calendar into the school calendar — the same URL, a different promise.
   * Level and type still filter; subject is locked and stated.
   */
  lockedSubject?: string | null;
  /** Rendered when the whole range is empty — the caller knows why (§12, §57). */
  emptyMessage?: string;
};

/** How many chips fit in a month cell before "+N more" (§6). */
const MONTH_CELL_LIMIT = 3;

export function Calendar(props: CalendarProps) {
  const { events, state, todayISO, viewerTz, basePath, showFilters = true } = props;
  const lockedSubject = props.lockedSubject ?? null;
  const buckets = bucketByDay(events);

  const href = (patch: Partial<CalendarState> & { day?: string | null }) => {
    const next: CalendarState = { ...state, ...patch };
    const q = stateToQuery(next, todayISO, basePath);
    if (patch.day) {
      return q.includes("?") ? `${q}&day=${patch.day}` : `${q}?day=${patch.day}`;
    }
    return q;
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

function WeekView({ days, ...p }: ViewProps & { days: GridDay[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg bg-ink/10 sm:grid-cols-7">
      {days.map((day) => {
        const all = p.buckets.get(day.date) ?? [];
        const d = parseDate(day.date);
        const isToday = day.date === p.todayISO;
        return (
          <div key={day.date} className="flex min-h-[160px] flex-col bg-parchment">
            <Link
              href={p.href({ day: day.date })}
              className="flex items-baseline gap-2 border-b border-ink/10 px-2 py-2 transition-colors hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
              aria-label={`${WEEKDAY_SHORT[day.weekday]} ${d?.getUTCDate()}, ${all.length} ${all.length === 1 ? "lesson" : "lessons"}`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                {WEEKDAY_SHORT[day.weekday]}
              </span>
              <span className={`font-mono text-xs tabular-nums ${isToday ? "rounded-full bg-ink px-1.5 text-parchment" : "text-ink/70"}`}>
                {d?.getUTCDate()}
              </span>
            </Link>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
              {all.length === 0 ? (
                <span className="font-mono text-[10px] text-ink/30">—</span>
              ) : (
                all.map((ev) => <EventChip key={ev.key} event={ev} viewerTz={p.viewerTz} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
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
