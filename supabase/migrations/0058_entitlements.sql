-- ============================================================================
-- 0058_entitlements.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED 2026-08-20. Three pastes plus a standalone NOTIFY. DO NOT RE-RUN AGAINST
-- PRODUCTION — this file exists so a rebuild matches what is already live. It
-- is re-runnable (IF NOT EXISTS throughout, every policy dropped before it is
-- created), so re-running is harmless, but nothing here is left to apply.
--
-- VERIFIED, and what each check actually observed:
--   (a) 3 parts   subject/kind CHECK both directions, plus the accepted case
--   (b) 2 parts   admin grant needs a note, and inserts with one
--   (c) 2 parts   one ACTIVE per subject; the PARTIAL index lets a lapsed
--                 row be replaced, so a student can re-subscribe
--   (d)(e)        off-list source, off-list status, backwards window refused
--   (f)           anon: 42501 permission denied — NOT 0 rows
--   (i)           7 falses + control true
--   (g)(h)        from REAL student sessions, 14/14: a student cannot INSERT,
--                 UPDATE or DELETE an entitlement (all 42501 at the table
--                 grant, with a SELECT control proving the session works), the
--                 row is unchanged afterwards, and A cannot see B's — mirrored
--                 from B's side, against a fixture confirmed non-empty first.
--
-- ⚠ (g3) — the DELETE attempt — IS NOT IN THIS FILE'S VERIFICATION BLOCK. It
-- was added at run time: clearing a revocation is a third way to award yourself
-- access, and the block only sketched INSERT and UPDATE.
--
-- Numbering: 0050, 0056 and 0057 remain reserved. 0062 is the next free number.
--
-- ============================================================================
-- ⚠ WHAT A STUDENT OWNS, SEPARATE FROM HOW THEY BOUGHT IT (§75, §105)
-- ============================================================================
-- Access is currently inferable — subscriptions.tier, cohort_enrolments,
-- lesson_credit_transactions — and every one of those answers a DIFFERENT
-- question from "may this student open this thing".
--
--   subscriptions            what Stripe thinks is being billed
--   cohort_enrolments        which live class they belong to
--   lesson_credit_transactions  how many 1-to-1 lessons they have left
--
-- None of them can represent an App Store purchase, a Play purchase, an admin
-- grant, or a promo — and §75 is explicit that a student must not be asked to
-- repurchase on another device. A table keyed on the SOURCE of the grant is
-- the only shape that survives a second payment rail existing.
--
-- ⚠ AND §105'S REAL POINT IS THAT `if (stripe_status === …)` MUST NOT BE
-- SCATTERED THROUGH THE UI. One row here answers "does this student have
-- access, and until when" without any caller knowing what Stripe is.
--
-- ⚠ THIS TABLE GRANTS NOTHING BY ITSELF TODAY. Stripe is keyless, so nothing
-- writes a stripe-sourced row; the only rows that can exist are admin grants.
-- That is the correct starting state and the application must read it that way
-- rather than assuming an empty table means an outage.

