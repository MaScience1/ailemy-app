/**
 * Booking integrity: slots, holds and credits (§25, §28, §33, §61, §63).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/booking.test.ts
 *
 * ============================================================================
 * ⚠ THE FOUR RULES THIS SUITE EXISTS FOR
 * ============================================================================
 *   a slot is never offered twice          double-hold refused
 *   a payment is never counted twice       webhook retry is idempotent
 *   a credit is never spent twice, and     balance never goes negative
 *   an abandoned checkout never eats a slot expired holds release
 *
 * All pure. No credentials, no network, no clock — `now` is always passed in.
 */
import {
  openSlots, slotsForDate, isStillOpen,
  type AvailabilityRule, type Busy, type Slot,
} from "../../../src/lib/booking/slots.ts";
import {
  planHold, liveHolds, holdsAsBusy, isLive, HOLD_MINUTES, type Hold,
} from "../../../src/lib/booking/holds.ts";
import {
  balance, planSpend, planPurchase, planRestore, alreadyProcessed, type CreditTx,
} from "../../../src/lib/booking/credits.ts";
import { CANONICAL_TZ } from "../../../src/lib/schedule/timezone.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

const T = "teacher-1";
const rule = (o: Partial<AvailabilityRule> = {}): AvailabilityRule => ({
  id: "r1", teacherId: T, subject: "chemistry",
  weekday: 1, specificDate: null,
  startTime: "16:00", endTime: "19:00", timezone: CANONICAL_TZ,
  slotMinutes: 60, bufferMinutes: 15,
  validFrom: null, validUntil: null,
  bookingHorizonDays: 42, bookingCutoffHours: 12,
  isActive: true, ...o,
});
// 2026-09-21 is a Monday.
const MON = "2026-09-21";
const NOW = new Date("2026-09-01T00:00:00Z");
const at = (iso: string) => new Date(iso);

console.log("── SLOT GENERATION ──");
{
  const s = slotsForDate(rule(), MON);
  // 16:00–19:00, 60-minute slots, 15-minute buffer → advance by 75 minutes.
  // 16:00, 17:15, 18:30 does not fit (ends 19:30). So two.
  t("16:00–19:00 with 60min+15min buffer yields 2 slots", s.length === 2, s.map((x) => x.startsAt.toISOString()));
  t("…first at 16:00 Doha = 13:00Z", s[0].startsAt.toISOString() === "2026-09-21T13:00:00.000Z", s[0]?.startsAt.toISOString());
  t("…second at 17:15, not 17:00 — the buffer advances the cursor",
    s[1].startsAt.toISOString() === "2026-09-21T14:15:00.000Z", s[1]?.startsAt.toISOString());
  t("…each exactly 60 minutes", s.every((x) => x.endsAt.getTime() - x.startsAt.getTime() === 3600_000));
  t("with no buffer, three slots fit", slotsForDate(rule({ bufferMinutes: 0 }), MON).length === 3);
  t("a Tuesday produces nothing from a Monday rule", slotsForDate(rule(), "2026-09-22").length === 0);
  t("an inactive rule produces nothing", slotsForDate(rule({ isActive: false }), MON).length === 0);
  t("a rule outside its validity produces nothing",
    slotsForDate(rule({ validFrom: "2026-10-01" }), MON).length === 0);
  t("a one-off rule fires only on its date",
    slotsForDate(rule({ weekday: null, specificDate: MON }), MON).length === 2 &&
    slotsForDate(rule({ weekday: null, specificDate: MON }), "2026-09-28").length === 0);
  // ⚠ 0045's CHECK forbids it; a row that slipped through must generate NOTHING.
  t("a rule with neither weekday nor date generates nothing, not everything",
    slotsForDate(rule({ weekday: null, specificDate: null }), MON).length === 0);
  t("a slot longer than its window yields nothing",
    slotsForDate(rule({ slotMinutes: 300 }), MON).length === 0);
}

