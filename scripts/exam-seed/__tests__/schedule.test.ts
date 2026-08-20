/**
 * The schedule core: recurrence, overrides, holidays and two clocks (§7–§9, §44).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/schedule.test.ts
 *
 * ============================================================================
 * ⚠ NO CREDENTIALS, NO NETWORK, NO CLOCK
 * ============================================================================
 * Everything asserted here is pure — `now` is passed in, offsets come from the
 * platform's IANA data, and the AS timetable is DERIVED from fallback.ts rather
 * than retyped, so a change to the published timetable cannot leave a
 * hand-written expectation here pinning last term's (AGENTS.md).
 */
import {
  expandSchedule, nextOccurrences, isoWeekdayOf, periodCovers,
  type ScheduleRule, type SchedulePeriod, type SessionOverride,
} from "../../../src/lib/schedule/recurrence.ts";
import {
  zonedTimeToInstant, zoneOffsetMinutes, dualTime, formatTime, calendarDate,
  isKnownTimeZone, CANONICAL_TZ,
} from "../../../src/lib/schedule/timezone.ts";
import { fallbackRules, FALLBACK_PERIODS, FALLBACK_OVERRIDES, AS_COHORT_SLUG } from "../../../src/lib/schedule/fallback.ts";
import { FALLBACK_COHORTS } from "../../../src/lib/public/catalogue.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const COHORT = AS_COHORT_SLUG;
const RULES = fallbackRules(COHORT);
const expand = (o: Partial<Parameters<typeof expandSchedule>[0]> = {}) =>
  expandSchedule({
    rules: RULES, periods: [], overrides: [],
    from: "2026-09-14", to: "2026-09-30", ...o,
  });

console.log("── THE PUBLISHED TIMETABLE IS THE ONE IN THE CATALOGUE ──");
{
  // ⚠ DERIVED, NOT RETYPED. If §10's timetable ever changes, this fails loudly
  // and names the number rather than silently pinning the old one.
  const as = FALLBACK_COHORTS.find((c) => c.slug === AS_COHORT_SLUG)!;
  t("the AS cohort exists in the catalogue", Boolean(as));
  t("two rules — Tuesday and Saturday", RULES.length === 2, RULES.map((r) => r.weekday));
  t("Tuesday is ISO 2, Saturday is ISO 6",
    RULES.map((r) => r.weekday).sort().join() === "2,6", RULES.map((r) => r.weekday));
  t("19:00–21:30", RULES.every((r) => r.startTime === "19:00" && r.endTime === "21:30"));
  t("in the canonical zone", RULES.every((r) => r.timezone === CANONICAL_TZ));
  t("the card's schedule sentence agrees with the rules",
    /Tuesday \+ Saturday/.test(as.scheduleSummary ?? "") && /7:00–9:30 PM Doha/.test(as.scheduleSummary ?? ""),
    as.scheduleSummary);
  t("no holidays and no overrides are invented",
    FALLBACK_PERIODS.length === 0 && FALLBACK_OVERRIDES.length === 0);
}

console.log("\n── Y11 AND Y10 PUBLISH NOTHING (§11, §12) ──");
{
  // ⚠ THE RULE THIS ENGINE EXISTS TO NOT BREAK. No rules in, no lessons out.
  t("no rules produces no occurrences", expand({ rules: [] }).length === 0);
  t("…even across a whole year",
    expandSchedule({ rules: [], periods: [], overrides: [], from: "2026-01-01", to: "2026-12-31" }).length === 0);
  for (const slug of ["igcse-chemistry-y11", "igcse-chemistry-y10"]) {
    const c = FALLBACK_COHORTS.find((x) => x.slug === slug)!;
    t(`${slug} publishes no schedule sentence`, c.scheduleSummary === null, c.scheduleSummary);
  }
}

console.log("\n── EXPANSION ──");
{
  const occ = expand();
  const dates = occ.map((o) => o.date);
  // 15, 19, 22, 26, 29 Sep 2026 — Tue/Sat inside 14–30 Sep, starting 15 Sep.
  t("expands to the right dates", dates.join() === "2026-09-15,2026-09-19,2026-09-22,2026-09-26,2026-09-29", dates);
  t("nothing before valid_from", occ.every((o) => o.date >= "2026-09-15"));
  t("every occurrence is scheduled", occ.every((o) => o.status === "scheduled"));
  t("…and sourced as recurring", occ.every((o) => o.source === "recurring"));
  t("sorted ascending", occ.every((o, i) => i === 0 || occ[i - 1].startsAt <= o.startsAt));
  t("keys are unique", new Set(occ.map((o) => o.key)).size === occ.length);
  t("each is 2.5 hours", occ.every((o) => o.endsAt.getTime() - o.startsAt.getTime() === 2.5 * 3600_000));

  t("valid_until is respected",
    expandSchedule({ rules: RULES, periods: [], overrides: [], from: "2027-05-01", to: "2027-06-30" })
      .every((o) => o.date <= "2027-05-21"));
  t("an inactive rule produces nothing",
    expand({ rules: RULES.map((r) => ({ ...r, isActive: false })) }).length === 0);
}

