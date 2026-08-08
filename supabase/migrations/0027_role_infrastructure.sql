-- ============================================================================
-- 0027_role_infrastructure.sql
-- ----------------------------------------------------------------------------
-- Replace the hardcoded-email is_staff() with a normalised, multi-role
-- authorization system, WITHOUT changing what any existing policy permits.
--
-- ⚠ APPLIED 2026-08-08. DO NOT RE-RUN AGAINST PRODUCTION — this file now exists
-- so a rebuild from migrations matches what is already live. It is written to be
-- re-runnable throughout, so re-running is harmless, but there is nothing here
-- left to apply. Verified live: public.user_roles exists with one seeded admin
-- row, and both has_role() and is_staff() resolve.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS ADDS — and nothing else
-- ---------------------------------------------------------------------------
--   1. type   public.app_role  ('student','teacher','marker','admin')
--   2. table  public.user_roles  (+ RLS, + one SELECT policy, + grants)
--   3. func   public.has_role(public.app_role)   NEW
--   4. func   public.is_staff()                  REPLACED, same signature
--   5. one seeded row: the ADMIN_EMAIL identity -> 'admin'
--
-- IT DOES NOT TOUCH: profiles, past_papers, student_courses, courses, units,
-- lessons, cohorts, cohort_enrolments, cohort_weeks, submissions,
-- submission_feedback, topic_assessments, announcements, parent_students,
-- storage.objects, or any policy or grant on any of them. Not one existing
-- policy is dropped, altered or recreated. The verification section proves it.
--
-- ---------------------------------------------------------------------------
-- WHY THE 16 EXISTING POLICIES KEEP WORKING
-- ---------------------------------------------------------------------------
-- is_staff() is REPLACED IN PLACE via CREATE OR REPLACE, keeping its exact
-- signature — public.is_staff() RETURNS boolean. Postgres resolves policy
-- expressions to the function by OID at execution time, not by inlining its
-- body, so every caller picks up the new implementation with no policy edit:
--
--   public.cohorts              cohorts readable
--   public.cohort_enrolments    own enrolment / staff write enrolment
--   public.cohort_weeks         published weeks to enrolled / staff write weeks
--   public.submissions          own submissions / staff update submissions
--   public.submission_feedback  own feedback / staff write feedback
--   public.topic_assessments    own assessments / staff write assessments
--   public.announcements        announcements_staff_all              (0022)
--   storage.objects             student reads own folder,
--                               enrolled read materials              (0009+0013)
--                               staff writes materials
--
-- Sixteen policies in total. None is modified here.
--
-- ---------------------------------------------------------------------------
-- NO RECURSION — the property, and how it is guaranteed structurally
-- ---------------------------------------------------------------------------
-- The danger: has_role()/is_staff() read public.user_roles. If user_roles had
-- an RLS policy that called those functions, evaluating the policy would call
-- the function, which would read the table, which would evaluate the policy…
-- Postgres detects this and errors, and because these functions gate staff
-- access everywhere, the failure mode is a total lockout.
--
-- THIS FILE MAKES THAT IMPOSSIBLE BY CONSTRUCTION, not by relying on
-- SECURITY DEFINER to bypass RLS:
--
--   user_roles has exactly ONE policy, user_roles_read_own, whose predicate is
--       user_id = auth.uid()
--   — a column comparison. It calls no function at all. There is therefore no
--   edge from user_roles' policy back to has_role()/is_staff(), and no cycle
--   can exist regardless of how the functions are declared or who owns them.
--
-- ⚠ DELIBERATE DEVIATION FROM THE BRIEF. You asked for SELECT on user_roles
-- for "the owner (and is_staff())". Adding `OR public.is_staff()` to that
-- policy is the exact shape you also asked me to rule out. It would in fact
-- work today — a SECURITY DEFINER function owned by `postgres` reads
-- user_roles as the owner, and RLS is not applied to a table's owner unless
-- FORCE ROW LEVEL SECURITY is set — but that makes the no-recursion property
-- INCIDENTAL: it would silently become a lockout the day someone sets FORCE
-- RLS on user_roles, or the table's owner changes, or the function is
-- recreated as SECURITY INVOKER. I have left it out so the guarantee is
-- structural. Staff read all roles through the service role, which bypasses
-- RLS entirely and is what the admin panel already uses (0014). If you want
-- the policy arm anyway, say so and it is a one-line follow-up.
--
-- ---------------------------------------------------------------------------
-- GRANTS ON user_roles — stated explicitly, as requested
-- ---------------------------------------------------------------------------
--   authenticated : SELECT only. No INSERT, no UPDATE, no DELETE, ever.
--                   TRUNCATE, TRIGGER and REFERENCES are explicitly REVOKED —
--                   Supabase's default privileges grant them on every new
--                   table, so not granting them is not the same as not having
--                   them. See the revoke in section 3.
--   anon          : nothing at all. Not named in any GRANT in this file, and
--                   included in the same revoke for the same reason.
--   service_role  : ALL, inherited from 0014's ALTER DEFAULT PRIVILEGES, which
--                   applies to tables created later by `postgres` — that is
--                   why this file issues no grant to service_role.
--
-- A user can therefore SEE their own roles and cannot grant, change or remove
-- any role, their own or anyone else's. Writes happen through the service role
-- or a future SECURITY DEFINER admin function. Column-level UPDATE grants are
-- not used here because there is no column on this table a user should ever
-- write — the whole row is authorization-bearing.
--
-- ---------------------------------------------------------------------------
-- is_staff() SEMANTICS — unchanged in meaning, widened in mechanism
-- ---------------------------------------------------------------------------
-- Before: true iff the caller's auth.users email equals one hardcoded address.
-- After:  true iff the caller holds ANY internal staff role
--         (teacher, marker, admin) — OR matches the temporary email fallback.
--
-- Because only one identity is seeded, and it gets 'admin', the set of users
-- for whom is_staff() returns true is IDENTICAL on the day this is applied.
-- Nothing gains access. The widening only takes effect when you grant someone
-- a teacher or marker role, which is a deliberate later act.
--
-- ⚠ is_staff() IS A COARSE GATE, NOT FINE-GRAINED AUTHORIZATION. It answers
-- "is this person internal staff", nothing more. New policies should prefer
-- has_role('admin') / has_role('marker') / has_role('teacher'). The existing
-- 16 policies keep using is_staff() only because changing what they permit is
-- out of scope for this migration.
--
-- ---------------------------------------------------------------------------
-- THE TEMPORARY ADMIN_EMAIL FALLBACK
-- ---------------------------------------------------------------------------
-- is_staff() keeps an OR arm matching the same hardcoded address, so if the
-- seed fails to match a user — wrong email, account recreated, different
-- project — you are not locked out of the admin portal. It is scaffolding with
-- a removal step (see step 6 in the sequence below), not a permanent feature.
-- has_role() has NO such fallback: it is the real mechanism and must be honest
-- from the first day, or every policy written against it inherits the lie.
--
-- ---------------------------------------------------------------------------
-- SEQUENCE
-- ---------------------------------------------------------------------------
--   1. this file           create app_role, user_roles, has_role, is_staff
--   2. this file           seed ADMIN_EMAIL identity into 'admin'
--   3. this file           is_staff() becomes role-backed
--   4. this file           ADMIN_EMAIL fallback retained
--   5. YOU                 verify the admin portal + /intensive still work
--   6. LATER MIGRATION     drop the fallback arm; roles become sole authority
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The role vocabulary
-- ----------------------------------------------------------------------------
-- An enum, not text+CHECK: these four values are an application-wide closed
-- set, and a function signature has to name the type. Adding a value later is
-- ALTER TYPE ... ADD VALUE, which is why the enum is created here rather than
-- inside the transaction that will one day extend it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'marker', 'admin');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. The grant table
-- ----------------------------------------------------------------------------
-- One row per (user, role). A user holding teacher AND marker has two rows —
-- that is the whole point, and why a single profiles.role column was rejected.
--
-- user_id references auth.users, not profiles: authorization must not depend on
-- a public-schema row that a user can currently UPDATE (see 0018, unapplied).
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL,
  granted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

