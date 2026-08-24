/**
 * The timetable's geometry: where a real event sits on a real grid.
 *
 * ============================================================================
 * ⚠ THIS MODULE INVENTS NOTHING. IT POSITIONS WHAT IT IS GIVEN.
 * ============================================================================
 * Every function here takes CalendarEvent[] — the events loadCalendar() built
 * from cohort_schedules, teacher_availability, availability_blocks,
 * private_bookings and booking_holds — and answers one question: where on a
 * week grid does each one go. It has no reader, no fallback, and no default
 * event. Hand it an empty array and it returns an empty grid, which is what an
 * empty database must look like (§79).
 *
 * ⚠ AND IT NEVER COMPUTES A PRAYER TIME. A prayer block reaches this module as
 * an availability_blocks ROW like any other block. Its hours came from
 * whoever entered it, and this file's only opinion about it is which colour
 * lane it occupies.
 *
 * ⚠ RELATIVE IMPORTS ONLY. The suites are bare `node` programs with no bundler,
 * so a `@/` alias here would make this module unloadable by its own tests.
 */
import {
  zoneOffsetMinutes,
  calendarDate,
} from "../schedule/timezone.ts";
import type { CalendarEvent } from "./types.ts";

/**
 * The visual lanes §6 asks for. One per colour, and every one of them is
 * DERIVED from a column on the row — never from the title, which is prose and
 * changes (§73).
 */
export type LaneKind =
  | "group_y10"
  | "group_y11"
  | "group_as"
  | "group_other"
  | "private_open"
  | "private_booked"
  | "blocked";

/**
 * ⚠ THE MAPPING READS yearGroup AND qualification, IN THAT ORDER, AND REFUSES
 * TO GUESS. A cohort that identifies neither gets `group_other` — a real lane
 * with its own neutral colour — rather than being forced into Year 10 because
 * it happened to be first in a list. Silent misclassification is worse than a
 * visibly generic block: one is wrong, the other is only unhelpful.
 */
export function laneKindFor(e: Pick<CalendarEvent, "type" | "yearGroup" | "qualification">): LaneKind {
  if (e.type === "private_open") return "private_open";
  if (e.type === "private_booked") return "private_booked";
  if (e.type === "blocked") return "blocked";

  const yg = (e.yearGroup ?? "").toLowerCase();
  if (/\b(year\s*)?10\b/.test(yg)) return "group_y10";
  if (/\b(year\s*)?11\b/.test(yg)) return "group_y11";
  if (/\b(year\s*)?12\b/.test(yg)) return "group_as";

  const q = (e.qualification ?? "").toLowerCase();
  // IAL AS and A2 are both the senior Chemistry tone; the brief groups them as
  // "AS Chemistry / Year 12", the most mature colour in the family.
  if (/\bial\b|\bas\b|\ba2\b|a[\s-]?level/.test(q)) return "group_as";
  if (/year\s*11|igcse|gcse/.test(q) && /11/.test(yg)) return "group_y11";
  return "group_other";
}

/** True for lanes a student may act on. Everything else is information. */
export function isRequestable(k: LaneKind): boolean {
  return k === "private_open";
}

/**
 * Minutes since midnight, in a named zone, for a real instant.
 *
 * ⚠ THE OFFSET IS RECOMPUTED FOR THIS INSTANT, WHICH IS THE WHOLE POINT.
 * Europe/London is +0 in January and +1 in July, and Asia/Qatar is +3 all year
 * — so the difference between them is 3 hours for part of the year and 2 for
 * the rest. Any constant here would be wrong for roughly half the calendar,
 * and would be wrong SILENTLY: a 7:00 PM lesson would render at 8:00 PM for a
 * London viewer for seven months and look perfectly plausible.
 */
