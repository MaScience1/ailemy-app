-- ============================================================================
-- _PROPOSED_tuition_subject_interest.sql
-- ----------------------------------------------------------------------------
-- ⚠ UNNUMBERED, PARKED, NOT APPLIED. Planning issues numbers; the founder
--   applies. Nothing here has run against any database.
--
-- ⚠ IT IS AN ALTER, NOT A NEW TABLE — AND THAT IS THE FINDING.
--   Planning override 3 says to assume a new table is needed because "no
--   existing one holds 13 fields per lead with an upsert key". Inspection says
--   otherwise: public.interest_registrations (0040, extended by 0043) already
--   holds 24 data columns including subject, qualification, exam_board,
--   student_name, parent_name, email, phone, country, timezone, current_grade,
--   target_grade, preferred_days, preferred_times, year_group, exam_year,
--   student_notes, consent_to_contact and consent_at.
--
--   It is a LIVE table: the existing /tuition/interest page inserts into it
--   under the anon key today. A second lead store would be the "unnecessary
--   parallel lead database" §20 forbids, and would split real leads across two
--   places with no key to join them.
--
--   What it genuinely lacks is below. Override 3 is right about the upsert key
--   and about roughly ten columns; it is wrong that a new table is needed.
--   ⚠ FOUNDER RULING WANTED: if you would rather have a separate table, say so
--   and this file becomes a CREATE TABLE instead. Nothing depends on the
--   choice yet, because nothing has been applied.
-- ============================================================================

BEGIN;

-- ── the columns the demand funnel needs ─────────────────────────────────────

-- ⚠ THE ACCOUNT LINK, AND THE REASON THE UPSERT KEY CAN EXIST AT ALL.
--   0040 has no user_id and no foreign key of any kind, so today two
--   submissions from the same person are two unrelated rows. NULL is allowed
--   because the existing anonymous funnel still writes rows with no account.
ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ⚠ MODE IS A SEPARATE DEMAND SIGNAL (§7, §12). "Physics group" and "Physics
--   1-to-1" are different questions for the founder, so they are different
--   rows rather than one row with a preference field overwritten.
ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS tuition_mode text;

ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS mode_preference text;

-- Who is filling the form in. 0040 infers this from parent_name being present,
-- which is not the same thing — a parent may leave their own name blank.
ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS registrant_role text;

-- §9.8 — multiple goals, so an array rather than a delimited string nobody can
-- query. text[] keeps it filterable in the admin breakdown without a join table.
ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS goals text[];

-- ⚠ §9.9 REPLACES A BOOLEAN WITH FIVE OPTIONS. 0040's ready_to_start is
--   boolean and cannot express "within 2–3 months". The old column is LEFT IN
--   PLACE and untouched — it holds real answers from live leads, and dropping
--   it would destroy data to tidy a name.
ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS start_timeframe text;

ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS contact_preference text;

-- ⚠ TWO CONSENTS, TWO COLUMNS, DIFFERENT DEFAULTS (planning override 8).
--   consent_to_contact already exists and is NOT NULL with a CHECK requiring
--   it to be true — that is consent to be contacted about THIS request.
--   Marketing is a different permission, defaults to FALSE, and is never
--   bundled into the same checkbox.
ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS consent_to_marketing boolean NOT NULL DEFAULT false;

ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

-- §22 — the phone in E.164 with its country code, alongside the existing free
-- text `phone`. Normalised at write time by the application, never parsed here.
ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS phone_e164 text;

ALTER TABLE public.interest_registrations
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

-- ── constrained vocabularies ────────────────────────────────────────────────
-- ⚠ EVERY ONE ALLOWS NULL, because 0040 rows predate these columns and a NOT
--   NULL here would fail the ALTER against live data.

ALTER TABLE public.interest_registrations
  DROP CONSTRAINT IF EXISTS interest_registrations_tuition_mode_check;
ALTER TABLE public.interest_registrations
  ADD CONSTRAINT interest_registrations_tuition_mode_check
  CHECK (tuition_mode IS NULL OR tuition_mode IN ('one_to_one', 'group'));

ALTER TABLE public.interest_registrations
  DROP CONSTRAINT IF EXISTS interest_registrations_mode_preference_check;
ALTER TABLE public.interest_registrations
  ADD CONSTRAINT interest_registrations_mode_preference_check
  CHECK (mode_preference IS NULL OR mode_preference IN ('one_to_one', 'group', 'either'));

