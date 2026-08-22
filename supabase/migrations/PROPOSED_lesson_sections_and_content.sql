-- ============================================================================
-- _PROPOSED_ — lesson section state, notes, worked examples, exam-question map
-- ----------------------------------------------------------------------------
-- ⚠ NOT APPLIED. NOT NUMBERED. DO NOT RUN THIS FILE AS IT STANDS.
--
-- The number comes from the planning chat and from nowhere else — not from
-- `ls`, not from "highest plus one". The folder currently ends at 0067 and
-- 0062 is parked, but a folder listing cannot show a RESERVATION, and a
-- migration written under a number somebody else has been promised overwrites
-- a live file in the only rebuild path this project has. When the founder
-- issues numbers, this file splits into as many numbered files as they
-- allocate, each renamed from _PROPOSED_ only once it is applied, with the
-- observed verification results written into its header in the same act.
--
-- ⚠ WHY FOUR TABLES AND NOT SIX COLUMNS ON lesson_view_state
-- ----------------------------------------------------------------------------
-- lesson_view_state (0064) is keyed PRIMARY KEY (user_id, lesson_id) — one row
-- per student per lesson. It cannot carry six per-section states. It is also
-- the table whose grants are COLUMN-SCOPED AND ENUMERATED:
--
--     GRANT INSERT (user_id, lesson_id, last_frame_index, deck_version,
--                   slides_visited, slides_completed_at) …
--     GRANT UPDATE (last_frame_index, deck_version, slides_visited,
--                   slides_completed_at) …
--
-- so every column added to it later is NOT covered by those grants and its
-- writes fail 42501 — silently, from the client's point of view, and far from
-- the cause. Adding six completion columns there would mean re-issuing both
-- grants and would still leave one row per lesson trying to describe six
-- things. A section-keyed table is the smaller change and the honest shape.
--
-- ⚠ AND IT IS A ROLLUP, NOT A SECOND EVIDENCE STORE (§26/§91 — no parallel
-- record systems). The EVIDENCE stays where it already lives:
--     slides    → lesson_view_state.slides_visited / .slides_completed_at (0064)
--     practice  → lesson_practice_attempts / _answers (0065)
--     exam      → exam_attempts / question_attempts / marking_results (0028)
-- This table stores only the derived verdict plus a POINTER to the evidence.
-- Nothing here duplicates a mark, a score or an answer.
--
-- ⚠ A COMPLETION FLAG COULD NOT LIVE ON lesson_practice_attempts EVEN IF WE
-- WANTED IT THERE: 0065's refuse_practice_mutation() raises restrict_violation
-- on EVERY UPDATE to that table, including through the erasure GUC door. A
-- flag written there could never be corrected.
-- ============================================================================

