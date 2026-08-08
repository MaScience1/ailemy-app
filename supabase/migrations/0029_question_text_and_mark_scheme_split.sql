-- ============================================================================
-- 0029_question_text_and_mark_scheme_split.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED 2026-08-08. DO NOT RE-RUN AGAINST PRODUCTION — this file now exists
-- so a rebuild from migrations matches what is already live. Every ADD COLUMN
-- is guarded with IF NOT EXISTS so re-running is harmless in itself, BUT the
-- pre-flight below aborts if either table is non-empty, and both now hold
-- seeded rows. A re-run therefore fails loudly rather than silently — which is
-- the correct behaviour, not a defect. Verified live: all four columns respond,
-- and accepted_alternatives is still present and NULL on all 25 seeded rows.
--
-- DEPENDS ON 0028, which created both tables.
-- ----------------------------------------------------------------------------
-- Add four nullable columns across two existing tables:
--
--   paper_questions.question_text   text
--   mark_scheme_items.guidance      text
--   mark_scheme_items.accept        text[]
--   mark_scheme_items.reject        text[]
--
-- Additive only. No table is created, no column is dropped or retyped, no
-- constraint, index, policy, grant, function or type is added or changed, and
-- no row in any table is modified. Every one of the nine tables from 0028
-- keeps exactly the RLS and grants it has today.
--
-- ============================================================================
-- WHY — BOTH GAPS WERE FOUND BY TRYING TO SEED A REAL PAPER
-- ============================================================================
-- Neither of these is a theoretical tidy-up. Both surfaced while transcribing
-- Edexcel IAL Chemistry WCH11/01 May–June 2025 into the Phase 1 tables, and
-- both would have shipped a marking engine that is quietly wrong.
--
-- ---------------------------------------------------------------------------
-- GAP 1 — there is nowhere to put the question
-- ---------------------------------------------------------------------------
-- paper_questions holds question_number, display_order, marks, answer_type,
-- command_word, topic and spec_point. It does NOT hold the question. The
-- original design assumed the student reads the rendered PDF and that
-- question_regions locates it on the page, which is true for the STUDENT and
-- false for the MARKER: an LLM asked "does this answer earn M2?" cannot answer
-- without knowing what was asked. Today the only way to supply it is to crop
-- the page image at marking time from a question_regions row — and regions are
-- deliberately unpopulated until a human approves them, so a seeded question
-- is markable only after someone has drawn a box around it.
--
-- Nullable, because it must stay optional. A question whose stem is a diagram
-- (a mass spectrum to read off, a mechanism to complete) has no useful text,
-- and forcing a NOT NULL would invite placeholder junk in exactly those rows.
--
-- ⚠ VISIBILITY. This is the one new column a student can read.
--   paper_questions carries paper_questions_read policy from 0028, which lets
--   anyone read questions belonging to a paper with status = 'live'. That is
--   correct — it is the question they are sitting — but it means question_text
--   is PUBLISHED THE MOMENT the paper goes live. Do not put marking notes,
--   answers or internal commentary in it. Those belong in the three columns
--   below, on mark_scheme_items, which no student-facing policy can reach.
--
-- ---------------------------------------------------------------------------
-- GAP 2 — accepted_alternatives is doing three contradictory jobs
-- ---------------------------------------------------------------------------
-- mark_scheme_items gives one text[] beside criterion. An Edexcel mark scheme
-- row is printed as four columns — Question Number | Answer | Additional
-- Guidance | Mark — and the guidance column mixes at least three kinds of
-- instruction that a marker must treat DIFFERENTLY:
--
--   things that still earn the mark    "Allow 306 (kg)", "Accept 13H2O(g)"
--   things that must NOT earn it       "Do not award ions move"
--   neither — prose and arithmetic     "TE on M1 and M2 but no TE from M3 to
--                                       M4", the worked example
--
-- Flattened into one array they are indistinguishable. A marking prompt that
-- reads every entry as "another acceptable answer" — the obvious reading of a
-- column called accepted_alternatives — will award 23(c)(ii) M1 to a candidate
-- who says the IONS move, which is the single thing the examiner explicitly
-- forbids. The failure is silent: the mark is awarded, the student is told
-- they were right, and nothing logs an error.
--
-- So: guidance for the prose, accept[] for what earns the mark, reject[] for
-- what does not. The distinction is not cosmetic — reject[] is the only one of
-- the three whose entries must be able to VETO a mark.
--
-- ---------------------------------------------------------------------------
-- WHY accepted_alternatives IS NOT DROPPED HERE
-- ---------------------------------------------------------------------------
-- It is left in place, unchanged and unused. Dropping a column and adding its
-- replacements in one migration means any rollback has to restore data as well
-- as shape, and it breaks anything still reading the old name at the instant
-- it runs. Nothing is lost by waiting: both tables are EMPTY (verified below
-- before any change is made), so there is no data to migrate and no window in
-- which the two representations can disagree.
--
-- The seed importer stops writing accepted_alternatives as of this migration,
-- which is what makes the eventual DROP a formality rather than a decision.
-- When you are satisfied nothing references it:
--
--   ALTER TABLE public.mark_scheme_items DROP COLUMN accepted_alternatives;
--
-- as its own migration, 0030.
--
-- ============================================================================
-- WHY NO GRANT CHANGES ARE NEEDED — CHECKED, NOT ASSUMED
-- ============================================================================
-- 0028 grants these two tables at TABLE level:
--
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_questions   TO authenticated;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.mark_scheme_items TO authenticated;
--
-- A table-level grant covers every column, including columns added later, so
-- the four new columns are readable and writable exactly as far as the
-- existing RLS policies allow and no further.
--
-- This is worth stating because it is NOT universally true in this schema.
-- profiles (0018) and parent_students (0023) use COLUMN-LEVEL grants —
-- GRANT UPDATE (col_a, col_b) — and a new column on either of those would be
-- invisible to writes until named explicitly. Neither is touched here.
--
-- The three dangerous privileges were revoked from both tables by 0028 and are
-- not re-granted by adding a column; REVOKE TRUNCATE/TRIGGER/REFERENCES is a
-- table-level fact. Per AGENTS.md this migration creates no table, so the
-- standing CREATE TABLE rule does not apply — but the verification block below
-- re-checks it anyway, because the cost is one query.
--
-- ⚠ PRE-EXISTING, UNCHANGED, AND WORTH KNOWING: authenticated holds table-wide
--   UPDATE on both tables. RLS restricts WHO may update (staff only, via
--   has_role/is_staff), but RLS filters ROWS, never COLUMNS — so any staff user
--   who can update a mark_scheme_items row can rewrite reject[] on it. That is
--   consistent with 0028's model, where mark-scheme content is staff-authored.
--   If reject[] is ever given veto power in an automated marking path, revisit
--   it with a column-level grant. Not changed here; flagged deliberately.
--
-- ============================================================================
-- SAFETY
-- ============================================================================
-- Re-runnable. Every ADD COLUMN uses IF NOT EXISTS, so a second run is a
-- no-op and raises nothing. The whole file is one transaction: if the
-- preflight fails, nothing is added.
--
-- ADD COLUMN ... (nullable, no DEFAULT) is a catalogue-only change in
-- PostgreSQL — it does not rewrite the table and takes only a brief
-- ACCESS EXCLUSIVE lock. On empty tables it is instant regardless.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Pre-flight
-- ----------------------------------------------------------------------------
-- Both tables must exist (0028 applied), and both must be EMPTY. The empty
-- check is not pedantry: the entire justification for leaving
-- accepted_alternatives in place rather than migrating its contents is that
-- there are no contents. If that is false, this file is the wrong migration
-- and it stops rather than creating two half-populated representations of the
-- same thing.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  n_questions bigint;
  n_items     bigint;
