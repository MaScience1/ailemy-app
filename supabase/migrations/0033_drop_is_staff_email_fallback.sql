-- ============================================================================
-- 0033_drop_is_staff_email_fallback.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED 2026-08-09, by hand in the SQL Editor. This file now exists so a
--   rebuild from migrations matches what is already live.
--
--   Verification (a) below was run after applying and returned:
--       still_hardcoded = false
--   i.e. the address is gone from the function body. The behavioural half was
--   checked from real authenticated sessions rather than the SQL Editor, where
--   auth.uid() is NULL and is_staff() returns false regardless:
--       role-backed session  -> is_staff() TRUE  (saw another student's attempt
--                               through exam_attempts' `OR public.is_staff()`)
--       role-less session    -> is_staff() FALSE (0 rows)
--
--   Re-runnable: CREATE OR REPLACE plus a pre-flight that aborts rather than
--   locking anyone out, so a second run is a no-op.
--
-- The region mapper does NOT depend on this. It gates on roles directly
-- (src/lib/admin/staff.ts reads user_roles through the caller's own session),
-- which is already correct with or without this migration. This is the
-- long-flagged cleanup, written up now because Step 7 is the first thing that
-- had to decide what "admin-gated" means and found two different answers.
--
-- ============================================================================
-- WHAT IS WRONG TODAY
-- ============================================================================
-- 0027 defined is_staff() as "holds a staff role OR is this one email
-- address", and said so:
--
--     -- TEMPORARY fallback, removed in a later migration
--     OR EXISTS (
--       SELECT 1 FROM auth.users u
--        WHERE u.id = auth.uid() AND lower(u.email) = 'mascience15@gmail.com'
--     );
--
-- The address is hardcoded in SQL. Consequences, in order of severity:
--
--   1. AUTHORISATION IS NOT REVOCABLE. Removing every row from user_roles
--      leaves that account fully privileged. There is no way to take the
--      access away except another migration.
--   2. IT CANNOT BE SCOPED. is_staff() is true for a teacher, a marker and an
--      admin alike, and true for the fallback account regardless of role, so
--      any policy using it grants the union of everything.
--   3. IT DISAGREES WITH THE POLICIES THAT MATTER. 0028's writes are gated on
--      has_role('marker') OR has_role('admin') — no fallback arm. So the
--      fallback can pass a read gate and then be refused the write, which is
--      the worst shape for an authorisation bug: it looks like it works.
--   4. IT IS A CREDENTIAL IN VERSION CONTROL. A personal email address, in a
--      public-ish repo, that grants staff access to anyone who can register it
--      on a Supabase project restored from these migrations.
--
-- ============================================================================
-- ⚠ WHY THIS IS SAFE TO APPLY — VERIFIED, NOT ASSUMED
-- ============================================================================
-- Dropping the fallback locks out anyone relying on it. Checked before writing
-- this file, as the service role:
--
--     user_roles rows: 1
--     mascience15@gmail.com -> admin
--
-- So the one account the fallback exists for is ALREADY role-backed, and
-- has_role('admin') is true for it without this arm. The fallback is dead
-- weight rather than live access.
--
-- The pre-flight below re-checks that AT APPLY TIME and ABORTS if it is no
-- longer true. Do not remove it: the gap between writing this file and running
-- it is exactly where a deleted role row would turn a cleanup into a lockout,
-- and a lockout here cannot be repaired from the application.
--
-- ============================================================================
-- WHAT THIS DOES NOT DO
-- ============================================================================
-- It does not touch the APPLICATION's ADMIN_EMAIL gate. src/lib/admin/auth.ts
-- compares the session email to process.env.ADMIN_EMAIL, and src/proxy.ts and
-- the /admin layout both rely on it. That is a separate change with a real
-- blast radius (every existing admin page), and mixing it into a migration
-- would mean a schema change that silently requires a deploy to be safe.
--
-- Order, if both are wanted: apply this first (is_staff stops depending on the
-- address), THEN migrate the application gate to roles. Doing it the other way
-- round leaves a window where neither gate is the one you think it is.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Pre-flight: refuse to lock anybody out
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_admins integer;
  v_orphans text;
BEGIN
  SELECT count(*) INTO v_admins
    FROM public.user_roles WHERE role = 'admin';
  IF v_admins = 0 THEN
    RAISE EXCEPTION
      'ABORTING: no user_roles row with role=admin exists. Dropping the fallback would leave nobody able to administer this project, and it cannot be undone from the application. Grant the role first.';
  END IF;

  -- Anyone who is staff ONLY by virtue of the fallback loses access today.
  SELECT string_agg(u.email, ', ') INTO v_orphans
    FROM auth.users u
   WHERE lower(u.email) = 'mascience15@gmail.com'
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = u.id
          AND ur.role IN ('teacher', 'marker', 'admin')
     );
  IF v_orphans IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORTING: % is staff ONLY through the email fallback and holds no role. Applying this would lock that account out. Insert a user_roles row first.', v_orphans;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- The whole change: one arm removed
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role IN ('teacher', 'marker', 'admin')
  );
$$;

COMMENT ON FUNCTION public.is_staff() IS
  'True if the session holds any internal staff role (teacher/marker/admin). COARSE — prefer has_role() in new policies. The temporary ADMIN_EMAIL fallback from 0027 was removed by 0033; authorisation is now revocable by deleting a user_roles row, and no address is hardcoded in SQL.';

COMMIT;


-- ============================================================================
-- VERIFICATION — run after applying
-- ============================================================================
-- (a) The address is gone from the function body. MUST return false.
--
--   SELECT pg_get_functiondef(p.oid) ILIKE '%mascience15%' AS still_hardcoded
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'is_staff';
--
-- (b) The admin still resolves as staff — BOTH halves, or neither.
--     Half 1 proves the role row exists; half 2 proves the function sees it.
--
--   SELECT u.email, ur.role
--     FROM auth.users u JOIN public.user_roles ur ON ur.user_id = u.id
--    WHERE ur.role = 'admin';
--   -- expect at least one row
--
--   -- then, signed in as that account (not as postgres — is_staff() reads
--   -- auth.uid(), which is NULL in the SQL editor):
--   SELECT public.is_staff();   -- expect true
--
--   ⚠ SELECT public.is_staff() run as postgres returns FALSE and proves
--     nothing. auth.uid() is null there. A false from the SQL editor is not
--     evidence the change broke anything.
--
-- (c) Nothing else moved. Expect the same 20 policies 0028 created.
--
--   SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
--    AND tablename IN ('paper_questions','question_regions','mark_scheme_items',
--                      'examiner_report_insights','model_answers','exam_attempts',
--                      'question_attempts','student_responses','marking_results');
-- ============================================================================


-- ============================================================================
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- Reinstates the hardcoded address. Only reason to run it is a lockout that
-- the pre-flight should have prevented.
-- ============================================================================
--   CREATE OR REPLACE FUNCTION public.is_staff()
--   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
--   SET search_path = public, pg_temp
--   AS $fn$
--     SELECT EXISTS (
--       SELECT 1 FROM public.user_roles ur
--        WHERE ur.user_id = auth.uid()
--          AND ur.role IN ('teacher', 'marker', 'admin')
--     ) OR EXISTS (
--       SELECT 1 FROM auth.users u
--        WHERE u.id = auth.uid() AND lower(u.email) = 'mascience15@gmail.com'
--     );
--   $fn$;
-- ============================================================================
