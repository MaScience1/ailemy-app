-- ============================================================================
-- 0026 — public schema: stop granting TRUNCATE, TRIGGER, REFERENCES on every
--        new table to anon and authenticated
-- ============================================================================
--
-- ⚠ NOT YET APPLIED, AND NOT YET DECIDED. The _PROPOSED_ in the filename was
--   the only thing saying so; it is said here too now, because a filename is
--   not read by someone who already has the file open.
--
--   AN ATTEMPT TO DECIDE IT WAS MADE ON 2026-08-11 AND COULD NOT BE COMPLETED,
--   which is recorded so nobody spends the same hour twice:
--
--   * Section 2 cannot be run from this repository. It reads pg_default_acl,
--     pg_namespace, pg_class, pg_roles and information_schema; PostgREST
--     exposes only `public`, and all five return PGRST205. There is no
--     DATABASE_URL, no psql and no pg driver here. Tested, not assumed.
--   * The repository cannot answer it indirectly either. Every one of the
--     fifteen tables created after 0019's snapshot sweep carries its OWN
--     revoke — user_roles in 0027, nine in 0028, one in 0031, three in 0035.
--     So a clean catalogue today is FULLY EXPLAINED by those revokes and is
--     exactly what you would see whether the default ACL is still set or not.
--   * The one data point that is informative points at the hole being OPEN:
--     `announcements` was created by 0022 with no revoke, and 0025 records
--     finding that both roles held all three on it. Nothing since has tested
--     the default, because everything since has revoked defensively.
--
--   So reading (a) below — never applied, gap in the folder is the whole story
--   — is not ruled out. Section 2(a) run in the SQL Editor is what decides.
--
-- ⚠ RECONSTRUCTED, NOT TRANSCRIBED. This file was written to close the 0026 gap
--   in this folder. The author could NOT read production's `pg_default_acl`:
--   the reconstruction was done from a mobile client, and PostgREST exposes no
--   pg_catalog. So this is what the evidence in this repo implies 0026 did —
--   it is not a copy of what ran.
--
--   TREAT SECTION 2 AS THE AUTHORITY, NOT THIS FILE. Run it first. If
--   production already matches the end state, apply nothing and record that.
--   If it does not, this file is the change that gets it there.
--
-- ⚠ AND ONE PIECE OF EVIDENCE POINTS THE OTHER WAY. 0028 — written after this
--   number — still says, in its own words:
--
--     "Supabase's default privileges grant TRUNCATE, TRIGGER and REFERENCES to
--      anon and authenticated on every new table. 0019 swept a snapshot and
--      cannot reach these."
--
--   and then revokes per-table on all nine of its tables. If 0026 had done what
--   its name says, that comment would be stale and those revokes redundant.
--   Three readings, and section 2 tells you which:
--     (a) 0026 was never applied — the gap in this folder is the whole story;
--     (b) 0026 was applied but targeted the wrong grantor role (see section 1),
--         so it reported success and changed nothing;
--     (c) it worked, and 0028 is belt-and-braces by a cautious author.
--   Do not assume (c) because it is the comfortable one.
--
-- ⚠ EXECUTED, NOT JUST WRITTEN. Section 3 was run verbatim against a real
--   PostgreSQL 18.3 (PGlite, local, in-process) seeded with Supabase's shipped
--   default (`GRANT ALL ON TABLES TO anon, authenticated, service_role`) plus a
--   pre-existing table. Measured:
--
--     before — a newly created table:  anon and authenticated both hold
--                                      TRUNCATE, TRIGGER, REFERENCES
--     before — the existing table:     authenticated holds TRUNCATE
--     after  — a newly created table:  all six false
--     after  — the existing table:     TRUNCATE gone
--     after  — service_role:           untouched, 0014 intact
--
--   That proves the DDL parses, runs, and does what it says on a database of
--   the same major family. It does NOT prove production's default-ACL entries
--   have the same grantor roles — section 2(a) is still the thing that decides.
--
-- ============================================================================
-- 1. WHAT THIS IS FOR
-- ============================================================================
-- Supabase ships default privileges that GRANT ALL on new tables in `public` to
-- anon and authenticated. ALL includes TRUNCATE, TRIGGER and REFERENCES.
--
--   * TRUNCATE IS NOT FILTERED BY RLS. A row-level policy is irrelevant to it:
--     the statement empties the table. An authenticated user holding it can
--     destroy a table's contents in one statement, and no policy stops them.
--   * TRIGGER lets a client attach a function of their choosing to a table,
--     which runs with the privileges of whoever writes to it afterwards.
--   * REFERENCES lets a client create an FK against the table, which can be
--     used to probe values they cannot select.
--
-- 0019 revoked all three across a SNAPSHOT of public. It could not reach tables
-- that did not exist yet, and that is the recurring cost: every table created
-- since has arrived holding them again, and every migration since has had to
-- remember to clean up after itself — 0025 for `announcements`, 0028 for nine
-- exam tables. One forgotten REVOKE is a table anyone can TRUNCATE.
--
-- THIS FILE REMOVES THE SOURCE rather than the symptom.
--
-- THE SUBTLETY THAT MAKES THIS EASY TO GET WRONG, and the likely reading (b)
-- above: default privileges are keyed on (GRANTOR ROLE, SCHEMA, OBJECT TYPE).
-- `ALTER DEFAULT PRIVILEGES ... REVOKE ...` with no FOR ROLE clause applies to
-- the CURRENT role only, and it removes a matching entry — if the grant that
-- exists was made by a DIFFERENT role, the statement matches nothing, succeeds,
-- and changes nothing. It does not warn. Section 3 therefore loops over every
-- grantor that actually has such an entry rather than assuming `postgres`.
--
-- ============================================================================
-- 2. VERIFY BEFORE APPLYING — read-only. RUN THIS FIRST.
-- ----------------------------------------------------------------------------
-- ⚠ COMMENTED OUT ON PURPOSE. COPY A QUERY OUT AND UNCOMMENT IT; DO NOT PASTE
--   THIS FILE TO "JUST LOOK".
--
--   These three SELECTs used to be live SQL sitting in the same file as the
--   migration, above a section 3 that was also live. So the file said "VERIFY
--   BEFORE APPLYING — RUN THIS FIRST" while pasting it did both, in order,
--   with no pause between deciding and doing. The heading was an instruction
--   to the reader that the file itself did not follow.
--
--   Now nothing in section 2 executes, and section 3 refuses to run unless
--   somebody has said so out loud — see the guard immediately above it. The
--   two halves of "inspect, then decide" cannot be performed by one paste.
-- ============================================================================

