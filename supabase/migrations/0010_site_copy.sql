-- ============================================================================
-- 0010_site_copy.sql
-- ----------------------------------------------------------------------------
-- Key/value overrides for page-level marketing copy (headings, subheadings,
-- section descriptions). Edited inline on the live site by the admin.
--
-- DESIGN: this table is an OVERRIDE layer, never the source of truth. Every
-- <Editable id="..." default="..."> carries the current hardcoded string as
-- its default, so:
--   * an empty table renders exactly today's site,
--   * a missing key falls back to the JSX default,
--   * losing this table degrades to the shipped copy rather than blank pages.
-- That is why nothing is seeded here — a seed would immediately go stale
-- against the JSX and create two competing sources of truth.
--
-- RLS: world-readable (it IS the public page copy). No INSERT/UPDATE/DELETE
-- policies, so writes are service-role only — i.e. exclusively through the
-- assertAdmin()-guarded saveCopy() server action.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS site_copy (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz DEFAULT now()
);

-- Reuse the shared trigger function defined in 0001_initial_schema.sql.
DROP TRIGGER IF EXISTS touch_site_copy ON site_copy;
CREATE TRIGGER touch_site_copy BEFORE UPDATE ON site_copy
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE site_copy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_copy_public_read" ON site_copy;
CREATE POLICY "site_copy_public_read"
  ON site_copy FOR SELECT
  TO anon, authenticated
  USING (true);

-- Mirrors 0003/0007: raw-SQL tables don't get Supabase's auto-grant.
GRANT SELECT ON public.site_copy TO anon, authenticated;

COMMIT;
