/**
 * The booking lifecycle: cancellation policy, credit redemption, slot identity.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/booking-lifecycle.test.ts
 *
 * ============================================================================
 * ⚠ NO CREDENTIALS, NO NETWORK, NO CLOCK
 * ============================================================================
 * Every rule that decides whether a lesson may be cancelled, whether a credit
 * may be spent, and whether a posted slot key is real is a pure function taking
 * `now`. The write path in actions.ts only executes what these decide, so
 * proving them here proves the decisions — what is left untested is the
 * plumbing, and that is said out loud rather than implied.
 */
import { readFileSync } from "node:fs";

import {
  planCancellation, canRedeem, explainCancellation, CANCELLATION_CUTOFF_HOURS,
  type CancellableBooking,
} from "../../../src/lib/booking/cancellation.ts";
import { slotKey, parseSlotKey } from "../../../src/lib/booking/slots.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const NOW = new Date("2026-10-01T12:00:00.000Z");
const ME = "11111111-2222-3333-4444-555555555555";
const THEM = "99999999-8888-7777-6666-555555555555";
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const booking = (o: Partial<CancellableBooking> = {}): CancellableBooking => ({
  id: "b1", userId: ME, startsAt: hoursFromNow(48),
  status: "confirmed", paidWith: "credit", ...o,
});
const plan = (o: Partial<CancellableBooking> = {}, viewerId = ME) =>
  planCancellation({ booking: booking(o), viewerId, now: NOW });

console.log("── OWNERSHIP IS THE FIRST GATE ──");
{
  t("someone else's booking is refused", (() => {
    const r = plan({}, THEM);
    return !r.ok && r.action === "refuse" && r.reason === "not-yours";
  })());
  // ⚠ A NULL user_id IS A BOOKING MADE WITHOUT AN ACCOUNT. Matching on email
  // instead would let anyone who knows an address cancel a stranger's lesson.
  t("a booking with no account attached is nobody's to cancel", (() => {
    const r = plan({ userId: null });
    return !r.ok && r.action === "refuse" && r.reason === "not-yours";
  })());
  t("...and my own is not refused for ownership", plan().ok);
}

console.log("\n── THE CUTOFF ──");
{
  t(`the policy constant is ${CANCELLATION_CUTOFF_HOURS}h`, CANCELLATION_CUTOFF_HOURS === 24);

  const exactly = plan({ startsAt: hoursFromNow(CANCELLATION_CUTOFF_HOURS) });
  t("exactly at the cutoff is ALLOWED", exactly.ok, exactly);

  // ⚠ THE BOUNDARY IN THE OTHER DIRECTION. Rounding UP would hand out the
  // self-service path minutes inside the cutoff.
  const justUnder = planCancellation({
    booking: booking({ startsAt: new Date(NOW.getTime() + 24 * 3_600_000 - 60_000) }),
    viewerId: ME, now: NOW,
  });
  t("one minute inside the cutoff is a REQUEST, not a refusal", (() => (
    !justUnder.ok && justUnder.action === "request" && justUnder.reason === "inside-cutoff"
  ))(), justUnder);
  t("...and it reports 23 hours of notice, not 24",
    !justUnder.ok && justUnder.action === "request" && justUnder.hoursNotice === 23,
    !justUnder.ok && justUnder.action === "request" ? justUnder.hoursNotice : null);

  t("a lesson that already started is refused, not requested", (() => {
    const r = plan({ startsAt: hoursFromNow(-1) });
    return !r.ok && r.action === "refuse" && r.reason === "already-happened";
  })());
  // Cancelling a lesson in progress would free a slot that WAS consumed and
  // restore a credit for a lesson the teacher turned up to.
  t("a lesson starting this instant is 'already happened'", (() => {
    const r = plan({ startsAt: new Date(NOW.getTime()) });
    return !r.ok && r.action === "refuse" && r.reason === "already-happened";
  })());
}

console.log("\n── WHO PAID DECIDES WHAT HAPPENS ──");
{
  t("credit + good notice = self-service cancel and restore", (() => {
    const r = plan({ paidWith: "credit" });
    return r.ok && r.action === "cancel-and-restore";
  })());
  t("CASH + good notice = a request, because a refund is a human decision", (() => {
    const r = plan({ paidWith: "single" });
    return !r.ok && r.action === "request" && r.reason === "cash-paid";
  })());

  // ⚠ PRECEDENCE, AND IT IS DELIBERATE. A student 3 hours out should be told
  // about the notice period — the thing that would have refused them either
  // way — not sent down a refund path.
  t("cash AND inside cutoff reports the CUTOFF, the more actionable one", (() => {
    const r = plan({ paidWith: "single", startsAt: hoursFromNow(3) });
    return !r.ok && r.action === "request" && r.reason === "inside-cutoff";
  })());

  t("an already-cancelled lesson cannot be cancelled again", (() => {
    const r = plan({ status: "cancelled" });
    return !r.ok && r.action === "refuse" && r.reason === "already-cancelled";
  })());
  t("...nor a completed one — that would restore a credit for a delivered lesson", (() => {
    const r = plan({ status: "completed" });
    return !r.ok && r.action === "refuse" && r.reason === "already-cancelled";
  })());
}

