-- ============================================================================
-- 0014_grant_service_role_privileges.sql
-- ----------------------------------------------------------------------------
-- Restores table privileges for the `service_role` Postgres role.
--
-- SYMPTOM: every admin surface fails with
--     42501  permission denied for table courses
-- on production (www.ailemy.com) and locally alike — the "New past paper" form
-- shows "Could not load courses", the inline editor cannot read, and the admin
-- panel is unusable. The public site is unaffected.
--
-- CAUSE: this is NOT a key or environment problem. Measured against the live
-- database, the key authenticates and reaches Postgres; PostgREST returns
--     {"code":"42501","hint":"Grant the required privileges to the current role
--      with: GRANT SELECT ON public.courses TO service_role;"}
-- An invalid key returns 401 "Invalid API key" instead — so the credential is
-- valid and Postgres has already switched to `service_role` before refusing.
-- `service_role` simply holds no privileges on public tables:
--
--     service_role  courses/units/subjects/curricula/past_papers/lessons  403 42501
--     anon          same six                                             200 OK
--
-- 0003_grant_table_privileges.sql documents this exact failure mode ("Tables
-- created via raw SQL need explicit GRANTs — without them, every query fails
-- with `permission denied for table <name>` BEFORE RLS even gets a chance to
-- evaluate") and then grants to `anon` and `authenticated` only. No migration
-- in this repo has ever granted anything to `service_role`. Supabase normally
-- provides those grants itself, so something removed them or they were never
-- applied to this project.
--
-- WHY `ALL` AND NOT JUST SELECT: `service_role` is the trusted backend role
-- that deliberately bypasses RLS; the admin panel inserts, updates and deletes
-- lessons and past papers, not just reads. `GRANT ALL` matches what Supabase
-- grants this role by default — this migration restores the platform default
-- rather than inventing a narrower one.
--
-- SCOPE — deliberately limited:
--   * Touches `service_role` ONLY. No GRANT or REVOKE here names `anon` or
--     `authenticated`, so their privileges are bit-for-bit unchanged.
--   * Alters NO row-level security. There is no CREATE POLICY, DROP POLICY,
--     ALTER POLICY, or ENABLE/DISABLE ROW LEVEL SECURITY in this file. RLS is
--     not the failing layer: grants are checked BEFORE RLS, and `service_role`
--     bypasses RLS regardless. Adding a policy would not have fixed this.
--   * Does not touch the `storage` schema. The failure was measured only on
--     `public` tables; storage access goes through the Storage API rather than
--     PostgREST and was not observed failing. If signed asset URLs are also
--     broken, that needs its own diagnosis, not a blind grant here.
--   * Does not alter role attributes (e.g. BYPASSRLS). No evidence it is
--     missing; the verification query below reports it so you can confirm.
--
-- The ALTER DEFAULT PRIVILEGES statements are the part that stops this
-- recurring: without them, the next table created by a raw-SQL migration lands
-- with the same gap. They apply to objects created by the role that RUNS this
-- file — the Supabase SQL Editor runs as `postgres`, which is the role your
-- migrations are applied under, so that is the correct target.
--
-- Safe to re-run: GRANT and ALTER DEFAULT PRIVILEGES are both idempotent.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Schema access. Without USAGE on the schema, per-table grants are
--    unreachable no matter how they are set.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Every table and view that exists RIGHT NOW.
-- ---------------------------------------------------------------------------
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Sequences and functions, for parity with the Supabase default. The schema
--    uses gen_random_uuid() rather than serial keys, so there may be no
--    sequences at all; the grant is harmless either way.
-- ---------------------------------------------------------------------------
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Future objects. This is what prevents the next migration from
--    reintroducing the bug.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

COMMIT;


-- ============================================================================
-- VERIFICATION — read-only. Run AFTER the migration, in a separate execution.
-- Nothing below modifies anything: it is SELECT and has_*_privilege() only.
-- ============================================================================

-- (a) Headline: how many public tables is service_role still locked out of?
--     Expect missing_select = 0. Also confirms anon/authenticated were not
--     collaterally changed — anon_select should still be > 0 for the catalogue.
SELECT
  count(*)                                                                AS tables_total,
  count(*) FILTER (WHERE NOT has_table_privilege('service_role', c.oid, 'SELECT')) AS service_role_missing_select,
  count(*) FILTER (WHERE NOT has_table_privilege('service_role', c.oid, 'INSERT')) AS service_role_missing_insert,
  count(*) FILTER (WHERE has_table_privilege('anon',          c.oid, 'SELECT'))    AS anon_can_select,
  count(*) FILTER (WHERE has_table_privilege('authenticated', c.oid, 'SELECT'))    AS authenticated_can_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm');

-- (b) Per-table detail, so a single stubborn table is visible rather than
--     hidden in an aggregate. The tables the admin panel actually needs are
--     courses, units, subjects, curricula, past_papers, lessons.
SELECT
  c.relname                                                AS table_name,
  has_table_privilege('service_role', c.oid, 'SELECT')     AS sr_select,
  has_table_privilege('service_role', c.oid, 'INSERT')     AS sr_insert,
  has_table_privilege('service_role', c.oid, 'UPDATE')     AS sr_update,
  has_table_privilege('service_role', c.oid, 'DELETE')     AS sr_delete,
  has_table_privilege('anon',          c.oid, 'SELECT')    AS anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT')    AS auth_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm')
ORDER BY c.relname;

-- (c) Schema usage, and the role attribute that lets service_role bypass RLS.
--     rolbypassrls should be true; if it is false that is a SEPARATE problem
--     from the one this migration fixes, and needs its own decision.
SELECT
  has_schema_privilege('service_role', 'public', 'USAGE') AS service_role_schema_usage,
  r.rolbypassrls                                          AS service_role_bypasses_rls
FROM pg_roles r
WHERE r.rolname = 'service_role';

-- (d) Default privileges for future objects. Expect at least one row
--     mentioning service_role for schema public.
SELECT
  n.nspname        AS schema,
  d.defaclobjtype  AS object_type,   -- r = table, S = sequence, f = function
  pg_get_userbyid(d.defaclrole) AS granted_by_role,
  d.defaclacl      AS access_list
FROM pg_default_acl d
JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public'
  AND array_to_string(d.defaclacl, ',') LIKE '%service_role%';

-- (e) RLS policy count, purely as evidence this migration changed nothing
--     there. Compare against the same query run BEFORE applying: the number
--     must be identical.
SELECT count(*) AS rls_policies_in_public
FROM pg_policies
WHERE schemaname = 'public';