BEGIN
  IF to_regclass('public.paper_questions') IS NULL THEN
    RAISE EXCEPTION
      'ABORTING: public.paper_questions does not exist. Apply 0028 first.';
  END IF;
  IF to_regclass('public.mark_scheme_items') IS NULL THEN
    RAISE EXCEPTION
      'ABORTING: public.mark_scheme_items does not exist. Apply 0028 first.';
  END IF;

  SELECT count(*) INTO n_questions FROM public.paper_questions;
  SELECT count(*) INTO n_items     FROM public.mark_scheme_items;

  IF n_questions <> 0 OR n_items <> 0 THEN
    RAISE EXCEPTION
      'ABORTING: expected both tables empty, found % paper_questions and % mark_scheme_items. This migration assumes there is no accepted_alternatives data to carry across. Decide how to migrate it before proceeding. No changes made.',
      n_questions, n_items;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. paper_questions.question_text
-- ----------------------------------------------------------------------------
ALTER TABLE public.paper_questions
  ADD COLUMN IF NOT EXISTS question_text text;

COMMENT ON COLUMN public.paper_questions.question_text IS
  'The question as printed, for the marker to reason against. NULL where the question is purely a diagram. STUDENT-READABLE via paper_questions_read once the paper is live — never put answers or marking notes here.';

-- ----------------------------------------------------------------------------
-- 2. mark_scheme_items.guidance / accept[] / reject[]
-- ----------------------------------------------------------------------------
-- These three split the mark scheme's Additional Guidance column by what a
-- marker must DO with each line. criterion stays exactly as it is: the
-- Answer-column bullet, the thing that earns the mark.
-- ----------------------------------------------------------------------------
ALTER TABLE public.mark_scheme_items
  ADD COLUMN IF NOT EXISTS guidance text,
  ADD COLUMN IF NOT EXISTS accept   text[],
  ADD COLUMN IF NOT EXISTS reject   text[];

