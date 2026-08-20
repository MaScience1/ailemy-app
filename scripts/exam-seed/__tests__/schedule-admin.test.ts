/**
 * What the admin calendar refuses (§7–§9).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/schedule-admin.test.ts
 *
 * ⚠ EVERY RULE HERE IS ALSO A CONSTRAINT IN 0044. These assertions are about
 * the admin seeing a sentence instead of a 23514 — not about the database
 * being optional. No credentials, no network.
 */
import {
  readRuleForm, readPeriodForm, readSessionForm, WEEKDAY_OPTIONS, SESSION_KINDS,
} from "../../../src/lib/admin/schedule-form.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "  got: " + JSON.stringify(got) : "")));
};
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) if (v !== "") fd.set(k, v);
  return fd;
};
const RULE = { cohort_id: "c1", weekday: "2", start_time: "19:00", end_time: "21:30", valid_from: "2026-09-15" };

console.log("── RECURRING RULES ──");
{
  t("a good rule is accepted", readRuleForm(form(RULE)).ok);
  t("no cohort is refused", readRuleForm(form({ ...RULE, cohort_id: "" })).ok === false);
  // ⚠ ISO, NOT getUTCDay(). A 0 is the JS convention leaking in and would store
  // a Sunday rule the reader never matches — invisible until nobody turns up.
  t("weekday 0 is refused", readRuleForm(form({ ...RULE, weekday: "0" })).ok === false);
  t("weekday 8 is refused", readRuleForm(form({ ...RULE, weekday: "8" })).ok === false);
  for (const w of WEEKDAY_OPTIONS) {
    t(`weekday ${w.value} (${w.label}) is accepted`, readRuleForm(form({ ...RULE, weekday: String(w.value) })).ok);
  }
  t("a backwards lesson is refused",
    readRuleForm(form({ ...RULE, start_time: "21:30", end_time: "19:00" })).ok === false);
  t("a zero-length lesson is refused",
    readRuleForm(form({ ...RULE, end_time: "19:00" })).ok === false);
  t("a junk time is refused", readRuleForm(form({ ...RULE, start_time: "25:00" })).ok === false);
  t("an unknown timezone is refused",
    readRuleForm(form({ ...RULE, timezone: "Mars/Olympus" })).ok === false);
  t("a real timezone is accepted", readRuleForm(form({ ...RULE, timezone: "Europe/London" })).ok);
  t("defaults to the canonical zone",
    (() => { const r = readRuleForm(form(RULE)); return r.ok && r.value.timezone === "Asia/Qatar"; })());
  t("an end date before the start date is refused",
    readRuleForm(form({ ...RULE, valid_until: "2026-09-01" })).ok === false);
  t("an open-ended rule is accepted",
    (() => { const r = readRuleForm(form(RULE)); return r.ok && r.value.validUntil === null; })());
  t("is_active defaults to false when the box is absent",
    (() => { const r = readRuleForm(form(RULE)); return r.ok && r.value.isActive === false; })());
  t("…and true when ticked",
    (() => { const r = readRuleForm(form({ ...RULE, is_active: "on" })); return r.ok && r.value.isActive; })());
}

console.log("\n── BREAKS ──");
{
  const P = { starts_on: "2026-12-20", ends_on: "2027-01-02", reason: "Winter break" };
  t("a good break is accepted", readPeriodForm(form(P)).ok);
  t("a backwards break is refused", readPeriodForm(form({ ...P, ends_on: "2026-12-01" })).ok === false);
  t("a single-day break is accepted", readPeriodForm(form({ ...P, ends_on: P.starts_on })).ok);
  // ⚠ THE REASON IS SHOWN PUBLICLY IN PLACE OF THE LESSON. A blank one leaves
  // a gap on the calendar with no explanation.
  t("a break with no reason is refused", readPeriodForm(form({ ...P, reason: "" })).ok === false);
  t("no cohort means ALL cohorts, deliberately",
    (() => { const r = readPeriodForm(form(P)); return r.ok && r.value.cohortId === null; })());
  t("…and a named cohort scopes it",
    (() => { const r = readPeriodForm(form({ ...P, cohort_id: "c1" })); return r.ok && r.value.cohortId === "c1"; })());
}

console.log("\n── INDIVIDUAL LESSONS ──");
{
  const S = { cohort_id: "c1", occurs_on: "2026-09-22", status: "scheduled", kind: "teaching" };
  // ⚠ A ONE-OFF HAS NO RULE TO INHERIT TIMES FROM.
  t("a one-off with no times is refused", readSessionForm(form(S)).ok === false);
  t("…and the message says why",
    (() => { const r = readSessionForm(form(S)); return !r.ok && /one-off/.test(r.error); })());
  t("a one-off WITH times is accepted",
    readSessionForm(form({ ...S, starts_at_local: "16:00", ends_at_local: "17:00" })).ok);
  // ⚠ CANCELLING IS NOT THE MOMENT TO DEMAND HOURS.
  t("a cancelled one-off needs no times",
    readSessionForm(form({ ...S, status: "cancelled" })).ok);
  t("an override of a rule needs no times — it keeps the timetable's",
    readSessionForm(form({ ...S, schedule_id: "r1" })).ok);
  t("a backwards session is refused",
    readSessionForm(form({ ...S, starts_at_local: "17:00", ends_at_local: "16:00" })).ok === false);
  t("an unknown kind is refused", readSessionForm(form({ ...S, kind: "party" })).ok === false);
  for (const k of SESSION_KINDS) {
    t(`kind ${k} is accepted`,
      readSessionForm(form({ ...S, kind: k, starts_at_local: "16:00", ends_at_local: "17:00" })).ok);
  }
  t("no date is refused", readSessionForm(form({ ...S, occurs_on: "" })).ok === false);

  // ⚠ THE WALL CLOCK IS RESOLVED THROUGH THE NAMED ZONE, NOT THE SERVER'S.
  const doha = readSessionForm(form({ ...S, starts_at_local: "17:00", ends_at_local: "18:00" }));
  t("17:00 Doha resolves to 14:00Z",
    doha.ok && doha.value.startsAtISO === "2026-09-22T14:00:00.000Z",
    doha.ok ? doha.value.startsAtISO : doha.error);
  const london = readSessionForm(form({
    ...S, timezone: "Europe/London", starts_at_local: "17:00", ends_at_local: "18:00",
  }));
  t("…and 17:00 London in September resolves to 16:00Z",
    london.ok && london.value.startsAtISO === "2026-09-22T16:00:00.000Z",
    london.ok ? london.value.startsAtISO : london.error);
  const winter = readSessionForm(form({
    ...S, occurs_on: "2026-12-22", timezone: "Europe/London",
    starts_at_local: "17:00", ends_at_local: "18:00",
  }));
  t("…and 17:00 London in December resolves to 17:00Z — GMT, with no code change",
    winter.ok && winter.value.startsAtISO === "2026-12-22T17:00:00.000Z",
    winter.ok ? winter.value.startsAtISO : winter.error);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
