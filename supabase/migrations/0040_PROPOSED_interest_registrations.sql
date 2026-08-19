-- ============================================================================
-- 0040_PROPOSED_interest_registrations.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. See 0039's header on the _PROPOSED_ naming.
--
-- ⚠ A GENUINELY NEW TABLE. Nothing in the schema models demand capture:
-- cohort_enrolments (0009) records a PAID enrolment and requires a cohort that
-- exists, which is the opposite of "tell me you want a cohort I have not opened
-- yet". Reusing it would mean inventing placeholder cohorts to hang interest
-- from, and then telling paid enrolments and unpaid interest apart by a status
-- column — two meanings in one table is how a revenue figure ends up counting
-- people who never paid.
--
-- ⚠ THIS TABLE IS PII. Names, emails, phone numbers, countries, and a child's
-- year group. The RLS below gives anon INSERT and NO SELECT AT ALL — not even
-- of their own row. A form does not need to read back what it just wrote, and a
-- readable leads table is a scrape waiting to happen.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.interest_registrations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- what they want
  subject            text NOT NULL,
  qualification      text NOT NULL,
  exam_board         text,
  exam_session       text,

  -- who they are
  student_name       text NOT NULL,
  parent_name        text,
  email              text NOT NULL,
  phone              text,
  country            text,
  timezone           text,

  -- where they are academically
  current_grade      text,
  target_grade       text,
  preferred_days     text,
  preferred_times    text,
  ready_to_start     boolean,

  -- ⚠ CONSENT IS A COLUMN AND A TIMESTAMP, NOT A TICK THAT VANISHES. Being
  -- able to say WHEN someone agreed to be contacted is the whole value of
  -- recording it; a bare boolean cannot answer "when did they agree".
  consent_to_contact boolean NOT NULL,
  consent_at         timestamptz,

  -- operational
  status             text NOT NULL DEFAULT 'new',
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT interest_registrations_status_check
    CHECK (status IN ('new','contacted','converted','declined','duplicate')),

  -- ⚠ NO CONSENT, NO ROW. Enforced in the database rather than in a form
  -- handler, because the form is not the only thing that can insert.
  CONSTRAINT interest_registrations_consent_required
    CHECK (consent_to_contact IS TRUE AND consent_at IS NOT NULL),

  CONSTRAINT interest_registrations_email_shape
    CHECK (position('@' IN email) > 1)
);

CREATE INDEX IF NOT EXISTS interest_registrations_demand_idx
  ON public.interest_registrations (subject, qualification, created_at DESC);

ALTER TABLE public.interest_registrations ENABLE ROW LEVEL SECURITY;

-- ⚠ INSERT ONLY, AND ONLY WITH CONSENT. The WITH CHECK repeats the constraint
-- deliberately: a policy that let a row through for the constraint to reject
-- would report a database error to a parent filling in a form.
DROP POLICY IF EXISTS interest_registrations_insert_anon ON public.interest_registrations;
CREATE POLICY interest_registrations_insert_anon
  ON public.interest_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (consent_to_contact IS TRUE AND consent_at IS NOT NULL);

-- ⚠ THERE IS NO SELECT POLICY FOR anon OR authenticated, AND THAT IS THE POINT.
-- RLS denies by default, so omitting the policy IS the protection. Reading is
-- staff-only, below.
DROP POLICY IF EXISTS interest_registrations_staff_all ON public.interest_registrations;
CREATE POLICY interest_registrations_staff_all
  ON public.interest_registrations
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ⚠ GRANTS ARE CHECKED BEFORE RLS. A missing grant surfaces as an opaque
-- "permission denied for table" far from the cause; anon needs INSERT and
-- nothing else. No SELECT grant is issued to anon at all.
GRANT INSERT ON public.interest_registrations TO anon, authenticated;
GRANT SELECT, UPDATE ON public.interest_registrations TO authenticated;

-- ⚠ THE THREE PRIVILEGES, PER AGENTS.md — required on every CREATE TABLE.
-- TRUNCATE is not filtered by RLS: a row policy cannot protect this table from
-- being emptied.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.interest_registrations FROM anon, authenticated;

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) anon can insert WITH consent
-- SET ROLE anon;
-- INSERT INTO public.interest_registrations
--   (subject, qualification, student_name, email, consent_to_contact, consent_at)
--   VALUES ('biology','ial-as','sabotage probe','probe@example.test', true, now());
-- PASS: one row inserted.
--
-- (b) anon CANNOT insert without consent — the sabotage
-- SET ROLE anon;
-- INSERT INTO public.interest_registrations
--   (subject, qualification, student_name, email, consent_to_contact)
--   VALUES ('biology','ial-as','no consent','probe2@example.test', false);
-- PASS: violates row-level security policy (or the consent CHECK).
--
-- (c) anon CANNOT read — the PII half
-- SET ROLE anon; SELECT count(*) FROM public.interest_registrations;
-- PASS: permission denied for table interest_registrations.
--   ⚠ A "0" here is NOT a pass — it would mean a SELECT grant exists and RLS
--   merely filtered every row. The error is the proof.
--
-- (d) a signed-in NON-staff user cannot read either
-- (from a real authenticated session holding no staff role)
-- SELECT count(*) FROM public.interest_registrations;
-- PASS: 0 rows, because interest_registrations_staff_all's USING is false.
--
-- (e) staff CAN read — without which (c) and (d) prove only that it is empty
-- (from a session holding marker or admin)
-- SELECT count(*) FROM public.interest_registrations WHERE student_name='sabotage probe';
-- PASS: 1.
--
-- (f) cleanup — by the id created, never a sweep
-- RESET ROLE;
-- DELETE FROM public.interest_registrations WHERE email IN ('probe@example.test','probe2@example.test');
--
-- (g) the three privileges are gone
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='interest_registrations'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
--
-- (h) anon holds INSERT but NOT SELECT
-- SELECT privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='interest_registrations' AND grantee='anon'
--  ORDER BY privilege_type;
-- PASS: exactly one row, INSERT.
