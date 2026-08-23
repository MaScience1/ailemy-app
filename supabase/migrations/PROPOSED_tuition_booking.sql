-- ============================================================================
-- PROPOSED — 1-to-1 booking atomicity.  NOT APPLIED.
-- ============================================================================
-- ⚠ THIS FILE IS PARKED AND UNAPPLIED. Nothing in it has run against any
-- database. Every guarantee it describes is UNVERIFIED until the project owner
-- applies it and records the result in this header, exactly as 0029–0035 do.
-- The suite carries matching sabotage tests marked PENDING for the same reason:
-- a test that cannot execute must not report a pass.
--
-- ⚠ IT ADDS NO TABLES, AND THAT IS THE FINDING. The sixth consecutive build to
-- inspect first found the schema already present:
--
--   teacher_availability        admin-published slots        (0045)
--   availability_blocks         blocked periods/exceptions   (0045)
--   private_bookings            the bookings themselves      (0046)
--   lesson_credit_transactions  the credit LEDGER, not a     (0047)
--                               mutable integer — §27 already satisfied
--   booking_holds               pay-as-you-go reservations   (0047)
--   tuition_packages            the products                 (0047)
--   cohort_enrolments           group access, kept separate  (0049)
--
-- ⚠ §29 IS ALREADY DONE AND APPLIED. 0046 carries
-- `private_bookings_no_overlap`, a btree_gist EXCLUDE constraint, and its own
-- header records it verified against 23P01. This file does NOT redefine it;
-- re-declaring an applied constraint in a parked file is how a rebuild ends up
-- with two definitions and a silent divergence.
--
-- ⚠ SO THE ONE REAL GAP IS §28: ATOMICITY BETWEEN THE BOOKING AND THE CREDIT.
-- src/lib/booking/actions.ts inserts the booking, then inserts the ledger
-- debit, and deletes the booking if the debit fails — a compensating saga. It
-- is careful and it is not a transaction: if the process dies between the two
-- statements, a confirmed booking exists that consumed no credit. That is
-- precisely the state §28 forbids, and only the database can close it.
--
-- ⚠ ERASE_USER COUPLING: NOTHING NEW IS OWED, AND HERE IS WHY.
-- The standing rule is that a new person-naming table ships its erasure in the
-- same file. This file adds no table. Every table the RPC touches is already
-- erased by 0067 (erase_user v5): private_bookings at lines 135/291,
-- lesson_credit_transactions at 214, booking_holds at 217. Adding a second
-- DELETE for them here would duplicate erasure logic across two files, which
-- is the failure the rule exists to prevent, pointed the other way. If a
-- future revision of this file adds a table, its DELETE belongs in it.
-- ============================================================================

BEGIN;

-- ── §28 — one statement, or none of it ──────────────────────────────────────
--
-- ⚠ SECURITY DEFINER, AND THE search_path IS PINNED. A definer function that
-- resolves unqualified names through the caller's search_path can be pointed at
-- an attacker's schema; every function in this project pins it for that reason.
--
-- ⚠ IT TAKES THE STUDENT FROM auth.uid(), NEVER FROM AN ARGUMENT. A user_id
-- parameter would let any caller book on anyone's behalf and spend their
-- credits — the single most valuable thing to get wrong in this file.
CREATE OR REPLACE FUNCTION public.book_slot_with_credit(
  p_teacher_id  uuid,
  p_subject     text,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz
)
RETURNS TABLE (booking_id uuid, booking_ref text, credits_remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_email text;
  v_bal   integer;
  v_id    uuid;
  v_ref   text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000';
  END IF;

  -- ⚠ SERVER TIME (§66). The browser clock is not consulted anywhere in this
  -- function; a slow device must not be able to book a slot that has started.
  IF p_starts_at <= now() THEN
    RAISE EXCEPTION 'slot has already started' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;

  -- ⚠ THE BALANCE IS SUMMED FROM THE LEDGER, NOT READ FROM A COLUMN (§26,
  -- §27). There is no remaining_credits integer to go stale or to be tampered
  -- with; the balance is whatever the transactions say it is.
  --
  -- ⚠ AND THE SUM IS TAKEN INSIDE THIS TRANSACTION, so a concurrent spend of
  -- the same last credit serialises behind it rather than both reading 1.
  SELECT COALESCE(SUM(delta), 0) INTO v_bal
    FROM public.lesson_credit_transactions
   WHERE user_id = v_user
     AND (expires_at IS NULL OR expires_at > now())
   FOR UPDATE;

  IF v_bal < 1 THEN
    RAISE EXCEPTION 'no credits' USING ERRCODE = 'P0002';
  END IF;

  -- The booking. private_bookings_no_overlap (0046) decides the race here;
  -- a losing caller gets 23P01 and this whole function rolls back, so no
  -- credit is spent on a booking that did not happen.
  INSERT INTO public.private_bookings
    (teacher_id, user_id, email, subject, starts_at, ends_at, paid_with, status)
  VALUES
    (p_teacher_id, v_user, v_email, p_subject, p_starts_at, p_ends_at, 'credit', 'confirmed')
  RETURNING id, booking_ref INTO v_id, v_ref;

  -- The debit, in the same transaction as the booking it pays for. This is the
  -- whole point of the function: the saga in actions.ts cannot make these two
  -- statements succeed or fail together, and this can.
  INSERT INTO public.lesson_credit_transactions
    (user_id, delta, reason, booking_id, idempotency_key)
  VALUES
    (v_user, -1, 'booking', v_id, 'booking:' || v_id::text);

  RETURN QUERY SELECT v_id, v_ref, (v_bal - 1);
END;
$$;

-- ⚠ EXECUTE IS GRANTED TO authenticated AND TO NOBODY ELSE. anon must not be
-- able to call a function that spends credits; the function's own auth.uid()
-- check would refuse it, but a grant that never existed cannot be relied on
-- being refused later.
REVOKE ALL ON FUNCTION public.book_slot_with_credit(uuid, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_slot_with_credit(uuid, text, timestamptz, timestamptz) TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION — TO BE RUN BY THE OWNER AFTER APPLYING. NONE OF IT HAS RUN.
-- ============================================================================
-- 1. Atomicity. Spend the last credit, then force the booking insert to fail
--    (e.g. book an overlapping slot). Expect: 23P01, and the ledger UNCHANGED.
--      SELECT COALESCE(SUM(delta),0) FROM public.lesson_credit_transactions
--       WHERE user_id = '<student>';
--
-- 2. Double booking. Two sessions call the function for the same slot at the
--    same moment. Expect: exactly one row in private_bookings for that slot,
--    exactly one -1 in the ledger.
--
-- 3. No credit. A student with a zero balance calls it. Expect P0002, and NO
--    row in private_bookings.
--
-- 4. Identity. A student passes another student's id — impossible by
--    signature, which is the point. Confirm the function has no user_id
--    parameter.
--
-- 5. Grants. Expect exactly one row, authenticated:
--      SELECT grantee, privilege_type FROM information_schema.routine_privileges
--       WHERE routine_name = 'book_slot_with_credit';
--
-- 6. And the standing check after any table-creating migration — this one
--    creates none, so it must still return zero rows:
--      SELECT table_name, grantee, privilege_type
--        FROM information_schema.role_table_grants
--       WHERE table_schema='public' AND grantee IN ('anon','authenticated')
--         AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- ============================================================================