-- ── SECTION 1: TABLE ────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS public.entitlements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  /**
   * ⚠ WHAT IS OWNED, NOT WHAT WAS SOLD. 'course' is access to a course's paid
   * content; 'cohort' is a seat in a live class; 'platform' is a whole-site
   * subscription if one ever exists. The SKU that produced it is `source_ref`.
   */
  kind          text NOT NULL,
  /** The thing itself: a course slug, a cohort slug, or NULL for platform. */
  subject_ref   text,

  /**
   * ⚠ WHERE IT CAME FROM, AND WHY THE TABLE EXISTS. A student who bought on
   * iOS and opens the web must not be asked to buy again — so access is a fact
   * about them, and the rail is metadata on that fact rather than the other
   * way round.
   */
  source        text NOT NULL,
  /** Provider identifier: a Stripe subscription id, a transaction id, a note. */
  source_ref    text,

  status        text NOT NULL DEFAULT 'active',
  /**
   * ⚠ NULL MEANS "UNTIL REVOKED", NOT "FOREVER BY ACCIDENT". An admin grant
   * for a scholarship student legitimately has no end date; a Stripe-sourced
   * row should always carry one, and the application says so rather than the
   * database guessing.
   */
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz,

  /** Free text for an admin grant: who authorised it and why. */
  note          text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT entitlements_kind_check
    CHECK (kind IN ('course','cohort','platform')),
  CONSTRAINT entitlements_source_check
    CHECK (source IN ('stripe','app_store','play','admin_grant','promo')),
  CONSTRAINT entitlements_status_check
    CHECK (status IN ('active','expired','revoked','pending')),
  CONSTRAINT entitlements_window_ordered
    CHECK (ends_at IS NULL OR ends_at > starts_at),

  -- ⚠ A platform entitlement HAS no subject; a course or cohort one MUST have
  -- one, or nothing can tell what was granted.
  CONSTRAINT entitlements_subject_matches_kind
    CHECK ((kind = 'platform') = (subject_ref IS NULL)),

  -- ⚠ AN ADMIN GRANT MUST SAY WHO AND WHY. It is the one source with no
  -- provider record behind it, so the note IS the audit trail (§103).
  CONSTRAINT entitlements_admin_grant_needs_note
    CHECK (source <> 'admin_grant' OR btrim(coalesce(note,'')) <> '')
);

/**
 * ⚠ ONE LIVE ENTITLEMENT PER THING PER PERSON. Partial, so a lapsed row does
 * not block a re-purchase — the same shape as 0052's one-open-request index.
 * Without it a webhook retry that slipped past idempotency would grant twice
 * and the balance of truth would be "whichever row was read first".
 */
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_one_active_per_subject
  ON public.entitlements (user_id, kind, coalesce(subject_ref, ''))
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS entitlements_user_idx
  ON public.entitlements (user_id, status);

COMMENT ON TABLE public.entitlements IS
  'What a student may access, independent of how it was bought. The access layer §105 asks for: one place to answer "may they open this", so no UI component reads a Stripe status.';

COMMIT;

-- ── SECTION 2: ROW-LEVEL SECURITY ───────────────────────────────────────────
BEGIN;

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

-- ⚠ NO anon POLICY. RLS denies by default and that absence is the protection.

-- A student sees their own, so the UI can explain what they have.
DROP POLICY IF EXISTS entitlements_read_own ON public.entitlements;
CREATE POLICY entitlements_read_own
  ON public.entitlements FOR SELECT TO authenticated
  USING (public.entitlements.user_id = auth.uid());

DROP POLICY IF EXISTS entitlements_staff_all ON public.entitlements;
CREATE POLICY entitlements_staff_all
  ON public.entitlements FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

/**
 * ⚠ NO STUDENT WRITE POLICY OF ANY KIND, AND THAT IS THE WHOLE SECURITY MODEL
 * OF THIS TABLE. A row here IS access. A student who could INSERT one would
 * grant themselves a paid course; a student who could UPDATE one would extend
 * their own subscription. Entitlements are written by the webhook handler and
 * by admin, both through service_role.
 */

COMMIT;

-- ── SECTION 3: GRANTS + NOTIFY ──────────────────────────────────────────────
BEGIN;

GRANT SELECT ON public.entitlements TO authenticated;

