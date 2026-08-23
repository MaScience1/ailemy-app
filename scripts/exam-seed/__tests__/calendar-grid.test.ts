/**
 * Calendar maths: month/week/year boundaries, overflow, URL state (§90).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/calendar-grid.test.ts
 *
 * ============================================================================
 * ⚠ THE RULE THIS SUITE EXISTS TO PIN
 * ============================================================================
 * A day is a DOHA day, for every viewer. A lesson at 01:00 Asia/Qatar is the
 * previous evening in London, and if the grid bucketed by viewer-local day that
 * lesson would sit on Monday for the teacher and Sunday for the student. The
 * teacher says "Tuesday's lesson"; Tuesday is canonical.
 *
 * No credentials, no network, no clock — every date is passed in.
 */
import {
  parseDate, toISO, addDays, addMonths, isoWeekdayOf, startOfWeek,
  startOfMonth, endOfMonth, sameMonth, monthGrid, weekGrid, rangeFor,
  bucketByDay, cellEvents, readState, stateToQuery, step, periodLabel,
  isView, UPCOMING_DAYS,
} from "../../../src/lib/calendar/grid.ts";
import { zonedTimeToInstant, CANONICAL_TZ } from "../../../src/lib/schedule/timezone.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

console.log("── PARSING REFUSES WHAT IT CANNOT REPRESENT ──");
{
  t("a real date parses", toISO(parseDate("2026-09-15")!) === "2026-09-15");
  // ⚠ Date.UTC ROLLS OVER SILENTLY. 2026-02-31 becomes 3 March, which would
  // render the wrong month rather than being refused.
  t("31 February is refused, not rolled into March", parseDate("2026-02-31") === null);
  t("month 13 is refused", parseDate("2026-13-01") === null);
  t("day 0 is refused", parseDate("2026-09-00") === null);
  t("junk is refused", parseDate("banana") === null && parseDate("") === null);
  t("29 Feb in a leap year is accepted", parseDate("2028-02-29") !== null);
  t("…and refused in a non-leap year", parseDate("2027-02-29") === null);
}

console.log("\n── ISO WEEKDAY: SUNDAY IS 7, NOT 0 ──");
{
  t("2026-09-14 Monday = 1", isoWeekdayOf("2026-09-14") === 1);
  t("2026-09-15 Tuesday = 2", isoWeekdayOf("2026-09-15") === 2);
  t("2026-09-19 Saturday = 6", isoWeekdayOf("2026-09-19") === 6);
  t("2026-09-20 Sunday = 7", isoWeekdayOf("2026-09-20") === 7, isoWeekdayOf("2026-09-20"));
  t("junk is null", isoWeekdayOf("nope") === null);
}

console.log("\n── MONTH ARITHMETIC CLAMPS INSTEAD OF OVERFLOWING ──");
{
  // ⚠ 31 JAN + 1 MONTH. setMonth would give 3 March, so pressing "next month"
  // once would move two.
  t("31 Jan + 1 month = 28 Feb, not 3 Mar", addMonths("2026-01-31", 1) === "2026-02-28", addMonths("2026-01-31", 1));
  t("31 Jan + 1 month in a leap year = 29 Feb", addMonths("2028-01-31", 1) === "2028-02-29", addMonths("2028-01-31", 1));
  t("31 Mar - 1 month = 28 Feb", addMonths("2026-03-31", -1) === "2026-02-28", addMonths("2026-03-31", -1));
  t("15 Sep + 1 month = 15 Oct", addMonths("2026-09-15", 1) === "2026-10-15");
  t("crossing the year forward", addMonths("2026-12-15", 1) === "2027-01-15");
  t("crossing the year backward", addMonths("2026-01-15", -1) === "2025-12-15");
  t("+12 months returns the same day a year on", addMonths("2026-09-15", 12) === "2027-09-15");
}

