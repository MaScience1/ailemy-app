-- ============================================================================
-- 0028_interactive_exam_phase1.sql
-- ----------------------------------------------------------------------------
-- Phase 1 of the interactive examination system: the question object model,
-- its mark scheme, and student attempts against it.
--
-- ⚠ APPLIED 2026-08-08. DO NOT RE-RUN AGAINST PRODUCTION — this file now exists
-- so a rebuild from migrations matches what is already live. Every statement is
-- guarded (IF NOT EXISTS, DROP POLICY before CREATE), so re-running is harmless,
-- but there is nothing here left to apply. Verified live: all nine tables
-- respond, including question_regions.rotation_applied — which confirms the
-- corrected coordinate-space version is the one that ran, not the earlier draft.
--
-- DEPENDS ON 0027. Every policy below calls public.has_role() or
-- public.is_staff(). 0027 is applied in production (user_roles exists, one
-- admin row seeded), and section 0 aborts if that is ever not true rather than
-- creating nine tables whose policies reference a function that does not exist.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS ADDS — nine tables, in two groups
-- ---------------------------------------------------------------------------
-- AUTHORED CONTENT (staff writes, mostly staff reads)
--   paper_questions           the question tree for a paper
--   question_regions          where each question sits on the PDF
--   mark_scheme_items         the marking points   — NEVER student-readable
--   examiner_report_insights  examiner commentary  — NEVER student-readable
--   model_answers             worked answers       — NEVER student-readable
--
-- STUDENT WORK (student writes their own, staff reads)
--   exam_attempts             one sitting of one paper
--   question_attempts         one question within a sitting
--   student_responses         what the student actually entered
--   marking_results           per mark-point outcome — service role writes only
--
-- IT DOES NOT TOUCH any existing table, policy, grant, function or type.
-- past_papers, profiles, student_courses, user_roles and everything else are
-- read-only inputs here; the only reference to them is by foreign key.
--
-- ---------------------------------------------------------------------------
-- IDENTITY: paper_id UUID, NEVER slug
-- ---------------------------------------------------------------------------
-- past_papers is UNIQUE (course_id, slug), not on slug alone. 233 rows across
-- three subjects share 71 slugs — "unit-1-january-2019" exists three times.
-- Every FK here targets past_papers.id. Slugs are routing and presentation
-- only and appear nowhere in this file.
--
-- ---------------------------------------------------------------------------
-- COORDINATE SPACE — pdf.js VIEWPORT SPACE, TOP-LEFT ORIGIN, Y DOWNWARD
-- ---------------------------------------------------------------------------
-- question_regions.bbox_* are in the space produced by
--
--     pdfPage.getViewport({ scale: 1 })
--
-- which is TOP-LEFT origin with y INCREASING DOWNWARD. This is the space
-- PaperViewer already computes its scale factor against:
--
--     const unscaled = pdfPage.getViewport({ scale: 1 });
--     const scale    = width / unscaled.width;
--
-- ⚠ THIS IS NOT RAW PDF USER SPACE. A PDF's own coordinates have a
-- BOTTOM-LEFT origin with y increasing UPWARD. The two differ by
--
--     y_viewport = pageHeight − y_pdf
--
-- so storing one and reading it as the other mirrors every overlay vertically
-- about the page's horizontal centre-line — a fault that looks plausible on a
-- symmetric page and obviously wrong on an asymmetric one, which is the worst
-- way for it to fail. "Unscaled points" alone does not disambiguate them; the
-- viewport space named above is the one stored, and both the web viewer and
-- the mobile viewer consume it directly with no flip.
--
-- ⚠ getViewport ALSO APPLIES /Rotate. For a page with /Rotate 90 the viewport
-- returns width and height SWAPPED relative to the CropBox, and the origin sits
-- at the visual top-left of the ROTATED page. Mark-scheme PDFs in this archive
-- carry /Rotate 90 on most of their pages — 34 of 38 on a typical one — so this
-- is the common case, not an edge case. question_regions.rotation_applied
-- records the page's /Rotate at capture time so a consumer can detect a
-- mismatch if a paper is ever re-uploaded with different rotation, rather than
-- silently drawing boxes at 90 degrees to the content.
--
-- Storing points rather than pixels makes a region independent of viewport
-- width, zoom and devicePixelRatio: the viewer multiplies by `scale` and is
-- done. numeric, not float8 — these are authored/approved values that must
-- compare and round-trip exactly.
--
-- ---------------------------------------------------------------------------
-- EXTRACTOR-READY FROM DAY ONE
-- ---------------------------------------------------------------------------
-- question_regions carries confidence / approved_by / approved_at so the same
-- table serves a hand-drawn region today and a machine-proposed one later. A
-- row with approved_at IS NULL is a PROPOSAL, not a fact; the manual editor
-- built now is the approval surface for future extraction. Nothing in this
-- schema distinguishes "drawn by a human" from "accepted by a human" — that is
-- deliberate, because the second is the property that matters.
--
-- ---------------------------------------------------------------------------
-- THE MARK-SCHEME BOUNDARY — the single most important property here
-- ---------------------------------------------------------------------------
-- mark_scheme_items, model_answers and examiner_report_insights have NO policy
-- admitting a student, and NO grant to anon. A student cannot read them
-- through PostgREST under any circumstance, including their own attempt, and
-- including after submission. Post-submission disclosure happens server-side
-- through the service role, which is a deliberate choice: it keeps the
-- release decision in application code where "has this attempt been submitted"
-- is knowable, instead of encoding it as a policy that would have to join
-- through three tables and would fail open if any of them changed shape.
--
-- Students DO read paper_questions and question_regions — they cannot answer a
-- question they cannot see.
--
-- ---------------------------------------------------------------------------
-- RLS SUBQUERIES AND THE 0013 TRAP
-- ---------------------------------------------------------------------------
-- Several policies below test ownership by walking student_responses ->
-- question_attempts -> exam_attempts. A policy body that queries another table
-- is evaluated as the CALLING role, and a role that cannot SELECT the
-- referenced table raises a permission error rather than returning false —
-- that is what took down anonymous storage reads until 0013.
--
-- Two consequences, both applied throughout:
--   * every policy whose body queries another table is scoped TO authenticated
--   * authenticated holds SELECT on every table those bodies touch
-- anon is named in no policy and holds no grant on any of these nine tables.
--
-- No recursion: the walk is strictly one-directional
-- (student_responses -> question_attempts -> exam_attempts), and no policy on
-- exam_attempts or question_attempts refers back down the chain.
--
-- ---------------------------------------------------------------------------
-- GRANTS — stated explicitly per table in section 12
-- ---------------------------------------------------------------------------
-- Every table gets an explicit REVOKE TRUNCATE, TRIGGER, REFERENCES from anon
-- and authenticated. Supabase's default privileges hand those to both roles on
-- every table created in public, so NOT granting them is not the same as not
-- having them. 0019 swept them off a snapshot of pg_tables and cannot reach a
-- table that did not exist yet; announcements proved that in 0022 and had to be
-- repaired by hand in 0025. Nine new tables, nine revokes.
--
-- TRUNCATE matters most on exam_attempts and marking_results: it is not
-- filtered by RLS, so no policy protects against it, and it would erase every
-- student's exam history in one statement.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT ENFORCED HERE
-- ---------------------------------------------------------------------------
--   * awarded_marks <= max_marks on question_attempts. A CHECK would be easy,
--     but the sum that actually matters — SUM(awarded) over marking_results
--     equalling question_attempts.awarded_marks — cannot be expressed as a row
--     constraint. Putting half the invariant in the database invites the
--     belief that the whole of it is there. It belongs in the marking layer,
--     as a single check that owns the whole rule. marking_results.awarded is
--     boolean precisely so no individual mark point can over-award.
--   * One attempt per student per paper. exam_attempts deliberately has NO
--     unique constraint on (student_id, paper_id): resits, practice runs and a
--     second attempt after a timeout are all legitimate. question_attempts IS
--     unique on (exam_attempt_id, question_id) — within one sitting a question
--     is answered once.
--   * Whether a question's marks equal the sum of its mark_scheme_items.
--     Authoring-time validation, not a database constraint.
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. PRE-FLIGHT — 0027 must be applied, or every policy here is dead on arrival
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.has_role(public.app_role)') IS NULL THEN
    RAISE EXCEPTION
      'ABORTING: public.has_role(app_role) does not exist. Apply 0027_role_infrastructure.sql first. No changes made.';
  END IF;
  IF to_regprocedure('public.is_staff()') IS NULL THEN
    RAISE EXCEPTION
      'ABORTING: public.is_staff() does not exist. Apply 0027 first. No changes made.';
  END IF;
  IF to_regclass('public.past_papers') IS NULL THEN
    RAISE EXCEPTION 'ABORTING: public.past_papers does not exist.';
  END IF;
