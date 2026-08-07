-- ============================================================================
-- 0019_revoke_blanket_grants.sql
-- ----------------------------------------------------------------------------
-- Revoke TRUNCATE, TRIGGER and REFERENCES from anon and authenticated on every
-- table in the public schema.
--
-- ---------------------------------------------------------------------------
-- SCOPE — exactly what this file does, and everything it does not
-- ---------------------------------------------------------------------------
-- REVOKES, and only these three:
--     TRUNCATE, TRIGGER, REFERENCES
-- FROM, and only these two roles:
--     anon, authenticated
-- ON:
--     every table returned by pg_tables where schemaname = 'public'
--
-- IT DOES NOT:
--   * touch SELECT, INSERT, UPDATE or DELETE. No data-access privilege is
--     altered, so no existing query, client call or policy path changes
--     behaviour.
--   * touch column-level grants. 0018's per-column UPDATE on profiles is
--     unaffected — column ACLs are held separately from table ACLs, and
--     nothing here names a column.
--   * touch RLS. No policy is created, dropped or altered; row security is
--     neither enabled nor disabled anywhere.
--   * perform DDL. No table, column, index, constraint, type, function,
--     trigger, sequence or view is created, altered or dropped.
--   * touch data. Not one row is read, written or deleted.
--   * name postgres, service_role, supabase_admin, or any role other than
--     anon and authenticated. Table owners keep everything; 0014's ALL
--     PRIVILEGES for service_role is untouched, so the admin panel and every
--     server-side script continue to work.
--
-- The only catalog change is to the relacl column of pg_class.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
-- An early blanket GRANT ALL across public handed anon and authenticated the
-- full privilege set. The audit confirms both roles currently hold TRUNCATE,
-- TRIGGER and REFERENCES on every table. These are the three that row level
-- security cannot contain:
--
--   TRUNCATE    RLS DOES NOT APPLY TO TRUNCATE. A policy that correctly limits
--               DELETE to `auth.uid() = student_id` is irrelevant to it: a role
--               holding TRUNCATE empties the entire table in one statement,
--               every row, whatever the policies say. This is the line that
--               matters.
--   TRIGGER     Permits attaching a trigger to the table. Trigger functions can
--               be SECURITY DEFINER, making this a route to executing code with
--               another role's privileges on every write.
--   REFERENCES  Permits creating a foreign key against the table, which leaks
--               whether a value exists in a column the role cannot read, and can
--               block deletes the owner expects to succeed.
--
-- Not reachable through PostgREST today — it exposes no DDL or TRUNCATE verb —
-- so this is defence in depth rather than an open door. But the privilege has
-- no legitimate use from a browser client, and "unreachable through the API we
-- currently run" is a property of the API, not of the database. Anything that
-- ever opens a direct Postgres connection with these roles inherits the defect.
--
-- CORRECTION TO THE EARLIER DRAFT OF THIS FILE: it asserted this would probably
-- be a no-op, reasoning that Supabase's blanket bootstrap grant could not have
-- run because 0014 was needed to give service_role privileges it lacked. The
-- audit disproves that — the grants are present. The inference was wrong; the
-- measurement stands.
--
-- ---------------------------------------------------------------------------
-- SAFETY
-- ---------------------------------------------------------------------------
-- REVOKE takes ACCESS EXCLUSIVE on each table, so a long-running query or an
-- autovacuum could otherwise queue the whole schema behind this. lock_timeout
-- makes it fail fast and roll back cleanly instead of stalling the live app;
-- if it times out, just re-run it.
--
-- No IF EXISTS guard anywhere, deliberately. A guard that skipped a table would
-- leave the privilege in place on exactly the table it silently passed over,
-- and the run would still report success. Revoking a privilege that is not held
-- is already a no-op in Postgres, so the guard buys nothing and costs the
-- guarantee that every table was visited.
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;

DO $$
DECLARE
  t        record;
  n_tables int := 0;
