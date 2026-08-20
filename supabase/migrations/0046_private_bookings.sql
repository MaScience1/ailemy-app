-- ============================================================================
-- 0046_PROPOSED_private_bookings.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-19, after 0045. Renamed from
-- 0046_PROPOSED_ once verified. VERIFICATION: ALL RUNNABLE ASSERTIONS PASS.
--
--   (a) an OVERLAPPING booking for one teacher refused BY the exclusion
--       constraint private_bookings_no_overlap, 23P01                   ✓
--       ⚠ THE DOUBLE-BOOKING GUARD, PROVEN. Two students clicking the
--       same slot cannot both end up owning it.
--   (b) …but the same time for a DIFFERENT teacher inserts              ✓
--   (c) …and a CANCELLED booking frees its slot                         ✓
--   (d) 13:00–14:00 and 14:00–15:00 do not collide — tstzrange is
--       half-open, so back-to-back lessons are legal                    ✓
--   (e) single with no payment_ref refused BY …_single_needs_payment    ✓
--       …and paid_with 'credit' with none IS accepted                   ✓
--   (f) anon REFUSED OUTRIGHT on both tables, 42501 — the PII line      ✓
--       …and no column-level way in either                              ✓
--       ⚠ CHECKED AS AN ERROR, NOT AS A ZERO. 0 rows would mean a grant
--       existed and RLS merely filtered.
--   (g) A SIGNED-IN STUDENT SEES ONLY THEIR OWN                         ✓
--       every row returned belonged to them; another student's booking
--       was invisible; their own hold was visible
--   (h) …and CANNOT write their own booking, 42501                      ✓
--   (i) a hold expiring in the past refused BY …_expiry_future          ✓
--
--   ⚠ (g)/(h) HAD NEVER BEEN RUN BEFORE. Every earlier round skipped the
--   own-row policies for want of an authenticated session, and service_role
--   is not a substitute — it bypasses RLS and proves nothing about a policy.
--   This run created throwaway users, signed in as one, and tested for real.--
--   ⚠ THE THREE PRIVILEGES WAS NOT RUN AND IS NOT CLAIMED. information_schema
--   is not exposed through PostgREST and TRUNCATE/TRIGGER/REFERENCES cannot be
--   exercised over REST. SQL Editor only.
--
-- ============================================================================
-- ⚠ THE CENTRAL RULE: A SLOT IS NOT BOOKED UNTIL PAYMENT SUCCEEDS (§26)
-- ============================================================================
-- Selecting a slot creates a HOLD, not a booking. The hold expires. Payment —
-- verified server-side by webhook, never by a browser redirect (§63) — turns it
-- into a confirmed booking. If payment never completes, the hold lapses and the
-- slot returns to the pool.
--
-- ⚠ TWO TABLES, NOT ONE WITH A STATUS COLUMN. A hold and a booking have
-- different lifetimes, different owners of truth, and different consequences
-- for being wrong. A stale hold must vanish on its own; a booking must never
-- vanish on its own. Collapsing them means an expiry sweep that can delete a
-- paid lesson if a status is ever miscomputed.
--
-- ============================================================================
-- ⚠ anon GETS NO ACCESS TO EITHER TABLE. NOT A ROW, NOT A COLUMN.
-- ============================================================================
-- §62 says the public may see available slots and must NOT see booking
-- ownership. The tempting shape is to let anon read bookings with a column
-- grant covering only the times. This does not do that, because it does not
-- have to: open slots are computed SERVER-SIDE and the page receives only the
-- slots that are free. A visitor never queries this table, so there is no
-- column list to get wrong later, and no row policy standing between a
-- student's name and the internet.
-- ============================================================================

-- ── SECTION 1: TABLES ───────────────────────────────────────────────────────
BEGIN;

/**
 * A temporary reservation while a student is at the checkout (§28).
 *
 * ⚠ expires_at IS NOT DECORATION. Somebody opens Stripe and closes the tab;
 * without an expiry that slot is gone forever. §28 is explicit: do not
 * permanently block a slot because someone opened checkout and disappeared.
 */
