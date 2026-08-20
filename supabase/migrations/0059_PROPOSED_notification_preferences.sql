-- ============================================================================
-- 0059_PROPOSED_notification_preferences.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. Number from the planning chat. Independent of
-- 0058. Run each section separately.
--
-- ============================================================================
-- ⚠ TRANSACTIONAL AND MARKETING ARE NOT TWO VALUES OF ONE SETTING (§80)
-- ============================================================================
-- A student who turns off "promotions" has not asked to stop being told their
-- Saturday lesson moved. Collapsing them into one toggle is how a family finds
-- out about a cancellation by turning up.
--
-- So the categories are columns, not a jsonb blob, and the two that carry
-- OPERATIONAL truth are constrained so they cannot be silenced by accident.
--
-- ⚠ AND THE ROW IS OPTIONAL. No row means defaults, which are "on" for
-- everything except marketing. A student who has never opened Settings must
-- still be told their lesson moved, and an absent row must never read as
-- "opted out of everything".
--
-- ⚠ THIS SUPERSEDES profiles.notification_preferences (jsonb, 0017:154), AND
-- I CHECKED BEFORE DECIDING THAT. 0017 chose jsonb for stated reasons: "always
-- read and written whole, never queried across users, nothing joins to it,
-- nothing aggregates it." Two of those are no longer true, and the third was
-- never safe:
--
--   1. A SENDER QUERIES ACROSS USERS. "Everyone with tuition email on" is a
--      WHERE clause. That is the primary access pattern the moment 0053's
--      ledger has something to send, and it is the one jsonb is worst at.
--   2. CONSENT EVIDENCE MUST NOT BE SELF-WRITABLE. 0018 grants authenticated
--      UPDATE on that jsonb column, and a jsonb column cannot be scoped by key
--      — so a user could write their own marketing_opt_in_at. "When did they
--      agree" is only worth recording if the answer is not the user's to type.
--      A withheld column grant is the only thing that can enforce that.
--   3. AN OPERATIONAL CHANNEL CANNOT BE MADE UN-SILENCEABLE IN A BAG. The
--      CHECK below plus the withheld grant take two independent layers; jsonb
--      offers one, and a weak one.
--
-- ⚠ AND THE OLD COLUMN IS NOT DROPPED HERE. `grep -rn notification_preferences
-- src/ scripts/` returns ZERO hits in this repository — nothing reads or writes
-- it — but a DROP COLUMN is its own decision with its own two-repo reference
-- audit, which is the standard 0034 set. It stays, unread, until that audit is
-- done. Until then this table is the only preference store any code consults.
--
-- ⚠ IT PAIRS WITH 0053, WHICH HAS NO PREFERENCES AT ALL. notification_events
-- records what happened and notification_deliveries records how it was told;
-- neither knows whether the student wanted it. The sender consults this table
-- before creating a delivery — the EVENT is still written either way, because
-- what happened happened.

-- ── SECTION 1: TABLE ────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  -- ⚠ THE USER IS THE KEY. One row per person, so there is no way to end up
  -- with two disagreeing preference sets and no rule for which wins.
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  /**
   * ⚠ ACADEMIC AND TUITION DEFAULT ON AND ARE OPERATIONAL. Feedback ready,
   * assignment due, lesson moved, class cancelled — a student consented to
   * these by enrolling, and they are the messages that change what somebody
   * does on a Saturday.
   */
  academic_email    boolean NOT NULL DEFAULT true,
  academic_in_app   boolean NOT NULL DEFAULT true,
  tuition_email     boolean NOT NULL DEFAULT true,
  tuition_in_app    boolean NOT NULL DEFAULT true,

  announcements_email  boolean NOT NULL DEFAULT true,
  announcements_in_app boolean NOT NULL DEFAULT true,

  /**
   * ⚠ MARKETING DEFAULTS OFF, AND THAT IS NOT A UI PREFERENCE. Consent to be
   * sold to is not implied by buying something, and Ailemy may serve minors.
   * Opt-in is the only defensible default and the DEFAULT here is where it is
   * enforced, not in a form.
   */
  marketing_email   boolean NOT NULL DEFAULT false,
  marketing_in_app  boolean NOT NULL DEFAULT false,
  /** When they opted in, so "when did they agree" is answerable (§80, 0040). */
  marketing_opt_in_at timestamptz,

  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- ⚠ MARKETING ON MUST CARRY ITS TIMESTAMP. Being able to say WHEN somebody
  -- agreed is the whole value of recording it — the same rule 0040 applies to
  -- interest_registrations.consent_at.
  CONSTRAINT notification_preferences_marketing_needs_timestamp
    CHECK ((marketing_email IS FALSE AND marketing_in_app IS FALSE)
           OR marketing_opt_in_at IS NOT NULL),

  /**
   * ⚠ THE IN-APP CHANNEL FOR OPERATIONAL CATEGORIES CANNOT BE TURNED OFF.
   * In-app costs a student nothing, arrives nowhere but their own account, and
   * is the only channel that works while no email sender exists. A student who
   * silences it has no way to learn their lesson moved. Email stays theirs to
   * refuse — that reaches them elsewhere and is genuinely a preference.
   */
  CONSTRAINT notification_preferences_operational_in_app_stays_on
    CHECK (academic_in_app IS TRUE AND tuition_in_app IS TRUE)
);

