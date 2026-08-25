-- ============================================================================
-- 0069 · STEPS 1, 2 AND 3 — THE THREE THAT WERE NEVER RUN
-- ============================================================================
-- Steps 4, 5, 6 and 7 are verified and recorded in the migration header.
-- Steps 1 and 3 were NOT RUN (auth.uid() is NULL for the postgres role, so the
-- function returns 28000 'not signed in' before reaching anything under test).
-- Step 2 was SKIPPED. This file closes all three.
--
-- ⚠⚠ NOTHING HERE PERSISTS. EVERY SECTION IS BEGIN … ROLLBACK.
-- ============================================================================
-- Each section opens a transaction, sets up its own state, runs the test,
-- prints its verification, and ROLLS BACK. No booking, no credit row and no
-- function change survives — including the sabotage sections, because DDL is
-- transactional in Postgres. If you walk away mid-paste, the open transaction
-- dies with the session and the database is untouched. There is no cleanup
-- step to forget.
--
-- ⚠ RUN ONE SECTION AT A TIME. A long paste into the SQL Editor has already
-- applied PARTIALLY and reported success once in this project. Each section is
-- self-contained and ends with its own ROLLBACK.
--
-- ============================================================================
-- ⚠ HOW TO READ A RED — THIS IS THE PART THAT MATTERS
-- ============================================================================
-- Several sections EXPECT an error. A red in those places is the pass. The
-- danger is a red that fires for the wrong reason and looks like the same
-- thing, so check the SQLSTATE, not the colour:
--
--   RIGHT-REASON RED (the pass):
--     23P01  exclusion_violation   — the overlap constraint bit (Step 1)
--     P0002  no_data_found         — 'no credits' raised by the RPC (Step 3)
--
--   WRONG-REASON RED (a real failure — STOP and report it):
--     28000  'not signed in'       — the JWT shim did not take. auth.uid() is
--                                    still NULL, so nothing under test ran and
--                                    the section proved nothing.
--     42501  permission denied     — the role cannot execute the function; you
--                                    are testing grants, not behaviour.
--     22023  'slot has already started' — the timestamps below drifted into the
--                                    past. Move them forward; nothing was tested.
--     42883  function does not exist — wrong signature or search_path.
--     23505 on lesson_credit_transactions — the setup credit collided with a
--                                    real row. Change the idempotency_key
--                                    suffix and re-run; the test never began.
--
-- A section that returns ROWS is telling you its counts. A section that raises
-- one of the two RIGHT-REASON codes has passed. A section that returns rows
-- where an error was expected has FAILED — that is the important one, and it
-- is the quiet direction.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — WHO AND WHAT. Read the counts before running anything else.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ NO DEFAULT TARGET. The student is resolved by a named email and the
--   teacher by ORDER BY, not by "the newest row" — a default target in a block
--   like this once erased the admin account in this project.
--
-- ⚠ AND NOT THE ADMIN. 19f089b9-b31e-4ed9-a54d-63b05cfa8fcb holds a staff
--   role, and is_staff() would mask the very behaviour under test. The count
--   below fails loudly if the resolved student IS that uuid.

