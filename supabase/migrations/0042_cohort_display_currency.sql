-- ============================================================================
-- 0042_PROPOSED_cohort_display_currency.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-19 by the founder in the SQL Editor, no
-- errors. Renamed from 0042_PROPOSED_ at the same time, per the standing rule
-- that a file must not claim to be unapplied once it is live.
--
-- VERIFICATION RESULT — 15 of the 16 checks below were RUN AND PASSED against
-- production immediately after applying:
--
--   (a) column exists ✓ · rejects 1.5, so it is integer ✓ · accepts NULL ✓
--       ⚠ BEHAVIOURAL EVIDENCE, NOT THE CATALOG. information_schema is not
--       exposed through PostgREST, so data_type and is_nullable could not be
--       READ; they were exercised instead. Weaker, and recorded as weaker.
--   (b) 80000 refused by cohorts_price_qar_plausible ✓ · 50000 refused at the
--       boundary ✓ · 49999 accepted, so the bound is where it claims ✓
--   (c) 800 accepted and reads back as 800 ✓
--   (d) 0 refused ✓ · -1 refused ✓
--   (e) every row NULL before any value was set ✓
--   (f) anon reads price_qar with no new grant ✓
--   (g) anon UPDATE refused, 42501 ✓
--
--   ⚠ (i) THE THREE PRIVILEGES WAS NOT RUN AND IS NOT CLAIMED. PostgREST
--   exposes neither information_schema.role_table_grants nor any way to
--   exercise TRUNCATE/TRIGGER/REFERENCES, so there is no substitute for
--   running block (i) in the SQL Editor. It remains outstanding.
--
-- Values set the same day, by slug: AS 800, Y11 700, Y10 650 QAR.
--
-- ⚠ ADDITIVE ONLY, ONE COLUMN. cohorts already exists (0009) and already
-- carries price_pence and currency (0009) plus the public catalogue columns
-- (0041). This adds a SECOND, DISPLAY-ONLY price and changes nothing about the
-- first.
--
-- ============================================================================
-- ⚠ GBP IS THE PRICE OF RECORD. price_qar IS A LABEL.
-- ============================================================================
-- price_pence remains the only amount anyone is ever billed, the only amount a
-- payment link is built from, and the only amount that means anything in a
-- dispute. price_qar exists so a visitor in Doha can read a number in their own
-- currency, and for no other purpose.
--
-- Three things follow, and they are the reason this is a nullable column rather
-- than a computed one:
--
--   • IT IS HAND-SET, NEVER CONVERTED. No FX rate is stored, fetched or
--     applied anywhere in this system. A rate fetched at render time makes the
--     advertised price move on its own; a rate stored here goes stale silently.
--     The founder types a round number and it stays until they change it.
--   • NULL MEANS "NO QAR PRICE HAS BEEN SET", and the UI must then show GBP
--     regardless of where the visitor is. NULL is not zero and not "free" and
--     must never render as a price.
--   • IT IS NOT AUTHORITATIVE. Every surface that shows QAR must also show the
--     GBP figure it is billed in. That is a UI rule this migration cannot
--     enforce, and it is stated here because the column's whole risk is
--     somebody later treating it as the price.
--
-- ============================================================================
-- ⚠⚠ THE UNIT. READ THIS BEFORE TYPING A VALUE.
-- ============================================================================
-- price_qar is in WHOLE QATARI RIYALS.  800  means  800 QAR.
--
-- This DIFFERS from price_pence on the same table, which is in minor units
-- (16900 = £169.00). Two money columns on one table with two conventions is a
-- genuine hazard, and the column name the instruction specified — price_qar,
-- not price_qar_dirhams — reads as riyals to everyone who will ever see it.
-- Fighting the name would be worse than documenting the difference.
--
-- So the difference is made STRUCTURAL rather than left to memory: the CHECK
-- below rejects anything at or above 50000. A value entered in dirhams by
-- mistake — 800 QAR typed as 80000 — is refused by the database instead of
-- being advertised as a hundredfold error. Raise the bound if a cohort ever
-- genuinely costs more than 50,000 QAR a month; do not remove it.
-- ============================================================================

BEGIN;

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS price_qar integer;

