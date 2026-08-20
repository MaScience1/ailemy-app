-- ============================================================================
-- 0060_PROPOSED_billing_profiles_and_payments.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. Number from the planning chat. Apply AFTER 0058:
-- payments references entitlements. Run each section separately.
--
-- ============================================================================
-- ⚠ NOTHING WRITES TO THESE TABLES TODAY, AND THAT IS THE POINT
-- ============================================================================
-- Stripe is keyless in every environment. No Customer is created, no
-- SetupIntent is raised, no Payment Element is mounted, and CHECKOUT_BUILT is
-- false with a test that fails if anyone flips it without building the route.
-- These tables are the shape the webhook handler writes into on the day keys
-- arrive — created now so that day is a handler, not a migration plus a
-- handler plus a backfill.
--
-- ⚠ THE PAYER IS NOT THE STUDENT (§9, §59, §72, §109)
-- subscriptions.stripe_customer_id sits on the STUDENT today (0001). For a
-- 16-year-old whose parent pays, that is wrong in a way that gets worse with
-- every row: the Stripe Customer is the parent's commercial identity, and
-- hanging it off a minor's profile means the first family account has to move
-- live billing data.
--
-- So the Customer belongs to a BILLING PROFILE, which is linked to students
-- rather than being one. parent_students (0001) already models the family
-- relationship; this adds the commercial identity beside it.
--
-- ⚠ AND A MINOR MUST NOT SEE THEIR PARENT'S FINANCIAL DETAIL (§109). The RLS
-- below deliberately does NOT give a student read access to the billing
-- profile that pays for them — only to the payments that concern their own
-- entitlement, and even then without payer identity.

-- ── SECTION 1: TABLES ───────────────────────────────────────────────────────
BEGIN;

/**
 * Who pays. One per paying identity, not one per student.
 */
CREATE TABLE IF NOT EXISTS public.billing_profiles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /**
   * ⚠ THE ACCOUNT THAT OWNS THE BILLING RELATIONSHIP. Nullable, because an
   * admin may create a billing profile for a family that pays by transfer and
   * has no login at all — and a NOT NULL here would force a fake account to
   * exist before money could be recorded.
   */
  owner_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  billing_name       text NOT NULL,
  billing_email      text NOT NULL,
  billing_country    text,

  /**
   * ⚠ SAFE METADATA ONLY, AND NEVER A CARD NUMBER OR A CVV (§55, §57). What
   * is stored is a reference Stripe resolves; the card itself never touches
   * this database, this application, or a log line.
   */
  stripe_customer_id text UNIQUE,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT billing_profiles_email_shape CHECK (position('@' IN billing_email) > 1),
  CONSTRAINT billing_profiles_name_not_blank CHECK (btrim(billing_name) <> '')
);

/**
 * Which students a billing profile pays for.
 *
 * ⚠ MANY-TO-MANY ON PURPOSE. One parent, two children (§72). And a student
 * could in principle be paid for by a parent for tuition and by themselves for
 * a platform subscription — the link says who pays, not who owns the student.
 */
CREATE TABLE IF NOT EXISTS public.billing_profile_students (
  billing_profile_id uuid NOT NULL REFERENCES public.billing_profiles(id) ON DELETE CASCADE,
  student_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (billing_profile_id, student_id)
);

/**
 * What was actually paid. Webhook-driven truth (§106).
 *
 * ⚠ A CLIENT REDIRECT NEVER WRITES A ROW HERE. §106 is explicit and 0047's
 * payment_events already carries the idempotency key; this is the human-
 * readable ledger that Billing History renders from.
 */