COMMENT ON TABLE public.user_roles IS
  'Authorization grants, one row per (user, role). A user may hold several. Never writable by authenticated — service role or a SECURITY DEFINER admin function only.';
COMMENT ON COLUMN public.user_roles.granted_by IS
  'Who issued the grant. NULL for rows seeded by migration 0027.';

-- ----------------------------------------------------------------------------
-- 3. RLS — read your own, write nothing
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- FORCE ROW LEVEL SECURITY is deliberately NOT set: it would apply RLS to the
-- table owner too, which is what the SECURITY DEFINER functions below run as.
-- Their queries must not be filtered, or is_staff() would report false for
-- everyone. This is safe because the owner is `postgres`, not an app role.

DROP POLICY IF EXISTS user_roles_read_own ON public.user_roles;
CREATE POLICY user_roles_read_own
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
-- ^ Column comparison only. Calls NO function. This is the line that makes
--   recursion structurally impossible — see the header.

-- No INSERT, UPDATE or DELETE policy exists, and none is granted below, so
-- those verbs are denied twice over: once by the missing grant (checked first)
-- and once by the missing policy.

GRANT SELECT ON public.user_roles TO authenticated;
-- Deliberately NO grant to anon, and no write verb to anyone.

-- GRANTING SELECT IS NOT ENOUGH — the three privileges below arrive on their
-- own and must be taken away explicitly.
--
-- Supabase's default privileges hand anon and authenticated the full privilege
-- set on every table created in public, so user_roles is born holding
-- TRUNCATE, TRIGGER and REFERENCES no matter what this file grants.
-- 0019_revoke_blanket_grants.sql swept them off every table — but it
-- enumerated pg_tables AT THE MOMENT IT RAN, so it fixed a snapshot and cannot
-- cover a table that did not exist yet. public.announcements was created after
-- it by 0022, inherited all three, and had to be repaired by hand in 0025.
-- This table was next in line.
--
-- On an authorization table the stakes are higher than on announcements:
--
--   TRUNCATE   empties user_roles outright, and is NOT filtered by RLS — no
--              policy can protect a table from it. Emptying this table strips
--              every staff role in the system at once. is_staff() fails
--              closed, so the outcome is a total lockout rather than an
--              escalation — recoverable only through the service role.
--   TRIGGER    attaches arbitrary code to every future write of an
--              authorization grant.
--   REFERENCES creates a foreign key onto user_roles, constraining which role
--              grants the owner may subsequently delete.
--
-- See AGENTS.md > Database migrations: every CREATE TABLE migration carries
-- this revoke itself, because no later sweep will ever reach back for it.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.user_roles FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. has_role() — the real mechanism
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so it can read user_roles regardless of the caller's own
-- visibility, and so a future policy on another table can ask about a user
-- without that table needing its own view of user_roles.
--
-- search_path is pinned to `public, pg_temp` and nothing else. Without this a
-- caller could prepend a schema containing a malicious `user_roles` and have a
-- DEFINER function read it with owner privileges. pg_temp is listed LAST so a
-- temporary object can never shadow a real one.
CREATE OR REPLACE FUNCTION public.has_role(check_role public.app_role)
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
       AND ur.role = check_role
  );
