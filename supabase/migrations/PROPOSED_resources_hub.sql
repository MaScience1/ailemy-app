-- ============================================================================
-- _PROPOSED_ — Resources Hub: question metadata, saved resources, recents
-- ----------------------------------------------------------------------------
-- ⚠ NOT APPLIED. NOT NUMBERED. DO NOT RUN AS IT STANDS.
--
-- The number comes from the planning chat and nowhere else. This is the THIRD
-- parked file; PROPOSED_lesson_sections_and_content.sql and
-- PROPOSED_qualification_architecture.sql are both still unapplied, and none
-- of the three may assume the next free integer — a folder listing cannot
-- show a reservation, and this folder is the only rebuild path.
--
-- ⚠ WHY THIS IS A SEPARATE FILE AND NOT A FIFTH SECTION OF THE LESSON ONE.
-- That file already carries four unapplied domains. Adding a fifth would make
-- one paste an all-or-nothing decision across five unrelated concerns — the
-- founder could not apply section completion without also applying question
-- metadata. Separate files are separately refusable.
--
-- ⚠ AND IT DELIBERATELY CREATES NO `resources` TABLE.
-- ----------------------------------------------------------------------------
-- The Resources Hub reads the graph that already exists — subjects →
-- curricula → courses → units → topics → spec_points, with lessons and
-- past_papers hanging off it. A `resources` table listing "a lesson, a deck, a
-- paper" would be a SECOND index of rows that already have a home, and it
-- would drift from the first the day somebody published a lesson without
-- remembering to register it. §67 calls that a silo and forbids it.
--
-- What is genuinely missing is metadata that has nowhere to live today:
-- question difficulty, cognitive demand and mathematical demand; a student's
-- saved resources; and what they looked at recently.
-- ============================================================================

-- ══ SECTION 1 — question metadata (§11, §12, §13, §34) ═════════════════════
BEGIN;

-- ⚠ COLUMNS ON paper_questions, NOT A PARALLEL QUESTION TABLE. The questions
-- exist; what is missing is how to select among them. The Exam Builder needs
-- to ask for "four apply-level calculation questions worth 3-5 marks on
-- Energetics", and every term in that sentence except the last two has no
-- column today.
ALTER TABLE public.paper_questions
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS cognitive_level text,
  ADD COLUMN IF NOT EXISTS maths_demand text,
  ADD COLUMN IF NOT EXISTS question_style text;

-- ⚠ THE VOCABULARY IS CONSTRAINED, BECAUSE FREE TEXT BECOMES SIX SPELLINGS OF
-- "calculation" within a year and no filter can ever be trusted again.
-- NULL is allowed throughout: an unclassified question is an honest state,
-- and forcing a default would fabricate metadata for thousands of rows (§64).
ALTER TABLE public.paper_questions DROP CONSTRAINT IF EXISTS pq_difficulty_check;
ALTER TABLE public.paper_questions ADD CONSTRAINT pq_difficulty_check
  CHECK (difficulty IS NULL OR difficulty IN ('easy','standard','challenging'));

-- Bloom, internally. §12 is explicit that students should NOT be shown
-- "Bloom's taxonomy" — they see Recall / Understand / Apply / Analyse /
-- Evaluate. The internal vocabulary stays exact so teachers, analytics and
-- balanced exam generation have something rigorous to work from.
ALTER TABLE public.paper_questions DROP CONSTRAINT IF EXISTS pq_cognitive_check;
ALTER TABLE public.paper_questions ADD CONSTRAINT pq_cognitive_check
  CHECK (cognitive_level IS NULL OR cognitive_level IN
    ('remember','understand','apply','analyse','evaluate','create'));

ALTER TABLE public.paper_questions DROP CONSTRAINT IF EXISTS pq_maths_check;
ALTER TABLE public.paper_questions ADD CONSTRAINT pq_maths_check
  CHECK (maths_demand IS NULL OR maths_demand IN
    ('none','basic_calculation','multi_step','algebraic','graph_data','unit_conversion'));

ALTER TABLE public.paper_questions DROP CONSTRAINT IF EXISTS pq_style_check;
ALTER TABLE public.paper_questions ADD CONSTRAINT pq_style_check
  CHECK (question_style IS NULL OR question_style IN
    ('mcq','short_answer','long_answer','calculation','practical','data_analysis'));

-- The Exam Builder's real query shape: filter by style/difficulty, order by
-- marks. A partial index keeps it off the many rows that are unclassified.
CREATE INDEX IF NOT EXISTS pq_selection_idx
  ON public.paper_questions (question_style, difficulty, marks)
  WHERE question_style IS NOT NULL;

-- ⚠ NO GRANT CHANGE, AND THAT IS THE POINT (§60). paper_questions refuses
-- anon with 42501 today so exam content cannot be scraped, and these columns
-- must not become the reason that changes. Any Exam Builder reads them from a
-- server context that has already authorised the request.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.paper_questions FROM anon, authenticated;

COMMIT;

-- ══ SECTION 2 — saved resources (§35) ══════════════════════════════════════
BEGIN;

-- ⚠ ONE SAVE TABLE FOR EVERY RESOURCE KIND, NOT ONE PER KIND. A student's
-- "Saved" list has to mix a lesson, a deck, a paper and a topic in one
-- chronological view; four tables would make that a four-way union forever.
-- The kind plus a target id is the smaller model.
--
-- ⚠ IT IS NOT AN FK, DELIBERATELY, AND THE TRADE IS RECORDED. A polymorphic
-- reference cannot be a foreign key, so a saved row can outlive its target.
-- The alternative — four nullable FK columns with a CHECK that exactly one is
-- set — is genuinely more correct and considerably more code to read and
-- write. The reader resolves targets and silently drops the ones that no
-- longer exist, which is the behaviour a student expects from a bookmark.
CREATE TABLE IF NOT EXISTS public.student_saved_resources (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_kind text NOT NULL,
  resource_id   uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssr_pk PRIMARY KEY (user_id, resource_kind, resource_id),
  CONSTRAINT ssr_kind_check CHECK (
    resource_kind IN ('lesson','topic','unit','past_paper','card_deck','course')
  )
);