CREATE TABLE IF NOT EXISTS public.payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_profile_id uuid REFERENCES public.billing_profiles(id) ON DELETE SET NULL,
  /**
   * ⚠ WHO IT WAS FOR, WHICH IS NOT WHO PAID. A student reading their own
   * billing history needs to see the tuition they receive; the payer's
   * identity is not on this row for them to read.
   */
  student_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entitlement_id     uuid REFERENCES public.entitlements(id) ON DELETE SET NULL,

  /**
   * ⚠ THE SIX KINDS §54 REFUSES TO COLLAPSE. A platform subscription, a
   * cohort subscription, a single lesson and a bundle are financially
   * different things, and a generic `subscription` makes MRR unanswerable.
   */
  kind               text NOT NULL,

  description        text NOT NULL,
  amount_minor       integer NOT NULL,
  currency           text NOT NULL,
  status             text NOT NULL,

  /** Stripe's own identifiers, for reconciliation and the hosted receipt. */
  provider           text NOT NULL DEFAULT 'stripe',
  provider_payment_id text,

  /**
   * ============================================================================
   * ⚠ receipt_url IS A §109 LEAK THAT THIS DATABASE CANNOT CLOSE. READ THIS
   * BEFORE RENDERING IT ANYWHERE.
   * ============================================================================
   * A Stripe hosted receipt shows the amount, the date, the card's last four
   * digits, and THE BILLING EMAIL THE CHARGE WAS MADE WITH. For a student whose
   * parent paid, that is the parent's address and card metadata — exactly what
   * the missing billing_profiles read policy above exists to withhold.
   *
   * ⚠ AND RLS CANNOT STOP IT, WHICH IS WHY THIS COMMENT IS HERE INSTEAD OF A
   * POLICY. payments_read_as_student and payments_read_as_payer are two
   * policies on ONE table, and both subjects are the role `authenticated`. RLS
   * filters ROWS, never COLUMNS, so there is no way to admit a row to a student
   * with this column hidden and to the payer with it shown. A column-level
   * REVOKE would take it from both.
   *
   * ⚠ THE RULE, WHICH LIVES IN THE APPLICATION BECAUSE IT CANNOT LIVE HERE:
   *
   *     A STUDENT-FACING BILLING VIEW NEVER SELECTS OR RENDERS receipt_url.
   *     A PAYER-FACING VIEW MAY.
   *
   * Enforced at compile time rather than by discipline: the student read model
   * has no such field, so no component can render one. See
   * src/lib/account/billing-view.ts, its test, and §129 step E.
   *
   * ⚠ RECOMMENDED FOLLOW-UP, NOT DONE HERE: move this column to its own
   * payment_receipts table whose only policy is the payer's, which makes the
   * leak impossible at the RLS layer instead of the type layer. It is free
   * while payments is empty and becomes a data migration the day Stripe keys
   * arrive. Deliberately deferred so it does not block this apply.
   */
  receipt_url        text,

  /**
   * ⚠ A REFUND IS NOT A RESTORED CREDIT (§68). Money going back is recorded
   * here; a lesson credit going back is a row in lesson_credit_transactions.
   * Conflating them makes the ledger claim money moved when it did not.
   */
  refunded_minor     integer NOT NULL DEFAULT 0,

  paid_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payments_kind_check CHECK (kind IN (
    'platform_subscription','cohort_subscription',
    'private_lesson','lesson_bundle','other'
  )),
  CONSTRAINT payments_status_check CHECK (status IN (
    'paid','pending','failed','refunded','partially_refunded','cancelled','requires_action'
  )),
  CONSTRAINT payments_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT payments_currency_shape CHECK (currency ~ '^[A-Z]{3}$'),
  -- ⚠ A REFUND CANNOT EXCEED WHAT WAS TAKEN.
  CONSTRAINT payments_refund_within_amount
    CHECK (refunded_minor >= 0 AND refunded_minor <= amount_minor),
  -- ⚠ A PAID PAYMENT MUST SAY WHEN. "Did this go through, and on what date"
  -- is the entire question a billing history answers.
  CONSTRAINT payments_paid_needs_time
    CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);

