-- ============================================================================
-- 0031_expected_answers.sql
-- STATUS: NOT APPLIED
-- ----------------------------------------------------------------------------
-- One new table, public.question_expected_answers: the final answer a
-- deterministic marker compares against, one row per markable question.
--
-- ⚠ THIS FILE REPLACES AN EARLIER DRAFT THAT WAS WRONG IN TWO WAYS. Both are
-- recorded here rather than quietly corrected, because both are mistakes worth
-- not repeating.
--
-- ============================================================================
-- DEFECT 1 (SECURITY) — THE ANSWERS WERE PUT WHERE STUDENTS CAN READ THEM
-- ============================================================================
-- The first draft added expected_value, expected_unit, answer_tolerance and
-- accepted_values as columns on public.paper_questions.
--
-- paper_questions carries paper_questions_read from 0028:
--
--   FOR SELECT TO authenticated USING (
--     has_role('teacher') OR has_role('marker') OR has_role('admin')
--     OR EXISTS (SELECT 1 FROM past_papers p
--                 WHERE p.id = paper_id AND p.status = 'live'))
--
-- — any signed-in student may read every column of every question on a live
-- paper. So `expected_value` would have been THE ANSWER TO THE QUESTION,
-- readable straight from the browser with the publishable key, mid-exam:
--
--   supabase.from('paper_questions').select('question_number, expected_value')
--
-- No exploit required, no privilege escalation, nothing to bypass — the answer
-- key would simply have been part of the question row. It is mark-scheme
-- content, and 0028 already decided where mark-scheme content lives: a table
-- with no policy a student can satisfy.
--
-- The general lesson, which cost nothing to state and would have cost a great
-- deal to learn later: WHERE a column lives is a security decision, not an
-- ergonomic one. "It is about the question, so it goes on the question" is
-- exactly the reasoning that put it there.
--
-- So it is a separate table with mark_scheme_items' RLS, verbatim: SELECT for
-- staff roles only, no auth.uid() branch anywhere, nothing granted to anon.
-- The verification block at the bottom proves it from a student session.
--
-- ============================================================================
-- DEFECT 2 (ARITHMETIC) — A BOOLEAN CANNOT EXPRESS THE MARK SCHEME
-- ============================================================================
-- The first draft had full_marks_on_correct_answer boolean. What the schemes
-- actually say, transcribed:
--
--   20(a)       "Correct answer with no working scores (4)"     4 of 4
--   22(c)       "Correct answer with some working scores 3"     3 of 3
--   20(b)(iii)  ...no such statement at all...                  see below
--
-- A boolean happens to be right for the first two only because their stated
-- figure equals their tariff. The moment a scheme says "scores 4" on a 6-mark
-- question, a boolean awards 6 — it OVER-MARKS, silently, in the tier whose
-- whole claim is exactness. And the boolean has no way to say "the scheme is
-- silent", so 20(b)(iii) was set true and a correct answer took all 6 marks
-- the examiner never said it could.
--
-- marks_on_correct_answer integer says what the scheme says:
--
--   an integer  award exactly this many when the final answer matches
--   NULL        the scheme is silent — fall through to per-point marking
--
-- NULL is the default and the honest state. Under it a correct 20(b)(iii)
-- earns the final point only, and the five method marks are reported as
-- UNMARKED rather than failed — the student may well have earned them on
-- paper, and this marker cannot see the paper. Under-reporting is visible and
-- correctable; over-marking is neither.
--
-- The application enforces marks_on_correct_answer <= max_marks alongside its
-- existing awarded <= max_marks clamp, because max_marks is snapshotted per
-- attempt on question_attempts and a CHECK here cannot reach it. The CHECK
-- below still catches the absurd cases the database CAN see.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.paper_questions') IS NULL THEN
    RAISE EXCEPTION 'ABORTING: public.paper_questions does not exist. Apply 0028 first.';
  END IF;
  IF to_regclass('public.has_role') IS NULL AND
     NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'has_role') THEN
    RAISE EXCEPTION 'ABORTING: public.has_role() is missing. Apply 0027 first.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- The table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_expected_answers (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id              uuid NOT NULL REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  expected_value           text NOT NULL,
  expected_unit            text,
  answer_tolerance         numeric,
  accepted_values          text[],
  marks_on_correct_answer  integer,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qea_tolerance_nonneg
    CHECK (answer_tolerance IS NULL OR answer_tolerance >= 0),
  CONSTRAINT qea_marks_nonneg
    CHECK (marks_on_correct_answer IS NULL OR marks_on_correct_answer >= 0),
  -- One expected answer per question: the editors collect exactly one final
  -- value, so a second row could only ever contradict the first.
  UNIQUE (question_id)
);

CREATE INDEX IF NOT EXISTS idx_qea_question ON public.question_expected_answers(question_id);

COMMENT ON TABLE public.question_expected_answers IS
  'The final answer Tier 1 marking compares against. MARK-SCHEME CONTENT — staff-readable only, exactly like mark_scheme_items. Never move these columns onto paper_questions: that table is student-readable for live papers, and this is the answer key.';