$$;

COMMENT ON FUNCTION public.has_role(public.app_role) IS
  'True if the current session holds the given role. The fine-grained check — prefer this over is_staff() in new policies.';

-- ----------------------------------------------------------------------------
-- 5. Seed the existing admin BEFORE is_staff() starts depending on it
-- ----------------------------------------------------------------------------
-- Order matters: if is_staff() were replaced first and the seed then failed,
-- every staff policy would evaluate false until someone with database access
-- fixed it. Seeding first means the worst case is a no-op replacement.
--
-- The address is the same one 0009 hardcoded and matches ADMIN_EMAIL. Raises
-- rather than silently inserting nothing, so a typo or a recreated account is
-- visible now instead of at the first failed admin action.
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT u.id INTO admin_id
    FROM auth.users u
   WHERE lower(u.email) = 'mascience15@gmail.com'
   LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION
      'ABORTING: no auth.users row for mascience15@gmail.com. The admin role cannot be seeded, and replacing is_staff() without it would lock you out. No changes made.';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE '0027: admin role seeded for %', admin_id;
END $$;

-- ----------------------------------------------------------------------------
-- 6. is_staff() — replaced in place, semantics preserved
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE keeps the same OID, so all 16 dependent policies follow
-- automatically. The signature is unchanged: public.is_staff() RETURNS boolean.
--
-- Note the search_path fix: 0009 set only `public`, leaving pg_temp resolvable
-- ahead of it in some paths. Pinned properly here.
--
-- The second arm is the TEMPORARY ADMIN_EMAIL fallback. Remove it in the
-- follow-up migration once you have verified the portal.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    -- role-backed: any internal staff role
    EXISTS (
      SELECT 1
        FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role IN ('teacher', 'marker', 'admin')
    )
    -- TEMPORARY fallback, removed in a later migration
    OR EXISTS (
      SELECT 1
        FROM auth.users u
       WHERE u.id = auth.uid()
         AND lower(u.email) = 'mascience15@gmail.com'
    );
$$;