console.log("\n── §25 A PRIVATE SLOT NEVER OVERLAPS A GROUP LESSON ──");
{
  const rules = [rule()];
  const base = openSlots({ rules, busy: [], from: MON, to: MON, now: NOW });
  t("both slots open with nothing in the way", base.length === 2);

  // ⚠ THE FIXTURE IS CHOSEN CAREFULLY, AND THE FIRST ONE WAS NOT. A 14:00–16:00Z
  // lesson buffers out to 13:45–16:15Z, which clips the TAIL of the 13:00 slot
  // as well as covering the 14:15 one — so it correctly removed both, and the
  // assertion that expected one survivor was wrong, not the code. This lesson
  // sits exactly on the second slot: buffered to 14:00–15:30Z, it leaves the
  // 13:00–14:00 slot untouched because the ranges only touch.
  const group: Busy = { startsAt: at("2026-09-21T14:15:00Z"), endsAt: at("2026-09-21T15:15:00Z"), kind: "group" };
  const withGroup = openSlots({ rules, busy: [group], from: MON, to: MON, now: NOW });
  t("a group lesson removes the slot it covers", withGroup.length === 1, withGroup.map((s) => s.startsAt.toISOString()));
  t("…and the surviving one is 16:00 Doha",
    withGroup[0]?.startsAt.toISOString() === "2026-09-21T13:00:00.000Z", withGroup[0]?.startsAt.toISOString());

  // …and a lesson wide enough to buffer over BOTH removes both. That is the
  // case that misled the first fixture, asserted deliberately.
  const wide: Busy = { startsAt: at("2026-09-21T14:00:00Z"), endsAt: at("2026-09-21T16:00:00Z"), kind: "group" };
  t("a lesson whose buffer reaches back into an earlier slot removes that too",
    openSlots({ rules, busy: [wide], from: MON, to: MON, now: NOW }).length === 0);

  // ⚠ THE BUFFER EXPANDS THE OBSTACLE. A group lesson ending 13:10Z is 50
  // minutes clear of the 14:15Z slot but only 5 minutes from the 13:00Z one.
  const tight: Busy = { startsAt: at("2026-09-21T12:00:00Z"), endsAt: at("2026-09-21T13:10:00Z"), kind: "group" };
  const withTight = openSlots({ rules, busy: [tight], from: MON, to: MON, now: NOW });
  t("a lesson ending 10 min into a slot removes it", !withTight.some((s) => s.startsAt.toISOString() === "2026-09-21T13:00:00.000Z"));

  const near: Busy = { startsAt: at("2026-09-21T11:00:00Z"), endsAt: at("2026-09-21T12:50:00Z"), kind: "group" };
  t("…and one ending 10 min BEFORE a slot also removes it — buffer is 15",
    !openSlots({ rules, busy: [near], from: MON, to: MON, now: NOW })
      .some((s) => s.startsAt.toISOString() === "2026-09-21T13:00:00.000Z"));
  const clear: Busy = { startsAt: at("2026-09-21T11:00:00Z"), endsAt: at("2026-09-21T12:44:00Z"), kind: "group" };
  t("…but one ending 16 min before does NOT — the bound is where it claims",
    openSlots({ rules, busy: [clear], from: MON, to: MON, now: NOW })
      .some((s) => s.startsAt.toISOString() === "2026-09-21T13:00:00.000Z"));

  for (const kind of ["block", "booking", "hold"] as const) {
    t(`a ${kind} removes a slot just as a group lesson does`,
      openSlots({ rules, busy: [{ ...group, kind }], from: MON, to: MON, now: NOW }).length === 1);
  }
  t("…and the generator is blind to which kind it was — all four behave alike",
    new Set((["block","group","booking","hold"] as const).map((kind) =>
      openSlots({ rules, busy: [{ ...group, kind }], from: MON, to: MON, now: NOW }).length)).size === 1);
}

console.log("\n── §24 HORIZON AND CUTOFF ──");
{
  const rules = [rule()];
  t("a slot inside the cutoff is not offered",
    openSlots({ rules, busy: [], from: MON, to: MON, now: at("2026-09-21T06:00:00Z") }).length === 0);
  t("…and outside it, it is",
    openSlots({ rules, busy: [], from: MON, to: MON, now: at("2026-09-20T00:00:00Z") }).length === 2);
  t("beyond the booking horizon nothing is offered",
    openSlots({ rules: [rule({ bookingHorizonDays: 5 })], busy: [], from: MON, to: MON, now: NOW }).length === 0);
  t("…and within it, slots appear",
    openSlots({ rules: [rule({ bookingHorizonDays: 60 })], busy: [], from: MON, to: MON, now: NOW }).length === 2);
}

console.log("\n── NO AVAILABILITY MEANS NO SLOTS (no fake slots) ──");
{
  t("no rules, no slots", openSlots({ rules: [], busy: [], from: MON, to: "2026-12-31", now: NOW }).length === 0);
  t("a subject filter excludes another subject's rule",
    openSlots({ rules: [rule({ subject: "biology" })], busy: [], from: MON, to: MON, now: NOW, subject: "chemistry" }).length === 0);
  t("…and a null-subject rule matches any subject",
    openSlots({ rules: [rule({ subject: null })], busy: [], from: MON, to: MON, now: NOW, subject: "chemistry" }).length === 2);
}

