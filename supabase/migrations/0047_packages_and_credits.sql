-- ============================================================================
-- 0047_PROPOSED_packages_and_credits.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-19, after 0046. Renamed from
-- 0047_PROPOSED_ once verified. VERIFICATION: ALL RUNNABLE ASSERTIONS PASS —
-- AND THE RUN EXPOSED A DEFECT IN THIS FILE. SEE THE BOTTOM OF THIS BLOCK.
--
--   (a) an ACTIVE package with no stripe_price_id refused BY
--       tuition_packages_active_needs_price — the dead-Buy guard        ✓
--       …draft with no price fine · active WITH a price fine            ✓
--   (b) THE APPEND-ONLY TRIGGER, run as service_role — the role that
--       HOLDS every grant:
--         UPDATE refused, 23001, message names append-only              ✓
--         DELETE refused, 23001                                         ✓
--         …and the row provably intact at delta 4 afterwards            ✓
--   (c) a webhook RETRY refused BY …_idempotency, 23505                 ✓
--       ⚠ THIS IS WHAT STOPS A STRIPE RETRY DOUBLING SOMEBODY'S CREDITS.
--       …and two NULL-key rows both insert — the index is partial       ✓
--   (d) a second debit for one booking refused BY …_one_debit_per_
--       booking, 23505                                                  ✓
--       …but a POSITIVE row for that booking IS allowed — the refund    ✓
--   (e) delta 0 refused BY …_delta_nonzero                              ✓
--   (f) a signed-in student read ONLY their own ledger; another
--       student's 50 credits did not appear                             ✓
--       …and the balance summed correctly to 10                         ✓
--   (g) …and they CANNOT grant themselves credits, 42501                ✓
--   (h) anon REFUSED on the ledger and on payment_events, 42501         ✓
--   (i) anon sees an active package and NOT a draft                     ✓
--   (j) the same Stripe event_id cannot be recorded twice, 23505        ✓
--
-- ============================================================================
-- ⚠⚠ DEFECT FOUND BY THIS VERIFICATION — FIXED BY 0048
-- ============================================================================
-- The trigger above works exactly as specified. What is wrong is that
-- append-only was made ABSOLUTE, while two foreign keys on this table perform
-- writes of their own:
--
--   booking_id … ON DELETE SET NULL   deleting a booking fires an UPDATE
--   user_id    … ON DELETE CASCADE    deleting a user fires a DELETE
--
-- Both are refused by the trigger. The second means NO USER WHO HAS EVER HELD
-- A CREDIT CAN BE DELETED — and the interest form and privacy policy both
-- promise families their data can be erased on request.
--
-- 0048 adds a named, transaction-scoped escape (SET LOCAL app.ledger_purge)
-- and changes the two references to ON DELETE RESTRICT. Ordinary mutation is
-- still refused from every role; erasing a PERSON becomes possible, which is a
-- different act and a legal requirement.
--
-- ⚠ THIS RUN THEREFORE LEFT ROWS BEHIND: 7 ledger rows, 1 private booking and
-- 2 probe auth users, which could not be cleaned up for precisely this reason.
-- 0048's footer carries the exact statements to remove them.--
--   ⚠ THE THREE PRIVILEGES WAS NOT RUN AND IS NOT CLAIMED. information_schema
--   is not exposed through PostgREST and TRUNCATE/TRIGGER/REFERENCES cannot be
--   exercised over REST. SQL Editor only.
--
-- ============================================================================
-- ⚠ A LEDGER, NOT A COUNTER (§61)
-- ============================================================================
-- There is no credits_remaining column anywhere in this file, and that is the
-- design. A balance is SUM(delta) over an append-only ledger:
--
--     +4  package purchased      pi_3Nx…
--     -1  booking Monday 17:00   booking <uuid>
--     -1  booking Thursday 16:00 booking <uuid>
--     +1  teacher cancelled, credit restored
--     =3  current balance
--
-- A counter can be wrong and cannot say why. A ledger can be audited, and a
-- webhook retry that tries to add the same four credits twice is refused by a
-- UNIQUE constraint rather than by hoping the handler ran once (§33, §63).
--
-- ⚠ APPEND-ONLY IS ENFORCED, NOT DOCUMENTED. No UPDATE or DELETE is granted to
-- any client role, and section 2 adds a trigger that refuses both even from the
-- table owner. A correction is a new compensating row, which is what makes the
-- history true.
-- ============================================================================

