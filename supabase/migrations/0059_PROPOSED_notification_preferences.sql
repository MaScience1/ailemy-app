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
--
--      ⚠ AND THAT SENTENCE, TAKEN LITERALLY, WRITES THE WRONG QUERY. Selecting
--      FROM this table alone reaches only the people who HAVE a row, and the
--      row is optional — so the students who never opened Settings, who are
--      most of them, would be silently excluded from the cancellation notice
--      this file exists to guarantee. That is the opening paragraph's failure
--      arriving through the fix for it.
--
--      The sender starts from the POPULATION and joins preferences onto it:
--
--        SELECT u.id
--          FROM <the enrolled students> u
--          LEFT JOIN public.notification_preferences p ON p.user_id = u.id
--         WHERE coalesce(p.tuition_email, true);      -- absent row = default
--
--      coalesce carries the DEFAULT, which for every operational category is
--      true. Any sender that cannot express that has not implemented §80.
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
-- ⚠ AMENDED AT PLANNING REVIEW: marketing_opt_in_at IS SERVER-STAMPED.
-- The first draft of this file gave reason #2 above and then granted the
-- column to authenticated anyway — the preamble and §3 contradicted each
-- other, and §3 was the half that would have run. A consent timestamp a user
-- can type is not evidence of anything.
--
-- It is now stamped by a BEFORE INSERT OR UPDATE trigger (§1b) and withheld
-- from both column grants. BEFORE-row triggers fire BEFORE check constraints,
-- so the CHECK below survives as a backstop and every client flow still works:
-- a student turns marketing on by naming only marketing_email, and the row
-- reaches the constraint already stamped.
--
-- The draft's stated objection — "a trigger hides consent capture from the one
-- place anybody looks for it" — was wrong about where people look. The grant
-- list IS that place, and `marketing_opt_in_at` being absent from it is louder
-- than its presence was.
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
  /**
   * When they opted in, so "when did they agree" is answerable (§80, 0040).
   *
   * ⚠ NOT CLIENT-WRITABLE. Stamped by the §1b trigger and absent from both
   * column grants. See the amendment note in the preamble.
   */
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

COMMENT ON COLUMN public.notification_preferences.marketing_opt_in_at IS
  'When marketing consent was given. Server-stamped by stamp_marketing_consent() and withheld from every client grant: a timestamp the consenting party can type is not evidence. NULL exactly when both marketing channels are off.';

COMMIT;

-- ── SECTION 1b: THE CONSENT TRIGGER ─────────────────────────────────────────
BEGIN;

/**
 * ⚠ THE INVARIANT THIS MAINTAINS, STATED ONCE:
 *
 *     marketing_opt_in_at IS NULL   ⟺   both marketing channels are off
 *
 * Both directions matter. Left-to-right is what the CHECK constraint asserts.
 * Right-to-left is what stops a stale timestamp sitting on a row that has
 * opted OUT — where a later reader would find a date and conclude consent
 * exists. The trigger is the only thing that can enforce the second direction,
 * because a CHECK cannot clear a value.
 *
 * ⚠ NOT SECURITY DEFINER, DELIBERATELY. It reads OLD and writes NEW and
 * touches no table, so it needs no privilege the caller lacks. search_path is
 * still pinned — a trigger that resolved `now` through a caller-controlled
 * schema would be stamping whatever that schema wanted.
 */
CREATE OR REPLACE FUNCTION public.stamp_marketing_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  was_on boolean := false;
  is_on  boolean;
