import Link from "next/link";

import {
  buildWeek, gridBounds, hourRows, labelForMinutes, isRequestable,
  type GridBounds, type PositionedBlock,
} from "@/lib/calendar/timetable";
import { formatTime, CANONICAL_TZ, CANONICAL_LABEL } from "@/lib/schedule/timezone";
import { ZONES } from "@/lib/calendar/grid";
import type { CalendarEvent } from "@/lib/calendar/types";

/**
 * The week, as a timetable rather than a list of start hours.
 *
 * ============================================================================
 * ⚠ WHAT THIS REPLACES, AND WHY IT WAS WRONG
 * ============================================================================
 * The previous week view put each event in the cell for the hour it STARTED
 * and nothing else — a normal-flow chip in an hour row. A 7:00–9:30 PM lesson
 * and a 7:00–8:00 PM lesson were the same height, and a slot running 7:30–8:30
 * sat at the top of the 7 o'clock row as though it began on the hour. A
 * timetable whose blocks do not span their own duration cannot answer the one
 * question a timetable exists to answer.
 *
 * Blocks are positioned against the axis now: top and height come from real
 * start and end times, and overlapping events take side-by-side lanes instead
 * of hiding one another.
 *
 * ⚠ THE AXIS IS DERIVED FROM THE EVENTS. No fixed 9-to-9:30 frame — see
 * gridBounds. A week with nothing in it returns null bounds and renders the
 * caller's empty state rather than an axis with nothing against it (§50).
 *
 * ⚠ AND IT IS DRAWN IN THE VIEWER'S ZONE. Every position runs through
 * minutesFromMidnight(instant, tz), which recomputes the offset for that
 * instant. Switching to London does not shift everything by a constant — it
 * re-resolves each event, which is the only thing that survives the BST
 * boundary in late October.
 */

const PX_PER_HOUR = 58;

const LANE_LABEL: Record<string, string> = {
  group_y10: "Group lesson",
  group_y11: "Group lesson",
  group_as: "Group lesson",
  group_other: "Group lesson",
  private_open: "Available to request",
  private_booked: "1-to-1 booked",
  blocked: "Unavailable",
};

export function WeekTimetable({
  events, dayISOs, tz, href, emptyState,
}: {
  events: readonly CalendarEvent[];
  dayISOs: readonly string[];
  tz: string;
  href: (dayISO: string) => string;
  emptyState?: React.ReactNode;
}) {
  const bounds = gridBounds(events, tz);
  if (!bounds) return <>{emptyState ?? null}</>;

  const columns = buildWeek(events, dayISOs, tz, bounds);
  const rows = hourRows(bounds);
  const height = ((bounds.endMin - bounds.startMin) / 60) * PX_PER_HOUR;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-parchment">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line bg-surface-cool/60">
        <div aria-hidden />
        {columns.map((c) => (
          <DayHeading key={c.dayISO} dayISO={c.dayISO} tz={tz} href={href(c.dayISO)} />
        ))}
      </div>

      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
        {/* the hour gutter */}
        <div className="relative" style={{ height }}>
          {rows.map((m, i) => (
            <div
              key={m}
              className="absolute right-0 -translate-y-1/2 pr-2"
              style={{ top: `${((m - bounds.startMin) / (bounds.endMin - bounds.startMin)) * 100}%` }}
            >
              {/* ⚠ THE FIRST AND LAST LABELS ARE NOT HIDDEN. They are the only
                  two that say where the axis begins and ends, which is exactly
                  what a derived axis has to communicate. */}
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/40 tabular-nums">
                {i === rows.length - 1 || i === 0 || m % 60 === 0 ? labelForMinutes(m) : ""}
              </span>
            </div>
          ))}
        </div>

        {columns.map((col) => (
          <div key={col.dayISO} className="relative border-l border-line/70" style={{ height }}>
            {/* hour lines, drawn behind everything and deliberately faint (§21) */}
            {rows.map((m) => (
              <div
                key={m}
                aria-hidden
                className="tt-gridline pointer-events-none absolute inset-x-0"
                style={{ top: `${((m - bounds.startMin) / (bounds.endMin - bounds.startMin)) * 100}%` }}
              />
            ))}
            {col.blocks.map((b) => (
              <Block key={b.event.key} block={b} tz={tz} href={href(col.dayISO)} />
            ))}
          </div>
        ))}
      </div>

      <ZoneFootnote tz={tz} />
    </div>
  );
}

