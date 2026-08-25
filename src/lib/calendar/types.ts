import type { Cohort } from "../public/catalogue.ts";
import type { SessionKind } from "@/lib/schedule/recurrence";

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
  | "private_booked"
  /**
   * A period the teacher is unavailable — an availability_blocks ROW.
   *
   * ⚠ IT IS NEVER COMPUTED. Prayer blocks in particular reach the calendar the
   * same way every other block does: somebody entered a row. Nothing in this
   * codebase calculates a prayer time, and the day one does, it will be wrong
   * for half the year in a way nobody notices.
   *
   * ⚠ AND IT CARRIES NO REASON IN PUBLIC MODE. 0045 grants anon SELECT on
   * (id, teacher_id, starts_at, ends_at) ONLY — `reason` is withheld on
   * purpose, because why a teacher is unavailable is their business. So a
   * public block says "Unavailable" and nothing more; the reason is surfaced
   * only where the viewer may legitimately read it.
   */
  | "blocked";

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
  /**
   * ⚠ WHAT KIND OF SESSION THIS IS — teaching, onboarding, revision, mock or
   * clinic. Carried because "the next lesson" is not the next EVENT: the AS
   * cohort's first calendar entry is "Onboarding & diagnostics" on Sun 13 Sep,
   * and the first CLASS is Tue 15 Sep. A teaser that said 13 September would be
   * telling a parent their child's first lesson is a diagnostic session.
   *
   * The schedule layer has always had this on Occurrence; it was dropped here,
   * so every consumer downstream had to guess from the title. Null only for
   * events that are not cohort sessions at all.
   */
  kind: SessionKind | null;

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
  /** §11 — hide anything the student cannot act on. */
  availableOnly?: boolean;
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

/**
 * cohorts.year_group holds a LABEL; LEVELS holds a SLUG. This bridges them.
 *
 * ============================================================================
 * ⚠ TWO VOCABULARIES THAT LOOK LIKE ONE, WHICH IS WHY THE FILTER WAS DEAD
 * ============================================================================
 * 0054's CHECK constrains year_group to 'Year 9'…'Year 13' — human labels. The
 * level filter's slugs are 'gcse-y11' and 'gcse-y10'. matchesFilters compares
 * `ev.yearGroup !== f.level`, so even once the column is wired through, "Year
 * 11" would never equal "gcse-y11" and the Year 10 and Year 11 filter options
 * would still silently match nothing.
 *
 * ⚠ THE MAPPING LIVES HERE, NOT IN A COMPONENT, and it returns null for a year
 * group with no filter option rather than inventing a slug. 'Year 9', 'Year 12'
 * and 'Year 13' are all valid in the database and none of them is offered as a
 * filter — a cohort in one of those is simply not matched by any level, which
 * is correct and is not the same as being matched by all of them.
 */
const YEAR_GROUP_TO_LEVEL: Record<string, LevelSlug> = {
  "Year 11": "gcse-y11",
  "Year 10": "gcse-y10",
};

export function levelForYearGroup(yearGroup: string | null | undefined): LevelSlug | null {
  if (!yearGroup) return null;
  return YEAR_GROUP_TO_LEVEL[yearGroup.trim()] ?? null;
}

/** Does this event match the active filters? Pure, so it is testable. */
export function matchesFilters(
  ev: CalendarEvent,
  f: {
    subject?: string | null;
    level?: string | null;
    type?: "all" | "group" | "private";
    /** §11 — only what the student can act on right now. */
    availableOnly?: boolean;
  },
): boolean {
  if (f.subject && ev.subject !== f.subject) return false;
  if (f.level && ev.qualification !== f.level && ev.yearGroup !== f.level) return false;
  if (f.type === "group" && ev.type !== "group") return false;
  if (f.type === "private" && ev.type === "group") return false;

  /**
   * ⚠ §11 — AND "AVAILABLE" MEANS ACTIONABLE, NOT "EXISTS".
   * A cancelled lesson is not available. A full cohort is not available. A
   * 1-to-1 slot nobody can pay for is not available either — `bookable` is
   * already the reader's AND of Stripe keys, a real price and an open slot,
   * so this reuses that judgement rather than forming a second opinion.
   *
   * ⚠ THE VIEWER'S OWN BOOKING SURVIVES THE FILTER. It is not something to
   * book, but hiding a student's own confirmed lesson from a calendar they
   * filtered to "available" would read as a cancellation.
   */
  if (f.availableOnly) {
    if (ev.status === "cancelled") return false;
    if (ev.type === "group" && ev.cohort && ev.cohort.status === "full") return false;
    if (ev.type === "private_open" && ev.bookable === false) return false;
  }
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