ALTER TABLE public.interest_registrations
  DROP CONSTRAINT IF EXISTS interest_registrations_registrant_role_check;
ALTER TABLE public.interest_registrations
  ADD CONSTRAINT interest_registrations_registrant_role_check
  CHECK (registrant_role IS NULL OR registrant_role IN ('student', 'parent'));

ALTER TABLE public.interest_registrations
  DROP CONSTRAINT IF EXISTS interest_registrations_start_timeframe_check;
ALTER TABLE public.interest_registrations
  ADD CONSTRAINT interest_registrations_start_timeframe_check
  CHECK (start_timeframe IS NULL OR start_timeframe IN
    ('asap', 'within_1_month', 'within_2_3_months', 'next_term', 'exploring'));

ALTER TABLE public.interest_registrations
  DROP CONSTRAINT IF EXISTS interest_registrations_contact_preference_check;
ALTER TABLE public.interest_registrations
  ADD CONSTRAINT interest_registrations_contact_preference_check
  CHECK (contact_preference IS NULL OR contact_preference IN ('email', 'whatsapp', 'either'));

-- ⚠ 'withdrawn' DOES NOT EXIST IN 0040'S status CHECK, so §13's withdraw action
--   would fail the constraint. The vocabulary is extended, not replaced — the
--   five existing values are all still valid and no live row changes meaning.
ALTER TABLE public.interest_registrations
  DROP CONSTRAINT IF EXISTS interest_registrations_status_check;
ALTER TABLE public.interest_registrations
  ADD CONSTRAINT interest_registrations_status_check
  CHECK (status IN ('new', 'contacted', 'converted', 'declined', 'duplicate', 'withdrawn'));

