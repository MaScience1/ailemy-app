-- ============================================================================
-- 0068_tuition_booking.sql — 1-to-1 booking atomicity
-- ============================================================================
-- ⚠ APPLIED 2026-08-23, reported by the founder, who allocated the number.
--   Written and parked as PROPOSED_tuition_booking.sql, applied to production,
--   then renamed on the same day — renaming and re-heading are ONE step, which
--   is what 0063 exists to memorialise.
--
-- ============================================================================
-- ⚠⚠ AND THE FUNCTION THIS FILE APPLIED DOES NOT WORK. IT FAILS ON EVERY CALL.
-- ============================================================================
--   Two independent defects, either of which is fatal on its own. Both were
--   reproduced by execution on a throwaway PostgreSQL 16 cluster running this
--   file's own function body, extracted from this file rather than retyped:
--
--   (1) `FOR UPDATE` ON AN AGGREGATE — line ~145, `SELECT COALESCE(SUM(delta),
--       0) … FOR UPDATE`. PostgreSQL forbids locking clauses with aggregation:
--         ERROR:  FOR UPDATE is not allowed with aggregate functions
--       plpgsql does not plan embedded SQL until first execution, so CREATE
--       succeeded and the error waits for the first signed-in caller.
--
--   (2) `booking_ref` IS AMBIGUOUS — it is both an OUT parameter of the
--       RETURNS TABLE signature and a real column of private_bookings (0051),
--       and it appears in a RETURNING clause, where plpgsql substitutes
--       variables:
--         ERROR:  column reference "booking_ref" is ambiguous
--       Confirmed by removing defect (1) and calling again; this is what is
--       behind it.
--
--   ⚠ IT FAILS CLOSED. Every observed failure left zero bookings and an
--     unchanged ledger. Nobody has been charged for a lesson they did not get.
--     Combined with the fact that NOTHING CALLS THIS FUNCTION (below), the
--     live blast radius today is zero — but the guarantee §28 exists for is
--     not merely unproven, it is absent.
--
--   ⚠ AND THE COMMENT AT LINES ~135-140 IS WRONG ON THE MERITS. It claims the
--     summed balance "serialises" a concurrent spend. It does not: FOR UPDATE
--     locks the rows a SELECT returns, and cannot block a concurrent INSERT of
--     a new debit row. Demonstrated — two simultaneous callers, one credit:
--         with a per-user advisory lock ..... 1 booking, balance 0
--         without it ........................ 2 bookings, balance -1
--     A student got two lessons for one credit. Serialising a credit spend
--     needs a per-user advisory lock, a lock on a per-user row, or SERIALIZABLE
--     isolation. None of the three is in this file.
--
--   ⚠ THE FIX CANNOT BE A PLAIN CREATE OR REPLACE. Renaming the colliding OUT
--     parameters changes the return type, and PostgreSQL refuses:
--       ERROR:  cannot change return type of existing function
--     It needs DROP FUNCTION first, which means the fix is a new numbered
--     migration — and the number is the founder's to issue, not this file's.
--
--   ⚠ NONE OF THIS WAS DETECTABLE BY THE CHECKS RECORDED BELOW AS VERIFIED.
--     A 42501 is raised at the EXECUTE privilege check, before one statement of
--     the body runs. No amount of anon probing could have reached either
--     defect. That is the lesson worth keeping from this file: a probe that
--     confirms a function's NAME, SIGNATURE and GRANTS has confirmed nothing
--     whatsoever about whether it works.
--
-- ----------------------------------------------------------------------------
-- VERIFICATION — TWO OF SEVEN STEPS RAN AGAINST PRODUCTION.
-- ----------------------------------------------------------------------------
--   Steps 4 and 5 used the PUBLIC ANON KEY only: no service-role key, no
--   writes, no student data. Steps 1, 2 and 3 were run against a LOCAL
--   THROWAWAY REPLICA, never production, and are recorded as such — a replica
--   result is evidence about this SQL, not about that database.
--
--   4. no user_id-bearing overload ... VERIFIED, with a stated limit.
--      rpc/book_slot_with_credit with the exact four named arguments returns
--      42501 "permission denied for function book_slot_with_credit" — the
--      message names the function, which is what carries the inference. The
--      same call with an extra p_user_id returns PGRST202, as do a wrong name
--      and a short argument list, so the 42501 discriminates.
--      ⚠ LIMIT: PGRST202 comes from PostgREST's SCHEMA CACHE, never from
--      Postgres. This proves no user_id-bearing overload is REACHABLE THROUGH
--      POSTGREST; an overload created after the last cache reload would be
--      invisible. A pg_proc query is still owed. See step 7.
--
--   5. anon cannot execute .......... VERIFIED, live, 42501.
--
--   5b. authenticated CAN execute ... NOT RUN. Needs
--       information_schema.routine_privileges, which PostgREST does not expose;
--       a service-role catalogue query was attempted and refused by policy. A
--       negative for anon is not a positive for authenticated.
--
--   7. THE LIVE BODY MATCHES THIS FILE ... NOT RUN, AND NOW THE MOST IMPORTANT
--      STEP IN THE LIST. Everything above tests a name, a signature and an ACL.
--      Nothing tests what the deployed function CONTAINS, and the two defects
--      make that gap load-bearing rather than pedantic — the live function
--      could be this text, or an older revision sharing four parameter names,
--      and every observation recorded here would be identical.
--        SELECT pg_get_functiondef(p.oid) FROM pg_proc p
--          JOIN pg_namespace n ON n.oid = p.pronamespace
--         WHERE n.nspname = 'public' AND p.proname = 'book_slot_with_credit';
--      Diff against the body below. Until that is run, "this folder matches
--      what is live" is this file's INTENTION, not an established fact.
--
--   1. atomicity .................... NOT RUN against production. On the
--      replica, with the defects repaired, forcing 23P01 left the ledger
--      unchanged and the booking count at 1.
--   2. double-booking / credit race . NOT RUN against production. On the
--      replica, see the two-caller demonstration above.
--   3. zero balance raises P0002 .... NOT RUN against production. On the
--      replica, with the defects repaired, it raised 'no credits' and created
--      no booking.
--      All three need a REAL AUTHENTICATED SESSION: auth.uid() is NULL for the
--      postgres role, so the SQL Editor answers 28000 whatever the function
--      does — the trap AGENTS.md records for is_staff(). They also WRITE, to
--      tables holding real students' bookings and credits.
--
--   6. three dangerous privileges ... NOT RUN, and nothing here changes the
--      answer: this file creates no table, so it adds no grant surface for
--      TRUNCATE/TRIGGER/REFERENCES to appear on.
--
-- ⚠ SO §28 ATOMICITY IS NOT PROVEN, AND IT IS ALSO NOT IN EFFECT — TWICE OVER.
--
--     (a) NOT IN EFFECT, because NOTHING CALLS THIS FUNCTION. There is no
--         .rpc( for it anywhere in src/. bookWithCredit() in
--         src/lib/booking/actions.ts still inserts the booking, inserts the
--         debit, and calls compensate() to delete the booking if the debit
--         fails. Applying this migration changed the database and changed
--         nothing about how the application books a lesson.
--     (b) NOT IN EFFECT even if it were called, because it raises on entry.
--
--   Which is a mercy in sequence: had the application been switched to the RPC
--   in the same change, every 1-to-1 booking would have failed outright.
--
-- ----------------------------------------------------------------------------
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
-- re-declaring an applied constraint here is how a rebuild ends up with two
-- definitions and a silent divergence. (The replica run above reproduced that
-- constraint from 0046 in order to force step 1's failure.)
--
-- ⚠ ERASE_USER COUPLING: NOTHING NEW IS OWED, AND HERE IS WHY.
-- The standing rule is that a new person-naming table ships its erasure in the
-- same file. This file adds no table. Every table the RPC touches is already
-- erased by 0067 (erase_user v5): private_bookings at lines 135/291,
-- lesson_credit_transactions at 214, booking_holds at 217. Adding a second
-- DELETE for them here would duplicate erasure logic across two files, which
-- is the failure the rule exists to prevent, pointed the other way. If a
-- future revision of this file adds a table, its DELETE belongs in it.
--
-- ⚠ THE BODY BELOW IS LEFT EXACTLY AS APPLIED, DEFECTS INCLUDED. This folder
-- is the only rebuild path, and it must reproduce what production actually has
-- — not what it should have had. The repair belongs in a later numbered
-- migration, with a DROP FUNCTION, once the founder issues the number.
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
-- WHAT IS STILL OWED, IN FULL, SO IT CAN BE RUN
-- ============================================================================
-- 0. THE REPAIR, which now precedes everything else. A later numbered
--    migration must DROP FUNCTION public.book_slot_with_credit(uuid, text,
--    timestamptz, timestamptz) and recreate it with:
--      · the FOR UPDATE removed from the aggregate, and a per-user
--        `PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));`
--        taken BEFORE the balance is summed — verified on the replica to hold
--        two simultaneous callers to one booking where its absence produced
--        two bookings and a balance of -1;
--      · the OUT parameters renamed (out_booking_id, out_booking_ref,
--        out_credits_remaining) so `booking_ref` in the RETURNING clause is
--        unambiguous.
--    Both repairs were applied to this file's own function body on a throwaway
--    cluster, and steps 1, 2 and 3 then passed there.
--
-- 5b. Grants, the positive half. Expect one row, authenticated | EXECUTE:
--      SELECT grantee, privilege_type FROM information_schema.routine_privileges
--       WHERE routine_name = 'book_slot_with_credit';
--
-- 7. Body equivalence — the step this file most needs:
--      SELECT pg_get_functiondef(p.oid) FROM pg_proc p
--        JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public' AND p.proname = 'book_slot_with_credit';
--
-- 1/2/3. Atomicity, the race, and P0002 — against production, from a signed-in
--    session, ONLY once the repair in step 0 is applied. Running them against
--    the function as it stands can only reproduce the entry error.
--
-- 6. The standing check after any table-creating migration. This one creates
--    none, so it must still return zero rows:
--      SELECT table_name, grantee, privilege_type
--        FROM information_schema.role_table_grants
--       WHERE table_schema='public' AND grantee IN ('anon','authenticated')
--         AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
--
-- ⚠ 1, 2 and 3 WRITE TO PRODUCTION TABLES holding real students' bookings and
--   credits. Run them against a scratch account and delete by the ids captured
--   at creation — never a table-wide sweep.
-- ============================================================================
