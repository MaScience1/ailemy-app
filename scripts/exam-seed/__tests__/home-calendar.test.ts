/**
 * The homepage calendar section (founder direction, 2026-08-20).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/home-calendar.test.ts
 *
 * ⚠ NO CREDENTIALS AND NO CLOCK. The range query and the empty-state copy are
 * pure functions; the rendered section is asserted against the page SOURCE,
 * because the properties that matter there are absences — no payable CTA, no
 * second reader, no re-implemented grid — and no render can prove an absence.
 */
import { readFileSync } from "node:fs";

import { rangeFor } from "../../../src/lib/calendar/grid.ts";
import { emptyCalendarMessage } from "../../../src/lib/calendar/types.ts";
import { FALLBACK_COHORTS } from "../../../src/lib/public/catalogue.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const PAGE = readFileSync("src/app/page.tsx", "utf8");
const code = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const days = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

console.log("── ⚠ THE VISIBLE WINDOW ONLY — NEVER A YEAR ──");
{
  /**
   * The homepage used to fetch a fixed 70-day window regardless of what it
   * displayed. It now asks rangeFor() for exactly what the chosen view shows.
   */
  const month = rangeFor("month", "2026-09-15");
  t("a month range covers the grid, not the calendar month",
    days(month.from, month.to) >= 27 && days(month.from, month.to) <= 41,
    `${month.from} → ${month.to} (${days(month.from, month.to)} days)`);
  // ⚠ THE LEADING AND TRAILING DAYS MATTER. A query for 1–30 September leaves
  // the cells that belong to August and October mysteriously empty, which
  // reads as a broken calendar rather than a narrow query.
  t("…so it starts before the 1st of the month", month.from < "2026-09-01", month.from);
  t("…and ends after the last of it", month.to > "2026-09-30", month.to);

  const upcoming = rangeFor("upcoming", "2026-09-15");
  t("the upcoming range is bounded, not open-ended",
    days(upcoming.from, upcoming.to) > 0 && days(upcoming.from, upcoming.to) <= 120,
    `${days(upcoming.from, upcoming.to)} days`);

  for (const anchor of ["2026-01-15", "2026-06-30", "2026-12-31"]) {
    const r = rangeFor("month", anchor);
    t(`no month range anywhere in the year exceeds 42 days (${anchor})`,
      days(r.from, r.to) <= 42, `${days(r.from, r.to)} days`);
  }

  t("⚠ the page asks rangeFor for its window",
    /rangeFor\(calendarState\.view, calendarState\.date\)/.test(code));
  t("…and the old fixed 70-day fetch is gone",
    !/70 \* 86_400_000/.test(code), code.match(/.{0,40}86_400_000.{0,20}/)?.[0]);
  t("…and there is exactly ONE calendar query on the page",
    (code.match(/loadCalendarEvents\(/g) ?? []).length === 1,
    (code.match(/loadCalendarEvents\(/g) ?? []).length);
}

console.log("\n── ⚠ NO PAYABLE CTA WHILE STRIPE IS KEYLESS ──");
{
  const a = code.indexOf('id="calendar"');
  const b = code.indexOf('id="papers"', a);
  t("the calendar section was located in the source", a > 0 && b > a, `${a}..${b}`);
  const sec = code.slice(a, b);

  t("it links to the full calendar", sec.includes('href="/calendar"'));
  t("…and to 1-to-1", sec.includes('href="/tuition/one-to-one"'));
  // ⚠ THE ABSENCE THAT MATTERS. A Book or Enrol control on the homepage would
  // be a promise this deployment cannot keep.
  t("⚠ no Book, Enrol or Buy control in the section",
    !/>\s*(Book|Enrol|Buy)\b/.test(sec), sec.match(/>\s*(Book|Enrol|Buy)\b.{0,30}/)?.[0]);
  t("…and no Stripe checkout link", !/checkout|stripe/i.test(sec));
}

console.log("\n── ⚠ THE SHARED COMPONENT, NOT A SECOND IMPLEMENTATION ──");
{
  const a = code.indexOf('id="calendar"');
  const sec = code.slice(a, code.indexOf('id="papers"', a));
  t("it renders <Calendar", /<Calendar\b/.test(sec));
  t("…in public mode", /mode="public"/.test(sec));
  t("…with filters hidden — the homepage is not where you narrow a search",
    /showFilters=\{false\}/.test(sec));
  t("…anchored, so closing a day panel returns to the section not the hero",
    /anchor="#calendar"/.test(sec));
  // ⚠ A HAND-ROLLED GRID WOULD BE THE §2 VIOLATION. No <table>, no day loop.
  t("⚠ the section builds no grid of its own",
    !/<table|monthGrid\(|weekGrid\(/.test(sec));
  t("the old list preview is gone, so nothing renders the same lessons twice",
    !code.includes("nextSessions") && !code.includes('id="upcoming"'));
}

console.log("\n── §58 — THE MOBILE DEGRADATION ──");
{
  t("a coarse user-agent test picks the default view", /Mobi\\b/.test(PAGE));
  t("…handheld gets upcoming, everything else gets month",
    /handheld \? "upcoming" : "month"/.test(code));
  // ⚠ IT IS A DEFAULT, NOT A LOCK. An explicit ?view= still wins, which is what
  // readState guarantees — asserted here so nobody "simplifies" it to a
  // hardcoded view.
  t("…and it is passed as readState's DEFAULT, so ?view= still wins",
    /readState\(params, todayISO, handheld/.test(code));
}

console.log("\n── ⚠ AN EMPTY WINDOW THAT SAYS SOMETHING USEFUL ──");
{
  const fmt = (iso: string) => `«${iso}»`;
  const AS = FALLBACK_COHORTS.find((c) => c.firstClassOn !== null && c.scheduleSummary !== null);
  t("the catalogue carries a cohort with BOTH a first-class date and a timetable",
    AS !== undefined && typeof AS.firstClassOn === "string", AS?.firstClassOn);

  /**
   * ⚠ THE ONE THIS SHIPPED WRONG. Production's Y11 and Y10 rows carry
   * starts_on = 2026-09-01 with schedule_summary NULL — a nominal date for
   * demand-triggered cohorts that have no timetable and may never run. The
   * first version rendered "teaching begins Tue 1 Sept" off the back of them.
   */
  const withNominalStart = [
    { firstClassOn: "2026-09-01", scheduleSummary: null },      // Y11 — no timetable
    { firstClassOn: "2026-09-01", scheduleSummary: null },      // Y10 — no timetable
    { firstClassOn: "2026-09-15", scheduleSummary: "Tue + Sat" }, // AS — real
  ];
  t("⚠ a start date WITHOUT a timetable is ignored — it is a hope, not a lesson",
    emptyCalendarMessage(withNominalStart, "2026-08-20", fmt).includes("«2026-09-15»"),
    emptyCalendarMessage(withNominalStart, "2026-08-20", fmt));
  t("…and with no timetabled cohort at all it says nothing about dates",
    emptyCalendarMessage(
      [{ firstClassOn: "2026-09-01", scheduleSummary: null }], "2026-08-20", fmt,
    ) === "No lessons are scheduled in this period.");
  t("…an empty-string timetable counts as none",
    emptyCalendarMessage(
      [{ firstClassOn: "2026-09-01", scheduleSummary: "   " }], "2026-08-20", fmt,
    ) === "No lessons are scheduled in this period.");

  const before = emptyCalendarMessage(FALLBACK_COHORTS, "2026-08-20", fmt);
  t("before term it names the first class date",
    before.includes(`«${AS!.firstClassOn}»`), before);
  t("…and points somewhere, rather than dead-ending",
    /look ahead|full calendar/i.test(before), before);

  // ⚠ ONCE TERM HAS STARTED THAT SENTENCE IS ABOUT THE PAST.
  const after = emptyCalendarMessage(FALLBACK_COHORTS, "2027-01-01", fmt);
  t("after term it does NOT name a date that has passed",
    !after.includes("«"), after);
  t("…it falls back to the plain sentence", after === "No lessons are scheduled in this period.", after);

  // A cohort with no timetable must contribute nothing rather than a guess.
  t("a cohort with no firstClassOn contributes no date",
    emptyCalendarMessage([{ firstClassOn: null, scheduleSummary: "Tue" }], "2026-08-20", fmt) ===
      "No lessons are scheduled in this period.");
  t("the EARLIEST future date wins, not the first in the array",
    emptyCalendarMessage(
      [{ firstClassOn: "2026-11-01", scheduleSummary: "Tue" },
       { firstClassOn: "2026-09-15", scheduleSummary: "Tue" }], "2026-08-20", fmt,
    ).includes("«2026-09-15»"));
  t("a date exactly today is not 'upcoming'",
    !emptyCalendarMessage(
      [{ firstClassOn: "2026-08-20", scheduleSummary: "Tue" }], "2026-08-20", fmt).includes("«"));
}

console.log("\n── PLACEMENT — hierarchy stays intact ──");
{
  const at = (id: string) => code.indexOf(`id="${id}"`);
  t("subjects comes before the calendar", at("subjects") < at("calendar"));
  t("tuition comes before the calendar", at("tuition") < at("calendar"));
  // ⚠ THE REQUIREMENT: it must not push the primary CTAs below the fold.
  t("…and the calendar comes before papers and the footer CTA",
    at("calendar") < at("papers") && at("calendar") < at("start"));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