-- ── SECTION 1: TABLES ───────────────────────────────────────────────────────
BEGIN;

/**
 * What the founder sells (§30). Entirely admin-configurable — nothing here is
 * seeded, and the code holds no package definitions (§21, §59).
 */
CREATE TABLE IF NOT EXISTS public.tuition_packages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,
  name           text NOT NULL,
  description    text,

  subject        text,
  -- 1 for a single lesson; 4 or 8 for a bundle. §30's examples are examples.
  credits        smallint NOT NULL,
  slot_minutes   smallint NOT NULL DEFAULT 60,

  price_minor    integer NOT NULL,
  currency       text NOT NULL DEFAULT 'GBP',

  -- ⚠ NULL MEANS NO PAYMENT LINK YET, AND THE CTA MUST SAY SO. Same rule as
  -- cohorts.enrolment_url in 0041: a package with no Stripe price cannot be
  -- bought, and must never render a Buy button (§7 of the standing rails).
  stripe_price_id text,

  -- NULL = credits never expire. A number is months from purchase.
  validity_months smallint,

  display_order  integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT false,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tuition_packages_credits_positive CHECK (credits BETWEEN 1 AND 100),
  CONSTRAINT tuition_packages_price_positive CHECK (price_minor > 0),
  CONSTRAINT tuition_packages_slot_sane CHECK (slot_minutes BETWEEN 15 AND 480),
  CONSTRAINT tuition_packages_validity_sane
    CHECK (validity_months IS NULL OR validity_months BETWEEN 1 AND 60),

  -- ⚠ AN ACTIVE PACKAGE MUST BE BUYABLE. Enforced here so a dead Buy button
  -- cannot be created by an admin edit — the same shape as
  -- cohorts_enrolling_needs_url.
  CONSTRAINT tuition_packages_active_needs_price
    CHECK (is_active IS FALSE OR stripe_price_id IS NOT NULL)
);

/**
 * The append-only credit ledger (§61).
 *
 * delta is positive for a purchase or a restoration, negative for a booking.
 * The balance is SUM(delta) for a user, never a stored number.
 */
CREATE TABLE IF NOT EXISTS public.lesson_credit_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  delta          integer NOT NULL,
  reason         text NOT NULL,

  package_id     uuid REFERENCES public.tuition_packages(id) ON DELETE SET NULL,
  booking_id     uuid REFERENCES public.private_bookings(id) ON DELETE SET NULL,

  /**
   * ⚠ THE IDEMPOTENCY KEY. THIS IS WHAT STOPS A WEBHOOK RETRY DOUBLING
   * SOMEBODY'S CREDITS (§63, §74.56).
   *
   * Stripe retries on any non-2xx and on timeouts, so the same
   * checkout.session.completed WILL arrive more than once. The handler inserts
   * with the event id here; the second insert violates the unique index and the
   * handler treats that specific violation as success. Correctness comes from
   * the constraint, not from the handler remembering.
   */
  idempotency_key text,

  expires_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lesson_credit_transactions_delta_nonzero CHECK (delta <> 0),
  CONSTRAINT lesson_credit_transactions_reason_check
    CHECK (reason IN ('purchase','booking','cancellation_refund','admin_adjustment','expiry'))
);

-- ⚠ ONE ROW PER IDEMPOTENCY KEY, ACROSS THE WHOLE TABLE. Partial, because most
-- rows (a booking consuming a credit) have no key.
CREATE UNIQUE INDEX IF NOT EXISTS lesson_credit_transactions_idempotency
  ON public.lesson_credit_transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ⚠ ONE CONSUMPTION PER BOOKING. A credit cannot be spent twice on the same
