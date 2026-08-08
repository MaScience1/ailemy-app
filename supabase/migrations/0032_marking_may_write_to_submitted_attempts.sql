-- ============================================================================
-- 0032_marking_may_write_to_submitted_attempts.sql
-- ----------------------------------------------------------------------------
-- Repairs a defect in 0030. Creates no table and no column.
--
-- ============================================================================
-- THE BUG
-- ============================================================================
-- 0030 put this trigger on question_attempts:
--
--   CREATE TRIGGER question_attempts_frozen_after_submit
--     BEFORE UPDATE ON public.question_attempts
--     FOR EACH ROW EXECUTE FUNCTION public.reject_write_to_submitted_attempt();
--
-- and this comment immediately beneath it:
--
--   "a marking job must stay able to write awarded_marks to a submitted
--    attempt. Only edits to an already-submitted sitting are refused."
--
-- The comment describes the intent. The trigger does the opposite: it refuses
-- EVERY update to question_attempts once the parent attempt is submitted, and
-- a submitted attempt is the only kind marking ever runs on. So every
-- awarded_marks write failed, silently — the marking layer logged the error
-- and returned success — and the results screen rendered a full set of marks
-- from an in-memory summary while awarded_marks and confidence stayed NULL on
-- all ten rows. Found only by querying the table directly.
--
-- The application half of that failure (a persistence error swallowed and
-- reported as success) is fixed separately in src/lib/exam/marking.ts, which
-- now throws and renders the affected question as not marked. This file fixes
-- the database half.
--
-- ============================================================================
-- WHAT CHANGES, AND WHAT DELIBERATELY DOES NOT
-- ============================================================================
-- The immutability property from 0028/0030 STAYS. This is not "allow updates
-- after submit". Exactly three columns become writable on a submitted
-- question_attempts row — awarded_marks, confidence, updated_at — and every
-- other column, present or future, stays frozen.
--
-- ⚠ THE COLUMN LIST IS AN EXEMPTION LIST, NOT AN ALLOW LIST. The trigger
--   compares the whole row minus those three. A column added to
--   question_attempts tomorrow is therefore protected the day it is added,
--   with no edit here. Enumerating the frozen columns instead would fail open
--   on every future column, which is the wrong way round for a guard whose
--   entire job is refusing writes.
--
-- student_responses is untouched. Its trigger still calls the original
-- function, unchanged, and a submitted answer remains completely immutable —
-- there is no marking write to a student's answer, so there is nothing to
-- exempt.
--
-- ============================================================================
-- ⚠ THE TRIGGER ALONE WOULD OPEN A HOLE. THE GRANT IS THE OTHER HALF.
-- ============================================================================
-- 0028 granted authenticated a TABLE-WIDE update:
--
--   GRANT SELECT, INSERT, UPDATE ON public.question_attempts TO authenticated;
--
-- RLS filters rows, never columns (AGENTS.md), so that grant already let a
-- student write awarded_marks on their own rows BEFORE submitting — the
-- policy only ever checked whose row it was. Until now the freeze trigger
-- masked it after submission by refusing everything.
--
-- Relaxing the trigger without touching the grant would remove that mask and
-- let a student submit, then set awarded_marks = max_marks on every question.
-- So this file also replaces the table-wide UPDATE with a COLUMN-LEVEL grant.
-- After it, a student holds UPDATE on `flagged` and `updated_at` and on
-- nothing else: writing awarded_marks fails with 42501 before any policy or
-- trigger is consulted, submitted or not. That is strictly tighter than
-- before, at every point in an attempt's life.
--
-- updated_at is included only so setFlagged's existing payload keeps working;
-- 0028's touch_question_attempts trigger overwrites whatever is sent, so it
-- carries no meaning a student could exploit.
--
-- The service role is unaffected — its grants are its own, and REVOKE ... FROM
-- authenticated does not touch them. Marking runs as the service role.
--
-- ============================================================================
-- ⚠ APPLY AFTER 0030. Re-running 0030 alone would recreate the trigger against
--   the old function and reintroduce the bug; a rebuild that replays 0028 →
--   0032 in order is correct.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Pre-flight
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.question_attempts') IS NULL
  OR to_regclass('public.exam_attempts')     IS NULL THEN
    RAISE EXCEPTION 'ABORTING: 0028 tables missing. Apply 0028 first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'reject_write_to_submitted_attempt'
  ) THEN
    RAISE EXCEPTION 'ABORTING: 0030 not applied — reject_write_to_submitted_attempt() is missing.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. A submitted attempt may be MARKED, and may not be EDITED
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_edit_to_submitted_question_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER              -- as 0030; a definer here would bypass nothing useful
SET search_path = public, pg_temp
AS $$
DECLARE
  v_submitted timestamptz;
