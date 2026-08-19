-- ============================================================================
-- 0041_PROPOSED_cohort_public_catalogue.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. See 0039's header.
--
-- ⚠ ADDITIVE ONLY, AND NO NEW TABLE. `cohorts` already exists (0009) with slug,
-- title, price_pence, currency, starts_on, ends_on, seat_cap, is_active — which
-- is most of a tuition cohort already. A separate tuition_cohorts table would
-- split one concept in two and leave cohort_enrolments pointing at the wrong
-- half.
--
-- What 0009 lacks for a public catalogue:
--   subject/qualification  0009 was built for one intensive; the catalogue has
--                          three cohorts across two qualifications and must
--                          grow to Biology and Physics
--   hours_per_week,
--   sessions_per_week,
--   schedule_summary       what a parent actually reads on the card
--   status                 0009 has is_active, a boolean — the public UI needs
--                          enrolling / interest / full / upcoming / closed
--   enrolment_url          NULLABLE ON PURPOSE. Empty means the CTA renders
--                          "Register interest", never a dead "Enrol".
--   teacher_name,
--   summary, features      card copy, admin-editable rather than in JSX
-- ============================================================================

BEGIN;

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS subject           text,
  ADD COLUMN IF NOT EXISTS qualification     text,
  ADD COLUMN IF NOT EXISTS hours_per_week    numeric(4,1),
  ADD COLUMN IF NOT EXISTS sessions_per_week smallint,
  ADD COLUMN IF NOT EXISTS schedule_summary  text,
  ADD COLUMN IF NOT EXISTS onboarding_on     date,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'upcoming',
  ADD COLUMN IF NOT EXISTS enrolment_url     text,
  ADD COLUMN IF NOT EXISTS teacher_name      text,
  ADD COLUMN IF NOT EXISTS summary           text,
  ADD COLUMN IF NOT EXISTS features          text[],
  ADD COLUMN IF NOT EXISTS display_order     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public         boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cohorts.enrolment_url IS
  'NULL means no payment link yet. The public CTA must render Register interest, never a dead Enrol.';
COMMENT ON COLUMN public.cohorts.is_public IS
  'Separate from is_active: a cohort can be running (active) without being advertised.';
COMMENT ON COLUMN public.cohorts.schedule_summary IS
  'Free text, e.g. "Tue + Sat · 7:00-9:30 PM Doha". NULL for demand-triggered cohorts — never invent a timetable.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cohorts_status_check' AND conrelid = 'public.cohorts'::regclass
  ) THEN
    ALTER TABLE public.cohorts
      ADD CONSTRAINT cohorts_status_check
      CHECK (status IN ('enrolling','interest','full','upcoming','closed'));
  END IF;

  -- ⚠ A COHORT THAT SAYS "ENROL" MUST HAVE SOMEWHERE TO SEND THEM. Enforced
  -- here so a dead Enrol button cannot be created by an admin edit.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cohorts_enrolling_needs_url' AND conrelid = 'public.cohorts'::regclass
  ) THEN
    ALTER TABLE public.cohorts
      ADD CONSTRAINT cohorts_enrolling_needs_url
      CHECK (status <> 'enrolling' OR enrolment_url IS NOT NULL);
  END IF;
END $$;

-- ⚠ anon MAY READ THE PUBLIC CATALOGUE, AND ONLY THAT. is_public gates it, so
-- an internal or draft cohort is not on the site the moment it is created.
DROP POLICY IF EXISTS cohorts_read_public ON public.cohorts;
CREATE POLICY cohorts_read_public
  ON public.cohorts
  FOR SELECT
  TO anon, authenticated
  USING (is_public IS TRUE);

GRANT SELECT ON public.cohorts TO anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.cohorts FROM anon, authenticated;

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) the columns exist
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='cohorts'
--    AND column_name IN ('subject','qualification','status','enrolment_url','is_public')
--  ORDER BY column_name;
-- PASS: five rows.
--
-- (b) an enrolling cohort with no URL is REFUSED — the dead-CTA sabotage
-- INSERT INTO public.cohorts (slug,title,price_pence,starts_on,ends_on,status,enrolment_url)
--   VALUES ('probe','probe',1,'2026-09-01','2027-06-01','enrolling',NULL);
-- PASS: violates check constraint "cohorts_enrolling_needs_url".
--
-- (c) the same row with status 'interest' IS accepted
-- INSERT INTO public.cohorts (slug,title,price_pence,starts_on,ends_on,status,enrolment_url,is_public)
--   VALUES ('probe','probe',1,'2026-09-01','2027-06-01','interest',NULL,false);
-- PASS: inserted.
--
-- (d) anon cannot see it while is_public is false
-- SET ROLE anon; SELECT count(*) FROM public.cohorts WHERE slug='probe';
-- PASS: 0.
--
-- (e) anon CAN see it once public — without this, (d) proves only emptiness
-- RESET ROLE; UPDATE public.cohorts SET is_public=true WHERE slug='probe';
-- SET ROLE anon; SELECT count(*) FROM public.cohorts WHERE slug='probe';
-- PASS: 1.
--
-- (f) anon cannot write
-- SET ROLE anon; UPDATE public.cohorts SET price_pence=0 WHERE slug='probe';
-- PASS: 0 rows updated / permission denied.
--
-- (g) cleanup by the slug created
-- RESET ROLE; DELETE FROM public.cohorts WHERE slug='probe';
--
-- (h) the three privileges are gone
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='cohorts'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