-- ⚠ ONE ROW PER PROVIDER PAYMENT. This is the second half of §104: the event
-- key stops a webhook processing twice; this stops two payment rows existing
-- for one charge even if it did.
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_unique
  ON public.payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_student_idx ON public.payments (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_profile_idx ON public.payments (billing_profile_id, created_at DESC);

COMMIT;

-- ── SECTION 2: ROW-LEVEL SECURITY ───────────────────────────────────────────
BEGIN;

ALTER TABLE public.billing_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_profile_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                 ENABLE ROW LEVEL SECURITY;

-- ⚠ NO anon POLICY ANYWHERE IN THIS FILE.

-- The payer sees their own billing identity.
DROP POLICY IF EXISTS billing_profiles_read_own ON public.billing_profiles;
CREATE POLICY billing_profiles_read_own
  ON public.billing_profiles FOR SELECT TO authenticated
  USING (public.billing_profiles.owner_user_id = auth.uid());

/**
 * ⚠ AND A STUDENT DOES *NOT* SEE THE BILLING PROFILE THAT PAYS FOR THEM.
 * There is deliberately no policy joining through billing_profile_students.
 * §109: a minor must not be handed their parent's billing email, country and
 * Stripe customer id because the parent bought them tuition. If a family later
 * wants that shared, it is a decision with a policy, not an omission.
 */

DROP POLICY IF EXISTS billing_profiles_staff_all ON public.billing_profiles;
CREATE POLICY billing_profiles_staff_all
  ON public.billing_profiles FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS billing_profile_students_read_own ON public.billing_profile_students;
CREATE POLICY billing_profile_students_read_own
  ON public.billing_profile_students FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.billing_profiles b
     WHERE b.id = public.billing_profile_students.billing_profile_id
       AND b.owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS billing_profile_students_staff_all ON public.billing_profile_students;
CREATE POLICY billing_profile_students_staff_all
  ON public.billing_profile_students FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

/**
 * ⚠ TWO WAYS TO SEE A PAYMENT, AND THEY ARE DIFFERENT RIGHTS. A student sees
 * payments FOR them, because "what have I got" is their question. A payer sees
 * payments they MADE, because "what have I spent" is theirs. The same row can
 * be visible to both, and neither policy reveals the other party.
 */
DROP POLICY IF EXISTS payments_read_as_student ON public.payments;
CREATE POLICY payments_read_as_student
  ON public.payments FOR SELECT TO authenticated
  USING (public.payments.student_id = auth.uid());

DROP POLICY IF EXISTS payments_read_as_payer ON public.payments;
CREATE POLICY payments_read_as_payer
  ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.billing_profiles b
     WHERE b.id = public.payments.billing_profile_id
       AND b.owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS payments_staff_read ON public.payments;
CREATE POLICY payments_staff_read
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_staff());

/**
 * ⚠ NO CLIENT WRITE POLICY ON ANY OF THE THREE. Financial truth is
 * webhook-driven (§106); a student who could INSERT a payment row could mark
 * their own tuition paid, and a payer who could UPDATE one could erase a
 * refund. Every write is service_role.
 */

COMMIT;

-- ── SECTION 3: GRANTS + NOTIFY ──────────────────────────────────────────────
BEGIN;

GRANT SELECT ON public.billing_profiles         TO authenticated;
GRANT SELECT ON public.billing_profile_students TO authenticated;
GRANT SELECT ON public.payments                 TO authenticated;