COMMENT ON COLUMN public.mark_scheme_items.guidance IS
  'Additional Guidance prose that neither grants nor withholds the mark: worked examples, transferred-error rules, marking instructions. Verbatim from the mark scheme. Informs a marker; never decides on its own.';

COMMENT ON COLUMN public.mark_scheme_items.accept IS
  'Responses that DO earn this mark although they differ from criterion — "Allow 306 (kg)", "Accept 13H2O(g)". Also holds "Ignore X" rules, which operationally mean award the mark despite X.';

COMMENT ON COLUMN public.mark_scheme_items.reject IS
  'Responses that must NOT earn this mark however plausible — "Do not award ions move". The only one of the three that can veto. An automated marker MUST check reject before awarding.';

COMMENT ON COLUMN public.mark_scheme_items.accepted_alternatives IS
  'DEPRECATED by 0029, superseded by accept[] / reject[] / guidance. Retained empty so the drop can be its own migration. Do not write to it.';

COMMIT;


-- ============================================================================
-- VERIFICATION — run after applying
-- ============================================================================
-- (a) The four columns exist, are nullable, and have the right types.
--     Expect exactly 4 rows, every is_nullable = YES.
--
--   SELECT table_name, column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND (   (table_name = 'paper_questions'   AND column_name = 'question_text')
--           OR (table_name = 'mark_scheme_items' AND column_name IN ('guidance','accept','reject')))
--    ORDER BY table_name, column_name;
--
--   -- expect: mark_scheme_items | accept        | ARRAY | YES
--   --         mark_scheme_items | guidance      | text  | YES
--   --         mark_scheme_items | reject        | ARRAY | YES
--   --         paper_questions   | question_text | text  | YES
--
-- (b) accepted_alternatives is STILL THERE and still text[]. Expect 1 row.
--     If this returns nothing, something dropped it — that was not this file.
--
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'mark_scheme_items'
--      AND column_name = 'accepted_alternatives';
--
-- (c) NO POLICY CHANGED. Expect the same 20 policies 0028 created, with the
--     same names, across the same nine tables.
--
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('paper_questions','question_regions','mark_scheme_items',
--                        'examiner_report_insights','model_answers','exam_attempts',
--                        'question_attempts','student_responses','marking_results')
--    ORDER BY tablename, policyname;
--
-- (d) NO GRANT CHANGED, and the new columns are covered by the table-level
--     grant rather than needing one of their own. Expect four rows for
--     paper_questions and four for mark_scheme_items — SELECT, INSERT, UPDATE,
--     DELETE to authenticated — and nothing for anon.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND table_name IN ('paper_questions','mark_scheme_items')
--      AND grantee IN ('anon','authenticated')
--    ORDER BY table_name, grantee, privilege_type;
--
-- (e) The three dangerous privileges are still absent. MUST return zero rows.
--     This is the AGENTS.md standing check. It is run here even though no
--     table was created, because it costs one query and 0022 shipped a table
--     with all three by not checking.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon','authenticated')
--      AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES')
--    ORDER BY table_name, grantee, privilege_type;
--
-- (f) RLS is still enabled on both. Expect two rows, both rowsecurity = true.
--
--   SELECT relname, relrowsecurity AS rowsecurity
--     FROM pg_class
--    WHERE relnamespace = 'public'::regnamespace
--      AND relname IN ('paper_questions','mark_scheme_items');
-- ============================================================================


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Unconditionally safe while the columns are unpopulated: nothing references
-- them, no constraint or index depends on them, and dropping a column that
-- was added without a default is a catalogue-only operation.
--
-- Losing seeded content is the only real risk, so check first — this should
-- return 0 before you roll back, and if it does not, you are about to delete
-- transcribed mark-scheme content that exists nowhere else:
--
--   SELECT count(*) FROM public.mark_scheme_items
--    WHERE guidance IS NOT NULL OR accept IS NOT NULL OR reject IS NOT NULL;
--   SELECT count(*) FROM public.paper_questions WHERE question_text IS NOT NULL;
--
--   BEGIN;
--   ALTER TABLE public.paper_questions   DROP COLUMN IF EXISTS question_text;
--   ALTER TABLE public.mark_scheme_items DROP COLUMN IF EXISTS guidance;
--   ALTER TABLE public.mark_scheme_items DROP COLUMN IF EXISTS accept;
--   ALTER TABLE public.mark_scheme_items DROP COLUMN IF EXISTS reject;
--   COMMIT;
--
-- The seed importer must be reverted alongside, or its next run fails on the
-- missing columns. It writes all four.
-- ============================================================================
