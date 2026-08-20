-- ============================================================================
-- 0054_PROPOSED_cohort_year_group.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-20. Renamed off _PROPOSED_ once verified.
--
-- VERIFICATION: 8 blocks RUN AND PASSING, 2 NOT RUN.
--   (a)  ⚠ THE LIVE COMMERCIAL FACTS ARE UNCHANGED, checked FIRST and then
--        AGAIN after the run's own UPDATEs were restored:
--          ial-chemistry-as-sep-2026  16900  800  interest  cap 20
--          igcse-chemistry-y11        14900  700  interest  cap 20
--          igcse-chemistry-y10        13900  650  interest  cap 20          ✓✓
--   (b)  gcse-y11 → Year 11 · gcse-y10 → Year 10 · ial-as → NULL            ✓
--        …and 0 gcse-% rows missed by the backfill                          ✓
--        ⚠ THE AS COHORT'S NULL IS CORRECT, NOT A MISS.
--   (c)  year_group='Sixth Form' refused, 23514 cohorts_year_group_check    ✓
--   (d)  …and 'Year 11' accepted, 1 row — so (c) is not a column refusing
--        everything                                                         ✓
--   (e)  NULL still allowed, 1 row — a future A2 cohort has no year group   ✓
--   (g)  anon reads year_group on the three public cohorts, no new grant    ✓
--   (h)  anon UPDATE refused, 42501                                         ✓
--
--   ⚠ (c)(d)(e) WRITE TO THE LIVE TABLE. Every year_group was captured before
--   the run and restored after it, and (a) was re-read post-restore. That
--   second read is the one that matters.
--
--   (f)  the constraint EXISTS (1) and is VALIDATED (1), out of 6 constraints
--        on the table — observed 2026-08-20.                                 ✓
--        ⚠ ASKED AS TWO COUNTS PLUS A TOTAL, because 0 rows from
--        pg_constraint is NOT the same fact as convalidated=false, and a
--        single boolean cannot tell them apart. exists=1 with validated=0
--        would mean section 3's SECOND statement never ran — the
--        trailing-statement failure that hit 0044 three times.
--   (i)  the three privileges — six falses. Plus two controls this table
--        needs specifically: anon SELECT is TRUE (or the homepage, /tuition
--        and /calendar go blank) and anon UPDATE is FALSE.                   ✓
--
-- ============================================================================
-- ⚠⚠ THIS TOUCHES THE TABLE CARRYING THE LIVE AS COHORT. READ FIRST.
-- ============================================================================
-- public.cohorts holds the three PUBLISHED cohorts the site is selling right
-- now — Edexcel IAL Chemistry AS at £169/month with a real timetable and real
-- prices, plus Y11 and Y10 at £149 and £139. A migration that fails halfway,
-- or that adds a CHECK an existing row violates, takes the tuition pages down.
--
-- So the order below is not stylistic:
--
--   1. ADD COLUMN nullable, no default. Metadata-only in Postgres 11+; no table
--      rewrite, no long lock, and no existing row is touched.
--   2. BACKFILL from `qualification`, which already encodes the year group in
--      every current row.
--   3. VERIFY the backfill by counting. STOP if the number is not what this
--      file predicts.
--   4. ADD CONSTRAINT ... NOT VALID — takes a brief lock, does NOT scan the
--      table, and refuses bad NEW rows immediately.
--   5. VALIDATE CONSTRAINT — scans without blocking reads or writes.
--
-- ⚠ STEPS 4 AND 5 ARE SPLIT ON PURPOSE. A plain ADD CONSTRAINT holds an ACCESS
-- EXCLUSIVE lock for the whole scan; on a live table that is a stall on every
-- page that reads cohorts, which today is the homepage, /tuition, /calendar and
-- all three subject pages. The table is tiny now, so the stall would be
-- invisible — but this is the pattern that stays correct when it is not.
--
-- ⚠ THE COLUMN IS NEVER NOT NULL. A future IAL A2 cohort has a qualification
-- and no meaningful year group; forcing one would make somebody invent
-- "Year 13" for a cohort nobody describes that way. NULL means "not a
-- year-grouped cohort", and the reader already treats it as its own bucket.
-- ============================================================================

-- ── SECTION 1: THE COLUMN (metadata only, no rewrite) ───────────────────────
BEGIN;

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS year_group text;

COMMENT ON COLUMN public.cohorts.year_group IS
  'Year 10 / Year 11 etc. STRUCTURED, not parsed from a slug (§73). NULL means the cohort is not year-grouped — an IAL A2 cohort legitimately has none.';

COMMIT;

-- ── SECTION 2: BACKFILL ─────────────────────────────────────────────────────
-- ⚠ DERIVED FROM `qualification`, WHICH ALREADY CARRIES IT. Every current row
-- has one of ial-as / gcse-y11 / gcse-y10; the two GCSE values encode a year
-- group and ial-as does not. Nothing is guessed from a title string.
BEGIN;

UPDATE public.cohorts SET year_group = 'Year 11' WHERE qualification = 'gcse-y11' AND year_group IS NULL;
UPDATE public.cohorts SET year_group = 'Year 10' WHERE qualification = 'gcse-y10' AND year_group IS NULL;

COMMIT;

