-- ============================================================================
-- 0008_lesson_access_and_assets_bucket.sql
-- ----------------------------------------------------------------------------
-- Adds two pieces the admin panel needs:
--
--   1. `lessons.access` (free/paid) — content-level gate distinct from user
--      subscription tier. Default 'paid' is the safer default: newly created
--      lessons are locked until explicitly marked free. The public catalogue
--      queries do not yet reference this column, so adding it is a pure
--      superset and does not affect /learn behaviour.
--
--      Convention note: uses an ENUM to match 0001's `content_status`,
--      `subscription_tier`, `user_role` and 0005's `pathway_type`. The
--      column is not the same thing as a status flag — a lesson can be
--      `status='live'` (published) AND `access='paid'` (paywalled).
--
--   2. Private `assets` Storage bucket for lesson decks, worksheets and
--      thumbnails. Distinct from the existing public `papers` bucket
--      (past-paper PDFs stay public — they're public documents). Paths are
--      stored in the DB; serving goes through /api/assets/[...path] which
--      checks session + lesson.access, then createSignedUrl(60) + 307.
--
-- Neither change touches any existing column, policy or index. Safe to run
-- in the SQL Editor; no downtime; no follow-up backfill required.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. lesson_access enum + lessons.access column
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE lesson_access AS ENUM ('free', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS access lesson_access DEFAULT 'paid';

-- ---------------------------------------------------------------------------
-- Two new PATH columns for private-bucket assets. We deliberately don't
-- reuse `ppt_pdf_url` / `worksheet_pdf_url` — those are named for public
-- URLs and a future reader would (correctly) expect fully-qualified URLs
-- in them. Add new columns named for what they hold: opaque paths inside
-- the `assets` bucket, resolved to signed URLs by the /api/assets/[...path]
-- route handler.
-- ---------------------------------------------------------------------------
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS deck_path text,
  ADD COLUMN IF NOT EXISTS thumbnail_path text;

-- ---------------------------------------------------------------------------
-- 2. Private `assets` bucket
-- ----------------------------------------------------------------------------
-- No anon policies on storage.objects for this bucket — writes go through
-- the service-role client in the admin panel, and reads go through the
-- signed-URL route handler. That's deliberate: a leaked path must NOT be
-- enough to fetch the file.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
