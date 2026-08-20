import type { ScheduleRule, SchedulePeriod, SessionOverride } from "./recurrence.ts";
import { CANONICAL_TZ } from "./timezone.ts";

/**
 * The timetable as it actually stands, for when the database has none.
 *
 * ============================================================================
 * ⚠ ONE COHORT HAS A PUBLISHED TIMETABLE. TWO DO NOT, AND MUST NOT.
 * ============================================================================
 * §10 fixes the AS timetable and it is transcribed here verbatim. §11 and §12
 * are explicit that Year 11 and Year 10 have NO published days or times until
 * the founder creates them in Admin — so there are no rules for them here, and
 * the engine returns an empty list rather than a plausible one. An invented
 * "Mon + Wed" would be a promise nobody made, on the page a parent decides
 * from.
 *
 * ⚠ ONBOARDING IS DELIBERATELY NOT A SESSION HERE. §10 gives its DATE — Sunday
 * 13 September 2026 — and no time. The recurrence engine drops a one-off with
 * no times rather than rendering it at midnight, and this file does not supply
 * an hour nobody has decided. The date still shows on the cohort card, which is
 * where it came from; it becomes a calendar session the moment an admin gives
 * it a time.
 *
 * ⚠ THIS IS A FALLBACK, NOT A SEED. Nothing here is written to the database.
 * When 0044 is applied and the founder creates the same timetable in Admin, the
 * reader prefers the database and this stops being consulted.
 */

/** The AS cohort's slug, which is how the fallback is matched to a cohort row. */
export const AS_COHORT_SLUG = "ial-chemistry-as-sep-2026";

/**
 * §7 and §10: every Tuesday and Saturday, 19:00–21:30 Doha, 15 Sep 2026 to
 * 21 May 2027. Two hours of teaching plus a short break inside each session —
 * that is described on the card and is not a separate calendar event.
 */
export function fallbackRules(cohortId: string): ScheduleRule[] {
  const base = {
    cohortId,
    startTime: "19:00",
    endTime: "21:30",
    timezone: CANONICAL_TZ,
    validFrom: "2026-09-15",
    validUntil: "2027-05-21",
    label: null,
    isActive: true,
  };
  return [
    { ...base, id: `fallback-${cohortId}-tue`, weekday: 2 },
    { ...base, id: `fallback-${cohortId}-sat`, weekday: 6 },
  ];
}

/** No holidays are published. An empty list, not a guessed Christmas break. */
export const FALLBACK_PERIODS: readonly SchedulePeriod[] = [];

/** No overrides, and no timed onboarding. See the header. */
export const FALLBACK_OVERRIDES: readonly SessionOverride[] = [];
