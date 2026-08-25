-- ============================================================================
-- 0069_PROPOSED_fix_book_slot_with_credit.sql
-- ----------------------------------------------------------------------------
-- ⚠ NUMBER ISSUED BY THE FOUNDER (2026-08-23, repair of 0068).
-- ⚠ PARKED AND NOT APPLIED. Nothing in this file has run against production.
--   Rename to 0069_fix_book_slot_with_credit.sql — dropping _PROPOSED_ — only
--   once it is applied, and record the step counts below in the same edit.
--   A rebuild replays this folder in order, so an unapplied file sitting under
--   a plain number manufactures the drift the rule exists to prevent:
--   production without it, a rebuild with it. 0033 sat as _PROPOSED_ for a day
--   for exactly this reason.
--
-- ============================================================================
-- ⚠⚠ THE APPLICATION MUST NOT BE SWITCHED TO THIS RPC UNTIL 0069 IS APPLIED
--     AND STEP 7 PASSES.
-- ============================================================================
--   Nothing calls public.book_slot_with_credit today; bookWithCredit() in
--   src/lib/booking/actions.ts still runs insert → insert → compensate().
--   That is the only reason 0068's defects have cost nothing. Wire the RPC
--   before this repair is applied and verified and EVERY 1-to-1 booking fails
--   outright — the function raises before it reaches its first INSERT.
--
--   The order is: apply 0069 → run step 7 → then wire the application, in a
--   separate change, which also removes compensate(). The suite enforces the
--   last part: the RPC and the saga may never both be live.
--
-- ============================================================================
-- (a) WHAT 0068 APPLIED, AND THE TWO DEFECTS IT SHIPPED
-- ============================================================================
--   0068 is applied and live, and its function raises on EVERY call. Two
--   independent defects, either fatal alone. plpgsql defers planning of
--   embedded SQL to first execution, so CREATE succeeded and both errors
--   waited for the first caller — which never came.
--
--   DEFECT 1 — a locking clause on an aggregate:
--       SELECT COALESCE(SUM(delta), 0) INTO v_bal ... FOR UPDATE;
--     ERROR:  FOR UPDATE is not allowed with aggregate functions
--
--   DEFECT 2 — an OUT parameter colliding with a real column, inside a
--   RETURNING clause, where plpgsql substitutes variables. `booking_ref` is
--   both a RETURNS TABLE out-parameter and a private_bookings column (0051):
--     ERROR:  column reference "booking_ref" is ambiguous
--     DETAIL:  It could refer to either a PL/pgSQL variable or a table column.
--   Found only by removing defect 1 and calling again — it was behind it.
--
--   AND A THIRD THING THAT WAS NOT AN ERROR BUT A FALSE CLAIM. 0068's comment
--   said the summed balance "serialises" a concurrent spend. FOR UPDATE locks
--   the rows a SELECT RETURNS; it cannot block a concurrent INSERT of a new
--   debit row, which is the operation that must be excluded. So even had the
--   clause parsed, the race would have stood. Measured — see (b).
--
-- ============================================================================
-- (b) REPLICA EVIDENCE FOR THIS REPAIR
-- ============================================================================
--   Run on a throwaway PostgreSQL 16.15 cluster, never production. 0068's body
--   was applied first so the DROP path below was exercised from the real prior
--   state, then this file was applied over it. The function body was DERIVED
--   from 0068 by three asserted edits, not retyped.
--
--   ⚠ A REPLICA RESULT IS EVIDENCE ABOUT THIS SQL, NOT ABOUT THAT DATABASE.
--     It says the statements do what they claim. It says nothing about
--     production until (c) and (d) are run there.
--
--   HAPPY PATH ......... returned BK-0001, remaining 4, from a balance of 5.
--                        bookings 1, debits 1.
--   ATOMICITY .......... re-booking the same slot raised
--                        23P01 conflicting key value violates exclusion
--                        constraint "private_bookings_no_overlap"
--                        debits before 1 → debits after 1 (UNCHANGED)
--                        bookings 1 (UNCHANGED)
--   ZERO BALANCE ....... balance drained to 0, call raised P0002 'no credits',
--                        bookings created by it: 0.
--   SERVER TIME (§66) .. a start time in the past raised 'slot has already
--                        started' before any balance was read.
--
--   THE RACE — two simultaneous callers, one credit between them, two
--   different slots. The only difference between the rows is the advisory
--   lock; the lock line was deleted and re-added to produce them:
--
--       ┌──────────────────────────┬──────────┬────────┬─────────┐
--       │                          │ bookings │ debits │ balance │
--       ├──────────────────────────┼──────────┼────────┼─────────┤
--       │ WITH the advisory lock   │        1 │      1 │       0 │
--       │ WITHOUT it               │        2 │      2 │      -1 │
--       └──────────────────────────┴──────────┴────────┴─────────┘
--
--   Without the lock a student received two lessons for one credit and the
--   ledger went negative. With it, one caller books and the other is refused
--   'no credits'. Which caller wins alternates between runs, as it should;
--   the invariant that holds every time is the first row.
--
-- ============================================================================
-- (e) ERASE_USER: NO EXTENSION IS REQUIRED, AND HERE IS WHY
-- ============================================================================
--   This file creates no table and names no new person. It replaces one
--   function. Every table it writes is already erased by 0067 (erase_user v5):
--   private_bookings at lines 135/291, lesson_credit_transactions at 214.
--   Adding DELETEs here would duplicate erasure logic across two files, which
--   is the failure the coupling rule exists to prevent, pointed the other way.
--   If a later revision of this file adds a table, its DELETE belongs in it.
-- ============================================================================
BEGIN;

