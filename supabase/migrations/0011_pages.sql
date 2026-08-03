-- ============================================================================
-- 0011_pages.sql
-- ----------------------------------------------------------------------------
-- Standalone content pages authored from the inline editor and served by the
-- catch-all route at app/(site)/[...slug]/page.tsx.
--
-- STATUS: uses its own two-state check constraint rather than the shared
-- `content_status` enum. A marketing page is either published or it is not —
-- the enum's in_progress / coming_soon / archived states are catalogue
-- concepts (a lesson that exists but isn't taught yet) with no meaning here,
-- and allowing them would force the route handler to guess which of the five
-- states are publicly visible.
--
-- ROUTING: `slug` is the full path after the domain, without a leading slash
-- (e.g. 'about', 'pricing/schools'). The catch-all is the LOWEST-priority
-- route in the app, so any slug that collides with a real route (/learn,
-- /admin, /login …) is served by that route and this row is simply unreachable.
--
-- RLS: anonymous SELECT is restricted to published rows. Draft rows are
-- readable only via the service-role client, which is what the admin preview
-- path uses. Writes are service-role only, i.e. exclusively through the
-- assertAdmin()-guarded page actions.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  body_md     text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pages_status_slug_idx ON pages(status, slug);

DROP TRIGGER IF EXISTS touch_pages ON pages;
CREATE TRIGGER touch_pages BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Published rows only. Drafts are invisible to anon/authenticated entirely —
-- admin preview goes through the service-role client, which bypasses RLS.
DROP POLICY IF EXISTS "pages_public_read_published" ON pages;
CREATE POLICY "pages_public_read_published"
  ON pages FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

GRANT SELECT ON public.pages TO anon, authenticated;

COMMIT;
