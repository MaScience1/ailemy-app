-- ============================================================================
-- 0066_PROPOSED_erase_user_v4.sql
-- ----------------------------------------------------------------------------
-- ⚠ NUMBER ISSUED BY PLANNING (2026-08-22 sitting). _PROPOSED_ until applied —
-- rename and record observed verification results in this header in the SAME
-- step as applying. Requires 0064 AND 0065 applied first: the function body
-- names their tables, and CREATE OR REPLACE would otherwise fail at runtime on
-- the first call, not at definition time.
--
-- ⚠ DERIVED FROM 0061'S TEXT, NOT RETYPED. The v3 body was extracted from
-- 0061_erase_user_v3.sql and FIVE surgical edits applied (the repo rule: a
-- thing standing in for another must be re-derived from the source):
--   1. DECLARE gains three v4 counters
--   2. set_config('app.erasure_active','on',true) lands beside the existing
--      app.ledger_purge door (planning amendment 1 — the 0047/0048 pattern,
--      NOT session_replication_role)
--   3. three counted deletes: answers (via the attempt join), attempts,
--      view_state — explicit and counted though the FKs would cascade
--   4. the receipt gains the three matching fields
--   5. the COMMENT moves to v4
-- Everything else is v3's text byte-for-byte, including the teacher/marker/
-- payer refusals, the scrubs, and the email sweep.
--
-- ⚠ GATE: email_columns_scanned MUST STILL BE 8. v4 adds no email-shaped
-- column anywhere, so a receipt reporting anything but 8 means the schema
-- grew an email column this function does not know about — stop and extend
-- the function, exactly as the sweep's own refusal would demand.
--
-- ⚠ THE WHOLE OF 0055'S VERIFICATION (a)-(g) IS RE-RUN AFTER APPLY — planning
-- gate. CREATE OR REPLACE replaces the body; every guarantee v2/v3 was proven
-- to hold is unproven again until watched. The founder pastes below cover only
-- what is NEW in v4.
-- ============================================================================

