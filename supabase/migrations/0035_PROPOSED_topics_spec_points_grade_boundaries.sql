-- ============================================================================
-- 0035 — question_topics, question_spec_points, grade_boundaries
-- ============================================================================
--
-- ⚠ PROPOSED. NOT APPLIED. The _PROPOSED_ prefix is load-bearing: a rebuild
-- replays this folder in order, so an unapplied file sitting under its plain
-- number manufactures the exact drift that rule exists to prevent. Rename to
-- 0035_topics_spec_points_grade_boundaries.sql only once it is live, and write
-- the verification result into this header at the same time.
--
-- ----------------------------------------------------------------------------
-- WHY JOIN TABLES AND NOT COLUMNS
-- ----------------------------------------------------------------------------
-- paper_questions today carries `topic text` and `spec_point text` — one of
-- each. That was right while a question was filed under one heading, and it is
-- wrong the moment 20(b)(iii) is honestly described: it is a mole calculation
-- AND a stoichiometry question AND an application of Mr, and it maps to several
-- specification statements at once.
--
-- Encoding that in one column forces one of two lies — pick a single topic and
-- lose the rest, or write "moles; stoichiometry" and hope nothing ever tries to
-- filter on it. A revision tool whose whole value is "show me every question on
-- this spec point" cannot be built on a column that holds a comma.
--
-- So: two join tables, one row per (question, thing). The existing columns are
-- LEFT ALONE by this migration — nothing reads the new tables yet, and dropping
-- a populated column in the same migration that creates its replacement is how
-- you end up with neither.
--
-- ----------------------------------------------------------------------------
-- WHY GRADE BOUNDARIES ARE KEYED TO A PAPER ROW
-- ----------------------------------------------------------------------------
-- A boundary set is published per qualification, per unit, per SESSION:
-- WCH11/01 January 2021 and WCH11/01 May 2025 have different boundaries for the
-- same grade. past_papers already carries exactly that tuple — course_id,
-- unit_id, paper_code, session, year — one row per sitting, so paper_id
-- identifies the session and the qualification together and cannot drift from
-- them the way a denormalised copy would.
--
-- ⚠ THE POINT IS TO MAKE "official" UNSAYABLE WHERE IT IS NOT TRUE. A results
-- screen that reports a grade is making a claim about a real examination. It
-- may say "official" only when a row exists for THAT paper_id and its source is
-- 'official'. Everywhere else it says "estimated", and `boundary_source` exists
-- so an estimate can be stored and labelled rather than being indistinguishable
-- from the real thing by virtue of sitting in the same table.
--
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. question_topics
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_topics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid NOT NULL REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  topic        text NOT NULL,
  -- Ordering for display. Not a ranking of importance: the first topic is the
  -- one an author listed first, and nothing should read more into it.
  display_order integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_topics_topic_not_blank CHECK (btrim(topic) <> ''),
  -- One question cannot be filed under the same topic twice. Without this a
  -- re-run of any importer silently doubles every row, which is the defect
  -- the keyless child tables in 0028 have to work around by hand.
  CONSTRAINT question_topics_unique UNIQUE (question_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_question_topics_question ON public.question_topics(question_id);
-- The query this table exists for: "every question on this topic".
CREATE INDEX IF NOT EXISTS idx_question_topics_topic ON public.question_topics(topic);

COMMENT ON TABLE public.question_topics IS
  'Topics a question covers, one row each. Replaces paper_questions.topic, which held one value for questions that genuinely have several. Nothing reads this yet; the old column is untouched.';

-- ----------------------------------------------------------------------------
-- 2. question_spec_points
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_spec_points (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid NOT NULL REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  -- As printed in the specification: "1.4.2". Text, not a number — the codes
  -- are dotted, sometimes lettered, and are an identifier rather than a value.
  spec_code    text NOT NULL,
  -- The statement itself, denormalised on purpose: specifications are revised,
  -- and a question was mapped against the wording that existed when someone
  -- read it. Nullable because the code alone is often all that is recorded.
  spec_text    text,
  display_order integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_spec_points_code_not_blank CHECK (btrim(spec_code) <> ''),
  CONSTRAINT question_spec_points_unique UNIQUE (question_id, spec_code)
);

CREATE INDEX IF NOT EXISTS idx_question_spec_points_question ON public.question_spec_points(question_id);
CREATE INDEX IF NOT EXISTS idx_question_spec_points_code ON public.question_spec_points(spec_code);

COMMENT ON TABLE public.question_spec_points IS
  'Specification statements a question assesses, one row each. spec_text is denormalised deliberately: it records the wording as it stood when the question was mapped.';

-- ----------------------------------------------------------------------------
-- 3. grade_boundaries
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grade_boundaries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identifies the qualification, the unit AND the session in one reference.
  paper_id      uuid NOT NULL REFERENCES public.past_papers(id) ON DELETE CASCADE,
  grade         text NOT NULL,
  -- The LOWEST raw mark that earns this grade. Stored as the boundary itself,
  -- not as a range: ranges invite two rows that disagree about where A* ends.
  raw_mark_min  integer NOT NULL,
  -- Uniform mark, where the board publishes one. Nullable — many do not.
  ums_min       integer,
  boundary_source text NOT NULL,
  -- Where it came from, so a claim of "official" can be checked by a person.
  source_note   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grade_boundaries_grade_not_blank CHECK (btrim(grade) <> ''),
  CONSTRAINT grade_boundaries_mark_nonneg CHECK (raw_mark_min >= 0),
  CONSTRAINT grade_boundaries_ums_nonneg CHECK (ums_min IS NULL OR ums_min >= 0),
  -- ⚠ THE ENUM IS THE WHOLE FEATURE. Without it an estimate stored for
  -- convenience is indistinguishable from a published boundary, and the results
  -- screen has no way to tell the truth apart from the guess.
  CONSTRAINT grade_boundaries_source_check CHECK (boundary_source IN ('official', 'estimated')),
  -- An estimate must say where it came from; an official one may.
  CONSTRAINT grade_boundaries_estimate_explained CHECK (
    boundary_source <> 'estimated' OR btrim(coalesce(source_note, '')) <> ''
  ),
  CONSTRAINT grade_boundaries_unique UNIQUE (paper_id, grade)
);