-- (a) WHAT THE DEFAULTS ACTUALLY ARE, per grantor role. This is the query the
--     whole file turns on. `defaclacl` entries read as grantee=privs/grantor,
--     where the privilege letters include D = TRUNCATE, t = TRIGGER,
--     x = REFERENCES.
-- SELECT
--   pg_get_userbyid(d.defaclrole) AS granted_by_role,
--   n.nspname                     AS schema,
--   d.defaclobjtype               AS object_type,   -- r table, S sequence, f function
--   d.defaclacl                   AS access_list
-- FROM pg_default_acl d
-- JOIN pg_namespace n ON n.oid = d.defaclnamespace
-- WHERE n.nspname = 'public'
-- ORDER BY granted_by_role, object_type;

-- (b) WHICH EXISTING TABLES STILL CARRY ANY OF THE THREE. Expect zero rows if
--     0019, 0025 and 0028 between them covered everything. Any row here is a
--     table someone can TRUNCATE today, and section 3's sweep fixes it.
-- SELECT c.relname AS table_name,
--        array_agg(DISTINCT a.privilege_type ORDER BY a.privilege_type) AS still_held,
--        array_agg(DISTINCT a.grantee ORDER BY a.grantee)               AS by_role
-- FROM information_schema.role_table_grants a
-- JOIN pg_class     c ON c.relname = a.table_name
-- JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = a.table_schema
-- WHERE a.table_schema = 'public'
--   AND a.grantee IN ('anon', 'authenticated')
--   AND a.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
-- GROUP BY c.relname
-- ORDER BY c.relname;

-- (c) The same question without going through information_schema, which is
--     FILTERED to roles the caller belongs to — an empty result from (b) means
--     "nothing visible to me", not "nothing there". This one cannot come back
--     falsely empty.
-- SELECT c.relname AS table_name,
--        r.rolname AS role,
--        has_table_privilege(r.rolname, c.oid, 'TRUNCATE')   AS truncate_,
--        has_table_privilege(r.rolname, c.oid, 'TRIGGER')    AS trigger_,
--        has_table_privilege(r.rolname, c.oid, 'REFERENCES') AS references_
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- CROSS JOIN pg_roles r
-- WHERE n.nspname = 'public' AND c.relkind = 'r'
--   AND r.rolname IN ('anon', 'authenticated')
--   AND (has_table_privilege(r.rolname, c.oid, 'TRUNCATE')
--     OR has_table_privilege(r.rolname, c.oid, 'TRIGGER')
--     OR has_table_privilege(r.rolname, c.oid, 'REFERENCES'))
-- ORDER BY c.relname, r.rolname;

-- ============================================================================
-- 3. THE CHANGE
-- ============================================================================
-- Idempotent in both halves: ALTER DEFAULT PRIVILEGES ... REVOKE on an entry
-- that is already gone is a no-op, and so is REVOKE on a table that no longer
-- holds the privilege.