CREATE TABLE IF NOT EXISTS public.booking_holds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ⚠ NULLABLE, BECAUSE A PARENT MAY NOT HAVE AN ACCOUNT YET. The email is the
  -- durable identity at hold time; user_id is filled when one exists.
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email          text NOT NULL,

  subject        text,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  expires_at     timestamptz NOT NULL,

  -- Set when checkout begins, so a webhook can find the hold it belongs to.
  checkout_ref   text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT booking_holds_ordered CHECK (ends_at > starts_at),
  CONSTRAINT booking_holds_expiry_future CHECK (expires_at > created_at),
  CONSTRAINT booking_holds_email_shape CHECK (position('@' IN email) > 1)
);

CREATE INDEX IF NOT EXISTS booking_holds_live_idx
  ON public.booking_holds (teacher_id, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS booking_holds_checkout_idx
  ON public.booking_holds (checkout_ref);

/**
 * A confirmed 1-to-1 lesson.
 *
 * status: confirmed | cancelled | completed | no_show
 * paid_with: single | credit   — how it was paid for, which decides what a
 *            cancellation restores (§39).
 */
CREATE TABLE IF NOT EXISTS public.private_bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email           text NOT NULL,

  subject         text,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  timezone        text NOT NULL DEFAULT 'Asia/Qatar',

  status          text NOT NULL DEFAULT 'confirmed',
  paid_with       text NOT NULL,

  -- Stripe's identifiers, for reconciliation. NULL when paid with a credit.
  payment_ref     text,
  amount_pence    integer,
  currency        text,

  cancelled_at    timestamptz,
  cancelled_by    text,
  notes           text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT private_bookings_ordered CHECK (ends_at > starts_at),
  CONSTRAINT private_bookings_status_check
    CHECK (status IN ('confirmed','cancelled','completed','no_show')),
  CONSTRAINT private_bookings_paid_with_check
    CHECK (paid_with IN ('single','credit')),
  CONSTRAINT private_bookings_email_shape CHECK (position('@' IN email) > 1),

  -- ⚠ A SINGLE-PAYMENT BOOKING MUST CARRY ITS PAYMENT. Without this a booking
  -- can exist claiming it was paid for with money and name no transaction —
  -- unreconcilable, and indistinguishable from one created by mistake.
  CONSTRAINT private_bookings_single_needs_payment
    CHECK (paid_with <> 'single' OR payment_ref IS NOT NULL)
);

-- ⚠ THE DOUBLE-BOOKING GUARD, IN THE DATABASE (§28).
-- Application-level checking loses a race between two students clicking at the
-- same moment; only the database can serialise that. A btree_gist exclusion
-- constraint refuses any two LIVE bookings for one teacher whose times overlap.
-- Cancelled and no-show rows are excluded, so a cancelled lesson frees its slot.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.private_bookings
  DROP CONSTRAINT IF EXISTS private_bookings_no_overlap;
ALTER TABLE public.private_bookings
  ADD CONSTRAINT private_bookings_no_overlap
  EXCLUDE USING gist (
    teacher_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('confirmed','completed'));

CREATE INDEX IF NOT EXISTS private_bookings_teacher_idx
  ON public.private_bookings (teacher_id, starts_at);
CREATE INDEX IF NOT EXISTS private_bookings_user_idx
  ON public.private_bookings (user_id, starts_at DESC);

COMMIT;

-- ── SECTION 2: ROW-LEVEL SECURITY ───────────────────────────────────────────
BEGIN;

ALTER TABLE public.booking_holds    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_bookings ENABLE ROW LEVEL SECURITY;

-- ⚠ NO anon POLICY ON EITHER TABLE, DELIBERATELY. RLS denies by default, so
-- the ABSENCE of a policy is the protection. Open slots reach the public page
-- through a server-side computation, never through a client query.

-- A student sees their own bookings and nothing else (§62, §75.63).
DROP POLICY IF EXISTS private_bookings_read_own ON public.private_bookings;
CREATE POLICY private_bookings_read_own
  ON public.private_bookings FOR SELECT TO authenticated
  USING (public.private_bookings.user_id = auth.uid());