BEGIN
  is_on := (NEW.marketing_email IS TRUE) OR (NEW.marketing_in_app IS TRUE);

  IF TG_OP = 'UPDATE' THEN
    was_on := (OLD.marketing_email IS TRUE) OR (OLD.marketing_in_app IS TRUE);
  END IF;

  IF is_on AND NOT was_on THEN
    /**
     * off → on: a new consent, stamped now.
     *
     * ⚠ coalesce, NOT AN UNCONDITIONAL ASSIGNMENT. A client cannot supply this
     * column at all — it is in neither grant — so a non-NULL value arriving
     * here came from service_role, which is the migration path for consent
     * captured in another system. Overwriting it with now() would destroy the
     * real date and replace it with the date of the import.
     */
    NEW.marketing_opt_in_at := coalesce(NEW.marketing_opt_in_at, now());

  ELSIF is_on THEN
    /**
     * on → on: the ORIGINAL moment stands. Turning the second channel on later
     * does not re-date the consent, and nothing a client can send reaches this
     * branch with a different value — the column is ungranted, so NEW simply
     * inherits OLD.
     *
     * The trailing now() is a repair, not a path anything normally takes: if a
     * row somehow arrives on-with-NULL it is stamped rather than left to fail
     * the CHECK with a message about a constraint instead of about consent.
     */
    NEW.marketing_opt_in_at := coalesce(NEW.marketing_opt_in_at, OLD.marketing_opt_in_at, now());

  ELSE
    -- off: there is no opt-in to date. This is the half a CHECK cannot do.
    NEW.marketing_opt_in_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_preferences_stamp_consent
  ON public.notification_preferences;
CREATE TRIGGER notification_preferences_stamp_consent
  BEFORE INSERT OR UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.stamp_marketing_consent();

/**
 * ⚠ updated_at HAD NO TRIGGER AND IS IN NEITHER GRANT, so it would have shown
 * the creation time forever. Reusing 0001's shared touch_updated_at() rather
 * than folding it into the function above: one job each, and the shared one is
 * already attached to ten tables — profiles, subscriptions and progress (0001),
 * site_copy (0010), pages (0011), student_courses (0017), and the four exam
 * tables (0028). This is the eleventh.
 *
 * Two BEFORE-row triggers fire in trigger-NAME order — `notification_…` before
 * `touch_…` — but they write different columns, so the order is incidental.
 */
DROP TRIGGER IF EXISTS touch_notification_preferences
  ON public.notification_preferences;
CREATE TRIGGER touch_notification_preferences
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON FUNCTION public.stamp_marketing_consent() IS
  'Maintains: marketing_opt_in_at IS NULL exactly when both marketing channels are off. Stamps now() on the off-to-on transition, preserves the original moment while consent persists, and clears it on withdrawal.';

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
 * ⚠ THREE COLUMNS ARE WITHHELD, FOR TWO DIFFERENT REASONS.
 *
 *   marketing_opt_in_at   consent evidence. Server-stamped by §1b. A date the
 *                         consenting party can type proves nothing, and this
 *                         file's own preamble says so — the first draft
 *                         granted it anyway, which is why the amendment
 *                         exists. Withholding it is what makes the stamp
 *                         trustworthy; the trigger is only how it gets there.
 *
 *   academic_in_app       operational channels. A student who silences these
 *   tuition_in_app        has no way to learn their lesson moved.
 *
 * ⚠ EACH IS PROTECTED TWICE, AND THE TWO LAYERS FAIL DIFFERENTLY — 42501 from
 * the column grant when a client names one, or 23514 from a CHECK if anything
 * ever reaches the row another way. Verification (b), (c), (d) and (e) separate
 * them, because Postgres words a write-side column-privilege failure as
 * "permission denied for TABLE" and the two are otherwise indistinguishable.
 *
 * ⚠ user_id IS ON THE INSERT GRANT AND DELIBERATELY NOT ON THE UPDATE GRANT —
 * IT IS THE PRIMARY KEY. A row has to name its owner to be created; nothing
 * legitimate then moves it to a different owner, and a PK in an UPDATE grant is
 * a pattern worth not setting even where a policy would catch the abuse.
 *
 * ⚠ WHICH MEANS PostgREST's .upsert() DOES NOT WORK ON THIS TABLE, AND THE
 * FAILURE WILL NOT LOOK LIKE THIS COMMENT. An upsert compiles to
 * `INSERT … ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id, …`
 * — the generated SET list includes every column in the payload, so it needs
 * UPDATE(user_id), which is not granted. The client gets
 * "permission denied for table notification_preferences" and every obvious
 * reading of that message is wrong: the table grant is fine, the row policy is
 * fine, and the column the caller cares about is granted.
 *
 * THE WRITE PATH IS UPDATE-THEN-INSERT: update the row; if it touched 0 rows,
 * insert one. Two statements, no wider grant, and the 0-row case is exactly the
 * "no row means defaults" state the preamble describes. Verification (a2).
 */
