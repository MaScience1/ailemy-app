-- ============================================================================
-- 0005_add_pathway_to_courses.sql
-- ----------------------------------------------------------------------------
-- Adds a `pathway` enum column to courses so the /learn catalogue can
-- separate qualifications by educational pathway (e.g. UK A-Level vs IGCSE
-- vs IB) rather than lumping every curriculum together under a subject.
--
-- This migration:
--   1. Creates the pathway_type enum (6 values).
--   2. Adds courses.pathway (nullable initially so we can backfill).
--   3. Backfills every existing course by joining to curricula and mapping
--      each known curriculum slug to its pathway. Mappings are exact-match
--      against the slugs verified in the live DB at the time of writing
--      (ib, edexcel-ial, edexcel-igcse, cie-igcse, ap, edexcel-alevel,
--      ocr-alevel, aqa-alevel, edexcel-gcse, ocr-gcse, aqa-gcse).
--      'cambridge-ial' is included pre-emptively for the day we add it.
--   4. Verifies no rows are still NULL before tightening to NOT NULL — the
--      DO block raises if anything slipped through, so the whole migration
--      rolls back instead of silently producing a partially-populated table.
--   5. Adds a composite index on (subject_id, pathway) for the lookup the
--      new pathway hub page does most: "courses for this subject in this
--      pathway."
--
-- Safe to re-run within a single session: the enum creation, column add,
-- and index creation are guarded with IF NOT EXISTS. The UPDATE is
-- idempotent (overwrites the column with the same derived value each time).
-- ============================================================================

BEGIN;

-- 1. Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pathway_type') THEN
    CREATE TYPE pathway_type AS ENUM (
      'uk-a-level',
      'international-a-level',
      'ib',
      'ap',
      'uk-gcse',
      'igcse'
    );
  END IF;
END $$;

-- 2. Column (nullable for backfill)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS pathway pathway_type;

-- 3. Backfill
WITH mapped AS (
  SELECT
    c.id,
    CASE cur.slug
      WHEN 'ib'             THEN 'ib'::pathway_type
      WHEN 'edexcel-ial'    THEN 'international-a-level'::pathway_type
      WHEN 'cambridge-ial'  THEN 'international-a-level'::pathway_type
      WHEN 'ap'             THEN 'ap'::pathway_type
      WHEN 'edexcel-alevel' THEN 'uk-a-level'::pathway_type
      WHEN 'ocr-alevel'     THEN 'uk-a-level'::pathway_type
      WHEN 'aqa-alevel'     THEN 'uk-a-level'::pathway_type
      WHEN 'edexcel-gcse'   THEN 'uk-gcse'::pathway_type
      WHEN 'ocr-gcse'       THEN 'uk-gcse'::pathway_type
      WHEN 'aqa-gcse'       THEN 'uk-gcse'::pathway_type
      WHEN 'edexcel-igcse'  THEN 'igcse'::pathway_type
      WHEN 'cie-igcse'      THEN 'igcse'::pathway_type
      ELSE NULL
    END AS new_pathway
  FROM courses c
  JOIN curricula cur ON cur.id = c.curriculum_id
)
UPDATE courses
SET pathway = mapped.new_pathway
FROM mapped
WHERE courses.id = mapped.id;

-- 4. Sanity check — raise (rolling back the whole BEGIN block) if any course
-- still has a NULL pathway. The error message lists how to find the
-- offenders so the operator can extend the CASE above.
DO $$
DECLARE
  unmapped int;
BEGIN
  SELECT count(*) INTO unmapped FROM courses WHERE pathway IS NULL;
  IF unmapped > 0 THEN
    RAISE EXCEPTION
      'Cannot tighten courses.pathway to NOT NULL: % course(s) still NULL. '
      'Inspect with: SELECT c.slug AS course_slug, cur.slug AS curriculum_slug '
      'FROM courses c JOIN curricula cur ON cur.id = c.curriculum_id '
      'WHERE c.pathway IS NULL; -- then extend the CASE in this migration.',
      unmapped;
  END IF;
END $$;

-- 5. Tighten to NOT NULL now that we know there are zero gaps.
ALTER TABLE courses ALTER COLUMN pathway SET NOT NULL;

-- 6. Composite index for the pathway hub lookup.
CREATE INDEX IF NOT EXISTS courses_subject_pathway_idx
  ON courses(subject_id, pathway);

COMMIT;
