-- ============================================================================
-- _PROPOSED_ — exam board as data, per-subject preference, tuition linkage
-- ----------------------------------------------------------------------------
-- ⚠ NOT APPLIED. NOT NUMBERED. DO NOT RUN AS IT STANDS.
--
-- The number comes from the planning chat and nowhere else. This file must NOT
-- assume the next free integer — a folder listing cannot show a reservation,
-- and this folder is the only rebuild path.
--
-- ⚠ ALLOCATION AS OF 2026-08-23. This note used to read "0068+ is already
-- queued by the lesson-experience batch (PROPOSED_lesson_sections_and_content
-- .sql)". That is no longer the position:
--
--     0068 .... TAKEN — tuition booking RPC, applied and live.
--     0069 .... TAKEN — repair of 0068, written and PARKED, not yet applied.
--     0070+ ... UNISSUED.
--
-- Unissued is not the same as free. It means no number above 0069 has been
-- allocated to anything, including to this file — so this file still must NOT
-- assume 0070. Ask for a number; do not count to one.
--
-- ⚠ HOW LITTLE THIS NEEDS TO BE, AND WHY
-- ----------------------------------------------------------------------------
-- §20 says fit the current architecture rather than invent tables, and the
-- current architecture already models almost all of this — since 0001:
--
--   curricula          11 rows, board+qualification pairs (edexcel-ial,
--                      aqa-gcse, cie-igcse …), slug UNIQUE and URL-safe
--   courses.curriculum_id  NOT NULL FK → curricula
--   courses.pathway    (0005) the qualification grouping
--   curricula.region   'International' | 'United Kingdom' | 'United States'
--
-- So Subject → Qualification → Board → Course is ALREADY representable, and
-- `curricula.slug` is already in the projection every /learn page reads
-- (queries.ts COURSE_SELECT). The LEVEL tier above it is pure derivation and
-- needs no column at all. NOTHING in this file is required for the shipped
-- feature to work — the app runs today, on the schema as it is.
--
-- What each section buys is the removal of one hardcoded mapping.
-- ============================================================================

-- ══ SECTION 1 — board and specification as data, not as a constant ══════════
BEGIN;

-- ⚠ REPLACES CURRICULUM_BOARD IN src/lib/qualifications/model.ts. Today the
-- board a curriculum belongs to is a hand-written map in TypeScript, because
-- the column does not exist. That map is correct and reviewable, and it is
-- still a second place the truth lives.
ALTER TABLE public.curricula
  ADD COLUMN IF NOT EXISTS exam_board text,
  ADD COLUMN IF NOT EXISTS specification_code text;

-- Nullable on purpose: `ib` and `ap` are not board-based qualifications, and
-- forcing a board onto them would invent a fact. A CHECK constrains the
-- vocabulary without requiring a value.
ALTER TABLE public.curricula
  DROP CONSTRAINT IF EXISTS curricula_exam_board_check;
ALTER TABLE public.curricula
  ADD CONSTRAINT curricula_exam_board_check CHECK (
    exam_board IS NULL OR exam_board IN ('edexcel','aqa','ocr','cambridge','oxfordaqa')
  );

-- Backfill exactly the mapping the application already uses, so applying this
-- changes no behaviour on the day it runs.
UPDATE public.curricula SET exam_board = 'edexcel'   WHERE slug IN ('edexcel-ial','edexcel-igcse','edexcel-alevel','edexcel-gcse');
UPDATE public.curricula SET exam_board = 'aqa'       WHERE slug IN ('aqa-alevel','aqa-gcse');
UPDATE public.curricula SET exam_board = 'ocr'       WHERE slug IN ('ocr-alevel','ocr-gcse');
UPDATE public.curricula SET exam_board = 'cambridge' WHERE slug IN ('cie-igcse');

CREATE INDEX IF NOT EXISTS curricula_exam_board_idx
  ON public.curricula (exam_board) WHERE exam_board IS NOT NULL;