CREATE INDEX IF NOT EXISTS idx_grade_boundaries_paper ON public.grade_boundaries(paper_id, raw_mark_min DESC);

COMMENT ON TABLE public.grade_boundaries IS
  'Grade boundaries for one sitting. paper_id identifies qualification, unit and session together, so a boundary cannot drift from the paper it belongs to. A results screen may say "official" only where a row exists for that paper_id with boundary_source = official.';
COMMENT ON COLUMN public.grade_boundaries.boundary_source IS
  'official = published by the awarding body. estimated = our own figure, and must carry a source_note. Absence of a row means neither is known and the screen must say estimated.';

-- ----------------------------------------------------------------------------
-- RLS — read where the paper is live, write staff-only
-- ----------------------------------------------------------------------------
-- ⚠ THE WRITE POLICIES DO NOT MENTION auth.uid() ANYWHERE. These are authored
-- content: there is no expression a student can satisfy, which is the same
-- guarantee 0028 gives mark_scheme_items and 0031 gives expected answers.
--
-- The READ policies deliberately DO reach auth-independent data — the paper's
-- status — mirroring paper_questions_read verbatim. A student may read the
-- topics of a question on a live paper for the same reason they may read the
-- question.

ALTER TABLE public.question_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_topics_read ON public.question_topics;
CREATE POLICY question_topics_read
  ON public.question_topics FOR SELECT TO authenticated
  USING (
    public.has_role('teacher') OR public.has_role('marker') OR public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.paper_questions q
        JOIN public.past_papers p ON p.id = q.paper_id
       WHERE q.id = question_id AND p.status = 'live'
    )
  );

DROP POLICY IF EXISTS question_topics_write ON public.question_topics;
CREATE POLICY question_topics_write
  ON public.question_topics FOR ALL TO authenticated
  USING      (public.has_role('marker') OR public.has_role('admin'))
  WITH CHECK (public.has_role('marker') OR public.has_role('admin'));