BEGIN
  FOR t IN
    SELECT tablename
      FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename
  LOOP
    -- %I quotes the identifier, so a table named with mixed case, a hyphen or
    -- a reserved word is handled correctly rather than aborting the loop with
    -- a syntax error partway through the schema.
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated',
      t.tablename
    );
    n_tables := n_tables + 1;
  END LOOP;

  -- Counts tables VISITED, not privileges actually removed — REVOKE does not
  -- report whether anything was held. The verification query below is what
  -- establishes the end state.
  RAISE NOTICE '0019: visited % table(s) in public; revoked TRUNCATE, TRIGGER, REFERENCES from anon and authenticated', n_tables;
END $$;

COMMIT;


-- ============================================================================
-- VERIFICATION — run before and after, and diff the two results
-- ============================================================================
-- Grouped by table_name and grantee so the before/after diff is line-per-table
-- rather than a wall of individual privilege rows.
--
-- BEFORE: every table should list TRUNCATE, TRIGGER and REFERENCES among its
-- privileges for both roles.
-- AFTER:  those three are gone from every line; SELECT/INSERT/UPDATE/DELETE
--         appear exactly as they did before.
--
--   SELECT table_name,
--          grantee,
--          string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
--     FROM information_schema.table_privileges
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon', 'authenticated')
--    GROUP BY table_name, grantee
--    ORDER BY table_name, grantee;
--
-- ----------------------------------------------------------------------------
-- The single assertion that this migration worked. Expect ZERO rows after.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.table_privileges
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon', 'authenticated')
--      AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
--    ORDER BY table_name, grantee, privilege_type;
--
-- ----------------------------------------------------------------------------
-- Nothing else moved. Each of these should be identical before and after.
--
--   -- (a) service_role still holds all 7 privileges on every table (0014)
--   SELECT table_name, count(*) AS privileges
--     FROM information_schema.table_privileges
--    WHERE table_schema = 'public' AND grantee = 'service_role'
--    GROUP BY table_name
--   HAVING count(*) <> 7
--    ORDER BY table_name;
--   -- expect ZERO rows
--
--   -- (b) 0018's column-level UPDATE grants on profiles are intact
--   SELECT column_name
--     FROM information_schema.column_privileges
--    WHERE table_schema = 'public' AND table_name = 'profiles'
--      AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
--    ORDER BY column_name;
--   -- expect the twelve columns granted by 0018
--
--   -- (c) RLS policies untouched
--   SELECT tablename, count(*) AS policies
--     FROM pg_policies WHERE schemaname = 'public'
--    GROUP BY tablename ORDER BY tablename;
-- ============================================================================


-- ============================================================================
-- ROLLBACK — present for completeness, NOT desirable
-- ============================================================================
-- ⚠ ROLLING THIS BACK RESTORES THE ORIGINAL DEFECT.
--
-- Re-granting TRUNCATE to anon hands an unauthenticated role the ability to
-- empty any table in the schema, and RLS cannot stop it. That is precisely the
-- condition this migration exists to remove. There is no application feature
-- that requires TRUNCATE, TRIGGER or REFERENCES from a browser client, so a
-- rollback should never be run to "restore normal behaviour" — normal behaviour
-- does not use these privileges.
--
-- This section exists for one case only: the revoke breaks something genuinely
-- unexpected, and the fix cannot wait. Even then, prefer the narrow form —
-- restore the one privilege on the one table that broke, to the one role that
-- needs it, and open an issue explaining why a client needs a DDL-class
-- privilege:
--
--   GRANT TRIGGER ON public.<table> TO authenticated;
--
-- The blanket form, which undoes this migration wholesale, is deliberately NOT
-- written out as a runnable block. If you genuinely need it, it is the loop
-- above with REVOKE replaced by GRANT and FROM replaced by TO — write it
-- consciously rather than pasting it reflexively.
-- ============================================================================
