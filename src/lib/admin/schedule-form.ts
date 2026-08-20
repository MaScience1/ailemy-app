// ⚠ RELATIVE, WITH THE .ts EXTENSION. Node 26 strips types but resolves ESM
// specifiers literally, so a test running this file under plain `node` cannot
// follow the "@/" alias or an extensionless path. Same convention as the rest
// of the modules the suite imports.
import { canonicalTimeZone, tzError, zonedTimeToInstant, CANONICAL_TZ } from "../schedule/timezone.ts";
import type { IsoWeekday, SessionKind } from "../schedule/recurrence.ts";

/**
 * What a valid timetable edit is — decided once, without a database.
 *
 * ⚠ EVERY RULE HERE IS ALSO A CONSTRAINT IN 0044. Expressing them in the app
 * means an admin sees a sentence instead of a 23514, and a test can prove each
 * one with no credentials. The database is still the enforcement: if these ever
 * disagree the database wins and the admin gets an ugly error, which is the
 * correct failure direction and why none of this justifies dropping a CHECK.
 */

export const WEEKDAY_OPTIONS: { value: IsoWeekday; label: string }[] = [
  { value: 1, label: "Monday" }, { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" }, { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

export const SESSION_KINDS: SessionKind[] = ["teaching", "onboarding", "revision", "mock", "clinic"];

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const str = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const orNull = (fd: FormData, k: string): string | null => str(fd, k) || null;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type RuleInput = {
  cohortId: string;
  weekday: IsoWeekday;
  startTime: string;
  endTime: string;
  timezone: string;
  validFrom: string;
  validUntil: string | null;
  label: string | null;
  isActive: boolean;
};

export function readRuleForm(fd: FormData): Validated<RuleInput> {
  const cohortId = str(fd, "cohort_id");
  if (!cohortId) return { ok: false, error: "Choose a cohort." };

  const weekday = Number(str(fd, "weekday"));
  // ⚠ ISO, Monday = 1 … Sunday = 7. A 0 here is the JS convention leaking in,
  // and would store a Sunday rule that the reader never matches.
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return { ok: false, error: "Weekday must be Monday–Sunday." };
  }

  const startTime = str(fd, "start_time").slice(0, 5);
  const endTime = str(fd, "end_time").slice(0, 5);
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return { ok: false, error: "Times must be in 24-hour HH:MM form." };
  }
  // Mirrors cohort_schedules_time_ordered. A backwards lesson renders as
  // negative-length and sorts wrongly — "the calendar is broken", not a typo.
  if (endTime <= startTime) return { ok: false, error: "The lesson must end after it starts." };

  const timezoneRaw = str(fd, "timezone") || CANONICAL_TZ;
  /**
   * ⚠ VALIDATED AND CANONICALISED, NOT TRUSTED. A typo'd zone is stored happily
   * by Postgres and throws at render time. Worse, an ABBREVIATION does not
   * throw at all: "BST" is accepted by Intl and silently means Asia/Dhaka, so
   * this rule would expand into lesson instants five hours from where the
   * admin meant. canonicalTimeZone requires Region/City for exactly that.
   */
  const timezone = canonicalTimeZone(timezoneRaw);
  if (!timezone) return { ok: false, error: tzError(timezoneRaw) };

  const validFrom = str(fd, "valid_from");
  if (!DATE_RE.test(validFrom)) return { ok: false, error: "Give a start date for the timetable." };
  const validUntil = orNull(fd, "valid_until");
  if (validUntil !== null && !DATE_RE.test(validUntil)) return { ok: false, error: "End date is not a date." };
  if (validUntil !== null && validUntil < validFrom) {
    return { ok: false, error: "The timetable cannot end before it starts." };
  }

  return {
    ok: true,
    value: {
      cohortId, weekday: weekday as IsoWeekday, startTime, endTime, timezone,
      validFrom, validUntil, label: orNull(fd, "label"),
      isActive: fd.get("is_active") !== null,
    },
  };
}

export type PeriodInput = {
  cohortId: string | null;
  startsOn: string;
  endsOn: string;
  reason: string;
};

