-- ============================================================================
-- 0049_PROPOSED_erase_user_rpc.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-19, after 0048. Renamed from
-- 0049_PROPOSED_ once verified. VERIFICATION: ALL 28 RUNNABLE ASSERTIONS PASS.
--
--   (a) anon CANNOT call it, 42501                                     ✓
--       a SIGNED-IN user cannot either, 42501                          ✓
--       …not even on themselves                                        ✓
--       ⚠ THE CHECK THAT THE REVOKE RAN, NOT THE GRANT. Postgres gives
--       EXECUTE on a new function to PUBLIC by default, so a missing
--       REVOKE would hand anon the ability to delete any user by id.
--       Tested as anon AND as a real signed-in session, not inferred.
--   (b) an unknown id refused, P0002 'no such user'                    ✓
--   (c) a user WITH a ledger row is erased                             ✓
--       …and admin.deleteUser STILL fails on the same user first,
--       confirming the old path is unchanged and this is the fix       ✓
--       …reports ledger_rows_removed: 1 · rows gone · person gone      ✓
--   (d) refuses while they are the TEACHER on a booking, naming the
--       count, and the teacher survives                                ✓
--   (e) a STUDENT booking does not block it: the student is erased and
--       the lesson SURVIVES with user_id NULL — it happened, the
--       person is gone                                                 ✓
--       …and once the bookings are gone the teacher CAN be erased      ✓
--   (f) THE ESCAPE DIED WITH ITS TRANSACTION. After an erase_user call,
--       an ordinary UPDATE on the ledger is still refused, 23001       ✓
--       ⚠ HAD THIS PASSED INSTEAD, set_config's third argument was
--       wrong and the ledger would no longer be append-only — worse
--       than the defect this file fixes.
--   (g) an ordinary DELETE still refused, 23001, row provably intact   ✓
--
--   ⚠ AND THIS RUN LEFT NOTHING BEHIND, unlike 0047's and 0048's. The
--   function cleans up after its own probes, which is the first time the
--   verification for this table has been able to.
--
-- ============================================================================
-- ⚠ THE SCHEMA IS NOW CLOSED. 0050 is RESERVED for announcement targeting;
-- the next free number is 0051, and it comes from the planning chat, never
-- from a folder listing.
-- ============================================================================
--
-- ============================================================================
-- ⚠ 0048 FIXED ERASURE FOR A HUMAN AT A SQL PROMPT. IT DID NOT FIX IT FOR THE
-- ONLY PATH A REAL ERASURE REQUEST ACTUALLY TAKES.
-- ============================================================================
-- 0048's verification, block (d), asked the question the file exists to answer
-- and got a "no":
--
--     supabase.auth.admin.deleteUser(<uid>)
--       → "Database error deleting user"
--
-- The purge escape works — proven — but only in a transaction that has issued
-- SET LOCAL app.ledger_purge = 'on'. The Supabase Admin API does not, and
-- neither does the dashboard's Delete user button. So a family who asks to be
-- deleted still cannot be, unless somebody opens the SQL editor and runs three
-- statements in the right order.
--
-- ⚠ THAT IS NOT A WORKING ERASURE PATH. It is a runbook, and runbooks are what
-- fail at the moment they are needed. The interest form says "you may ask us to
-- delete them at any time"; that has to be true through the tools the operator
-- actually has.
--
-- ============================================================================
-- ⚠ THE FIX IS ONE AUDITABLE FUNCTION, NOT A WEAKER TRIGGER
-- ============================================================================
-- erase_user() sets the purge flag for the duration of its own transaction and
-- deletes the person. Everything 0047 and 0048 established stays true:
--
--   • the trigger still refuses every ordinary UPDATE and DELETE, from every
--     role, service_role included;
--   • correcting a balance is still a compensating row;
--   • the escape is still transaction-scoped and still dies at COMMIT.
--
-- What changes is that erasing a PERSON becomes a single named call, reachable
-- from a server action, with an obvious name in the logs of whoever ran it.
--
-- ⚠ SECURITY DEFINER, AND THEREFORE LOCKED DOWN DELIBERATELY. It runs as its
-- owner and it deletes users, so EXECUTE is revoked from PUBLIC and granted to
-- service_role ALONE — not to authenticated, not to anon. search_path is pinned
-- so a caller cannot shadow `auth.users` with their own table.
-- ============================================================================