GRANT INSERT (user_id, academic_email, tuition_email,
              announcements_email, announcements_in_app,
              marketing_email, marketing_in_app)
  ON public.notification_preferences TO authenticated;

GRANT UPDATE (academic_email, tuition_email,
              announcements_email, announcements_in_app,
              marketing_email, marketing_in_app)
  ON public.notification_preferences TO authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.notification_preferences FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- ⚠ AMENDED, AND THE BLOCK LETTERS MOVED. New or rewritten: (a2) the client
-- write path, (b) the CHECK is now reachable only by sabotage, (e) the consent
-- column cannot be named, (f)/(f2) the server stamp and the preserved original
-- moment, (g) withdrawal clears it, (h2) an INSERT control to match (e)'s
-- INSERT half, (h3) the new touch trigger. (l)'s expected lists are in
-- ORDER BY column_name order so a literal comparison cannot false-fail on
-- ordering alone.
--
-- ⚠ FOUR OF THESE CAME OUT OF AN ADVERSARIAL REVIEW THAT FORMALLY CONFIRMED
-- NOTHING. Nine findings were raised against this file and all nine were
-- refuted on their own terms — but (a2), (b)'s separate-statement warning,
-- block (h2), and the sender-query caution in the preamble are all real gains
-- that only existed because somebody argued for them. A review is not a gate
-- that returns a verdict; it is a source of things to check.
--
-- (a) defaults are what an absent row means
-- INSERT (user_id) VALUES (<u>); SELECT * FROM notification_preferences WHERE user_id=<u>;
-- PASS: academic/tuition/announcements all TRUE, marketing both FALSE,
--   marketing_opt_in_at NULL.
--   ⚠ IF MARKETING DEFAULTED TRUE this file has silently opted a minor into
--   promotions. Check it explicitly rather than trusting the DEFAULT clause.
--   ⚠ AND THE NULL TIMESTAMP IS HALF OF §1b'S INVARIANT: marketing off means
--   no opt-in date, not a date nobody looks at.
--
-- (a2) ⚠ THE CLIENT'S WRITE PATH IS UPDATE-THEN-INSERT, AND .upsert() IS NOT IT
-- (from a real student session, on an account with NO preferences row)
-- UPDATE public.notification_preferences SET announcements_email = false
--  WHERE user_id = auth.uid();
-- PASS: 0 rows — nothing to update yet, which is the "defaults" state.
-- INSERT INTO public.notification_preferences (user_id, announcements_email)
--   VALUES (auth.uid(), false);
-- PASS: 1 row.
-- UPDATE public.notification_preferences SET announcements_email = true
--  WHERE user_id = auth.uid();
-- PASS: 1 row — the same statement now finds it.
--   ⚠ AND THE UPSERT THAT A CLIENT LIBRARY WOULD REACH FOR FIRST:
--   supabase.from('notification_preferences').upsert({user_id, announcements_email})
--   PASS: 42501, permission denied for table notification_preferences.
--   THIS IS EXPECTED AND IS NOT A BROKEN GRANT. PostgREST compiles an upsert to
--   ON CONFLICT DO UPDATE SET user_id = EXCLUDED.user_id, …, which needs
--   UPDATE(user_id) — withheld because user_id is the primary key. Run this
--   block so the message is on the record BEFORE somebody meets it in a server
--   action and starts widening grants to make it go away.
--
-- (b) ⚠ THE MARKETING CHECK IS NOW A BACKSTOP THE TRIGGER MAKES UNREACHABLE,
--     SO IT MUST BE PROVEN BY SABOTAGE OR NOT AT ALL.
-- Before the amendment this block turned marketing on without a timestamp and
-- watched 23514. That path no longer exists: the BEFORE trigger stamps the row
-- before the constraint is evaluated, from every role, so the constraint can
-- no longer be reached by any ordinary statement. A guard that cannot be made
-- to fire has not been shown to work.
--
-- ⚠ RUN THESE AS FOUR SEPARATE STATEMENTS, NOT AS ONE PASTE. Statement 2 is
-- MEANT to fail, and a multi-statement submission runs in one implicit
-- transaction: the 23514 would abort it, discard statements 3 and 4, and roll
-- the DISABLE back. That outcome is SAFE — the trigger ends up enabled — but it
-- proves nothing, and it looks identical to the constraint working.
--
-- (as the table owner, and NOT while anything is writing this table)
--   1.  ALTER TABLE public.notification_preferences
--         DISABLE TRIGGER notification_preferences_stamp_consent;
--       PASS: ALTER TABLE.
--   2.  UPDATE public.notification_preferences
--          SET marketing_email = true, marketing_opt_in_at = NULL WHERE user_id=<u>;
--       PASS: violates notification_preferences_marketing_needs_timestamp.
--   3.  ALTER TABLE public.notification_preferences
--         ENABLE TRIGGER notification_preferences_stamp_consent;
--       PASS: ALTER TABLE.
--   4.  SELECT tgname, tgenabled FROM pg_trigger
--        WHERE tgrelid = 'public.notification_preferences'::regclass
--          AND NOT tgisinternal ORDER BY tgname;
--       PASS: two rows — notification_preferences_stamp_consent and
--       touch_notification_preferences — BOTH with tgenabled = 'O'.
--   ⚠ SCOPED BY tgrelid, NOT BY NAME ALONE. pg_trigger is unique on
--   (tgrelid, tgname), so a name-only lookup is asking a question with more
--   than one possible subject. Listing BOTH triggers also makes step 3's
--   omission impossible to miss.
--   ⚠ STEP 3 IS NOT OPTIONAL AND STEP 4 IS HOW YOU KNOW IT RAN. A trigger left
--   disabled is worse than never having tested: consent stops being stamped and
--   the CHECK then refuses every opt-in this file was amended to permit.
--
-- (c) ⚠ THE OPERATIONAL IN-APP CHANNEL CANNOT BE SILENCED
-- (as service_role, bypassing the column grant to test the CONSTRAINT)
-- UPDATE … SET tuition_in_app = false WHERE user_id=<u>;
-- PASS: violates notification_preferences_operational_in_app_stays_on.
--   This is the check that stops a student losing a cancellation notice, and
--   unlike (b) it is reachable — no trigger repairs it.
--
-- (d) …and a student cannot even NAME those columns
-- (from a real student session)
-- UPDATE public.notification_preferences SET tuition_in_app = false
--  WHERE user_id = auth.uid();
-- PASS: 42501, permission denied — THE COLUMN GRANT, not the constraint.
--   ⚠ NOTE WHICH LAYER ANSWERED. Postgres words a write-side column-privilege
--   failure as "permission denied for TABLE"; the proof it is the column grant
--   and not a missing table grant is the CONTROL in (h).
--
-- (e) ⚠ NOR CAN THEY NAME THE CONSENT TIMESTAMP
-- (from a real student session)
-- UPDATE public.notification_preferences
--    SET marketing_email = true, marketing_opt_in_at = '2020-01-01T00:00:00Z'
--  WHERE user_id = auth.uid();
-- PASS: 42501, permission denied for table notification_preferences.
-- INSERT INTO public.notification_preferences (user_id, marketing_email, marketing_opt_in_at)
--   VALUES (auth.uid(), true, '2020-01-01T00:00:00Z');
-- PASS: 42501 — withheld from the INSERT grant as well as the UPDATE grant.
--   ⚠ BOTH STATEMENTS. Removing the column from one grant and not the other is
--   exactly the kind of half-fix this amendment exists to correct, and an
--   UPDATE-only test would not see it.
--
-- (f) ⚠ …AND TURNING MARKETING ON STILL WORKS, WITH A SERVER STAMP
-- (from a real student session, naming ONLY granted columns)
-- UPDATE public.notification_preferences SET marketing_email = true
--  WHERE user_id = auth.uid();
-- PASS: 1 row.
-- SELECT marketing_email, marketing_opt_in_at,
--        marketing_opt_in_at BETWEEN now() - interval '1 minute' AND now() AS stamped_now
--   FROM public.notification_preferences WHERE user_id = <u>;
-- PASS: true, a timestamp, stamped_now = true.
--   ⚠ THIS IS THE HALF THAT PROVES THE AMENDMENT DID NOT BREAK THE PRODUCT.
--   (e) alone is consistent with a settings page that can no longer opt in at
--   all, which would be a worse failure than the one being fixed.
--
-- (f2) the original moment survives the second channel
-- UPDATE … SET marketing_in_app = true WHERE user_id = auth.uid();
-- PASS: 1 row, and marketing_opt_in_at is UNCHANGED from (f).
--   ⚠ CAPTURE THE VALUE IN (f) AND COMPARE. Re-dating consent every time a
--   toggle moves would make the column a record of the last click.
--
-- (g) ⚠ WITHDRAWAL CLEARS IT — the direction a CHECK cannot enforce
-- UPDATE … SET marketing_email = false, marketing_in_app = false
--  WHERE user_id = auth.uid();
-- PASS: 1 row, and marketing_opt_in_at IS NULL.
--   ⚠ A SURVIVING TIMESTAMP HERE IS THE REAL DEFECT THIS TRIGGER PREVENTS: a
--   row that says "opted out" while carrying a date a later reader would take
--   as consent. Then re-enable marketing and confirm a NEW, LATER stamp — a
--   second opt-in is a second consent, not a resumption of the first.
--
-- (h) the control: the SAME session updating a GRANTED column succeeds
-- UPDATE public.notification_preferences SET announcements_email = false
--  WHERE user_id = auth.uid();
-- PASS: 1 row. A missing UPDATE grant is now ruled out, so (d) and (e)'s UPDATE
--   half were the column grant and nothing else.
--
-- (h2) ⚠ AND AN INSERT CONTROL, BECAUSE (e) HAS AN INSERT HALF
-- The (e) block's second statement is an INSERT naming marketing_opt_in_at,
-- while the control just above is an UPDATE — and an UPDATE control cannot
-- acquit an INSERT refusal. Without this, a missing INSERT grant would make
-- that half of (e) return 42501 for the wrong reason and pass vacuously, while
-- a student's Settings page could not create its own row at all.
-- (from a real student session, on an account with no row)
-- INSERT INTO public.notification_preferences (user_id, marketing_email)
--   VALUES (auth.uid(), true);
-- PASS: 1 row, and marketing_opt_in_at is stamped — so the INSERT grant covers
--   the granted columns and (e)'s INSERT half refused for the column, not the
--   table.
--
-- (h3) …and updated_at moved without the client naming it
-- PASS: updated_at is later than it was before (h) — touch_notification_preferences
--   is attached and firing. ⚠ Before this amendment there was no such trigger
--   and updated_at was in no grant, so it would have shown creation time forever.
--
-- (i) student A cannot read or write B's preferences
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
-- (j) anon is refused OUTRIGHT
-- SET ROLE anon; SELECT count(*) FROM public.notification_preferences; RESET ROLE;
-- PASS: permission denied. ⚠ A 0 would be a failure.
--
-- (k) privileges, with a control
-- SELECT
--   has_table_privilege('anon','public.notification_preferences','TRUNCATE')  AS a_t,
--   has_table_privilege('anon','public.notification_preferences','TRIGGER')   AS a_g,
--   has_table_privilege('anon','public.notification_preferences','REFERENCES')AS a_r,
--   has_table_privilege('authenticated','public.notification_preferences','TRUNCATE') AS u_t,
--   has_table_privilege('authenticated','public.notification_preferences','DELETE')   AS u_d,
--   has_table_privilege('authenticated','public.notification_preferences','SELECT')   AS control_true;
-- PASS: f,f,f,f,f,t
--
-- (l) the settable columns are exactly what §3 granted
-- SELECT privilege_type, column_name FROM information_schema.column_privileges
--  WHERE table_schema='public' AND table_name='notification_preferences'
--    AND grantee='authenticated' AND privilege_type IN ('INSERT','UPDATE')
--  ORDER BY privilege_type, column_name;
-- PASS, INSERT exactly — in this order, which is the query's own order:
--   academic_email, announcements_email, announcements_in_app,
--   marketing_email, marketing_in_app, tuition_email, user_id
-- PASS, UPDATE exactly — the same list WITHOUT user_id:
--   academic_email, announcements_email, announcements_in_app,
--   marketing_email, marketing_in_app, tuition_email
--   ⚠ THREE NAMES MUST BE ABSENT FROM BOTH: academic_in_app and tuition_in_app
--   (a student could silence the channel that tells them a lesson moved) and
--   marketing_opt_in_at (a student could date their own consent). Any one of
--   them appearing is a STOP.
