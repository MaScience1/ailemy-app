/**
 * The calendar as a booking surface: what it may show, and what it must not invent.
 *
 * ============================================================================
 * ⚠ §66 IS THE HARD RULE — THERE IS NO STORED 1-TO-1 AVAILABILITY
 * ============================================================================
 * `teacher_availability` exists and `loadOpenSlots` reads it correctly. It has
 * no rows. So the entire gold layer — token, chips, legend, shortcut, filter —
 * is built and wired, and renders its honest empty state.
 *
 * Every shortcut to a nicer-looking screenshot is a lie told to a student about
 * a time nobody will teach: a greyed example slot, a "Coming soon" chip shaped
 * like a bookable one, a seeded production row. This file exists to make each
 * of those fail loudly, and the sabotage runs in the report prove it does.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  actionFor, bandFor, dayLabel, daysBetween, groupUpcoming, nextOf, BAND_LABEL,
} from "../../../src/lib/calendar/upcoming.ts";
import { hourWindow } from "../../../src/lib/calendar/grid.ts";
import { matchesFilters } from "../../../src/lib/calendar/types.ts";
import { readState, stateToQuery } from "../../../src/lib/calendar/grid.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const APP = "src/app";
const SHORTCUTS = readFileSync("src/components/calendar/CalendarShortcuts.tsx", "utf8");
const CALENDAR = readFileSync("src/components/calendar/Calendar.tsx", "utf8");
const CHIP = readFileSync("src/components/calendar/EventChip.tsx", "utf8");
const PAGE = readFileSync("src/app/calendar/page.tsx", "utf8");
/**
 * ⚠ THE HERO'S AVAILABILITY CARD IS A THIRD SURFACE THAT NAMES TIMES, and it
 * was not covered until a sabotage run walked straight past this guard:
 * writing "Tue 15 Sep · 8:00–9:00 PM" into its empty state changed nothing
 * red. §66 is about fabricated availability wherever it is rendered, not about
 * one directory, so the scan follows the feature rather than the folder.
 */
const HERO_AVAIL = readFileSync("src/components/home/HeroAvailability.tsx", "utf8");
const READERS = readFileSync("src/lib/calendar/readers.ts", "utf8");
const COLOURS = readFileSync("src/lib/design/subject-colours.ts", "utf8");

/** Comments are prose, not code — see resources-hub.test.ts. */
const code = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

function routes(dir: string, prefix: string[] = []): string[][] {
  const out: string[][] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (!statSync(full).isDirectory() || e.startsWith("_")) continue;
    const next = e.startsWith("(") && e.endsWith(")") ? prefix : [...prefix, e];
    if (readdirSync(full).some((f) => /^page\.(tsx|ts|jsx|js)$/.test(f))) out.push(next);
    out.push(...routes(full, next));
  }
  return out;
}
const ROUTES = routes(APP);
const hasRoute = (p: string) => {
  if (p === "/") return existsSync(join(APP, "page.tsx"));
  const want = p.split("/").filter(Boolean);
  return ROUTES.some((r) => r.length === want.length && r.every((s, i) => s.startsWith("[") || s === want[i]));
};

const ev = (over: Partial<{ key: string; type: string; startsAt: Date; status: string; bookable: boolean; cohort: unknown; subject: string | null; qualification: string | null; yearGroup: string | null }> = {}) => ({
  key: "k", type: "group", status: "scheduled", startsAt: new Date("2026-09-15T16:00:00Z"),
  endsAt: new Date("2026-09-15T17:00:00Z"), title: "T", subject: "chemistry",
  qualification: null, yearGroup: null, cohortSlug: null, teacherName: null,
  cancelledReason: null, ...over,
}) as never;