END $$;


-- ============================================================================
-- GROUP A — AUTHORED CONTENT
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. paper_questions — the question tree
-- ----------------------------------------------------------------------------
-- parent_question_id is a self-FK so "3(b)(ii)" hangs off "3(b)" hangs off "3".
-- ON DELETE CASCADE: deleting a parent removes its sub-questions, which is the
-- only sane reading — an orphaned "(ii)" means nothing.
--
-- question_number is the DISPLAY label and is not sortable ("10" < "9" as
-- text). display_order is the sort key and is the caller's responsibility to
-- assign; it is unique per paper so two questions cannot occupy one position.
--
-- answer_type drives which response editor the client renders and which marker
-- runs. text + CHECK rather than an enum, matching cohort_enrolments.status
-- (0009) and past_papers.session: adding a type later is a CHECK swap inside
-- one migration rather than ALTER TYPE with its transaction restrictions.
CREATE TABLE IF NOT EXISTS public.paper_questions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id            uuid NOT NULL REFERENCES public.past_papers(id) ON DELETE CASCADE,
  parent_question_id  uuid REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  question_number     text NOT NULL,
  display_order       integer NOT NULL,
  marks               integer NOT NULL DEFAULT 0,
  answer_type         text NOT NULL DEFAULT 'other',
  command_word        text,
  topic               text,
  spec_point          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paper_questions_marks_nonneg CHECK (marks >= 0),
  CONSTRAINT paper_questions_not_own_parent CHECK (parent_question_id IS NULL OR parent_question_id <> id),
  CONSTRAINT paper_questions_answer_type_check CHECK (answer_type IN (
    'mcq', 'short_text', 'long_text', 'numeric', 'numeric_with_unit',
    'chemical_equation', 'structure', 'mechanism', 'graph', 'apparatus',
    'freehand', 'other'
  )),
  UNIQUE (paper_id, question_number),
  UNIQUE (paper_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_paper_questions_paper   ON public.paper_questions(paper_id, display_order);
CREATE INDEX IF NOT EXISTS idx_paper_questions_parent  ON public.paper_questions(parent_question_id);

COMMENT ON COLUMN public.paper_questions.question_number IS
  'Display label as printed, e.g. "3(b)(ii)". NOT sortable — use display_order.';
COMMENT ON COLUMN public.paper_questions.answer_type IS
  'Which response editor and marker apply. Must match student_responses.response_type.';

-- ----------------------------------------------------------------------------
-- 2. question_regions — where the question sits on the page
-- ----------------------------------------------------------------------------
-- One question may span several regions (a stem on page 3 continuing onto
-- page 4, or a diagram set apart from its text), so this is deliberately
-- one-to-many and carries no unique constraint on question_id.
--
-- bbox is in pdf.js getViewport({scale:1}) SPACE — top-left origin, y
-- downward, /Rotate already applied. NOT raw PDF user space, which is
-- bottom-left origin with y upward; see the header for why conflating them
-- mirrors every overlay. page_number is 1-based to match pdf.js's getPage(n)
-- and every human reference to "page 4".
--
-- rotation_applied is the page's /Rotate at the moment the bbox was captured.
-- It is NOT used to transform anything on read — the stored bbox is already in
-- the rotated viewport space and needs no correction. It exists so a consumer
-- can ASSERT that the page it is about to draw on still has the rotation the
-- region was authored against, and refuse rather than draw sideways if a paper
-- has been re-uploaded with different rotation.
CREATE TABLE IF NOT EXISTS public.question_regions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id       uuid NOT NULL REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  page_number       integer NOT NULL,
  bbox_x            numeric NOT NULL,
  bbox_y            numeric NOT NULL,
  bbox_width        numeric NOT NULL,
  bbox_height       numeric NOT NULL,
  rotation_applied  integer NOT NULL DEFAULT 0,
  confidence        numeric,
  approved_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_regions_page_positive CHECK (page_number >= 1),
  CONSTRAINT question_regions_size_positive CHECK (bbox_width > 0 AND bbox_height > 0),
  CONSTRAINT question_regions_rotation_check CHECK (rotation_applied IN (0, 90, 180, 270)),
  CONSTRAINT question_regions_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  -- Approval is one fact, recorded atomically or not at all: a row with a
  -- timestamp but no approver, or the reverse, is not interpretable.
  CONSTRAINT question_regions_approval_paired CHECK (
    (approved_by IS NULL AND approved_at IS NULL) OR
    (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_question_regions_question ON public.question_regions(question_id);
CREATE INDEX IF NOT EXISTS idx_question_regions_page     ON public.question_regions(question_id, page_number);
-- Partial index: "what is still awaiting approval" is the extractor review
-- queue's only query, and it will be small relative to the table.
CREATE INDEX IF NOT EXISTS idx_question_regions_unapproved
  ON public.question_regions(question_id) WHERE approved_at IS NULL;

COMMENT ON TABLE public.question_regions IS
  'Where a question appears on the paper PDF. COORDINATES: pdf.js getViewport({scale:1}) space — TOP-LEFT origin, y increasing DOWNWARD, /Rotate already applied. NOT raw PDF user space (bottom-left origin, y up); the two differ by y_viewport = pageHeight - y_pdf and conflating them mirrors every overlay vertically. rotation_applied records the page /Rotate at capture time. Extractor-ready: confidence is set by a machine proposal, approved_by/approved_at by a human. approved_at IS NULL means PROPOSED, not accepted.';
COMMENT ON COLUMN public.question_regions.bbox_x IS
  'pdf.js getViewport({scale:1}) space: top-left origin, y downward, /Rotate applied. The same space PaperViewer computes its scale factor against — multiply by scale for CSS pixels. NOT raw PDF user space.';
COMMENT ON COLUMN public.question_regions.bbox_y IS
  'Distance DOWNWARD from the top edge of the rotated page, in viewport points. In raw PDF user space this value would be measured upward from the bottom — do not mix the two.';
COMMENT ON COLUMN public.question_regions.rotation_applied IS
  'The page /Rotate value (0/90/180/270) in force when this bbox was captured. Not applied on read — the bbox is already in rotated viewport space. Present so a consumer can assert the page still matches and refuse rather than draw sideways.';

-- ----------------------------------------------------------------------------
-- 3. mark_scheme_items — the marking points.  NEVER STUDENT-READABLE.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mark_scheme_items (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id            uuid NOT NULL REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  point_code             text NOT NULL,
  criterion              text NOT NULL,
  accepted_alternatives  text[],
  display_order          integer NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, point_code)
);

CREATE INDEX IF NOT EXISTS idx_mark_scheme_items_question ON public.mark_scheme_items(question_id, display_order);

COMMENT ON COLUMN public.mark_scheme_items.point_code IS
  'Mark-scheme point label as printed, e.g. "M1", "A1". marking_results.point_code refers to this by value within the same question.';

-- ----------------------------------------------------------------------------
-- 4. examiner_report_insights — examiner commentary.  NEVER STUDENT-READABLE.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.examiner_report_insights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   uuid NOT NULL REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  insight_text  text NOT NULL,
  insight_type  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT examiner_report_insights_type_check CHECK (
    insight_type IS NULL OR insight_type IN ('common_error', 'strong_candidates', 'warning')
  )
);

CREATE INDEX IF NOT EXISTS idx_examiner_insights_question ON public.examiner_report_insights(question_id);

-- ----------------------------------------------------------------------------
-- 5. model_answers — worked answers.  NEVER STUDENT-READABLE.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid NOT NULL REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  answer_text  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_answers_question ON public.model_answers(question_id);


-- ============================================================================
-- GROUP B — STUDENT WORK
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6. exam_attempts — one sitting of one paper
-- ----------------------------------------------------------------------------
-- student_id references auth.users, not profiles: authorization and ownership
-- must not depend on a public-schema row a user can currently UPDATE (0018).
--
-- NO unique constraint on (student_id, paper_id) — see the header. Resits and
-- repeated practice runs are expected.
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id          uuid NOT NULL REFERENCES public.past_papers(id) ON DELETE CASCADE,
  mode              text NOT NULL DEFAULT 'practice',
  started_at        timestamptz NOT NULL DEFAULT now(),
  submitted_at      timestamptz,
  duration_seconds  integer,
  total_awarded     integer,
  total_available   integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_attempts_mode_check CHECK (mode IN ('exam', 'practice')),
  CONSTRAINT exam_attempts_duration_nonneg CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT exam_attempts_totals_nonneg CHECK (
    (total_awarded IS NULL OR total_awarded >= 0) AND
    (total_available IS NULL OR total_available >= 0)
  ),
  CONSTRAINT exam_attempts_submitted_after_start CHECK (submitted_at IS NULL OR submitted_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_student ON public.exam_attempts(student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_paper   ON public.exam_attempts(paper_id);

COMMENT ON COLUMN public.exam_attempts.submitted_at IS
  'NULL while in progress. The application treats this as the gate for releasing mark schemes and model answers — that release happens server-side via the service role, never through a policy on this table.';

-- ----------------------------------------------------------------------------
-- 7. question_attempts — one question within a sitting
-- ----------------------------------------------------------------------------
-- max_marks is snapshotted from paper_questions.marks at attempt time rather
-- than joined at read time: a question re-scored by an author later must not
-- retroactively change what a student was marked out of.
CREATE TABLE IF NOT EXISTS public.question_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_attempt_id  uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id      uuid NOT NULL REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  awarded_marks    integer,
  max_marks        integer NOT NULL,
  confidence       text,
  flagged          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_attempts_max_nonneg CHECK (max_marks >= 0),
  CONSTRAINT question_attempts_awarded_nonneg CHECK (awarded_marks IS NULL OR awarded_marks >= 0),
  CONSTRAINT question_attempts_confidence_check CHECK (
    confidence IS NULL OR confidence IN ('deterministic', 'high', 'medium', 'low', 'requires_review')
  ),
  UNIQUE (exam_attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_attempts_attempt  ON public.question_attempts(exam_attempt_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_question ON public.question_attempts(question_id);
-- The marker review queue.
CREATE INDEX IF NOT EXISTS idx_question_attempts_flagged
  ON public.question_attempts(exam_attempt_id) WHERE flagged;

COMMENT ON COLUMN public.question_attempts.awarded_marks IS
  'NULL until marked. awarded_marks <= max_marks is enforced in the marking layer, NOT here — see the header for why half an invariant is worse than none.';

-- ----------------------------------------------------------------------------
-- 8. student_responses — what the student actually entered
-- ----------------------------------------------------------------------------
-- response_payload is jsonb because the shape genuinely differs per
-- answer_type: {"text": "..."} for prose, {"choice": "B"} for mcq,
-- {"value": 2.4, "unit": "mol dm-3"} for numeric_with_unit, a stroke list for
-- mechanism or graph. Nine columns of which eight are always NULL would be
-- worse. Validation of the payload against response_type belongs in the
-- application, which knows the editor that produced it.
--
-- Not unique on question_attempt_id: a revision history is expected, and
-- "latest" is created_at DESC. If one-response-per-attempt is ever wanted,
-- add the constraint then rather than losing the history now.
CREATE TABLE IF NOT EXISTS public.student_responses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_attempt_id uuid NOT NULL REFERENCES public.question_attempts(id) ON DELETE CASCADE,
  response_type       text NOT NULL,
  response_payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_responses_type_check CHECK (response_type IN (
    'mcq', 'short_text', 'long_text', 'numeric', 'numeric_with_unit',
    'chemical_equation', 'structure', 'mechanism', 'graph', 'apparatus',
    'freehand', 'other'
  ))
);

CREATE INDEX IF NOT EXISTS idx_student_responses_attempt
  ON public.student_responses(question_attempt_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 9. marking_results — per mark-point outcome.  SERVICE ROLE WRITES ONLY.
-- ----------------------------------------------------------------------------
-- point_code refers to mark_scheme_items.point_code BY VALUE, not by FK. A
-- deliberate choice: the mark scheme is authored content that may be corrected
-- after a student has been marked, and a hard FK would either block that
-- correction or cascade it into historical results. The result is a record of
-- a judgement made against the scheme as it stood.
--
-- awarded is boolean, so a single mark point cannot award more than one mark
-- and over-award is structurally impossible at this level.
CREATE TABLE IF NOT EXISTS public.marking_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_attempt_id uuid NOT NULL REFERENCES public.question_attempts(id) ON DELETE CASCADE,
  point_code          text NOT NULL,
  awarded             boolean NOT NULL,
  evidence            text,
  explanation         text,
  model_version       text,
  prompt_version      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_attempt_id, point_code)
);

CREATE INDEX IF NOT EXISTS idx_marking_results_attempt ON public.marking_results(question_attempt_id);

COMMENT ON TABLE public.marking_results IS
  'One row per mark-scheme point per question attempt. Written by the marking layer through the service role only — authenticated holds SELECT and nothing else.';
COMMENT ON COLUMN public.marking_results.model_version IS
  'For AI-marked audit: which model and prompt produced this judgement. NULL for human marking.';


-- ============================================================================
-- 10. TRIGGERS — updated_at
-- ============================================================================
-- Reuses public.touch_updated_at() from 0001. Only tables carrying updated_at.
DROP TRIGGER IF EXISTS touch_paper_questions ON public.paper_questions;
CREATE TRIGGER touch_paper_questions BEFORE UPDATE ON public.paper_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_exam_attempts ON public.exam_attempts;
CREATE TRIGGER touch_exam_attempts BEFORE UPDATE ON public.exam_attempts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_question_attempts ON public.question_attempts;
CREATE TRIGGER touch_question_attempts BEFORE UPDATE ON public.question_attempts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_student_responses ON public.student_responses;
CREATE TRIGGER touch_student_responses BEFORE UPDATE ON public.student_responses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ============================================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.paper_questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_regions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mark_scheme_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examiner_report_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_answers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_attempts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_responses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marking_results          ENABLE ROW LEVEL SECURITY;

-- --- 11a. paper_questions — students read live papers, staff write ----------
-- The live-paper condition is an ADDITION to the brief, and deliberate:
-- past_papers is public-read only WHERE status = 'live' (0007), so without it
-- a student could enumerate the questions of a draft or archived paper through
-- this table. The subquery reads past_papers, whose own policy does not
-- reference paper_questions — no cycle. Scoped TO authenticated per 0013.
DROP POLICY IF EXISTS paper_questions_read ON public.paper_questions;
CREATE POLICY paper_questions_read
  ON public.paper_questions FOR SELECT TO authenticated
  USING (
    public.has_role('teacher') OR public.has_role('marker') OR public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.past_papers p
       WHERE p.id = paper_id AND p.status = 'live'
    )
  );

DROP POLICY IF EXISTS paper_questions_write ON public.paper_questions;
CREATE POLICY paper_questions_write
  ON public.paper_questions FOR ALL TO authenticated
  USING      (public.has_role('marker') OR public.has_role('admin'))
  WITH CHECK (public.has_role('marker') OR public.has_role('admin'));

-- --- 11b. question_regions — same visibility as their question --------------
DROP POLICY IF EXISTS question_regions_read ON public.question_regions;
CREATE POLICY question_regions_read
  ON public.question_regions FOR SELECT TO authenticated
  USING (
    public.has_role('teacher') OR public.has_role('marker') OR public.has_role('admin')
    OR EXISTS (
      SELECT 1
        FROM public.paper_questions q
        JOIN public.past_papers p ON p.id = q.paper_id
       WHERE q.id = question_id AND p.status = 'live'
    )
  );

DROP POLICY IF EXISTS question_regions_write ON public.question_regions;
CREATE POLICY question_regions_write
  ON public.question_regions FOR ALL TO authenticated
  USING      (public.has_role('marker') OR public.has_role('admin'))
  WITH CHECK (public.has_role('marker') OR public.has_role('admin'));

-- --- 11c/d/e. mark schemes, insights, model answers — STAFF ONLY ------------
-- No student arm anywhere. A student's SELECT matches no policy and returns
-- zero rows; there is no path, submitted or otherwise, to reading these
-- through PostgREST.
DROP POLICY IF EXISTS mark_scheme_items_read ON public.mark_scheme_items;
CREATE POLICY mark_scheme_items_read
  ON public.mark_scheme_items FOR SELECT TO authenticated
  USING (public.has_role('teacher') OR public.has_role('marker') OR public.has_role('admin'));

DROP POLICY IF EXISTS mark_scheme_items_write ON public.mark_scheme_items;
CREATE POLICY mark_scheme_items_write
  ON public.mark_scheme_items FOR ALL TO authenticated
  USING      (public.has_role('marker') OR public.has_role('admin'))
  WITH CHECK (public.has_role('marker') OR public.has_role('admin'));

DROP POLICY IF EXISTS examiner_report_insights_read ON public.examiner_report_insights;
CREATE POLICY examiner_report_insights_read
  ON public.examiner_report_insights FOR SELECT TO authenticated
  USING (public.has_role('teacher') OR public.has_role('marker') OR public.has_role('admin'));

DROP POLICY IF EXISTS examiner_report_insights_write ON public.examiner_report_insights;
CREATE POLICY examiner_report_insights_write
  ON public.examiner_report_insights FOR ALL TO authenticated
  USING      (public.has_role('marker') OR public.has_role('admin'))
  WITH CHECK (public.has_role('marker') OR public.has_role('admin'));

DROP POLICY IF EXISTS model_answers_read ON public.model_answers;
CREATE POLICY model_answers_read
  ON public.model_answers FOR SELECT TO authenticated
  USING (public.has_role('teacher') OR public.has_role('marker') OR public.has_role('admin'));

DROP POLICY IF EXISTS model_answers_write ON public.model_answers;
CREATE POLICY model_answers_write
  ON public.model_answers FOR ALL TO authenticated
  USING      (public.has_role('marker') OR public.has_role('admin'))
  WITH CHECK (public.has_role('marker') OR public.has_role('admin'));

-- --- 11f. exam_attempts — owner reads/writes, staff read --------------------
-- Separate policies per verb rather than FOR ALL, because DELETE must be
-- absent: an outcome table records something that happened (0021).
DROP POLICY IF EXISTS exam_attempts_select ON public.exam_attempts;
CREATE POLICY exam_attempts_select
  ON public.exam_attempts FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS exam_attempts_insert ON public.exam_attempts;
CREATE POLICY exam_attempts_insert
  ON public.exam_attempts FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS exam_attempts_update ON public.exam_attempts;
CREATE POLICY exam_attempts_update
  ON public.exam_attempts FOR UPDATE TO authenticated
  USING      (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
-- WITH CHECK repeats USING so a student cannot reassign their attempt to
-- another student_id on the way out.

-- --- 11g. question_attempts — ownership one hop up --------------------------
DROP POLICY IF EXISTS question_attempts_select ON public.question_attempts;
CREATE POLICY question_attempts_select
  ON public.question_attempts FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.exam_attempts ea
       WHERE ea.id = exam_attempt_id AND ea.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS question_attempts_insert ON public.question_attempts;
CREATE POLICY question_attempts_insert
  ON public.question_attempts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_attempts ea
       WHERE ea.id = exam_attempt_id AND ea.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS question_attempts_update ON public.question_attempts;
CREATE POLICY question_attempts_update
  ON public.question_attempts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts ea
       WHERE ea.id = exam_attempt_id AND ea.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_attempts ea
       WHERE ea.id = exam_attempt_id AND ea.student_id = auth.uid()
    )
  );

-- --- 11h. student_responses — ownership two hops up -------------------------
DROP POLICY IF EXISTS student_responses_select ON public.student_responses;
CREATE POLICY student_responses_select
  ON public.student_responses FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1
        FROM public.question_attempts qa
        JOIN public.exam_attempts ea ON ea.id = qa.exam_attempt_id
       WHERE qa.id = question_attempt_id AND ea.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS student_responses_insert ON public.student_responses;
CREATE POLICY student_responses_insert
  ON public.student_responses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.question_attempts qa
        JOIN public.exam_attempts ea ON ea.id = qa.exam_attempt_id
       WHERE qa.id = question_attempt_id AND ea.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS student_responses_update ON public.student_responses;
CREATE POLICY student_responses_update
  ON public.student_responses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.question_attempts qa
        JOIN public.exam_attempts ea ON ea.id = qa.exam_attempt_id
       WHERE qa.id = question_attempt_id AND ea.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.question_attempts qa
        JOIN public.exam_attempts ea ON ea.id = qa.exam_attempt_id
       WHERE qa.id = question_attempt_id AND ea.student_id = auth.uid()
    )
  );