-- ⚠ NO INSERT, UPDATE OR DELETE FOR ANY CLIENT. Not narrowed by column —
-- withheld entirely. There is no column on this table a student may write.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.entitlements FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- ⚠ EVERY BLOCK CARRIES A CONTROL. "Zero rows" and "permission denied" look
-- identical to a typo'd table name; the control is what makes the negative
-- mean something. This is the standard 0051–0055 were held to.
--
-- (a) a platform entitlement must have no subject, and a course one must have
--     one — the same CHECK read in both directions.
-- INSERT (user_id,kind,source,note) VALUES (<u>,'platform','admin_grant','probe');
-- PASS: inserted.
-- INSERT (user_id,kind,subject_ref,source,note) VALUES (<u>,'platform','x','admin_grant','probe');
-- PASS: violates entitlements_subject_matches_kind.
-- INSERT (user_id,kind,source,note) VALUES (<u>,'course','admin_grant','probe');
-- PASS: violates entitlements_subject_matches_kind — a course grant naming
--   nothing cannot be acted on by any caller.
--
-- (b) an admin grant must say who and why
-- INSERT (user_id,kind,subject_ref,source) VALUES (<u>,'course','ial-chem','admin_grant');
-- PASS: violates entitlements_admin_grant_needs_note.
-- ...and WITH a note: inserted.  ⚠ BOTH HALVES, or (b) proves only that the
--   table rejects things.
--
-- (c) one ACTIVE entitlement per subject, and lapsed ones do not block
-- (two active rows, same user, same kind, same subject_ref)
-- PASS: duplicate key violates entitlements_one_active_per_subject.
-- (set the first to status='expired', insert the second again)
-- PASS: inserted — the index is PARTIAL. Without this half the index could be
--   table-wide and a student could never re-subscribe after lapsing.
--
-- (d) an off-list source or status is refused
-- (source='paypal') PASS: violates entitlements_source_check.
-- (status='vibes')  PASS: violates entitlements_status_check.
--
-- (e) a backwards window is refused
-- (ends_at before starts_at) PASS: violates entitlements_window_ordered.
--
-- (f) anon is refused OUTRIGHT
-- SET ROLE anon; SELECT count(*) FROM public.entitlements; RESET ROLE;
-- PASS: permission denied for table entitlements.
--   ⚠ A 0 WOULD BE A FAILURE — it would mean a SELECT grant exists and RLS
--   merely filtered, which is a weaker posture than this file intends.
--
-- (g) ⚠ THE ONE THAT MATTERS — A STUDENT CANNOT GRANT THEMSELVES ACCESS
-- (from a real student session)
-- INSERT INTO public.entitlements (user_id,kind,subject_ref,source,note)
--   VALUES (auth.uid(),'course','ial-chemistry-as','admin_grant','mine now');
-- PASS: permission denied for table entitlements — no INSERT grant exists.
-- UPDATE public.entitlements SET ends_at = now() + interval '10 years'
--   WHERE user_id = auth.uid();
-- PASS: permission denied — no UPDATE grant either.
--   ⚠ RUN BOTH. A row in this table IS access; insert and update are two
--   different ways to award it to yourself.
--
-- (h) …and student A cannot see student B's
-- (from A's session, with a row for B present)
-- SELECT count(*) FROM public.entitlements;
-- PASS: only A's rows. ⚠ Seed B's row FIRST and confirm as service_role that
--   it exists — a 0 from an empty table proves nothing.
--
-- (i) the three privileges
-- SELECT
--   has_table_privilege('anon','public.entitlements','TRUNCATE')            AS a_t,
--   has_table_privilege('anon','public.entitlements','TRIGGER')             AS a_g,
--   has_table_privilege('anon','public.entitlements','REFERENCES')          AS a_r,
--   has_table_privilege('authenticated','public.entitlements','TRUNCATE')   AS u_t,
--   has_table_privilege('authenticated','public.entitlements','TRIGGER')    AS u_g,
--   has_table_privilege('authenticated','public.entitlements','REFERENCES') AS u_r,
--   has_table_privilege('authenticated','public.entitlements','INSERT')     AS u_i,
--   has_table_privilege('authenticated','public.entitlements','SELECT')     AS control_true;
-- PASS: f,f,f,f,f,f,f,t
--   ⚠ THE LAST COLUMN IS THE CONTROL. Seven falses prove nothing if the
--   function is answering about a table that does not resolve.
