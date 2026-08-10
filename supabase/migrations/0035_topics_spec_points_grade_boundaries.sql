-- ============================================================================
-- 0035 — question_topics, question_spec_points, grade_boundaries
-- ============================================================================
--
-- ⚠ APPLIED 2026-08-10, by hand in the SQL Editor. VERIFIED — both halves.
--
-- CATALOGUE HALF
--   (a) three dangerous privileges across the schema ....... 0 rows
--   (b) anon holds nothing on any of the three ............. 0 rows
--   (c) no WRITE policy mentions auth.uid() ................ 0 rows
--   (d) RLS on for all three .............................. 3 rows, all true
--
-- BEHAVIOURAL HALF — and this is the half that is evidence.
--   Baseline first: all three tables confirmed EMPTY before anything was
--   inserted, so a non-zero count afterwards could be attributed rather than
--   explained away.
--
--   (e) service role: question_topics 2, question_spec_points 1,
--       grade_boundaries 2. Both guards fired with 23514 —
--       grade_boundaries_estimate_explained on an 'estimated' row with no
--       source_note, and grade_boundaries_source_check on boundary_source
--       = 'probably'.
--
--   (f) a real student session, holding NO user_roles row: read 2 / 1 / 2 —
--       correct and intended, this is catalogue metadata about a live paper.
--       INSERT into question_topics refused 42501. UPDATE on grade_boundaries
--       affected 0 rows, and the stored values were re-read as (58, 51),
--       unchanged. Zero rows from an empty table looks identical to zero rows
--       from a working policy, which is why (e) ran first.
--
--   (f2) cleanup: 2 / 1 / 2 rows deleted by paper_id, then all three tables
--       re-counted at 0, and no row anywhere with boundary_source = 'official'.
--       The test student was deleted BY THE ID CAPTURED AT CREATION — never a
--       sweep; a sweep destroyed a real sitting once.
--
--   (g) SKIPPED, deliberately. It flips the only live paper to 'draft' to
--       re-prove a `p.status = 'live'` branch copied verbatim from
--       paper_questions_read and in production since 0028. WCH11/01 was
--       confirmed still 'live' after the run.
--
-- ⚠ The boundary rows used above (A at 58, B at 51) were INVENTED and are
-- gone. Nobody has looked up the real May-June 2025 boundaries. Until someone
-- does, this table is empty and every results screen must say "estimated".
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

-- ⚠ THE OUTER COLUMN IS QUALIFIED IN EVERY SUBQUERY BELOW, and that is not
-- style. An unqualified `question_id` inside `SELECT 1 FROM paper_questions q
-- JOIN past_papers p ...` resolves to the OUTER table today only because
-- paper_questions has no column of that name. The day a migration adds one,
-- Postgres silently prefers the inner scope, the correlation disappears, and
-- the policy becomes "does ANY live paper have ANY question" — which is true
-- for every row. It would not error, and no test would notice.

