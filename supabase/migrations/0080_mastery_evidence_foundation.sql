-- ============================================================================
-- 0080 — MASTERY EVIDENCE FOUNDATION (Service 3, Phase 0/1)
--
-- ⚠ APPLIED 2026-09-03 by the project owner in the Supabase SQL Editor, and
--   VERIFIED the same day. Post-apply results, as reported by the owner:
--     A. assessed_out_of exists (integer, nullable)            = 1  ✓
--     B. lpans_attempt_idx exists                              = 1  ✓
--     C. dead-trio client grants remaining (anon/authenticated) = 0  ✓
--     D. TRUNCATE/TRIGGER/REFERENCES grants repo-wide           = 0  ✓
--     E. question_attempts_assessed_within_tariff CHECK exists  = 1  ✓
--   (E was the owner's own addition to the four header checks — it confirms
--   the CHECK constraint by name, which check A alone does not.)
--   The number 0080 was allocated by the project owner in the Service 3
--   planning conversation (2026-09-03); 0079 is Hydrogen's (chatbox
--   client-write revoke). This file sat as 0080_PROPOSED_… until the apply,
--   per the standing rule (the 0033/0069 procedure).
--
-- WHY THIS MIGRATION EXISTS
--   Service 3's mastery map reads ONE evidence source today: lesson-practice
--   answers (0065), which carry a spec_code. Marked exam questions (0028)
--   carry marks but no assessed tariff and no spec linkage, so they cannot
--   feed masteryFor() honestly — aggregating awarded_marks against max_marks
--   would charge students for marks the MARKER could not reach (the exact
--   gradeFor defect academic.ts documents). This migration adds the one
--   column that fixes that, the one index the evidence read has always
--   lacked, and closes a standing grant hole on three dead tables.
--
--   Deliberately NOT here: no new tables. Mastery state, history, retention
--   and retrieval are all derived from the append-only attempt tables at
--   read time; a stored-state table is Phase 2+ material and only if
--   measured performance demands one.
--
-- CONTENTS
--   1. question_attempts.assessed_out_of — the tariff the marker actually
--      assessed for the awarded_marks figure it wrote. NULL means "marked
--      before this column existed, or not marked": the marking layer
--      (src/lib/exam/marking.ts persist/clearMark) writes it on every run,
--      and marking is idempotent and re-runs on each results-page view, so
--      old attempts self-heal on their next view. No backfill is needed and
--      none is attempted — inventing an assessed tariff for historical rows
--      would be exactly the invention the column exists to prevent.
--   2. lesson_practice_answers(attempt_id) index — loadPracticeEvidence()
--      reads answers by attempt_id IN (...); the table's only index today is
--      content-leading (spec_code, family_key), so every mastery-map load
--      walks the heap.
--   3. REVOKE ALL on generated_questions / student_answers / ai_marks — the
--      0001 AI-question trio. Zero readers and zero writers anywhere in src/
--      or scripts/ (verified 2026-09-03 by repo-wide grep), yet 0003 granted
--      authenticated S/I/U/D on all three. The tables and any data stay (a
--      DROP is not this migration's decision); the client surface goes.
--
-- SAFETY
--   * ADD COLUMN nullable, no default, no rewrite — metadata-only on PG11+.
--   * CREATE INDEX on lesson_practice_answers: the table is small today
--     (per-student practice rows); plain CREATE INDEX is fine in the SQL
--     Editor. If it ever runs against a large table, use CONCURRENTLY
--     outside a transaction instead.
--   * REVOKEs are reversible with GRANT; nothing is dropped.
--
-- VERIFY AFTER APPLYING (expected results in comments):
--
--   -- a. column exists, nullable integer
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'question_attempts' AND column_name = 'assessed_out_of';
--   -- 1 row: integer, YES
--
--   -- b. index exists
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'lesson_practice_answers'
--      AND indexname = 'lpans_attempt_idx';
--   -- 1 row
--
--   -- c. dead-trio client grants are gone
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND table_name IN ('generated_questions', 'student_answers', 'ai_marks')
--      AND grantee IN ('anon', 'authenticated');
--   -- 0 rows
--
--   -- d. the standing REVOKE rule still holds repo-wide
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon', 'authenticated')
--      AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES');
--   -- 0 rows
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The assessed tariff, beside the awarded marks it qualifies
-- ----------------------------------------------------------------------------
-- assessedOutOf has existed in the marking layer's MarkedQuestion since the
-- engine was built, and academic.ts's AssessedQuestion has required it from
-- day one ("assessedOutOf IS NOT maxMarks, AND THE DIFFERENCE IS THE WHOLE
-- POINT"). It was simply never persisted. The CHECK is same-row and total:
-- a negative tariff and a tariff above the snapshotted max are both marker
-- bugs, and unlike 0028's awarded_marks note (which declined a cap because
-- the marking layer owns the clamp-and-log), a breach HERE has no legitimate
-- reading — failing the write loudly is the PersistError philosophy.
ALTER TABLE public.question_attempts
  ADD COLUMN assessed_out_of integer
  CONSTRAINT question_attempts_assessed_within_tariff
    CHECK (
      assessed_out_of IS NULL
      OR (assessed_out_of >= 0 AND assessed_out_of <= max_marks)
    );

COMMENT ON COLUMN public.question_attempts.assessed_out_of IS
  'Tariff the marker actually assessed for the awarded_marks it wrote — never the full max_marks unless every mark was reachable. NULL = not marked, or marked before 0080 (self-heals on the next idempotent marking run). Written only by the service-role marking layer, like awarded_marks. Mastery evidence uses awarded_marks / assessed_out_of, never awarded_marks / max_marks.';

-- No client grant is added: 0032/0037 column-scoped the authenticated UPDATE
-- grants on this table deliberately, and assessed_out_of is service-role
-- territory exactly as awarded_marks is.

-- ----------------------------------------------------------------------------
-- 2. The evidence read's missing index
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS lpans_attempt_idx
  ON public.lesson_practice_answers (attempt_id);

-- ----------------------------------------------------------------------------
-- 3. Close the dead 0001 trio's client surface
-- ----------------------------------------------------------------------------
-- generated_questions → student_answers → ai_marks were 0001's AI-question
-- pipeline. Nothing in the application has ever shipped against them; the
-- interactive-exam spine (0028) and lesson practice (0065) superseded the
-- design. 0003's blanket S/I/U/D grants to authenticated outlived the
-- feature. RLS policies remain in place (harmless without a grant, and
-- grants-before-RLS means this REVOKE alone closes the surface).
REVOKE ALL ON public.generated_questions FROM anon, authenticated;
REVOKE ALL ON public.student_answers     FROM anon, authenticated;
REVOKE ALL ON public.ai_marks            FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. The standing rule, restated for the tables this migration touches
-- ----------------------------------------------------------------------------
-- 0026 (default-privilege fix) was never applied, so every migration repeats
-- the REVOKE by hand. These two tables already carry it (0028, 0065); the
-- repetition is belt-and-braces and idempotent.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.question_attempts       FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_practice_answers FROM anon, authenticated;

COMMIT;
