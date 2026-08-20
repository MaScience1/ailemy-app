/**
 * Turning stored facts into sentences a student reads (§47).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/notify-copy.test.ts
 *
 * ⚠ NO CREDENTIALS, NO CLOCK. describeNotification is pure: a kind, a jsonb
 * payload and a timezone in, a title and a detail out. The whole reason the
 * payload stores FACTS is so this file can be fixed later and every message
 * already sitting in somebody's panel re-renders correctly — which only holds
 * if this stays pure.
 */
import { describeNotification } from "../../../src/lib/booking/notify-copy.ts";
// ⚠ IMPORTED SO THE EXPECTATIONS ARE DERIVED, NOT RETYPED. The first version of
// this suite asserted "19:00" and went red five times — the site renders
// 12-hour ("7:00 PM", hour12:true, matching the published "7:00–9:30 PM Doha").
// The code was right and the expectation was invented. Deriving from the site's
// own formatter is not a tautology here: formatTime is a separately-tested
// dependency, and what is under test is whether describeNotification USES it
// rather than inventing a second time format.
import { formatTime, CANONICAL_TZ } from "../../../src/lib/schedule/timezone.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const DOHA = "Asia/Qatar";
const LDN = "Europe/London";
const START = "2026-10-06T16:00:00.000Z"; // 19:00 Doha, 17:00 London (BST)

const DOHA_AT = (iso: string) => formatTime(new Date(iso), CANONICAL_TZ);
const LDN_AT = (iso: string) => formatTime(new Date(iso), LDN);

console.log("── BOTH CLOCKS, WHEREVER A TIME APPEARS ──");
{
  const c = describeNotification("booking_confirmed", { startsAt: START, bookingRef: "AIL-ABCD2345" }, LDN);
  t(`the Doha time is present (${DOHA_AT(START)})`, c.detail!.includes(DOHA_AT(START)), c.detail);
  // ⚠ THE SURFACE WHERE THIS MATTERS MOST. Everywhere else the student is
  // looking at a calendar that already said which zone it means; here they are
  // reading one line.
  t(`…and the viewer's own time is too (${LDN_AT(START)})`, c.detail!.includes(LDN_AT(START)), c.detail);
  // The two must actually DIFFER, or "both clocks" proves nothing.
  t("…and the two are different strings", DOHA_AT(START) !== LDN_AT(START),
    `${DOHA_AT(START)} vs ${LDN_AT(START)}`);
  t("…and the booking reference", c.detail!.includes("AIL-ABCD2345"), c.detail);

  const solo = describeNotification("booking_confirmed", { startsAt: START }, DOHA);
  const hits = solo.detail!.split(DOHA_AT(START)).length - 1;
  t("a Doha viewer is not shown the same time twice", hits === 1, `${hits} occurrence(s) in "${solo.detail}"`);
}

console.log("\n── ⚠ AN UNKNOWN KIND MUST NOT THROW ──");
{
  /**
   * 0053's CHECK lists nine kinds. If a tenth is added to the database before a
   * template exists, this file must keep working — the alternative is that
   * inserting a row takes down /profile for everyone who has one.
   */
  let threw = false;
  let c = { title: "", detail: null as string | null };
  try { c = describeNotification("a_kind_from_the_future", {}, LDN); } catch { threw = true; }
  t("it does not throw", !threw);
  t("…it says something honest", c.title.length > 10, c.title);
  t("…and names the kind, so an operator reading a screenshot knows what is missing",
    (c.detail ?? "").includes("a_kind_from_the_future"), c.detail);
}

