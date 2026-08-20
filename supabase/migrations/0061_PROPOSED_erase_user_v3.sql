-- ============================================================================
-- 0061_PROPOSED_erase_user_v3.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. Number from the planning chat.
--
-- ⚠ APPLY THIS LAST, AND DO NOT APPLY 0060 WITHOUT IT.
-- ============================================================================
-- 0055's generic sweep counts every text column in `public` named email or
-- %_email against the address being erased, and RAISES if the address is still
-- anywhere. 0060 adds billing_profiles.billing_email.
--
-- So the moment 0060 lands, erasing anyone who has ever been a payer FAILS —
-- loudly, atomically, with a message naming the table. That is the safety net
-- working exactly as designed, and it is also an outage in the one operation
-- that must never be unavailable. This file closes the gap in the same set.
--
-- ⚠ THIS IS THE THIRD TIME. 0047 created tables and left erase_user behind;
-- 0048 and 0049 repaired it; 0055 extended it for 0051-0054. Writing the
-- erasure extension in the SAME set as the tables is the standing correction,
-- not a courtesy.
--
-- WHAT CHANGES FROM v2 — nothing is removed, five things are added:
--
--   entitlements                — DELETE, counted (0058)
--   notification_preferences    — DELETE, counted (0059)
--   billing_profile_students    — DELETE, counted (0060)
--   billing_profiles            — SCRUBBED, tombstoned, counted (0060)
--   payments                    — NOT deleted; counted, then SET NULL (0060)
--
-- ...plus two obligations in the receipt, in the shape 0055 established with
-- storage_purge_required: `stripe_erasure_required` (Customer objects this
-- transaction cannot reach) and `payer_erasure_side_effects` (other people's
-- live seats now behind a tombstoned payer).
--
-- ⚠ THE THREE PRE-CHECKS FROM v2 ARE UNTOUCHED — teacher, marker, submission
-- files. This file was DERIVED from 0055's function text rather than retyped,
-- so v2's body is present verbatim; the additions are the blocks marked v3.
--
-- ⚠ NO NEW TABLE, SO NO REVOKE SECTION. Nothing here creates a relation.
-- ============================================================================

-- ── SECTION 1: THE FUNCTION ─────────────────────────────────────────────────
BEGIN;

