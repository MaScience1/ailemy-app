-- ============================================================================
-- 0015_past_papers_duration_and_marks.sql
-- ----------------------------------------------------------------------------
-- Adds the two paper facts the results card needs and the schema could not
-- express: how long the exam is, and what it is out of.
--
--     duration_minutes  -- length of the EXAM, e.g. 90 for 1 hour 30 minutes
--     total_marks       -- marks available on the paper, e.g. 80
--
-- WHY: 0007 stores only `walkthrough_duration_minutes`, which is the length of
-- the walkthrough VIDEO. Reading that as the exam duration would be silently
-- wrong, so /past-papers/[paper]/test currently counts down from a hardcoded
-- 90 minutes for every paper regardless of what the paper actually is. This
-- migration is what retires that constant.
--
-- NULLABLE, no default, like the *_pdf_path columns: a paper may be entered
-- before its duration or mark total is known, and "not recorded yet" is a
-- legitimate state rather than an error. The results card omits the row when
-- the value is null rather than inventing one, and the test timer falls back to
-- a documented default only when duration_minutes is null.
--
-- The CHECK constraints reject nonsense (zero or negative) while allowing null.
-- They validate existing rows on creation; every value currently in the table
-- is null, so nothing can fail.
--
-- SCOPE: additive only. No existing column, index, policy, grant or RLS setting
-- is touched. The past_papers_public_read_live policy from 0007 already governs
-- read access to the whole row, so these columns inherit it. Grants likewise —
-- privileges are per-table, not per-column, so anon/authenticated and
-- service_role (restored in 0014) already cover them.
--
-- Safe to re-run: both ADD COLUMN statements are IF NOT EXISTS, and the CHECKs
-- are added conditionally.
-- ============================================================================

BEGIN;

ALTER TABLE past_papers
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

ALTER TABLE past_papers
  ADD COLUMN IF NOT EXISTS total_marks integer;

COMMENT ON COLUMN past_papers.duration_minutes IS
  'Length of the exam in minutes (e.g. 90). NOT the walkthrough video length — see walkthrough_duration_minutes for that.';

COMMENT ON COLUMN past_papers.total_marks IS
  'Marks available on the paper (e.g. 80). Null when not yet recorded.';

-- Guard rails. Wrapped so the migration stays re-runnable — ADD CONSTRAINT has
-- no IF NOT EXISTS in Postgres.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'past_papers_duration_minutes_positive'
  ) THEN
    ALTER TABLE past_papers
      ADD CONSTRAINT past_papers_duration_minutes_positive
      CHECK (duration_minutes IS NULL OR duration_minutes > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'past_papers_total_marks_positive'
  ) THEN
    ALTER TABLE past_papers
      ADD CONSTRAINT past_papers_total_marks_positive
      CHECK (total_marks IS NULL OR total_marks > 0);
  END IF;
END $$;

COMMIT;


-- ============================================================================
-- VERIFICATION — read-only. Run AFTER the migration.
-- ============================================================================

-- (a) Both columns present, nullable, integer.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'past_papers'
  AND column_name IN ('duration_minutes', 'total_marks')
ORDER BY column_name;

-- (b) Constraints landed.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.past_papers'::regclass
  AND conname LIKE 'past_papers_%_positive'
ORDER BY conname;

-- (c) Nothing else changed: policy count on past_papers should be unchanged
--     (1 — past_papers_public_read_live from 0007).
SELECT count(*) AS policies_on_past_papers
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'past_papers';