console.log("\n── WEEK AND MONTH BOUNDARIES ──");
{
  t("startOfWeek on a Monday is itself", startOfWeek("2026-09-14") === "2026-09-14");
  t("startOfWeek on a Sunday goes back six days", startOfWeek("2026-09-20") === "2026-09-14", startOfWeek("2026-09-20"));
  t("startOfWeek crosses a month", startOfWeek("2026-10-01") === "2026-09-28", startOfWeek("2026-10-01"));
  t("startOfWeek crosses a year", startOfWeek("2027-01-01") === "2026-12-28", startOfWeek("2027-01-01"));
  t("startOfMonth", startOfMonth("2026-09-15") === "2026-09-01");
  t("endOfMonth, 30-day", endOfMonth("2026-09-15") === "2026-09-30");
  t("endOfMonth, 31-day", endOfMonth("2026-10-15") === "2026-10-31");
  t("endOfMonth, February", endOfMonth("2026-02-10") === "2026-02-28");
  t("endOfMonth, leap February", endOfMonth("2028-02-10") === "2028-02-29");
  t("endOfMonth, December", endOfMonth("2026-12-10") === "2026-12-31");
  t("sameMonth", sameMonth("2026-09-01", "2026-09-30") && !sameMonth("2026-09-30", "2026-10-01"));
}

console.log("\n── THE MONTH GRID ──");
{
  const sep = monthGrid("2026-09-15");
  t("September 2026 is 5 weeks", sep.length === 5, sep.length);
  t("every week is 7 days", sep.every((w) => w.length === 7));
  t("starts on a Monday", sep[0][0].weekday === 1 && sep[0][0].date === "2026-08-31", sep[0][0]);
  t("…and that Monday is marked out-of-month", sep[0][0].inMonth === false);
  t("1 September is in the first week and in-month",
    sep[0].some((d) => d.date === "2026-09-01" && d.inMonth));
  t("30 September is present and in-month",
    sep.flat().some((d) => d.date === "2026-09-30" && d.inMonth));
  t("in-month days number exactly 30", sep.flat().filter((d) => d.inMonth).length === 30);
  t("days are contiguous with no gaps or repeats", (() => {
    const all = sep.flat().map((d) => d.date);
    return new Set(all).size === all.length && all.every((d, i) => i === 0 || d === addDays(all[i - 1], 1));
  })());

  // ⚠ THE ROW COUNT VARIES AND IS NOT PADDED TO SIX. A fixed six-row grid hangs
  // an empty week under February, which reads as a rendering fault.
  t("February 2026 is 5 weeks", monthGrid("2026-02-10").length === 5, monthGrid("2026-02-10").length);
  t("February 2027 (28 days, starts Monday) is exactly 4",
    monthGrid("2027-02-10").length === 4, monthGrid("2027-02-10").length);
  t("May 2027 needs 6", monthGrid("2027-05-10").length === 6, monthGrid("2027-05-10").length);
  t("in-month count matches month length for a 31-day month",
    monthGrid("2026-10-01").flat().filter((d) => d.inMonth).length === 31);
  t("…and for a leap February", monthGrid("2028-02-01").flat().filter((d) => d.inMonth).length === 29);
  t("junk anchor yields an empty grid, not a crash", monthGrid("nope").length === 0);
}

console.log("\n── THE WEEK GRID ──");
{
  const w = weekGrid("2026-09-17");
  t("7 days", w.length === 7);
  t("Monday first, Sunday last", w[0].date === "2026-09-14" && w[6].date === "2026-09-20", [w[0].date, w[6].date]);
  const cross = weekGrid("2026-12-31");
  t("a week straddling the year is contiguous",
    cross[0].date === "2026-12-28" && cross[6].date === "2027-01-03", [cross[0].date, cross[6].date]);
}