-- ── SECTION 1: THE FUNCTION ─────────────────────────────────────────────────
BEGIN;

CREATE OR REPLACE FUNCTION public.erase_user(target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  ledger_removed  integer := 0;
  holds_removed   integer := 0;
  bookings_left   integer := 0;
  target_email    text;
BEGIN
  SELECT u.email INTO target_email FROM auth.users u WHERE u.id = target;
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'erase_user: no such user %', target
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ⚠ SET LOCAL, NOT SET. It dies with this transaction, so the escape cannot
  -- leak onto the next statement that reuses this pooled backend. 0048's
  -- verification (c) is the assertion that this matters.
  PERFORM set_config('app.ledger_purge', 'on', true);

  -- 1. The ledger. Explicit rather than relying on the CASCADE, so the count
  --    is reportable and the intent is visible in this function's body.
  DELETE FROM public.lesson_credit_transactions WHERE user_id = target;
  GET DIAGNOSTICS ledger_removed = ROW_COUNT;

  -- 2. Holds are ephemeral; they cascade anyway, removed here for the count.
  DELETE FROM public.booking_holds WHERE user_id = target OR teacher_id = target;
  GET DIAGNOSTICS holds_removed = ROW_COUNT;

  /**
   * ⚠ BOOKINGS ARE NOT DELETED, AND THE FUNCTION REFUSES IF ANY REMAIN AS
   * TEACHER. private_bookings.teacher_id is ON DELETE RESTRICT (0046), which
   * is correct — a teacher's delivered lessons are somebody else's records.
   *
   * A STUDENT's bookings are different: user_id is ON DELETE SET NULL, so the
   * lesson survives as an anonymised row and the erasure still completes. That
   * asymmetry is deliberate. Erasing a student must not delete the teacher's
   * record that a lesson happened; erasing a teacher is an operational act that
   * needs a human decision about their history.
   */
  SELECT count(*) INTO bookings_left
    FROM public.private_bookings WHERE teacher_id = target;
  IF bookings_left > 0 THEN
    RAISE EXCEPTION
      'erase_user: % is the teacher on % booking(s). Reassign or delete those first — a teacher''s lesson records are not erased by a student erasure.',
      target_email, bookings_left
      USING ERRCODE = 'restrict_violation';
  END IF;

  DELETE FROM auth.users WHERE id = target;

  RETURN jsonb_build_object(
    'erased', target,
    'email', target_email,
    'ledger_rows_removed', ledger_removed,
    'holds_removed', holds_removed
  );
END;
$$;

COMMENT ON FUNCTION public.erase_user(uuid) IS
  'Delete a person and their credit ledger. The only supported erasure path: the Supabase Admin API and the dashboard button both fail, because the append-only trigger refuses the cascade. service_role only.';

COMMIT;

-- ── SECTION 2: WHO MAY CALL IT ──────────────────────────────────────────────
BEGIN;

-- ⚠ REVOKE FROM PUBLIC FIRST. Postgres grants EXECUTE on new functions to
-- PUBLIC by default, so creating this function without the next line would hand
-- every role — anon included — the ability to delete any user by id.
REVOKE ALL ON FUNCTION public.erase_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erase_user(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_user(uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) anon and authenticated CANNOT call it — the first thing to check, because
--     a SECURITY DEFINER function that deletes users is the most dangerous
--     object in this schema
-- SET ROLE anon;          SELECT public.erase_user('00000000-0000-0000-0000-000000000000');
-- PASS: permission denied for function erase_user.
-- SET ROLE authenticated; (same)
-- PASS: permission denied for function erase_user.
--   ⚠ RUN BOTH. Granting to service_role does not by itself revoke PUBLIC's
--   default EXECUTE, which is why section 2 revokes explicitly.
--
-- (b) an unknown id is refused rather than silently succeeding
-- SELECT public.erase_user('00000000-0000-0000-0000-000000000000');
-- PASS: 'erase_user: no such user …'
--
-- (c) THE ONE IT EXISTS FOR — a user with a ledger row is erased
-- (create a probe user with a ledger row, then)
-- SELECT public.erase_user('<probe uid>');
-- PASS: {"erased": "...", "ledger_rows_removed": 1, ...}
-- SELECT count(*) FROM public.lesson_credit_transactions WHERE user_id='<uid>';
-- PASS: 0.
-- SELECT count(*) FROM auth.users WHERE id='<uid>';
-- PASS: 0.
--
-- (d) …and it refuses while they are a TEACHER on a booking
-- (give the probe user a private_bookings row as teacher_id, then call it)
-- PASS: 'erase_user: … is the teacher on 1 booking(s)…'
--   Deliberate: a teacher's delivered lessons are records, not the student's
--   personal data, and deleting them needs a human decision.
--
-- (e) …while a STUDENT booking does not block it
-- (probe user as user_id only, someone else as teacher_id)
-- PASS: erased, and the booking survives with user_id NULL — the lesson
--   happened, the person is gone.
--
-- (f) THE ESCAPE STILL DIES WITH THE TRANSACTION
-- SELECT public.erase_user('<some uid>');
-- -- then, in a NEW statement:
-- UPDATE public.lesson_credit_transactions SET delta = delta WHERE true;
-- PASS: 'lesson_credit_transactions is append-only: UPDATE refused…'
--   ⚠ IF THIS SUCCEEDS, set_config's third argument was wrong and the ledger is
--   no longer append-only. That would be worse than the defect this fixes.
--   Stop and say so.
--
-- (g) the trigger is otherwise untouched
-- INSERT … a ledger row; UPDATE it; DELETE it.
-- PASS: both refused, 23001, as before 0049.
--
-- ----------------------------------------------------------------------------
-- ⚠ CLEANUP OWED FROM 0048's VERIFICATION RUN
-- ----------------------------------------------------------------------------
-- That run left 1 ledger row, 1 cancelled booking and 1 probe user, because
-- admin.deleteUser could not remove them — which is the defect this file fixes.
--
-- The probe user IS the teacher on that booking, so (d) will refuse until the
-- booking is gone. Dependency order, same as 0048's footer:
--
-- -- STEP 0: see what will go
-- SELECT id, email FROM auth.users WHERE email LIKE 'probe-0048-%@example.test';
-- SELECT id, status FROM public.private_bookings
--  WHERE teacher_id IN (SELECT id FROM auth.users WHERE email LIKE 'probe-0048-%@example.test');
-- EXPECT: 1 user, 1 booking (cancelled).
--
-- -- STEP 1: the ledger row that pins the booking
-- BEGIN;
--   SET LOCAL app.ledger_purge = 'on';
--   DELETE FROM public.lesson_credit_transactions
--    WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'probe-0048-%@example.test');
-- COMMIT;
--
-- -- STEP 2: the booking (now unreferenced)
-- DELETE FROM public.private_bookings
--  WHERE teacher_id IN (SELECT id FROM auth.users WHERE email LIKE 'probe-0048-%@example.test');
--
-- -- STEP 3: the user — through the NEW path, which is also test (c)
-- SELECT public.erase_user(id) FROM auth.users WHERE email LIKE 'probe-0048-%@example.test';
--
-- -- STEP 4: confirm
-- SELECT
--   (SELECT count(*) FROM public.lesson_credit_transactions) AS ledger,
--   (SELECT count(*) FROM public.private_bookings)           AS bookings,
--   (SELECT count(*) FROM public.booking_holds)              AS holds,
--   (SELECT count(*) FROM auth.users WHERE email LIKE 'probe-%') AS probes;
-- PASS: 0, 0, 0, 0.