CREATE OR REPLACE FUNCTION public.erase_user(target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  target_email      text;
  ledger_removed    integer := 0;
  holds_removed     integer := 0;
  cancels_removed   integer := 0;
  deliveries_removed integer := 0;
  events_removed    integer := 0;
  tokens_removed    integer := 0;
  interest_removed  integer := 0;
  waitlist_removed  integer := 0;
  bookings_scrubbed integer := 0;
  enrolments_scrubbed integer := 0;
  bookings_left     integer := 0;
  feedback_left     integer := 0;
  submission_files  integer := 0;
  cols_scanned      integer := 0;
  leftover          bigint;
  residue           text[] := ARRAY[]::text[];
  rec               record;
  -- v3 (0061) — the tables 0058-0060 add.
  entitlements_removed integer := 0;
  prefs_removed        integer := 0;
  billing_links_removed integer := 0;
  billing_scrubbed     integer := 0;
  payments_unlinked    integer := 0;
  stripe_customers     text[] := ARRAY[]::text[];
  payerless_students   uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT u.email INTO target_email FROM auth.users u WHERE u.id = target;
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'erase_user: no such user %', target
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ⚠ SET LOCAL, NOT SET. It dies with this transaction, so the escape cannot
  -- leak onto the next statement that reuses this pooled backend. 0048's
  -- verification (f) is the assertion that this matters, and it is re-run here.
  PERFORM set_config('app.ledger_purge', 'on', true);

  /**
   * ⚠ THE TEACHER CHECK COMES FIRST, BEFORE ANY WRITE. 0049 did this last,
   * which was harmless only because the transaction rolls back. Doing it first
   * means the refusal costs nothing and the reason is the first thing raised.
   */
  SELECT count(*) INTO bookings_left
    FROM public.private_bookings WHERE teacher_id = target;
  IF bookings_left > 0 THEN
    RAISE EXCEPTION
      'erase_user: % is the teacher on % booking(s). Reassign or delete those first — a teacher''s lesson records are not erased by a student erasure.',
      target_email, bookings_left
      USING ERRCODE = 'restrict_violation';
  END IF;

  /**
   * ⚠ THE MARKER CHECK, FOR THE ONE FK IN THE SCHEMA WITH NO ON DELETE CLAUSE.
   * 0009 line 129: `marker_id uuid not null references auth.users(id)` — NO
   * ACTION. Without this, erasing a marker reaches `DELETE FROM auth.users` and
   * dies with a bare 23503 naming a constraint, after every scrub above has
   * run. The rollback keeps it atomic; the message tells nobody anything.
   *
   * Refused rather than cascaded on purpose: a marker's marking is the
   * STUDENT's feedback — their marks and a comment about their work. Deleting
   * another person's record to erase this one is the wrong trade, exactly as it
   * is for a teacher's delivered lessons.
   */
  SELECT count(*) INTO feedback_left
    FROM public.submission_feedback WHERE marker_id = target;
  IF feedback_left > 0 THEN
    RAISE EXCEPTION
      'erase_user: % has marked % submission(s). Reassign marker_id on those rows first — a marker''s marking is the student''s feedback, and submission_feedback.marker_id has no ON DELETE clause (0009), so the erasure would fail with a bare 23503 at the last statement.',
      target_email, feedback_left
      USING ERRCODE = 'restrict_violation';
  END IF;

  /**
   * ⚠ COUNTED BEFORE THE CASCADE, BECAUSE AFTERWARDS THERE IS NOTHING TO COUNT.
   * submissions.user_id is ON DELETE CASCADE, so these rows — and the only
   * record of where the files live — vanish at the final statement. The count
   * and the prefix go into the receipt so the caller can purge the bucket
   * through the Storage API, which is the only thing that deletes the binary.
   */
  SELECT count(*) INTO submission_files
    FROM public.submissions
   WHERE user_id = target AND storage_path IS NOT NULL;

  -- ── the person's own rows ────────────────────────────────────────────────

  DELETE FROM public.lesson_credit_transactions WHERE user_id = target;
  GET DIAGNOSTICS ledger_removed = ROW_COUNT;

  DELETE FROM public.booking_holds
   WHERE user_id = target
      OR teacher_id = target
      OR lower(email) = lower(target_email);
  GET DIAGNOSTICS holds_removed = ROW_COUNT;

  /**
   * ⚠ CANCELLATION REQUESTS ARE DELETED, NOT LEFT TO ON DELETE SET NULL.
   * The FK nulls user_id and leaves requested_by_email — NOT NULL and durable
   * by design — plus `reason` and `student_note`, which are sentences a family
   * wrote about why they could not attend. That is the most sensitive free text
   * in the schema and the FK does not touch a character of it.
   *
   * Deleting loses the admin's record of a refund decision. That is the correct
   * trade: the money movement is provable from Stripe and from the ledger's own
   * compensating rows, and neither of those names the person once this runs.
   */
  DELETE FROM public.cancellation_requests
   WHERE user_id = target
      OR lower(requested_by_email) = lower(target_email);
  GET DIAGNOSTICS cancels_removed = ROW_COUNT;

  /**
   * ⚠ NOTIFICATIONS: THE CASCADE IS NOT ENOUGH, AND THIS IS THE SUBTLE ONE.
   * notification_events allows user_id NULL when email is set — deliberately,
   * because a parent can book without an account and still needs the
   * confirmation. Those rows have no FK to cascade from, so an email-addressed
   * event outlives the account holder forever. Matching on BOTH is the fix.
   *
   * Deliveries are deleted explicitly rather than by cascade so the count is
   * reportable, which is 0049's own stated reason for doing the ledger by hand.
   */
  DELETE FROM public.notification_deliveries d
   WHERE EXISTS (
     SELECT 1 FROM public.notification_events e
      WHERE e.id = d.event_id
        AND (e.user_id = target OR lower(e.email) = lower(target_email))
   );
  GET DIAGNOSTICS deliveries_removed = ROW_COUNT;

  DELETE FROM public.notification_events
   WHERE user_id = target OR lower(email) = lower(target_email);
  GET DIAGNOSTICS events_removed = ROW_COUNT;

  /**
   * ⚠ A DELETED TOKEN ROW IS STILL REGISTERED WITH APNs/FCM. Removing the row
   * is the database's whole job here; telling the provider to forget the device
   * is the application's, and the count below is what tells an operator how
   * many deregistrations are owed. Reporting it is the only way that fact
   * leaves this transaction.
   */
  DELETE FROM public.push_tokens WHERE user_id = target;
  GET DIAGNOSTICS tokens_removed = ROW_COUNT;

  -- ⚠ NO FK AT ALL ON EITHER OF THESE. interest_registrations (0040) and
  -- waitlist (0001) are keyed by email and nothing else, so no erasure has ever
  -- reached them. 0040's own header calls the table PII in capital letters.
  DELETE FROM public.interest_registrations WHERE lower(email) = lower(target_email);
  GET DIAGNOSTICS interest_removed = ROW_COUNT;

  DELETE FROM public.waitlist WHERE lower(email) = lower(target_email);
  GET DIAGNOSTICS waitlist_removed = ROW_COUNT;

  -- ── somebody else's record of a real event ───────────────────────────────

  /**
   * ⚠ THIS MUST RUN BEFORE `DELETE FROM auth.users`. The WHERE matches
   * user_id = target, and the FK's ON DELETE SET NULL fires at the delete —
   * after which nothing connects the row to the person and the email would stay
   * forever. Order is load-bearing, not stylistic.
   *
   * The email match is the second half: a booking made before the account
   * existed has user_id NULL and the address in the column.
   */
  UPDATE public.private_bookings
     SET email = 'erased-' || id::text || '@ailemy.invalid',
         notes = NULL
   WHERE user_id = target
      OR lower(email) = lower(target_email);
  GET DIAGNOSTICS bookings_scrubbed = ROW_COUNT;

  -- ⚠ THE ENROLMENT IS A PAYMENT RECORD. amount_pence and stripe_ref stay so
  -- "a seat was sold at £169 on this date" remains provable; the name, the
  -- address and the WhatsApp number do not need to be there for that to be true.
  UPDATE public.cohort_enrolments
     SET email = 'erased-' || id::text || '@ailemy.invalid',
         parent_name = NULL,
         parent_contact = NULL
   WHERE user_id = target
      OR lower(email) = lower(target_email);
  GET DIAGNOSTICS enrolments_scrubbed = ROW_COUNT;

  -- ── v3: entitlements, preferences, billing (0058-0060) ──────────────────
  /**
   * ⚠ COUNTED AND DELETED EXPLICITLY THOUGH THE FK WOULD CASCADE. Both tables
   * are ON DELETE CASCADE on auth.users, so `DELETE FROM auth.users` alone
   * would clear them — silently, with no number in the receipt. 0055's whole
   * design is that a forgotten table is LOUD; a cascade is the quiet kind, and
   * a later ALTER that changes the FK would remove the coverage with nothing
   * to notice it. Explicit, counted, and the receipt says how many.
   */
  DELETE FROM public.entitlements WHERE user_id = target;
  GET DIAGNOSTICS entitlements_removed = ROW_COUNT;

  DELETE FROM public.notification_preferences WHERE user_id = target;
  GET DIAGNOSTICS prefs_removed = ROW_COUNT;

  DELETE FROM public.billing_profile_students WHERE student_id = target;
  GET DIAGNOSTICS billing_links_removed = ROW_COUNT;

  /**
   * ⚠ PAYMENTS ARE NOT DELETED, AND THAT IS DELIBERATE. A payment is a
   * financial record with a retention obligation that outlives an erasure
   * request, and it is the same call 0055 already made for
   * cohort_enrolments.amount_pence and .stripe_ref — "a payment stays
   * provable". payments.student_id is ON DELETE SET NULL, so the row survives
   * and loses its link to the person at the final statement.
   *
   * ⚠ COUNTED HERE BECAUSE AFTERWARDS IT IS UNFINDABLE. Once student_id is
   * NULL nothing connects the row to the erased person — which is the point,
   * and also why the number has to be taken now.
   */
  SELECT count(*) INTO payments_unlinked
    FROM public.payments WHERE student_id = target;

  /**
   * ⚠ AND THE STRIPE CUSTOMER IDS LEAVE AS AN OBLIGATION, NOT A RESULT. The
   * Customer object at Stripe holds this person's name, email and card
   * metadata; this database cannot delete it, and dropping the id here would
   * only make the remaining copy unfindable. Same shape as
   * storage_purge_required: the receipt names what the caller must still do.
   */
  SELECT coalesce(array_agg(b.stripe_customer_id), ARRAY[]::text[])
    INTO stripe_customers
    FROM public.billing_profiles b
   WHERE b.owner_user_id = target AND b.stripe_customer_id IS NOT NULL;

  /**
   * ⚠ WHO ELSE THIS ERASURE AFFECTS. A parent being erased may be paying for a
   * child who is not. Their entitlements and payments survive untouched — this
   * refuses nothing — but somebody has to know the payer behind a live seat is
   * now a tombstone. Named in the receipt rather than discovered at renewal.
   */
  SELECT coalesce(array_agg(DISTINCT bps.student_id), ARRAY[]::uuid[])
    INTO payerless_students
    FROM public.billing_profile_students bps
    JOIN public.billing_profiles b ON b.id = bps.billing_profile_id
    JOIN public.entitlements e ON e.user_id = bps.student_id AND e.status = 'active'
   WHERE b.owner_user_id = target AND bps.student_id <> target;

  /**
   * ⚠ SCRUBBED, NOT DELETED, AND IT MUST RUN BEFORE `DELETE FROM auth.users`.
   * owner_user_id is ON DELETE SET NULL, so after the final statement this WHERE
   * matches nothing and billing_email keeps the address forever — the generic
   * sweep below would then refuse the whole erasure, correctly but uselessly.
   * Same ordering hazard, same reason, as private_bookings above.
   *
   * The row survives because payments reference it and because it may pay for
   * somebody who has not asked to be erased. What leaves is the person.
   */
  UPDATE public.billing_profiles
     SET billing_name    = 'Erased user',
         billing_email   = 'erased-' || target::text || '@ailemy.invalid',
         billing_country = NULL,
         updated_at      = now()
   WHERE owner_user_id = target;
  GET DIAGNOSTICS billing_scrubbed = ROW_COUNT;

  -- ── the person ───────────────────────────────────────────────────────────
  DELETE FROM auth.users WHERE id = target;

  /**
   * ⚠ THE SELF-CHECK. Every text column in `public` named email or %_email is
   * counted against the target address. This is what makes the next forgotten
   * table loud instead of silent.
   *
   * Identifiers come from the catalogue and go through %I, so there is nothing
   * for a table name to inject. The scan is a seq scan per column; at this
   * schema's size that is microseconds, and an erasure is a rare operation, so
   * no index is added for it.
   */
  FOR rec IN
    SELECT col.table_name AS tbl, col.column_name AS colname
      FROM information_schema.columns col
      JOIN information_schema.tables tbl
        ON tbl.table_schema = col.table_schema AND tbl.table_name = col.table_name
     WHERE col.table_schema = 'public'
       AND tbl.table_type = 'BASE TABLE'
       AND col.data_type IN ('text', 'character varying')
       AND (col.column_name = 'email' OR col.column_name LIKE '%\_email')
     ORDER BY col.table_name, col.column_name
  LOOP
    cols_scanned := cols_scanned + 1;
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE lower(%I) = lower($1)', rec.tbl, rec.colname
    ) INTO leftover USING target_email;
    IF leftover > 0 THEN
      residue := residue || format('%s.%s (%s row(s))', rec.tbl, rec.colname, leftover);
    END IF;
  END LOOP;

  IF array_length(residue, 1) > 0 THEN
    RAISE EXCEPTION
      'erase_user: the address still appears in % — %. NOTHING WAS ERASED; this transaction rolled back. Extend erase_user() to cover that table, then run again.',
      array_length(residue, 1), array_to_string(residue, ', ')
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN jsonb_build_object(
    'erased', target,
    'email', target_email,
    'ledger_rows_removed', ledger_removed,
    'holds_removed', holds_removed,
    'cancellation_requests_removed', cancels_removed,
    'notification_deliveries_removed', deliveries_removed,
    'notification_events_removed', events_removed,
    'push_tokens_removed', tokens_removed,
    'interest_registrations_removed', interest_removed,
    'waitlist_removed', waitlist_removed,
    'bookings_scrubbed', bookings_scrubbed,
    'enrolments_scrubbed', enrolments_scrubbed,
    'entitlements_removed', entitlements_removed,
    'notification_preferences_removed', prefs_removed,
    'billing_links_removed', billing_links_removed,
    'billing_profiles_scrubbed', billing_scrubbed,
    'payments_unlinked', payments_unlinked,
    'email_columns_scanned', cols_scanned,
    /**
     * ⚠ AN OBLIGATION, NOT A RESULT. Nothing in this transaction deleted a
     * file. The caller must purge this prefix through the Storage API; a
     * DELETE on storage.objects would strand the binary and lose its path.
     */
    /**
     * ⚠ THE SECOND OBLIGATION. Deleting the Customer at Stripe is an API call
     * this transaction cannot make, and an empty array is a real answer — it
     * means there was no Stripe customer, not that the step was skipped.
     */
    'stripe_erasure_required', to_jsonb(stripe_customers),
    /** Students whose live seat is now paid for by a tombstoned profile. */
    'payer_erasure_side_effects', to_jsonb(payerless_students),
    'storage_purge_required', jsonb_build_object(
      'bucket', 'submissions',
      'prefix', target::text || '/',
      'rows_referencing_files', submission_files
    )
  );