console.log("\n── ⚠ EVERY PAYLOAD READ IS DEFENSIVE ──");
{
  // The column is jsonb with no shape enforced and older rows are still there.
  const kinds = [
    "booking_confirmed", "booking_cancelled", "credit_restored",
    "cancellation_requested", "cancellation_resolved",
    "session_moved", "session_cancelled", "session_added", "announcement",
  ];
  t("every kind survives an EMPTY payload with a non-empty title",
    kinds.every((k) => describeNotification(k, {}, LDN).title.length > 5),
    kinds.filter((k) => describeNotification(k, {}, LDN).title.length <= 5));

  t("no output contains the string 'undefined'",
    kinds.every((k) => {
      const c = describeNotification(k, {}, LDN);
      return !c.title.includes("undefined") && !(c.detail ?? "").includes("undefined");
    }));
  t("no output contains 'null'",
    kinds.every((k) => {
      const c = describeNotification(k, {}, LDN);
      return !c.title.includes("null") && !(c.detail ?? "").includes("null");
    }));

  // ⚠ AN UNPARSEABLE DATE MUST NOT BECOME "Invalid Date" IN FRONT OF A PARENT.
  const junk = describeNotification("booking_confirmed", { startsAt: "not-a-date" }, LDN);
  t("a junk timestamp yields no Invalid Date",
    !(junk.detail ?? "").includes("Invalid"), junk.detail);
  const rolled = describeNotification("session_moved", { startsAt: "2026-02-31T10:00:00Z" }, LDN);
  t("…and neither does a date that does not exist",
    !(rolled.detail ?? "").includes("Invalid"), rolled.detail);
}

console.log("\n── THE SENTENCE 0052 EXISTS FOR ──");
{
  const c = describeNotification("cancellation_requested", {}, LDN);
  // A student who reads "requested" as "cancelled" does not turn up.
  t("a cancellation request says the lesson STAYS BOOKED",
    /stays booked/i.test(c.detail ?? ""), c.detail);
  t("…and tells them to come unless we say otherwise",
    /still come/i.test(c.detail ?? ""), c.detail);
}

console.log("\n── RESOLUTIONS READ DIFFERENTLY, BECAUSE THEY ARE DIFFERENT ──");
{
  const mk = (resolution: string, lessonCancelled: boolean) =>
    describeNotification("cancellation_resolved", { resolution, lessonCancelled }, LDN);
  t("refunded mentions a refund", /refund/i.test(mk("refunded", true).detail ?? ""));
  t("credited mentions a credit", /credit/i.test(mk("credited", true).detail ?? ""));
  t("rescheduled says we moved it", /moved/i.test(mk("rescheduled", true).detail ?? ""));
  // ⚠ THE ONE THAT MUST NOT READ AS A CANCELLATION.
  const declined = mk("declined", false);
  t("declined says the lesson is GOING AHEAD", /going ahead/i.test(declined.detail ?? ""), declined.detail);
  t("…and its title does not say the request was accepted",
    !/accepted/i.test(declined.title), declined.title);
  t("…while an accepted one does", /accepted/i.test(mk("refunded", true).title));
  t("an unknown resolution degrades to no detail rather than inventing one",
    mk("vibes", true).detail === null, mk("vibes", true).detail);
}

console.log("\n── ⚠ NOT INVENTING A PROBLEM ──");
{
  // A cash-paid lesson never had a credit; saying one was not restored would
  // tell a family something is missing when nothing is.
  const cash = describeNotification("booking_cancelled", { creditRestored: false }, LDN);
  t("a cancellation with no credit says nothing about credits", cash.detail === null, cash.detail);
  const credit = describeNotification("booking_cancelled", { creditRestored: true }, LDN);
  t("…and one with a credit says so", /credit/i.test(credit.detail ?? ""), credit.detail);
}

console.log("\n── session_moved SHOWS BOTH ENDS WHEN IT HAS THEM ──");
{
  const LATER = "2026-10-06T17:00:00.000Z";
  const both = describeNotification("session_moved",
    { previousStartsAt: START, startsAt: LATER }, DOHA);
  t("was-and-now when both are present",
    (both.detail ?? "").includes(DOHA_AT(START)) && (both.detail ?? "").includes(DOHA_AT(LATER)),
    both.detail);
  const onlyNew = describeNotification("session_moved", { startsAt: START }, DOHA);
  t("…and just the new time when the old one was not recorded",
    (onlyNew.detail ?? "").includes(DOHA_AT(START)) && !/\bWas\b/.test(onlyNew.detail ?? ""),
    onlyNew.detail);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
