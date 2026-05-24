-- ============================================================================
-- 0007_past_papers.sql
-- ----------------------------------------------------------------------------
-- Past papers + mark schemes table. Each row points at PDFs stored in the
-- "papers" public Supabase Storage bucket (created manually in Studio), and
-- optionally a Mux playback ID for an examiner walkthrough video.
--
-- Status semantics differ from lessons. A past paper is intrinsically already
-- "done" — there's no editorial drafting equivalent for a PDF that exists in
-- the real world. So new rows default to 'live' rather than 'coming_soon'.
-- Authors who want to stage a row (e.g. uploaded a PDF but haven't QA'd it
-- yet) can set status='draft' explicitly.
--
-- Public read access via RLS — anyone can browse the papers list before
-- signing up. Writes are service-role only (no anon UI for managing papers
-- yet; that ships with the admin panel).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS past_papers (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id                   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  unit_id                     uuid REFERENCES units(id) ON DELETE SET NULL,
  slug                        text NOT NULL,                  -- e.g. 'wch11-january-2024'
  year                        integer NOT NULL,
  session                     text NOT NULL,                  -- 'January', 'May-June', 'October-November'
  paper_code                  text,                           -- e.g. 'WCH11/01'
  paper_name                  text NOT NULL,                  -- display name, e.g. 'January 2024'
  paper_pdf_path              text,                           -- key in the "papers" bucket
  markscheme_pdf_path         text,
  walkthrough_mux_playback_id text,                           -- Mux playback ID, nullable
  walkthrough_duration_minutes integer,
  status                      content_status DEFAULT 'live',  -- live by default; see note above
  sort_order                  integer DEFAULT 0,
  created_at                  timestamptz DEFAULT now(),
  UNIQUE (course_id, slug)
);

-- ---------------------------------------------------------------------------
-- Index — the hot read path is "list all papers for a course, grouped by
-- unit, in sort order" from the /exam-questions page. Composite covers it.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS past_papers_course_unit_idx
  ON past_papers(course_id, unit_id, sort_order);

-- ---------------------------------------------------------------------------
-- RLS — public SELECT on live rows; writes service-role only.
-- ---------------------------------------------------------------------------
ALTER TABLE past_papers ENABLE ROW LEVEL SECURITY;

-- Drop-and-recreate so the migration is re-runnable. Policies aren't covered
-- by CREATE ... IF NOT EXISTS in older PG versions.
DROP POLICY IF EXISTS "past_papers_public_read_live" ON past_papers;
CREATE POLICY "past_papers_public_read_live"
  ON past_papers FOR SELECT
  TO anon, authenticated
  USING (status = 'live');

-- No INSERT / UPDATE / DELETE policies = no writes from anon or authenticated
-- roles. The service role bypasses RLS entirely, so admin tooling and seed
-- scripts continue to work. Lock-by-default keeps mark-scheme PDFs from
-- being edited by random students even if a client somehow finds an endpoint.

-- ---------------------------------------------------------------------------
-- Grants (mirrors the pattern in 0003_grant_table_privileges.sql — tables
-- created via raw SQL don't get Supabase's auto-grant treatment).
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.past_papers TO anon, authenticated;

COMMIT;