-- ── the DROP is not optional, and this is why ───────────────────────────────
--
-- ⚠ CREATE OR REPLACE CANNOT DO THIS. Renaming the colliding OUT parameters
-- changes the function's return type, and PostgreSQL refuses outright:
--     ERROR:  cannot change return type of existing function
-- Observed on the replica when this repair was first attempted as a REPLACE.
-- So the function is dropped and recreated, which is why this needs its own
-- numbered migration rather than an edit to 0068.
--
-- ⚠ THE SIGNATURE IS UNCHANGED — same four arguments, same order, same types.
-- Only the OUT names move. Nothing that calls it by signature breaks; nothing
-- calls it at all today, which is the safest possible moment to do this.
DROP FUNCTION IF EXISTS public.book_slot_with_credit(uuid, text, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.book_slot_with_credit(
  p_teacher_id  uuid,
  p_subject     text,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz
)
RETURNS TABLE (out_booking_id uuid, out_booking_ref text, out_credits_remaining integer)
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
  -- ⚠ THE LOCK IS WHAT SERIALISES, AND 0068 GOT THIS WRONG TWICE OVER.
  -- 0068 claimed the sum itself serialised a concurrent spend "rather than
  -- both reading 1", and used `FOR UPDATE` to do it. Neither half held:
  -- PostgreSQL forbids a locking clause on an aggregate at all, and even had
  -- it parsed, FOR UPDATE locks the rows a SELECT RETURNS — it cannot block a
  -- concurrent INSERT of a new debit row, which is exactly the operation that
  -- has to be excluded. Measured on a replica, two simultaneous callers with
  -- one credit between them produced TWO bookings and a balance of -1.
  --
  -- A transaction-scoped advisory lock keyed on the student is the smallest
  -- thing that actually excludes: it is taken BEFORE the balance is read,
  -- released at commit or rollback with no unlock path to forget, and it
  -- serialises only that one student's spends rather than the whole ledger.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  SELECT COALESCE(SUM(delta), 0) INTO v_bal
    FROM public.lesson_credit_transactions
   WHERE user_id = v_user
     AND (expires_at IS NULL OR expires_at > now());

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

-- ⚠ THE GRANTS ARE RE-ISSUED BECAUSE DROP TOOK THEM WITH IT. A dropped
-- function's ACL does not survive; without these two lines the repair would
-- leave `authenticated` unable to execute and the whole thing dark. 0068's
-- grants verified live (anon 42501) — they must be restored, not assumed.
REVOKE ALL ON FUNCTION public.book_slot_with_credit(uuid, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_slot_with_credit(uuid, text, timestamptz, timestamptz) TO authenticated;

COMMIT;

-- ============================================================================
-- (c)+(d) VERIFICATION — TO BE RUN AFTER APPLYING. EVERY STEP RETURNS A COUNT.
-- ============================================================================
-- ⚠ NONE OF THIS HAS RUN AGAINST PRODUCTION. The numbers in the EXPECT column
--   are what each query must return; the replica figures in (b) are evidence
--   about the SQL, not a substitute for running these there.
--
-- ⚠ AND EVERY STEP IS A COUNT, NOT A BANNER. 0068's list said things like
--   "expect 23P01" and "expect the ledger unchanged", which a person reads and
--   nods at. A count is a number that is either right or wrong, and a
--   shortfall aborts instead of reassuring.
--
-- ── STEP 7 · THE LIVE BODY MATCHES THIS FILE ────────────── run this FIRST ──
--
--   ⚠ FIRST, NOT LAST, AND FIRST-CLASS. 0068's list did not contain this step
--   at all, and that omission is the whole story of that file: its checks
--   confirmed a NAME, a SIGNATURE and an ACL, all of which were perfect, while
--   the body could not execute. A 42501 is raised at the EXECUTE privilege
--   check, before one statement of the body runs. Nothing that probes the
--   interface can see inside it.
--
--   Each of these three discriminates — every one was run against BOTH the
--   repaired and the broken function on the replica, and the triple reads
--   1/0/1 for repaired and 0/1/0 for broken:
--
--     EXPECT 1 — the return type carries the renamed OUT parameters:
--       SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--        WHERE n.nspname='public' AND p.proname='book_slot_with_credit'
--          AND pg_get_function_result(p.oid) LIKE '%out_booking_ref%';
--
--     EXPECT 0 — the defective locking clause is gone from the body:
--       SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--        WHERE n.nspname='public' AND p.proname='book_slot_with_credit'
--          AND pg_get_functiondef(p.oid) LIKE '%FOR UPDATE;%';
--       ⚠ 'FOR UPDATE;' WITH THE SEMICOLON, DELIBERATELY. pg_get_functiondef
--         returns comments too, and the commentary in this file discusses
--         FOR UPDATE by name twice. Matching the bare phrase returns 1 for the
--         REPAIRED function — it reads the prose, not the code. The semicolon
--         is what makes it a statement. This was found by the query returning
--         1 when it should have returned 0.
--
--     EXPECT 1 — the lock that actually serialises is present:
--       SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--        WHERE n.nspname='public' AND p.proname='book_slot_with_credit'
--          AND pg_get_functiondef(p.oid) LIKE '%pg_advisory_xact_lock(%';
--
--   And the full text, to be diffed by eye against the body below:
--       SELECT pg_get_functiondef(p.oid) FROM pg_proc p
--         JOIN pg_namespace n ON n.oid = p.pronamespace
--        WHERE n.nspname = 'public' AND p.proname = 'book_slot_with_credit';
--
--   ⚠ UNTIL THESE PASS, "this folder matches what is live" is an intention.
--
-- ── STEP 4 · SIGNATURE ──────────────────────────────────────────────────────
--     EXPECT 1 — exactly one overload survives the DROP + CREATE:
--       SELECT count(*) FROM pg_proc WHERE proname='book_slot_with_credit';
--       ⚠ EXACTLY ONE. A second overload is how a DROP that named the wrong
--         argument types leaves the broken function live beside the repair.
--     EXPECT 0 — none of them takes the student as an argument:
--       SELECT count(*) FROM pg_proc WHERE proname='book_slot_with_credit'
--          AND pg_get_function_arguments(oid) LIKE '%user_id%';
--
-- ── STEP 5 · GRANTS ─────────────────────────────────────────────────────────
--   ⚠ DROP TOOK THE OLD ACL WITH IT. These are not a formality after a DROP;
--     they are the check that the function is reachable at all.
--     EXPECT 1 — authenticated holds EXECUTE:
--       SELECT count(*) FROM information_schema.routine_privileges
--        WHERE routine_name='book_slot_with_credit'
--          AND grantee='authenticated' AND privilege_type='EXECUTE';
--     EXPECT 0 — anon holds nothing:
--       SELECT count(*) FROM information_schema.routine_privileges
--        WHERE routine_name='book_slot_with_credit' AND grantee='anon';
--     EXPECT 0 — PUBLIC holds nothing:
--       SELECT count(*) FROM information_schema.routine_privileges
--        WHERE routine_name='book_slot_with_credit' AND grantee='PUBLIC';
--     And from outside, with the ANON key — costs nothing and needs no
--     catalogue access. EXPECT 42501, message naming the function:
--       POST /rest/v1/rpc/book_slot_with_credit
--       ⚠ A 42501 HERE PROVES ONLY THAT anon IS REFUSED. It is what 0068
--         passed while being unable to run. It is not step 7.
--
-- ── STEP 1 · ATOMICITY ──────────────────────────────────────────────────────
--   As a signed-in student holding exactly one credit, book a slot, then book
--   an overlapping one so private_bookings_no_overlap raises 23P01.
--     EXPECT the two counts EQUAL, run before and after the failing call:
--       SELECT count(*) FROM public.lesson_credit_transactions
--        WHERE user_id = '<student>' AND delta = -1;
--     EXPECT 1 — the first booking survives and the second left nothing:
--       SELECT count(*) FROM public.private_bookings
--        WHERE user_id = '<student>' AND status = 'confirmed';
--
-- ── STEP 2 · THE RACE ───────────────────────────────────────────────────────
--   Two signed-in sessions, one credit between them, two different slots, at
--   the same moment.
--     EXPECT 1 — one booking, not two:
--       SELECT count(*) FROM public.private_bookings WHERE user_id = '<student>';
--     EXPECT 1 — one debit, not two:
--       SELECT count(*) FROM public.lesson_credit_transactions
--        WHERE user_id = '<student>' AND delta = -1;
--     EXPECT 0 — the balance never goes negative:
--       SELECT count(*) FROM (
--         SELECT COALESCE(SUM(delta),0) AS b FROM public.lesson_credit_transactions
--          WHERE user_id = '<student>') s WHERE s.b < 0;
--
-- ── STEP 3 · NO CREDIT ──────────────────────────────────────────────────────
--   A signed-in student with a zero balance calls it; expect P0002.
--     EXPECT 0 — no booking was created for a lesson nobody paid for:
--       SELECT count(*) FROM public.private_bookings
--        WHERE user_id = '<student>' AND starts_at = '<the slot>';
--
-- ── STEP 6 · THE STANDING PRIVILEGE CHECK ───────────────────────────────────
--   This file creates no table, so it adds no grant surface — but the check is
--   standing and cheap.
--     EXPECT 0:
--       SELECT count(*) FROM information_schema.role_table_grants
--        WHERE table_schema='public' AND grantee IN ('anon','authenticated')
--          AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
--
-- ⚠ STEPS 1, 2 AND 3 WRITE TO PRODUCTION TABLES holding real students'
--   bookings and credits. Use a scratch account and delete by the ids captured
--   at creation — never a table-wide sweep.
--
-- ⚠ WHEN THEY HAVE RUN: write each count into this header, drop _PROPOSED_
--   from the filename, and mark any step SKIPPED with its reason rather than
--   leaving a header that reads as claiming more than was checked.
-- ============================================================================