-- ⚠ SELECT AND NOTHING ELSE, ON ALL THREE. Not narrowed by column — withheld.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.billing_profiles         FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.billing_profile_students FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.payments                 FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- ⚠ THE FIXTURE MUST BE NON-EMPTY BEFORE ANY NEGATIVE IS BELIEVED. Seed a
-- payer P owning a billing profile, a student S linked to it, a payment for S,
-- and a SECOND student B with their own payment — then confirm as service_role
-- that all of it exists. A zero-row table cannot fail an isolation check, and
-- that exact mistake cost a probe on this project once already.
--
-- (a) the constraints
-- (kind='vibes')                 PASS: violates payments_kind_check.
-- (status='maybe')               PASS: violates payments_status_check.
-- (amount_minor=0)               PASS: violates payments_amount_positive.
-- (currency='gbp')               PASS: violates payments_currency_shape.
-- (status='paid', paid_at NULL)  PASS: violates payments_paid_needs_time.
-- (refunded_minor > amount_minor) PASS: violates payments_refund_within_amount.
-- ...and a well-formed row inserts. ⚠ THE POSITIVE HALF, or the block only
--   proves the table rejects things.
--
-- (b) one payment row per provider charge
-- (two rows, same provider_payment_id) PASS: duplicate key violates
--   payments_provider_unique.
-- (two rows, provider_payment_id NULL) PASS: both insert — the index is
--   partial, so an offline or manual payment is not blocked by another.
--
-- (c) ⚠ A STUDENT SEES THEIR OWN PAYMENTS AND NOT B'S
-- (from S's session) SELECT count(*) FROM public.payments;
-- PASS: S's rows only, and B's row is absent though it exists.
--
-- (d) ⚠ AND A STUDENT CANNOT SEE WHO PAID FOR THEM (§109)
-- (from S's session) SELECT count(*) FROM public.billing_profiles;
-- PASS: 0 — and this 0 is MEANINGFUL only because service_role has confirmed
--   a profile exists and is linked to S. There is no policy admitting it.
-- SELECT count(*) FROM public.billing_profile_students;
-- PASS: 0, for the same reason.
--
-- (e) …while the PAYER sees both
-- (from P's session) SELECT count(*) FROM public.billing_profiles;   PASS: 1.
-- (from P's session) SELECT count(*) FROM public.payments;           PASS: the
--   payments they made, including S's tuition.
--   ⚠ (d) AND (e) ARE ONE ASSERTION IN TWO HALVES. Either alone is consistent
--   with the policies being wrong in one direction.
--
-- (f) nobody but staff and service_role can write
-- (from S's session) INSERT INTO public.payments (…);
-- PASS: permission denied for table payments — no INSERT grant exists.
-- (from P's session) UPDATE public.payments SET refunded_minor = amount_minor
--   WHERE billing_profile_id = <P's>;
-- PASS: permission denied — a payer cannot refund themselves.
--
-- (g) anon is refused OUTRIGHT on all three
-- SET ROLE anon; SELECT count(*) FROM public.payments; RESET ROLE;
-- PASS: permission denied. Repeat for both billing tables.
--   ⚠ A 0 WOULD BE A FAILURE.
--
-- (h) privileges, with a control
-- SELECT table_name,
--   has_table_privilege('anon','public.'||table_name,'TRUNCATE')            AS a_t,
--   has_table_privilege('anon','public.'||table_name,'TRIGGER')             AS a_g,
--   has_table_privilege('anon','public.'||table_name,'REFERENCES')          AS a_r,
--   has_table_privilege('authenticated','public.'||table_name,'INSERT')     AS u_i,
--   has_table_privilege('authenticated','public.'||table_name,'UPDATE')     AS u_u,
--   has_table_privilege('authenticated','public.'||table_name,'SELECT')     AS control_true
--  FROM (VALUES ('billing_profiles'),('billing_profile_students'),('payments')) AS t(table_name);
-- PASS: three rows, f,f,f,f,f,t on each.
--
-- (i) ⚠ NO CARD DATA COLUMN EXISTS ANYWHERE (§55)
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name IN
--    ('billing_profiles','billing_profile_students','payments')
--    AND (column_name ILIKE '%card%' OR column_name ILIKE '%cvv%'
--         OR column_name ILIKE '%pan%' OR column_name ILIKE '%number%');
-- PASS: zero rows. Nothing here can hold a card number even by accident.
