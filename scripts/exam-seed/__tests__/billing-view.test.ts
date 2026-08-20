/**
 * A student-facing billing surface can never carry a Stripe receipt link.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/billing-view.test.ts
 *
 * ============================================================================
 * ⚠ THE LEAK THIS GUARDS IS ONE RLS CANNOT CLOSE (§109)
 * ============================================================================
 * 0060 shows a payment row to the student it was for AND to the payer who
 * bought it. Both are the role `authenticated`, and RLS filters rows and never
 * columns — so `receipt_url` cannot be admitted to one and withheld from the
 * other by any policy. A Stripe hosted receipt carries the payer's billing
 * email and the card's last four digits, so a student reading their own tuition
 * history would be handed their parent's financial identity.
 *
 * ⚠ THE GUARD IS STRUCTURAL IN TWO PLACES AND A SCAN IN A THIRD. The select
 * string never asks for the column; the mapper is built field by field so a
 * widened select cannot leak through a spread; and the repo scan below fails if
 * the name appears in a file that is not on the allowlist.
 *
 * ⚠ THE SCAN CANNOT PASS VACUOUSLY. It asserts a non-empty allowlist and
 * reports how many files it examined. `route-integrity.test.ts` passed twice on
 * the exact link it was written for; the lesson was that a guard which has
 * never been seen to fail has not been shown to work, and both halves here have
 * been sabotaged.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  STUDENT_PAYMENT_COLUMNS,
  PAYER_PAYMENT_COLUMNS,
  toStudentPaymentView,
  toPayerPaymentView,
  refundSummary,
} from "../../../src/lib/account/billing-view.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

/** A row exactly as PostgREST would hand it back if it HAD been selected. */
const ROW = {
  id: "p1",
  kind: "cohort_subscription",
  description: "IAL Chemistry AS — Group A",
  amount_minor: 16900,
  currency: "GBP",
  status: "paid",
  refunded_minor: 0,
  paid_at: "2026-09-15T18:00:00.000Z",
  created_at: "2026-09-15T18:00:00.000Z",
  // ⚠ PRESENT ON PURPOSE. The student mapper must drop it even when it arrives.
  receipt_url: "https://pay.stripe.com/receipts/PARENT-EMAIL-AND-LAST4",
  billing_profile_id: "b1",
  student_id: "s1",
};

// ============================================================================
console.log("\n=== 1. the select list never asks for the column ===");
// ============================================================================
{
  const cols = STUDENT_PAYMENT_COLUMNS.split(",");
  t("⚠ receipt_url is NOT in the student select list",
    !cols.includes("receipt_url"), STUDENT_PAYMENT_COLUMNS);
  t("...nor is billing_profile_id — who paid is not the student's to read (§109)",
    !cols.includes("billing_profile_id"), STUDENT_PAYMENT_COLUMNS);

  // CONTROL. Without it, an empty or malformed constant would pass the two above.
  t("CONTROL — the student list is non-empty and carries the fields a history needs",
    cols.length >= 8 && ["id", "amount_minor", "status", "paid_at"].every((c) => cols.includes(c)),
    `${cols.length}: ${STUDENT_PAYMENT_COLUMNS}`);

  t("⚠ the PAYER list DOES include it — this is a separation, not a deletion",
    PAYER_PAYMENT_COLUMNS.split(",").includes("receipt_url"), PAYER_PAYMENT_COLUMNS);
}

// ============================================================================
console.log("\n=== 2. ⚠ THE MAPPER DROPS IT EVEN WHEN THE ROW CARRIES IT ===");
// ============================================================================
{
  const student = toStudentPaymentView(ROW) as Record<string, unknown>;
  const keys = Object.keys(student);

  t("no key on a student view mentions a receipt",
    !keys.some((k) => /receipt/i.test(k)), keys.join(", "));
  t("⚠ nor the payer's identity",
    !keys.some((k) => /billing|payer|customer/i.test(k)), keys.join(", "));
  t("...and no VALUE carries the URL either, under any key",
    !Object.values(student).some((v) => typeof v === "string" && v.includes("stripe.com")),
    JSON.stringify(student));

  // CONTROL: the same row through the payer mapper keeps it, so §2 is not
  // measuring a mapper that returns nothing.
  const payer = toPayerPaymentView(ROW);
  t("CONTROL — the payer view KEEPS the receipt", payer.receiptUrl === ROW.receipt_url, payer.receiptUrl);
  t("...and both views agree on the money", payer.amountMinor === 16900 && student.amountMinor === 16900,
    `${payer.amountMinor} / ${String(student.amountMinor)}`);
}

// ============================================================================
console.log("\n=== 3. a refund is money, not a restored credit (§68) ===");
// ============================================================================
{
  const base = toPayerPaymentView(ROW);
  t("no refund → no summary", refundSummary(base) === null, refundSummary(base));
  t("partial refund says so",
    refundSummary({ ...base, refundedMinor: 5000 }) === "Partially refunded",
    refundSummary({ ...base, refundedMinor: 5000 }));
  t("full refund says so",
    refundSummary({ ...base, refundedMinor: 16900 }) === "Fully refunded",
    refundSummary({ ...base, refundedMinor: 16900 }));
  t("⚠ no summary mentions credits or lessons — that ledger is a different one",
    !/credit|lesson/i.test(String(refundSummary({ ...base, refundedMinor: 5000 }))),
    refundSummary({ ...base, refundedMinor: 5000 }));
}

// ============================================================================
console.log("\n=== 4. repo scan — where the name is allowed to appear ===");
// ============================================================================
{
  /**
   * ⚠ AN ALLOWLIST OF FILES, NOT A COUNT. A count would drift upward silently
   * as the billing UI grows. These are the only places `receipt_url` /
   * `receiptUrl` may be named: the module that defines the split, this test,
   * and (once built) payer-scoped readers.
   */
  const ALLOWED = [
    "src/lib/account/billing-view.ts",
    "scripts/exam-seed/__tests__/billing-view.test.ts",
  ];
  /** A path is payer-scoped if it says so in its own name. */
  const PAYER_SCOPED = /(^|\/)payer[-.]/i;

  const roots = ["src", "scripts"];
  const offenders: string[] = [];
  let scanned = 0;

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (entry === "node_modules" || entry === ".next") continue;
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      scanned++;
      const rel = relative(".", full);
      if (ALLOWED.includes(rel) || PAYER_SCOPED.test(rel)) continue;
      if (/receipt_url|receiptUrl/.test(readFileSync(full, "utf8"))) offenders.push(rel);
    }
  };
  for (const r of roots) walk(r);

  t(`⚠ the scan actually read files — ${scanned} examined`, scanned > 200, scanned);
  t("⚠ the allowlist is non-empty and every entry EXISTS",
    ALLOWED.length > 0 && ALLOWED.every((f) => { try { return statSync(f).isFile(); } catch { return false; } }),
    ALLOWED.join(", "));
  t("⚠ receipt_url appears in NO other file — a student surface cannot name it",
    offenders.length === 0, offenders.join("\n      "));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