// ============================================================================
console.log("\n=== 1. ⚠ §66 — no fabricated 1-to-1 availability ===");
// ============================================================================
{
  const c = code(SHORTCUTS) + code(CALENDAR) + code(PAGE) + code(HERO_AVAIL);

  /**
   * ⚠ THE CORE CHECK. A time-of-day literal anywhere in these components means
   * somebody has typed an example slot into the UI. Real times come from a Date
   * on an event and are formatted by dualTime; none of them can appear here as
   * text.
   */
  const TIME_LITERAL = /["'>]\s*\d{1,2}[:.]\d{2}\s*(?:–|-|—)?\s*(?:\d{1,2}[:.]\d{2})?\s*(?:AM|PM|am|pm)?\s*["'<]/;
  t("⚠ §66 — no hardcoded clock time in the calendar components",
    !TIME_LITERAL.test(c), c.match(TIME_LITERAL)?.[0]);
  const DATE_LITERAL = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/;
  t("⚠ §66 — no hardcoded example date", !DATE_LITERAL.test(c), c.match(DATE_LITERAL)?.[0]);

  // The empty branch must exist AND must not look like an offer.
  t("⚠ §66 — the shortcut has an explicit empty branch",
    /No 1-to-1 times are published yet/.test(SHORTCUTS));
  t("⚠ §66 — the empty branch is not styled as a bookable slot",
    /border-dashed/.test(SHORTCUTS) && !/Book this slot[\s\S]{0,200}No 1-to-1 times/.test(SHORTCUTS));
  t("§66 — and it still offers a real next step, not a dead end (§49)",
    /Register interest in a time/.test(SHORTCUTS));

  // ⚠ NOTHING SEEDS SLOTS INTO PRODUCTION. The reader must be the only source.
  t("⚠ §66 — no slot fixture array is shipped in src/",
    !/const\s+(DEMO|SAMPLE|FAKE|PLACEHOLDER)_SLOTS/i.test(code(SHORTCUTS) + code(READERS)));
  t("§66 — private events come from loadOpenSlots and nowhere else",
    (code(READERS).match(/type:\s*"private_open"/g) ?? []).length === 1
      && code(READERS).includes("loadOpenSlots"));

  // nextOf must return null rather than a stand-in.
  t("⚠ §66 — nextOf returns null when there is nothing, never a placeholder",
    nextOf([], "private_open", new Date()) === null);
  t("§66 — and it ignores events already in the past",
    nextOf([ev({ type: "private_open", startsAt: new Date("2020-01-01T00:00:00Z") })],
      "private_open", new Date("2026-01-01T00:00:00Z")) === null);
  t("§66 — it finds the earliest FUTURE one when they exist",
    (nextOf([
      ev({ key: "b", type: "private_open", startsAt: new Date("2026-09-20T16:00:00Z") }),
      ev({ key: "a", type: "private_open", startsAt: new Date("2026-09-16T16:00:00Z") }),
    ], "private_open", new Date("2026-09-01T00:00:00Z")) as unknown as { key: string })?.key === "a");
}

// ============================================================================
console.log("\n=== 2. ⚠ §3 — no hardcoded Book; the label is derived ===");
// ============================================================================
{
  const c = code(SHORTCUTS);
  t("⚠ §3 — the 1-to-1 action is chosen by `bookable`, not typed",
    /nextPrivate\.bookable \? "Book this slot" : "See details"/.test(SHORTCUTS));
  t("§3 — no unconditional Book string in the component",
    !/>\s*Book this slot/.test(c));
  // ⚠ THE READER'S AND IS WHERE bookable COMES FROM — three conditions, all
  // required. If that ever collapses to one, this is the file that notices.
  t("§3 — bookable still requires Stripe AND a real price",
    /const bookable = payable && cheapest !== null/.test(READERS));
  t("§3 — no second checkout was written",
    !existsSync("src/lib/booking/checkout.ts") && !/stripe\.checkout/.test(code(SHORTCUTS)));
}

// ============================================================================
console.log("\n=== 3. ⚠ §4/§46/§47 — one gold token, no new palette ===");
// ============================================================================
{
  t("§46 — a single central 1-to-1 token exists", /export const ONE_TO_ONE/.test(COLOURS));
  t("⚠ §46 — it is built from the existing GOLD ramp, not a new hex",
    /accent: GOLD\.body/.test(COLOURS) && /text: GOLD\.text/.test(COLOURS));
  t("§47 — no fifth subject colour was invented",
    !/#[0-9A-Fa-f]{6}/.test(code(COLOURS).slice(code(COLOURS).indexOf("ONE_TO_ONE"),
      code(COLOURS).indexOf("ONE_TO_ONE") + 400)));
  t("§4 — 1-to-1 chips are gold, not neutral", /ONE_TO_ONE/.test(CHIP));
  t("§4 — group chips still use the subject colour", /subjectColour\(event\.subject\)/.test(CHIP));
  // §5/§38/§53 — colour is never the only signal.
  t("⚠ §38 — the chip prints the type in words as well as colour",
    /private_open:\s*"1-to-1"/.test(CHIP));
  t("§6 — the legend names every colour it shows",
    /What the colours mean/.test(SHORTCUTS)
      && ["Chemistry", "Biology", "Physics", "1-to-1 available"].every((l) => SHORTCUTS.includes(l)));
}