BEGIN
  SELECT ea.submitted_at INTO v_submitted
    FROM public.exam_attempts ea
   WHERE ea.id = coalesce(NEW.exam_attempt_id, OLD.exam_attempt_id);

  -- Not submitted: 0028's policies and grants are the whole story.
  IF v_submitted IS NULL THEN
    RETURN NEW;
  END IF;

  -- Submitted. Everything except the three marking columns is frozen.
  -- Comparing whole rows minus an exemption list means a column added later
  -- is protected without anyone remembering to come back here.
  IF (to_jsonb(NEW) - 'awarded_marks' - 'confidence' - 'updated_at')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'awarded_marks' - 'confidence' - 'updated_at') THEN
    RAISE EXCEPTION
      'this attempt was submitted at % and can no longer be changed', v_submitted
      USING ERRCODE = '25006';   -- read_only_sql_transaction, as 0030
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.reject_edit_to_submitted_question_attempt() IS
  'Replaces reject_write_to_submitted_attempt() on question_attempts (0032). A submitted attempt stays frozen EXCEPT for awarded_marks, confidence and updated_at, which marking must write. Exemption list, not allow list: new columns are frozen by default. Binds every role including the service role, which RLS does not.';

DROP TRIGGER IF EXISTS question_attempts_frozen_after_submit ON public.question_attempts;
CREATE TRIGGER question_attempts_frozen_after_submit
  BEFORE UPDATE ON public.question_attempts
  FOR EACH ROW EXECUTE FUNCTION public.reject_edit_to_submitted_question_attempt();
-- Still BEFORE UPDATE only, and still not on INSERT: create_exam_attempt
-- inserts these rows while submitted_at is NULL.
--
-- Fires before touch_question_attempts ('q' sorts before 't', and Postgres
-- fires BEFORE triggers in name order), so it compares the updated_at the
-- caller sent, not the one the touch trigger substitutes. That column is
-- exempt either way; the ordering is noted so nobody has to work it out again.

-- reject_write_to_submitted_attempt() is NOT dropped: student_responses still
-- uses it, and its behaviour there is unchanged and still correct. Its
-- question_attempts branch is now dead code, reachable only if someone
-- repoints this trigger back at it.
COMMENT ON FUNCTION public.reject_write_to_submitted_attempt() IS
  'Blocks answer edits once exam_attempts.submitted_at is set. Used by student_responses ONLY since 0032 — question_attempts now uses reject_edit_to_submitted_question_attempt(), which exempts the marking columns. The question_attempts branch inside this function is dead.';

-- ----------------------------------------------------------------------------
-- 2. Students lose UPDATE on the marking columns — at every stage, not just
--    after submission. See the header: this is what stops the relaxed trigger
--    above becoming a way to self-award marks.
-- ----------------------------------------------------------------------------
REVOKE UPDATE ON public.question_attempts FROM authenticated;
GRANT  UPDATE (flagged, updated_at) ON public.question_attempts TO authenticated;

-- SELECT and INSERT are untouched — 0030's create_exam_attempt runs as the
-- caller and inserts these rows, and the player reads them on every load.

COMMIT;


