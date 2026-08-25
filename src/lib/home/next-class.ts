import type { CalendarEvent } from "@/lib/calendar/types";

/**
 * THE NEXT ACTUAL CLASS — NOT THE NEXT CALENDAR ENTRY.
 *
 * ============================================================================
 * ⚠ THE AS COHORT'S FIRST EVENT IS NOT ITS FIRST LESSON.
 * ============================================================================
 * The timetable opens with "Onboarding & diagnostics" on Sunday 13 September;
 * teaching starts Tuesday 15 September. A teaser that sorted by date and took
 * the first row would tell a parent their child's first lesson is on the 13th
 * — and they would arrive expecting to be taught and find a diagnostic.
 *
 * So this filters on `kind`, which is a column on tuition_sessions and now
 * survives onto the event. Matching the title instead ("does it say
 * Onboarding?") would break the first time a session is renamed, and would
 * silently start showing the wrong date rather than failing.
 *
 * ⚠ AND IT RETURNS null RATHER THAN A PLACEHOLDER. If nothing resolves —
 * before term, an unseeded timetable, a failed read — the section renders
 * nothing at all. A fabricated or "example" date on a page a parent is
 * deciding from is worse than an absent one, and this product has already
 * shipped a fake-slot incident once.
 */

/** Session kinds that are a lesson a student attends to be taught. */
const TEACHING_KINDS = new Set(["teaching", "revision", "mock"]);

export function nextClass(
  events: readonly CalendarEvent[],
  now: Date,
): CalendarEvent | null {
  const upcoming = events
    .filter((e) => e.type === "group")
    .filter((e) => e.status === "scheduled")
    /**
     * ⚠ kind must be PRESENT and teaching. A null kind is a non-cohort event
     * (a private slot, a blocked window) and must never be offered as "the
     * next group lesson"; an unknown kind is excluded for the same reason —
     * the safe default when the data does not say is to show nothing.
     */
    .filter((e) => e.kind !== null && TEACHING_KINDS.has(e.kind))
    .filter((e) => e.endsAt.getTime() > now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return upcoming[0] ?? null;
}

/**
 * Exported for the guard: the kinds deliberately excluded.
 *
 * ⚠ onboarding IS A REAL SESSION and belongs on the calendar — it is only
 * wrong as the answer to "when is your first class".
 */
export const NON_TEACHING_KINDS = ["onboarding", "clinic"] as const;
