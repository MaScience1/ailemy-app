import { CANONICAL_TZ, calendarDate, zonedTimeToInstant } from "./timezone.ts";

/**
 * Recurring timetables, one-off sessions, overrides and holidays (§7–§9).
 *
 * ============================================================================
 * ⚠ SIXTY LESSONS ARE NOT SIXTY ROWS
 * ============================================================================
 * A term timetable is a RULE — "every Tuesday and Saturday, 19:00–21:30 Doha,
 * from 15 Sep to 21 May". Materialising it into rows at creation time means
 * every later edit has to find and rewrite them, and "move one Tuesday" becomes
 * a migration. So rules stay rules and are expanded on read.
 *
 * The database then stores only DEPARTURES from the rule:
 *
 *   a moved lesson      an override row for that date carrying new instants
 *   a cancelled lesson  an override row with status 'cancelled'
 *   a clinic or mock    a row with no schedule_id at all — a one-off
 *   a holiday           a break period, which cancels every occurrence inside
 *                       it without touching the rule
 *
 * That is why §8 asks for "recurring schedule + individual session overrides"
 * rather than only recurrence: the two together are the only shape where
 * editing one lesson and editing the series are different acts.
 *
 * ⚠ EVERY FUNCTION HERE IS PURE. No database, no clock, no timezone guessing —
 * `today` is passed in. That is what lets the whole engine be sabotaged in a
 * test suite with no credentials and no network.
 *
 * ⚠ AND IT INVENTS NOTHING. No rules in, no occurrences out. Y11 and Y10 have
 * no published timetable, and this engine returns an empty list for them rather
 * than a plausible one (§11, §12).
 */

/** ISO weekday: Monday = 1 … Sunday = 7, matching Postgres isodow. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAY_NAMES: Record<IsoWeekday, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
  5: "Friday", 6: "Saturday", 7: "Sunday",
};

export type ScheduleRule = {
  id: string;
  cohortId: string;
  weekday: IsoWeekday;
  /** Wall clock in `timezone`, "HH:MM". */
  startTime: string;
  endTime: string;
  timezone: string;
  /** Inclusive "YYYY-MM-DD". */
  validFrom: string;
  /** Inclusive, or null for open-ended. */
  validUntil: string | null;
  label: string | null;
  isActive: boolean;
};

export type SchedulePeriod = {
  id: string;
  /** ⚠ NULL MEANS EVERY COHORT — a school holiday, not one class's break. */
  cohortId: string | null;
  startsOn: string;
  endsOn: string;
  reason: string;
};

export type SessionKind = "teaching" | "onboarding" | "revision" | "mock" | "clinic";
export type SessionStatus = "scheduled" | "cancelled";

/**
 * A departure from the rules — or a session that never had one.
 *
 * `scheduleId` null and status 'scheduled' is a ONE-OFF (onboarding, a clinic).
 * `scheduleId` set is an OVERRIDE of that rule's occurrence on `occursOn`.
 */
export type SessionOverride = {
  id: string;
  cohortId: string;
  scheduleId: string | null;
  /** The date in the rule's own timezone that this row speaks about. */
  occursOn: string;
  status: SessionStatus;
  kind: SessionKind;
  title: string | null;
  /** Required for a one-off or a moved session; ignored for a cancellation. */
  startsAtISO: string | null;
  endsAtISO: string | null;
  timezone: string | null;
  note: string | null;
};

export type Occurrence = {
  cohortId: string;
  /** Date in the canonical/teaching zone. */
  date: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  kind: SessionKind;
  status: SessionStatus;
  title: string | null;
  /** Where this came from, so a surface can label a moved or extra lesson. */
  source: "recurring" | "override" | "one-off";
  /** Set only when status is 'cancelled'. */
  cancelledReason: string | null;
  /** Stable identity for React keys and for matching a session across reads. */
  key: string;
};

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" → a UTC-midnight Date, for date-only arithmetic. */
function dateOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO weekday of a date-only value. getUTCDay: Sunday = 0. */
export function isoWeekdayOf(iso: string): IsoWeekday | null {
  const d = dateOnly(iso);
  if (!d) return null;
  const js = d.getUTCDay();
  return (js === 0 ? 7 : js) as IsoWeekday;
}

/** Inclusive on both ends — a one-day holiday has startsOn === endsOn. */
export function periodCovers(p: SchedulePeriod, iso: string): boolean {
  return iso >= p.startsOn && iso <= p.endsOn;
}

export type ExpandInput = {
  rules: readonly ScheduleRule[];
  periods: readonly SchedulePeriod[];
  overrides: readonly SessionOverride[];
  /** Inclusive window, "YYYY-MM-DD". */
  from: string;
  to: string;
  /**
   * ⚠ CANCELLED SESSIONS ARE RETURNED BY DEFAULT, NOT DROPPED. An admin
   * calendar must show that the 20th is cancelled; a student needs to see it
   * too, or a lesson that vanishes reads as a bug. Public surfaces that only
   * want live lessons filter afterwards — that is a rendering choice, and
   * making it here would take it away from every caller at once.
   */
  includeCancelled?: boolean;
};

/**
 * The whole schedule for a window: rules expanded, holidays applied, overrides
 * layered on, one-offs merged, sorted.
 */