ALTER TABLE public.question_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_topics_read ON public.question_topics;
CREATE POLICY question_topics_read
  ON public.question_topics FOR SELECT TO authenticated
  USING (
    public.has_role('teacher') OR public.has_role('marker') OR public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.paper_questions q
        JOIN public.past_papers p ON p.id = q.paper_id
       WHERE q.id = question_topics.question_id AND p.status = 'live'
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
       WHERE q.id = question_spec_points.question_id AND p.status = 'live'
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
      SELECT 1 FROM public.past_papers p
       WHERE p.id = grade_boundaries.paper_id AND p.status = 'live'
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
--   ⚠ 58 AND 51 ARE INVENTED. Nobody has looked up the real May-June 2025
--   boundaries. The first draft of this block cited "Pearson published
--   boundaries" on a made-up number with boundary_source = 'official' — which,
--   if the row survived, would have had the results screen report an official
--   grade and name the awarding body for a figure we made up. That is the exact
--   failure boundary_source exists to prevent, and a plausible source_note
--   makes it worse, not better. Both notes now say what these rows are, and
--   step (f2) below deletes them and proves they are gone.
--
--   INSERT INTO public.grade_boundaries (paper_id, grade, raw_mark_min, boundary_source, source_note)
--   VALUES ('f7577346-3c45-4b3a-b944-d52542863358', 'A', 58, 'official',
--           'TEST ROW - DELETE - not a real boundary'),
--          ('f7577346-3c45-4b3a-b944-d52542863358', 'B', 51, 'estimated',
--           'TEST ROW - DELETE - not a real boundary');
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
-- (f2) ⚠ MANDATORY CLEANUP — DO THIS BEFORE YOU CLOSE THE EDITOR.
--
--      Everything (e) inserted is fabricated: two invented boundaries, a spec
--      code nobody mapped, two topics nobody authored. They are indistinguishable
--      from real content to every reader downstream, and the boundary rows are
--      the dangerous ones — a row with boundary_source = 'official' is a claim
--      about a real examination.
--
--      Delete by the paper this block used, then PROVE the tables are empty.
--      A delete that reports success is not evidence; the count is.
--
--   DELETE FROM public.question_topics
--    WHERE question_id IN (SELECT id FROM public.paper_questions
--                           WHERE paper_id = 'f7577346-3c45-4b3a-b944-d52542863358');
--
--   DELETE FROM public.question_spec_points
--    WHERE question_id IN (SELECT id FROM public.paper_questions
--                           WHERE paper_id = 'f7577346-3c45-4b3a-b944-d52542863358');
--
--   DELETE FROM public.grade_boundaries
--    WHERE paper_id = 'f7577346-3c45-4b3a-b944-d52542863358';
--
--   -- All three MUST be 0. If any is not, something else wrote to these
--   -- tables during the check and you need to look before going further.
--   SELECT 'question_topics'      AS t, count(*) FROM public.question_topics
--   UNION ALL
--   SELECT 'question_spec_points',      count(*) FROM public.question_spec_points
--   UNION ALL
--   SELECT 'grade_boundaries',          count(*) FROM public.grade_boundaries;
--
--   -- And specifically: no boundary anywhere still claims to be official.
--   -- MUST return zero rows.
--   SELECT id, paper_id, grade, raw_mark_min, source_note
--     FROM public.grade_boundaries WHERE boundary_source = 'official';
--
-- ----------------------------------------------------------------------------
-- (g) ⚠ OPTIONAL, AND IT TAKES YOUR LIVE PAPER OFF THE SITE. SKIP IT.
-- ----------------------------------------------------------------------------
--     This proves the negative case — that a NON-live paper's rows stay hidden
--     from a student — by flipping WCH11/01 to 'draft'. WCH11/01 is currently
--     the only live paper, so for however long the check takes, the site has
--     nothing on it. If anything interrupts you between the flip and the
--     restore, it stays that way.
--
--     WHAT SKIPPING COSTS, stated so the decision is informed: (f) already
--     evidences the positive case — rows for a LIVE paper are visible to a
--     student. What goes unproven is the `p.status = 'live'` branch, which is
--     copied verbatim from paper_questions_read and has been in production
--     since 0028. I would skip it.
--
--     IF YOU RUN IT ANYWAY: the restore is a DO block that asserts, not a bare
--     UPDATE, so the paper cannot be left in draft by a statement that silently
--     matched nothing.
--
--   -- 1. flip, and confirm it took
--   UPDATE public.past_papers SET status = 'draft'
--    WHERE id = 'f7577346-3c45-4b3a-b944-d52542863358'
--   RETURNING id, status;                      -- expect one row, status=draft
--
--   -- 2. student session: the three selects must now return 0 rows
--
--   -- 3. RESTORE IMMEDIATELY. Raises rather than returning if it did not work.
--   DO $$
--   DECLARE s text;
--   BEGIN
--     UPDATE public.past_papers SET status = 'live'
--      WHERE id = 'f7577346-3c45-4b3a-b944-d52542863358';
--     SELECT status INTO s FROM public.past_papers
--      WHERE id = 'f7577346-3c45-4b3a-b944-d52542863358';
--     IF s IS DISTINCT FROM 'live' THEN
--       RAISE EXCEPTION 'PAPER LEFT AT %, NOT live — restore it by hand NOW', s;
--     END IF;
--     RAISE NOTICE 'paper restored to live';
--   END $$;
--
--   -- 4. and see it on the site before you walk away.
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