-- curricula is read by everyone (catalogue_public_read_curricula, 0001) and
-- written only by admin tooling, so no new grant is needed. Restated because
-- a new column on a public table is exactly where a privilege creeps in.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.curricula FROM anon, authenticated;

COMMIT;

-- ══ SECTION 2 — the boards the brief names that have no row yet ═════════════
-- ⚠ DATA, NOT SCHEMA — AND DELIBERATELY SEPARATE SO IT CAN BE DECLINED.
-- Cambridge International AS & A Level and OxfordAQA are named in the brief
-- (§8, §5) and have no `curricula` row, so they cannot appear anywhere in the
-- UI today. Inserting them makes the ARCHITECTURE show them; it does not make
-- them supported — with no courses and no lessons the derivation returns
-- "Coming soon" for both, which is the truth (§41).
--
-- Left unapplied so the decision is the founder's: a board on the page with
-- nothing behind it is breadth to some readers and noise to others.
BEGIN;

INSERT INTO public.curricula (slug, name, short_name, region, description, sort_order, exam_board)
VALUES
  ('cie-ial', 'Cambridge International AS & A Level', 'Cambridge IAL', 'International',
   'Cambridge Assessment International Education AS & A Level', 12, 'cambridge'),
  ('oxfordaqa-igcse', 'OxfordAQA International GCSE', 'OxfordAQA IGCSE', 'International',
   'OxfordAQA International GCSE', 13, 'oxfordaqa'),
  ('oxfordaqa-ial', 'OxfordAQA International A-Level', 'OxfordAQA IAL', 'International',
   'OxfordAQA International Advanced Level', 14, 'oxfordaqa')
ON CONFLICT (slug) DO NOTHING;

-- ⚠ NO COURSE SHELLS ARE CREATED FOR THEM. An empty course row would make the
-- board render one tier deeper with nothing in it, which is the thin doorway
-- §26 forbids. Courses arrive when content does.

COMMIT;

-- ══ SECTION 3 — per-subject qualification preference (§17, §18) ═════════════
BEGIN;