SELECT
  (SELECT count(*) FROM auth.users
    WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')          AS students_found,
  (SELECT id FROM auth.users
    WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')          AS student_id,
  (SELECT count(*) FROM auth.users
    WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk'
      AND id = '19f089b9-b31e-4ed9-a54d-63b05cfa8fcb'::uuid)           AS student_is_admin_STOP_IF_1,
  (SELECT count(DISTINCT teacher_id) FROM public.teacher_availability) AS teachers_available,
  (SELECT teacher_id FROM public.teacher_availability
    GROUP BY teacher_id ORDER BY teacher_id LIMIT 1)                   AS teacher_id_to_be_used,
  (SELECT COALESCE(SUM(delta), 0) FROM public.lesson_credit_transactions
    WHERE user_id = (SELECT id FROM auth.users
                      WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')
      AND (expires_at IS NULL OR expires_at > now()))                  AS student_live_balance;

-- students_found            MUST be 1. 0 → the account does not exist; STOP.
-- student_is_admin_STOP_IF_1 MUST be 0. A 1 means is_staff() would mask the test.
-- teachers_available        MUST be >= 1. 0 → no teacher rows; STOP.
-- student_live_balance      Note it. Sections 1 and 3 set their own balance
--                           inside their transaction and roll it back, so this
--                           number must be UNCHANGED when you finish.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — ATOMICITY. Expect a 23P01 red at the marked line. That is the PASS.
-- ════════════════════════════════════════════════════════════════════════════
-- One credit, one successful booking, then an OVERLAPPING booking against the
-- same teacher. The exclusion constraint must raise 23P01, and the failed call
-- must leave NOTHING behind — no second booking, no second debit.

BEGIN;

  -- setup, as postgres: grant exactly one credit inside this transaction
  INSERT INTO public.lesson_credit_transactions (user_id, delta, reason, idempotency_key)
  SELECT id, 1, 'purchase', 'verify0069-s1-' || id::text
    FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk';

  -- ⚠ THE JWT SHIM. Without these two lines auth.uid() is NULL, the function
  --   raises 28000, and the section proves nothing. SET LOCAL scopes both to
  --   this transaction, so the ROLLBACK undoes them.
  -- ⚠ THE TEACHER IS RESOLVED AS postgres, BEFORE THE ROLE SWITCH. Reading
  --   teacher_availability while acting as `authenticated` would test that
  --   role's SELECT grant, not the booking behaviour — and a 42501 there looks
  --   like a failure of the thing under test when it is not.
  SELECT set_config('app.verify_teacher',
    (SELECT teacher_id::text FROM public.teacher_availability
      GROUP BY teacher_id ORDER BY teacher_id LIMIT 1), true);

  SET LOCAL ROLE authenticated;
  SELECT set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk'),
      'role', 'authenticated'
    )::text,
    true
  );

  -- POSITIVE CONTROL — this one MUST succeed. If it errors, the shim failed and
  -- the negative below would be meaningless.
  SELECT * FROM public.book_slot_with_credit(
    current_setting('app.verify_teacher')::uuid,
    'chemistry',
    now() + interval '30 days',
    now() + interval '30 days 1 hour'
  );

  -- ⚠ THE NEGATIVE — EXPECT 23P01 HERE. An overlapping slot, same teacher.
  --   A SUCCESS here is the FAILURE: it would mean two bookings in one hour.
  SELECT * FROM public.book_slot_with_credit(
    current_setting('app.verify_teacher')::uuid,
    'chemistry',
    now() + interval '30 days 30 minutes',
    now() + interval '30 days 90 minutes'
  );

ROLLBACK;

-- If 23P01 fired, the SQL Editor aborted the transaction at that statement.
-- Run SECTION 1-VERIFY below as a fresh block to see the counts.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1-VERIFY — the counts, in ONE select. Expect 1 / 1 / 0.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ ONE SELECT, MANY COLUMNS. Consecutive statements return only the last
--   result in the editor, so three separate counts would show you one number
--   and hide the two that mattered.

BEGIN;

  INSERT INTO public.lesson_credit_transactions (user_id, delta, reason, idempotency_key)
  SELECT id, 1, 'purchase', 'verify0069-s1v-' || id::text
    FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk';

  -- ⚠ THE TEACHER IS RESOLVED AS postgres, BEFORE THE ROLE SWITCH. Reading
  --   teacher_availability while acting as `authenticated` would test that
  --   role's SELECT grant, not the booking behaviour — and a 42501 there looks
  --   like a failure of the thing under test when it is not.
  SELECT set_config('app.verify_teacher',
    (SELECT teacher_id::text FROM public.teacher_availability
      GROUP BY teacher_id ORDER BY teacher_id LIMIT 1), true);

  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk'),
                      'role','authenticated')::text, true);

  SELECT * FROM public.book_slot_with_credit(
    current_setting('app.verify_teacher')::uuid,
    'chemistry', now() + interval '31 days', now() + interval '31 days 1 hour');

  -- the overlapping call, trapped so the transaction survives to be counted
  DO $$
  BEGIN
    PERFORM public.book_slot_with_credit(
      current_setting('app.verify_teacher')::uuid,
      'chemistry', now() + interval '31 days 30 minutes', now() + interval '31 days 90 minutes');
    RAISE EXCEPTION 'FAIL — the overlapping booking SUCCEEDED; atomicity is not holding';
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE NOTICE 'PASS — overlap refused with 23P01, as required';
  END $$;

  RESET ROLE;

  SELECT
    (SELECT count(*) FROM public.private_bookings
      WHERE user_id = (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')
        AND starts_at >= now() + interval '30 days')                     AS bookings_EXPECT_1,
    (SELECT count(*) FROM public.lesson_credit_transactions
      WHERE user_id = (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')
        AND delta = -1 AND reason = 'booking')                           AS debits_EXPECT_1,
    (SELECT count(*) FROM public.private_bookings
      WHERE user_id = (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')
        AND starts_at = now() + interval '31 days 30 minutes')           AS orphan_from_failed_call_EXPECT_0;

ROLLBACK;

-- bookings_EXPECT_1                1 → the first booking survived
-- debits_EXPECT_1                  1 → exactly one credit was spent, not two
-- orphan_from_failed_call_EXPECT_0 0 → the failed call left nothing behind
-- Any other combination is a FAILURE. Report the actual numbers.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1-SABOTAGE — break atomicity, prove the check goes red for the RIGHT
-- reason, and roll it back. The restore is the ROLLBACK on the last line.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ THE FUNCTION CHANGE IS INSIDE THE TRANSACTION. Postgres makes DDL
--   transactional, so this replacement never reaches the committed database
--   even if you close the tab. There is nothing to undo by hand.
--
-- This version drops the exclusion constraint for the life of the transaction.
-- SECTION 1-VERIFY's DO block should then raise its own
-- 'FAIL — the overlapping booking SUCCEEDED' — which is the RIGHT-reason red:
-- it proves the check is actually watching the overlap and not passing by luck.

BEGIN;

  ALTER TABLE public.private_bookings DROP CONSTRAINT private_bookings_no_overlap;

  INSERT INTO public.lesson_credit_transactions (user_id, delta, reason, idempotency_key)
  SELECT id, 2, 'purchase', 'verify0069-sab1-' || id::text
    FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk';

  -- ⚠ THE TEACHER IS RESOLVED AS postgres, BEFORE THE ROLE SWITCH. Reading
  --   teacher_availability while acting as `authenticated` would test that
  --   role's SELECT grant, not the booking behaviour — and a 42501 there looks
  --   like a failure of the thing under test when it is not.
  SELECT set_config('app.verify_teacher',
    (SELECT teacher_id::text FROM public.teacher_availability
      GROUP BY teacher_id ORDER BY teacher_id LIMIT 1), true);

  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk'),
                      'role','authenticated')::text, true);

  SELECT * FROM public.book_slot_with_credit(
    current_setting('app.verify_teacher')::uuid,
    'chemistry', now() + interval '32 days', now() + interval '32 days 1 hour');

  DO $$
  BEGIN
    PERFORM public.book_slot_with_credit(
      current_setting('app.verify_teacher')::uuid,
      'chemistry', now() + interval '32 days 30 minutes', now() + interval '32 days 90 minutes');
    RAISE NOTICE 'SABOTAGE CONFIRMED — with the constraint dropped the overlap SUCCEEDED, so the real check was watching it';
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'SABOTAGE FAILED TO BITE — 23P01 still fired with the constraint dropped; something else is refusing';
  END $$;

ROLLBACK;   -- ⚠ THE RESTORE. The constraint and both bookings vanish here.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — THE RACE. Read this before running anything.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ THE TWO-SESSION RACE CANNOT BE REPRODUCED IN ONE SQL EDITOR TAB, AND I AM
--   NOT GOING TO REPORT IT AS PASSED BY ABSENCE.
--   One tab is one session and one connection. Two statements in it run in
--   series by definition, so nothing in a single tab can produce the interleave
--   the race needs. A green here would mean "I did not try", which is exactly
--   how step 2 came to be marked SKIPPED in the first place.
--
-- ⚠ WHAT *CAN* BE PROVED IN ONE TAB — and it is the mechanism, not a symptom.
--   The protection is structural: the deployed function takes a transaction
--   scoped advisory lock keyed on the user, BEFORE it reads the balance. Two
--   concurrent transactions for the same user therefore serialise at that line;
--   the second cannot read the balance until the first has committed or rolled
--   back. 2A asserts that lock is present in the LIVE function body and that it
--   precedes the balance read — ordering is the whole property, and a lock
--   taken after the read would protect nothing.

-- ── SECTION 2A · the lock exists, and it comes first ────────────────────────
SELECT
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'book_slot_with_credit')      AS overloads_EXPECT_1,
  (pg_get_functiondef((
     SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='book_slot_with_credit' LIMIT 1
   )) LIKE '%pg_advisory_xact_lock%')                                        AS lock_present_EXPECT_true,
  (position('pg_advisory_xact_lock' in pg_get_functiondef((
     SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='book_slot_with_credit' LIMIT 1)))
   < position('COALESCE(SUM(delta)' in pg_get_functiondef((
     SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='book_slot_with_credit' LIMIT 1)))
                                                                             AS lock_before_balance_EXPECT_true;

-- overloads_EXPECT_1            1 → one function, so the body read is the one that runs
-- lock_present_EXPECT_true      t → the advisory lock is in the DEPLOYED body, not just the file
-- lock_before_balance_EXPECT_true t → it is taken BEFORE the balance is summed.
--                               An f here is a real failure: a lock after the
--                               read serialises nothing and both callers would
--                               see the same balance.

-- ── SECTION 2B · the empirical race, if you want it — TWO TABS, not one ─────
-- Optional. Two SQL Editor tabs ARE two sessions, so the race is reproducible
-- this way and only this way.
--   TAB A:  BEGIN;
--           SELECT set_config('app.verify_teacher',
--             (SELECT teacher_id::text FROM public.teacher_availability
--               GROUP BY teacher_id ORDER BY teacher_id LIMIT 1), true);
--           SET LOCAL ROLE authenticated;
--           SELECT set_config('request.jwt.claims',
--             json_build_object('sub',(SELECT id FROM auth.users
--               WHERE btrim(lower(email))='muhammed1993@hotmail.co.uk'),
--               'role','authenticated')::text, true);
--           SELECT * FROM public.book_slot_with_credit(
--             current_setting('app.verify_teacher')::uuid,
--             'chemistry', now() + interval '40 days', now() + interval '40 days 1 hour');
--           -- STOP. Do not commit. Leave this tab open.
--   TAB B:  the same block, with '41 days' instead of '40 days'.
--           EXPECT: tab B HANGS. That hang is the pass — it is blocked on the
--           advisory lock tab A holds.
--   THEN:   ROLLBACK in tab A. Tab B unblocks and, with one credit between
--           them, must raise P0002 rather than book a second lesson.
--   FINALLY: ROLLBACK in tab B too. Nothing persists from either.
-- ⚠ If tab B does NOT hang, the lock is not doing its job — report that.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — NO CREDIT. Expect a P0002 red at the marked line. That is the PASS.
-- ════════════════════════════════════════════════════════════════════════════
-- A signed-in student with a zero balance must be refused, and must leave no
-- booking behind. The balance is forced to zero inside the transaction by
-- cancelling out whatever the student really holds — and rolled back after.

BEGIN;

  -- ⚠ FORCE THE BALANCE TO EXACTLY ZERO, whatever it is in reality. Assuming a
  --   zero balance would make this test pass on an account that simply had no
  --   credits today and fail the day it did.
  INSERT INTO public.lesson_credit_transactions (user_id, delta, reason, idempotency_key)
  SELECT u.id,
         -1 * COALESCE((SELECT SUM(delta) FROM public.lesson_credit_transactions
                         WHERE user_id = u.id AND (expires_at IS NULL OR expires_at > now())), 0),
         'adjustment', 'verify0069-s3-zero-' || u.id::text
    FROM auth.users u WHERE btrim(lower(u.email)) = 'muhammed1993@hotmail.co.uk';

  -- ⚠ THE TEACHER IS RESOLVED AS postgres, BEFORE THE ROLE SWITCH. Reading
  --   teacher_availability while acting as `authenticated` would test that
  --   role's SELECT grant, not the booking behaviour — and a 42501 there looks
  --   like a failure of the thing under test when it is not.
  SELECT set_config('app.verify_teacher',
    (SELECT teacher_id::text FROM public.teacher_availability
      GROUP BY teacher_id ORDER BY teacher_id LIMIT 1), true);

  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk'),
                      'role','authenticated')::text, true);

  -- POSITIVE CONTROL — the balance really is zero before we test the refusal.
  RESET ROLE;
  SELECT COALESCE(SUM(delta), 0) AS balance_EXPECT_0
    FROM public.lesson_credit_transactions
   WHERE user_id = (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')
     AND (expires_at IS NULL OR expires_at > now());

  -- ⚠ THE TEACHER IS RESOLVED AS postgres, BEFORE THE ROLE SWITCH. Reading
  --   teacher_availability while acting as `authenticated` would test that
  --   role's SELECT grant, not the booking behaviour — and a 42501 there looks
  --   like a failure of the thing under test when it is not.
  SELECT set_config('app.verify_teacher',
    (SELECT teacher_id::text FROM public.teacher_availability
      GROUP BY teacher_id ORDER BY teacher_id LIMIT 1), true);

  SET LOCAL ROLE authenticated;

  -- the refusal, trapped so the counts below can still be read
  DO $$
  BEGIN
    PERFORM public.book_slot_with_credit(
      current_setting('app.verify_teacher')::uuid,
      'chemistry', now() + interval '33 days', now() + interval '33 days 1 hour');
    RAISE EXCEPTION 'FAIL — a booking was made on a ZERO balance';
  EXCEPTION
    WHEN no_data_found THEN
      RAISE NOTICE 'PASS — refused with P0002 no credits, as required';
  END $$;

  RESET ROLE;

  SELECT
    (SELECT count(*) FROM public.private_bookings
      WHERE user_id = (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')
        AND starts_at = now() + interval '33 days')            AS booking_EXPECT_0,
    (SELECT count(*) FROM public.lesson_credit_transactions
      WHERE user_id = (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')
        AND reason = 'booking'
        AND idempotency_key LIKE 'booking:%')                  AS debits_EXPECT_0,
    (SELECT COALESCE(SUM(delta), 0) FROM public.lesson_credit_transactions
      WHERE user_id = (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')
        AND (expires_at IS NULL OR expires_at > now()))        AS balance_still_EXPECT_0;

ROLLBACK;

-- booking_EXPECT_0        0 → nobody got a lesson they did not pay for
-- debits_EXPECT_0         0 → and nothing was charged for the refusal
-- balance_still_EXPECT_0  0 → the balance was not moved by the failed call


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3-SABOTAGE — remove the balance check, prove the red was real, roll back.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ AGAIN, THE FUNCTION REPLACEMENT IS INSIDE THE TRANSACTION and dies at the
--   ROLLBACK on the last line. It never reaches the committed database.
--
-- With the `IF v_bal < 1` guard removed, the DO block below should raise its own
-- 'FAIL — a booking was made on a ZERO balance'. That FAIL is the RIGHT-reason
-- red: it proves Section 3's P0002 came from the guard and not from something
-- incidental, like the slot being in the past or the shim not taking.

BEGIN;

  CREATE OR REPLACE FUNCTION public.book_slot_with_credit(
    p_teacher_id uuid, p_subject text, p_starts_at timestamptz, p_ends_at timestamptz)
  RETURNS TABLE (out_booking_id uuid, out_booking_ref text, out_credits_remaining integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $sab$
  DECLARE v_user uuid := auth.uid(); v_email text; v_id uuid; v_ref text; v_bal integer;
  BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '28000'; END IF;
    SELECT email INTO v_email FROM auth.users WHERE id = v_user;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
    SELECT COALESCE(SUM(delta), 0) INTO v_bal FROM public.lesson_credit_transactions
     WHERE user_id = v_user AND (expires_at IS NULL OR expires_at > now());
    -- ⚠ THE GUARD IS DELIBERATELY GONE HERE. This is the sabotage.
    INSERT INTO public.private_bookings
      (teacher_id, user_id, email, subject, starts_at, ends_at, paid_with, status)
    VALUES (p_teacher_id, v_user, v_email, p_subject, p_starts_at, p_ends_at, 'credit', 'confirmed')
    RETURNING id, booking_ref INTO v_id, v_ref;
    INSERT INTO public.lesson_credit_transactions (user_id, delta, reason, booking_id, idempotency_key)
    VALUES (v_user, -1, 'booking', v_id, 'booking:' || v_id::text);
    RETURN QUERY SELECT v_id, v_ref, (v_bal - 1);
  END $sab$;

  INSERT INTO public.lesson_credit_transactions (user_id, delta, reason, idempotency_key)
  SELECT u.id,
         -1 * COALESCE((SELECT SUM(delta) FROM public.lesson_credit_transactions
                         WHERE user_id = u.id AND (expires_at IS NULL OR expires_at > now())), 0),
         'adjustment', 'verify0069-sab3-zero-' || u.id::text
    FROM auth.users u WHERE btrim(lower(u.email)) = 'muhammed1993@hotmail.co.uk';

  -- ⚠ THE TEACHER IS RESOLVED AS postgres, BEFORE THE ROLE SWITCH. Reading
  --   teacher_availability while acting as `authenticated` would test that
  --   role's SELECT grant, not the booking behaviour — and a 42501 there looks
  --   like a failure of the thing under test when it is not.
  SELECT set_config('app.verify_teacher',
    (SELECT teacher_id::text FROM public.teacher_availability
      GROUP BY teacher_id ORDER BY teacher_id LIMIT 1), true);

  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk'),
                      'role','authenticated')::text, true);

  DO $$
  BEGIN
    PERFORM public.book_slot_with_credit(
      current_setting('app.verify_teacher')::uuid,
      'chemistry', now() + interval '34 days', now() + interval '34 days 1 hour');
    RAISE NOTICE 'SABOTAGE CONFIRMED — with the guard removed a zero balance DID book, so Section 3''s P0002 came from the guard';
  EXCEPTION
    WHEN no_data_found THEN
      RAISE EXCEPTION 'SABOTAGE FAILED TO BITE — P0002 still fired with the guard removed; Section 3 was passing for another reason';
  END $$;

ROLLBACK;   -- ⚠ THE RESTORE. The sabotaged function definition dies here.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — AFTER. Prove the database is exactly where it started.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ RUN THIS LAST, EVEN IF EVERYTHING LOOKED FINE. Every section above rolls
--   back, so this must show the original numbers. If it does not, something
--   committed that should not have — report it before anything else.

SELECT
  (SELECT COALESCE(SUM(delta), 0) FROM public.lesson_credit_transactions
    WHERE user_id = (SELECT id FROM auth.users WHERE btrim(lower(email)) = 'muhammed1993@hotmail.co.uk')
      AND (expires_at IS NULL OR expires_at > now()))                       AS balance_MUST_MATCH_SECTION_0,
  (SELECT count(*) FROM public.lesson_credit_transactions
    WHERE idempotency_key LIKE 'verify0069-%')                              AS test_rows_left_EXPECT_0,
  (SELECT count(*) FROM public.private_bookings
    WHERE starts_at >= now() + interval '29 days'
      AND starts_at <= now() + interval '42 days')                          AS test_bookings_left_EXPECT_0,
  (pg_get_functiondef((
     SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='book_slot_with_credit' LIMIT 1))
   LIKE '%IF v_bal < 1 THEN%')                                             AS guard_restored_EXPECT_true;

-- balance_MUST_MATCH_SECTION_0  must equal what Section 0 reported
-- test_rows_left_EXPECT_0       0 → no setup credit survived a rollback
-- test_bookings_left_EXPECT_0   0 → no test booking survived
-- guard_restored_EXPECT_true    t → the real function body is back. An f here
--                               is the one genuinely dangerous outcome: the
--                               sabotage committed. Re-apply 0069 immediately.
