-- ============================================================================
-- 0019_revoke_blanket_grants.sql
-- ----------------------------------------------------------------------------
-- Strip TRUNCATE, TRIGGER and REFERENCES from anon and authenticated on every
-- table in the public schema.
--
-- WHAT THIS TOUCHES — and, more importantly, what it does not:
--
--   * REVOKES ONLY  TRUNCATE, TRIGGER, REFERENCES.
--   * TOUCHES NO    SELECT, INSERT, UPDATE or DELETE. Not one data-access
--                   privilege is altered, so no existing query, policy path or
--                   client call changes behaviour.
--   * NO RLS CHANGE. No policy is created, dropped or edited, and row security
--                   is neither enabled nor disabled on any table.
--   * NO DDL.       No table, column, index, constraint, type, function or
--                   trigger is created, altered or dropped. The only catalog
--                   change is to ACLs in pg_class.
--   * NO service_role CHANGE. 0014 deliberately gave service_role ALL
--                   PRIVILEGES; this file never names that role, so the admin
--                   panel and every server-side script are unaffected.
--   * NO postgres/owner CHANGE. The table owner keeps everything.
--
-- WHY THESE THREE. They are the privileges that RLS cannot contain:
--
--   TRUNCATE    ROW LEVEL SECURITY DOES NOT APPLY TO TRUNCATE. A policy that
--               correctly limits DELETE to `auth.uid() = student_id` does
--               nothing here — a role holding TRUNCATE empties the whole table
--               in one statement, every row, regardless of policy. This is the
--               single most valuable line in the file.
--   TRIGGER     Lets the role attach a trigger to the table. Trigger functions
--               can be SECURITY DEFINER, so this is a route to running code
--               with someone else's privileges on every write.
--   REFERENCES  Lets the role create a foreign key pointing at the table. An
--               FK leaks whether a value exists in a column the role may not
--               read, and can block deletes the owner expects to succeed.
--
-- None of the three is ever needed by a browser client. Neither anon nor
-- authenticated has any legitimate use for them.
--
-- ---------------------------------------------------------------------------
-- THIS MAY WELL BE A NO-OP HERE, AND THAT IS FINE.
--
-- Supabase's project bootstrap normally issues blanket `GRANT ALL ON ALL
-- TABLES IN SCHEMA public TO anon, authenticated, service_role`. There is good
-- evidence it never ran on this project — 0014 exists precisely because
-- service_role held NO privileges at all and every admin query failed 42501,
-- which cannot be true if the blanket grant had been applied. 0003 then granted
-- anon and authenticated narrow, per-table privileges by hand.
--
-- So the expected outcome is "0 tables changed". Run the PRE-APPLY query below
-- to find out before you apply. Either way this is worth having: it makes the
-- absence of these privileges an asserted property rather than an accident, and
-- it is idempotent, so it can be re-run after any future blanket grant.
--
-- SAFETY. REVOKE takes ACCESS EXCLUSIVE on each table it touches, so a long
-- autovacuum or a slow query could otherwise queue the whole schema behind it.
-- lock_timeout makes it fail fast instead of stalling the live app; re-run it.
-- Revoking a privilege that is not held is silently fine.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PRE-APPLY — run this first to see what, if anything, will change
-- ----------------------------------------------------------------------------
-- Lists every table where anon or authenticated currently holds one of the
-- three. If this returns zero rows the migration is a no-op and you can still
-- apply it to lock the property in.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon', 'authenticated')
--      AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
--    ORDER BY table_name, grantee, privilege_type;
-- ----------------------------------------------------------------------------

SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;

DO $$
DECLARE
  t         record;
  n_tables  int := 0;
BEGIN
  FOR t IN
    SELECT tablename
      FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename
  LOOP
    -- format(%I) quotes the identifier, so a table named with mixed case or a
    -- reserved word is handled correctly rather than producing a syntax error
    -- halfway through the loop.
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated',
      t.tablename
    );
    n_tables := n_tables + 1;
  END LOOP;

  -- Reports tables VISITED, not privileges found: REVOKE does not say whether
  -- anything was actually held. The post-apply query below is what confirms
  -- the end state.
  RAISE NOTICE '0019: revoked TRUNCATE/TRIGGER/REFERENCES from anon and authenticated across % table(s) in public', n_tables;
END $$;

COMMIT;

-- ----------------------------------------------------------------------------
-- POST-APPLY VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) THE CHECK THAT MATTERS. Expect ZERO rows.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon', 'authenticated')
--      AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
--    ORDER BY table_name, grantee, privilege_type;
--
-- (b) DATA ACCESS IS UNCHANGED. Compare this against the same query run before
--     applying — the two results must be identical. It is the proof that
--     nothing about reading or writing rows moved.
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon', 'authenticated')
--      AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
--    ORDER BY table_name, grantee, privilege_type;
--
-- (c) service_role STILL HOLDS EVERYTHING (0014). Expect one row per table,
--     count = 7 privileges each.
--
--   SELECT table_name, count(*) AS privileges
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND grantee = 'service_role'
--    GROUP BY table_name
--    HAVING count(*) <> 7
--    ORDER BY table_name;
--   -- expect ZERO rows: every table should have all 7
--
-- (d) 0018's column-level work on profiles is untouched. Expect the twelve
--     granted columns, unchanged.
--
--   SELECT column_name
--     FROM information_schema.column_privileges
--    WHERE table_schema = 'public' AND table_name = 'profiles'
--      AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
--    ORDER BY column_name;
--
-- (e) RLS untouched — policy count per table should match what it was.
--
--   SELECT tablename, count(*) AS policies
--     FROM pg_policies WHERE schemaname = 'public'
--    GROUP BY tablename ORDER BY tablename;
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- ⚠ Restoring these grants re-opens the TRUNCATE hole RLS cannot close. There
-- is no application reason to run this; it exists only so the change is
-- reversible if something unexpected depended on the privileges.
--
-- Prefer the NARROW form — restore only the specific table that broke:
--
--   GRANT TRUNCATE, TRIGGER, REFERENCES ON public.<table> TO authenticated;
--
-- The blanket form, matching what this migration removed:
--
--   BEGIN;
--   DO $$
--   DECLARE t record;
--   BEGIN
--     FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
--       EXECUTE format(
--         'GRANT TRUNCATE, TRIGGER, REFERENCES ON public.%I TO anon, authenticated',
--         t.tablename);
--     END LOOP;
--   END $$;
--   COMMIT;
--
-- NOTE: the blanket rollback grants these on EVERY public table, including any
-- created since. If the pre-apply query returned zero rows, running it would
-- grant privileges that were never held in the first place — restoring a state
-- that never existed. Use the narrow form.
-- ----------------------------------------------------------------------------