console.log("\n── RANGE FETCHING IS BOUNDED (§60) ──");
{
  const m = rangeFor("month", "2026-09-15");
  t("month range covers the whole grid", m.from === "2026-08-31" && m.to === "2026-10-04", m);
  const wk = rangeFor("week", "2026-09-17");
  t("week range is exactly the week", wk.from === "2026-09-14" && wk.to === "2026-09-20", wk);
  const up = rangeFor("upcoming", "2026-09-15");
  t(`upcoming is bounded to ${UPCOMING_DAYS} days, not open-ended`,
    up.from === "2026-09-15" && up.to === addDays("2026-09-15", UPCOMING_DAYS), up);
  for (const v of ["month", "week", "upcoming"] as const) {
    const r = rangeFor(v, "2026-09-15");
    t(`${v}: from <= to`, r.from <= r.to, r);
  }
}

console.log("\n── BUCKETING IS BY DOHA DAY, FOR EVERY VIEWER ──");
{
  const ev = (iso: string, time: string) => ({ startsAt: zonedTimeToInstant(iso, time, CANONICAL_TZ)! });
  const b = bucketByDay([ev("2026-09-15", "19:00"), ev("2026-09-15", "16:00"), ev("2026-09-19", "19:00")]);
  t("two days bucketed", b.size === 2, [...b.keys()]);
  t("the 15th holds two", b.get("2026-09-15")!.length === 2);
  t("…sorted by start", b.get("2026-09-15")![0].startsAt < b.get("2026-09-15")![1].startsAt);
  t("an empty input yields an empty map", bucketByDay([]).size === 0);

  /**
   * ⚠ THE ASSERTION THE WHOLE FILE HANGS ON. 01:00 on the 16th in Doha is
   * 22:00 on the 15th in London. It must bucket to the 16th — the day the
   * teacher will call it — regardless of who is looking.
   */
  const lateNight = ev("2026-09-16", "01:00");
  t("a 01:00 Doha lesson buckets to the 16th, not the London 15th",
    [...bucketByDay([lateNight]).keys()][0] === "2026-09-16", [...bucketByDay([lateNight]).keys()]);
  t("…and its UTC instant really is the previous day, so the case is real",
    lateNight.startsAt.toISOString().slice(0, 10) === "2026-09-15",
    lateNight.startsAt.toISOString());
}

console.log("\n── \"+N MORE\" NEVER SILENTLY DROPS A LESSON (§6) ──");
{
  const five = [1, 2, 3, 4, 5];
  t("under the limit shows everything", cellEvents(five.slice(0, 2), 3).shown.length === 2);
  t("…and hides nothing", cellEvents(five.slice(0, 2), 3).hidden === 0);
  t("exactly at the limit shows all three", cellEvents(five.slice(0, 3), 3).shown.length === 3);
  t("…and hides nothing", cellEvents(five.slice(0, 3), 3).hidden === 0);
  // ⚠ THE BADGE TAKES A SLOT. Four events with a limit of three shows two plus
  // "+2", not three plus "+1" — otherwise the badge covers the row it replaced.
  const four = cellEvents(five.slice(0, 4), 3);
  t("four with limit three shows 2 and hides 2", four.shown.length === 2 && four.hidden === 2, four);
  const all = cellEvents(five, 3);
  t("five with limit three shows 2 and hides 3", all.shown.length === 2 && all.hidden === 3, all);
  t("shown + hidden always equals the total", (() => {
    for (let n = 0; n <= 8; n++) for (let l = 0; l <= 5; l++) {
      const r = cellEvents(Array.from({ length: n }, (_, i) => i), l);
      if (r.shown.length + r.hidden !== n) return false;
    }
    return true;
  })());
  t("a zero limit hides everything rather than showing a broken cell",
    cellEvents(five, 0).shown.length === 0 && cellEvents(five, 0).hidden === 5);
}