-- ══ FOUNDER PASTE 1 — the function (one paste, one transaction) ═════════════
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
  foreign_profiles     text[] := ARRAY[]::text[];
  -- v4 (0066) — the lesson-player tables 0064-0065 add.
  practice_answers_removed  integer := 0;
  practice_attempts_removed integer := 0;
  view_state_removed        integer := 0;
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
  -- ⚠ v4: THE SECOND DOOR, SAME SHAPE. 0065's refuse_practice_mutation opens
  -- for DELETE (and only DELETE) while this transaction-local GUC is 'on' —
  -- the 0047/0048 ledger pattern, not session_replication_role, which would
  -- have silenced EVERY trigger in scope instead of one named door.
  PERFORM set_config('app.erasure_active', 'on', true);

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
   * ⚠ THE THIRD PRE-CHECK, ADDED IN REVIEW: A BILLING PROFILE CARRYING THIS
   * ADDRESS THAT SOMEBODY ELSE OWNS.
   * ============================================================================
   * billing_profiles is the one table where a personal address is guaranteed to
   * exist independently of any pointer: 0060 makes owner_user_id NULLABLE on
   * purpose (an admin may create a profile for a family that pays by transfer
   * and has no login) while billing_email is NOT NULL. That is exactly the
   * shape 0055's header rule names — "SET NULL ON A user_id DOES NOT ANONYMISE
   * A ROW THAT ALSO STORES AN EMAIL ADDRESS."
   *
   * The scrub below therefore covers TWO cases: the profile this person owns,
   * and an UNOWNED profile carrying their address. It cannot cover the third —
   * a profile owned by a DIFFERENT LIVE ACCOUNT that happens to carry this
   * address, which a two-parent family produces routinely. Scrubbing that would
   * rewrite a third party's billing identity to erase this person, and this
   * function's whole doctrine is that it does not delete one person's record to
   * erase another's.
   *
   * So it REFUSES, in the same shape as the teacher and marker checks, and
   * NAMES THE PROFILE. Without this the operator meets a bare sweep failure
   * telling them to "extend erase_user() to cover that table" — a table it
   * already covers — with no way to see which row is at fault.
   */
  SELECT coalesce(array_agg(b.id::text), ARRAY[]::text[])
    INTO foreign_profiles
    FROM public.billing_profiles b
   WHERE lower(b.billing_email) = lower(target_email)
     AND b.owner_user_id IS NOT NULL
     AND b.owner_user_id <> target;
  IF array_length(foreign_profiles, 1) > 0 THEN
    RAISE EXCEPTION
      'erase_user: % is the billing address on % profile(s) owned by somebody else — %. Change billing_email on those rows, or reassign them, before erasing. They are not scrubbed automatically: rewriting a third party''s billing identity to erase this person is the wrong trade, the same one refused for a teacher''s lessons and a marker''s marking.',
      target_email, array_length(foreign_profiles, 1), array_to_string(foreign_profiles, ', ')
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

  -- ── v4: lesson practice + view state (0064-0065) ─────────────────────────
  /**
   * ⚠ SAME RULE AS THE v3 BLOCK ABOVE: counted and deleted explicitly though
   * the FKs would cascade — a cascade is the quiet kind of coverage, and the
   * receipt must say how many. Answers first (child), through the join to the
   * parent's student_id; then attempts; then view state. The practice deletes
   * pass through 0065's append-only trigger via app.erasure_active, set at
   * the top of this transaction — DELETE is the one door it opens; an UPDATE
   * would still be refused mid-erasure.
   */
  DELETE FROM public.lesson_practice_answers a
   USING public.lesson_practice_attempts t
   WHERE a.attempt_id = t.id AND t.student_id = target;
  GET DIAGNOSTICS practice_answers_removed = ROW_COUNT;

  DELETE FROM public.lesson_practice_attempts WHERE student_id = target;
  GET DIAGNOSTICS practice_attempts_removed = ROW_COUNT;

  DELETE FROM public.lesson_view_state WHERE user_id = target;
  GET DIAGNOSTICS view_state_removed = ROW_COUNT;

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
   WHERE (b.owner_user_id = target
          OR (b.owner_user_id IS NULL AND lower(b.billing_email) = lower(target_email)))
     AND b.stripe_customer_id IS NOT NULL;

  /**
   * ⚠ WHO ELSE THIS ERASURE AFFECTS. A parent being erased may be paying for a
   * child who is not. Their records survive untouched — this refuses nothing —
   * but somebody has to know the payer behind a live seat is now a tombstone.
   * Named in the receipt rather than discovered at renewal.
   *
   * ⚠ NO JOIN TO entitlements, AND THE FIRST DRAFT HAD ONE. It required an
   * ACTIVE entitlement per child, which would have made this array almost
   * always empty and the emptiness meaningless: 0058's own header says
   * entitlements is NOT how private tuition or cohort seats are represented —
   * those are lesson_credit_transactions and cohort_enrolments — and with
   * Stripe keyless the only rows that can exist at all are admin grants. A
   * parent paying for two children by lesson credits would have been reported
   * as affecting nobody, and the operator would have read [] as "safe".
   *
   * The right population is simply: everybody linked to a profile this
   * transaction is about to tombstone, minus the person being erased.
   */
  SELECT coalesce(array_agg(DISTINCT bps.student_id), ARRAY[]::uuid[])
    INTO payerless_students
    FROM public.billing_profile_students bps
    JOIN public.billing_profiles b ON b.id = bps.billing_profile_id
   WHERE (b.owner_user_id = target
          OR (b.owner_user_id IS NULL AND lower(b.billing_email) = lower(target_email)))
     AND bps.student_id <> target;

  /**
   * ⚠ SCRUBBED, NOT DELETED, AND IT MUST RUN BEFORE `DELETE FROM auth.users`.
   * owner_user_id is ON DELETE SET NULL, so after the final statement this WHERE
   * matches nothing and billing_email keeps the address forever — the generic
   * sweep below would then refuse the whole erasure, correctly but uselessly.
   * Same ordering hazard, same reason, as private_bookings above.
   *
   * The row survives because payments reference it and because it may pay for
   * somebody who has not asked to be erased. What leaves is the person.
   *
   * ⚠ TWO ARMS, NOT ONE, AND THE SECOND WAS MISSING UNTIL REVIEW. The pointer
   * arm alone left an UNOWNED profile carrying this address untouched — the
   * sweep then found it and refused the whole erasure permanently, telling the
   * operator to extend a function that already covered the table. private_bookings
   * and cohort_enrolments above have carried both arms since 0055 for exactly
   * this reason; this one had imported only half of the pattern it cites.
   *
   * The third case — a profile owned by somebody ELSE carrying this address —
   * is refused by the pre-check at the top, not scrubbed here.
   */
  UPDATE public.billing_profiles
     SET billing_name    = 'Erased user',
         billing_email   = 'erased-' || target::text || '@ailemy.invalid',
         billing_country = NULL,
         updated_at      = now()
   WHERE owner_user_id = target
      OR (owner_user_id IS NULL AND lower(billing_email) = lower(target_email));
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
    'practice_answers_removed', practice_answers_removed,
    'practice_attempts_removed', practice_attempts_removed,
    'view_state_removed', view_state_removed,
    'email_columns_scanned', cols_scanned,
    /**
     * ⚠ TWO OBLIGATIONS, NOT RESULTS. Neither Stripe nor Storage is reachable
     * from a transaction, so what leaves here is a list of what the CALLER
     * must still do. An empty array is a real answer — it means there was
     * nothing to purge, not that the step was skipped.
     */
    /** Customer objects at Stripe holding this person's name, email and card metadata. */
    'stripe_erasure_required', to_jsonb(stripe_customers),
    /** Students whose live seat is now paid for by a tombstoned profile. */
    'payer_erasure_side_effects', to_jsonb(payerless_students),
    /**
     * ⚠ Nothing in this transaction deleted a file. The caller must purge this
     * prefix through the Storage API; a DELETE on storage.objects would strand
     * the binary and lose its path.
     */
    'storage_purge_required', jsonb_build_object(
      'bucket', 'submissions',
      'prefix', target::text || '/',
      'rows_referencing_files', submission_files
    )
  );
