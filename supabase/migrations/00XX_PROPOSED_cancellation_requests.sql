-- ============================================================================
-- 00XX_PROPOSED_cancellation_requests.sql  ⚠ NUMBER FROM THE PLANNING CHAT
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. Apply after the booking-reference migration.
-- Run each section separately.
--
-- Cash-paid cancellations that a human must decide (§41, §54).
--
-- ============================================================================
-- ⚠ WHY A TABLE AND NOT A STATUS VALUE
-- ============================================================================
-- 0046's private_bookings_status_check permits exactly confirmed | cancelled |
-- completed | no_show. Adding 'cancellation_requested' to that list would be
-- the cheap change and the wrong one: a request is not a state of the LESSON,
-- it is a conversation about it. The lesson is still confirmed while the
-- request is open — the student should still turn up if nobody replies.
--
-- Collapsing them also loses who asked, when, why, what was decided and by
-- whom, which is precisely what §54 needs Admin to see.
--
-- ⚠ A CREDIT-PAID CANCELLATION INSIDE THE WINDOW DOES NOT COME HERE (§40). That
-- path is self-service: cancel, restore exactly one credit, done. This table is
-- for the cases a policy cannot decide alone — cash refunds, and anything
-- inside the cutoff.
-- ============================================================================

-- ── SECTION 1: TABLE ────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS public.cancellation_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid NOT NULL REFERENCES public.private_bookings(id) ON DELETE RESTRICT,

  -- ⚠ WHO ASKED, CAPTURED AT THE TIME. user_id may later be nulled by an
  -- erasure; requested_by_email is the durable record of the conversation.
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_email text NOT NULL,

  reason         text,
  -- Free text from the family. Distinct from `resolution_note`, which is ours.
  student_note   text,

  status         text NOT NULL DEFAULT 'open',
  resolution     text,
  resolution_note text,
  resolved_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at    timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cancellation_requests_status_check
    CHECK (status IN ('open','resolved','withdrawn')),
  CONSTRAINT cancellation_requests_resolution_check
    CHECK (resolution IS NULL OR resolution IN ('refunded','credited','rescheduled','declined')),
  CONSTRAINT cancellation_requests_email_shape
    CHECK (position('@' IN requested_by_email) > 1),

  -- ⚠ A RESOLVED REQUEST MUST SAY WHAT WAS DECIDED, AND WHEN. Without this a
  -- request can be marked resolved with no outcome recorded — which is exactly
  -- how "I was told I'd get a refund" becomes unanswerable.
  CONSTRAINT cancellation_requests_resolved_needs_outcome
    CHECK (status <> 'resolved' OR (resolution IS NOT NULL AND resolved_at IS NOT NULL))
);

-- ⚠ ONE OPEN REQUEST PER BOOKING. A student pressing the button twice must not
-- create two threads for one lesson; partial, so a resolved request does not
-- block a later one if the lesson is rescheduled and cancelled again.
CREATE UNIQUE INDEX IF NOT EXISTS cancellation_requests_one_open_per_booking
  ON public.cancellation_requests (booking_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS cancellation_requests_queue_idx
  ON public.cancellation_requests (status, created_at DESC);

COMMIT;

-- ── SECTION 2: ROW-LEVEL SECURITY ───────────────────────────────────────────
BEGIN;

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

-- ⚠ NO anon POLICY. RLS denies by default; the absence IS the protection.

-- A student sees their own requests, so the UI can say "we have this".
DROP POLICY IF EXISTS cancellation_requests_read_own ON public.cancellation_requests;
CREATE POLICY cancellation_requests_read_own
  ON public.cancellation_requests FOR SELECT TO authenticated
  USING (public.cancellation_requests.user_id = auth.uid());

/**
 * ⚠ A STUDENT MAY CREATE ONE, FOR A BOOKING THAT IS THEIRS — and the WITH CHECK
 * proves the second half rather than trusting the form. Without the EXISTS
 * clause a student could open a cancellation request against someone else's
 * lesson, which is not a data leak but is a denial-of-service on another
 * family's booking.
 */
DROP POLICY IF EXISTS cancellation_requests_insert_own ON public.cancellation_requests;
CREATE POLICY cancellation_requests_insert_own
  ON public.cancellation_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.cancellation_requests.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.private_bookings b
       WHERE b.id = public.cancellation_requests.booking_id
         AND b.user_id = auth.uid()
    )
  );

-- ⚠ NO STUDENT UPDATE POLICY. Resolving is an admin act; a student who could
-- UPDATE could mark their own request 'resolved' with resolution 'refunded'.
DROP POLICY IF EXISTS cancellation_requests_staff_all ON public.cancellation_requests;
CREATE POLICY cancellation_requests_staff_all
  ON public.cancellation_requests FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

COMMIT;

-- ── SECTION 3: GRANTS + NOTIFY ──────────────────────────────────────────────
BEGIN;

GRANT SELECT, INSERT ON public.cancellation_requests TO authenticated;
GRANT UPDATE ON public.cancellation_requests TO authenticated;  -- staff path only, gated by the policy above

-- ⚠ anon GETS NOTHING. This table names a student and describes their money.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.cancellation_requests FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) a resolved request must carry an outcome
-- INSERT ... (booking_id, requested_by_email, status) VALUES (<b>,'a@example.test','resolved');
-- PASS: violates cancellation_requests_resolved_needs_outcome.
-- ...and with resolution='refunded', resolved_at=now(): inserted.
--
-- (b) one OPEN request per booking
-- (insert two 'open' rows for the same booking)
-- PASS: duplicate key violates "cancellation_requests_one_open_per_booking".
-- ...and once the first is resolved, a second 'open' row IS accepted — the
--    index is partial. Without this half, (b) proves only that the table
--    rejects things.
--
-- (c) an off-list resolution is refused
-- (resolution='vibes') PASS: violates cancellation_requests_resolution_check.
--
-- (d) anon is refused OUTRIGHT
-- SET ROLE anon; SELECT count(*) FROM public.cancellation_requests;
-- PASS: permission denied for table cancellation_requests.
--   ⚠ A 0 WOULD BE A FAILURE — it would mean a grant exists and RLS filtered.
--
-- (e) student A sees only their own
-- (from A's session) SELECT count(*) FROM public.cancellation_requests;
-- PASS: only rows with user_id = A. Insert one for B; A's count is unchanged.
--
-- (f) ⚠ THE ONE THAT MATTERS — A CANNOT OPEN A REQUEST AGAINST B'S BOOKING
-- (from A's session) INSERT ... (booking_id, user_id, requested_by_email)
--   VALUES (<B's booking>, auth.uid(), 'a@example.test');
-- PASS: new row violates row-level security policy.
-- ...and against their OWN booking: inserted.
--
-- (g) a student cannot resolve their own request
-- (from A's session) UPDATE public.cancellation_requests
--   SET status='resolved', resolution='refunded', resolved_at=now() WHERE user_id=auth.uid();
-- PASS: 0 rows updated — no student UPDATE policy exists.
--
-- (h) cleanup by captured id, never a sweep.
--
-- (i) the three privileges
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='cancellation_requests'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
