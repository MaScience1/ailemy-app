-- ============================================================================
-- 0078_PROPOSED_ial_maths_unit_names.sql
-- ----------------------------------------------------------------------------
-- ⚠ NUMBER 0078 ISSUED BY PLANNING. UNAPPLIED. The founder runs it in the SQL
-- Editor. The _PROPOSED_ token stays until then, per R19: an unapplied file
-- under its plain number lets a rebuild get ahead of production.
--
-- ============================================================================
-- WHY THIS EXISTS — A DEFECT IN 0077, WHICH IS ALREADY APPLIED
-- ============================================================================
-- 0077 created 22 IAL units. Fourteen of them carry a name the importer cannot
-- parse, and the failure is total rather than partial.
--
-- loadCatalogue validates the configured unit number against the units row's
-- NAME, at bulk-import-papers.ts:933:
--
--     const unitNumber = Number(/^\s*Unit\s+(\d+)/i.exec(row.name)?.[1]);
--     if (unitNumber !== expected.unitNumber) { problems.push(...); continue; }
--
-- The regex needs digits immediately after "Unit ". 0077 wrote the Pearson unit
-- identifiers there instead — "Unit P1:", "Unit M1:", "Unit FP1:" — so the
-- match returns undefined, Number(undefined) is NaN, and NaN !== anything is
-- ALWAYS true. Every one of the fourteen would push a problem, and loadCatalogue
-- calls fail() on a non-empty problem list: the whole run ABORTS. It does not
-- skip the paper.
--
-- The eight English rows ("Unit 1: English Language" and siblings) parse and
-- are correct. They are asserted UNCHANGED below, byte for byte.
--
-- ⚠ NOTHING IS BROKEN IN PRODUCTION TODAY. All 40 rows are 'coming_soon' and no
-- Maths paper has been imported. 0077's gate could not have caught this: it
-- asserted counts and shape, and this defect lives in the TEXT of a name.
--
-- ============================================================================
-- R20 — FIX THE DATA, NOT THE REGEX
-- ============================================================================
-- The validator at :933 is load-bearing for every existing IAL import —
-- Biology, Chemistry and Physics all resolve through it. Widening it to
-- accommodate a Maths naming choice would change the blast radius from four
-- unit rows to the entire IAL corpus. The names are cosmetic; the validator is
-- not. So the names move.
--
-- ⚠ N IS THE EXISTING sort_order, NOT THE PEARSON DIGIT. WME01 is Mechanics M1
-- but sits at sort_order 3 in AS Mathematics, so it becomes "Unit 3". The
-- Pearson identifier is preserved in the title after the colon, where nothing
-- parses it. Using the Pearson digit instead would collide four ways in AS
-- Mathematics: WMA11, WME01, WST01 and WDM11 would all claim "Unit 1".
--
-- ⚠ KEYED ON (course_id, code), NEVER ON name. name is the column being
-- rewritten; keying on it would make the statement non-re-runnable and would
-- silently match nothing on a second run. Slugs are NOT touched.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  n_updated  int;
  n_parsable int;
  n_total    int;
  n_ambig    int;
  bad_course text;
  bad_eng    text;