-- ══ SECTION 1 — lesson_section_state (the six-section rollup) ═══════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_section_state (
  user_id       uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  lesson_id     uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  -- ⚠ A KEY WITH A CHECK, NOT SIX COLUMNS. A seventh section is then a CHECK
  -- amendment; six columns would be a grant re-issue every time (see header).
  section_key   text NOT NULL,
  status        text NOT NULL DEFAULT 'not_started',
  -- How it completed: the student said so, or the app observed the evidence.
  -- Kept because "auto" and "manual" are different claims and the UI says which.
  source        text,
  first_seen_at timestamptz,
  completed_at  timestamptz,
  -- ⚠ A POINTER, NEVER THE PAYLOAD. {"attempt_id": "…"} or {"slides": 25} —
  -- not marks, not answers, not anything the evidence tables already own.
  evidence_ref  jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lesson_section_state_pk PRIMARY KEY (user_id, lesson_id, section_key),
  CONSTRAINT lesson_section_state_key_check CHECK (
    section_key IN ('video','slides','notes','worked_examples','practice','exam_questions')
  ),
  CONSTRAINT lesson_section_state_status_check CHECK (
    status IN ('not_started','in_progress','complete')
  ),
  CONSTRAINT lesson_section_state_source_check CHECK (
    source IS NULL OR source IN ('manual','auto')
  ),
  -- A complete row without a timestamp is a lie the table can refuse to hold.
  CONSTRAINT lesson_section_state_complete_has_time CHECK (
    status <> 'complete' OR completed_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS lesson_section_state_lesson_idx
  ON public.lesson_section_state (lesson_id);

-- Reuses 0001's function — a second copy would drift from the first.
DROP TRIGGER IF EXISTS touch_lesson_section_state ON public.lesson_section_state;
CREATE TRIGGER touch_lesson_section_state
  BEFORE UPDATE ON public.lesson_section_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.lesson_section_state ENABLE ROW LEVEL SECURITY;

-- ⚠ THE PREDICATE GOES IN BOTH USING AND WITH CHECK. USING alone filters what
-- a student may SEE; without WITH CHECK they may still WRITE a row carrying
-- somebody else's user_id. 0064's policies carry both for this reason.
CREATE POLICY lss_own_read ON public.lesson_section_state
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY lss_own_insert ON public.lesson_section_state
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY lss_own_update ON public.lesson_section_state
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ⚠ STAFF CAN READ, BECAUSE A TEACHER WHO CANNOT SEE PROGRESS CANNOT TEACH.
-- lesson_view_state (0064) has no staff policy and that is why no staff view
-- of deck progress is possible today; 0065's lpa_staff_read is the precedent
-- being followed here rather than the omission.
CREATE POLICY lss_staff_read ON public.lesson_section_state
  FOR SELECT TO authenticated USING (public.is_staff());

-- ⚠ COLUMN-SCOPED, AND THE KEY COLUMNS ARE ABSENT FROM UPDATE ON PURPOSE.
-- That is also why the application writes UPDATE-then-INSERT and never
-- .upsert(): PostgREST compiles upsert to ON CONFLICT DO UPDATE SET including
-- the key columns, which this grant refuses. 0064's header records the same
-- trap after it bit once.
GRANT SELECT ON public.lesson_section_state TO authenticated;
GRANT INSERT (user_id, lesson_id, section_key, status, source, first_seen_at, completed_at, evidence_ref)
  ON public.lesson_section_state TO authenticated;
GRANT UPDATE (status, source, completed_at, evidence_ref)
  ON public.lesson_section_state TO authenticated;

-- ⚠ NO DELETE, DELIBERATELY. There is no "reset my progress" control in the
-- product, and 0021 revoked DELETE on `progress` for exactly this reason. If a
-- restart-lesson feature is ever wanted it gets its own migration and its own
-- decision — not an accidental grant made today.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_section_state FROM anon, authenticated;

COMMIT;

-- ══ SECTION 2 — lesson_notes ═══════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  uuid NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  body_md    text NOT NULL,
  status     text NOT NULL DEFAULT 'draft',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_notes_status_check CHECK (status IN ('draft','published','unavailable'))
);

DROP TRIGGER IF EXISTS touch_lesson_notes ON public.lesson_notes;
CREATE TRIGGER touch_lesson_notes
  BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

-- ⚠ NO CLIENT GRANTS AT ALL — same stance as lesson_decks and
-- lesson_family_status (0064). Notes are teaching material: the admin client
-- writes them, the server reads them and renders them. A student's browser
-- never needs a row from this table, so it never gets the privilege to ask.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_notes FROM anon, authenticated;

COMMIT;

-- ══ SECTION 3 — lesson_worked_examples ═════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_worked_examples (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  sort_order   integer NOT NULL DEFAULT 0,
  title        text NOT NULL DEFAULT '',
  prompt       text NOT NULL,
  -- ⚠ ORDERED STEPS AS jsonb, VALIDATED IN SHAPE HERE AND IN THE READER.
  -- [{"label":"identify the data","body":"…"}, …] — the reveal order IS the
  -- teaching, so it is stored as a sequence, not as free text with headings.
  steps        jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer       text NOT NULL,
  marks        integer,
  spec_code    text,
  review_slide integer,
  status       text NOT NULL DEFAULT 'draft',
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lwe_status_check CHECK (status IN ('draft','published','unavailable')),
  CONSTRAINT lwe_steps_is_array CHECK (jsonb_typeof(steps) = 'array'),
  CONSTRAINT lwe_marks_sane CHECK (marks IS NULL OR marks BETWEEN 0 AND 30)
);

CREATE INDEX IF NOT EXISTS lesson_worked_examples_lesson_idx
  ON public.lesson_worked_examples (lesson_id, sort_order);

DROP TRIGGER IF EXISTS touch_lesson_worked_examples ON public.lesson_worked_examples;
CREATE TRIGGER touch_lesson_worked_examples
  BEFORE UPDATE ON public.lesson_worked_examples
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.lesson_worked_examples ENABLE ROW LEVEL SECURITY;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_worked_examples FROM anon, authenticated;

COMMIT;

-- ══ SECTION 4 — lesson_paper_questions (the lesson ↔ exam question map) ═════
BEGIN;

-- ⚠ A MAP, NOT A QUESTION STORE (§19). The questions stay in paper_questions,
-- where the reviewed marking path already reads them. What is missing is only
-- the link from a lesson to the subset that assesses it.
--
-- ⚠ THE ALTERNATIVE WAS CONSIDERED AND REJECTED FOR A REASON WORTH RECORDING:
-- lesson_spec_points.spec_point_id → spec_points.code could be joined against
-- question_spec_points.spec_code (0035) with no new table at all. Both halves
-- exist. But question_spec_points has ZERO rows, zero readers and zero writers
-- across the whole repository, both codes are free text with no FK and no
-- verified format agreement, and the generated Unit 1 fixture carries 48
-- questions and not one spec point. That route costs no migration and all of
-- the authoring work, on an untested join. An explicit, curatable link table
-- is the honest cost.
CREATE TABLE IF NOT EXISTS public.lesson_paper_questions (
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id)         ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_paper_questions_pk PRIMARY KEY (lesson_id, question_id)
);

