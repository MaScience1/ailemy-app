-- ============================================================================
-- 0031_expected_answers.sql
-- STATUS: NOT APPLIED
-- ----------------------------------------------------------------------------
-- Five nullable columns on paper_questions, holding the FINAL ANSWER a
-- deterministic marker compares against:
--
--   expected_value                text     "0.0172" / "B" / "3.591"
--   expected_unit                 text     "mol", NULL where none is required
--   answer_tolerance              numeric  relative, e.g. 0.005 = ±0.5%
--   accepted_values               text[]   alternates the scheme allows
--   full_marks_on_correct_answer  boolean  see below
--
-- Additive only. No table, no constraint on existing columns, no policy, no
-- grant, no trigger. paper_questions keeps exactly the RLS it has today.
--
-- ============================================================================
-- WHY — TIER 1 CANNOT BE DETERMINISTIC WITHOUT THIS
-- ============================================================================
-- Deterministic marking needs to know what the right answer IS. Look at where
-- that currently lives for 20(a):
--
--   criterion : "evaluation"
--   guidance  : "n = 0.0172 mol
--                TE on M1 and M2 but no TE from M3 to M4
--                Correct answer with no working scores (4)"
--
-- The number is inside a prose paragraph, in a column whose whole purpose is
-- that it is examiner prose. Extracting "0.0172" from it means a regex over
-- free text — and a regex that is 95% right is not deterministic marking, it
-- is a mark scheme with a silent failure rate. On 22(c) the same paragraph
-- contains 10, 58, 0.17241, 161.5, 27.844 and 3.591; picking the right one by
-- pattern is guesswork, and getting it wrong marks a correct student wrong.
--
-- So the value is transcribed once, by a human, into a column meant to hold
-- it. `guidance` stays exactly as it is — this does not replace it, it stops
-- the marker having to parse it.
--
-- MCQ IS THE EXCEPTION AND STAYS PARSED. Its criterion is a fixed sentence —
-- "The only correct answer is B (…)" — and the marker reads the letter out of
-- it. That is a stable contract rather than prose mining, and the extractor
-- refuses (marking nothing) rather than guessing if the sentence ever changes.
-- Populating expected_value for MCQ rows anyway is still recommended, and the
-- marker prefers it when present.
--
-- ============================================================================
-- full_marks_on_correct_answer — THE COLUMN THAT PREVENTS UNDER-MARKING
-- ============================================================================
-- This is the one that matters most, and it is not a convenience flag.
--
-- 20(b)(iii) is worth SIX marks across six method points, M1–M6. The player's
-- numeric editor collects ONE value. A student who works the whole thing out
-- correctly on paper and types "307" has demonstrably earned all six — but a
-- marker comparing one value against one point can only ever justify one mark.
-- Reporting 1/6 to that student is not caution, it is a wrong mark, and it is
-- the exact failure a "deterministic, high confidence" tier must not produce.
--
-- Edexcel says so explicitly, in the guidance already transcribed:
--   20(a)      "Correct answer with no working scores (4)"
--   22(c)      "Correct answer with some working scores 3"
--   20(b)(iii) "Allow TE throughout" + a final-answer point
--
-- So the scheme itself declares when a correct final answer takes the whole
-- tariff. This column records that declaration instead of leaving the marker
-- to infer it. TRUE means a matching final answer awards the question's full
-- marks; FALSE (the default) means it awards at most the final point, and the
-- rest are left unmarked for a human rather than guessed at.
--
-- Defaulting to FALSE is deliberate: a question nobody has reviewed under-
-- reports rather than over-reports, and an unmarked mark is visible while a
-- wrongly-awarded one is not.
--
-- ============================================================================
-- WHY TOLERANCE IS RELATIVE, AND WHY IT IS NULLABLE
-- ============================================================================
-- Absolute tolerance cannot span a paper where answers run from 0.0172 mol to
-- 245,310,000 g — a ±0.001 window is meaningless at one end and absurd at the
-- other. Relative scales correctly across both.
--
-- NULL means "no tolerance": the answer must match after normalisation. That
-- is the right default for an MCQ letter and for any answer where the scheme
-- gives an exact figure and no latitude. A missing tolerance is never treated
-- as "any value is fine".
--
-- SIGNIFICANT FIGURES ARE NOT MODELLED HERE. Where the scheme demands them
-- ("Give your answer to three significant figures"), the accepted forms are
-- listed in accepted_values — 20(b)(iii) accepts both 307 and 306, which is a
-- set, not a rounding rule. Inferring a sig-fig policy from a tolerance would
-- get "Ignore SF except 1 SF" wrong in both directions.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.paper_questions') IS NULL THEN
    RAISE EXCEPTION 'ABORTING: public.paper_questions does not exist. Apply 0028 first.';
  END IF;