ALTER TABLE public.question_spec_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_spec_points_read ON public.question_spec_points;
CREATE POLICY question_spec_points_read
  ON public.question_spec_points FOR SELECT TO authenticated
  USING (
    public.has_role('teacher') OR public.has_role('marker') OR public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.paper_questions q
        JOIN public.past_papers p ON p.id = q.paper_id
       WHERE q.id = question_id AND p.status = 'live'
    )
  );

DROP POLICY IF EXISTS question_spec_points_write ON public.question_spec_points;
CREATE POLICY question_spec_points_write
  ON public.question_spec_points FOR ALL TO authenticated
  USING      (public.has_role('marker') OR public.has_role('admin'))
  WITH CHECK (public.has_role('marker') OR public.has_role('admin'));

ALTER TABLE public.grade_boundaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grade_boundaries_read ON public.grade_boundaries;
CREATE POLICY grade_boundaries_read
  ON public.grade_boundaries FOR SELECT TO authenticated
  USING (
    public.has_role('teacher') OR public.has_role('marker') OR public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.past_papers p WHERE p.id = paper_id AND p.status = 'live'
    )
  );

DROP POLICY IF EXISTS grade_boundaries_write ON public.grade_boundaries;
CREATE POLICY grade_boundaries_write
  ON public.grade_boundaries FOR ALL TO authenticated
  USING      (public.has_role('marker') OR public.has_role('admin'))
  WITH CHECK (public.has_role('marker') OR public.has_role('admin'));

-- ----------------------------------------------------------------------------
-- Grants — SELECT for students, writes gated by policy, anon nothing
-- ----------------------------------------------------------------------------
-- ⚠ MANDATORY, NOT OPTIONAL. Supabase's default privileges hand anon and
-- authenticated TRUNCATE, TRIGGER and REFERENCES on every newly created table,
-- and 0019's sweep enumerated pg_tables at the moment it ran — it fixed a
-- snapshot. `announcements` was created by 0022, missed that sweep, and shipped
-- with all three until 0025 caught it by hand. These are three new tables.
--
-- TRUNCATE is not filtered by RLS: no policy on earth protects a table from it.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_spec_points TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_boundaries TO authenticated;

REVOKE ALL ON public.question_topics      FROM anon;
REVOKE ALL ON public.question_spec_points FROM anon;
REVOKE ALL ON public.grade_boundaries     FROM anon;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.question_topics      FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.question_spec_points FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.grade_boundaries     FROM anon, authenticated;

COMMIT;