// ============================================================================
console.log("\n=== 4. §24–§30 — Upcoming reads like a schedule, not a table ===");
// ============================================================================
{
  // §25 — the fetch window is not the product label.
  // ⚠ THE LABEL LIVED IN periodLabel, NOT THE VIEW — it was the page's most
  // prominent heading, beside the view switcher. Checking only the component
  // would have passed while the words stayed on screen.
  const GRID = readFileSync("src/lib/calendar/grid.ts", "utf8");
  t("⚠ §25 — \"Next 60 days\" is gone from every label",
    !/Next 60 days/i.test(code(CALENDAR)) && !/\`Next \\${UPCOMING_DAYS} days\`/.test(GRID));
  t("§25 — the upcoming period reads as a student task",
    /return "Upcoming tuition"/.test(GRID));
  t("⚠ §60 — the shortcut shows a level LABEL, not a slug",
    /levelLabel\(nextGroup\.qualification\)/.test(SHORTCUTS));
  t("§25 — the window itself is unchanged", /UPCOMING_DAYS = 60/.test(
    readFileSync("src/lib/calendar/grid.ts", "utf8")));

  // §28 — banded by nearness.
  t("§28 — three bands, labelled for students",
    BAND_LABEL.this_week === "This week" && BAND_LABEL.next_week === "Next week"
      && BAND_LABEL.later === "Later");
  t("§28 — a day 3 out is this week", bandFor("2026-09-01", "2026-09-04") === "this_week");
  t("§28 — a day 8 out is next week", bandFor("2026-09-01", "2026-09-09") === "next_week");
  t("§28 — a day 30 out is later", bandFor("2026-09-01", "2026-10-01") === "later");
  // ⚠ SEVEN ROLLING DAYS, NOT THE REST OF THE CALENDAR WEEK. A band that
  // empties itself every Friday is worse than no band.
  t("⚠ §28 — 'this week' is 7 rolling days, so a Saturday reader still gets one",
    bandFor("2026-09-05", "2026-09-10") === "this_week");

  // §29 — friendly lead AND exact date, never one without the other.
  t("§29 — today reads Today", dayLabel("2026-09-15", "2026-09-15").lead === "Today");
  t("§29 — tomorrow reads Tomorrow", dayLabel("2026-09-15", "2026-09-16").lead === "Tomorrow");
  t("⚠ §29 — the exact date is never lost",
    dayLabel("2026-09-15", "2026-09-16").exact === "Wed 16 Sep",
    dayLabel("2026-09-15", "2026-09-16").exact);
  t("§29 — a distant day leads with its own date",
    dayLabel("2026-09-15", "2026-10-02").lead === "Fri 2 Oct");
  t("§29 — the component renders both halves",
    /\{day\.lead\}/.test(CALENDAR) && /\{day\.exact\}/.test(CALENDAR));

  // grouping shape
  const events = [
    ev({ key: "a", startsAt: new Date("2026-09-15T16:00:00Z") }),
    ev({ key: "b", startsAt: new Date("2026-09-15T18:00:00Z") }),
    ev({ key: "c", startsAt: new Date("2026-09-25T16:00:00Z") }),
  ];
  const secs = groupUpcoming(events, "2026-09-15", (e) => (e as unknown as { startsAt: Date }).startsAt.toISOString().slice(0, 10));
  t("§28 — events collapse into days within bands",
    secs.length === 2 && secs[0].days.length === 1 && secs[0].days[0].events.length === 2, JSON.stringify(secs.map(s => [s.band, s.count])));
  t("§28 — each band counts what is really in it",
    secs[0].count === 2 && secs[1].count === 1);
  // ⚠ AN EMPTY BAND IS NOT RENDERED — a heading over nothing reads as a fault.
  // ⚠ AN EMPTY BAND IS NOT RENDERED — a heading over nothing reads as a fault.
  // Nothing in this fixture is 14+ days out, so "Later" must be absent; the
  // two that ARE populated must both be present and non-empty.
  t("⚠ §28 — bands with nothing in them are omitted",
    !secs.some((s) => s.count === 0) && !secs.some((s) => s.band === "later"),
    secs.map((s) => `${s.band}:${s.count}`).join(" "));
  t("§28 — nothing at all yields no sections", groupUpcoming([], "2026-09-15", () => "x").length === 0);

  // §60 — no internal microcopy leaking into the student's view.
  t("⚠ §60 — no admin-sounding label in the upcoming view",
    !/\bGROUP\b/.test(code(CALENDAR).slice(code(CALENDAR).indexOf("function UpcomingView"))));
}

// ============================================================================
console.log("\n=== 5. §11 — available only, in ONE filter ===");
// ============================================================================
{
  t("§11 — the state carries it", readState({ available: "1" }, "2026-09-01").availableOnly === true);
  t("§11 — off by default", readState({}, "2026-09-01").availableOnly === false);
  t("§11 — it survives a round trip through the URL",
    stateToQuery(readState({ available: "1" }, "2026-09-01"), "2026-09-01").includes("available=1"));

  // ⚠ ONE FILTER IMPLEMENTATION. matchesFilters is the only place any calendar
  // surface decides what is visible; a second copy is how two views disagree.
  const cancelled = ev({ status: "cancelled" });
  const full = ev({ cohort: { status: "full" } });
  const unbookable = ev({ type: "private_open", bookable: false });
  const openSlot = ev({ type: "private_open", bookable: true });
  t("§11 — a cancelled lesson is not 'available'", matchesFilters(cancelled, { availableOnly: true }) === false);
  t("§11 — a full cohort is not 'available'", matchesFilters(full, { availableOnly: true }) === false);
  t("§11 — an unpayable slot is not 'available'", matchesFilters(unbookable, { availableOnly: true }) === false);
  t("§11 — an open, payable slot is", matchesFilters(openSlot, { availableOnly: true }) === true);
  // ⚠ WITHOUT THE FILTER, EVERYTHING STILL SHOWS. Hiding a cancelled lesson by
  // default generates the email the label was written to prevent.
  t("⚠ §11 — with the filter off, a cancelled lesson still shows",
    matchesFilters(cancelled, {}) === true);
  t("⚠ §11 — the viewer's own booking survives the filter",
    matchesFilters(ev({ type: "private_booked" }), { availableOnly: true }) === true);
}

// ============================================================================
console.log("\n=== 6. ⚠ §2/§42 — one calendar system ===");
// ============================================================================
{
  t("§42 — every surface reads loadCalendarEvents",
    ["src/app/calendar/page.tsx", "src/app/page.tsx", "src/app/tuition/page.tsx"]
      .every((f) => readFileSync(f, "utf8").includes("loadCalendarEvents")));
  t("§2 — no second calendar component was created",
    !existsSync("src/components/calendar/BookingCalendar.tsx")
      && !existsSync("src/components/tuition/TuitionCalendar.tsx"));
  t("§42 — one filter function, used by the reader",
    /matchesFilters\(e, q\)/.test(READERS));
  // §7 of the header / §36 — timezone stays in the library.
  t("⚠ §36 — no hardcoded DST offset anywhere in the calendar",
    !/UTC[+-]\d|\+03:00|GMT\+3/.test(code(CALENDAR) + code(SHORTCUTS) + code(PAGE)));
  t("§36 — times go through dualTime", /dualTime/.test(SHORTCUTS));
  t("§7 — the canonical zone is still the calendar's day boundary",
    /dayKeyOf/.test(CALENDAR));
}

// ============================================================================
console.log("\n=== 7. ⚠ §65 — nothing that worked was broken ===");
// ============================================================================
{
  for (const p of ["/calendar", "/tuition", "/tuition/one-to-one", "/tuition/interest",
                   "/intensive", "/", "/resources", "/past-papers", "/exam-builder"]) {
    t(`§65 — ${p} still resolves`, hasRoute(p));
  }
  t("§65 — the /calendar route was not moved or renamed", existsSync("src/app/calendar/page.tsx"));
  t("§65 — no redirect was introduced, because no URL moved",
    !/redirect\(|permanentRedirect/.test(code(PAGE)));
  // The three views the brief said to preserve.
  for (const v of ["month", "week", "upcoming"]) {
    t(`§65 — the ${v} view survives`, new RegExp(`state\\.view === "${v}"`).test(CALENDAR));
  }
  t("§65 — subject, level and type filters all survive",
    /row\("Subject"/.test(CALENDAR) && /row\("Level"/.test(CALENDAR) && /row\("Type"/.test(CALENDAR));
  t("§65 — cancelled lessons are still fetched, so they can still be explained",
    /includeCancelled: true/.test(READERS));
  t("§41 — the breadcrumb still names Online Tuition", /Online Tuition/.test(PAGE));
  // ⚠ §13 — THE SHORTCUT MUST OUTLIVE AN EMPTY WINDOW. See the page comment.
  t("⚠ §13 — the shortcuts reach past the visible window",
    /events=\{events\.length > 0 \? events : aheadEvents\}/.test(PAGE));

  /**
   * ⚠ §13 — THE SHORTCUT MUST OUTLIVE AN EMPTY WINDOW. Fed only the visible
   * range it rendered nothing for the whole of August, because teaching starts
   * on 13 September and a month grid of August holds no sessions. Caught on
   * production, not by a test: every local check ran on a month that had them.
   */
  t("⚠ §13 — the shortcuts reach past the visible window",
    /events=\{events\.length > 0 \? events : aheadEvents\}/.test(PAGE));
}

// ============================================================================
console.log("\n=== 8. §53/§54 — accessible, and calm ===");
// ============================================================================
{
  t("§53 — the legend is a labelled list", /aria-label="What the colours mean"/.test(SHORTCUTS));
  t("§53 — decorative swatches are hidden from screen readers",
    (SHORTCUTS.match(/aria-hidden/g) ?? []).length >= 3);
  t("§53 — shortcuts clear the 44px touch target", /min-h-\[44px\]/.test(SHORTCUTS));
  t("§53 — every shortcut has a visible focus state",
    (SHORTCUTS.match(/focus-visible:outline\b/g) ?? []).length >= 2);
  t("§54 — motion is guarded", /motion-safe:/.test(SHORTCUTS));
}

// ============================================================================
console.log("\n=== 9. ⚠ §20 — the week's hours come from the data ===");
// ============================================================================
{
  const at = (h: number, dur = 1) => ({
    startsAt: new Date(Date.UTC(2026, 8, 15, h - 3, 0)),   // Doha = UTC+3
    endsAt: new Date(Date.UTC(2026, 8, 15, h - 3 + dur, 0)),
  });
  const hourOf = (d: Date) => (d.getUTCHours() + 3) % 24;

  /**
   * ⚠ NOT A HARDCODED 5–10 PM WINDOW. The brief's own illustration is an
   * evening grid, and evenings are what the catalogue holds today — so a fixed
   * window would have looked correct and been a coincidence. It is derived, so
   * the grid expands on its own the day a morning slot lands.
   */
  const evening = hourWindow([at(19), at(20)], hourOf);
  t("⚠ §20 — the window is derived from the events, not fixed",
    evening.from <= 19 && evening.to >= 21, JSON.stringify(evening));
  const morning = hourWindow([at(9)], hourOf);
  t("⚠ §20 — a morning session moves the window to the morning",
    morning.from <= 9 && morning.from < evening.from, JSON.stringify(morning));
  const wide = hourWindow([at(9), at(21)], hourOf);
  t("§20 — a spread-out day widens rather than clipping",
    wide.from <= 9 && wide.to >= 22, JSON.stringify(wide));
  // ⚠ 3 AM EMPTY ROWS ARE THE THING §20 FORBIDS.
  t("⚠ §20 — an evening-only week does not render the small hours",
    evening.from >= 12, JSON.stringify(evening));
  // A lesson ending at :30 still owns the row it ends inside.
  const half = hourWindow([{ startsAt: new Date(Date.UTC(2026, 8, 15, 16, 0)),
                             endsAt: new Date(Date.UTC(2026, 8, 15, 17, 30)) }], hourOf);
  t("§20 — a lesson ending on the half hour is not clipped", half.to >= 21, JSON.stringify(half));
}

// ============================================================================
console.log("\n=== 10. ⚠ §23 — the phone gets a date selector, not a shrunk grid ===");
// ============================================================================
{
  const mobile = CALENDAR.slice(CALENDAR.indexOf("phone: a date selector"),
                                CALENDAR.indexOf("tablet and up: the hour grid"));
  t("§23 — the seven-day stack is gone", !/phone: the list, unchanged/.test(CALENDAR));
  t("§23 — the dates scroll horizontally", /overflow-x-auto/.test(mobile));
  t("⚠ §23 — the page body does not scroll sideways to do it",
    /min-w-max/.test(mobile) && /-mx-1 overflow-x-auto/.test(mobile));
  t("§23 — the selected date is announced", /aria-current=\{selected \? "date" : undefined\}/.test(mobile));
  t("§53 — the date chips clear 44px", /min-h-\[56px\]/.test(mobile));
  t("§48 — each session row is a full-width target with a visible action",
    /min-h-\[44px\]/.test(mobile) && /\{action\.label\}/.test(mobile));
  t("§38 — the row says the type in words", /Group tuition" : "1-to-1"/.test(mobile));

  /**
   * ⚠ THE SELECTOR REUSES `date`, WHICH IS WHY IT CANNOT DISAGREE WITH THE
   * WEEK. Every day in a week shares a startOfWeek, so the anchor doubles as
   * the cursor; a separate parameter would be a second source of truth for
   * "which day", and the two could drift.
   */
  t("⚠ §23 — the selector moves the existing anchor, not a new parameter",
    /p\.href\(\{ date: day\.date, day: null \}\)/.test(mobile));
  t("§23 — and it does not open the day panel instead", !/href=\{p\.href\(\{ day: day\.date \}\)\}/.test(mobile));

  // §49 — an empty day is never a dead end.
  t("§49 — an empty day says so and offers a way on",
    /No tuition on this day/.test(mobile) && /See what is coming up/.test(mobile));

  // ⚠ §66 AGAIN, ON THE NEW SURFACE. The mobile list renders whatever the
  // reader returns; nothing in it may name a time or a type that has no row.
  t("⚠ §66 — the mobile list invents no slot",
    !/1-to-1 available[\s\S]{0,40}\d{1,2}:\d{2}/.test(mobile));
  t("§66 — its rows come from the bucket, not a literal",
    /p\.buckets\.get\(selectedISO\)/.test(mobile));
}

// ============================================================================
console.log("\n=== 11. ⚠ §57 — the action verb is derived per event ===");
// ============================================================================
{
  t("⚠ §57 — a cohort with no payment link cannot be reserved",
    actionFor({ type: "group", cohort: { status: "interest", enrolmentUrl: null } }).label === "View lesson");
  t("⚠ §57 — nor one marked enrolling with a null link",
    actionFor({ type: "group", cohort: { status: "enrolling", enrolmentUrl: null } }).bookable === false);
  t("§57 — an enrolling cohort WITH a link can be reserved",
    actionFor({ type: "group", cohort: { status: "enrolling", enrolmentUrl: "https://pay" } }).label
      === "Reserve your place");
  t("§57 — an unbookable slot says See details",
    actionFor({ type: "private_open", bookable: false }).label === "See details");
  t("§57 — a bookable slot says Book this slot",
    actionFor({ type: "private_open", bookable: true }).label === "Book this slot");
  t("⚠ §57 — the viewer's own booking is not offered back to them",
    actionFor({ type: "private_booked" }).label === "Your booking");
  t("§57 — a cancelled lesson offers nothing",
    actionFor({ type: "group", status: "cancelled" }).bookable === false);
}

// ============================================================================
console.log("\n=== 12. ⚠ §50 — an empty month explains itself, ABOVE the grid ===");
// ============================================================================
{
  const EMPTY = readFileSync("src/components/calendar/MonthEmptyState.tsx", "utf8");
  const HOME = readFileSync("src/app/page.tsx", "utf8");

  t("§50 — it says what is true of the month", /No tuition this month\./.test(EMPTY));
  t("§50 — it names the next real lesson's date", /monthNameOf\(nextGroup\.dateISO\)/.test(EMPTY));
  t("⚠ §50 — and its TIME, not just the date", /\{when\(nextGroup\.event\)\}/.test(EMPTY));
  t("§50 — it offers a jump to that month", /Jump to \{monthNameOf\(nextGroup\.dateISO\)\}/.test(EMPTY));

  /**
   * ⚠ POSITION WAS THE ENTIRE DEFECT. The same sentence and jump link already
   * existed BELOW the grid, where a six-row August fills a 900px laptop and
   * pushes them off-screen. The page therefore read as an unexplained blank —
   * §50's exact complaint — while every string §50 asks for was present in
   * the HTML. A guard that only grepped for the words would have passed.
   */
  const emptyAt = CALENDAR.indexOf("<MonthEmptyState");
  const viewsAt = CALENDAR.indexOf('state.view === "month" &&');
  t("⚠ §50 — the empty state renders BEFORE the grid, not after it",
    emptyAt > 0 && emptyAt < viewsAt, `empty@${emptyAt} views@${viewsAt}`);
  /**
   * ⚠ THIS PINNED `events.length === 0`, AND THAT CONDITION WAS THE BUG.
   *
   * `events` is the whole fetched range, so a month with nothing in it inside
   * a range with plenty satisfied neither branch: no empty state, and a grid
   * of forty-two blank cells saying nothing. §50's complaint exactly — and
   * moving the panel above the grid never fixed it, because the panel did not
   * render at all. The test passed throughout, because it was checking that a
   * particular expression had been typed.
   *
   * It now asserts the INVARIANT: the trigger is scoped to the period on
   * screen, and is not the whole-range count. Both halves matter — the second
   * is what stops the old expression coming back.
   */
  t("§50 — the empty state triggers on the VISIBLE period, not the whole fetch",
    /visibleCount === 0 && state\.view !== "upcoming"/.test(CALENDAR)
      && !/events\.length === 0 && state\.view !== "upcoming"/.test(CALENDAR));
  t("§50 — and the visible count is derived from the real buckets",
    /visibleCount[\s\S]{0,400}buckets\.get\(/.test(CALENDAR));
  t("⚠ §50 — the old below-the-grid duplicate is gone",
    !/Try another month, or see what is opening[\s\S]{0,200}Jump to the first teaching week/.test(CALENDAR));

  // ⚠ ONE COMPONENT, BOTH DOORS. The modal previously passed emptyMessage and
  // no jump, so /calendar offered a way forward and the homepage did not.
  t("⚠ §50 — /calendar feeds it the real next lesson",
    /nextGroupAhead=\{jump\.kind === "session"/.test(PAGE));
  t("⚠ §50 — and so does the homepage modal, which had no jump at all",
    /nextGroupAhead=\{upcomingLesson\.kind === "session"/.test(HOME));
  t("§2 — both use the same component, not two empty states",
    !existsSync("src/components/home/HomeEmptyMonth.tsx"));

  // §66 on this surface too.
  t("⚠ §66 — the 1-to-1 line renders only when a real slot exists",
    /\{nextPrivate && \(/.test(EMPTY));
  t("⚠ §66 — with none, it asks rather than promising to find one",
    /nextPrivate \? "Find next 1-to-1" : "Ask about 1-to-1 times"/.test(EMPTY));
  const TIME_LIT = /["'>]\s*\d{1,2}[:.]\d{2}\s*(?:AM|PM|am|pm)?\s*["'<]/;
  t("⚠ §66 — no hardcoded time in the empty state", !TIME_LIT.test(code(EMPTY)),
    code(EMPTY).match(TIME_LIT)?.[0]);
  t("§53 — its controls clear 44px", (EMPTY.match(/min-h-\[44px\]/g) ?? []).length >= 3);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