END $$;

ALTER TABLE public.paper_questions
  ADD COLUMN IF NOT EXISTS expected_value               text,
  ADD COLUMN IF NOT EXISTS expected_unit                text,
  ADD COLUMN IF NOT EXISTS answer_tolerance             numeric,
  ADD COLUMN IF NOT EXISTS accepted_values              text[],
  ADD COLUMN IF NOT EXISTS full_marks_on_correct_answer boolean NOT NULL DEFAULT false;

-- A negative tolerance is meaningless and would silently widen every window.
-- Guarded here rather than in the application because the application is not
-- the only thing that will ever write this column.
ALTER TABLE public.paper_questions
  DROP CONSTRAINT IF EXISTS paper_questions_tolerance_nonneg;
ALTER TABLE public.paper_questions
  ADD CONSTRAINT paper_questions_tolerance_nonneg
  CHECK (answer_tolerance IS NULL OR answer_tolerance >= 0);

COMMENT ON COLUMN public.paper_questions.expected_value IS
  'The final answer a deterministic marker compares against, as a STRING — "0.0172", "B". Transcribed by a human from the mark scheme, never parsed out of guidance at runtime. String, not numeric: 0.0172 and 1.72e-2 are the same number and different answers, and significant figures are part of what is marked.';
COMMENT ON COLUMN public.paper_questions.expected_unit IS
  'Required unit, or NULL where the scheme demands none. A dimensionless answer (a percentage yield) must be NULL, not an empty string — an empty string would fail a student who left the unit box blank correctly.';
COMMENT ON COLUMN public.paper_questions.answer_tolerance IS
  'RELATIVE tolerance: 0.005 accepts within ±0.5%. NULL means exact match after normalisation, never "anything goes".';
COMMENT ON COLUMN public.paper_questions.accepted_values IS
  'Alternate final answers the scheme explicitly allows — 20(b)(iii) permits both 307 and 306. Compared with the same tolerance as expected_value.';
COMMENT ON COLUMN public.paper_questions.full_marks_on_correct_answer IS
  'TRUE when the mark scheme states a correct final answer takes the whole tariff ("Correct answer with no working scores (4)"). FALSE — the default — awards at most the final point and leaves the method marks unmarked rather than guessed. See migration 0031 for why this column exists.';

COMMIT;


-- ============================================================================
-- VERIFICATION — run after applying
-- ============================================================================
-- (a) Five columns, correct types. Expect 5 rows.
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'paper_questions'
--      AND column_name IN ('expected_value','expected_unit','answer_tolerance',
--                          'accepted_values','full_marks_on_correct_answer')
--    ORDER BY column_name;
--   -- full_marks_on_correct_answer must be NOT NULL with default false
--
-- (b) The tolerance guard exists. Expect 1 row.
--
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'public.paper_questions'::regclass
--      AND conname = 'paper_questions_tolerance_nonneg';
--
-- (c) Nothing else moved — 20 policies, as 0028 created them.
--
--   SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
--    AND tablename IN ('paper_questions','question_regions','mark_scheme_items',
--                      'examiner_report_insights','model_answers','exam_attempts',
--                      'question_attempts','student_responses','marking_results');
--   -- expect 20
--
-- (d) The standing AGENTS.md check. MUST return zero rows.
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
--   ALTER TABLE public.paper_questions
--     DROP CONSTRAINT IF EXISTS paper_questions_tolerance_nonneg;
--   ALTER TABLE public.paper_questions
--     DROP COLUMN IF EXISTS expected_value,
--     DROP COLUMN IF EXISTS expected_unit,
--     DROP COLUMN IF EXISTS answer_tolerance,
--     DROP COLUMN IF EXISTS accepted_values,
--     DROP COLUMN IF EXISTS full_marks_on_correct_answer;
--   COMMIT;
--
-- Deterministic marking of numeric answers stops working the moment these are
-- gone — the marker reports "not markable" rather than falling back to prose
-- parsing, so the failure is visible rather than silent. Revert the fixture
-- and the marker alongside.
-- ============================================================================