END;
$$;
COMMENT ON FUNCTION public.erase_user(uuid) IS
  'v3 (0061). Delete a person completely: their own rows deleted, third-party and financial records scrubbed of personal columns, a generic email sweep that refuses to report success while the address still appears anywhere in public, and two obligations returned for the systems this transaction cannot reach — Storage and Stripe. service_role only.';

COMMIT;

-- ── SECTION 2: GRANTS ───────────────────────────────────────────────────────
-- ⚠ RESTATED, NOT ASSUMED. CREATE OR REPLACE FUNCTION preserves privileges, so
-- these should already be right — but a function that anon can execute deletes
-- people, and "should already be right" is not a thing to leave unverified on
-- that particular statement. Idempotent.
REVOKE ALL ON FUNCTION public.erase_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_user(uuid) TO service_role;

-- No NOTIFY: nothing in this file changes the REST schema.

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- ⚠ THE WHOLE OF 0055'S VERIFICATION IS STILL IN FORCE AND MUST BE RE-RUN.
-- This replaces the function body; every guarantee v2 was proven to hold is
-- unproven again until it is watched. Re-run 0055 (a)-(g) INCLUDING both
-- halves of the sabotage test. What follows is only what is NEW.
--
-- ⚠ AND THE FIXTURE MUST BE NON-EMPTY BEFORE ANY OF IT IS BELIEVED. Give probe
-- A: an entitlement, a notification_preferences row, a billing profile they own
-- (with a stripe_customer_id), a billing_profile_students link, and a payment.
-- Confirm all five exist as service_role and print the counts. A receipt of
-- zeroes against an empty fixture is the exact false pass 0055(e) already
-- produced once on this project.
--
-- (a) ⚠ WITHOUT THIS FILE, 0060 BREAKS ERASURE — WATCH IT BREAK FIRST.
-- Apply 0060, do NOT apply this, give a probe a billing profile, call
-- erase_user on them.
-- PASS: 23001 (restrict_violation) naming billing_profiles.billing_email,
--   "NOTHING WAS ERASED".
--   ⚠ THIS IS THE POINT OF THE FILE AND THE ONLY EVIDENCE THAT THE SWEEP
--   ACTUALLY COVERS THE NEW TABLE. Skipping it leaves the coverage assumed.
--   Then apply this file and re-run: PASS, a receipt.
--
-- (b) the five new receipt counts match the pre-counts EXACTLY
-- entitlements_removed · notification_preferences_removed ·
-- billing_links_removed · billing_profiles_scrubbed · payments_unlinked
-- PASS: each equals the number counted before the call.
--   ⚠ payments_unlinked IS NOT A DELETION. Check it against a surviving row —
--   see (d).
--
-- (c) the billing profile SURVIVED, tombstoned
-- (as service_role) SELECT billing_name, billing_email, billing_country,
--        stripe_customer_id, owner_user_id FROM public.billing_profiles
--  WHERE id = <the captured id>;
-- PASS: one row. billing_name='Erased user',
--   billing_email='erased-<uid>@ailemy.invalid', billing_country IS NULL,
--   owner_user_id IS NULL — and stripe_customer_id UNCHANGED.
--   ⚠ THE UNCHANGED CUSTOMER ID IS DELIBERATE, NOT A MISS. It is the pointer
--   the operator needs to delete the Customer at Stripe; see (e).
--
-- (d) ⚠ THE PAYMENT SURVIVED AND LOST ITS PERSON
-- (as service_role) SELECT student_id, amount_minor, currency, status
--   FROM public.payments WHERE id = <the captured id>;
-- PASS: one row, student_id IS NULL, amount/currency/status unchanged.
--   ⚠ A ZERO-ROW RESULT IS A FAILURE, not a cleaner erasure — a deleted
--   financial record is a retention breach in the other direction.
--
-- (e) both obligations are present and populated
-- PASS: stripe_erasure_required is a JSON array containing the probe's
--   customer id — not [], because the fixture gave them one.
--   ⚠ AN EMPTY ARRAY HERE WITH A CUSTOMER ID IN THE FIXTURE MEANS THE
--   COLLECTION RAN AFTER THE SCRUB. Order matters; that is why it is above it.
-- PASS: payer_erasure_side_effects is present. With the fixture as described
--   (A pays only for themselves) it is []. To see it populated, link a SECOND
--   probe student B to A's billing profile and give B an ACTIVE entitlement:
--   PASS: the array contains B's uid.
--   ⚠ RUN BOTH HALVES. An always-empty array is indistinguishable from a
--   correct one until something makes it non-empty.
--
-- (f) the sweep is satisfied — independently, not by its own report
-- (as service_role, AFTER the erasure)
-- SELECT count(*) FROM public.billing_profiles WHERE lower(billing_email) = lower('<A''s address>');
-- PASS: 0. Repeat for every email column the sweep scans; the receipt's
--   email_columns_scanned says how many there now are.
--   ⚠ CHECK THAT NUMBER WENT UP BY ONE against a v2 receipt. billing_email is
--   the new column; if the count did not move, the sweep is not seeing it.
--
-- (g) privileges on the function, with a control
-- SELECT
--   has_function_privilege('anon','public.erase_user(uuid)','EXECUTE')          AS a_x,
--   has_function_privilege('authenticated','public.erase_user(uuid)','EXECUTE') AS u_x,
--   has_function_privilege('service_role','public.erase_user(uuid)','EXECUTE')  AS control_true;
-- PASS: f, f, t.