export function expandSchedule(input: ExpandInput): Occurrence[] {
  const { rules, periods, overrides, from, to } = input;
  const includeCancelled = input.includeCancelled ?? true;

  const start = dateOnly(from);
  const end = dateOnly(to);
  if (!start || !end || start > end) return [];

  // Overrides are looked up by the rule occurrence they replace.
  const byRuleDate = new Map<string, SessionOverride>();
  const oneOffs: SessionOverride[] = [];
  for (const o of overrides) {
    if (o.scheduleId === null) oneOffs.push(o);
    else byRuleDate.set(`${o.scheduleId}::${o.occursOn}`, o);
  }

  const out: Occurrence[] = [];

  for (const rule of rules) {
    if (!rule.isActive) continue;

    // Clamp the walk to where the rule and the window actually overlap, so a
    // rule valid for one term is never walked across a five-year query.
    const ruleFrom = rule.validFrom > from ? rule.validFrom : from;
    const ruleTo = rule.validUntil && rule.validUntil < to ? rule.validUntil : to;
    let cursor = dateOnly(ruleFrom);
    const stop = dateOnly(ruleTo);
    if (!cursor || !stop) continue;

    for (; cursor <= stop; cursor = new Date(cursor.getTime() + DAY_MS)) {
      const iso = toISODate(cursor);
      if (isoWeekdayOf(iso) !== rule.weekday) continue;

      const override = byRuleDate.get(`${rule.id}::${iso}`);

      // ⚠ A CANCELLATION WINS OVER EVERYTHING, INCLUDING A MOVE. If an admin
      // moved a lesson and then cancelled it, the lesson is cancelled.
      if (override?.status === "cancelled") {
        if (includeCancelled) {
          out.push(occurrenceFrom(rule, iso, override, "override", "cancelled",
            override.note ?? "Cancelled"));
        }
        continue;
      }

      // Holidays cancel without touching the rule (§9). A cohort-specific
      // period only cancels that cohort; a null cohortId cancels everyone.
      const period = periods.find(
        (p) => (p.cohortId === null || p.cohortId === rule.cohortId) && periodCovers(p, iso),
      );
      if (period && !override) {
        // ⚠ AN EXPLICIT OVERRIDE BEATS A HOLIDAY. Adding a revision clinic
        // during half-term is a real thing an admin does, and the holiday must
        // not silently delete the session they deliberately created for it.
        if (includeCancelled) {
          out.push(occurrenceFrom(rule, iso, null, "recurring", "cancelled", period.reason));
        }
        continue;
      }

      out.push(
        override
          ? occurrenceFrom(rule, iso, override, "override", "scheduled", null)
          : occurrenceFrom(rule, iso, null, "recurring", "scheduled", null),
      );
    }
  }

  // One-offs: onboarding, clinics, mocks — no rule behind them.
  for (const o of oneOffs) {
    if (o.occursOn < from || o.occursOn > to) continue;
    if (o.status === "cancelled" && !includeCancelled) continue;
    const startsAt = o.startsAtISO ? new Date(o.startsAtISO) : null;
    const endsAt = o.endsAtISO ? new Date(o.endsAtISO) : null;
    // ⚠ A ONE-OFF WITH NO TIMES IS DROPPED, NOT GUESSED. There is no rule to
    // inherit from, and a session rendered at midnight is worse than absent.
    if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) continue;

    const tz = o.timezone ?? CANONICAL_TZ;
    out.push({
      cohortId: o.cohortId,
      date: calendarDate(startsAt, tz),
      startsAt, endsAt, timezone: tz,
      kind: o.kind,
      status: o.status,
      title: o.title,
      source: "one-off",
      cancelledReason: o.status === "cancelled" ? o.note ?? "Cancelled" : null,
      key: `one-off::${o.id}`,
    });
  }

  return out.sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.cohortId.localeCompare(b.cohortId),
  );
}

function occurrenceFrom(
  rule: ScheduleRule,
  iso: string,
  override: SessionOverride | null,
  source: Occurrence["source"],
  status: SessionStatus,
  cancelledReason: string | null,
): Occurrence {
  const tz = override?.timezone ?? rule.timezone;

  // A moved lesson carries its own instants; everything else resolves the
  // rule's wall clock on this date, which is what makes DST handle itself.
  const startsAt =
    override?.startsAtISO ? new Date(override.startsAtISO)
      : zonedTimeToInstant(iso, rule.startTime, rule.timezone) ?? new Date(NaN);
  const endsAt =
    override?.endsAtISO ? new Date(override.endsAtISO)
      : zonedTimeToInstant(iso, rule.endTime, rule.timezone) ?? new Date(NaN);

  return {
    cohortId: rule.cohortId,
    date: iso,
    startsAt, endsAt, timezone: tz,
    kind: override?.kind ?? "teaching",
    status,
    title: override?.title ?? rule.label,
    source,
    cancelledReason,
    key: override ? `override::${override.id}` : `rule::${rule.id}::${iso}`,
  };
}

/** The next N live sessions at or after `now`. Cancelled ones are never "next". */
export function nextOccurrences(all: readonly Occurrence[], now: Date, limit: number): Occurrence[] {
  return all
    .filter((o) => o.status === "scheduled" && o.endsAt.getTime() > now.getTime())
    .slice(0, limit);
}