-- ============================================================================
-- VERIFICATION — run after applying. BOTH halves, in one script.
-- ----------------------------------------------------------------------------
-- Builds a submitted attempt, proves a marking write lands and a student edit
-- is refused, and deletes what it made. Nothing persists on either outcome: a
-- DO block is atomic, so the failure path rolls its own INSERTs back too.
--
-- A pass is the final SELECT returning a row. A failure is a raised exception
-- naming which half broke — never a quiet empty result.
-- ============================================================================
--
-- DO $verify$
-- DECLARE
--   v_user uuid; v_paper uuid; v_q uuid; v_attempt uuid; v_qa uuid;
--   v_awarded integer;
--   v_marking_ok    boolean := false;
--   v_flag_blocked  boolean := false;
-- BEGIN
--   SELECT id INTO v_user  FROM auth.users LIMIT 1;
--   SELECT id INTO v_paper FROM public.past_papers WHERE status = 'live' LIMIT 1;
--   SELECT id INTO v_q     FROM public.paper_questions WHERE paper_id = v_paper LIMIT 1;
--   IF v_user IS NULL OR v_q IS NULL THEN
--     RAISE EXCEPTION 'INCONCLUSIVE: need one auth user and one seeded live paper';
--   END IF;
--
--   INSERT INTO public.exam_attempts (student_id, paper_id, mode, submitted_at)
--        VALUES (v_user, v_paper, 'exam', now())
--     RETURNING id INTO v_attempt;
--   INSERT INTO public.question_attempts (exam_attempt_id, question_id, max_marks)
--        VALUES (v_attempt, v_q, 3)
--     RETURNING id INTO v_qa;
--
--   -- HALF 1 — marking a SUBMITTED attempt must SUCCEED, and must land.
--   BEGIN
--     UPDATE public.question_attempts
--        SET awarded_marks = 2, confidence = 'deterministic'
--      WHERE id = v_qa;
--     SELECT awarded_marks INTO v_awarded
--       FROM public.question_attempts WHERE id = v_qa;
--     v_marking_ok := (v_awarded = 2);   -- row read back, not just "no error"
--   EXCEPTION WHEN OTHERS THEN
--     RAISE WARNING 'HALF 1 raised %: %', SQLSTATE, SQLERRM;
--   END;
--
--   -- HALF 2 — a student-owned column on the SAME row must still be refused.
--   BEGIN
--     UPDATE public.question_attempts SET flagged = true WHERE id = v_qa;
--   EXCEPTION
--     WHEN sqlstate '25006' THEN v_flag_blocked := true;
--     WHEN OTHERS THEN RAISE WARNING 'HALF 2 raised the wrong error %: %', SQLSTATE, SQLERRM;
--   END;
--
--   DELETE FROM public.exam_attempts WHERE id = v_attempt;   -- cascades
--
--   IF NOT (v_marking_ok AND v_flag_blocked) THEN
--     RAISE EXCEPTION
--       'FAILED — marking write landed: %, flagged edit blocked: %',
--       v_marking_ok, v_flag_blocked;
--   END IF;
-- END $verify$;
--
-- SELECT 'BOTH HALVES PASS: awarded_marks written to a submitted attempt; flagged edit refused 25006' AS verification;
--
-- ----------------------------------------------------------------------------
-- (b) The grant is now column-level. Expect EXACTLY two rows:
--     flagged | UPDATE   and   updated_at | UPDATE
--
--   SELECT column_name, privilege_type
--     FROM information_schema.column_privileges
--    WHERE table_schema = 'public' AND table_name = 'question_attempts'
--      AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
--    ORDER BY column_name;
--
-- (c) No TABLE-level UPDATE survives for authenticated. MUST return zero rows.
--
--   SELECT privilege_type FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name = 'question_attempts'
--      AND grantee = 'authenticated' AND privilege_type = 'UPDATE';
--
-- (d) SELECT and INSERT survive. Expect both.
--
--   SELECT privilege_type FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name = 'question_attempts'
--      AND grantee = 'authenticated' ORDER BY privilege_type;
--
-- (e) The trigger points at the NEW function. Expect one row naming
--     reject_edit_to_submitted_question_attempt.
--
--   SELECT t.tgname, p.proname
--     FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
--    WHERE NOT t.tgisinternal
--      AND t.tgrelid = 'public.question_attempts'::regclass;
--
-- (f) student_responses is UNCHANGED — still the original function.
--     Expect reject_write_to_submitted_attempt.
--
--   SELECT t.tgname, p.proname
--     FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
--    WHERE NOT t.tgisinternal
--      AND t.tgrelid = 'public.student_responses'::regclass;
--
-- (g) The standing AGENTS.md check. MUST return zero rows.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
--      AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
--
-- (h) 0028's 20 policies are still 20.
--
--   SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
--    AND tablename IN ('paper_questions','question_regions','mark_scheme_items',
--                      'examiner_report_insights','model_answers','exam_attempts',
--                      'question_attempts','student_responses','marking_results');
-- ============================================================================


-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- ⚠ Reverting reinstates the bug: marking will silently fail again unless the
--   application is reverted with it.
-- ============================================================================
--   BEGIN;
--   DROP TRIGGER IF EXISTS question_attempts_frozen_after_submit ON public.question_attempts;
--   CREATE TRIGGER question_attempts_frozen_after_submit
--     BEFORE UPDATE ON public.question_attempts
--     FOR EACH ROW EXECUTE FUNCTION public.reject_write_to_submitted_attempt();
--   DROP FUNCTION IF EXISTS public.reject_edit_to_submitted_question_attempt();
--   REVOKE UPDATE (flagged, updated_at) ON public.question_attempts FROM authenticated;
--   GRANT UPDATE ON public.question_attempts TO authenticated;
--   COMMIT;
-- ============================================================================
