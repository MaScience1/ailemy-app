/**
 * The admin forms for 1-to-1 availability and packages (§19, §23, §24, §30).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/admin-booking-forms.test.ts
 *
 * ============================================================================
 * ⚠ NO CREDENTIALS, NO NETWORK, NO DATABASE
 * ============================================================================
 * These validators are pure functions over FormData. Everything asserted here
 * is a rule 0045 or 0047 also enforces — except one, marked below, which 0045
 * names in a constraint and does not actually check.
 *
 * ⚠ AND THE CONSTRAINT BOUNDS ARE DERIVED FROM THE MIGRATION FILES, NOT
 * RETYPED. AGENTS.md: a model of production data must be re-derived from the
 * source or it pins yesterday's behaviour. If somebody widens
 * teacher_availability_cutoff_sane from 720 to 1440, the retyped version of
 * this suite would keep asserting 720 and keep passing.
 */
import { readFileSync } from "node:fs";

import {
  readAvailabilityForm, readBlockForm, slotFitsWindow,
} from "../../../src/lib/admin/availability-form.ts";
import { readPackageForm, parseMinorUnits } from "../../../src/lib/admin/packages-form.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};

/** Reads a `CHECK (… BETWEEN lo AND hi)` bound straight out of the migration. */
function checkBounds(sql: string, constraint: string): [number, number] | null {
  const re = new RegExp(`CONSTRAINT\\s+${constraint}[\\s\\S]{0,200}?BETWEEN\\s+(\\d+)\\s+AND\\s+(\\d+)`);
  const m = sql.match(re);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const SQL_0045 = readFileSync("supabase/migrations/0045_private_availability.sql", "utf8");
const SQL_0047 = readFileSync("supabase/migrations/0047_packages_and_credits.sql", "utf8");

const fd = (o: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

const AVAIL = {
  teacher_id: "11111111-2222-3333-4444-555555555555",
  weekday: "2", start_time: "16:00", end_time: "19:00",
  timezone: "Asia/Qatar", slot_minutes: "60", buffer_minutes: "15",
  booking_horizon_days: "42", booking_cutoff_hours: "12",
};

console.log("── THE BOUNDS COME FROM THE MIGRATION, NOT FROM MEMORY ──");
const cutoff = checkBounds(SQL_0045, "teacher_availability_cutoff_sane");
const horizon = checkBounds(SQL_0045, "teacher_availability_horizon_sane");
const credits = checkBounds(SQL_0047, "tuition_packages_credits_positive");
const slotSane = checkBounds(SQL_0047, "tuition_packages_slot_sane");
{
  t("0045 declares a cutoff range", cutoff !== null, cutoff);
  t("0045 declares a horizon range", horizon !== null, horizon);
  t("0047 declares a credits range", credits !== null, credits);
  t("0047 declares a slot range", slotSane !== null, slotSane);
  // ⚠ IF ANY OF THESE IS null THE REGEX HAS DRIFTED FROM THE SQL and every
  // assertion below that uses it is vacuous. Fail loudly here rather than
  // quietly skipping.
}

console.log("\n── AVAILABILITY: RECURRING XOR ONE-OFF (0045's CHECK) ──");
{
  t("a weekly window is accepted", readAvailabilityForm(fd(AVAIL)).ok);
  const once = { ...AVAIL, specific_date: "2026-10-06" };
  delete (once as Record<string, string>).weekday;
  t("a single-date window is accepted", readAvailabilityForm(fd(once)).ok);

  const both = readAvailabilityForm(fd({ ...AVAIL, specific_date: "2026-10-06" }));
  t("both is refused", !both.ok && both.error.includes("not both"), both.ok ? "accepted" : both.error);

  const neither = { ...AVAIL } as Record<string, string>;
  delete neither.weekday;
  const n = readAvailabilityForm(fd(neither));
  t("neither is refused", !n.ok, n.ok ? "accepted" : n.error);
}

console.log("\n── AVAILABILITY: THE CHECK 0045 NAMES AND DOES NOT MAKE ──");
{
  /**
   * ⚠ THE MIGRATION IS THE EVIDENCE, NOT MY CLAIM ABOUT IT. This reads the
   * actual CHECK body for teacher_availability_slot_fits and asserts it does
   * NOT reference the window columns — so if a future migration fixes it, this
   * assertion fails and tells the reader the comment in availability-form.ts is
   * now out of date. A prose note would just rot.
   */
  const m = SQL_0045.match(/CONSTRAINT\s+teacher_availability_slot_fits\s+CHECK\s*\(([\s\S]*?)\)\s*,/);
  t("0045 has a slot_fits constraint", m !== null);
  const body = m?.[1] ?? "";
  t("…whose body never mentions start_time or end_time — it bounds the NUMBER, not the fit",
    body.length > 0 && !body.includes("start_time") && !body.includes("end_time"), body.trim());

  t("a 120-minute slot does not fit a 60-minute window", !slotFitsWindow("16:00", "17:00", 120));
  t("a 60-minute slot fits a 60-minute window exactly", slotFitsWindow("16:00", "17:00", 60));
  // ⚠ THE BUFFER MUST NOT BE REQUIRED FOR THE FIRST SLOT. Demanding 75 minutes
  // for a 60-minute lesson with a 15-minute gap would refuse the single hour a
  // teacher is most likely to publish.
  const oneHour = readAvailabilityForm(fd({ ...AVAIL, start_time: "16:00", end_time: "17:00" }));
  t("a one-hour window with a 15-minute buffer is accepted", oneHour.ok, oneHour.ok ? "" : oneHour.error);

  const tooBig = readAvailabilityForm(fd({ ...AVAIL, end_time: "17:00", slot_minutes: "120" }));
  t("the form refuses a slot longer than its window",
    !tooBig.ok && tooBig.error.includes("does not fit"), tooBig.ok ? "accepted" : tooBig.error);
}

console.log("\n── AVAILABILITY: BOUNDS MATCH THE MIGRATION ──");
{
  if (cutoff) {
    const [lo, hi] = cutoff;
    t(`cutoff ${hi} accepted (the migration's own maximum)`,
      readAvailabilityForm(fd({ ...AVAIL, booking_cutoff_hours: String(hi) })).ok);
    t(`cutoff ${hi + 1} refused`,
      !readAvailabilityForm(fd({ ...AVAIL, booking_cutoff_hours: String(hi + 1) })).ok);
    t(`cutoff ${lo - 1} refused`,
      !readAvailabilityForm(fd({ ...AVAIL, booking_cutoff_hours: String(lo - 1) })).ok);
  }
  if (horizon) {
    const [, hi] = horizon;
    t(`horizon ${hi} accepted`, readAvailabilityForm(fd({ ...AVAIL, booking_horizon_days: String(hi) })).ok);
    t(`horizon ${hi + 1} refused`, !readAvailabilityForm(fd({ ...AVAIL, booking_horizon_days: String(hi + 1) })).ok);
  }
  t("a fractional cutoff is refused",
    !readAvailabilityForm(fd({ ...AVAIL, booking_cutoff_hours: "1.5" })).ok);
  t("a blank cutoff falls back to a default rather than failing",
    readAvailabilityForm(fd({ ...AVAIL, booking_cutoff_hours: "" })).ok);
}

console.log("\n── AVAILABILITY: THE OTHER REFUSALS ──");
{
  t("a non-uuid teacher is refused before it reaches Postgres as 22P02",
    !readAvailabilityForm(fd({ ...AVAIL, teacher_id: "muhammed" })).ok);
  t("an unknown timezone is refused",
    !readAvailabilityForm(fd({ ...AVAIL, timezone: "Asia/Dohaa" })).ok);
  t("a backwards window is refused",
    !readAvailabilityForm(fd({ ...AVAIL, start_time: "19:00", end_time: "16:00" })).ok);
  t("weekday 0 is refused — that is the JS convention, not ISO",
    !readAvailabilityForm(fd({ ...AVAIL, weekday: "0" })).ok);
  t("weekday 7 (Sunday, ISO) is accepted",
    readAvailabilityForm(fd({ ...AVAIL, weekday: "7" })).ok);
  const backwards = readAvailabilityForm(fd({ ...AVAIL, valid_from: "2026-10-01", valid_until: "2026-09-01" }));
  t("a window that ends before it starts is refused", !backwards.ok);
}

console.log("\n── BLOCKS: A WALL CLOCK IS RESOLVED THROUGH THE NAMED ZONE ──");
{
  const b = readBlockForm(fd({
    teacher_id: AVAIL.teacher_id, starts_on: "2026-12-09",
    start_time: "14:00", end_time: "16:00", timezone: "Asia/Qatar",
  }));
  t("a block is accepted", b.ok, b.ok ? "" : b.error);
  // ⚠ Asia/Qatar is UTC+3 all year — no DST — so 14:00 Doha is 11:00Z. A block
  // stored at 14:00Z would silently free up the three hours a teacher blocked.
  t("14:00 Doha is stored as 11:00Z",
    b.ok && b.value.startsAtISO === "2026-12-09T11:00:00.000Z",
    b.ok ? b.value.startsAtISO : null);

  const london = readBlockForm(fd({
    teacher_id: AVAIL.teacher_id, starts_on: "2026-12-09",
    start_time: "14:00", end_time: "16:00", timezone: "Europe/London",
  }));
  t("the same wall clock in London is a different instant",
    london.ok && london.value.startsAtISO === "2026-12-09T14:00:00.000Z",
    london.ok ? london.value.startsAtISO : null);

  const whole = readBlockForm(fd({ teacher_id: AVAIL.teacher_id, starts_on: "2026-12-09" }));
  t("a bare date blocks the whole day", whole.ok);
  t("…starting at midnight Doha",
    whole.ok && whole.value.startsAtISO === "2026-12-08T21:00:00.000Z",
    whole.ok ? whole.value.startsAtISO : null);

  const zero = readBlockForm(fd({
    teacher_id: AVAIL.teacher_id, starts_on: "2026-12-09",
    start_time: "14:00", end_time: "14:00",
  }));
  t("a zero-length block is refused — it blocks nothing and looks like it worked", !zero.ok);
}

console.log("\n── PACKAGES: MONEY ──");
{
  t("45 is 4500 minor units", parseMinorUnits("45") === 4500, parseMinorUnits("45"));
  t("45.00 is 4500, not 45", parseMinorUnits("45.00") === 4500, parseMinorUnits("45.00"));
  t("45.5 is 4550", parseMinorUnits("45.5") === 4550, parseMinorUnits("45.5"));
  // ⚠ 19.99 * 100 is 1998.9999999999998 in IEEE 754. Parsed by string, it is 1999.
  t("19.99 is exactly 1999", parseMinorUnits("19.99") === 1999, parseMinorUnits("19.99"));
  t("1,250 is 125000", parseMinorUnits("1,250") === 125000, parseMinorUnits("1,250"));
  t("three decimals refused", parseMinorUnits("45.001") === null);
  t("negatives refused", parseMinorUnits("-45") === null);
  t("junk refused", parseMinorUnits("forty-five") === null);
}

const PKG = {
  name: "Single lesson", slug: "single-lesson", credits: "1",
  slot_minutes: "60", price: "45.00", currency: "GBP",
};

console.log("\n── PACKAGES: AN ACTIVE PACKAGE MUST BE BUYABLE (0047's CHECK) ──");
{
  // The rule exists in the migration; assert that first, so a change there
  // fails here rather than leaving this suite guarding a rule nobody enforces.
  t("0047 carries tuition_packages_active_needs_price",
    SQL_0047.includes("tuition_packages_active_needs_price"));

  const live = readPackageForm(fd({ ...PKG, is_active: "on" }));
  t("live with no price id is refused",
    !live.ok && live.error.includes("Stripe price id"), live.ok ? "accepted" : live.error);
  t("live WITH a price id is accepted",
    readPackageForm(fd({ ...PKG, is_active: "on", stripe_price_id: "price_1A2b3C" })).ok);
  t("draft with no price id is fine — that is how you prepare one",
    readPackageForm(fd(PKG)).ok);
  t("a prod_ id is refused — that is the product, not the price",
    !readPackageForm(fd({ ...PKG, stripe_price_id: "prod_1A2b3C" })).ok);
}

console.log("\n── PACKAGES: THE REST ──");
{
  if (credits) {
    const [lo, hi] = credits;
    t(`credits ${hi} accepted`, readPackageForm(fd({ ...PKG, credits: String(hi) })).ok);
    t(`credits ${hi + 1} refused`, !readPackageForm(fd({ ...PKG, credits: String(hi + 1) })).ok);
    t(`credits ${lo - 1} refused`, !readPackageForm(fd({ ...PKG, credits: String(lo - 1) })).ok);
  }
  if (slotSane) {
    const [lo, hi] = slotSane;
    t(`slot ${lo} accepted`, readPackageForm(fd({ ...PKG, slot_minutes: String(lo) })).ok);
    t(`slot ${lo - 1} refused`, !readPackageForm(fd({ ...PKG, slot_minutes: String(lo - 1) })).ok);
    t(`slot ${hi + 1} refused`, !readPackageForm(fd({ ...PKG, slot_minutes: String(hi + 1) })).ok);
  }
  t("a zero price is refused", !readPackageForm(fd({ ...PKG, price: "0" })).ok);
  t("an uppercase slug is lower-cased rather than refused", (() => {
    const r = readPackageForm(fd({ ...PKG, slug: "Single-Lesson" }));
    return r.ok && r.value.slug === "single-lesson";
  })());
  t("a slug with spaces is refused", !readPackageForm(fd({ ...PKG, slug: "single lesson" })).ok);
  t("a two-letter currency is refused", !readPackageForm(fd({ ...PKG, currency: "GB" })).ok);
  t("gbp is upper-cased", (() => {
    const r = readPackageForm(fd({ ...PKG, currency: "gbp" }));
    return r.ok && r.value.currency === "GBP";
  })());
  t("a blank validity means never expires", (() => {
    const r = readPackageForm(fd(PKG));
    return r.ok && r.value.validityMonths === null;
  })());
  t("a 61-month validity is refused", !readPackageForm(fd({ ...PKG, validity_months: "61" })).ok);
  t("a nameless package is refused", !readPackageForm(fd({ ...PKG, name: "" })).ok);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