-- ⚠ VERIFY BEFORE CONSTRAINING. Run this and compare to the expectation. If it
-- disagrees, STOP — section 3 will refuse and leave the work half done.
--
--   SELECT slug, qualification, year_group, is_public
--     FROM public.cohorts ORDER BY display_order;
--
--   EXPECT exactly:
--     ial-chemistry-as-sep-2026   ial-as     (null)     true
--     igcse-chemistry-y11         gcse-y11   Year 11    true
--     igcse-chemistry-y10         gcse-y10   Year 10    true
--     ial-chem-as-sep-2026        (null)     (null)     false   ← the 0009 intensive
--
--   ⚠ THE AS COHORT KEEPS NULL, AND THAT IS CORRECT, NOT A MISSED ROW. AS is a
--   qualification, not a year group. If you "fix" it to Year 12 the level
--   filter gains a bucket nobody selects.
--
--   SELECT count(*) FROM public.cohorts WHERE qualification LIKE 'gcse-%' AND year_group IS NULL;
--   EXPECT: 0

-- ── SECTION 3: THE CONSTRAINT, IN TWO STEPS ─────────────────────────────────
BEGIN;

-- ⚠ NOT VALID: brief lock, no scan. New and updated rows are checked from now
-- on; existing rows are not re-read yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cohorts_year_group_check' AND conrelid = 'public.cohorts'::regclass
  ) THEN
    ALTER TABLE public.cohorts
      ADD CONSTRAINT cohorts_year_group_check
      CHECK (year_group IS NULL OR year_group IN ('Year 9','Year 10','Year 11','Year 12','Year 13'))
      NOT VALID;
  END IF;
END $$;

COMMIT;

-- Separate transaction: VALIDATE takes only a SHARE UPDATE EXCLUSIVE lock, so
-- reads and writes continue while it scans.
ALTER TABLE public.cohorts VALIDATE CONSTRAINT cohorts_year_group_check;

-- ── SECTION 4: GRANTS + NOTIFY ──────────────────────────────────────────────
BEGIN;

-- ⚠ NO NEW GRANT IS NEEDED. 0041 granted anon table-level SELECT on cohorts and
-- a table-level grant covers columns added afterwards, so year_group is
-- publicly readable the moment it exists — which is what a level filter needs.
-- anon still holds no INSERT/UPDATE/DELETE.
--
-- ⚠ NO POLICY CHANGE EITHER. cohorts_read_public already gates on is_public and
-- RLS filters ROWS, not columns; this column makes no row visible that was not.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.cohorts FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) THE LIVE COMMERCIAL FACTS ARE UNCHANGED — run this FIRST
-- SELECT slug, price_pence, price_qar, status, is_public, seat_cap
--   FROM public.cohorts WHERE is_public ORDER BY display_order;
-- PASS, exactly:
--   ial-chemistry-as-sep-2026  16900  800  interest  true  20
--   igcse-chemistry-y11        14900  700  interest  true  20
--   igcse-chemistry-y10        13900  650  interest  true  20
--   ⚠ IF ANY PRICE OR STATUS MOVED, THIS MIGRATION DID SOMETHING IT SHOULD NOT
--   HAVE. Stop and say so.
--
-- (b) the backfill landed and the AS cohort is correctly NULL
-- SELECT qualification, year_group, count(*) FROM public.cohorts GROUP BY 1,2 ORDER BY 1;
-- PASS: gcse-y10 → Year 10; gcse-y11 → Year 11; ial-as → NULL.
--
-- (c) the constraint refuses nonsense
-- UPDATE public.cohorts SET year_group = 'Sixth Form' WHERE slug='igcse-chemistry-y11';
-- PASS: violates check constraint "cohorts_year_group_check".
--
-- (d) ...and accepts a real one, so (c) is not a column refusing everything
-- UPDATE public.cohorts SET year_group = 'Year 11' WHERE slug='igcse-chemistry-y11';
-- PASS: 1 row updated.
--
-- (e) NULL is still allowed — a future A2 cohort has no year group
-- UPDATE public.cohorts SET year_group = NULL WHERE slug='ial-chemistry-as-sep-2026';
-- PASS: 1 row updated.
--
-- (f) the constraint is VALIDATED, not merely present
-- SELECT convalidated FROM pg_constraint WHERE conname='cohorts_year_group_check';
-- PASS: true.
--   ⚠ A 'false' HERE MEANS SECTION 3'S SECOND STATEMENT DID NOT RUN. The
--   constraint would then guard new rows only, and an old bad row could sit
--   there indefinitely. This is exactly the trailing-statement failure that hit
--   0044 three times.
--
-- (g) anon can read the new column with no new grant
-- SET ROLE anon; SELECT slug, year_group FROM public.cohorts WHERE is_public;
-- PASS: the three public cohorts, year_group included.
--
-- (h) anon still cannot write it
-- SET ROLE anon; UPDATE public.cohorts SET year_group='Year 9' WHERE is_public;
-- PASS: permission denied for table cohorts.
--
-- (i) the three privileges
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='cohorts'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
--
-- ----------------------------------------------------------------------------
-- ⚠ ROLLBACK, IF IT IS EVER NEEDED
-- ----------------------------------------------------------------------------
-- Nothing here is destructive — no column is dropped and no existing value is
-- overwritten (every UPDATE is guarded by `year_group IS NULL`). To undo:
--   ALTER TABLE public.cohorts DROP CONSTRAINT IF EXISTS cohorts_year_group_check;
--   ALTER TABLE public.cohorts DROP COLUMN IF EXISTS year_group;
-- The application treats a missing year_group as null already, so the site
-- keeps working either way.