console.log("\n── §28 DOUBLE-HOLD IS REFUSED ──");
const slot: Slot = openSlots({ rules: [rule()], busy: [], from: MON, to: MON, now: NOW })[0];
{
  const first = planHold({ slot, email: "a@example.test", userId: null, existingHolds: [], now: NOW });
  t("the first hold succeeds", first.ok === true);
  if (!first.ok) throw new Error("fixture broke");
  const held: Hold = { id: "h1", ...first.hold };
  t("…and expires in 15 minutes", held.expiresAt.getTime() - NOW.getTime() === HOLD_MINUTES * 60_000);

  // ⚠ THE SABOTAGE THE SPEC NAMES.
  const second = planHold({ slot, email: "b@example.test", userId: null, existingHolds: [held], now: NOW });
  t("a SECOND student cannot hold the same slot", second.ok === false, second);
  t("…and is told when it frees up", !second.ok && second.reason === "already-held");

  // ⚠ RE-HOLDING YOUR OWN IS NOT A DOUBLE-HOLD — a refresh must not lock you out.
  const same = planHold({ slot, email: "A@Example.TEST", userId: null, existingHolds: [held], now: NOW });
  t("the SAME student re-holding is allowed, case-insensitively", same.ok === true, same);

  const other = openSlots({ rules: [rule()], busy: [], from: MON, to: MON, now: NOW })[1];
  t("a different slot is unaffected",
    planHold({ slot: other, email: "b@example.test", userId: null, existingHolds: [held], now: NOW }).ok === true);
}

console.log("\n── §28 AN EXPIRED HOLD RELEASES THE SLOT ──");
{
  const stale: Hold = {
    id: "h2", teacherId: T, userId: null, email: "gone@example.test",
    startsAt: slot.startsAt, endsAt: slot.endsAt,
    expiresAt: at("2026-09-01T00:10:00Z"), checkoutRef: null,
  };
  const later = at("2026-09-01T00:20:00Z");
  t("it is live before its deadline", isLive(stale, NOW));
  t("…and not after", !isLive(stale, later));
  t("liveHolds drops it", liveHolds([stale], later).length === 0);
  // ⚠ EXPIRY IS EVALUATED ON READ. No sweep job has run; the slot is back
  // simply because nothing live is standing on it.
  t("the slot is bookable again with no cleanup job",
    openSlots({ rules: [rule()], busy: holdsAsBusy([stale], later), from: MON, to: MON, now: NOW })
      .some((s) => s.key === slot.key));
  t("…while it was NOT, before expiry",
    !openSlots({ rules: [rule()], busy: holdsAsBusy([stale], NOW), from: MON, to: MON, now: NOW })
      .some((s) => s.key === slot.key));
  t("and another student may hold it once stale",
    planHold({ slot, email: "b@example.test", userId: null, existingHolds: [stale], now: later }).ok === true);
}

console.log("\n── §25 RE-CHECK AT SUBMIT TIME ──");
{
  t("a slot the browser saw is still open when nothing changed",
    isStillOpen(slot, [rule()], [], NOW));
  t("…and is NOT once someone booked it",
    !isStillOpen(slot, [rule()], [{ startsAt: slot.startsAt, endsAt: slot.endsAt, kind: "booking" }], NOW));
}

console.log("\n── §33 CREDITS: NEVER NEGATIVE, NEVER SPENT TWICE ──");
const tx = (o: Partial<CreditTx>): CreditTx => ({
  id: Math.random().toString(36).slice(2), userId: "u1", delta: 1, reason: "purchase",
  bookingId: null, idempotencyKey: null, expiresAt: null,
  createdAt: "2026-09-01T00:00:00.000Z", ...o,
});
{
  t("an empty ledger is zero", balance([], NOW) === 0);
  t("+4 then -1 is 3", balance([tx({ delta: 4 }), tx({ delta: -1, reason: "booking" })], NOW) === 3);

  // ⚠ THE SABOTAGE. No credits must refuse, not go negative.
  const none = planSpend([], "u1", "b1", NOW);
  t("spending with no credits is REFUSED", none.ok === false, none);
  t("…and reports the balance, which is 0", !none.ok && none.reason === "no-credits" && none.balance === 0);
  const spent = planSpend([tx({ delta: 1 }), tx({ delta: -1, reason: "booking", bookingId: "b0" })], "u1", "b1", NOW);
  t("a balance of exactly 0 still refuses", spent.ok === false, spent);

  const ok = planSpend([tx({ delta: 4 })], "u1", "b1", NOW);
  t("with credits it plans exactly -1", ok.ok === true && ok.tx.delta === -1, ok);
  t("…tagged to the booking", ok.ok && ok.tx.bookingId === "b1");

  // ⚠ ONE CREDIT PER BOOKING, EVEN ON A REPLAY.
  const twice = planSpend([tx({ delta: 4 }), tx({ delta: -1, reason: "booking", bookingId: "b1" })], "u1", "b1", NOW);
  t("the same booking cannot consume a second credit", twice.ok === false, twice);
  t("…and says so rather than 'no credits' — the student has 3",
    !twice.ok && twice.reason === "already-spent-on-this-booking");
}