-- ============================================================================
-- VERIFICATION — run after applying. Both halves, or it proves nothing.
-- ============================================================================
--
-- ⚠ THE CATALOGUE HALF ALONE IS NOT EVIDENCE. Policies that read correctly and
-- a session that returns the wrong rows is the exact failure this shape exists
-- to catch — and a student session returning 0 rows proves nothing either
-- unless the service role has first proved the rows are THERE. Zero rows from
-- an empty table looks identical to zero rows from a working policy.
--
-- (a) The three dangerous privileges, across the whole schema. ZERO ROWS.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
--      AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES')
--    ORDER BY table_name, grantee, privilege_type;
--
-- (b) anon holds NOTHING on any of the three. ZERO ROWS.
--
--   SELECT table_name, privilege_type FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND grantee = 'anon'
--      AND table_name IN ('question_topics','question_spec_points','grade_boundaries');
--
-- (c) No WRITE policy mentions auth.uid(). ZERO ROWS.
--     (The read policies reach past_papers.status, which is not auth.uid().)
--
--   SELECT tablename, policyname, qual, with_check FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('question_topics','question_spec_points','grade_boundaries')
--      AND policyname LIKE '%_write'
--      AND (qual LIKE '%auth.uid%' OR with_check LIKE '%auth.uid%');
--
-- (d) RLS is on for all three. Expect three rows, all true.
--
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE relnamespace = 'public'::regnamespace
--      AND relname IN ('question_topics','question_spec_points','grade_boundaries');
--
-- (e) HALF ONE — AS SERVICE ROLE, prove the rows exist and are readable.
--     Populate against WCH11/01 (status = live) and read them back.
--     Expect: 2, 1, 2 and then the same rows on select.
--
--   INSERT INTO public.question_topics (question_id, topic)
--   SELECT id, t FROM public.paper_questions,
--        (VALUES ('Moles and stoichiometry'), ('Gas laws')) AS v(t)
--    WHERE question_number = '20(a)'
--      AND paper_id = 'f7577346-3c45-4b3a-b944-d52542863358';
--
--   INSERT INTO public.question_spec_points (question_id, spec_code, spec_text)
--   SELECT id, '1.4.2', 'use the ideal gas equation pV = nRT'
--     FROM public.paper_questions
--    WHERE question_number = '20(a)'
--      AND paper_id = 'f7577346-3c45-4b3a-b944-d52542863358';
--
--   INSERT INTO public.grade_boundaries (paper_id, grade, raw_mark_min, boundary_source, source_note)
--   VALUES ('f7577346-3c45-4b3a-b944-d52542863358', 'A', 58, 'official',
--           'Pearson published boundaries, WCH11/01 May-June 2025'),
--          ('f7577346-3c45-4b3a-b944-d52542863358', 'B', 51, 'estimated',
--           'interpolated from adjacent sessions — NOT published');
--
--   SELECT count(*) FROM public.question_topics;       -- expect 2
--   SELECT count(*) FROM public.question_spec_points;  -- expect 1
--   SELECT count(*) FROM public.grade_boundaries;      -- expect 2
--
--   -- and the estimate guard actually bites. Expect ERROR 23514:
--   INSERT INTO public.grade_boundaries (paper_id, grade, raw_mark_min, boundary_source)
--   VALUES ('f7577346-3c45-4b3a-b944-d52542863358', 'C', 44, 'estimated');
--
--   -- as must an invented source. Expect ERROR 23514:
--   INSERT INTO public.grade_boundaries (paper_id, grade, raw_mark_min, boundary_source)
--   VALUES ('f7577346-3c45-4b3a-b944-d52542863358', 'D', 37, 'probably');
--
-- (f) HALF TWO — FROM A REAL STUDENT SESSION. Sign in with the publishable key
--     as an ordinary student holding NO user_roles row, and run:
--
--       select * from question_topics;        -- expect the 2 rows (paper is live)
--       select * from question_spec_points;   -- expect the 1 row
--       select * from grade_boundaries;       -- expect the 2 rows
--
--       insert into question_topics (question_id, topic)
--       values ('<any question id>', 'injected');   -- expect ERROR 42501
--
--       update grade_boundaries set raw_mark_min = 0; -- expect 0 rows affected
--
--     ⚠ A STUDENT READING THESE IS CORRECT AND INTENDED — they are catalogue
--     metadata about a live paper, not marking data. What must fail is every
--     WRITE. If the reads return 0 rows here while (e) counted 2/1/2, the read
--     policy is broken, not safe.
--
-- (g) And that a NON-LIVE paper's rows stay hidden from a student. As service
--     role, flip a paper to 'draft' and re-run the student select; expect its
--     rows to disappear and reappear when set back to 'live'.
--
-- (h) 0028/0031's existing policies are untouched; this file adds six.
--
--   SELECT tablename, count(*) FROM pg_policies WHERE schemaname = 'public'
--    GROUP BY tablename ORDER BY tablename;
--
-- ----------------------------------------------------------------------------
-- ROLLBACK, if it comes to that
-- ----------------------------------------------------------------------------
--   DROP TABLE IF EXISTS public.grade_boundaries;
--   DROP TABLE IF EXISTS public.question_spec_points;
--   DROP TABLE IF EXISTS public.question_topics;
--
-- Nothing reads them, so dropping them is safe until the first reader ships.
-- paper_questions.topic and .spec_point are untouched by this migration and
-- remain the only populated source.
-- ============================================================================
