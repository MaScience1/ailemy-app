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