BEGIN
  -- -------------------------------------------------------------------------
  -- 1. THE FOURTEEN. One statement so ROW_COUNT is the whole change.
  -- -------------------------------------------------------------------------
  UPDATE units u
     SET name = v.new_name
    FROM (VALUES
      ('edexcel-ial-as-mathematics',         'WMA11', 'Unit 1: Pure Mathematics P1'),
      ('edexcel-ial-as-mathematics',         'WMA12', 'Unit 2: Pure Mathematics P2'),
      ('edexcel-ial-as-mathematics',         'WME01', 'Unit 3: Mechanics M1'),
      ('edexcel-ial-as-mathematics',         'WST01', 'Unit 4: Statistics S1'),
      ('edexcel-ial-as-mathematics',         'WDM11', 'Unit 5: Decision Mathematics D1'),
      ('edexcel-ial-a2-mathematics',         'WMA13', 'Unit 1: Pure Mathematics P3'),
      ('edexcel-ial-a2-mathematics',         'WMA14', 'Unit 2: Pure Mathematics P4'),
      ('edexcel-ial-a2-mathematics',         'WME02', 'Unit 3: Mechanics M2'),
      ('edexcel-ial-a2-mathematics',         'WME03', 'Unit 4: Mechanics M3'),
      ('edexcel-ial-a2-mathematics',         'WST02', 'Unit 5: Statistics S2'),
      ('edexcel-ial-a2-mathematics',         'WST03', 'Unit 6: Statistics S3'),
      ('edexcel-ial-as-further-mathematics', 'WFM01', 'Unit 1: Further Pure FP1'),
      ('edexcel-ial-a2-further-mathematics', 'WFM02', 'Unit 1: Further Pure FP2'),
      ('edexcel-ial-a2-further-mathematics', 'WFM03', 'Unit 2: Further Pure FP3')
    ) AS v(course_slug, code, new_name),
      courses c
   WHERE c.slug        = v.course_slug
     AND u.course_id   = c.id
     AND u.code        = v.code;

  GET DIAGNOSTICS n_updated = ROW_COUNT;
  IF n_updated <> 14 THEN
    RAISE EXCEPTION 'expected 14 rows updated, got %', n_updated;
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. ALL 22 NAMES NOW PARSE. Same shape as the validator at :933.
  -- -------------------------------------------------------------------------
  SELECT count(*) INTO n_parsable
    FROM units u JOIN courses c ON c.id = u.course_id
   WHERE c.slug LIKE 'edexcel-ial-%'
     AND u.code ~ '^W(MA|ME|ST|DM|FM|EN|ET)'
     AND u.name ~ '^\s*Unit\s+\d+\y';
  IF n_parsable <> 22 THEN
    RAISE EXCEPTION 'expected 22 parsable unit names, got %', n_parsable;
  END IF;

  -- -------------------------------------------------------------------------
  -- 3. PER MATHS COURSE: the parsed N are DISTINCT and CONTIGUOUS FROM 1.
  --    Distinct alone is not enough — 1,2,4 is distinct and still wrong.
  -- -------------------------------------------------------------------------
  SELECT c.slug INTO bad_course
    FROM units u JOIN courses c ON c.id = u.course_id
   WHERE c.slug IN ('edexcel-ial-as-mathematics','edexcel-ial-a2-mathematics',
                    'edexcel-ial-as-further-mathematics','edexcel-ial-a2-further-mathematics')
   GROUP BY c.slug
  HAVING count(DISTINCT substring(u.name from '^\s*Unit\s+(\d+)')::int) <> count(*)
      OR min(substring(u.name from '^\s*Unit\s+(\d+)')::int) <> 1
      OR max(substring(u.name from '^\s*Unit\s+(\d+)')::int) <> count(*)
   LIMIT 1;
  IF bad_course IS NOT NULL THEN
    RAISE EXCEPTION 'unit numbers not distinct-and-contiguous-from-1 in course %', bad_course;
  END IF;

  -- -------------------------------------------------------------------------
  -- 4. THE EIGHT ENGLISH ROWS ARE UNTOUCHED, asserted byte for byte.
  --    A count would pass if this statement had rewritten them too.
  -- -------------------------------------------------------------------------
  SELECT u.code INTO bad_eng
    FROM units u
   WHERE u.code IN ('WEN01','WEN02','WEN03','WEN04','WET01','WET02','WET03','WET04')
     AND u.name <> CASE u.code
       WHEN 'WEN01' THEN 'Unit 1: English Language'
       WHEN 'WEN02' THEN 'Unit 2: English Language'
       WHEN 'WEN03' THEN 'Unit 3: English Language'
       WHEN 'WEN04' THEN 'Unit 4: English Language'
       WHEN 'WET01' THEN 'Unit 1: English Literature'
       WHEN 'WET02' THEN 'Unit 2: English Literature'
       WHEN 'WET03' THEN 'Unit 3: English Literature'
       WHEN 'WET04' THEN 'Unit 4: English Literature'
     END
   LIMIT 1;
  IF bad_eng IS NOT NULL THEN
    RAISE EXCEPTION 'English unit name was modified: %', bad_eng;
  END IF;

  -- -------------------------------------------------------------------------
  -- 5. NOTHING ELSE MOVED. Total still 40, no code ambiguous.
  -- -------------------------------------------------------------------------
  SELECT count(*) INTO n_total FROM units;
  IF n_total <> 40 THEN
    RAISE EXCEPTION 'units total: expected 40, got %', n_total;
  END IF;

  SELECT count(*) INTO n_ambig FROM (
    SELECT code FROM units GROUP BY code HAVING count(*) > 1
  ) d;
  IF n_ambig <> 0 THEN
    RAISE EXCEPTION 'unit codes appearing more than once: %', n_ambig;
  END IF;

  RAISE NOTICE 'OK  updated=%  parsable=22  total=%  ambiguous=%', n_updated, n_total, n_ambig;
END $$;

COMMIT;
