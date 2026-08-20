-- ============================================================================
-- 0043_PROPOSED_interest_demand_fields.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-19 by the founder in the SQL Editor.
-- Renamed from 0043_PROPOSED_ once verified, per the standing rule that a file
-- must not claim to be unapplied once it is live.
--
-- VERIFICATION RESULT — 7 of the 7 runnable checks PASSED against production:
--
--   (a) year_group, exam_year and student_notes are all selectable ✓
--   (b) anon INSERT carrying all three succeeds with NO new grant ✓
--       …and all three round-trip: {"year_group":"AS","exam_year":2027,
--       "student_notes":"probe note"} ✓
--   (c) anon SELECT still refused, 42501 permission denied ✓
--       ⚠ CHECKED AS AN ERROR, NOT AS A ZERO. A 0-row answer here would mean a
--       SELECT grant had appeared and RLS merely filtered — a weaker posture
--       wearing a passing badge. The error is the proof.
--   (d) exam_year 202 refused BY interest_registrations_exam_year_plausible,
--       23514 naming the constraint ✓
--   (e) …and 2027 accepted, so (d) is not a column that refuses everything ✓
--   (f) both probe rows deleted by their captured ids, count=1 each; table
--       returned to 0 rows ✓
--
--   ⚠ (g) THE THREE PRIVILEGES WAS NOT RUN AND IS NOT CLAIMED.
--   information_schema.role_table_grants is not exposed through PostgREST and
--   TRUNCATE/TRIGGER/REFERENCES cannot be exercised over REST, so there is no
--   behavioural substitute. Block (g) still needs the SQL Editor.
--
--   ⚠ (a) IS BEHAVIOURAL, NOT THE CATALOG. data_type and is_nullable could not
--   be READ for the same reason; the columns were written and read back
--   instead. Weaker than the query block (a) specifies.
--
-- The public form now renders all three: /tuition/interest carries 18 named
-- inputs, up from 15, gated on the live capability probe rather than on a flag.
--
-- ⚠ ADDITIVE ONLY, THREE NULLABLE COLUMNS. interest_registrations already
-- exists (0040) and already carries subject, qualification, exam_board,
-- exam_session, names, contact, country, timezone, grades, preferred times,
-- ready_to_start, consent and status. §51 asks for three facts it has nowhere
-- to put.
--
--   year_group   §42/§52 group demand by Year 10 / Year 11 / AS / A2. Today
--                that is smuggled inside `qualification`, so "Year 11" and
--                "IGCSE" are the same column and the demand dashboard cannot
--                tell a Y11 IGCSE student from a Y10 one.
--   exam_year    when they sit it. Distinguishes a cohort that must open in
--                September from one that can wait a year — the single most
--                useful field for deciding which cohort to open next.
--   notes        §51's "optional notes". Free text from the family, kept
--                separate from the operator's `notes`… which does not exist:
--                0040 has an operational `notes` column and NOTHING writes to
--                it. See the naming note below.
--
-- ⚠ THE NAMING COLLISION, AND WHY THE NEW COLUMN IS student_notes.
-- 0040 already declares `notes text` as an OPERATIONAL field — the staff
-- scratchpad beside `status`. Nothing writes to it yet, so it would have been
-- easy to reuse for the family's message. That would be two authors in one
-- column: a public form writing where staff write, with no way afterwards to
-- tell which sentence came from a parent and which from us. The new column is
-- student_notes, written only by the form; `notes` stays staff-only.
-- ============================================================================

BEGIN;

ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS year_group    text,
  ADD COLUMN IF NOT EXISTS exam_year     smallint,
  ADD COLUMN IF NOT EXISTS student_notes text;

COMMENT ON COLUMN public.interest_registrations.year_group IS
  'Year 10 / Year 11 / AS / A2 etc. Separate from qualification: a Year 11 and a Year 10 student can both be IGCSE, and the demand dashboard has to tell them apart.';
COMMENT ON COLUMN public.interest_registrations.exam_year IS
  'Calendar year they sit the exam. Decides which cohort must open first.';
COMMENT ON COLUMN public.interest_registrations.student_notes IS
  'Free text FROM THE FAMILY, written by the public form. Distinct from notes, which is the staff scratchpad and is never written by a visitor.';

-- ⚠ A SANITY BOUND, NOT A BUSINESS RULE. exam_year exists to be grouped and
-- sorted; a typo'd 202 or 20255 makes a demand table unreadable and is never a
-- real answer. Wide enough that no plausible entry is refused.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'interest_registrations_exam_year_plausible'
       AND conrelid = 'public.interest_registrations'::regclass
  ) THEN
    ALTER TABLE public.interest_registrations
      ADD CONSTRAINT interest_registrations_exam_year_plausible
      CHECK (exam_year IS NULL OR (exam_year >= 2024 AND exam_year <= 2040));
  END IF;
END $$;

-- ⚠ NO NEW GRANT AND NO NEW POLICY, AND THAT IS THE WHOLE POINT.
-- 0040 gave anon INSERT and NO SELECT — deliberately, because this table is
-- PII. A table-level INSERT grant covers columns added later, so the form can
-- write these three immediately. anon still cannot read one row of it, and
-- nothing here changes that. Reading stays staff-only via
-- interest_registrations_staff_all.
--
-- ⚠ RE-ASSERTED PER AGENTS.md. Cheap, and this migration touches the table.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.interest_registrations FROM anon, authenticated;

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ----------------------------------------------------------------------------
-- (a) the three columns exist and are nullable
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_name='interest_registrations'
--    AND column_name IN ('year_group','exam_year','student_notes') ORDER BY column_name;
-- PASS: three rows, all is_nullable = YES.
--   ⚠ NULLABLE MATTERS. Every row written before this migration has no answer
--   for any of them, and a NOT NULL would have made this migration fail on a
--   populated table — or worse, invented a default answer for real families.
--
-- (b) anon can still INSERT, now including the new columns
-- SET ROLE anon;
-- INSERT INTO public.interest_registrations
--   (subject, qualification, student_name, email, consent_to_contact, consent_at,
--    year_group, exam_year, student_notes)
--   VALUES ('biology','ial-as','probe','probe@example.test', true, now(),
--           'AS', 2027, 'probe note');
-- PASS: one row inserted, with no new grant issued.
--
-- (c) anon STILL cannot read — the property 0040 exists to protect
-- SET ROLE anon; SELECT count(*) FROM public.interest_registrations;
-- PASS: permission denied for table interest_registrations.
--   ⚠ A "0" IS A FAILURE HERE, not a pass — it would mean a SELECT grant now
--   exists and RLS merely filtered. The error is the proof.
--
-- (d) a nonsense exam_year is refused
-- SET ROLE anon; INSERT INTO public.interest_registrations
--   (subject, qualification, student_name, email, consent_to_contact, consent_at, exam_year)
--   VALUES ('biology','ial-as','probe2','probe2@example.test', true, now(), 202);
-- PASS: violates check constraint "interest_registrations_exam_year_plausible".
--
-- (e) …and a real one is accepted, without which (d) proves only that the
--     column rejects everything
-- (same insert with exam_year 2027) PASS: inserted.
--
-- (f) cleanup — by the ids created, never a sweep
-- RESET ROLE;
-- DELETE FROM public.interest_registrations WHERE email IN ('probe@example.test','probe2@example.test');
--
-- (g) the three privileges are gone
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='interest_registrations'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