console.log("\n── ONE LESSON MOVES WITHOUT MOVING THE SERIES (§8) ──");
{
  const tue = RULES.find((r) => r.weekday === 2)!;
  const moved: SessionOverride = {
    id: "ov1", cohortId: COHORT, scheduleId: tue.id, occursOn: "2026-09-15",
    status: "scheduled", kind: "teaching", title: "Moved to Wednesday",
    startsAtISO: "2026-09-16T16:00:00.000Z", endsAtISO: "2026-09-16T18:30:00.000Z",
    timezone: null, note: null,
  };
  const occ = expand({ overrides: [moved] });
  t("the series is unchanged in length", occ.length === 5, occ.length);
  const it = occ.find((o) => o.key === "override::ov1")!;
  t("the moved lesson carries its own instants",
    it.startsAt.toISOString() === "2026-09-16T16:00:00.000Z", it.startsAt.toISOString());
  t("…and is labelled as an override", it.source === "override");
  t("…and keeps its title", it.title === "Moved to Wednesday");
  t("every OTHER Tuesday is untouched",
    occ.filter((o) => o.source === "recurring").length === 4);
}

console.log("\n── CANCELLING ONE LESSON ──");
{
  const tue = RULES.find((r) => r.weekday === 2)!;
  const cancel: SessionOverride = {
    id: "ov2", cohortId: COHORT, scheduleId: tue.id, occursOn: "2026-09-22",
    status: "cancelled", kind: "teaching", title: null,
    startsAtISO: null, endsAtISO: null, timezone: null, note: "Teacher unavailable",
  };
  const shown = expand({ overrides: [cancel] });
  const hit = shown.find((o) => o.date === "2026-09-22")!;
  t("a cancelled lesson is still RETURNED by default", Boolean(hit));
  t("…marked cancelled", hit.status === "cancelled");
  t("…carrying the reason", hit.cancelledReason === "Teacher unavailable", hit.cancelledReason);
  const hidden = expand({ overrides: [cancel], includeCancelled: false });
  t("…and omitted when the caller asks for live sessions only",
    hidden.every((o) => o.date !== "2026-09-22"), hidden.map((o) => o.date));
  t("the rest of the series survives", hidden.length === 4, hidden.length);
}

console.log("\n── HOLIDAYS (§9) ──");
{
  const holiday: SchedulePeriod = {
    id: "p1", cohortId: null, startsOn: "2026-09-18", endsOn: "2026-09-23", reason: "Autumn break",
  };
  const occ = expand({ periods: [holiday] });
  const inside = occ.filter((o) => o.date >= "2026-09-18" && o.date <= "2026-09-23");
  t("lessons inside a break are cancelled, not deleted", inside.length === 2, inside.length);
  t("…with the break's reason", inside.every((o) => o.cancelledReason === "Autumn break"));
  t("…and the rule itself is untouched",
    occ.filter((o) => o.status === "scheduled").length === 3);
  t("a period is inclusive on both ends",
    periodCovers(holiday, "2026-09-18") && periodCovers(holiday, "2026-09-23") &&
    !periodCovers(holiday, "2026-09-17") && !periodCovers(holiday, "2026-09-24"));

  // ⚠ A COHORT-SPECIFIC BREAK MUST NOT PAUSE ANOTHER CLASS.
  const other: SchedulePeriod = { ...holiday, id: "p2", cohortId: "some-other-cohort" };
  t("a break for another cohort cancels nothing here",
    expand({ periods: [other] }).every((o) => o.status === "scheduled"));

  // ⚠ AN EXPLICIT SESSION BEATS A HOLIDAY. Adding a clinic during half-term is
  // a real thing an admin does; the break must not silently delete it.
  const tue = RULES.find((r) => r.weekday === 2)!;
  const clinic: SessionOverride = {
    id: "ov3", cohortId: COHORT, scheduleId: tue.id, occursOn: "2026-09-22",
    status: "scheduled", kind: "revision", title: "Revision clinic",
    startsAtISO: "2026-09-22T16:00:00.000Z", endsAtISO: "2026-09-22T17:00:00.000Z",
    timezone: null, note: null,
  };
  const kept = expand({ periods: [holiday], overrides: [clinic] }).find((o) => o.date === "2026-09-22")!;
  t("a deliberate session inside a break survives it", kept.status === "scheduled", kept.status);
  t("…and keeps its kind", kept.kind === "revision");
}

