import type { Cohort } from "../public/catalogue.ts";

/**
 * The one event shape every calendar surface renders.
 *
 * ============================================================================
 * ⚠ ONE TYPE, THREE SOURCES, SIX SURFACES
 * ============================================================================
 * Group sessions come from the recurrence engine, open 1-to-1 slots from the
 * availability engine, and a student's confirmed bookings from their own rows.
 * All three are normalised into this shape ONCE, at the reader boundary, so the
 * calendar component never asks where an event came from.
 *
 * That is what makes §2's rule enforceable rather than aspirational: a new
 * surface cannot invent its own event shape, because there is only one and it
 * is the one the component accepts.
 *
 * ⚠ NOTHING HERE CARRIES ANOTHER STUDENT'S IDENTITY. `private_booked` exists
 * only in PERSONAL mode, where the viewer is the owner. A public calendar never
 * receives one — enforced at the reader, not by a template remembering to omit
 * a field (§72).
 */

export type CalendarEventType =
  /** A cohort lesson. Viewable, never privately bookable (§13). */
  | "group"
  /** A genuinely bookable 1-to-1 slot. Public. Carries no student. */
  | "private_open"
  /** THIS viewer's own confirmed 1-to-1 booking. Personal mode only. */
  | "private_booked";

export type CalendarEventStatus = "scheduled" | "cancelled";

export type CalendarEvent = {
  /** Stable across reads — safe as a React key and as a URL fragment. */
  key: string;
  type: CalendarEventType;
  status: CalendarEventStatus;
  startsAt: Date;
  endsAt: Date;
  title: string;

  /** Structured metadata, never parsed back out of the title (§73). */
  subject: string | null;
  qualification: string | null;
  yearGroup: string | null;
  cohortSlug: string | null;
  teacherName: string | null;

  /** Set only when status is 'cancelled'. */
  cancelledReason: string | null;

  /** Present for group events, so a cell can show price and cohort state. */
  cohort?: Cohort;

  /** Present for bookable slots. Minor units, with its currency. */
  priceMinor?: number | null;
  currency?: string | null;
  /** Whether the viewer could pay for this right now (§80). */
  bookable?: boolean;

  /** Present for the viewer's own booking (§74). */
  bookingRef?: string | null;
  /**
   * ⚠ THE REAL private_bookings.id, CARRIED EXPLICITLY (personal mode only).
   *
   * /profile needs it to offer a cancel control. It was recovering it by
   * stripping the "b:" prefix off `key` — which works until somebody changes
   * the prefix, at which point the lookup silently misses and every booking
   * quietly loses its cancel button with no error anywhere. Same argument as
   * slotKey/parseSlotKey: an identity that crosses a boundary is carried, not
   * re-derived by string surgery.
   */
  bookingId?: string | null;
};

export type CalendarMode = "public" | "personal";

/** What a surface asks the reader for. Always range-bounded (§60). */
export type CalendarQuery = {
  from: string;
  to: string;
  mode: CalendarMode;
  subject?: string | null;
  /** Qualification or year-group slug — see LEVELS. */
  level?: string | null;
  type?: "all" | "group" | "private";
};

/**
 * The level taxonomy, derived from the data rather than invented.
 *
 * ⚠ THESE ARE THE `qualification` VALUES THE CATALOGUE ACTUALLY USES, plus the
 * year groups 0043 records. §73 forbids deriving a filter from a title string,
 * so anything not in this list is not a level and will not be offered.
 */
export const LEVELS = [
  { slug: "ial-as", label: "IAL AS" },
  { slug: "ial-a2", label: "IAL A2" },
  { slug: "gcse-y11", label: "Year 11" },
  { slug: "gcse-y10", label: "Year 10" },
] as const;

export type LevelSlug = (typeof LEVELS)[number]["slug"];

export function levelLabel(slug: string | null): string | null {
  return LEVELS.find((l) => l.slug === slug)?.label ?? null;
}

export function isLevel(v: unknown): v is LevelSlug {
  return typeof v === "string" && LEVELS.some((l) => l.slug === v);
}

/** Does this event match the active filters? Pure, so it is testable. */
export function matchesFilters(
  ev: CalendarEvent,
  f: { subject?: string | null; level?: string | null; type?: "all" | "group" | "private" },
): boolean {
  if (f.subject && ev.subject !== f.subject) return false;
  if (f.level && ev.qualification !== f.level && ev.yearGroup !== f.level) return false;
  if (f.type === "group" && ev.type !== "group") return false;
  if (f.type === "private" && ev.type === "group") return false;
  return true;
}


/**
 * What to say when the visible window is empty (§12, §57).
 *
 * ============================================================================
 * ⚠ "NOTHING SCHEDULED" IS TRUE AND USELESS IN AUGUST
 * ============================================================================
 * Teaching starts in September, so the homepage calendar opens on an empty
 * month for the whole of the summer — and a conversion section whose first
 * impression is a blank grid saying "try another month" has argued against
 * itself. A parent needs to know that term has not started yet, which is a
 * different fact from "we have nothing on".
 *
 * ⚠ DERIVED FROM THE COHORTS THE PAGE ALREADY LOADED, so it costs no extra
 * query and cannot state a date the catalogue does not hold.
 *
 * ⚠⚠ A START DATE IS NOT A TIMETABLE, AND THE FIRST VERSION OF THIS GOT IT
 * WRONG IN PRODUCTION. It took the earliest future firstClassOn across every
 * cohort and rendered "teaching begins Tue 1 Sept" — from the Y11 and Y10 rows,
 * which carry a nominal starts_on and scheduleSummary NULL. NULL there means
 * exactly one thing, and the Cohort type says it in capitals: there is no
 * public timetable, because those cohorts are demand-triggered and may never
 * run. Announcing a start date for a class with no schedule is the invented
 * timetable the catalogue warns about, told as a date instead of a weekday.
 *
 * The only cohort with a published timetable starts on the 15th, which is also
 * the locked commercial fact. So a cohort qualifies here only when it has BOTH
 * a future first class AND a schedule to teach it on.
 *
 * ⚠ AND IT ONLY SPEAKS ABOUT DATES IN THE FUTURE. Once term has started, "our
 * first class is 15 September" is a stale sentence about the past; the generic
 * message is the honest one then.
 */
export function emptyCalendarMessage(
  cohorts: readonly { firstClassOn: string | null; scheduleSummary: string | null }[],
  todayISO: string,
  formatDate: (iso: string) => string,
  fallback = "No lessons are scheduled in this period.",
): string {
  const upcoming = cohorts
    // ⚠ BOTH CONDITIONS. A date without a timetable is a hope, not a lesson.
    .filter((c) => typeof c.scheduleSummary === "string" && c.scheduleSummary.trim().length > 0)
    .map((c) => c.firstClassOn)
    .filter((d): d is string => typeof d === "string" && d > todayISO)
    .sort();

  if (upcoming.length === 0) return fallback;
  return `Nothing in this period — teaching begins ${formatDate(upcoming[0])}. ` +
    "Look ahead a month, or open the full calendar.";
}