-- --- 11i. marking_results — read only, for the owner and staff --------------
-- SELECT is the ONLY policy. No INSERT/UPDATE/DELETE policy and no write grant:
-- denied twice over. Marking runs server-side through the service role.
DROP POLICY IF EXISTS marking_results_select ON public.marking_results;
CREATE POLICY marking_results_select
  ON public.marking_results FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1
        FROM public.question_attempts qa
        JOIN public.exam_attempts ea ON ea.id = qa.exam_attempt_id
       WHERE qa.id = question_attempt_id AND ea.student_id = auth.uid()
    )
  );


-- ============================================================================
-- 12. GRANTS
-- ============================================================================
-- What `authenticated` ends up holding, per table. anon is named nowhere and
-- holds nothing on any of these nine tables.
--
--   paper_questions           SELECT, INSERT, UPDATE, DELETE   (writes gated by policy)
--   question_regions          SELECT, INSERT, UPDATE, DELETE   (writes gated by policy)
--   mark_scheme_items         SELECT, INSERT, UPDATE, DELETE   (all gated by policy)
--   examiner_report_insights  SELECT, INSERT, UPDATE, DELETE   (all gated by policy)
--   model_answers             SELECT, INSERT, UPDATE, DELETE   (all gated by policy)
--   exam_attempts             SELECT, INSERT, UPDATE           — no DELETE
--   question_attempts         SELECT, INSERT, UPDATE           — no DELETE
--   student_responses         SELECT, INSERT, UPDATE           — no DELETE
--   marking_results           SELECT                           — nothing else
--
-- The grant is checked BEFORE RLS, so the missing DELETE on the four student
-- tables is the outer of two locks; the missing policy is the inner one.
-- service_role inherits ALL from 0014's ALTER DEFAULT PRIVILEGES, which is why
-- no grant to it appears here.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_questions          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_regions         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mark_scheme_items        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.examiner_report_insights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_answers            TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.exam_attempts     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.question_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.student_responses TO authenticated;

