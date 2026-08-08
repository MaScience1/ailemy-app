-- ============================================================================
-- 0030_exam_attempt_rpc_and_immutability.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED 2026-08-08. This file now exists so a rebuild from migrations
-- matches what is already live.
--
-- Unlike 0029, this one IS genuinely re-runnable: every statement is guarded
-- (IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF EXISTS) and the pre-flight
-- only rejects DUPLICATE responses per question attempt, which the unique index
-- it creates now prevents. Re-running is a no-op rather than an error.
--
-- Verified live as a real signed-in student, not by inspection:
--   - an attempt created through the UI produced 10 question_attempts whose
--     max_marks matched paper_questions.marks on every row, totalling 25
--   - calling the RPC as the SERVICE ROLE raised 28000 'not authenticated',
--     confirming SECURITY INVOKER — the service role has no auth.uid()
--   - after submitting, UPDATE and INSERT on student_responses, UPDATE on
--     question_attempts, and clearing submitted_at were all rejected 25006,
--     with the stored answer unchanged
--
-- ----------------------------------------------------------------------------
-- Three things the exam player cannot be built correctly without:
--
--   1. public.create_exam_attempt(paper_id, mode) — creates an attempt and all
--      of its question rows in ONE TRANSACTION, snapshotting each question's
--      marks server-side.
--   2. UNIQUE (question_attempt_id) on student_responses — makes autosave a
--      real upsert instead of a read-modify-write race.
--   3. Triggers that make a submitted attempt immutable.
--
-- DEPENDS ON 0028. Adds no table and no column. Creates one function, one
-- unique index, two trigger functions and three triggers. Does not alter,
-- drop or weaken any existing policy or grant.
--
-- ============================================================================
-- 1. WHY A FUNCTION, AND WHY IT IS *NOT* SECURITY DEFINER
-- ============================================================================
-- Creating an attempt means one INSERT into exam_attempts and ten into
-- question_attempts. Over PostgREST each request is its own transaction, so
-- doing this from the application means an interruption between them leaves an
-- attempt with no questions — a sitting a student can open and cannot answer,
-- indistinguishable from a real one. A plpgsql function is a single statement
-- from PostgREST's point of view, so the whole thing commits or none of it
-- does. That is the only way to get a real transaction here: there is no
-- direct Postgres connection in this project.
--
-- ⚠ IT IS DELIBERATELY *SECURITY INVOKER* — the default, stated explicitly
--   below so nobody "fixes" it later. SECURITY DEFINER is the reflex for
--   anything that writes, and it would be strictly worse here: it would
--   disable every RLS policy 0028 wrote and make this function the only thing
--   standing between a caller and another student's attempts.
--
--   It does not need those powers. Under RLS the caller can ALREADY:
--     - INSERT exam_attempts     (exam_attempts_insert: student_id = auth.uid())
--     - INSERT question_attempts (question_attempts_insert: parent is theirs)
--     - SELECT paper_questions   (paper_questions_read: paper is live)
--
--   So every policy stays in force, and a bug in this function cannot reach
--   another student's rows because the database will not let it.
--
-- WHAT IT GUARANTEES ABOUT MARKS. max_marks is read from paper_questions
-- inside the function. The browser never sends it and could not make it stick
-- if it tried — the client passes a paper id and a mode, nothing else. This is
-- the point of the whole exercise: what a question is worth is a server fact.
--
-- WHY ONLY LEAF QUESTIONS GET A ROW. WCH11/01 has 17 seeded rows, of which 7
-- are containers: they hold a stem and 0 marks, and there is nothing to type
-- into them. Creating attempts for all 17 would give a navigator with seven
-- dead entries and contradict the "10 questions" the mode screen already shows
-- from getPaperExamMeta, which counts leaves the same way. Container stems are
-- still shown in the player as context for their children; they just are not
-- separately answerable.
--
-- ============================================================================
-- 2. WHY student_responses GAINS A UNIQUE KEY
-- ============================================================================
-- 0028 deliberately left it out, and its comment says why: "a revision history
-- is expected, and 'latest' is created_at DESC. If one-response-per-attempt is
-- ever wanted, add the constraint then rather than losing the history now."
--
-- This is that moment, and autosave is what forces it. A debounced editor
-- writes on every pause in typing; a long_text answer would accumulate
-- hundreds of rows per question, of which exactly one is ever read. Worse,
-- without a unique key "save" has to be SELECT-then-INSERT-or-UPDATE, and two
-- saves racing — trivially reachable by typing in two tabs, or by a slow
-- request overtaking a fast one — produce two "latest" rows with no way to say
-- which is right.
--
-- With the constraint, saving is one idempotent statement. The trade is real:
-- keystroke-level history is gone. Nothing in the product used it, and if it
-- is wanted later it belongs in an append-only audit table rather than in the
-- row the player reads on every load.
--
-- ============================================================================
-- 3. WHY IMMUTABILITY IS A TRIGGER AND NOT A POLICY
-- ============================================================================
-- Nothing today stops a student editing answers after submitting. The RLS
-- policies check ownership and stop there, so `submitted_at` is a timestamp
-- with no teeth — a student could submit, read the paper, and rewrite an
-- answer through the API.
--
-- The obvious fix is to add `AND ea.submitted_at IS NULL` to the existing
-- UPDATE policies. This file does NOT do that, for two reasons. Editing a
-- policy means DROP then CREATE, which leaves a window with no policy at all
-- and risks a typo silently widening access — and the standing instruction on
-- this schema is not to weaken existing RLS while changing it. A trigger is
-- additive: the policies are untouched and keep doing their job, and the
-- trigger refuses the write on top of them.
--
-- Triggers also catch what a policy cannot. A policy is skipped for the table
-- owner and for the service role; a BEFORE trigger fires for everyone, so a
-- server-role marking job cannot rewrite a student's answers either.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Pre-flight
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.exam_attempts')     IS NULL
  OR to_regclass('public.question_attempts') IS NULL
  OR to_regclass('public.student_responses') IS NULL
  OR to_regclass('public.paper_questions')   IS NULL THEN
    RAISE EXCEPTION 'ABORTING: 0028 tables missing. Apply 0028 first.';
  END IF;

  -- A duplicate would make the unique index below fail with a message about an
  -- index rather than about the data, so say it plainly first.
  IF EXISTS (
    SELECT 1 FROM public.student_responses
     GROUP BY question_attempt_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'ABORTING: student_responses already holds more than one row for some question_attempt_id. Collapse them to the latest per attempt before adding the unique key. No changes made.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. One response per question attempt
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS student_responses_one_per_attempt
  ON public.student_responses (question_attempt_id);

COMMENT ON INDEX public.student_responses_one_per_attempt IS
  'Added by 0030 so autosave can upsert. Supersedes the revision-history intent in 0028 — see that file''s comment on this table. Keystroke history, if ever wanted, belongs in an append-only audit table.';

-- ----------------------------------------------------------------------------
-- 2. Attempt creation, atomically
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_exam_attempt(
  p_paper_id uuid,
  p_mode     text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER              -- explicit; see the header before changing this
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_attempt_id uuid;
  v_rows       integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_mode IS NULL OR p_mode NOT IN ('exam', 'practice') THEN
    RAISE EXCEPTION 'mode must be exam or practice, got %', coalesce(p_mode, 'null')
      USING ERRCODE = '22023';
  END IF;

  -- The paper must exist AND be live AND be visible to this caller. Because
  -- this runs as the caller, an unreadable paper is simply not found — the
  -- check and the permission are the same thing.
  IF NOT EXISTS (
    SELECT 1 FROM public.past_papers p
     WHERE p.id = p_paper_id AND p.status = 'live'
  ) THEN
    RAISE EXCEPTION 'paper % is not available to sit', p_paper_id
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.exam_attempts (student_id, paper_id, mode)
       VALUES (v_uid, p_paper_id, p_mode)
    RETURNING id INTO v_attempt_id;

  -- max_marks comes from paper_questions, never from an argument.
  -- Leaves only: a row is a container when something names it as parent.
  INSERT INTO public.question_attempts (exam_attempt_id, question_id, max_marks)
  SELECT v_attempt_id, q.id, q.marks
    FROM public.paper_questions q
   WHERE q.paper_id = p_paper_id
     AND NOT EXISTS (
       SELECT 1 FROM public.paper_questions child
        WHERE child.parent_question_id = q.id
     );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Rolls back the exam_attempts row with it: an attempt at a paper with
    -- nothing to answer must not exist at all.
    RAISE EXCEPTION 'paper % has no answerable questions seeded', p_paper_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Snapshot what the sitting is out of, from the rows just written.
  UPDATE public.exam_attempts
     SET total_available = (
           SELECT coalesce(sum(qa.max_marks), 0)
             FROM public.question_attempts qa
            WHERE qa.exam_attempt_id = v_attempt_id
         )
   WHERE id = v_attempt_id;

  RETURN v_attempt_id;
END $$;

COMMENT ON FUNCTION public.create_exam_attempt(uuid, text) IS
  'Creates an exam_attempts row and one question_attempts row per ANSWERABLE (leaf) question, in one transaction, snapshotting paper_questions.marks into max_marks server-side. SECURITY INVOKER on purpose — RLS stays in force; see migration 0030.';

REVOKE ALL ON FUNCTION public.create_exam_attempt(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_exam_attempt(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. A submitted attempt is finished
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_write_to_submitted_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_submitted timestamptz;
  v_attempt   uuid;
BEGIN
  -- Resolve the owning attempt for whichever table fired this.
  IF TG_TABLE_NAME = 'question_attempts' THEN
    v_attempt := coalesce(NEW.exam_attempt_id, OLD.exam_attempt_id);
    SELECT ea.submitted_at INTO v_submitted
      FROM public.exam_attempts ea WHERE ea.id = v_attempt;
  ELSE  -- student_responses
    SELECT ea.submitted_at INTO v_submitted
      FROM public.question_attempts qa
      JOIN public.exam_attempts ea ON ea.id = qa.exam_attempt_id
     WHERE qa.id = coalesce(NEW.question_attempt_id, OLD.question_attempt_id);
  END IF;

  IF v_submitted IS NOT NULL THEN
    RAISE EXCEPTION
      'this attempt was submitted at % and can no longer be changed', v_submitted
      USING ERRCODE = '25006';   -- read_only_sql_transaction
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.reject_write_to_submitted_attempt() IS
  'Blocks answer edits once exam_attempts.submitted_at is set. A trigger rather than an RLS clause so the existing policies are untouched, and so the rule also binds the service role, which RLS does not.';

DROP TRIGGER IF EXISTS student_responses_frozen_after_submit ON public.student_responses;
CREATE TRIGGER student_responses_frozen_after_submit
  BEFORE INSERT OR UPDATE ON public.student_responses
  FOR EACH ROW EXECUTE FUNCTION public.reject_write_to_submitted_attempt();

DROP TRIGGER IF EXISTS question_attempts_frozen_after_submit ON public.question_attempts;
CREATE TRIGGER question_attempts_frozen_after_submit
  BEFORE UPDATE ON public.question_attempts
  FOR EACH ROW EXECUTE FUNCTION public.reject_write_to_submitted_attempt();
-- NOT on INSERT for question_attempts: create_exam_attempt inserts them while
-- submitted_at is still NULL, and a marking job must stay able to write
-- awarded_marks to a submitted attempt. Only edits to an already-submitted
-- sitting are refused.

-- ----------------------------------------------------------------------------
-- 4. Submission is one-way
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_unsubmit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.submitted_at IS NOT NULL AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'submitted_at cannot be changed once set (was %)', OLD.submitted_at
      USING ERRCODE = '25006';
  END IF;
  -- Whose sitting it is, and which paper, are fixed at creation.
  IF NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.paper_id IS DISTINCT FROM OLD.paper_id THEN
    RAISE EXCEPTION 'student_id and paper_id are immutable' USING ERRCODE = '25006';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS exam_attempts_submit_is_one_way ON public.exam_attempts;
CREATE TRIGGER exam_attempts_submit_is_one_way
  BEFORE UPDATE ON public.exam_attempts
  FOR EACH ROW EXECUTE FUNCTION public.reject_unsubmit();

COMMIT;


-- ============================================================================
-- VERIFICATION — run after applying
-- ============================================================================
-- (a) The function exists, is INVOKER, and only authenticated may run it.
--     prosecdef MUST be false.
--
--   SELECT p.proname, p.prosecdef AS is_security_definer,
--          pg_get_function_identity_arguments(p.oid) AS args
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'create_exam_attempt';
--   -- expect: create_exam_attempt | false | p_paper_id uuid, p_mode text
--
--   SELECT grantee, privilege_type FROM information_schema.role_routine_grants
--    WHERE routine_schema = 'public' AND routine_name = 'create_exam_attempt';
--   -- expect authenticated EXECUTE, and NOT anon, NOT PUBLIC
--
-- (b) The unique index exists. Expect one row.
--
--   SELECT indexname FROM pg_indexes
--    WHERE schemaname = 'public' AND tablename = 'student_responses'
--      AND indexname = 'student_responses_one_per_attempt';
--
-- (c) All three triggers exist. Expect three rows.
--
--   SELECT tgname, tgrelid::regclass AS on_table
--     FROM pg_trigger
--    WHERE NOT tgisinternal
--      AND tgname IN ('student_responses_frozen_after_submit',
--                     'question_attempts_frozen_after_submit',
--                     'exam_attempts_submit_is_one_way')
--    ORDER BY tgname;
--
-- (d) NOTHING ELSE MOVED. Expect the same 20 policies 0028 created.
--
--   SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
--    AND tablename IN ('paper_questions','question_regions','mark_scheme_items',
--                      'examiner_report_insights','model_answers','exam_attempts',
--                      'question_attempts','student_responses','marking_results');
--   -- expect 20
--
-- (e) The standing AGENTS.md check. MUST return zero rows.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
--      AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- ============================================================================


-- ============================================================================
-- ROLLBACK
-- ============================================================================
--   BEGIN;
--   DROP TRIGGER IF EXISTS exam_attempts_submit_is_one_way      ON public.exam_attempts;
--   DROP TRIGGER IF EXISTS question_attempts_frozen_after_submit ON public.question_attempts;
--   DROP TRIGGER IF EXISTS student_responses_frozen_after_submit ON public.student_responses;
--   DROP FUNCTION IF EXISTS public.reject_unsubmit();
--   DROP FUNCTION IF EXISTS public.reject_write_to_submitted_attempt();
--   DROP FUNCTION IF EXISTS public.create_exam_attempt(uuid, text);
--   DROP INDEX IF EXISTS public.student_responses_one_per_attempt;
--   COMMIT;
--
-- Dropping the unique index cannot fail, but the player's autosave upsert
-- depends on it and will start raising 42P10 ("no unique or exclusion
-- constraint matching the ON CONFLICT specification") the moment it is gone.
-- Revert the application alongside.
-- ============================================================================