COMMENT ON TABLE public.notification_preferences IS
  'One row per person; absent means defaults. Transactional categories are separate from marketing, and the operational in-app channel cannot be disabled — it is the only channel that reaches a student while no email sender exists.';

COMMIT;

-- ── SECTION 2: ROW-LEVEL SECURITY ───────────────────────────────────────────
BEGIN;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- ⚠ NO anon POLICY.

DROP POLICY IF EXISTS notification_preferences_read_own ON public.notification_preferences;
CREATE POLICY notification_preferences_read_own
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (public.notification_preferences.user_id = auth.uid());

-- ⚠ A STUDENT MAY CREATE THEIR OWN ROW, FOR THEMSELVES, AND THE WITH CHECK
-- PROVES THE SECOND HALF rather than trusting the form.
DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
CREATE POLICY notification_preferences_insert_own
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (public.notification_preferences.user_id = auth.uid());

-- ⚠ USING AND WITH CHECK BOTH, AND BOTH RESTATE THE CONDITION. A policy that
-- admits a row for UPDATE without re-stating it lets the row be moved OUT of
-- the set it was allowed from — here, reassigned to another user_id.
DROP POLICY IF EXISTS notification_preferences_update_own ON public.notification_preferences;
CREATE POLICY notification_preferences_update_own
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (public.notification_preferences.user_id = auth.uid())
  WITH CHECK (public.notification_preferences.user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_staff_read ON public.notification_preferences;
CREATE POLICY notification_preferences_staff_read
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (public.is_staff());

COMMIT;

-- ── SECTION 3: GRANTS + NOTIFY ──────────────────────────────────────────────
BEGIN;

GRANT SELECT ON public.notification_preferences TO authenticated;

/**
 * ⚠ COLUMN-LEVEL, BECAUSE RLS FILTERS ROWS AND NEVER COLUMNS. The policy above
 * admits the right ROW; only this stops a student writing updated_at to a
 * fiction, and only this makes the set of settable columns explicit enough to
 * read. user_id is grantable on INSERT because the row has to name its owner —
 * and the WITH CHECK is what stops them naming somebody else.
 *
 * ⚠ marketing_opt_in_at IS DELIBERATELY GRANTED. A student turning marketing
 * ON must stamp the moment they agreed, and the CHECK refuses the row without
 * it. The alternative — a trigger — hides consent capture from the one place
 * anybody looks for it.
 */
GRANT INSERT (user_id, academic_email, tuition_email,
              announcements_email, announcements_in_app,
              marketing_email, marketing_in_app, marketing_opt_in_at)
  ON public.notification_preferences TO authenticated;

GRANT UPDATE (academic_email, tuition_email,
              announcements_email, announcements_in_app,
              marketing_email, marketing_in_app, marketing_opt_in_at)
  ON public.notification_preferences TO authenticated;

-- ⚠ academic_in_app AND tuition_in_app ARE NOT IN EITHER GRANT. The CHECK
-- already refuses false; withholding the column means a client cannot even
-- name them, so the two layers fail differently — 42501 on the column, or
-- 23514 from the constraint if anything ever reaches it another way.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.notification_preferences FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) defaults are what an absent row means
-- INSERT (user_id) VALUES (<u>); SELECT * FROM notification_preferences WHERE user_id=<u>;
-- PASS: academic/tuition/announcements all TRUE, marketing both FALSE,
--   marketing_opt_in_at NULL.
--   ⚠ IF MARKETING DEFAULTED TRUE this file has silently opted a minor into
--   promotions. Check it explicitly rather than trusting the DEFAULT clause.
--
-- (b) marketing on without a timestamp is refused
-- UPDATE … SET marketing_email = true WHERE user_id=<u>;
-- PASS: violates notification_preferences_marketing_needs_timestamp.
-- ...and WITH marketing_opt_in_at = now(): 1 row. ⚠ BOTH HALVES.
--
-- (c) ⚠ THE OPERATIONAL IN-APP CHANNEL CANNOT BE SILENCED
-- (as service_role, bypassing the column grant to test the CONSTRAINT)
-- UPDATE … SET tuition_in_app = false WHERE user_id=<u>;
-- PASS: violates notification_preferences_operational_in_app_stays_on.
--   This is the check that stops a student losing a cancellation notice.
--
-- (d) …and a student cannot even NAME those columns
-- (from a real student session)
-- UPDATE public.notification_preferences SET tuition_in_app = false
--  WHERE user_id = auth.uid();
-- PASS: 42501, permission denied — THE COLUMN GRANT, not the constraint.
--   ⚠ NOTE WHICH LAYER ANSWERED. Postgres words a write-side column-privilege
--   failure as "permission denied for TABLE"; the proof it is the column grant
--   and not a missing table grant is the CONTROL below.
-- (e) …the control: the SAME session updating a GRANTED column succeeds
-- UPDATE public.notification_preferences SET announcements_email = false
--  WHERE user_id = auth.uid();
-- PASS: 1 row. A table grant is now ruled out, so (d) was the column grant.
--
-- (f) student A cannot read or write B's preferences
-- (from A's session, with a row for B present and confirmed as service_role)
-- SELECT count(*) FROM public.notification_preferences;
-- PASS: A's row only.
-- UPDATE public.notification_preferences SET announcements_email=false
--  WHERE user_id = <B's uid>;
-- PASS: 0 rows — the policy, silently, which is what a row policy does.
-- INSERT (user_id, academic_email) VALUES (<B's uid>, false);
-- PASS: new row violates row-level security policy — the WITH CHECK.
--   ⚠ THE TWO FAIL DIFFERENTLY AND BOTH MATTER.
--
-- (g) anon is refused OUTRIGHT
-- SET ROLE anon; SELECT count(*) FROM public.notification_preferences; RESET ROLE;
-- PASS: permission denied. ⚠ A 0 would be a failure.
--
-- (h) privileges, with a control
-- SELECT
--   has_table_privilege('anon','public.notification_preferences','TRUNCATE')  AS a_t,
--   has_table_privilege('anon','public.notification_preferences','TRIGGER')   AS a_g,
--   has_table_privilege('anon','public.notification_preferences','REFERENCES')AS a_r,
--   has_table_privilege('authenticated','public.notification_preferences','TRUNCATE') AS u_t,
--   has_table_privilege('authenticated','public.notification_preferences','DELETE')   AS u_d,
--   has_table_privilege('authenticated','public.notification_preferences','SELECT')   AS control_true;
-- PASS: f,f,f,f,f,t
--
-- (i) the settable columns are exactly what §3 granted
-- SELECT column_name FROM information_schema.column_privileges
--  WHERE table_schema='public' AND table_name='notification_preferences'
--    AND grantee='authenticated' AND privilege_type='UPDATE' ORDER BY column_name;
-- PASS exactly: announcements_email, announcements_in_app, academic_email,
--   marketing_email, marketing_in_app, marketing_opt_in_at, tuition_email
--   ⚠ IF academic_in_app OR tuition_in_app APPEARS, a student can silence the
--   channel that tells them a lesson moved. Stop and say so.