console.log("\n── EXPIRY DROPS THE PURCHASE, NOT THE SPEND ──");
{
  const later = at("2027-01-01T00:00:00Z");
  const led = [
    tx({ delta: 4, expiresAt: "2026-12-01T00:00:00.000Z" }),
    tx({ delta: -1, reason: "booking", bookingId: "b1" }),
  ];
  t("before expiry the balance is 3", balance(led, NOW) === 3);
  // ⚠ Dropping the -1 too would hand back a credit already used.
  t("after expiry it is -1, not 0 — the spend still counts", balance(led, later) === -1, balance(led, later));
  t("…so planSpend refuses", planSpend(led, "u1", "b2", later).ok === false);

  /**
   * ⚠ THE ASSERTION ABOVE DOES NOT PROVE THE `delta > 0` GUARD, AND THE FIRST
   * VERSION OF THIS BLOCK STOPPED THERE.
   *
   * Sabotaging balance() to expire EVERY row rather than only credits left the
   * suite green: the -1 above carries expiresAt null, so an expiry check that
   * ignores the sign never reaches it. A guard nothing exercises is a guard
   * nobody has shown to work.
   *
   * A debit with an expiry is unusual but entirely legal — an admin adjustment
   * or an expiry sweep can carry one — and it is exactly the row that
   * distinguishes the two implementations. A spend must NEVER stop counting.
   */
  const withExpiringDebit = [
    tx({ delta: 4, expiresAt: null }),
    tx({ delta: -1, reason: "booking", bookingId: "b1", expiresAt: "2026-12-01T00:00:00.000Z" }),
  ];
  t("a DEBIT carrying an expiry still counts after that date — only credits lapse",
    balance(withExpiringDebit, later) === 3, balance(withExpiringDebit, later));
  t("…and counted before it too, unchanged", balance(withExpiringDebit, NOW) === 3);
}

console.log("\n── §63 A WEBHOOK RETRY IS IDEMPOTENT ──");
{
  const p1 = planPurchase({ userId: "u1", credits: 4, eventId: "evt_1", packageId: "p1", validityMonths: null, now: NOW });
  const p2 = planPurchase({ userId: "u1", credits: 4, eventId: "evt_1", packageId: "p1", validityMonths: null, now: NOW });
  t("a purchase plans +4", p1.ok === true && p1.tx.delta === 4);
  // ⚠ THE KEY IS WHAT MAKES THE RETRY SAFE — identical for the same event, so
  // 0047's unique index refuses the second insert.
  t("the same event yields the SAME idempotency key",
    p1.ok && p2.ok && p1.tx.idempotencyKey === p2.tx.idempotencyKey, p1.ok ? p1.tx.idempotencyKey : null);
  const p3 = planPurchase({ userId: "u1", credits: 4, eventId: "evt_2", packageId: "p1", validityMonths: null, now: NOW });
  t("a DIFFERENT event yields a different key",
    p1.ok && p3.ok && p1.tx.idempotencyKey !== p3.tx.idempotencyKey);
  t("the key is namespaced to the provider", p1.ok && p1.tx.idempotencyKey === "stripe:evt_1");
  t("zero or negative credits are refused", planPurchase({ userId: "u1", credits: 0, eventId: "e", packageId: null, validityMonths: null, now: NOW }).ok === false);
  const exp = planPurchase({ userId: "u1", credits: 4, eventId: "e", packageId: null, validityMonths: 6, now: NOW });
  t("validity months become a real expiry", exp.ok && exp.tx.expiresAt !== null, exp.ok ? exp.tx.expiresAt : null);
  t("…and no validity means no expiry", p1.ok && p1.tx.expiresAt === null);
  t("alreadyProcessed spots a replay", alreadyProcessed(["evt_1"], "evt_1") && !alreadyProcessed(["evt_1"], "evt_2"));
}

console.log("\n── §39 A TEACHER CANCELLATION RESTORES ONE CREDIT, ONCE ──");
{
  const led = [tx({ delta: 4 }), tx({ delta: -1, reason: "booking", bookingId: "b1" })];
  const r = planRestore(led, "u1", "b1");
  t("it plans +1", r.ok === true && r.tx.delta === 1, r);
  t("…tagged to the booking, with its own key", r.ok && r.tx.bookingId === "b1" && r.tx.idempotencyKey === "restore:b1");
  // ⚠ A CASH BOOKING MUST NOT MINT A CREDIT FROM NOTHING.
  t("a booking that consumed no credit restores nothing",
    planRestore([tx({ delta: 4 })], "u1", "b9").ok === false);
  const done = [...led, tx({ delta: 1, reason: "cancellation_refund", bookingId: "b1" })];
  t("…and it cannot be restored twice", planRestore(done, "u1", "b1").ok === false);
  t("the balance after restore is back to 4", balance(done, NOW) === 4, balance(done, NOW));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