console.log("\n── A CANCELLATION BEATS A MOVE ──");
{
  const tue = RULES.find((r) => r.weekday === 2)!;
  const both: SessionOverride = {
    id: "ov4", cohortId: COHORT, scheduleId: tue.id, occursOn: "2026-09-15",
    status: "cancelled", kind: "teaching", title: "was moved",
    startsAtISO: "2026-09-16T16:00:00.000Z", endsAtISO: "2026-09-16T18:30:00.000Z",
    timezone: null, note: "Called off",
  };
  const hit = expand({ overrides: [both] }).find((o) => o.key === "override::ov4")!;
  t("a moved-then-cancelled lesson is cancelled", hit.status === "cancelled", hit.status);
}

console.log("\n── ONE-OFFS ──");
{
  const clinic: SessionOverride = {
    id: "of1", cohortId: COHORT, scheduleId: null, occursOn: "2026-09-20",
    status: "scheduled", kind: "clinic", title: "Drop-in clinic",
    startsAtISO: "2026-09-20T13:00:00.000Z", endsAtISO: "2026-09-20T14:00:00.000Z",
    timezone: null, note: null,
  };
  const occ = expand({ overrides: [clinic] });
  t("a one-off is added to the series", occ.length === 6, occ.length);
  const it = occ.find((o) => o.source === "one-off")!;
  t("…labelled one-off", Boolean(it) && it.kind === "clinic");
  t("…and sorted into place by instant",
    occ.findIndex((o) => o.source === "one-off") === 2, occ.map((o) => o.date));

  // ⚠ THE ONBOARDING CASE. §10 gives a DATE and no time. A session rendered at
  // midnight is worse than one that is absent until an admin sets the hour.
  const untimed: SessionOverride = { ...clinic, id: "of2", startsAtISO: null, endsAtISO: null };
  t("a one-off with no times is DROPPED, never rendered at midnight",
    expand({ overrides: [untimed] }).length === 5);
  const bad: SessionOverride = { ...clinic, id: "of3", startsAtISO: "not-a-date" };
  t("…and an unparseable instant is dropped too", expand({ overrides: [bad] }).length === 5);
  t("a one-off outside the window is not returned",
    expand({ overrides: [{ ...clinic, id: "of4", occursOn: "2027-01-01" }] }).length === 5);
}

console.log("\n── TIMEZONE: NO OFFSET IS EVER HARDCODED (§44) ──");
{
  // Asia/Qatar is UTC+3 and has no DST — asserted, not assumed.
  const sep = zonedTimeToInstant("2026-09-15", "19:00", "Asia/Qatar")!;
  t("Doha 19:00 on 15 Sep is 16:00Z", sep.toISOString() === "2026-09-15T16:00:00.000Z", sep.toISOString());
  const jan = zonedTimeToInstant("2027-01-15", "19:00", "Asia/Qatar")!;
  t("…and 19:00 in January is 16:00Z too — no DST in Doha", jan.toISOString() === "2027-01-15T16:00:00.000Z", jan.toISOString());

  // ⚠ THE BST → GMT CASE THE SPEC NAMES. Same wall clock in Doha, and the
  // London rendering must move by an hour on its own.
  const summer = zonedTimeToInstant("2026-09-15", "19:00", CANONICAL_TZ)!;
  const winter = zonedTimeToInstant("2026-12-15", "19:00", CANONICAL_TZ)!;
  t("London reads 17:00 for a September lesson", formatTime(summer, "Europe/London") === "5:00 PM", formatTime(summer, "Europe/London"));
  t("…and 16:00 for a December one, with no code change", formatTime(winter, "Europe/London") === "4:00 PM", formatTime(winter, "Europe/London"));
  t("Doha reads 7:00 PM for both",
    formatTime(summer, CANONICAL_TZ) === "7:00 PM" && formatTime(winter, CANONICAL_TZ) === "7:00 PM");

  t("the offset is asked for per instant, not stored",
    zoneOffsetMinutes(summer, "Europe/London") === 60 && zoneOffsetMinutes(winter, "Europe/London") === 0,
    [zoneOffsetMinutes(summer, "Europe/London"), zoneOffsetMinutes(winter, "Europe/London")]);
  t("Doha is +180 in both", zoneOffsetMinutes(summer, CANONICAL_TZ) === 180 && zoneOffsetMinutes(winter, CANONICAL_TZ) === 180);

  // A lesson scheduled ON a DST changeover, in a zone that has one.
  const uk = zonedTimeToInstant("2026-10-25", "19:00", "Europe/London")!;
  t("a wall clock on the UK changeover day still resolves to 19:00 local",
    formatTime(uk, "Europe/London") === "7:00 PM", formatTime(uk, "Europe/London"));

  t("midnight does not roll a day (the ICU '24' trap)",
    calendarDate(zonedTimeToInstant("2026-09-15", "00:00", CANONICAL_TZ)!, CANONICAL_TZ) === "2026-09-15");
  t("junk input is null, never Invalid Date",
    zonedTimeToInstant("nope", "19:00", CANONICAL_TZ) === null &&
    zonedTimeToInstant("2026-09-15", "nope", CANONICAL_TZ) === null);
}