CREATE INDEX IF NOT EXISTS ssr_user_recent_idx
  ON public.student_saved_resources (user_id, created_at DESC);

ALTER TABLE public.student_saved_resources ENABLE ROW LEVEL SECURITY;

-- Predicate in BOTH USING and WITH CHECK — USING alone filters what a student
-- SEES while still letting them write a row carrying somebody else's user_id.
CREATE POLICY ssr_own_read   ON public.student_saved_resources
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ssr_own_insert ON public.student_saved_resources
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY ssr_own_delete ON public.student_saved_resources
  FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, DELETE ON public.student_saved_resources TO authenticated;
GRANT INSERT (user_id, resource_kind, resource_id)
  ON public.student_saved_resources TO authenticated;
-- No UPDATE: a save has nothing to change. Unsaving is a DELETE.

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.student_saved_resources FROM anon, authenticated;

COMMIT;

-- ══ SECTION 3 — recently viewed (§36) ══════════════════════════════════════
BEGIN;

-- ⚠ A BROWSING TRAIL IS THE MOST SENSITIVE THING IN THIS FILE, SO IT IS THE
-- MOST NARROWLY SCOPED. It records WHAT a student opened and when. That is
-- useful for "continue studying" and it is also a record of what somebody was
-- struggling with, so:
--   · staff get NO read policy here — unlike lesson_section_state, where a
--     teacher needs to see progress to teach. Nobody needs to watch browsing.
--   · one row per (student, resource), overwritten, so it is a bookmark
--     rather than a history log with a timeline.
--   · the student can delete it.
CREATE TABLE IF NOT EXISTS public.student_recent_resources (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_kind text NOT NULL,
  resource_id   uuid NOT NULL,
  viewed_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT srr_pk PRIMARY KEY (user_id, resource_kind, resource_id),
  CONSTRAINT srr_kind_check CHECK (
    resource_kind IN ('lesson','topic','unit','past_paper','card_deck','course')
  )
);

CREATE INDEX IF NOT EXISTS srr_user_recent_idx
  ON public.student_recent_resources (user_id, viewed_at DESC);

ALTER TABLE public.student_recent_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY srr_own_read   ON public.student_recent_resources
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY srr_own_insert ON public.student_recent_resources
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY srr_own_update ON public.student_recent_resources
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY srr_own_delete ON public.student_recent_resources
  FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, DELETE ON public.student_recent_resources TO authenticated;
GRANT INSERT (user_id, resource_kind, resource_id, viewed_at)
  ON public.student_recent_resources TO authenticated;
GRANT UPDATE (viewed_at) ON public.student_recent_resources TO authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.student_recent_resources FROM anon, authenticated;

COMMIT;

-- ══ SECTION 4 — ⚠ ERASURE SHIPS IN THIS FILE, NOT AFTER IT ═════════════════
-- Both tables in sections 2 and 3 name a person. erase_user does not know they
-- exist, so applying this file without extending it leaves a student's saved
-- list and browsing trail behind after erasure AND the receipt says nothing —
-- the SR check would pass on a false negative, which is the worst kind of
-- green. The erasure coupling is part of the same paste for that reason.
--
-- Whichever erase_user version is current when this is numbered gains, beside
-- the existing counted deletes:
--
--     DELETE FROM public.student_saved_resources WHERE user_id = target;
--     GET DIAGNOSTICS saved_resources_removed = ROW_COUNT;
--     DELETE FROM public.student_recent_resources WHERE user_id = target;
--     GET DIAGNOSTICS recent_resources_removed = ROW_COUNT;
--
-- and 'saved_resources_removed' / 'recent_resources_removed' added to the
-- returned jsonb. Section 1 touches no student data — it adds columns to
-- paper_questions, which describe exam content, not people.
--
-- ⚠ THE GATE STAYS 8. None of these adds an email column, so
-- email_columns_scanned must still read 8 after applying. A 9 means something
-- else changed and the erasure sweep needs re-reading before it is trusted.

-- ══ VERIFICATION (after applying; each should return zero rows) ═════════════
-- 1. The three privileges no client may hold:
-- SELECT table_name, grantee, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE table_schema='public'
--    AND table_name IN ('student_saved_resources','student_recent_resources')
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
--
-- 2. ⚠ paper_questions IS STILL CLOSED TO anon. This is the one that matters
--    most: the new columns must not have come with a grant. From an anonymous
--    PostgREST request, selecting from paper_questions must still fail 42501.
--    If it succeeds, exam content is now scrapeable and this file did it.
--
-- 3. Metadata vocabulary holds (should be none):
-- SELECT id, difficulty, cognitive_level, maths_demand, question_style
--   FROM public.paper_questions
--  WHERE (difficulty IS NOT NULL AND difficulty NOT IN ('easy','standard','challenging'))
--     OR (question_style IS NOT NULL AND question_style NOT IN
--         ('mcq','short_answer','long_answer','calculation','practical','data_analysis'));
--
-- 4. ⚠ AND THE §37-SHAPED ONE: from a real authenticated session, writing a
--    saved-resource row for ANOTHER user_id must be REFUSED. If it succeeds,
--    WITH CHECK is missing and a bookmark table has become a way to write
--    other people's rows.