END;
$$;

COMMENT ON FUNCTION public.erase_user(uuid) IS
  'v4 (0066). v3 plus the lesson-player tables: counted deletes for lesson_practice_answers (via the attempt join), lesson_practice_attempts and lesson_view_state, passing 0065''s append-only trigger through the transaction-local app.erasure_active door (DELETE only — erasure never rewrites). Everything else unchanged from v3: scrubs, the email sweep that refuses on residue, and the Storage/Stripe obligations. service_role only.';

COMMIT;

-- ══ FOUNDER PASTE 2 — grants restated ═══════════════════════════════════════
-- ⚠ RESTATED, NOT ASSUMED. CREATE OR REPLACE FUNCTION preserves privileges, so
-- these should already be right — but a function that anon can execute deletes
-- people, and "should already be right" is not a thing to leave unverified on
-- that particular statement. Idempotent.
REVOKE ALL ON FUNCTION public.erase_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_user(uuid) TO service_role;

-- No NOTIFY: nothing in this file changes the REST schema.

-- ══ FOUNDER PASTE 3 — v4 delta verification, self-cleaning ══════════════════
-- One DO block, run AFTER 0064+0065+this file are applied. It builds a probe
-- fixture (practice attempt + answer + view state on a REAL user chosen from
-- auth.users — rows created and erased inside this block), calls erase_user,
-- and asserts the three new receipt counts and the email gate. The probe user
-- itself is NOT deleted from auth.users — erase_user erases app data; the
-- fixture rows are the only casualties, and they are the point.
--
-- ⚠ RUN THIS AGAINST A PROBE USER, NOT A REAL STUDENT: the block erases the
-- target's APP DATA (bookings, notifications, entitlements — everything v3
-- already covered). Create a fresh @example.test user via the Admin API
-- first (SESSION-RUN SR-1 does exactly that and hands you the uuid), then
-- replace the SELECT below only if you want a specific target; by default it
-- picks the NEWEST user, which after SR-1 is the probe.
--
-- ⚠ EXPLICIT BEGIN/COMMIT + TERMINAL RESET, BECAUSE THE EDITOR CAN HOLD A
-- TRANSACTION OPEN ACROSS RUNS. Every set_config here is transaction-local,
-- but a backend whose transaction never closes carries "this transaction"
-- into your next run — that is exactly how the door-shut check once read 'on'
-- on a fresh statement. The COMMIT below ends the transaction THIS paste
-- owns, and the RESET clears any residue regardless of what the editor did
-- with earlier ones. The trailing SELECT prints the proof.
BEGIN;
DO $$
DECLARE
  probe_user uuid;
  l1 uuid;
  att uuid;
  receipt jsonb;
