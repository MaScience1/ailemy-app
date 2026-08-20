/**
 * Who may see which columns of a payment.
 *
 * ============================================================================
 * ⚠ THIS FILE EXISTS BECAUSE RLS CANNOT DO THIS JOB (§109)
 * ============================================================================
 * 0060 admits a payment row to two different people for two different reasons:
 * `payments_read_as_student` (this was for me) and `payments_read_as_payer`
 * (I paid for this). Both subjects are the role `authenticated`, and RLS
 * filters ROWS and never COLUMNS — so there is no policy that shows
 * `receipt_url` to the payer and hides it from the student. A column-level
 * REVOKE would take it from both.
 *
 * ⚠ AND receipt_url IS NOT A COSMETIC FIELD. A Stripe hosted receipt shows the
 * amount, the date, the card's last four digits and THE BILLING EMAIL THE
 * CHARGE WAS MADE WITH. Handing that to a sixteen-year-old because their
 * parent paid is precisely what 0060's deliberately-absent billing_profiles
 * read policy exists to prevent — reintroduced through a link.
 *
 * ⚠ SO THE SEPARATION IS A TYPE, NOT A HABIT. `StudentPaymentView` has no
 * receipt field. A component handed one cannot render a receipt link, because
 * there is nothing to render and the compiler says so. A test asserting
 * "we remembered not to" would pass on the day somebody adds a new billing
 * component it does not know about; this cannot.
 *
 * Pure: no database, no imports. The readers that use it are server-only.
 */

// ============================================================================
// SELECT LISTS — the other half of the enforcement
// ============================================================================

/**
 * ⚠ THE STUDENT LIST IS ALSO THE POSTGREST SELECT STRING, so the column is not
 * merely dropped after the fact — it is never fetched, never serialised into
 * the RSC payload, and never present in a response somebody could read in
 * devtools. Filtering in the mapper alone would still ship it over the wire.
 */
export const STUDENT_PAYMENT_COLUMNS =
  "id,kind,description,amount_minor,currency,status,refunded_minor,paid_at,created_at" as const;

/** The payer's own record of their own spending. `receipt_url` is theirs. */
export const PAYER_PAYMENT_COLUMNS =
  "id,kind,description,amount_minor,currency,status,refunded_minor,paid_at,created_at,receipt_url,billing_profile_id,student_id" as const;

// ============================================================================
// SHAPES
// ============================================================================

export type PaymentKind =
  | "platform_subscription"
  | "cohort_subscription"
  | "private_lesson"
  | "lesson_bundle"
  | "other";

export type PaymentStatus =
  | "paid" | "pending" | "failed" | "refunded"
  | "partially_refunded" | "cancelled" | "requires_action";

/** What both audiences may see. */
type PaymentCommon = {
  id: string;
  kind: PaymentKind;
  description: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  refundedMinor: number;
  paidAt: string | null;
  createdAt: string;
};

/**
 * ⚠ NO receipt FIELD, AND NO INDEX SIGNATURE THAT COULD SMUGGLE ONE IN. If a
 * future edit adds one here, `studentPaymentViewHasNoReceipt` in the test goes
 * red and the §129 step E assertion fails with it.
 */
export type StudentPaymentView = PaymentCommon;

export type PayerPaymentView = PaymentCommon & {
  /** Stripe's hosted receipt. Payer surfaces only — never a student surface. */
  receiptUrl: string | null;
  billingProfileId: string | null;
  /** Who the payment was for. A payer may see this; it is their own record. */
  studentId: string | null;
};

// ============================================================================
// MAPPERS
// ============================================================================

type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const nullableStr = (v: unknown): string | null => (typeof v === "string" ? v : null);
const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function common(row: Row): PaymentCommon {
  return {
    id: str(row.id),
    kind: str(row.kind) as PaymentKind,
    description: str(row.description),
    amountMinor: int(row.amount_minor),
    currency: str(row.currency),
    status: str(row.status) as PaymentStatus,
    refundedMinor: int(row.refunded_minor),
    paidAt: nullableStr(row.paid_at),
    createdAt: str(row.created_at),
  };
}

/**
 * ⚠ BUILT FIELD BY FIELD, NEVER SPREAD. `{ ...row }` would carry whatever the
 * query returned — including a receipt_url that arrived because somebody
 * widened the select list — straight into a student's page. Every field here
 * is one somebody chose to include.
 */
export function toStudentPaymentView(row: Row): StudentPaymentView {
  return common(row);
}

export function toPayerPaymentView(row: Row): PayerPaymentView {
  return {
    ...common(row),
    receiptUrl: nullableStr(row.receipt_url),
    billingProfileId: nullableStr(row.billing_profile_id),
    studentId: nullableStr(row.student_id),
  };
}

/**
 * ⚠ A REFUND IS NOT A RESTORED CREDIT (§68). This says what happened to the
 * MONEY. A lesson going back into the credit balance is a row in
 * lesson_credit_transactions and is rendered from there, so a page cannot
 * imply a bank refund from a restored lesson or the reverse.
 */
export function refundSummary(p: PaymentCommon): string | null {
  if (p.refundedMinor <= 0) return null;
  if (p.refundedMinor >= p.amountMinor) return "Fully refunded";
  return "Partially refunded";
}