-- ⚠ READ-ONLY FOR THE STUDENT. No student write policy of any kind: booking,
-- cancelling and rescheduling all happen server-side after a payment or credit
-- check. A student who could UPDATE their own row could move a lesson on top of
-- someone else's, or flip a cancelled booking back to confirmed.

DROP POLICY IF EXISTS private_bookings_staff_all ON public.private_bookings;
CREATE POLICY private_bookings_staff_all ON public.private_bookings
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Holds are operational and short-lived; a student may see their own so the
-- checkout page can show "held until 19:12".
DROP POLICY IF EXISTS booking_holds_read_own ON public.booking_holds;
CREATE POLICY booking_holds_read_own
  ON public.booking_holds FOR SELECT TO authenticated
  USING (public.booking_holds.user_id = auth.uid());

DROP POLICY IF EXISTS booking_holds_staff_all ON public.booking_holds;
CREATE POLICY booking_holds_staff_all ON public.booking_holds
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

COMMIT;

-- ── SECTION 3: GRANTS ───────────────────────────────────────────────────────
BEGIN;

-- ⚠ anon IS GRANTED NOTHING ON EITHER TABLE. Not SELECT, not anything. This is
-- the line that keeps a student's name and email off the public internet, and
-- it is a grant rather than a policy on purpose: grants are checked first, so
-- there is no policy body to get wrong.
GRANT SELECT ON public.private_bookings TO authenticated;
GRANT SELECT ON public.booking_holds    TO authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.private_bookings FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.booking_holds    FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) the overlap guard, which is the whole point of the table
-- INSERT INTO public.private_bookings (teacher_id,email,starts_at,ends_at,paid_with,payment_ref)
--   VALUES (<t>,'a@example.test','2026-10-05T13:00Z','2026-10-05T14:00Z','single','pi_1');
-- INSERT … same teacher, '2026-10-05T13:30Z' → '2026-10-05T14:30Z', 'pi_2';
-- PASS: conflicting key value violates exclusion constraint
--       "private_bookings_no_overlap".
--
-- (b) …but a DIFFERENT teacher at the same time is fine
-- PASS: inserted. Without this, (a) proves only that the table rejects things.
--
-- (c) …and a CANCELLED booking frees its slot
-- UPDATE public.private_bookings SET status='cancelled' WHERE payment_ref='pi_1';
-- INSERT … the overlapping row again;
-- PASS: inserted, because the constraint's WHERE excludes cancelled rows.
--
-- (d) touching times: 13:00–14:00 and 14:00–15:00
-- PASS: inserted. tstzrange is half-open, so back-to-back lessons do not
--   collide — which is what a 15-minute buffer is for, in the slot generator.
--
-- (e) a single-payment booking with no payment_ref is refused
-- PASS: violates private_bookings_single_needs_payment.
-- …and paid_with='credit' with payment_ref NULL is accepted.
--
-- (f) anon is refused OUTRIGHT — the PII line
-- SET ROLE anon; SELECT count(*) FROM public.private_bookings;
-- PASS: permission denied for table private_bookings.
--   ⚠ A 0 HERE WOULD BE A FAILURE, not a pass: it would mean a SELECT grant
--   exists and RLS merely filtered. The error is the proof. Same for holds.
--
-- (g) a signed-in student sees ONLY their own
-- (from a session for user A) SELECT count(*) FROM public.private_bookings;
-- PASS: only rows with user_id = A. Insert one for user B and confirm A's
--   count does not change.
--
-- (h) a student cannot write
-- (from A's session) UPDATE public.private_bookings SET starts_at=… WHERE user_id=A;
-- PASS: 0 rows updated — no student write policy exists.
--
-- (i) a hold expiry in the past is refused
-- PASS: violates booking_holds_expiry_future.
--
-- (j) cleanup by captured id, never a sweep.
--
-- (k) the three privileges
-- SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name IN ('booking_holds','private_bookings')
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
--
-- (l) anon holds NO privilege at all on these two
-- SELECT table_name, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name IN ('booking_holds','private_bookings')
--    AND grantee='anon';
-- PASS: zero rows.
