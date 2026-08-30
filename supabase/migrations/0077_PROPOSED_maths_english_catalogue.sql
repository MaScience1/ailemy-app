-- ============================================================================
-- 0077_PROPOSED_maths_english_catalogue.sql
-- ----------------------------------------------------------------------------
-- ⚠ NUMBER 0077 ISSUED BY PLANNING. UNAPPLIED. The founder runs it in the SQL
-- Editor. It has NOT been connected to, checked against, or applied to any
-- database by the agent that wrote it.
--
-- ⚠ THE NUMBER WAS NOT TAKEN FROM `ls`. main's highest is 0070, but 0071 is a
-- gap and 0072-0076 are live in production on the unmerged classroom branch,
-- invisible to a listing here. Planning checked all of that and issued 0077.
--
-- ⚠ IT KEEPS _PROPOSED_ UNTIL IT IS APPLIED, and that is deliberate. An
-- unapplied file sitting under its plain number manufactures drift: a rebuild
-- replays this folder in order and would create these rows, while production
-- does not have them. 0033 sat as 0033_PROPOSED_ for a day for this reason.
-- Drop the _PROPOSED_ token once it has been run, and record the result here
-- at the same time.
--
-- ============================================================================
-- BOTH OPEN QUESTIONS ARE NOW ANSWERED BY THE FOUNDER
-- ============================================================================
-- 1. THE FIFTH SUBJECT IS ENGLISH LANGUAGE & LITERATURE, AND IT IS UK-ONLY.
--    It is 8EL0 / 9EL0, which is why none of the 22 IAL codes surfaced it — a
--    combined-award subject that Edexcel offers on the UK GCE spec and not on
--    the IAL one. It therefore adds TWO UK GCE courses and NO IAL course and NO
--    unit, which is why the shape is asymmetric: 10 UK GCE against 8 IAL.
--
-- 2. THE AS / A2 SPLIT IS FOUNDER-CONFIRMED, not inferred. It matters because
--    units.code is looked up UNSCOPED by course (bulk-import-papers.ts:829 does
--    `.in("code", unitCodes)`), so a unit filed against the wrong course would
--    send every paper for that code to the wrong course.
--
-- ============================================================================
-- WHAT THIS FILE DOES, AND WHAT IT DELIBERATELY DOES NOT
-- ============================================================================
--   1. Five subjects.
--   2. UK GCE courses, AS and A2, pathway 'uk-a-level' — 10, including the
--      English Language & Literature pair that has no IAL counterpart.
--   3. IAL courses, AS and A2, pathway 'international-a-level'.
--   4. Units for the IAL courses ONLY — 22 rows.
--
-- ⚠ NO UK UNITS, DELIBERATELY. UK GCE codes take the unit-less path at
-- bulk-import-papers.ts:895: the course is resolved by slug and unit_id is
-- written NULL. All sixteen existing unit-less codes (8CH0, 9CH0, 1SC0, 4SS0
-- and the rest) already work that way. Creating UK units would be dead rows.
--
-- ⚠ pathway IS SUPPLIED EXPLICITLY ON EVERY COURSE INSERT. 0005 added it
-- nullable at :47 and tightened it to NOT NULL at :95, forty-eight lines later,
-- with no default. An INSERT that omits it fails 23502. That has happened once
-- already, on 0070's control insert.
--
-- ⚠ NO ENUM CHANGE. 'uk-a-level' and 'international-a-level' are existing
-- pathway_type labels (0005:36-41). No join table, no new provenance columns.
--
-- ⚠ EVERY COURSE AND UNIT IS status 'coming_soon'. Nothing here becomes
-- publicly visible on being run.
--
-- ⚠ EVERY STATEMENT IS RE-RUNNABLE. ON CONFLICT DO NOTHING throughout, on the
-- real unique keys: subjects.slug, courses.slug, units (course_id, slug).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. SUBJECTS (5). sort_order continues from biology at 3.
--    ⚠ COLOUR ORDER IS R18. R12 gave one pair without saying which slot took
--    which shade, and was followed as written; R18 settled it and reversed that
--    pair along with fixing the other four. The convention, matching the three
--    Science subjects (chemistry is #F97316 AS / #C2410C A2), is LIGHTER IN
--    color_as, DARKER IN color_a2.
-- ---------------------------------------------------------------------------
INSERT INTO subjects (slug, name, color_as, color_a2, sort_order) VALUES
  ('mathematics',         'Mathematics',         '#60A5FA', '#2563EB', 4),
  ('further-mathematics', 'Further Mathematics', '#818CF8', '#4F46E5', 5),
  ('english-language',    'English Language',    '#34D399', '#059669', 6),
  ('english-literature',  'English Literature',  '#A78BFA', '#7C3AED', 7),
  ('english-language-and-literature', 'English Language & Literature', '#F472B6', '#DB2777', 8)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. UK GCE COURSES (10) — curriculum 'edexcel-alevel', pathway 'uk-a-level'.
--    Slug convention copied from COURSE_INSERT_PASTE.sql: edexcel-gce-<as|a2>-<subject>.
-- ---------------------------------------------------------------------------
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, pathway, status, sort_order)
SELECT c.id, s.id, v.slug, v.name, v.level, 'uk-a-level'::pathway_type, 'coming_soon', v.sort_order
FROM (VALUES
  ('edexcel-gce-as-mathematics',         'Edexcel GCE AS Mathematics',              'AS', 'mathematics',         1),
  ('edexcel-gce-a2-mathematics',         'Edexcel GCE A Level Mathematics',         'A2', 'mathematics',         2),
  ('edexcel-gce-as-further-mathematics', 'Edexcel GCE AS Further Mathematics',      'AS', 'further-mathematics', 1),
  ('edexcel-gce-a2-further-mathematics', 'Edexcel GCE A Level Further Mathematics', 'A2', 'further-mathematics', 2),
  ('edexcel-gce-as-english-language',    'Edexcel GCE AS English Language',         'AS', 'english-language',    1),
  ('edexcel-gce-a2-english-language',    'Edexcel GCE A Level English Language',    'A2', 'english-language',    2),
  ('edexcel-gce-as-english-literature',  'Edexcel GCE AS English Literature',       'AS', 'english-literature',  1),
  ('edexcel-gce-a2-english-literature',  'Edexcel GCE A Level English Literature',  'A2', 'english-literature',  2),
  -- 8EL0 / 9EL0. UK-only: there is no IAL English Language & Literature award,
  -- so this pair has no counterpart in section 3 and no unit in section 4.
  ('edexcel-gce-as-english-language-and-literature', 'Edexcel GCE AS English Language & Literature',      'AS', 'english-language-and-literature', 1),
  ('edexcel-gce-a2-english-language-and-literature', 'Edexcel GCE A Level English Language & Literature', 'A2', 'english-language-and-literature', 2)
) AS v(slug, name, level, subject_slug, sort_order)
JOIN curricula c ON c.slug = 'edexcel-alevel'
JOIN subjects  s ON s.slug = v.subject_slug
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. IAL COURSES (8) — curriculum 'edexcel-ial', pathway 'international-a-level'.
-- ---------------------------------------------------------------------------
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, pathway, status, sort_order)
SELECT c.id, s.id, v.slug, v.name, v.level, 'international-a-level'::pathway_type, 'coming_soon', v.sort_order
FROM (VALUES
  ('edexcel-ial-as-mathematics',         'Edexcel IAL AS Mathematics',              'AS', 'mathematics',         1),
  ('edexcel-ial-a2-mathematics',         'Edexcel IAL A Level Mathematics',         'A2', 'mathematics',         2),
  ('edexcel-ial-as-further-mathematics', 'Edexcel IAL AS Further Mathematics',      'AS', 'further-mathematics', 1),
  ('edexcel-ial-a2-further-mathematics', 'Edexcel IAL A Level Further Mathematics', 'A2', 'further-mathematics', 2),
  ('edexcel-ial-as-english-language',    'Edexcel IAL AS English Language',         'AS', 'english-language',    1),
  ('edexcel-ial-a2-english-language',    'Edexcel IAL A Level English Language',    'A2', 'english-language',    2),
  ('edexcel-ial-as-english-literature',  'Edexcel IAL AS English Literature',       'AS', 'english-literature',  1),
  ('edexcel-ial-a2-english-literature',  'Edexcel IAL A Level English Literature',  'A2', 'english-literature',  2)
) AS v(slug, name, level, subject_slug, sort_order)
JOIN curricula c ON c.slug = 'edexcel-ial'
JOIN subjects  s ON s.slug = v.subject_slug
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. IAL UNITS (22). See open question 2 above on the AS/A2 split.
-- ---------------------------------------------------------------------------
INSERT INTO units (course_id, slug, code, name, status, sort_order)
SELECT co.id, v.slug, v.code, v.name, 'coming_soon', v.sort_order
FROM (VALUES
  ('edexcel-ial-as-mathematics',         'unit-p1',  'WMA11', 'Unit P1: Pure Mathematics 1',      1),
  ('edexcel-ial-as-mathematics',         'unit-p2',  'WMA12', 'Unit P2: Pure Mathematics 2',      2),
  ('edexcel-ial-as-mathematics',         'unit-m1',  'WME01', 'Unit M1: Mechanics 1',             3),
  ('edexcel-ial-as-mathematics',         'unit-s1',  'WST01', 'Unit S1: Statistics 1',            4),
  ('edexcel-ial-as-mathematics',         'unit-d1',  'WDM11', 'Unit D1: Decision Mathematics 1',  5),
  ('edexcel-ial-a2-mathematics',         'unit-p3',  'WMA13', 'Unit P3: Pure Mathematics 3',      1),
  ('edexcel-ial-a2-mathematics',         'unit-p4',  'WMA14', 'Unit P4: Pure Mathematics 4',      2),
  ('edexcel-ial-a2-mathematics',         'unit-m2',  'WME02', 'Unit M2: Mechanics 2',             3),
  ('edexcel-ial-a2-mathematics',         'unit-m3',  'WME03', 'Unit M3: Mechanics 3',             4),
  ('edexcel-ial-a2-mathematics',         'unit-s2',  'WST02', 'Unit S2: Statistics 2',            5),
  ('edexcel-ial-a2-mathematics',         'unit-s3',  'WST03', 'Unit S3: Statistics 3',            6),
  ('edexcel-ial-as-further-mathematics', 'unit-fp1', 'WFM01', 'Unit FP1: Further Pure Mathematics 1', 1),
  ('edexcel-ial-a2-further-mathematics', 'unit-fp2', 'WFM02', 'Unit FP2: Further Pure Mathematics 2', 1),
  ('edexcel-ial-a2-further-mathematics', 'unit-fp3', 'WFM03', 'Unit FP3: Further Pure Mathematics 3', 2),
  ('edexcel-ial-as-english-language',    'unit-1',   'WEN01', 'Unit 1: English Language',         1),
  ('edexcel-ial-as-english-language',    'unit-2',   'WEN02', 'Unit 2: English Language',         2),
  ('edexcel-ial-a2-english-language',    'unit-3',   'WEN03', 'Unit 3: English Language',         1),
  ('edexcel-ial-a2-english-language',    'unit-4',   'WEN04', 'Unit 4: English Language',         2),
  ('edexcel-ial-as-english-literature',  'unit-1',   'WET01', 'Unit 1: English Literature',       1),
  ('edexcel-ial-as-english-literature',  'unit-2',   'WET02', 'Unit 2: English Literature',       2),
  ('edexcel-ial-a2-english-literature',  'unit-3',   'WET03', 'Unit 3: English Literature',       1),
  ('edexcel-ial-a2-english-literature',  'unit-4',   'WET04', 'Unit 4: English Literature',       2)
) AS v(course_slug, slug, code, name, sort_order)
JOIN courses co ON co.slug = v.course_slug
ON CONFLICT (course_id, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. GATE. Every count must hold or the transaction rolls back.
--    ⚠ THIS ASSERTS SHAPE, NOT JUST PRESENCE. A course with a NULL pathway or a
--    unit whose code collided would satisfy a bare COUNT and fail here.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  s_count int; uk_count int; ial_count int; u_count int;
  null_pathway int; dup_codes int;
  new_subjects text[] := ARRAY['mathematics','further-mathematics','english-language',
                               'english-literature','english-language-and-literature'];
  new_codes text[] := ARRAY['WMA11','WMA12','WMA13','WMA14','WME01','WME02','WME03',
                            'WST01','WST02','WST03','WDM11','WFM01','WFM02','WFM03',
                            'WEN01','WEN02','WEN03','WEN04','WET01','WET02','WET03','WET04'];
BEGIN
  SELECT count(*) INTO s_count FROM subjects WHERE slug = ANY(new_subjects);

  -- Courses are counted THROUGH the subject join and split by pathway, not by
  -- slug pattern. A LIKE on the slug would also match the Science courses.
  SELECT count(*) INTO uk_count
    FROM courses c JOIN subjects s ON s.id = c.subject_id
   WHERE s.slug = ANY(new_subjects) AND c.pathway = 'uk-a-level';

  SELECT count(*) INTO ial_count
    FROM courses c JOIN subjects s ON s.id = c.subject_id
   WHERE s.slug = ANY(new_subjects) AND c.pathway = 'international-a-level';

  SELECT count(*) INTO u_count FROM units WHERE code = ANY(new_codes);

  SELECT count(*) INTO null_pathway
    FROM courses c JOIN subjects s ON s.id = c.subject_id
   WHERE s.slug = ANY(new_subjects) AND c.pathway IS NULL;

  -- ⚠ EACH CODE EXACTLY ONCE ACROSS ALL COURSES. units.code is looked up
  -- unscoped by course, so a code appearing twice makes the lookup ambiguous
  -- and sends papers to whichever row the query happens to return.
  SELECT count(*) INTO dup_codes FROM (
    SELECT code FROM units WHERE code = ANY(new_codes) GROUP BY code HAVING count(*) > 1
  ) d;

  IF s_count    <> 5  THEN RAISE EXCEPTION 'subjects: expected 5, found %', s_count; END IF;
  IF uk_count   <> 10 THEN RAISE EXCEPTION 'UK GCE courses: expected 10, found %', uk_count; END IF;
  IF ial_count  <> 8  THEN RAISE EXCEPTION 'IAL courses: expected 8, found %', ial_count; END IF;
  IF u_count    <> 22 THEN RAISE EXCEPTION 'units: expected 22, found %', u_count; END IF;
  IF null_pathway <> 0 THEN RAISE EXCEPTION 'courses with NULL pathway: %', null_pathway; END IF;
  IF dup_codes  <> 0  THEN RAISE EXCEPTION 'unit codes appearing more than once: %', dup_codes; END IF;

  RAISE NOTICE 'OK  subjects=%  uk=%  ial=%  units=%  null_pathway=%  dup_codes=%',
    s_count, uk_count, ial_count, u_count, null_pathway, dup_codes;
END $$;

COMMIT;