function DayHeading({ dayISO, tz, href }: { dayISO: string; tz: string; href: string }) {
  const d = new Date(`${dayISO}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(d);
  const num = d.getUTCDate();
  const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const isToday = dayISO === todayISO;
  return (
    <Link
      href={href}
      /* ⚠ 44px MINIMUM. A day heading is a touch target on a tablet (§22). */
      className="tap-44 flex flex-col items-center justify-center gap-0.5 border-l border-line/70 py-2
        transition-colors hover:bg-ink/[0.04]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
      aria-label={`${weekday} ${num}${isToday ? ", today" : ""}`}
      aria-current={isToday ? "date" : undefined}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">{weekday}</span>
      <span
        className={`font-mono text-xs tabular-nums ${
          isToday ? "rounded-full bg-ink px-1.5 text-parchment" : "text-ink/70"
        }`}
      >
        {num}
      </span>
      {isToday && <span className="sr-only">Today</span>}
    </Link>
  );
}

function Block({ block, tz, href }: { block: PositionedBlock; tz: string; href: string }) {
  const { event: e, kind } = block;
  const width = 100 / block.laneCount;
  const left = block.lane * width;
  /**
   * ⚠ THE RANGE IS PRINTED IN THE ZONE THE GRID IS DRAWN IN, or the label
   * contradicts the block's own position. And Doha stays on screen whenever it
   * is not the selected zone — timezone.ts's standing rule, and the right one:
   * a student in London who reads "5:00 PM" and then says "five o'clock" to a
   * teacher in Doha has been mis-served by the interface.
   */
  const range = `${formatTime(e.startsAt, tz)} – ${formatTime(e.endsAt, tz)}`;
  const inDoha = tz === CANONICAL_TZ
    ? null
    : `${formatTime(e.startsAt, CANONICAL_TZ)} ${CANONICAL_LABEL}`;
  const label = LANE_LABEL[kind] ?? "Lesson";

  /**
   * ⚠ THE ACCESSIBLE NAME CARRIES THE STATE, NOT JUST THE TITLE. "Available to
   * request, 7:00 PM to 8:00 PM" is the whole of what a screen-reader user
   * needs; "1-to-1 Chemistry" alone would make them open it to find out (§22).
   */
  const aria = `${label}: ${e.title}, ${range}${inDoha ? ` (${inDoha})` : ""}`;

  const body = (
    <>
      <span className="block truncate font-medium leading-tight">{e.title}</span>
      <span className="block truncate font-mono text-[9px] uppercase tracking-[0.1em] opacity-70 tabular-nums">
        {range}
      </span>
      {/* ⚠ THE STATE IN WORDS, NOT ONLY IN COLOUR (§22). Hidden below a size
          where it would overlap the title rather than dropped from the DOM, so
          it is still read aloud. */}
      <span className={`mt-0.5 block truncate text-[9px] uppercase tracking-[0.08em] opacity-65 ${
        block.heightPct < 6 ? "sr-only" : ""}`}>
        {label}
      </span>
    </>
  );

  const style = {
    top: `${block.topPct}%`,
    height: `${block.heightPct}%`,
    left: `${left}%`,
    width: `calc(${width}% - 2px)`,
  } as const;

  const cls = `lane lane-${kind} absolute overflow-hidden rounded-md px-1.5 py-1 text-[10px]`;

  /**
   * ⚠ ONLY AN AVAILABLE SLOT IS INTERACTIVE. A prayer block, a booked lesson
   * and somebody else's group class are information — making them links would
   * promise an action that does not exist, and §3's "these must not be
   * requestable" is a rule about the DOM, not about styling.
   */
  if (!isRequestable(kind)) {
    return <div className={cls} style={style} role="group" aria-label={aria}>{body}</div>;
  }
  return (
    <Link
      href={href}
      className={`${cls} block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink`}
      style={style}
      aria-label={aria}
      data-cta="one_to_one_slot_opened"
    >
      {body}
    </Link>
  );
}

function ZoneFootnote({ tz }: { tz: string }) {
  /**
   * ⚠ THE LABEL COMES FROM THE ZONE LIST, NOT FROM THE IANA STRING.
   * zoneLabel("Asia/Qatar") returns "Qatar", so the line read "All times shown
   * in Qatar" — grammatical, and not the wording §20 asks for. ZONES already
   * holds the human name beside the identifier; taking it from there means the
   * toggle and the footnote cannot drift apart into two different names for
   * the same zone.
   */
  const named = ZONES.find((z) => z.tz === tz);
  return (
    <p className="border-t border-line/70 px-3 py-1.5 text-right font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40">
      All times shown in {named ? named.label : tz}
    </p>
  );
}