GRANT SELECT ON public.marking_results TO authenticated;

-- ----------------------------------------------------------------------------
-- 12b. THE REVOKE — mandatory for every table created in public
-- ----------------------------------------------------------------------------
-- Supabase's default privileges grant TRUNCATE, TRIGGER and REFERENCES to anon
-- and authenticated on every new table. 0019 swept a snapshot and cannot reach
-- these. None is filtered by RLS.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.paper_questions          FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.question_regions         FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.mark_scheme_items        FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.examiner_report_insights FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.model_answers            FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.exam_attempts            FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.question_attempts        FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.student_responses        FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.marking_results          FROM anon, authenticated;

COMMIT;


-- ============================================================================
-- VERIFICATION — run after applying
-- ============================================================================
-- (a) All nine tables exist with RLS enabled. Expect 9 rows, all rowsecurity = t.
--
--   SELECT relname, relrowsecurity
--     FROM pg_class
--    WHERE relnamespace = 'public'::regnamespace
--      AND relname IN ('paper_questions','question_regions','mark_scheme_items',
--                      'examiner_report_insights','model_answers','exam_attempts',
--                      'question_attempts','student_responses','marking_results')
--    ORDER BY relname;
--
-- (b) THE MARK-SCHEME BOUNDARY. No policy on these three may mention auth.uid()
--     or student ownership. Expect only has_role() predicates.
--
--   SELECT tablename, policyname, cmd, qual
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('mark_scheme_items','model_answers','examiner_report_insights')
--    ORDER BY tablename, policyname;
--
-- (c) THE REVOKE TOOK. Expect ZERO rows.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon','authenticated')
--      AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES')
--    ORDER BY table_name, grantee, privilege_type;
--
-- (d) anon holds nothing on any new table. Expect ZERO rows.
--
--   SELECT table_name, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND grantee = 'anon'
--      AND table_name IN ('paper_questions','question_regions','mark_scheme_items',
--                         'examiner_report_insights','model_answers','exam_attempts',
--                         'question_attempts','student_responses','marking_results');
--
-- (e) No DELETE for authenticated on the four student tables. Expect ZERO rows.
--
--   SELECT table_name, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND grantee = 'authenticated'
--      AND privilege_type = 'DELETE'
--      AND table_name IN ('exam_attempts','question_attempts','student_responses','marking_results');
--
-- (f) marking_results is SELECT-only for authenticated. Expect exactly 1 row.
--
--   SELECT privilege_type FROM information_schema.role_table_grants
--    WHERE table_schema='public' AND table_name='marking_results' AND grantee='authenticated';
--
-- (g) NOTHING ELSE MOVED. Run before and after; the results must be identical.
--
--   SELECT schemaname, tablename, policyname, cmd, qual, with_check
--     FROM pg_policies
--    WHERE schemaname IN ('public','storage')
--      AND tablename NOT IN ('paper_questions','question_regions','mark_scheme_items',
--                            'examiner_report_insights','model_answers','exam_attempts',
--                            'question_attempts','student_responses','marking_results')
--    ORDER BY schemaname, tablename, policyname;
--
-- (h) END TO END, in the app, not the SQL Editor:
--     as a student  — read paper_questions for a live paper      -> rows
--                     read mark_scheme_items                     -> ZERO rows
--                     read model_answers                         -> ZERO rows
--                     insert an exam_attempt with someone else's
--                       student_id                               -> denied
--                     delete an exam_attempt                     -> denied (no grant)
--     as the admin  — read mark_scheme_items                     -> rows
-- ============================================================================


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Additive migration: nothing existing was altered, so nothing needs restoring.
-- Dropping the tables removes their policies, grants, indexes and triggers with
-- them. Order is child-to-parent so no FK blocks a drop; CASCADE is deliberately
-- NOT used, so an unexpected dependant surfaces as an error rather than being
-- silently destroyed.
--
--   BEGIN;
--   DROP TABLE IF EXISTS public.marking_results;
--   DROP TABLE IF EXISTS public.student_responses;
--   DROP TABLE IF EXISTS public.question_attempts;
--   DROP TABLE IF EXISTS public.exam_attempts;
--   DROP TABLE IF EXISTS public.model_answers;
--   DROP TABLE IF EXISTS public.examiner_report_insights;
--   DROP TABLE IF EXISTS public.mark_scheme_items;
--   DROP TABLE IF EXISTS public.question_regions;
--   DROP TABLE IF EXISTS public.paper_questions;
--   COMMIT;
--
-- ⚠ THIS DESTROYS STUDENT WORK. exam_attempts, question_attempts,
-- student_responses and marking_results are outcome tables. Once real attempts
-- exist, rolling back is data loss, not a revert — export first.
-- ============================================================================