-- ----------------------------------------------------------------------------
-- ⚠ THE TRIPWIRE. SECTION 3 WILL NOT RUN BY ACCIDENT.
-- ----------------------------------------------------------------------------
-- Commenting section 2 out stops an inspection becoming an application only if
-- nobody pastes the file anyway. This makes it structural: applying now takes a
-- deliberate second statement that says what you are about to do.
--
-- To apply, run this line FIRST, in the same session:
--
--   SET ailemy.apply_0026 = 'yes';
--
-- Then paste from here down. Without it the DO block below raises and the
-- transaction never opens, so the file is safe to paste, read, and abandon.
--
-- ⚠ current_setting(..., true) — THE `true` IS THE MISSING-OK FLAG. Without it
--   an unset variable raises 42704 instead of returning NULL, which would still
--   stop the migration but for a reason nobody could read.
DO $guard$
BEGIN
  IF current_setting('ailemy.apply_0026', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION
      '0026 was pasted without being asked for. Nothing has been changed.'
      USING HINT = 'This file is BOTH the inspection queries and the migration. '
                || 'Run section 2 first and decide. To apply, run '
                || 'SET ailemy.apply_0026 = ''yes''; in this session, then paste again.';
  END IF;
END $guard$;

SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;

-- 3a. FUTURE TABLES. Loops over every grantor that actually has a default-ACL
--     entry for `public`, rather than assuming it is `postgres`. Assuming is
--     reading (b) at the top of this file: a REVOKE aimed at the wrong grantor
--     succeeds and changes nothing.
DO $$
DECLARE
  r        record;
  n_roles  int := 0;
  problems text[] := '{}';
BEGIN
  FOR r IN
    SELECT DISTINCT pg_get_userbyid(d.defaclrole) AS grantor
      FROM pg_default_acl d
      JOIN pg_namespace n ON n.oid = d.defaclnamespace
     WHERE n.nspname = 'public'
       AND d.defaclobjtype = 'r'
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
        'REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated',
        r.grantor
      );
      n_roles := n_roles + 1;
    EXCEPTION WHEN insufficient_privilege THEN
      -- Collected, not swallowed. Altering another role's default privileges
      -- needs membership of that role; if we lack it the entry is STILL THERE
      -- and this migration has not done its job for that grantor.
      problems := problems || format('%s (not a member of this role)', r.grantor);
    END;
  END LOOP;

  RAISE NOTICE '0026: cleared default TRUNCATE/TRIGGER/REFERENCES for % grantor role(s)', n_roles;

  IF cardinality(problems) > 0 THEN
    RAISE EXCEPTION '0026: could not alter default privileges for: %',
                    array_to_string(problems, ', ')
      USING HINT = 'Re-run as a role that is a member of those roles, or have '
                || 'Supabase support clear the entry. Leaving it means the next '
                || 'table created by that role arrives TRUNCATE-able.';
  END IF;
END $$;

-- 3b. EXISTING TABLES. 0019 swept a snapshot and 0025/0028 patched their own;
--     this re-sweep makes the file self-consistent, so applying it leaves the
--     database in the state this file describes rather than that state minus
--     whatever was created in between. Same shape as 0019 on purpose.
DO $$
DECLARE
  t        record;
  n_tables int := 0;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated',
      t.tablename
    );
    n_tables := n_tables + 1;
  END LOOP;
  RAISE NOTICE '0026: re-swept % existing table(s) in public', n_tables;
END $$;

COMMIT;

-- ============================================================================
-- 4. PROVE IT — BY SABOTAGE, NOT BY ASSERTION
-- ============================================================================
-- Re-running section 2 shows the catalog changed. It does NOT show that the
-- next table created will be clean, which is the only thing this file is for.
-- So create one and look. The ROLLBACK means nothing is left behind.
--
--   BEGIN;
--     CREATE TABLE public.zzz_default_privilege_probe (id int);
--
--     SELECT r.rolname AS role,
--            has_table_privilege(r.rolname, 'public.zzz_default_privilege_probe', 'TRUNCATE')   AS truncate_,
--            has_table_privilege(r.rolname, 'public.zzz_default_privilege_probe', 'TRIGGER')    AS trigger_,
--            has_table_privilege(r.rolname, 'public.zzz_default_privilege_probe', 'REFERENCES') AS references_
--       FROM pg_roles r
--      WHERE r.rolname IN ('anon', 'authenticated');
--     -- EXPECT: false, false, false on both rows.
--     -- Before this migration all six are true, which is the bug.
--
--   ROLLBACK;
--
-- Run it as the role your migrations run as — the Supabase SQL Editor is
-- `postgres`. A probe created by a different role tests a different default-ACL
-- entry and can pass while the one that matters is untouched.
--
-- ============================================================================
-- 5. WHAT THIS DELIBERATELY DOES NOT DO
-- ============================================================================
-- * It does not touch service_role. 0014 grants it ALL on future objects on
--   purpose, and that grant is what stops server-side code breaking on every
--   new table. Revoking here would undo 0014 silently.
-- * It does not touch SEQUENCES or FUNCTIONS. Supabase's defaults cover those
--   too, and the privileges involved (USAGE/SELECT/UPDATE on sequences,
--   EXECUTE on functions) are not in the same class as TRUNCATE. Section 2(a)
--   reports them so the decision is visible; narrowing them is its own change
--   with its own blast radius.
-- * It does not change any RLS policy, any row, or any table's structure.
--
-- ============================================================================
-- 6. ROLLBACK
-- ============================================================================
-- Restores Supabase's shipped default, and with it the bug. Included for
-- completeness, not as a recommendation.
--
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT TRUNCATE, TRIGGER, REFERENCES ON TABLES TO anon, authenticated;
--
-- Existing tables re-swept by 3b are not restored by this and should not be.