COMMENT ON COLUMN public.cohorts.price_qar IS
  'DISPLAY ONLY, in WHOLE QATARI RIYALS (800 = 800 QAR). GBP price_pence is the '
  'billing price of record and the only amount ever charged. Hand-set, never '
  'converted: no FX rate is stored or fetched anywhere in this system. NULL '
  'means no QAR price has been set, and the UI must show GBP regardless of the '
  'visitor''s location. Any surface showing QAR must also show the GBP figure.';

-- ⚠ THE UNIT GUARD. Named so the error says what went wrong: a constraint
-- called "plausible" sends the reader to this file rather than to a debugger.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cohorts_price_qar_plausible'
       AND conrelid = 'public.cohorts'::regclass
  ) THEN
    ALTER TABLE public.cohorts
      ADD CONSTRAINT cohorts_price_qar_plausible
      CHECK (price_qar IS NULL OR (price_qar > 0 AND price_qar < 50000));
  END IF;
END $$;

-- ⚠ NO NEW GRANT IS NEEDED, AND NONE IS ISSUED. 0041 granted SELECT on the
-- TABLE to anon, and a table-level SELECT grant in Postgres covers columns
-- added afterwards. price_qar is therefore readable by anonymous visitors the
-- moment it exists, which is exactly what a display price is for. anon still
-- holds no INSERT/UPDATE/DELETE on cohorts, so it cannot be written from a
-- browser.
--
-- ⚠ NO NEW POLICY EITHER. 0041's cohorts_read_public already gates reads on
-- is_public, and RLS filters ROWS, not columns — there is no row this column
-- makes visible that was not visible already.

-- ⚠ THE THREE PRIVILEGES, PER AGENTS.md. Re-asserted because this migration
-- touches the table and the check is cheap. 0041 revoked them; a REVOKE of
-- something already revoked is a no-op.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.cohorts FROM anon, authenticated;

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICATION (run after applying; every block must return what it claims)
-- ----------------------------------------------------------------------------
-- (a) the column exists, is integer, and is nullable
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='cohorts' AND column_name='price_qar';
-- PASS: one row — price_qar | integer | YES.
--   ⚠ is_nullable must be YES. A NOT NULL here would force a QAR price onto
--   every cohort, including ones that should only ever show GBP.
--
-- (b) the dirham mistake is REFUSED — the sabotage this constraint exists for
-- UPDATE public.cohorts SET price_qar = 80000 WHERE slug = 'ial-chemistry-as-sep-2026';
-- PASS: violates check constraint "cohorts_price_qar_plausible".
--   ⚠ A SUCCESS here is a FAILURE of this migration: it means 800 QAR typed in
--   dirhams would be advertised as 80,000.
--
-- (c) a plausible riyal figure is accepted
-- UPDATE public.cohorts SET price_qar = 800 WHERE slug = 'ial-chemistry-as-sep-2026';
-- PASS: one row updated. Without this, (b) proves only that the column rejects
--   everything.
--
-- (d) zero and negative are refused — NULL is the way to say "no QAR price",
--     and 0 must never reach a page as "0 QAR/month"
-- UPDATE public.cohorts SET price_qar = 0  WHERE slug = 'ial-chemistry-as-sep-2026';
-- UPDATE public.cohorts SET price_qar = -1 WHERE slug = 'ial-chemistry-as-sep-2026';
-- PASS: both violate cohorts_price_qar_plausible.
--
-- (e) NULL is still allowed, and is the default for every existing row
-- SELECT slug, price_qar FROM public.cohorts ORDER BY display_order;
-- PASS: every row reads NULL until one is deliberately set.
--
-- (f) anon can READ the column without any new grant
-- SET ROLE anon; SELECT slug, price_pence, price_qar FROM public.cohorts WHERE is_public;
-- PASS: the three public cohorts, price_qar included.
--
-- (g) anon still cannot WRITE it
-- SET ROLE anon; UPDATE public.cohorts SET price_qar = 1 WHERE is_public;
-- PASS: permission denied for table cohorts.
--
-- (h) put it back to NULL after verifying, so no price is advertised before the
--     founder has decided one — by slug, never a table-wide sweep
-- RESET ROLE;
-- UPDATE public.cohorts SET price_qar = NULL WHERE slug = 'ial-chemistry-as-sep-2026';
--
-- (i) the three privileges are gone
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='cohorts'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
