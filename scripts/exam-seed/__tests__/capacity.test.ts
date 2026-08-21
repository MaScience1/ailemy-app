/**
 * Scarcity may only be shown when it is real.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/capacity.test.ts
 *
 * ============================================================================
 * ⚠ THE BRIEF SAYS "DO NOT CREATE FAKE SCARCITY", AND THERE ARE THREE WAYS TO
 * ============================================================================
 *   1. Render a number from a FAILED read — "20 places left" because the RPC
 *      errored and something did `?? 0`.
 *   2. Render a number that is true and misleading — "20 places left" on a
 *      cohort where nobody has enrolled reads as an empty room, not as space.
 *   3. Render urgency before it exists — "few left" at 3 of 20.
 *
 * All three are asserted. The first is the dangerous one because it looks
 * identical to the truth.
 */
import { describeCapacity, FEW_LEFT_FRACTION, SPEAK_AFTER_FRACTION } from "../../../src/lib/public/capacity-rules.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};
const CAP = 20;   // the real Group A cap

console.log("\n=== 1. ⚠ AN EMPTY COHORT SAYS NOTHING ===");
{
  const c = describeCapacity(0, CAP);
  t("known, but quiet", c.known === true && c.state === "quiet", c.known ? c.state : "unknown");
  t("⚠ …and renders NO label — '20 places left' on an empty cohort reads as an empty room",
    c.known === true && c.label === null, c.known ? c.label : "-");
}

console.log("\n=== 2. …and stays quiet until a quarter has gone ===");
{
  const justBefore = describeCapacity(Math.ceil(CAP * SPEAK_AFTER_FRACTION) - 1, CAP);
  t("4 of 20 is still quiet", justBefore.known === true && justBefore.state === "quiet",
    justBefore.known ? `${justBefore.taken}/${justBefore.cap} ${justBefore.state}` : "-");
  const at = describeCapacity(Math.ceil(CAP * SPEAK_AFTER_FRACTION), CAP);
  t("CONTROL — 5 of 20 DOES speak, so §1 is not a function that never speaks",
    at.known === true && at.state === "available" && at.label !== null,
    at.known ? at.label : "-");
}

console.log("\n=== 3. urgency only when it is real ===");
{
  const few = describeCapacity(CAP - Math.floor(CAP * FEW_LEFT_FRACTION), CAP);
  t(`${Math.floor(CAP * FEW_LEFT_FRACTION)} left is 'few left'`,
    few.known === true && few.state === "few-left", few.known ? few.label : "-");
  const plenty = describeCapacity(10, CAP);
  t("⚠ 10 left is NOT 'few left' — that would be urgency manufactured from a healthy number",
    plenty.known === true && plenty.state === "available", plenty.known ? plenty.state : "-");
}

console.log("\n=== 4. full is full, and offers the waiting list ===");
{
  const c = describeCapacity(CAP, CAP);
  t("state is full", c.known === true && c.state === "full", c.known ? c.state : "-");
  t("…and points at the waiting list rather than a dead end",
    c.known === true && /waiting list/i.test(c.label ?? ""), c.known ? c.label : "-");
  t("⚠ over-subscribed does not render negative places",
    (() => { const o = describeCapacity(25, CAP); return o.known === true && o.remaining === 0; })(),
    JSON.stringify(describeCapacity(25, CAP)));
}

console.log("\n=== 5. ⚠ NO CAP MEANS NO CLAIM ===");
{
  const c = describeCapacity(5, 0);
  t("a cohort with no published capacity is 'not known', not 'full'",
    c.known === false, JSON.stringify(c));
  t("…and carries a reason", c.known === false && c.reason.length > 10, c.known === false ? c.reason : "-");
}

console.log("\n=== 6. the labels never invent a number ===");
{
  for (const taken of [0, 3, 5, 12, 16, 19, 20]) {
    const c = describeCapacity(taken, CAP);
    if (!c.known || c.label === null) continue;
    const nums = (c.label.match(/\d+/g) ?? []).map(Number);
    t(`"${c.label}" contains only real figures`,
      nums.every((n) => n === c.taken || n === c.cap || n === c.remaining),
      `${c.label} vs taken=${c.taken} cap=${c.cap} remaining=${c.remaining}`);
  }
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
