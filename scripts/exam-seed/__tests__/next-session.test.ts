/**
 * A blank calendar must never feel broken.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/next-session.test.ts
 *
 * ============================================================================
 * ⚠ THE STATE THIS EXISTS FOR IS THE ONE THE SITE IS IN RIGHT NOW
 * ============================================================================
 * Teaching begins 15 September. For the whole summer the homepage calendar
 * opens on an empty August grid, and a conversion section whose first
 * impression is a blank month has argued against the product.
 *
 * Two failure modes are guarded specifically, because both would look right:
 *   - offering to jump to a CANCELLED lesson (they stay in the calendar on
 *     purpose, struck through — but one is not "the next lesson")
 *   - calling a bookable 1-to-1 SLOT the next live lesson (an offer is not an
 *     event, and it would displace the real teaching date)
 */
import {
  nextSession, daysBetween, distanceLabel,
} from "../../../src/lib/calendar/next-session.ts";
import type { CalendarEvent } from "../../../src/lib/calendar/types.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const NOW = new Date("2026-08-21T10:00:00Z");
const TODAY = "2026-08-21";
/** The real canonical-zone day key would come from grid.ts; UTC is enough here. */
const dayKeyOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * ⚠ `at` RATHER THAN `startsAt`. Spelling it startsAt collides with
 * CalendarEvent's own Date-typed field inside the Partial<>, and TypeScript
 * intersects them to `Date & string` — a type nothing can satisfy. A distinct
 * name keeps the fixture readable and the real field honestly typed.
 */
const ev = (o: Partial<CalendarEvent> & { key: string; at: string }): CalendarEvent => ({
  key: o.key,
  type: o.type ?? "group",
  status: o.status ?? "scheduled",
  startsAt: new Date(o.at),
  endsAt: new Date(new Date(o.at).getTime() + 90 * 60_000),
  title: o.title ?? "IAL Chemistry AS",
  subject: o.subject ?? "chemistry",
  qualification: "ial-as", yearGroup: null, cohortSlug: "ial-chemistry-as-sep-2026",
  teacherName: null, cancelledReason: null, kind: "teaching",
});

console.log("\n=== 1. the soonest scheduled group lesson wins ===");
{
  const r = nextSession([
    ev({ key: "c", at: "2026-10-06T16:00:00Z" }),
    ev({ key: "a", at: "2026-09-15T16:00:00Z" }),
    ev({ key: "b", at: "2026-09-19T16:00:00Z" }),
  ], NOW, dayKeyOf, TODAY);
  t("returns a session", r.kind === "session", r.kind);
  t("…the earliest one, regardless of input order",
    r.kind === "session" && r.event.key === "a", r.kind === "session" ? r.event.key : "-");
  t("…with the day it falls on", r.kind === "session" && r.dateISO === "2026-09-15",
    r.kind === "session" ? r.dateISO : "-");
  t("…and how far away it is", r.kind === "session" && r.daysAway === 25,
    r.kind === "session" ? r.daysAway : "-");
}

console.log("\n=== 2. ⚠ A CANCELLED LESSON IS NOT THE NEXT LESSON ===");
{
  const r = nextSession([
    ev({ key: "cancelled", at: "2026-09-01T16:00:00Z", status: "cancelled" }),
    ev({ key: "real", at: "2026-09-15T16:00:00Z" }),
  ], NOW, dayKeyOf, TODAY);
  t("⚠ skips the cancelled one, though it is sooner and DELIBERATELY still in the calendar",
    r.kind === "session" && r.event.key === "real", r.kind === "session" ? r.event.key : "-");
}

console.log("\n=== 3. ⚠ A BOOKABLE 1-TO-1 SLOT IS AN OFFER, NOT A LESSON ===");
{
  const r = nextSession([
    ev({ key: "slot", at: "2026-08-25T16:00:00Z", type: "private_open", title: "1-to-1 Chemistry" }),
    ev({ key: "lesson", at: "2026-09-15T16:00:00Z" }),
  ], NOW, dayKeyOf, TODAY);
  t("⚠ 'next live lesson: 1-to-1 available' is a category error — group only",
    r.kind === "session" && r.event.key === "lesson", r.kind === "session" ? r.event.key : "-");

  // CONTROL: with ONLY a slot, there is no next lesson at all — not the slot.
  const only = nextSession([
    ev({ key: "slot", at: "2026-08-25T16:00:00Z", type: "private_open" }),
  ], NOW, dayKeyOf, TODAY);
  t("CONTROL — a calendar of nothing but slots has no next lesson", only.kind === "none", only.kind);
}

console.log("\n=== 4. a finished lesson is behind you ===");
{
  const r = nextSession([
    ev({ key: "past", at: "2026-08-21T06:00:00Z" }),   // ended 07:30, now is 10:00
    ev({ key: "later", at: "2026-08-21T14:00:00Z" }),
  ], NOW, dayKeyOf, TODAY);
  t("a lesson that has already ENDED is skipped",
    r.kind === "session" && r.event.key === "later", r.kind === "session" ? r.event.key : "-");

  // ⚠ IN PROGRESS IS STILL NEXT. A lesson running right now is the one a
  // student wants to be told about, not the one after it.
  const mid = nextSession([
    ev({ key: "running", at: "2026-08-21T09:30:00Z" }), // ends 11:00
  ], NOW, dayKeyOf, TODAY);
  t("⚠ …but one IN PROGRESS still counts — it is the lesson you want to know about",
    mid.kind === "session" && mid.event.key === "running", mid.kind === "session" ? mid.event.key : "-");
}

console.log("\n=== 5. an empty calendar says what is absent, not that you are ===");
{
  const r = nextSession([], NOW, dayKeyOf, TODAY);
  t("no events → kind 'none'", r.kind === "none", r.kind);
  t("⚠ the reason is about the SCHEDULE, never about the student",
    r.kind === "none" && !/you|your/i.test(r.reason), r.kind === "none" ? r.reason : "-");
}

console.log("\n=== 6. calendar days, not 24-hour blocks ===");
{
  t("same day = 0", daysBetween("2026-08-21", "2026-08-21") === 0);
  t("next day = 1", daysBetween("2026-08-21", "2026-08-22") === 1);
  t("across a month boundary", daysBetween("2026-08-31", "2026-09-01") === 1);
  t("⚠ across the DST boundary the UK crosses on 25 Oct 2026 — still 1",
    daysBetween("2026-10-24", "2026-10-25") === 1, daysBetween("2026-10-24", "2026-10-25"));
  t("backwards is negative", daysBetween("2026-09-15", "2026-08-21") === -25);
}

console.log("\n=== 7. the human distance stays legible ===");
{
  t("today", distanceLabel(0) === "today", distanceLabel(0));
  t("tomorrow", distanceLabel(1) === "tomorrow", distanceLabel(1));
  t("under a week stays in days", distanceLabel(5) === "in 5 days", distanceLabel(5));
  t("a week", distanceLabel(7) === "next week", distanceLabel(7));
  t("⚠ 25 days is 'in 4 weeks', not 'in 25 days' — a day count that far out is arithmetic homework",
    distanceLabel(25) === "in 4 weeks", distanceLabel(25));
  t("past two months it stops counting", distanceLabel(90) === "later this term", distanceLabel(90));
  t("a past date does not say 'in -3 days'", distanceLabel(-3) === "today", distanceLabel(-3));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