console.log("\n── DUAL DISPLAY (§44, §45) ──");
{
  const i = zonedTimeToInstant("2026-09-15", "19:00", CANONICAL_TZ)!;
  const london = dualTime(i, "Europe/London");
  t("Doha time is always present", london.canonical === "7:00 PM" && london.canonicalLabel === "Doha");
  t("…with the viewer's beside it", london.viewer === "5:00 PM" && london.viewerLabel === "London", london);
  const doha = dualTime(i, "Asia/Qatar");
  t("a viewer already in Doha gets no duplicate", doha.viewer === null, doha);
  const unknown = dualTime(i, null);
  t("an unknown zone shows the canonical time alone", unknown.viewer === null);
  const junk = dualTime(i, "Not/AZone");
  t("a junk zone does not crash, and shows the canonical alone", junk.viewer === null, junk);
  t("isKnownTimeZone accepts real zones and rejects junk",
    isKnownTimeZone("Europe/London") && isKnownTimeZone("Asia/Qatar") &&
    !isKnownTimeZone("Not/AZone") && !isKnownTimeZone("") && !isKnownTimeZone(null));
}

console.log("\n── ISO WEEKDAY, THE OFF-BY-ONE THAT TEACHES ON THE WRONG DAY ──");
{
  t("2026-09-14 is Monday = 1", isoWeekdayOf("2026-09-14") === 1);
  t("2026-09-15 is Tuesday = 2", isoWeekdayOf("2026-09-15") === 2);
  t("2026-09-19 is Saturday = 6", isoWeekdayOf("2026-09-19") === 6);
  t("2026-09-20 is Sunday = 7, NOT 0", isoWeekdayOf("2026-09-20") === 7, isoWeekdayOf("2026-09-20"));
  t("junk is null", isoWeekdayOf("nope") === null);
}

console.log("\n── NEXT SESSIONS ──");
{
  const occ = expand();
  const now = new Date("2026-09-20T00:00:00Z");
  const next = nextOccurrences(occ, now, 2);
  t("returns the next two after now", next.map((o) => o.date).join() === "2026-09-22,2026-09-26", next.map((o) => o.date));
  const tue = RULES.find((r) => r.weekday === 2)!;
  const withCancel = expand({ overrides: [{
    id: "c", cohortId: COHORT, scheduleId: tue.id, occursOn: "2026-09-22",
    status: "cancelled", kind: "teaching", title: null,
    startsAtISO: null, endsAtISO: null, timezone: null, note: null,
  }] });
  t("a cancelled lesson is never 'next'",
    nextOccurrences(withCancel, now, 1)[0].date === "2026-09-26",
    nextOccurrences(withCancel, now, 1)[0].date);
  t("a lesson in progress still counts as next",
    nextOccurrences(occ, new Date("2026-09-22T17:00:00Z"), 1)[0].date === "2026-09-22");
}

console.log("\n── DEGENERATE WINDOWS ──");
{
  t("an inverted window returns nothing", expand({ from: "2026-09-30", to: "2026-09-01" }).length === 0);
  t("junk dates return nothing", expand({ from: "nope", to: "2026-09-30" }).length === 0);
  t("a single-day window works", expand({ from: "2026-09-15", to: "2026-09-15" }).length === 1);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
