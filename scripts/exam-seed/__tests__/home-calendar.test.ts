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
const CAL = readFileSync("src/components/calendar/Calendar.tsx", "utf8");
const GRID = readFileSync("src/lib/calendar/grid.ts", "utf8");
const HERO = readFileSync("src/components/calendar/HeroCalendar.tsx", "utf8");
const heroCode = HERO.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const OVERLAY = readFileSync("src/components/calendar/CalendarOverlay.tsx", "utf8");
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
  /**
   * ⚠ THE RULE IS "AT MOST ONE FETCH PER RENDER", NOT "ONE CALL SITE".
   *
   * This counted call sites, which was the same thing until §63 needed a
   * second window: the month in view cannot answer "when is the next lesson",
   * because for the whole summer the month in view is an empty August. A
   * lookahead is a genuinely different question and needs a different range.
   *
   * Relaxing this to `<= 2` would have been the wrong repair — it licenses a
   * third. So the guard now asserts the PROPERTY that made one call safe:
   *   - the lookahead is CONDITIONAL on the first result being empty, so a
   *     populated month still costs exactly one round trip; and
   *   - it is BOUNDED by a named constant, not open-ended.
   */
  const calls = (code.match(/loadCalendarEvents\(/g) ?? []).length;
  t("at most two calendar queries — the view, and a lookahead", calls <= 2, calls);
  t("⚠ …and the second is CONDITIONAL on the first being empty, so a populated month costs one fetch",
    /calendarEvents\.length === 0\s*\?\s*await loadCalendarEvents\(/.test(code),
    // ⚠ NO /s FLAG — tsconfig.scripts.json targets below es2018, where
    // dotAll is not available and tsc rejects it. [\s\S] is the portable
    // spelling and means the same thing.
    code.match(/[\s\S]{0,60}calendarEvents\.length === 0[\s\S]{0,40}/)?.[0]);
  t("⚠ …and the lookahead is BOUNDED by a named constant, not open-ended",
    /AHEAD_DAYS\s*=\s*\d+/.test(code) && /AHEAD_DAYS \* 86_400_000/.test(code),
    code.match(/AHEAD_DAYS\s*=\s*\d+/)?.[0]);
  t("⚠ …and that bound is a term, not a year",
    Number(code.match(/AHEAD_DAYS\s*=\s*(\d+)/)?.[1] ?? 9999) <= 180,
    code.match(/AHEAD_DAYS\s*=\s*(\d+)/)?.[1]);
}

console.log("\n── ⚠ NO PAYABLE CTA WHILE STRIPE IS KEYLESS ──");
{
  // ⚠ CHECKED IN BOTH STATES. A Book or Enrol control in the card or the
  // expanded dialog would be a promise this deployment cannot keep.
  t("⚠ no Book, Enrol or Buy control in the hero card or the overlay",
    !/>\s*(Book|Enrol|Buy)\b/.test(heroCode), heroCode.match(/>\s*(Book|Enrol|Buy)\b.{0,30}/)?.[0]);
  t("…and no checkout or Stripe reference", !/checkout|stripe/i.test(heroCode));
  t("the expanded state carries the shareable /calendar link",
    heroCode.includes('href="/calendar"'));
}

console.log("\n── ⚠ THE SHARED COMPONENT, NOT A SECOND IMPLEMENTATION ──");
{
  t("the card renders <Calendar in the compact variant",
    /<Calendar\b/.test(heroCode) && /variant="compact"/.test(heroCode));
  t("…in public mode", /mode="public"/.test(heroCode));
  t("the page renders the FULL calendar inside the overlay",
    /<HeroCalendarOverlay/.test(code) && /<Calendar\b/.test(code));
  // ⚠ THE OVERLAY IS THE COMPLETE EXPERIENCE — filters are NOT suppressed
  // there, which is the whole difference between the card and the expansion.
  t("…with filters ON in the expansion", !/showFilters=\{false\}/.test(code));
  // ⚠ A HAND-ROLLED GRID WOULD BE THE §2 VIOLATION.
  t("⚠ neither the card nor the page builds a grid of its own",
    !/<table|monthGrid\(|weekGrid\(/.test(heroCode) && !/<table|monthGrid\(|weekGrid\(/.test(code));
  t("the old list preview is gone, so nothing renders the same lessons twice",
    !code.includes("nextSessions") && !code.includes('id="upcoming"'));
  t("…and so is the standalone post-tuition section it replaced",
    !/id="calendar" className/.test(code));
}

console.log("\n── ⚠ THE CARD IS ONE TAB STOP, AND THE OVERLAY KEEPS ITS QUERY ──");
{
  t("the compact variant renders no links, so wrapping it nests no anchors",
    /variant === "compact"/.test(CAL) && /function CompactMonth/.test(CAL));
  t("…and its grid is aria-hidden, so 42 dead cells are not announced",
    /function CompactMonth[\s\S]{0,600}aria-hidden/.test(CAL));
  /**
   * ⚠ THE BUG THIS CATCHES. Every control inside the dialog is a link built by
   * stateToQuery. If the base did not carry calendar=open, paging to the next
   * month would silently DISMISS the overlay and nothing would error.
   */
  t("⚠ the overlay's basePath carries calendar=open",
    /basePath="\/\?calendar=open"/.test(code));
  t("…and stateToQuery joins with & when the base already has a query",
    /base\.includes\("\?"\) \? "&" : "\?"/.test(GRID));
}

console.log("\n── ⚠ ESCAPE, THE TRAP, AND REDUCED MOTION ──");
{
  t("Escape closes the dialog",
    /e\.key === "Escape"/.test(OVERLAY) && /router\.push\(closeHref/.test(OVERLAY));
  t("Tab wraps forward at the end", /!e\.shiftKey && active === last/.test(OVERLAY));
  t("…and backward at the start", /e\.shiftKey && active === first/.test(OVERLAY));
  t("…and focus that escapes is pulled back", /!node\.contains\(active\)/.test(OVERLAY));
  t("focus moves into the dialog when it opens", /focusables\(\)\[0\]\?\.focus\(\)/.test(OVERLAY));
  t("the page behind cannot scroll while it is open",
    /document\.body\.style\.overflow = "hidden"/.test(OVERLAY));
  t("…and that is restored on close", /document\.body\.style\.overflow = previous/.test(OVERLAY));
  // ⚠ THE SCRIM AND CLOSE ARE LINKS, so the dialog dismisses with no JS at all.
  t("the scrim is a link, not a click handler", /href=\{closeHref\}/.test(heroCode));

  const CSS = readFileSync("src/app/globals.css", "utf8");
  t("the entrance is 150ms — inside the 200ms budget", /ailemy-calendar-expand 150ms/.test(CSS));
  // ⚠ NOT SHORTENED FOR REDUCED MOTION — NOT RUN AT ALL.
  t("⚠ and it is defined only inside prefers-reduced-motion: no-preference",
    /@media \(prefers-reduced-motion: no-preference\)[\s\S]{0,260}\.ailemy-calendar-expand/.test(CSS));
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
  // ⚠ THE CARD IS IN THE HERO NOW, so it comes BEFORE everything — but as the
  // second column, after the copy and CTAs in DOM order, which is the reading
  // order a phone and a screen reader both get.
  t("the hero card exists", at("hero-calendar") > 0);
  /**
   * ⚠ ANCHORED ON data-cta, NOT ON AN href LITERAL. The primary CTA's
   * destination is now conditional — `href={session ? "/profile" :
   * "/past-papers"}` — because a signed-in student must not be invited to
   * start something they already started. A literal-href search silently
   * stopped finding it and this assertion went red for a reason that had
   * nothing to do with placement.
   *
   * data-cta is the stabler anchor and a stronger one: it names the CTA's ROLE
   * in the funnel, so it survives a destination change and a copy change, and
   * it is the same identifier the analytics naming convention uses.
   */
  const cta = (name: string) => code.indexOf(`data-cta="${name}"`);
  t("both hero CTAs are present and named for the funnel",
    cta("hero_start_free_clicked") > 0 && cta("hero_book_tuition_clicked") > 0);
  t("…and the copy and CTAs precede it in the DOM",
    cta("hero_start_free_clicked") < at("hero-calendar")
    && cta("hero_book_tuition_clicked") < at("hero-calendar"));
  /**
   * ⚠ THIS PINNED subjects BEFORE tuition, WHICH §3 DELIBERATELY REVERSED.
   * The rule the assertion protects is that the HERO LEADS — a calendar that
   * ends up below the fold's content is the regression worth catching. The
   * relative order of two sections further down was incidental to the layout
   * that happened to exist when it was written, and the redesign moved tuition
   * up on purpose: a visitor now meets it after experiencing the product and
   * before scrolling through every academic explanation.
   */
  t("…so the hero still leads both of them",
    at("hero-calendar") < at("subjects") && at("hero-calendar") < at("tuition"));
  t("the two-column split is at lg (1024px), stacking below it",
    /lg:grid-cols-\[minmax\(0,1fr\)_480px\]/.test(code));
  /**
   * ⚠ THIS ASSERTION INVERTED, AND THE REASON MATTERS MORE THAN THE VALUE.
   * It used to require lg:items-center, because the calendar card was the
   * SHORTER column and centring stopped it hanging off the top of the copy.
   * The conversion build added a tuition heading and two actions above the
   * card, which made the right column the TALLER one — and centring then
   * answered by pushing the h1 84px down the page, opening an empty top-left
   * corner on the first screen. Measured, not guessed.
   *
   * So the invariant was never "centre it"; it was "neither column hangs".
   * With the right column taller, top alignment is what satisfies it, and it
   * also puts the headline and "Learn live with an expert" on the same line.
   */
  t("…and the two columns start together, so neither hangs below the other",
    /lg:items-start/.test(code) && !/lg:items-center/.test(code));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