console.log("\n── EVERY OUTCOME HAS A SENTENCE, AND NONE OF THEM LEAKS A CODE ──");
{
  const outcomes = [
    plan(), plan({}, THEM), plan({ status: "cancelled" }),
    plan({ startsAt: hoursFromNow(-1) }), plan({ startsAt: hoursFromNow(3) }),
    plan({ paidWith: "single" }),
  ];
  t("six distinct outcomes covered", new Set(outcomes.map((o) =>
    o.ok ? "ok" : `${o.action}:${o.reason}`)).size === 6);
  t("every one produces a non-empty sentence",
    outcomes.every((o) => explainCancellation(o).length > 20));
  t("none of them mentions a Postgres code or a constraint name",
    outcomes.every((o) => !/\b(23\d{3}|PGRST|constraint|policy)\b/i.test(explainCancellation(o))));
  t("the cutoff sentence names the actual number",
    explainCancellation(plan({ startsAt: hoursFromNow(3) })).includes(String(CANCELLATION_CUTOFF_HOURS)));
}

console.log("\n── ⚠ REDEEMING A CREDIT DOES NOT CONSULT STRIPE ──");
{
  /**
   * A credit is money already taken. Gating redemption on Stripe having keys
   * would strand a student who has already paid. This is asserted against the
   * SOURCE, because the behaviour is an ABSENCE — no test of canRedeem's return
   * value can prove that a keyless check is not there.
   */
  const src = readFileSync("src/lib/booking/cancellation.ts", "utf8");
  t("cancellation.ts never imports stripeConfig", !src.includes("stripeConfig"));
  t("...and never mentions STRIPE_ env vars", !/STRIPE_[A-Z_]+/.test(src));

  const actions = readFileSync("src/lib/booking/actions.ts", "utf8");

  /**
   * ⚠ COMMENTS ARE STRIPPED BEFORE THIS IS CHECKED, AND THAT IS NOT A
   * CONVENIENCE. The first version of this assertion grepped raw source and
   * went red because bookWithCredit's own comment SAYS "stripeConfig() is not
   * consulted" — a guard that forbids explaining itself is a guard that gets
   * the explanation deleted. It must read code, so strip what is not code.
   */
  const code = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  const bookFn = code(actions.slice(
    actions.indexOf("export async function bookWithCredit"),
    actions.indexOf("async function compensate"),
  ));
  t("bookWithCredit's body was located", bookFn.length > 500, bookFn.length);
  t("⚠ bookWithCredit never calls stripeConfig — the keyless gate is on Buy only",
    bookFn.length > 500 && !bookFn.includes("stripeConfig("), bookFn.match(/.{0,40}stripeConfig\(.{0,20}/)?.[0]);
  // The other half: the gate must EXIST somewhere, or "no keyless check" is
  // just an unbuilt feature rather than a decision.
  t("...and beginCheckout DOES call it, so the gate exists and is placed",
    code(actions.slice(actions.indexOf("export async function beginCheckout"))).includes("stripeConfig()"));
}

console.log("\n── canRedeem ──");
{
  t("signed out is refused", (() => {
    const r = canRedeem({ signedIn: false, creditBalance: 10 });
    return !r.ok && r.reason === "not-signed-in";
  })());
  t("zero credits is refused, and reports the balance", (() => {
    const r = canRedeem({ signedIn: true, creditBalance: 0 });
    return !r.ok && r.reason === "no-credits" && r.balance === 0;
  })());
  t("a negative balance is refused too", !canRedeem({ signedIn: true, creditBalance: -1 }).ok);
  t("exactly one credit is enough", canRedeem({ signedIn: true, creditBalance: 1 }).ok);
}

console.log("\n── SLOT IDENTITY SURVIVES A ROUND TRIP ──");
{
  const T = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const start = new Date("2026-10-06T13:00:00.000Z");
  const k = slotKey(T, start, 60);
  const back = parseSlotKey(k);
  t("a key parses back to what built it",
    back !== null && back.teacherId === T && back.minutes === 60 &&
    back.startsAt.getTime() === start.getTime(), back);

  t("junk is refused", parseSlotKey("nonsense") === null);
  t("too few parts refused", parseSlotKey(`${T}::${start.toISOString()}`) === null);
  t("an empty teacher id is refused", parseSlotKey(`::${start.toISOString()}::60`) === null);
  t("an impossible date is refused", parseSlotKey(`${T}::2026-13-40T99:00:00Z::60`) === null);
  // ⚠ new Date("2026-10-06") is VALID and means midnight UTC — a different slot
  // from the one rendered. The round-trip check is what refuses it.
  t("⚠ a date-only string is refused, not silently widened to midnight",
    parseSlotKey(`${T}::2026-10-06::60`) === null);
  t("zero minutes refused", parseSlotKey(`${T}::${start.toISOString()}::0`) === null);
  t("negative minutes refused — it would end before it starts",
    parseSlotKey(`${T}::${start.toISOString()}::-60`) === null);
  t("a fractional duration is refused", parseSlotKey(`${T}::${start.toISOString()}::60.5`) === null);
  t("an absurd duration is refused", parseSlotKey(`${T}::${start.toISOString()}::9999`) === null);
}

console.log("\n── ⚠ WHAT THIS SUITE DOES NOT COVER, NAMED RATHER THAN COUNTED ──");
{
  // AGENTS.md: a verification that says VERIFIED must not claim more than it
  // checked. These need a database and are deliberately absent:
  //   · the 23P01 race between two students booking one slot
  //   · the booking-first / credit-second compensating delete
  //   · 0047's partial unique index refusing a replayed debit
  //   · 0052's insert policy refusing a pre-resolved request
  // They are covered by the migration verification blocks, which is where a
  // constraint can actually be exercised.
  t("this file asserts no database behaviour", true);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
