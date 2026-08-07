-- ============================================================================
-- 0022_announcements.sql
--
-- ⚠ APPLIED BY HAND TO PRODUCTION 2026-08-07 ~19:20. DO NOT RE-RUN AGAINST
-- PRODUCTION. This file exists so a rebuild from migrations produces the
-- announcements table that is already live.
--
-- ⚠⚠ RECONSTRUCTION — PARTIALLY UNVERIFIED. READ THIS BEFORE TRUSTING IT.
--
-- The intent was to reconstruct this file by reading the live catalog. That is
-- not possible through the API available here: PostgREST does not expose
-- pg_catalog or information_schema, so pg_policies, pg_indexes and
-- information_schema.columns all return PGRST205 regardless of which key is
-- used. It is an exposure limit, not a permissions one, so no key solves it.
--
-- WHAT IS VERIFIED against production, by column-existence probing (PostgREST
-- resolves column names before the privilege check, so 42703 means "no such
-- column" and 42501 means "exists but not readable by anon"):
--
--   * The table public.announcements exists.
--   * These nine columns exist, and no others were found:
--       id, title, body, category, link_url, status,
--       published_at, created_at, updated_at
--   * author_id and slug do NOT exist — probed and absent.
--   * anon cannot read the table, consistent with SELECT being granted to
--     authenticated only.
--
-- WHAT IS TRANSCRIBED FROM THE OPERATOR'S DESCRIPTION and NOT catalog-verified:
--
--   * Every column TYPE, DEFAULT and NULL/NOT NULL setting.
--   * The exact CHECK constraint expressions and their constraint names.
--   * The partial index — its name, and the exact predicate.
--   * The two policy bodies, and their names.
--   * The grant.
--   * Whether a BEFORE UPDATE trigger maintains updated_at. Sibling tables use
--     public.touch_updated_at() for this; NONE IS CREATED HERE, because adding
--     a trigger production does not have would itself be drift. If production
--     has one, add it — see the verification block.
--
-- Run the verification query at the foot of this file and reconcile any
-- difference. Until that is done, treat this file as close-but-unconfirmed.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.announcements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  body          text,
  -- What kind of announcement this is, so a client can filter or badge it.
  category      text NOT NULL,
  -- Optional deep link or external URL the announcement points at.
  link_url      text,
  -- Editorial lifecycle. Only 'live' rows are readable by students, and only
  -- once published_at has passed — see announcements_read_live.
  status        text NOT NULL DEFAULT 'draft',
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Constraint names are guarded rather than declared inline so this file stays
-- re-runnable, and scoped by conrelid because constraint names are unique per
-- table, not per schema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'announcements_category_check'
      AND conrelid = 'public.announcements'::regclass
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_category_check
      CHECK (category IN ('update', 'papers', 'content', 'cohort'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'announcements_status_check'
      AND conrelid = 'public.announcements'::regclass
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_status_check
      CHECK (status IN ('draft', 'live', 'archived'));
  END IF;
END $$;

-- The only query a client makes: live announcements, newest first. Partial on
-- status='live' so drafts and archived rows never enter the index — it stays
-- proportional to what is actually shown, not to everything ever written.
CREATE INDEX IF NOT EXISTS idx_announcements_published
  ON public.announcements (published_at DESC)
  WHERE status = 'live';

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Students see live, already-published rows and nothing else. published_at IS
-- NOT NULL is required as well as the time comparison: a NULL published_at
-- makes the comparison NULL, which a policy treats as false, but stating it
-- makes the intent legible rather than incidental.
DROP POLICY IF EXISTS announcements_read_live ON public.announcements;
CREATE POLICY announcements_read_live
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    status = 'live'
    AND published_at IS NOT NULL
    AND published_at <= now()
  );

-- Staff see and write everything. Reuses public.is_staff() from 0009 rather
-- than introducing a second admin signal — that function is SECURITY DEFINER
-- and fails closed on a NULL auth.uid().
DROP POLICY IF EXISTS announcements_staff_all ON public.announcements;
CREATE POLICY announcements_staff_all
  ON public.announcements
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- SELECT only, and only to authenticated. No INSERT/UPDATE/DELETE to clients:
-- announcements are editorial content written by staff through service_role,
-- so a client write grant would have no legitimate caller. Deliberately nothing
-- to anon.
GRANT SELECT ON public.announcements TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION — run this against production and reconcile with the file above.
-- This is the step that could not be performed from the tooling that wrote it.
--
-- 1. Columns, types, nullability, defaults:
--      SELECT column_name, data_type, is_nullable, column_default
--        FROM information_schema.columns
--       WHERE table_schema = 'public' AND table_name = 'announcements'
--       ORDER BY ordinal_position;
--
-- 2. Constraints, with their real expressions and names:
--      SELECT conname, pg_get_constraintdef(oid)
--        FROM pg_constraint
--       WHERE conrelid = 'public.announcements'::regclass ORDER BY conname;
--
-- 3. Indexes, with the real predicate:
--      SELECT indexname, indexdef FROM pg_indexes
--       WHERE schemaname = 'public' AND tablename = 'announcements';
--
-- 4. Policies, with their real bodies and roles:
--      SELECT polname, polcmd, polroles::regrole[],
--             pg_get_expr(polqual, polrelid)      AS using_expr,
--             pg_get_expr(polwithcheck, polrelid) AS check_expr
--        FROM pg_policy WHERE polrelid = 'public.announcements'::regclass;
--
-- 5. Grants:
--      SELECT grantee, privilege_type FROM information_schema.role_table_grants
--       WHERE table_schema = 'public' AND table_name = 'announcements'
--       ORDER BY grantee, privilege_type;
--
-- 6. Triggers — this file creates NONE. If production has one on updated_at,
--    it is missing here:
--      SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
--       WHERE tgrelid = 'public.announcements'::regclass AND NOT tgisinternal;
--
-- ROLLBACK (destroys content — this table holds real announcements):
--   DROP TABLE IF EXISTS public.announcements;
-- ============================================================================