-- ⚠ WHY profiles.curriculum_id CANNOT DO THIS, THOUGH IT ALREADY EXISTS.
-- 0017 added `profiles.curriculum_id` as a single global preference and its
-- own header records the limit: "one profile value cannot describe a student
-- taking GCSE and AS at once." §18 requires exactly what that cannot express
-- — Chemistry on Edexcel IAL while Biology is on Cambridge. So the preference
-- becomes one row per (student, subject). profiles.curriculum_id stays as the
-- catalogue-wide default and is NOT dropped: it has a reader today.
--
-- ⚠ A PREFERENCE, NEVER AN ENTITLEMENT (§37). This table says which
-- qualification a student TELLS us they study. It grants nothing. Access
-- continues to come from student_courses, entitlements and cohort_enrolments,
-- which is why a student may freely write this row and may not write those.
CREATE TABLE IF NOT EXISTS public.student_subject_qualification (
  user_id       uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  subject_id    uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  curriculum_id uuid NOT NULL REFERENCES public.curricula(id) ON DELETE CASCADE,
  -- Null when the student answered "I'm not sure" (§19) — a real answer that
  -- must not be stored as a guess.
  is_confirmed  boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_subject_qualification_pk PRIMARY KEY (user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS ssq_subject_idx ON public.student_subject_qualification (subject_id);

DROP TRIGGER IF EXISTS touch_student_subject_qualification ON public.student_subject_qualification;
CREATE TRIGGER touch_student_subject_qualification
  BEFORE UPDATE ON public.student_subject_qualification
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.student_subject_qualification ENABLE ROW LEVEL SECURITY;

-- Predicate in BOTH USING and WITH CHECK — USING alone filters what a student
-- SEES while still letting them write a row carrying somebody else's user_id.
CREATE POLICY ssq_own_read   ON public.student_subject_qualification
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ssq_own_insert ON public.student_subject_qualification
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY ssq_own_update ON public.student_subject_qualification
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ssq_own_delete ON public.student_subject_qualification
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY ssq_staff_read ON public.student_subject_qualification
  FOR SELECT TO authenticated USING (public.is_staff());

-- Column-scoped, key columns absent from UPDATE — so the writer must be
-- UPDATE-then-INSERT, never .upsert() (PostgREST compiles upsert to
-- ON CONFLICT DO UPDATE SET including the keys, which this grant refuses).
-- 0064's header records this trap after it bit once.
GRANT SELECT ON public.student_subject_qualification TO authenticated;
GRANT INSERT (user_id, subject_id, curriculum_id, is_confirmed)
  ON public.student_subject_qualification TO authenticated;
GRANT UPDATE (curriculum_id, is_confirmed)
  ON public.student_subject_qualification TO authenticated;
-- DELETE is granted deliberately: "I picked the wrong board" must be
-- correctable by the student who picked it. Nothing of record is lost —
-- this table holds a stated preference, not evidence.
GRANT DELETE ON public.student_subject_qualification TO authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.student_subject_qualification FROM anon, authenticated;

COMMIT;

-- ══ SECTION 4 — tuition availability as data (§29) ══════════════════════════
BEGIN;

-- ⚠ §29's DISTINCTION, MADE STRUCTURAL. Platform coverage and live-tuition
-- availability are different facts and must never be inferred from each
-- other. Today `cohorts` (0009) carries only a slug — 'ial-chem-as-sep-2026'
-- — so nothing links a cohort to a curriculum, and the application carries a
-- one-entry TUITION_CURRICULA set instead. This makes the link real.
ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS curriculum_id uuid REFERENCES public.curricula(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id    uuid REFERENCES public.subjects(id)  ON DELETE SET NULL;

UPDATE public.cohorts c
   SET curriculum_id = (SELECT id FROM public.curricula WHERE slug = 'edexcel-ial'),
       subject_id    = (SELECT id FROM public.subjects  WHERE slug = 'chemistry')
 WHERE c.slug LIKE 'ial-chem-%' AND c.curriculum_id IS NULL;

CREATE INDEX IF NOT EXISTS cohorts_curriculum_idx
  ON public.cohorts (curriculum_id) WHERE curriculum_id IS NOT NULL;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.cohorts FROM anon, authenticated;

COMMIT;

-- ══ SECTION 5 — ⚠ ERASURE IS PART OF THIS, NOT A FOLLOW-UP ═════════════════
-- erase_user v5 (0067) does not know student_subject_qualification exists.
-- Applying section 3 without extending it leaves a student's stated
-- qualification behind after erasure AND the receipt says nothing — the SR
-- check would pass on a false negative, which is the worst kind of green.
--
-- v6 = v5 plus, beside the existing counted deletes:
--
--     DELETE FROM public.student_subject_qualification WHERE user_id = target;
--     GET DIAGNOSTICS subject_qualification_removed = ROW_COUNT;
--
-- and 'subject_qualification_removed' added to the returned jsonb. The other
-- three sections touch no student data — curricula and cohorts are catalogue
-- rows — so they need no delete, only the confirmation that this was checked
-- rather than forgotten. GATE email_columns_scanned stays 8: none of these
-- adds an email column.

-- ══ VERIFICATION (after applying; each should return zero rows) ═════════════
-- SELECT table_name, grantee, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='student_subject_qualification'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
--
-- Boards that failed the CHECK vocabulary (should be none):
-- SELECT slug, exam_board FROM public.curricula
--  WHERE exam_board IS NOT NULL
--    AND exam_board NOT IN ('edexcel','aqa','ocr','cambridge','oxfordaqa');
--
-- ⚠ AND THE ONE THAT PROVES §37: from a real authenticated session, an
-- attempt to write a row for ANOTHER user_id must be refused. If it succeeds,
-- WITH CHECK is missing and a preference table has become a way to write
-- other people's rows.
