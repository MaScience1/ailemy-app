-- ============================================================================
-- 0039_announcement_scheduling.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-19 by the founder in the SQL Editor, no
-- errors. Renamed from 0039_PROPOSED_ once verified, per the standing rule that
-- a file must not claim to be unapplied once it is live.
--
-- ⚠ WHAT THE EVIDENCE IS. scripts/db-checks/public-surface-sabotage.ts, run
-- against production immediately after applying: ALL PASS, 26 of 26. Every
-- negative there is paired with its positive half — a row is proved to EXIST by
-- service_role before anon is asked to not see it, and every gate is then
-- flipped and anon proved to see exactly 1. "anon saw nothing" and "the table
-- is empty" are otherwise the same observation. Rows it created were deleted by
-- the id captured at creation, count=1 each.
--
-- VERIFICATION RESULT, block by block:
--
--   (b) anon sees NOTHING while a row is disabled          ✓ 0 rows
--   (c) anon DOES see it once enabled and in-window        ✓ 1 row
--   (d) anon sees NOTHING once the window has closed       ✓ 0 rows
--       …and NOTHING before the window opens               ✓ 0 rows  (extra)
--   (e) anon cannot write: UPDATE / INSERT / DELETE        ✓ 42501 each,
--       and the title was proved unchanged afterwards, so the refusal is a
--       refusal and not a silent no-op
--   (f) cleanup by captured id                             ✓ count=1
--   (g) TRUNCATE / TRIGGER / REFERENCES on announcements   ✓ zero rows
--       — run by the founder in the SQL Editor 2026-08-19
--
--   announcements_window_ordered was additionally sabotaged: ends_at before
--   starts_at is refused with 23514 naming the constraint.
--
--   Live surface check: the site-wide bar was ABSENT while production's real
--   announcement sat disabled, APPEARED with title, body and CTA once an
--   enabled in-window probe existed, and vanished when the probe was deleted.
--
-- ⚠ WHAT WAS **NOT** RUN, AND IS NOT CLAIMED
-- ----------------------------------------------------------------------------
--   (a) THE FIVE COLUMNS WERE NOT ENUMERATED. information_schema is not exposed
--   through PostgREST, so column_name/data_type could not be READ. All five —
--   cta_label, starts_at, ends_at, priority, enabled — were WRITTEN and READ
--   BACK instead. That is behavioural evidence, and it is weaker than the
--   catalog query block (a) actually specifies.
--
--   ⚠ A RULE THIS MIGRATION DOES NOT ENFORCE. announcements_read_public_bar
--   gates on `enabled` and the window and NEVER looks at `status`, so an
--   ENABLED DRAFT is publicly visible. Nothing in SQL prevents that today; the
--   admin form and the on/off toggle both refuse it in the application. A
--   CHECK (NOT enabled OR status = 'live') belongs in a future migration.
--
-- ⚠ ADDITIVE ONLY. announcements already exists (0022) and already carries
-- title, body, category, link_url, status, published_at. This does NOT create a
-- second announcements table: the concept is already modelled, and a parallel
-- table would be two sources of truth for one banner.
--
-- What 0022 lacks for a scheduled, prioritised site-wide bar:
--   cta_label   0022 has link_url but no label, so a CTA has no words
--   starts_at   published_at is a single instant, not a window
--   ends_at     nothing expires today; a stale banner stays up forever
--   priority    nothing decides which of two live announcements wins
--   enabled     status='live' conflates "editorially ready" with "show it now"
-- ============================================================================

BEGIN;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at   timestamptz,
  ADD COLUMN IF NOT EXISTS priority  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enabled   boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.announcements.enabled IS
  'Operational on/off, separate from status. status says the copy is written; enabled says show it.';
COMMENT ON COLUMN public.announcements.priority IS
  'Higher wins when several are simultaneously active. The public bar shows exactly one.';

-- ⚠ A WINDOW MUST BE A WINDOW. An ends_at before its starts_at is never active,
-- which reads on screen as "the banner is broken" rather than as a typo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'announcements_window_ordered'
       AND conrelid = 'public.announcements'::regclass
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_window_ordered
      CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
  END IF;
END $$;

-- ⚠ THE PUBLIC READ IS anon, AND IT IS NARROW. 0022's announcements_read_live
-- serves signed-in students; the site-wide bar is read by anonymous visitors,
-- so it needs its own policy. It exposes ONLY rows that are enabled AND inside
-- their window — never a draft, never an expired one, never a disabled one.
DROP POLICY IF EXISTS announcements_read_public_bar ON public.announcements;
CREATE POLICY announcements_read_public_bar
  ON public.announcements
  FOR SELECT
  TO anon
  USING (
    enabled IS TRUE
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >  now())
  );

-- Writes stay staff-only. 0022's announcements_staff_all already covers
-- INSERT/UPDATE/DELETE via is_staff(); nothing here widens it.

-- ⚠ THE THREE PRIVILEGES, PER AGENTS.md. announcements was created by 0022 and
-- missed 0019's sweep; 0025 revoked them by hand. Re-asserted here because this
-- migration touches the table and the check is cheap.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.announcements FROM anon, authenticated;
GRANT SELECT ON public.announcements TO anon;

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICATION (run after applying; every block must return what it claims)
-- ----------------------------------------------------------------------------
-- (a) the five columns exist
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='announcements'
--    AND column_name IN ('cta_label','starts_at','ends_at','priority','enabled')
--  ORDER BY column_name;
-- PASS: five rows.
--
-- (b) anon sees NOTHING while disabled  — the sabotage half
-- INSERT INTO public.announcements (title, category, status, enabled)
--   VALUES ('sabotage probe', 'general', 'live', false);
-- SET ROLE anon;  SELECT count(*) FROM public.announcements WHERE title='sabotage probe';
-- PASS: 0. A non-zero here means the policy is not filtering on enabled.
--
-- (c) anon sees it once enabled and in-window — the other half, without which
--     (b) proves only that the table is empty
-- RESET ROLE; UPDATE public.announcements SET enabled=true, starts_at=now()-interval '1 min',
--   ends_at=now()+interval '1 hour' WHERE title='sabotage probe';
-- SET ROLE anon;  SELECT count(*) FROM public.announcements WHERE title='sabotage probe';
-- PASS: 1.
--
-- (d) anon sees nothing once expired
-- RESET ROLE; UPDATE public.announcements SET ends_at=now()-interval '1 min' WHERE title='sabotage probe';
-- SET ROLE anon;  SELECT count(*) FROM public.announcements WHERE title='sabotage probe';
-- PASS: 0.
--
-- (e) anon cannot write
-- SET ROLE anon; INSERT INTO public.announcements (title, category) VALUES ('nope','general');
-- PASS: permission denied / new row violates row-level security.
--
-- (f) cleanup — by the title we created, never a table-wide sweep
-- RESET ROLE; DELETE FROM public.announcements WHERE title='sabotage probe';
--
-- (g) the three privileges are gone
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='announcements'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