export function minutesFromMidnight(instant: Date, tz: string): number {
  const off = zoneOffsetMinutes(instant, tz);
  const shifted = new Date(instant.getTime() + off * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** The calendar day an instant falls on, in a named zone. */
export function dayKeyIn(instant: Date, tz: string): string {
  return calendarDate(instant, tz);
}

export type GridBounds = { startMin: number; endMin: number };

/**
 * The vertical extent of the grid, DERIVED FROM THE EVENTS ON IT.
 *
 * ⚠ NOT A FIXED 09:00–21:30 FRAME. The brief describes that span, and it is a
 * fair description of today's timetable — but writing it in as a constant
 * makes the axis a claim about when teaching happens rather than a reading of
 * it. A Saturday morning slot added later would then render off the top of its
 * own grid. The bounds come from the real events, padded to the hour, and an
 * empty set returns null so a caller renders its empty state rather than an
 * axis with nothing against it.
 */
export function gridBounds(events: readonly CalendarEvent[], tz: string): GridBounds | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const e of events) {
    const s = minutesFromMidnight(e.startsAt, tz);
    // An event ending at exactly midnight belongs to the day it started in.
    const rawEnd = minutesFromMidnight(e.endsAt, tz);
    const end = rawEnd <= s ? 24 * 60 : rawEnd;
    if (s < lo) lo = s;
    if (end > hi) hi = end;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  const startMin = Math.max(0, Math.floor(lo / 60) * 60);
  const endMin = Math.min(24 * 60, Math.ceil(hi / 60) * 60);
  // A grid needs somewhere to put an hour label even if everything is inside one.
  return { startMin, endMin: Math.max(endMin, startMin + 60) };
}

export type PositionedBlock = {
  event: CalendarEvent;
  kind: LaneKind;
  /** Percentages of the grid's height, so the caller owns the pixel scale. */
  topPct: number;
  heightPct: number;
  /** Column index and total, for events that overlap in time. */
  lane: number;
  laneCount: number;
  startMin: number;
  endMin: number;
};

/**
 * Side-by-side placement for events that overlap.
 *
 * ⚠ A GROUP LESSON AND A PRIVATE SLOT CANNOT OVERLAP — loadOpenSlots subtracts
 * group sessions before a slot is ever built. So in practice this resolves
 * blocks against blocks. It exists anyway because "cannot happen" is a claim
 * about today's readers, and a grid that silently stacks two events on top of
 * each other hides one of them completely.
 */
function assignLanes(items: { startMin: number; endMin: number }[]): { lane: number; laneCount: number }[] {
  const order = items.map((_, i) => i).sort((a, b) =>
    items[a].startMin - items[b].startMin || items[a].endMin - items[b].endMin);
  const laneEnd: number[] = [];
  const lane = new Array<number>(items.length).fill(0);
  const cluster: number[] = [];
  const out = new Array<{ lane: number; laneCount: number }>(items.length);
  let clusterEnd = -Infinity;

  const flush = () => {
    const count = Math.max(1, laneEnd.length);
    for (const i of cluster) out[i] = { lane: lane[i], laneCount: count };
    cluster.length = 0;
    laneEnd.length = 0;
  };

  for (const i of order) {
    const it = items[i];
    if (it.startMin >= clusterEnd && cluster.length > 0) flush();
    let placed = -1;
    for (let l = 0; l < laneEnd.length; l++) {
      if (laneEnd[l] <= it.startMin) { placed = l; break; }
    }
    if (placed === -1) { laneEnd.push(it.endMin); placed = laneEnd.length - 1; }
    else laneEnd[placed] = it.endMin;
    lane[i] = placed;
    cluster.push(i);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return out;
}

/**
 * Position one day's events against the grid.
 *
 * ⚠ EVENTS ARE MATCHED TO A DAY IN THE VIEWER'S ZONE, NOT IN UTC AND NOT IN
 * DOHA. A 9:30 PM Doha lesson is 6:30 PM in London and belongs to the same
 * calendar day; a 1:00 AM Doha slot would be the PREVIOUS day in London, and
 * putting it in the wrong column is exactly the class of bug a fixed offset
 * produces.
 */
export function positionDay(
  events: readonly CalendarEvent[], dayISO: string, tz: string, bounds: GridBounds,
): PositionedBlock[] {
  const span = Math.max(1, bounds.endMin - bounds.startMin);
  const mine = events.filter((e) => dayKeyIn(e.startsAt, tz) === dayISO);

  const spans = mine.map((e) => {
    const s = minutesFromMidnight(e.startsAt, tz);
    const rawEnd = minutesFromMidnight(e.endsAt, tz);
    const end = rawEnd <= s ? 24 * 60 : rawEnd;
    return { startMin: s, endMin: end };
  });
  const lanes = assignLanes(spans);

  return mine.map((e, i) => {
    const { startMin, endMin } = spans[i];
    const top = ((startMin - bounds.startMin) / span) * 100;
    const height = ((endMin - startMin) / span) * 100;
    return {
      event: e,
      kind: laneKindFor(e),
      // Clamped so an event partly outside the axis still renders inside it
      // rather than escaping the grid box.
      topPct: Math.max(0, Math.min(100, top)),
      heightPct: Math.max(0.8, Math.min(100 - Math.max(0, top), height)),
      lane: lanes[i].lane,
      laneCount: lanes[i].laneCount,
      startMin, endMin,
    };
  }).sort((a, b) => a.startMin - b.startMin || a.lane - b.lane);
}

export type DayColumn = { dayISO: string; blocks: PositionedBlock[] };

export function buildWeek(
  events: readonly CalendarEvent[], dayISOs: readonly string[], tz: string, bounds: GridBounds,
): DayColumn[] {
  return dayISOs.map((dayISO) => ({ dayISO, blocks: positionDay(events, dayISO, tz, bounds) }));
}

/**
 * The hour rows the axis draws.
 *
 * ⚠ DERIVED FROM THE BOUNDS, so the labels cannot disagree with the blocks —
 * a second list of hours is exactly the parallel representation this codebase
 * keeps removing.
 */
export function hourRows(bounds: GridBounds): number[] {
  const out: number[] = [];
  for (let m = bounds.startMin; m <= bounds.endMin; m += 60) out.push(m);
  return out;
}

/** "7:00 PM" from minutes-since-midnight. Pure formatting, no zone maths. */
export function labelForMinutes(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
