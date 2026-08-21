-- ============================================================================
-- 0063_cohort_capacity.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED 2026-08-20 — VERIFIED. Number issued by planning. Run as ONE paste
-- if rebuilding: this file is a single transaction plus its grants, with no
-- trailing sections to drop.
--
-- ⚠ THIS HEADER SAID "NOT YET APPLIED" FOR A DAY AFTER IT WAS APPLIED, WHICH IS
-- THE FAILURE THE _PROPOSED_ RULE EXISTS TO PREVENT, WEARING THE OTHER FACE.
-- The rename off _PROPOSED_ happened; the status line did not follow it. A
-- rebuilder reading this folder — the only rebuild path there is — would have
-- been told the live database lacks a function it has had all along. Renaming
-- and re-heading are ONE step, not two.
--
-- Verification observed on the live database (scripts/db-checks/cohort-capacity-0063.ts):
--   (a) every public cohort returned 0                                    ✓
--   (b1) a PAID active seat on a PUBLIC cohort counted → 1                ✓
--   (b2) an UNPAID seat on the SAME cohort did not count → still 1        ✓
--   (b3) a PAID but REFUNDED seat did not count → still 1                 ✓
--   (c) anon reading cohort_enrolments REFUSED (42501, not an empty set)  ✓
--   (d) anon CAN execute cohort_seats_taken and got the same figure       ✓
--   (d2) an unknown slug returned 0, not an error                         ✓
--   cleanup removed 3 of 3 probe rows; the count returned to 0            ✓
--
-- ⚠ (b2) AND (b3) ARE WHY (a) MEANS ANYTHING. Both probes sat on the same
-- public cohort as (b1), so they isolate the paid filter from the is_public
-- filter. (a) alone passes identically against a function that always returns
-- zero — an earlier draft of (b3) DID pass vacuously, because it used a status
-- the 0009 CHECK rejects and the insert error was destructured away.
--
-- ============================================================================
-- ⚠ A COUNT, NEVER THE ROWS (§14)
-- ============================================================================
-- public.cohort_enrolments is PII: email, parent_name, parent_contact — a
-- WhatsApp number — and it names children. §14 wants "7 places remaining",
-- which is ONE INTEGER. Granting anon SELECT on the table to obtain it would
-- be a disclosure, and grants are checked before RLS, so no policy could
-- narrow it back down to a count afterwards.
--
-- So this is a SECURITY DEFINER function that returns the number and nothing
-- else. No view: a view is still a relation a client SELECTs, and every column
-- it exposes is a column somebody can widen later. A function has one return
-- type and it is `integer`.
--
-- ============================================================================
-- ⚠ PAID SEATS ONLY, AND THE LIVE TABLE IS WHY
-- ============================================================================
-- Observed 2026-08-21, the entire contents of cohort_enrolments:
--
--   mascience15@gmail.com  status='active'  amount_pence NULL  stripe_ref NULL
--   on ial-chem-as-sep-2026, is_public = false, source_tag = 'test'
--
-- A founder test seat. Counting on `status` alone would render "19 places
-- left" on the strength of a row where no money moved — the fake scarcity §14
-- explicitly forbids. Three conditions are required together: the cohort is
-- public, the enrolment is active, and it carries BOTH an amount and a
-- provider reference.
--
-- ⚠ THAT ROW IS ALREADY EXCLUDED TWICE OVER — it is unpaid AND on a
-- non-public cohort. The is_public filter is not what makes this safe; the
-- paid filter is. A future unpaid seat on a PUBLIC cohort is the case this
-- function exists to get right, and today there is no such row to prove it
-- with, which is why verification (b) creates one.
--
-- ⚠ NO REVOKE TRUNCATE/TRIGGER/REFERENCES BLOCK: this file creates no table.
-- If a later revision adds one, it must end with that revoke — Supabase's
-- default privileges hand anon and authenticated the full set on new tables,
-- and 0019 only swept a snapshot.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cohort_seats_taken(cohort_slug text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT count(*)::integer
    FROM public.cohort_enrolments e
    JOIN public.cohorts c ON c.id = e.cohort_id
   WHERE c.slug = cohort_slug
     AND c.is_public IS TRUE
     AND e.status = 'active'
     AND e.amount_pence IS NOT NULL
     AND e.amount_pence > 0
     AND e.stripe_ref IS NOT NULL;
$$;

COMMENT ON FUNCTION public.cohort_seats_taken(text) IS
  'Paid, active seats on a PUBLIC cohort. Returns a count and never a row: cohort_enrolments is PII and no client holds SELECT on it. Unpaid seats are excluded deliberately — a seat with no amount_pence and no stripe_ref is not a sold place, and counting one is fake scarcity.';

COMMIT;

-- ── GRANTS ──────────────────────────────────────────────────────────────────
-- ⚠ REVOKE FROM PUBLIC FIRST. A SECURITY DEFINER function is created EXECUTABLE
-- BY PUBLIC by default, so granting without revoking leaves every role able to
-- call it — including roles added later that nobody thought about.
--
-- ⚠ anon NEEDS IT. The capacity figure appears on the marketing homepage and on
-- /tuition, both of which a signed-out visitor sees. That is the whole point:
-- the number is public, the rows are not.
REVOKE ALL ON FUNCTION public.cohort_seats_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cohort_seats_taken(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- Run by Claude after this paste lands, with a paid probe minted and removed by
-- captured id. Recorded here so the file states what was checked.
--
-- (a) EXPECT 0 for every public cohort. The only enrolment in the table is
--     unpaid and on a non-public cohort, so it is excluded twice over.
--       SELECT public.cohort_seats_taken('ial-chemistry-as-sep-2026');
--     ⚠ A 0 HERE PROVES ALMOST NOTHING ON ITS OWN — a function that always
--     returned 0 would pass. (b) is what makes it mean something.
--
-- (b) ⚠ THE CONTROL. Insert a PAID probe enrolment on a public cohort, expect
--     1, then delete it by the id captured at insert. Then insert an UNPAID one
--     and expect 0 again — that second half is what proves the paid filter is
--     doing the work rather than the is_public filter.
--
-- (c) anon still cannot read the TABLE:
--       SET ROLE anon; SELECT count(*) FROM public.cohort_enrolments; RESET ROLE;
--     EXPECT: 42501 permission denied.
--     ⚠ A 0 WOULD BE A FAILURE — it would mean a SELECT grant exists and RLS
--     merely filtered, which is a weaker posture than this file intends.
--
-- (d) the EXECUTE grants, with a control:
--       SELECT has_function_privilege('anon','public.cohort_seats_taken(text)','EXECUTE')          AS anon_exec,
--              has_function_privilege('authenticated','public.cohort_seats_taken(text)','EXECUTE') AS auth_exec,
--              has_function_privilege('anon','public.cohort_seats_taken(text)','EXECUTE')
--                AND has_table_privilege('anon','public.cohorts','SELECT')                          AS control_true;
--     EXPECT: t, t, t — anon may call the function AND already reads cohorts,
--     which is the control proving the name resolves.