BEGIN
  SELECT id INTO probe_user FROM auth.users ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO l1 FROM public.lessons WHERE slug = 'definitions-formulae-and-the-mole';
  IF probe_user IS NULL OR l1 IS NULL THEN RAISE EXCEPTION 'preflight: need a user and the L1 row'; END IF;
  RAISE NOTICE 'target (newest user — confirm this is the SR-1 probe): %', probe_user;

  -- fixture: one attempt, one answer, one view-state row
  PERFORM set_config('app.erasure_active', 'on', true);  -- only so a re-run can rebuild after a partial failure; harmless here
  INSERT INTO public.lesson_practice_attempts
    (student_id, lesson_id, seed, question_count, score, percent, snapshot)
  VALUES (probe_user, l1, 454545, 10, 9, 90.0, '{"probe": true}'::jsonb)
  RETURNING id INTO att;
  INSERT INTO public.lesson_practice_answers
    (attempt_id, q_index, family_key, spec_code, kind, selected_index,
     correct_index, correct, mark_awarded, mark_available)
  VALUES (att, 0, 'probe-family', '1.1', 'definition', 2, 2, true, 1, 1);
  INSERT INTO public.lesson_view_state (user_id, lesson_id, last_frame_index, slides_visited)
  VALUES (probe_user, l1, 14, ARRAY[1,2,3])
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET last_frame_index = 14;

  -- ⚠ THE FIXTURE IS NON-EMPTY BEFORE THE CALL IS BELIEVED (the 0055(e) rule).
  IF (SELECT count(*) FROM public.lesson_practice_attempts WHERE student_id = probe_user) < 1
     OR (SELECT count(*) FROM public.lesson_view_state WHERE user_id = probe_user) < 1 THEN
    RAISE EXCEPTION 'FAIL — fixture did not build; a zero-count receipt would be vacuous';
  END IF;
  RAISE NOTICE 'fixture ✓ — attempt + answer + view state exist for the probe';

  receipt := public.erase_user(probe_user);

  -- the three NEW receipt fields, against the known fixture
  IF (receipt->>'practice_answers_removed')::int < 1 THEN
    RAISE EXCEPTION 'FAIL — practice_answers_removed = %, expected >= 1', receipt->>'practice_answers_removed';
  END IF;
  IF (receipt->>'practice_attempts_removed')::int < 1 THEN
    RAISE EXCEPTION 'FAIL — practice_attempts_removed = %, expected >= 1', receipt->>'practice_attempts_removed';
  END IF;
  IF (receipt->>'view_state_removed')::int < 1 THEN
    RAISE EXCEPTION 'FAIL — view_state_removed = %, expected >= 1', receipt->>'view_state_removed';
  END IF;
  RAISE NOTICE 'PASS — receipt counts: answers % · attempts % · view state %',
    receipt->>'practice_answers_removed', receipt->>'practice_attempts_removed', receipt->>'view_state_removed';

  -- ⚠ THE GATE: still exactly 8 email columns scanned.
  IF (receipt->>'email_columns_scanned')::int <> 8 THEN
    RAISE EXCEPTION 'GATE FAIL — email_columns_scanned = %, expected 8. The schema grew an email column erase_user does not cover; STOP and extend the function.',
      receipt->>'email_columns_scanned';
  END IF;
  RAISE NOTICE 'PASS — GATE: email_columns_scanned = 8';

  -- nothing of the probe's remains
  IF (SELECT count(*) FROM public.lesson_practice_attempts WHERE student_id = probe_user) <> 0
     OR (SELECT count(*) FROM public.lesson_view_state WHERE user_id = probe_user) <> 0 THEN
    RAISE EXCEPTION 'FAIL — practice/view-state rows survived the erasure';
  END IF;
  RAISE NOTICE 'PASS — zero practice/view-state rows remain for the erased user';