-- ── the upsert key (§12) ────────────────────────────────────────────────────
-- ⚠ PARTIAL, ON user_id — so it binds only the account-linked rows this funnel
--   creates and leaves the existing anonymous rows (user_id NULL) alone. A
--   plain UNIQUE would collapse every legacy anonymous lead into one.
--
-- ⚠ AND IT INCLUDES tuition_mode, because Physics-group and Physics-1-to-1 are
--   two demand signals the founder needs counted separately (§12).
CREATE UNIQUE INDEX IF NOT EXISTS interest_registrations_one_per_user_subject_mode
  ON public.interest_registrations (user_id, subject, tuition_mode)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS interest_registrations_user_idx
  ON public.interest_registrations (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ── RLS: a student may read and maintain their OWN registration ─────────────
-- ⚠ 0040 GIVES NON-STAFF NO SELECT POLICY AT ALL, deliberately — a lead list is
--   not public. That stays true for everyone else; these two policies are
--   scoped to auth.uid() = user_id so a person can see and update only their
--   own row, which is what §13's "My tuition interests" needs.
DROP POLICY IF EXISTS interest_registrations_read_own ON public.interest_registrations;
CREATE POLICY interest_registrations_read_own
  ON public.interest_registrations FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS interest_registrations_update_own ON public.interest_registrations;
CREATE POLICY interest_registrations_update_own
  ON public.interest_registrations FOR UPDATE TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (user_id IS NOT NULL AND user_id = auth.uid());

-- ⚠ COLUMN-LEVEL UPDATE, NOT TABLE-WIDE. 0040 grants UPDATE on the whole table
--   to authenticated; RLS filters ROWS but never COLUMNS, so without this a
--   student could rewrite `status` or `notes` on their own row — flipping
--   themselves to 'converted' or editing the staff scratchpad. The grant is
--   narrowed to the fields a person legitimately maintains.
REVOKE UPDATE ON public.interest_registrations FROM authenticated;
GRANT UPDATE (
  tuition_mode, mode_preference, registrant_role, goals, start_timeframe,
  contact_preference, consent_to_marketing, marketing_consent_at, phone_e164,
  withdrawn_at, student_name, parent_name, phone, country, timezone,
  current_grade, target_grade, preferred_days, preferred_times, year_group,
  exam_year, student_notes, qualification, exam_board, updated_at
) ON public.interest_registrations TO authenticated;
GRANT SELECT ON public.interest_registrations TO authenticated;

-- ⚠ THE THREE PRIVILEGES SUPABASE HANDS OUT BY DEFAULT, TAKEN BACK AGAIN.
--   0040 and 0043 both revoke them; a new ALTER does not re-grant them, but
--   this is asserted here so the standing check keeps returning zero rows.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.interest_registrations FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- ERASE_USER — MANDATORY, AND HERE IT IS (planning override 4)
-- ============================================================================
-- ⚠ THIS TABLE NAMES REAL PEOPLE, INCLUDING MINORS. student_name, parent_name,
--   email, phone, phone_e164 and student_notes are all personal data about a
--   child in most rows. An erase_user that does not clear them leaves a
--   erased family's contact details in a lead list.
--
-- ⚠ AND ON DELETE CASCADE IS NOT SUFFICIENT. 0067 (erase_user v5) erases IN
--   PLACE on the retained-account path without deleting the auth.users row, so
--   the cascade never fires. The explicit DELETE below is what actually runs.
--
-- ⚠ IT IS A DELETE, NOT AN ANONYMISATION. A lead row exists to be contacted;
--   stripped of its contact details it is neither usable demand data nor
--   erased. The aggregate demand counts the founder needs are preserved
--   separately in the admin dashboard's own reads, not by keeping the person.
--
-- To be inserted into erase_user (v6), in the same section as the other
-- person-naming deletes and BEFORE the auth.users delete:
--
--   DELETE FROM public.interest_registrations WHERE user_id = p_user_id;
--
--   -- ⚠ AND THE ANONYMOUS ROWS THAT MATCH BY EMAIL. The existing funnel writes
--   -- leads with no user_id; a person who registered interest before making an
--   -- account still has a row naming them, and erase_user must reach it.
--   DELETE FROM public.interest_registrations
--    WHERE user_id IS NULL AND lower(email) = lower(v_email);
--
-- ⚠ email_columns_scanned AFTER THIS APPLIES: 0067's gate currently reads 8.
--   interest_registrations.email is ALREADY one of the columns that gate counts
--   (the table predates 0067), so applying this file does NOT change the
--   number — it stays 8. What changes is that the DELETE above becomes
--   user_id-aware as well as email-aware. If the gate reads anything other
--   than 8 after applying, something else moved and it must be investigated
--   before the erasure is trusted.
-- ============================================================================

-- ============================================================================
-- VERIFICATION — TO BE RUN AFTER APPLYING. EVERY STEP RETURNS A COUNT.
-- ============================================================================
-- 1. EXPECT 11 — the new columns exist:
--      SELECT count(*) FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='interest_registrations'
--         AND column_name IN ('user_id','tuition_mode','mode_preference',
--             'registrant_role','goals','start_timeframe','contact_preference',
--             'consent_to_marketing','marketing_consent_at','phone_e164','withdrawn_at');
--
-- 2. EXPECT 1 — the upsert key exists and is partial:
--      SELECT count(*) FROM pg_indexes WHERE schemaname='public'
--        AND indexname='interest_registrations_one_per_user_subject_mode';
--
-- 3. EXPECT a duplicate-key ERROR (23505) on the SECOND insert — the guard
--    bites. The ERROR is the PASS condition:
--      INSERT INTO public.interest_registrations
--        (user_id,subject,qualification,student_name,email,consent_to_contact,
--         consent_at,tuition_mode)
--      VALUES ('<uid>','physics','gcse','Probe','probe@example.com',true,now(),'group');
--      -- run it again; expect duplicate key violates
--      -- "interest_registrations_one_per_user_subject_mode"
--    Then: DELETE FROM public.interest_registrations WHERE email='probe@example.com';
--    ⚠ Delete by the key you inserted, never a table-wide sweep.
--
-- 4. EXPECT 0 — marketing consent defaults to false, never true:
--      SELECT count(*) FROM public.interest_registrations WHERE consent_to_marketing IS TRUE
--       AND marketing_consent_at IS NULL;
--
-- 5. EXPECT 0 — a student cannot write status or notes:
--      SELECT count(*) FROM information_schema.column_privileges
--       WHERE table_name='interest_registrations' AND grantee='authenticated'
--         AND privilege_type='UPDATE' AND column_name IN ('status','notes','id','created_at');
--
-- 6. EXPECT 0 — the standing dangerous-privilege check:
--      SELECT count(*) FROM information_schema.role_table_grants
--       WHERE table_schema='public' AND table_name='interest_registrations'
--         AND grantee IN ('anon','authenticated')
--         AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
--
-- 7. EXPECT 8 — email_columns_scanned is unchanged by this file:
--      (run erase_user's own gate; see the erase_user section above)
-- ============================================================================
