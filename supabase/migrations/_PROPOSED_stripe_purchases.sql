-- ============================================================================
-- _PROPOSED_stripe_purchases.sql
-- ----------------------------------------------------------------------------
-- ⚠ UNNUMBERED, PARKED, AND NOT APPLIED. Planning owns migration numbering;
--   0070+ being unused does not make it available. Nothing here has run.
--
-- ⚠ AND THE INTEGRATION WORKS WITHOUT IT. Entitlement GRANTING is already
--   idempotent against existing tables: lesson_credit_transactions carries a
--   UNIQUE index on idempotency_key (0047), which is what refuses a replayed
--   Stripe event, and entitlements carries entitlements_one_active_per_subject
--   (0058). This table adds an AUDIT RECORD §13 asks for — what was bought,
--   by whom, for how much — not the mechanism that makes the grant safe.
--   It is proposed rather than assumed because a payment record you cannot
--   reconcile is a support problem waiting to happen, not because the webhook
--   needs it to be correct.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_purchases (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ⚠ THE PERSON. This is what makes the table person-naming, and therefore
  -- what obliges the erase_user extension at the foot of this file.
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ⚠ THE EVENT, AND THE REASON THIS COLUMN IS UNIQUE. Stripe retries an event
  -- on any non-2xx or timeout, by design. A second row for the same event is a
  -- double-counted payment in every report built on this table.
  stripe_event_id      text NOT NULL,

  stripe_customer_id   text,
  checkout_session_id  text,
  payment_intent_id    text,
  subscription_id      text,

  -- What was sold. Stripe still owns the amounts; these are a record of what
  -- was charged AT THE TIME, which is exactly the thing a later price change
  -- must not rewrite.
  stripe_price_id      text NOT NULL,
  stripe_product_id    text NOT NULL,
  currency             text NOT NULL,
  amount_minor         integer NOT NULL,

  -- The internal selection, so a purchase can be read without calling Stripe.
  course               text NOT NULL,
  mode                 text NOT NULL,
  package              text NOT NULL,

  -- What it granted, as a record of the decision that was made.
  entitlement_kind     text NOT NULL,
  entitlement_detail   text,

  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stripe_purchases_currency_known CHECK (currency IN ('qar', 'gbp')),
  CONSTRAINT stripe_purchases_amount_sane CHECK (amount_minor > 0),
  CONSTRAINT stripe_purchases_mode_known CHECK (mode IN ('one_to_one', 'group')),
  CONSTRAINT stripe_purchases_entitlement_known
    CHECK (entitlement_kind IN ('one_to_one_credits', 'group_enrolment'))
);

-- ⚠ ONE ROW PER STRIPE EVENT, ENFORCED. See the column comment above.
CREATE UNIQUE INDEX IF NOT EXISTS stripe_purchases_event_once
  ON public.stripe_purchases (stripe_event_id);

CREATE INDEX IF NOT EXISTS stripe_purchases_user_idx
  ON public.stripe_purchases (user_id, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.stripe_purchases ENABLE ROW LEVEL SECURITY;

-- ⚠ A STUDENT MAY READ THEIR OWN RECEIPTS AND NOTHING ELSE. There is no write
-- policy for any client role at all: rows are written by the webhook through
-- the service role, and a student who could INSERT here could manufacture a
-- purchase record for a payment that never happened.
DROP POLICY IF EXISTS stripe_purchases_read_own ON public.stripe_purchases;
CREATE POLICY stripe_purchases_read_own
  ON public.stripe_purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

-- ── GRANTS ──────────────────────────────────────────────────────────────────
-- ⚠ SELECT ONLY, AND ONLY TO authenticated. anon gets nothing: a receipt names
-- a person and an amount.
GRANT SELECT ON public.stripe_purchases TO authenticated;

-- ⚠ THE THREE PRIVILEGES SUPABASE HANDS OUT BY DEFAULT, TAKEN BACK.
--   TRUNCATE is not filtered by RLS — a row policy cannot protect a table from
--   it. TRIGGER attaches arbitrary code to every future write. REFERENCES lets
--   a client constrain what the owner may later delete.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.stripe_purchases FROM anon, authenticated;

-- ============================================================================
-- ERASE_USER COUPLING — REQUIRED, AND HERE IT IS
-- ============================================================================
-- ⚠ THIS TABLE NAMES A PERSON. user_id references auth.users, and every row
--   ties an identity to a payment. So the erasure belongs in THIS file, in the
--   same change that creates the table — the standing rule exists because a
--   table added in one migration and erased in a later one is a table that was
--   un-erasable for however long the gap lasted.
--
-- ⚠ THE ON DELETE CASCADE IS NOT SUFficient ON ITS OWN. erase_user erases a
--   person WITHOUT deleting the auth.users row in every path (0067 v5 erases
--   in place for a retained account), so the cascade would not fire. The
--   explicit DELETE below is what actually removes the rows.
--
-- ⚠ AND IT IS A DELETE, NOT AN ANONYMISATION. A purchase record's whole value
--   is that it names who paid; a stripe_purchases row with the user nulled out
--   is a payment nobody can reconcile AND still a record of a transaction, so
--   it fails at both jobs. Financial records that must outlive an erasure
--   belong in Stripe, which is the system of record for payments and has its
--   own retention obligations — not in a table we erase from.
--
-- To be inserted into erase_user (v6) alongside the existing deletes, in the
-- same section as lesson_credit_transactions:
--
--   DELETE FROM public.stripe_purchases WHERE user_id = p_user_id;
--
-- Placed BEFORE the auth.users delete and after entitlements, so the ordering
-- matches the existing body and no foreign key is left dangling mid-run.

COMMIT;

-- ============================================================================
-- VERIFICATION — TO BE RUN AFTER APPLYING. EVERY STEP RETURNS A COUNT.
-- ============================================================================
-- 1. EXPECT 1 — the table exists:
--      SELECT count(*) FROM information_schema.tables
--       WHERE table_schema='public' AND table_name='stripe_purchases';
--
-- 2. EXPECT 0 — the three dangerous privileges are gone:
--      SELECT count(*) FROM information_schema.role_table_grants
--       WHERE table_schema='public' AND table_name='stripe_purchases'
--         AND grantee IN ('anon','authenticated')
--         AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
--
-- 3. EXPECT 0 — anon holds nothing at all:
--      SELECT count(*) FROM information_schema.role_table_grants
--       WHERE table_schema='public' AND table_name='stripe_purchases' AND grantee='anon';
--
-- 4. EXPECT 1 — the replay guard exists:
--      SELECT count(*) FROM pg_indexes
--       WHERE schemaname='public' AND indexname='stripe_purchases_event_once';
--
-- 5. EXPECT a duplicate-key ERROR (23505) — the guard actually bites. The ERROR
--    is the PASS condition; a successful second insert is the failure:
--      INSERT INTO public.stripe_purchases
--        (user_id,stripe_event_id,stripe_price_id,stripe_product_id,currency,
--         amount_minor,course,mode,package,entitlement_kind)
--      VALUES ('<uid>','evt_probe','price_x','prod_x','qar',30000,'as','one_to_one','single','one_to_one_credits');
--      -- run the identical statement again; expect
--      -- duplicate key value violates unique constraint "stripe_purchases_event_once"
--    Then: DELETE FROM public.stripe_purchases WHERE stripe_event_id='evt_probe';
--    ⚠ Delete by the key you inserted, never a table-wide sweep.
--
-- 6. EXPECT 0 after an erasure — the coupling works:
--      SELECT count(*) FROM public.stripe_purchases WHERE user_id='<erased uid>';
-- ============================================================================