COMMENT ON COLUMN public.question_expected_answers.expected_value IS
  'A STRING, always — "0.0172" and "1.72e-2" are the same number and different answers, and significant figures are part of what is marked.';
COMMENT ON COLUMN public.question_expected_answers.expected_unit IS
  'NULL where the scheme requires no unit. A percentage yield is dimensionless; an empty string here would fail a student who correctly left the unit blank.';
COMMENT ON COLUMN public.question_expected_answers.answer_tolerance IS
  'RELATIVE: 0.005 accepts within ±0.5%. NULL means exact match after normalisation, never "anything goes".';
COMMENT ON COLUMN public.question_expected_answers.accepted_values IS
  'Alternates the scheme explicitly allows — 20(b)(iii) permits 306 as well as 307.';
COMMENT ON COLUMN public.question_expected_answers.marks_on_correct_answer IS
  'Marks awarded when the final answer matches, as the SCHEME STATES IT ("Correct answer with no working scores (4)" -> 4). NULL means the scheme is silent: fall through to per-point marking and report the method marks as unmarked. Never a boolean — see migration 0031.';

-- ----------------------------------------------------------------------------
-- RLS — mark_scheme_items' policy, verbatim
-- ----------------------------------------------------------------------------
-- NOT ONE BRANCH MENTIONS auth.uid(). There is no expression a student can
-- satisfy, which is the same guarantee 0028 gives mark_scheme_items,
-- model_answers and examiner_report_insights.
ALTER TABLE public.question_expected_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_expected_answers_read ON public.question_expected_answers;
CREATE POLICY question_expected_answers_read
  ON public.question_expected_answers FOR SELECT TO authenticated
  USING (public.has_role('teacher') OR public.has_role('marker') OR public.has_role('admin'));

DROP POLICY IF EXISTS question_expected_answers_write ON public.question_expected_answers;
CREATE POLICY question_expected_answers_write
  ON public.question_expected_answers FOR ALL TO authenticated
  USING      (public.has_role('marker') OR public.has_role('admin'))
  WITH CHECK (public.has_role('marker') OR public.has_role('admin'));

-- ----------------------------------------------------------------------------
-- Grants — anon gets nothing, and the three dangerous privileges go
-- ----------------------------------------------------------------------------
-- Per AGENTS.md: Supabase's default privileges hand anon and authenticated
-- TRUNCATE, TRIGGER and REFERENCES on every newly created table, and 0019's
-- sweep only fixed the tables that existed when it ran.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_expected_answers TO authenticated;
REVOKE ALL ON public.question_expected_answers FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.question_expected_answers FROM anon, authenticated;

COMMIT;


-- ============================================================================
-- VERIFICATION — run after applying
-- ============================================================================
-- (a) The three dangerous privileges. MUST return zero rows. This is the
--     standing AGENTS.md check and this migration creates a table, so it is
--     mandatory rather than optional.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
--      AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES')
--    ORDER BY table_name, grantee, privilege_type;
--
-- (b) anon holds NOTHING on the new table. MUST return zero rows.
--
--   SELECT privilege_type FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name = 'question_expected_answers'
--      AND grantee = 'anon';
--
-- (c) No policy on the new table mentions auth.uid(). MUST return zero rows —
--     a student-satisfiable branch here is the whole defect this file fixes.
--
--   SELECT policyname, qual FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'question_expected_answers'
--      AND (qual LIKE '%auth.uid%' OR with_check LIKE '%auth.uid%');
--
-- (d) RLS is on. Expect rowsecurity = true.
--
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE relnamespace = 'public'::regnamespace
--      AND relname = 'question_expected_answers';
--
-- (e) THE ONE THAT MATTERS — prove it from a student session, not from the
--     catalogue. Sign in as an ordinary student (no user_roles row) with the
--     publishable key and run:
--
--       select * from question_expected_answers
--
--     MUST return 0 rows. A catalogue that looks right and a session that
--     returns rows is the failure this check exists to catch.
--
-- (f) paper_questions did NOT gain answer columns. MUST return zero rows.
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'paper_questions'
--      AND column_name IN ('expected_value','expected_unit','answer_tolerance',
--                          'accepted_values','full_marks_on_correct_answer');
--
-- (g) 0028's twenty policies are untouched; this file adds two more.
--
--   SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
--    AND tablename IN ('paper_questions','question_regions','mark_scheme_items',
--                      'examiner_report_insights','model_answers','exam_attempts',
--                      'question_attempts','student_responses','marking_results');
--   -- expect 20
-- ============================================================================


-- ============================================================================
-- ROLLBACK
-- ============================================================================
--   BEGIN;
--   DROP TABLE IF EXISTS public.question_expected_answers;
--   COMMIT;
--
-- Deterministic marking of numeric answers stops working the moment this is
-- gone — the marker reports "not markable" rather than falling back to parsing
-- guidance prose, so the failure is visible rather than silent.
-- ============================================================================
