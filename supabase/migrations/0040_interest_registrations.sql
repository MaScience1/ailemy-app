-- ============================================================================
-- 0040_interest_registrations.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-19 by the founder in the SQL Editor, no
-- errors. Renamed from 0040_PROPOSED_ once verified.
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
--   (a) anon CAN insert with consent                       ✓
--   (b) anon CANNOT insert without consent                 ✓ 42501, RLS
--       …nor with consent_to_contact true and consent_at NULL  ✓ 42501
--       (the CHECK requires both — a tick with no timestamp cannot answer
--       "when did they agree", which is the column's entire purpose)
--   (c) anon CANNOT read                                   ✓ 42501
--       ⚠ THE ERROR IS THE PROOF, and the check is written to FAIL on a
--       zero-row result: 0 rows would mean a SELECT grant exists and RLS
--       merely filtered, which is a weaker posture wearing a passing badge.
--   (f) cleanup by captured id                             ✓ count=1
--   (g) TRUNCATE / TRIGGER / REFERENCES                    ✓ zero rows
--       — run by the founder in the SQL Editor 2026-08-19
--
--   End-to-end, through the real form: an anonymous submission wrote one row;
--   consent_at was stamped by the SERVER clock (29s before it was read back,
--   never submitted); every optional field stored; anon was then refused
--   42501 on that row while service_role could see it; deleted by captured id,
--   count=1, table back to 0.
--
-- ⚠ WHAT WAS **NOT** RUN, AND IS NOT CLAIMED
-- ----------------------------------------------------------------------------
--   (d) A SIGNED-IN NON-STAFF USER WAS NEVER TESTED. It needs a real
--   authenticated session, which this tooling cannot create. The claim that
--   interest_registrations_staff_all's USING is false for them is UNVERIFIED.
--
--   (e) STAFF READ WAS NEVER TESTED EITHER, and service_role is NOT a
--   substitute — it bypasses RLS entirely, so it proves the row exists and
--   proves nothing whatsoever about the policy. Both (d) and (e) need a
--   browser session holding, and not holding, a staff role.
--
--   (h) THE GRANT LIST WAS NOT ENUMERATED. information_schema is unavailable
--   here. That anon holds INSERT and lacks SELECT is established
--   BEHAVIOURALLY — an insert succeeded, a select returned 42501 — not by
--   reading role_table_grants as block (h) specifies.
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