CREATE INDEX IF NOT EXISTS lesson_paper_questions_lesson_idx
  ON public.lesson_paper_questions (lesson_id, sort_order);

ALTER TABLE public.lesson_paper_questions ENABLE ROW LEVEL SECURITY;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_paper_questions FROM anon, authenticated;

COMMIT;

-- ══ SECTION 5 — ⚠ ERASURE IS PART OF THE MIGRATION, NOT A FOLLOW-UP ════════
-- erase_user v5 (0067) does not know these tables exist. Applying sections 1–4
-- without extending it means an erasure silently leaves a student's completion
-- rows behind AND the receipt says nothing — and the SR check passes, because
-- it counts what the function reports. A false negative on an erasure is the
-- worst kind of green.
--
-- v6 = v5 plus, beside the existing counted deletes:
--
--     DELETE FROM public.lesson_section_state WHERE user_id = target;
--     GET DIAGNOSTICS section_state_removed = ROW_COUNT;
--
-- and 'section_state_removed' added to the returned jsonb. lesson_notes,
-- lesson_worked_examples and lesson_paper_questions hold NO student data —
-- their only user reference is created_by/updated_by, already ON DELETE SET
-- NULL — so they need no delete, only the confirmation that this was checked
-- rather than forgotten.
--
-- The GATE stays: email_columns_scanned must still read 8. None of these
-- tables adds an email column, so a 9 would mean something else changed.

-- ══ VERIFICATION (run after applying; every line should return zero rows) ═══
-- 1. The three privileges no client may hold, on all four new tables:
-- SELECT table_name, grantee, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE table_schema = 'public'
--    AND table_name IN ('lesson_section_state','lesson_notes',
--                       'lesson_worked_examples','lesson_paper_questions')
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
--
-- 2. RLS is on for all four:
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('lesson_section_state','lesson_notes',
--                    'lesson_worked_examples','lesson_paper_questions');
--
-- 3. The three content tables have NO client grants at all:
-- SELECT table_name, grantee, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE table_schema = 'public'
--    AND table_name IN ('lesson_notes','lesson_worked_examples','lesson_paper_questions')
--    AND grantee IN ('anon','authenticated');
--
-- 4. ⚠ THE UPSERT TRAP, PROVEN RATHER THAN ASSUMED. From an authenticated
--    session (not the SQL editor's postgres role, which bypasses all of this):
--    an UPDATE touching section_key must be REFUSED 42501, while
--    UPDATE-then-INSERT succeeds. If that refusal does NOT fire, the grants
--    are wider than this file intends and the application's write shape is
--    resting on nothing.