export function readPeriodForm(fd: FormData): Validated<PeriodInput> {
  const startsOn = str(fd, "starts_on");
  const endsOn = str(fd, "ends_on");
  if (!DATE_RE.test(startsOn) || !DATE_RE.test(endsOn)) {
    return { ok: false, error: "Give both dates." };
  }
  if (endsOn < startsOn) return { ok: false, error: "The break cannot end before it starts." };
  const reason = str(fd, "reason");
  if (!reason) return { ok: false, error: "Say why — it is shown on the public calendar in place of the lesson." };
  // ⚠ EMPTY cohort_id MEANS EVERY COHORT, and that is a school closure. It is
  // a deliberate choice in the form, not a missing value.
  return { ok: true, value: { cohortId: orNull(fd, "cohort_id"), startsOn, endsOn, reason } };
}

export type SessionInput = {
  cohortId: string;
  scheduleId: string | null;
  occursOn: string;
  status: "scheduled" | "cancelled";
  kind: SessionKind;
  title: string | null;
  startsAtISO: string | null;
  endsAtISO: string | null;
  timezone: string | null;
  note: string | null;
};

/**
 * An override or a one-off.
 *
 * ⚠ A ONE-OFF WITHOUT TIMES IS REFUSED. It has no rule to inherit from, so it
 * would render at midnight or be dropped by the reader — either way the admin
 * created something that does not appear. A CANCELLED one is exempt: cancelling
 * a thing is not the moment to demand its hours.
 */
export function readSessionForm(fd: FormData): Validated<SessionInput> {
  const cohortId = str(fd, "cohort_id");
  if (!cohortId) return { ok: false, error: "Choose a cohort." };

  const occursOn = str(fd, "occurs_on");
  if (!DATE_RE.test(occursOn)) return { ok: false, error: "Give the date this applies to." };

  const status = str(fd, "status") === "cancelled" ? "cancelled" : "scheduled";
  const kindRaw = str(fd, "kind") || "teaching";
  if (!SESSION_KINDS.includes(kindRaw as SessionKind)) {
    return { ok: false, error: `Kind must be one of ${SESSION_KINDS.join(", ")}.` };
  }

  const scheduleId = orNull(fd, "schedule_id");
  const timezoneRaw = str(fd, "timezone") || CANONICAL_TZ;
  const timezone = canonicalTimeZone(timezoneRaw);
  if (!timezone) return { ok: false, error: tzError(timezoneRaw) };

  const startLocal = orNull(fd, "starts_at_local");
  const endLocal = orNull(fd, "ends_at_local");
  const needsTimes = scheduleId === null && status === "scheduled";

  if (needsTimes && (!startLocal || !endLocal)) {
    return { ok: false, error: "A one-off session needs a start and an end — there is no timetable for it to follow." };
  }

  let startsAtISO: string | null = null;
  let endsAtISO: string | null = null;
  if (startLocal && endLocal) {
    // ⚠ RESOLVED THROUGH THE NAMED ZONE, NOT THE SERVER'S. The admin types a
    // wall clock; which instant that is depends on the zone they chose.
    startsAtISO = localToISO(occursOn, startLocal, timezone);
    endsAtISO = localToISO(occursOn, endLocal, timezone);
    if (!startsAtISO || !endsAtISO) return { ok: false, error: "Times must be in 24-hour HH:MM form." };
    if (endsAtISO <= startsAtISO) return { ok: false, error: "The session must end after it starts." };
  }

  return {
    ok: true,
    value: {
      cohortId, scheduleId, occursOn, status, kind: kindRaw as SessionKind,
      title: orNull(fd, "title"), startsAtISO, endsAtISO,
      timezone, note: orNull(fd, "note"),
    },
  };
}

/**
 * Shared with the reader: a wall clock plus a zone becomes a real instant.
 *
 * ⚠ THIS WAS A require() CALL, WHICH WOULD HAVE THROWN AT RUNTIME. There is no
 * dependency cycle to work around — timezone.ts imports nothing from here — so
 * the lazy import bought nothing and broke ESM. Plain top-level import.
 */
function localToISO(dateISO: string, timeHHMM: string, tz: string): string | null {
  if (!TIME_RE.test(timeHHMM.slice(0, 5))) return null;
  const d = zonedTimeToInstant(dateISO, timeHHMM.slice(0, 5), tz);
  return d ? d.toISOString() : null;
}
