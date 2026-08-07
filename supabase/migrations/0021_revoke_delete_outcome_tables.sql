-- ============================================================================
-- 0021_revoke_delete_outcome_tables.sql
--
-- ⚠ APPLIED BY HAND TO PRODUCTION 2026-08-07 ~07:09. DO NOT RE-RUN AGAINST
-- PRODUCTION — this file exists to make a rebuild from migrations match what is
-- already live, not to change it. REVOKE is idempotent, so re-running is
-- harmless, but there is nothing here to apply.
--
-- Verified against information_schema on 2026-08-07: `authenticated` holds
-- INSERT, SELECT, UPDATE on both tables and nothing else.
--
-- WHY. 0003 granted the full CRUD set to every activity table in one sweep:
--
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress        TO authenticated;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_answers TO authenticated;
--
-- DELETE is wrong on both. They are OUTCOME tables: what a student answered and
-- how far they got are records of something that happened, and a client that
-- can delete them can quietly erase evidence of its own bugs — a lost answer
-- becomes indistinguishable from an answer never given. Nothing in either
-- surface needs it; neither app contains a delete against either table.
--
-- The lesson-progress contract depends on this. It states that clients cannot
-- delete progress and that there is no client-side "reset my progress". Without
-- this file a rebuilt database would hand DELETE straight back and that
-- guarantee would silently stop being true.
--
-- If resetting progress ever becomes a product requirement it belongs in a
-- SECURITY DEFINER function with its own rules, not in a table grant.
--
-- anon is included for completeness. It was never granted anything on these
-- tables, so those two statements are no-ops — stated explicitly so a reader
-- does not have to go and check.
-- ============================================================================

BEGIN;

REVOKE DELETE ON public.student_answers FROM authenticated, anon;
REVOKE DELETE ON public.progress        FROM authenticated, anon;

COMMIT;

-- ============================================================================
-- VERIFICATION (read-only)
--
--   SELECT table_name, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND table_name IN ('progress', 'student_answers')
--      AND grantee = 'authenticated'
--    ORDER BY table_name, privilege_type;
--
-- Expect exactly six rows: INSERT, SELECT, UPDATE for each table. Any DELETE
-- row means this migration did not take.
--
-- ROLLBACK — restores the 0003 state. Do not run this without deciding what
-- deleting an outcome row is supposed to mean:
--
--   GRANT DELETE ON public.student_answers TO authenticated;
--   GRANT DELETE ON public.progress        TO authenticated;
-- ============================================================================