END $$;
COMMIT;
RESET app.erasure_active;
-- The proof that THIS paste leaves the door shut behind it — EXPECT
-- door_state = 'shut':
SELECT CASE
         WHEN coalesce(nullif(current_setting('app.erasure_active', true), ''), 'off') = 'on'
         THEN 'OPEN — investigate before continuing'
         ELSE 'shut'
       END AS door_state;
-- EXPECT above the proof: target notice, fixture ✓, three PASS notices. The
-- erase_user call inside also exercised every v3 path against the probe
-- (their receipt counts print nothing here — SR-2 inspects a full receipt).

-- ══ FOUNDER PASTE 4 — ⚠ THE DOOR IS SHUT OUTSIDE THE ERASURE TRANSACTION ═══
-- Run this as its OWN paste, as a FRESH statement — that is the point of it.
--
-- ⚠ SHUT MEANS "ANYTHING BUT 'on'", AND THAT IS A MEASURED DEFINITION. On a
-- genuinely fresh backend the raw value is NULL; on a session that ever
-- touched the GUC (including after your own RESET) PostgreSQL reports the
-- EMPTY STRING, not NULL — both mean the trigger's door does not open,
-- because 0065's check is `= 'on'` and nothing else. An earlier version of
-- this paste tested IS NULL and would have called a safe '' a failure.
-- The RESET first line also clears any residue an editor-held open
-- transaction carried this far — belt, braces, then the reading.
-- EXPECT: door_state = 'shut' (raw_value column shows NULL or empty).
RESET app.erasure_active;
SELECT current_setting('app.erasure_active', true) AS raw_value,
       CASE
         WHEN coalesce(nullif(current_setting('app.erasure_active', true), ''), 'off') = 'on'
         THEN 'OPEN — a transaction carrying the GUC is still alive; run ROLLBACK; then re-run this paste'
         ELSE 'shut'
       END AS door_state;

-- ══ SESSION-RUN (mine, not founder pastes) ══════════════════════════════════
-- SR-1  Create the probe user (@example.test, per-run-unique, Admin API) and
--       hand the founder its uuid BEFORE Paste 3; delete it by captured id
--       after Paste 3 (the erasure removed its app data; the auth row is
--       mine to remove).
-- SR-2  Full 0055 (a)-(g) re-run INCLUDING both halves of the sabotage test,
--       plus 0061's (h)/(i)/(j) — the planning gate. Report the numbers
--       per letter, refusals with their codes.
-- SR-3  ⚠ THE 0065 TRIGGER'S OTHER HALF UNDER v4: with NO GUC set, a plain
--       service-role DELETE on a (fresh probe) practice row must still be
--       REFUSED — proving v4's door did not become a hole once the function
--       began setting the GUC routinely.