-- lesson even if the action is replayed (§74.54).
CREATE UNIQUE INDEX IF NOT EXISTS lesson_credit_transactions_one_debit_per_booking
  ON public.lesson_credit_transactions (booking_id)
  WHERE booking_id IS NOT NULL AND delta < 0;

CREATE INDEX IF NOT EXISTS lesson_credit_transactions_balance_idx
  ON public.lesson_credit_transactions (user_id, created_at);

/**
 * Every Stripe event we have processed, so a retry is a no-op (§63).
 *
 * ⚠ SEPARATE FROM THE LEDGER ON PURPOSE. Not every event issues credits — a
 * single-lesson purchase confirms a booking and writes no ledger row at all —
 * so the ledger's key alone cannot make the WEBHOOK idempotent. This table is
 * the handler's own record of what it has seen.
 */
CREATE TABLE IF NOT EXISTS public.payment_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider       text NOT NULL DEFAULT 'stripe',
  event_id       text NOT NULL,
  event_type     text NOT NULL,
  checkout_ref   text,
  status         text NOT NULL DEFAULT 'processed',
  payload_digest text,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payment_events_status_check
    CHECK (status IN ('processed','ignored','failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_event
  ON public.payment_events (provider, event_id);

COMMIT;

-- ── SECTION 2: APPEND-ONLY, ENFORCED ────────────────────────────────────────
BEGIN;

/**
 * ⚠ THE LEDGER REFUSES UPDATE AND DELETE FROM EVERY ROLE, THE OWNER INCLUDED.
 *
 * Revoking the privilege stops clients; it does not stop a well-meaning script
 * run with the service role, which bypasses RLS and holds every grant. A
 * trigger is the only thing that makes "append-only" true rather than
 * aspirational. Corrections are compensating rows — that is what an audit
 * trail is.
 */
CREATE OR REPLACE FUNCTION public.refuse_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'lesson_credit_transactions is append-only: % refused. Insert a compensating row instead.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS lesson_credit_transactions_append_only
  ON public.lesson_credit_transactions;
CREATE TRIGGER lesson_credit_transactions_append_only
  BEFORE UPDATE OR DELETE ON public.lesson_credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_ledger_mutation();

COMMIT;

-- ── SECTION 3: ROW-LEVEL SECURITY ───────────────────────────────────────────
BEGIN;

ALTER TABLE public.tuition_packages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_credit_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events              ENABLE ROW LEVEL SECURITY;

-- Packages are a price list. Active ones are public; drafts are not.
DROP POLICY IF EXISTS tuition_packages_read_public ON public.tuition_packages;
CREATE POLICY tuition_packages_read_public
  ON public.tuition_packages FOR SELECT TO anon, authenticated
  USING (public.tuition_packages.is_active IS TRUE);

DROP POLICY IF EXISTS tuition_packages_staff_all ON public.tuition_packages;
CREATE POLICY tuition_packages_staff_all ON public.tuition_packages
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- A student reads their OWN ledger — that is the "3 lessons remaining" line.
DROP POLICY IF EXISTS lesson_credit_transactions_read_own ON public.lesson_credit_transactions;
CREATE POLICY lesson_credit_transactions_read_own
  ON public.lesson_credit_transactions FOR SELECT TO authenticated
  USING (public.lesson_credit_transactions.user_id = auth.uid());

DROP POLICY IF EXISTS lesson_credit_transactions_staff_read ON public.lesson_credit_transactions;
CREATE POLICY lesson_credit_transactions_staff_read
  ON public.lesson_credit_transactions FOR SELECT TO authenticated
  USING (public.is_staff());

-- ⚠ NO INSERT POLICY FOR ANYONE. Credits are issued only by the webhook and by
-- admin actions, both through the service role. A student who could insert
-- could grant themselves lessons.
--
-- ⚠ NO POLICY OF ANY KIND ON payment_events. It is internal reconciliation
-- data; RLS denies by default and no client role has business reading it.

COMMIT;

-- ── SECTION 4: GRANTS ───────────────────────────────────────────────────────
BEGIN;

GRANT SELECT ON public.tuition_packages TO anon, authenticated;
GRANT SELECT ON public.lesson_credit_transactions TO authenticated;

-- ⚠ anon GETS NOTHING on the ledger or on payment_events, and no role gets
-- INSERT/UPDATE/DELETE on any of the three.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.tuition_packages           FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_credit_transactions FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.payment_events             FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) an active package with no Stripe price is refused — the dead-Buy guard
-- INSERT INTO public.tuition_packages (slug,name,credits,price_minor,is_active,stripe_price_id)
--   VALUES ('probe','probe',4,20000,true,NULL);
-- PASS: violates tuition_packages_active_needs_price.
-- …and with is_active=false it inserts; …and with a price_id and true it inserts.
--
-- (b) THE APPEND-ONLY TRIGGER — the important one
-- INSERT INTO public.lesson_credit_transactions (user_id,delta,reason)
--   VALUES (<uid>,4,'purchase');
-- UPDATE public.lesson_credit_transactions SET delta=99 WHERE user_id=<uid>;
-- PASS: 'lesson_credit_transactions is append-only: UPDATE refused…'
-- DELETE FROM public.lesson_credit_transactions WHERE user_id=<uid>;
-- PASS: the same, for DELETE.
--   ⚠ RUN THIS AS postgres, NOT AS anon. Anyone can be refused by a missing
--   grant; the trigger's job is to refuse the role that HAS every grant.
--
-- (c) the webhook idempotency key
-- INSERT … (user_id,delta,reason,idempotency_key) VALUES (<uid>,4,'purchase','evt_1');
-- INSERT … the identical row again;
-- PASS: duplicate key violates "lesson_credit_transactions_idempotency".
--   This is what stops a Stripe retry issuing four more credits.
-- …and a row with idempotency_key NULL inserts freely, twice — the index is
--   partial because a booking debit has no key.
--
-- (d) one debit per booking
-- INSERT … (user_id,delta,reason,booking_id) VALUES (<uid>,-1,'booking',<b>);
-- INSERT … the same booking again;
-- PASS: duplicate key violates "…_one_debit_per_booking".
-- …and a POSITIVE row for the same booking IS allowed — that is the
--   cancellation refund (§74.55), and the index excludes delta >= 0.
--
-- (e) delta 0 is refused
-- PASS: violates lesson_credit_transactions_delta_nonzero.
--
-- (f) a student reads only their own ledger
-- (from A's session) SELECT count(*) FROM public.lesson_credit_transactions;
-- PASS: only A's rows. Add a row for B and confirm A's count is unchanged.
--
-- (g) a student cannot INSERT credits
-- (from A's session) INSERT … (user_id,delta,reason) VALUES (auth.uid(),100,'purchase');
-- PASS: permission denied — no INSERT grant to authenticated at all.
--
-- (h) anon is refused OUTRIGHT on the ledger and on payment_events
-- SET ROLE anon; SELECT count(*) FROM public.lesson_credit_transactions;
-- PASS: permission denied for table lesson_credit_transactions.
--   ⚠ A 0 WOULD BE A FAILURE — it would mean a grant exists and RLS filtered.
-- SET ROLE anon; SELECT count(*) FROM public.payment_events;
-- PASS: permission denied for table payment_events.
--
-- (i) anon CAN read an active package, and cannot read a draft
-- SET ROLE anon; SELECT count(*) FROM public.tuition_packages;
-- PASS: only is_active rows. Flip one to false and confirm it disappears; flip
--   it back and confirm it returns.
--
-- (j) the webhook event key
-- INSERT INTO public.payment_events (event_id,event_type) VALUES ('evt_1','checkout.session.completed');
-- INSERT … the same event_id again;
-- PASS: duplicate key violates "payment_events_provider_event".
--
-- (k) cleanup. ⚠ THE LEDGER CANNOT BE CLEANED BY DELETE — the trigger refuses
--   it, by design. Drop the probe USER, whose ON DELETE CASCADE removes the
--   rows, or leave the probe rows and note them. Do NOT disable the trigger to
--   tidy up; that is the one action this file exists to prevent.
--
-- (l) the three privileges
-- SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public'
--    AND table_name IN ('tuition_packages','lesson_credit_transactions','payment_events')
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