console.log("\n── URL STATE FALLS BACK, NEVER THROWS ──");
{
  const TODAY = "2026-09-15";
  t("empty params default to month/today", (() => {
    const s = readState({}, TODAY);
    return s.view === "month" && s.date === TODAY && s.type === "all" && s.subject === null;
  })());
  t("?date=banana falls back to today, not a 500", readState({ date: "banana" }, TODAY).date === TODAY);
  t("?date=2026-02-31 falls back too", readState({ date: "2026-02-31" }, TODAY).date === TODAY);
  t("?view=galaxy falls back to month", readState({ view: "galaxy" }, TODAY).view === "month");
  t("a real view is kept", readState({ view: "week" }, TODAY).view === "week");
  t("?type=private is kept", readState({ type: "private" }, TODAY).type === "private");
  t("?type=nonsense falls back to all", readState({ type: "nonsense" }, TODAY).type === "all");
  t("blank subject becomes null, not an empty filter",
    readState({ subject: "   " }, TODAY).subject === null);

  t("defaults serialise to a bare path", stateToQuery(readState({}, TODAY), TODAY) === "/calendar");
  const s = readState({ view: "week", date: "2026-10-01", subject: "chemistry", type: "group" }, TODAY);
  const q = stateToQuery(s, TODAY);
  t("non-defaults all appear", q.includes("view=week") && q.includes("date=2026-10-01")
    && q.includes("subject=chemistry") && q.includes("type=group"), q);
  t("round-trips through readState", (() => {
    const back = readState(Object.fromEntries(new URLSearchParams(q.split("?")[1])), TODAY);
    return JSON.stringify(back) === JSON.stringify(s);
  })(), q);
  t("a different base path is honoured",
    stateToQuery(readState({ view: "week" }, TODAY), TODAY, "/profile").startsWith("/profile?"));
  t("isView guards", isView("month") && isView("week") && isView("upcoming") && !isView("year") && !isView(null));
}

console.log("\n── STEPPING AND LABELS ──");
{
  t("month next", step("month", "2026-09-15", 1) === "2026-10-15");
  t("month prev across a year", step("month", "2026-01-15", -1) === "2025-12-15");
  t("week next", step("week", "2026-09-15", 1) === "2026-09-22");
  t("week prev across a month", step("week", "2026-10-01", -1) === "2026-09-24");
  t("upcoming steps by its own window", step("upcoming", "2026-09-15", 1) === addDays("2026-09-15", UPCOMING_DAYS));

  t("month label", periodLabel("month", "2026-09-15") === "September 2026", periodLabel("month", "2026-09-15"));
  t("week inside one month", periodLabel("week", "2026-09-17") === "14–20 Sep 2026", periodLabel("week", "2026-09-17"));
  // A week that straddles must name both sides, or "29–4 Dec" is nonsense.
  t("week across two months names both", periodLabel("week", "2026-10-01") === "28 Sep – 4 Oct 2026", periodLabel("week", "2026-10-01"));
  t("week across the year names both years",
    periodLabel("week", "2026-12-31") === "28 Dec 2026 – 3 Jan 2027", periodLabel("week", "2026-12-31"));
  /**
   * ⚠ THIS ASSERTION CHANGED, AND THE REASON IS THE POINT.
   * It pinned "Next 60 days" — the label to the fetch window, so the heading
   * moved automatically if UPCOMING_DAYS ever did. Sound coupling, wrong
   * thing coupled: the calendar brief's §25/§60 are that a student should
   * never read the size of a query as a page heading. The WINDOW is still
   * UPCOMING_DAYS and still asserted below; only its name is now the reader's.
   */
  t("upcoming label names the task, not the query window",
    periodLabel("upcoming", "2026-09-15") === "Upcoming tuition",
    periodLabel("upcoming", "2026-09-15"));
  t("⚠ and the window itself is untouched at 60 days", UPCOMING_DAYS === 60);
  t("junk date gives an empty label rather than 'Invalid Date'", periodLabel("month", "nope") === "");
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
