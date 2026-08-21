/**
 * The week timetable's hour axis must fit the lessons, not the other way round.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/hour-grid.test.ts
 *
 * ============================================================================
 * ⚠ TWO OPPOSITE FAILURES, AND A FIXED AXIS COMMITS ONE OF THEM ALWAYS
 * ============================================================================
 * Ailemy teaches 7:00–9:30 PM Doha. A fixed 06:00–22:00 axis is sixteen rows of
 * empty to show two of content — the "looks like nothing is happening" failure
 * §63 is about, in a different view. A fixed 18:00–22:00 axis silently CROPS a
 * morning mock the day somebody schedules one, and a cropped session is worse
 * than an ugly grid because nothing says it is missing.
 *
 * So the window is derived, and both failure modes are asserted.
 */
import {
  hourWindow, hourRows, hourSpan, hourLabel,
  DEFAULT_HOUR_FROM, DEFAULT_HOUR_TO, MIN_HOUR_SPAN,
} from "../../../src/lib/calendar/grid.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

/** Canonical-zone hour. The fixtures are built in UTC, so UTC hours are it. */
const hourOf = (d: Date) => d.getUTCHours();
const ev = (startISO: string, mins: number) => ({
  startsAt: new Date(startISO),
  endsAt: new Date(new Date(startISO).getTime() + mins * 60_000),
});

console.log("\n=== 1. an empty week falls back to a sane evening window ===");
{
  const w = hourWindow([], hourOf);
  t("uses the documented default", w.from === DEFAULT_HOUR_FROM && w.to === DEFAULT_HOUR_TO,
    `${w.from}–${w.to}`);
  t("…and that default is not the whole day", w.to - w.from < 12, w.to - w.from);
}

console.log("\n=== 2. ⚠ THE REAL TIMETABLE: 19:00–21:30 DOHA ===");
{
  // Tue and Sat, 7:00–9:30 PM — the actual Group A pattern.
  const w = hourWindow([ev("2026-09-15T19:00:00Z", 150), ev("2026-09-19T19:00:00Z", 150)], hourOf);
  t("starts an hour before the lesson", w.from === 18, w.from);
  t("⚠ …and ends after 21:30, not at it — a 21:00 row that stops at 21:00 crops the lesson",
    w.to >= 22, w.to);
  t("the grid is compact, not sixteen empty rows", hourRows(w).length <= 6, hourRows(w).length);
}

console.log("\n=== 3. ⚠ A MORNING MOCK IS NOT CROPPED ===");
{
  const w = hourWindow([ev("2026-10-03T09:00:00Z", 120), ev("2026-09-15T19:00:00Z", 150)], hourOf);
  t("the window stretches to cover BOTH", w.from <= 9 && w.to >= 22, `${w.from}–${w.to}`);
  const placed = hourSpan(ev("2026-10-03T09:00:00Z", 120), hourOf, w);
  t("…and the 9 AM session is placed inside it", placed !== null, JSON.stringify(placed));
}

console.log("\n=== 4. a single short session does not become one giant row ===");
{
  const w = hourWindow([ev("2026-09-15T19:00:00Z", 30)], hourOf);
  t(`the window is at least ${MIN_HOUR_SPAN} hours`, w.to - w.from >= MIN_HOUR_SPAN, w.to - w.from);
}

console.log("\n=== 5. ⚠ A 30-MINUTE CLINIC STILL OCCUPIES A VISIBLE CELL ===");
{
  const w = hourWindow([ev("2026-09-15T19:00:00Z", 30)], hourOf);
  const p = hourSpan(ev("2026-09-15T19:00:00Z", 30), hourOf, w);
  t("span is at least 1 — a span of 0 renders as nothing and the session vanishes",
    p !== null && p.span >= 1, JSON.stringify(p));
}

console.log("\n=== 6. placement is by row index, not by wall-clock hour ===");
{
  const w = hourWindow([ev("2026-09-15T19:00:00Z", 150)], hourOf);   // 18–22
  const p = hourSpan(ev("2026-09-15T19:00:00Z", 150), hourOf, w);
  t("a 19:00 lesson in an 18:00-based grid is row 1, not row 19",
    p?.row === 1, JSON.stringify(p));
  t("…and 2.5 hours spans 3 rows (19, 20, 21)", p?.span === 3, p?.span);
}

console.log("\n=== 7. an event outside the window is refused, not clamped to row 0 ===");
{
  const w = { from: 18, to: 22 };
  t("⚠ a 9 AM session against an evening window returns null — clamping it to the",
    hourSpan(ev("2026-09-15T09:00:00Z", 60), hourOf, w) === null,
    JSON.stringify(hourSpan(ev("2026-09-15T09:00:00Z", 60), hourOf, w)));
  t("   top row would render it at 6 PM, which is a wrong time stated confidently", true);
}

console.log("\n=== 8. the row labels read like a timetable ===");
{
  t("7 PM", hourLabel(19) === "7 PM", hourLabel(19));
  t("9 AM", hourLabel(9) === "9 AM", hourLabel(9));
  t("noon is 12 PM, not 0 PM", hourLabel(12) === "12 PM", hourLabel(12));
  t("midnight is 12 AM, not 0 AM", hourLabel(0) === "12 AM", hourLabel(0));
  t("11 PM", hourLabel(23) === "11 PM", hourLabel(23));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