COMMENT ON FUNCTION public.is_staff() IS
  'True if the session holds any internal staff role (teacher/marker/admin), OR matches the temporary ADMIN_EMAIL fallback. COARSE — prefer has_role() for new policies. Fallback arm to be removed once the role system is verified.';

-- EXECUTE on both functions is left at the CREATE FUNCTION default (PUBLIC).
-- 0013 documents why: revoking EXECUTE on is_staff() from PUBLIC breaks anon
-- reads of the public "papers" bucket, because storage policies call it
-- without a TO clause. Do not revoke it without re-reading that file.

COMMIT;


-- ============================================================================
-- VERIFICATION — run after applying
-- ============================================================================
-- (a) THE ONE THAT MATTERS. As the admin, in the app (not the SQL Editor,
--     which runs as postgres and bypasses all of this):
--
--       SELECT public.is_staff();            -- expect true
--       SELECT public.has_role('admin');     -- expect true
--       SELECT public.has_role('marker');    -- expect false
--
-- (b) Exactly one row seeded, and it is yours.
--
--   SELECT ur.role, ur.granted_by, ur.created_at, u.email
--     FROM public.user_roles ur JOIN auth.users u ON u.id = ur.user_id;
--   -- expect 1 row: admin / NULL / now / mascience15@gmail.com
--
-- (c) Both functions are SECURITY DEFINER with the pinned search_path.
--     Expect prosecdef = true and proconfig = {"search_path=public, pg_temp"}.
--
--   SELECT p.proname, p.prosecdef, p.proconfig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname IN ('has_role', 'is_staff');
--
-- (d) NO RECURSION: user_roles' only policy must not mention either function.
--     Expect one row, user_roles_read_own, qual = (user_id = auth.uid()).
--
--   SELECT policyname, cmd, qual, with_check
--     FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'user_roles';
--
-- (e) GRANTS on user_roles. Expect exactly one row: authenticated / SELECT.
--     anon must not appear at all, and neither TRUNCATE, TRIGGER nor
--     REFERENCES may appear for either role — if they do, the revoke in
--     section 3 did not take and the table is holding privileges Supabase's
--     default privileges granted it at creation.
--
--   SELECT grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name = 'user_roles'
--      AND grantee IN ('anon', 'authenticated')
--    ORDER BY grantee, privilege_type;
--
--     Then the repo-wide sweep, which must return ZERO rows across every
--     table — this is the check AGENTS.md asks for after any migration that
--     creates one:
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon', 'authenticated')
--      AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
--    ORDER BY table_name, grantee, privilege_type;
--
-- (f) THE DIFF TOUCHED NOTHING ELSE. Run this BEFORE and AFTER and compare —
--     the two results must be byte-identical.
--
--   SELECT schemaname, tablename, policyname, cmd, qual, with_check
--     FROM pg_policies
--    WHERE schemaname IN ('public', 'storage')
--      AND tablename <> 'user_roles'
--    ORDER BY schemaname, tablename, policyname;
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND table_name <> 'user_roles'
--      AND grantee IN ('anon', 'authenticated')
--    ORDER BY table_name, grantee, privilege_type;
--
-- (g) Smoke-test the 16 dependents. As the admin in the app: load /admin,
--     load /intensive, and confirm a cohort-materials file still downloads.
--     As a signed-in non-admin: confirm /admin still redirects.
-- ============================================================================


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Restores 0009's is_staff() exactly, then removes everything this file added.
-- Safe at any point: no existing object is modified, so there is nothing else
-- to put back. Do (1) first — it is what un-breaks the 16 policies.
--
--   BEGIN;
--
--   -- (1) is_staff() back to the 0009 implementation, verbatim
--   CREATE OR REPLACE FUNCTION public.is_staff()
--   RETURNS boolean
--   LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
--   AS $fn$
--     SELECT EXISTS (
--       SELECT 1 FROM auth.users u
--        WHERE u.id = auth.uid()
--          AND lower(u.email) = 'mascience15@gmail.com'
--     );
--   $fn$;
--
--   -- (2) drop the new function, table and type
--   DROP FUNCTION IF EXISTS public.has_role(public.app_role);
--   DROP TABLE    IF EXISTS public.user_roles;   -- policy + grants go with it
--   DROP TYPE     IF EXISTS public.app_role;
--
--   COMMIT;
--
-- ⚠ Order matters: has_role() must be dropped before app_role, and both before
-- the type, or the DROP TYPE fails on dependency. If anything else has come to
-- depend on app_role by then, DROP TYPE will refuse — resolve that rather than
-- adding CASCADE, which would silently drop the dependent objects too.
-- ============================================================================
