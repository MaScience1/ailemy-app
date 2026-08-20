-- ============================================================================
-- 00XX_PROPOSED_erase_user_v2.sql   ⚠ NUMBER FROM THE PLANNING CHAT
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. Apply LAST of this set: it names tables that the
-- cancellation-requests and notification-ledger files create. Applying it
-- before them raises 42P01 and the function is left not created.
-- Run each section separately.
--
-- ============================================================================
-- ⚠ WHY THIS FILE EXISTS: 0049 ERASES A PERSON FROM THE TABLES THAT EXISTED
-- WHEN IT WAS WRITTEN. FOUR TABLES ALREADY OUTLIVE IT, AND THIS SET ADDS THREE.
-- ============================================================================
-- The defect class is now on its fourth appearance:
--
--   0047  shipped a ledger whose CASCADE the append-only trigger refused
--   0048  fixed the trigger, for a human at a SQL prompt
--   0049  fixed the only path an erasure request actually takes
--   here  fixes WHAT GETS ERASED, which none of the three ever revisited
--
-- 0049's verification block (e) records this PASS:
--
--     "erased, and the booking survives with user_id NULL — the lesson
--      happened, the person is gone."
--
-- ⚠ THE PERSON WAS NOT GONE. private_bookings.email is NOT NULL and is not
-- touched by ON DELETE SET NULL, so that "anonymised" row still carries the
-- student's email address, and private_bookings.notes still carries whatever
-- was written about them. The assertion was true about the FK and false about
-- the sentence it wrote.
--
-- ============================================================================
-- ⚠ THE RULE THIS FILE ENCODES: SET NULL ON A user_id DOES NOT ANONYMISE A ROW
-- THAT ALSO STORES AN EMAIL ADDRESS.
-- ============================================================================
-- A foreign key erases a POINTER. Personal data is not the pointer, it is the
-- column next to it. Every table below stores an address, a name or a phone
-- number independently of any FK, which is why each needs a statement of its
-- own and why the FK behaviour is not the answer to "is this person gone".
--
-- ============================================================================
-- ⚠ DELETE THE PERSON'S OWN ROWS. SCRUB THE ROWS THAT ARE SOMEBODY ELSE'S
-- RECORD OF A REAL EVENT.
-- ============================================================================
-- That line is drawn once and applied consistently:
--
--   DELETED   cancellation_requests   their request, their words
--             notification_events     what we told them
--             notification_deliveries what we told them, per channel
--             push_tokens             their devices
--             interest_registrations  a lead, with a child's name on it
--             waitlist                an address and nothing else
--             lesson_credit_transactions  (already, since 0049)
--             booking_holds               (already, since 0049)
--
--   SCRUBBED  private_bookings        a lesson the TEACHER delivered. The row
--                                     stays so the teacher's record survives;
--                                     the email and notes go.
--             cohort_enrolments       a PAYMENT. £169 was taken on a date and
--                                     that has to remain provable; who paid it
--                                     does not.
--
--   CASCADES  profiles (0001), user_roles (0027), exam_attempts and their
--             responses (0028), subscriptions, student_questions,
--             teacher_availability + availability_blocks (0045).
--             Verified as ON DELETE CASCADE from auth.users(id); no statement
--             needed and none added, but they are listed so a future reader
--             does not have to re-derive the list to trust this function.
--
-- ⚠ A TOMBSTONE ADDRESS, NOT NULL, BECAUSE THE COLUMNS ARE NOT NULL. Scrubbed
-- rows get 'erased-<row id>@ailemy.invalid'. `.invalid` is reserved by RFC 2606
-- and can never resolve, so no future code path can accidentally send to it.
-- The row id is in there because cohort_enrolments has UNIQUE (cohort_id,
-- email): a constant tombstone would collide the moment a SECOND student in the
-- same cohort was erased, and the erasure would fail with 23505 for a reason
-- nobody would enjoy diagnosing at the time.
--
-- ============================================================================
-- ⚠ AND THEN IT CHECKS ITS OWN WORK, GENERICALLY, BEFORE COMMITTING
-- ============================================================================
-- The final block sweeps every text column in `public` named `email` or
-- `%_email` and counts rows still matching the target address. Non-zero raises,
-- and the whole erasure rolls back — so the outcome is always either "gone" or
-- "nothing happened", never "mostly gone".
--
-- That converts the recurring failure — someone adds a table and forgets this
-- function — from a silent leak into a loud refusal that names the table.
--
-- ⚠ WHAT THE SWEEP DOES NOT PROVE. It finds EMAIL columns. It cannot see
-- interest_registrations.phone, cohort_enrolments.parent_contact (a WhatsApp
-- number), student_name, or free text in a notes column. Those are covered by
-- the explicit statements above and by nothing else. This guard is a backstop
-- against a forgotten table, not a proof that no personal data remains.
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
  cols_scanned      integer := 0;
  leftover          bigint;
  residue           text[] := ARRAY[]::text[];
  rec               record;
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
    'email_columns_scanned', cols_scanned
  );
END;
$$;

COMMENT ON FUNCTION public.erase_user(uuid) IS
  'Delete a person completely: their own rows deleted, third-party records scrubbed of personal columns, and a generic email sweep that refuses to report success while the address still appears anywhere in public. service_role only.';

COMMIT;

-- ── SECTION 2: WHO MAY CALL IT ──────────────────────────────────────────────
-- ⚠ CREATE OR REPLACE PRESERVES EXISTING GRANTS, so 0049's are still in force.
-- These are re-issued anyway: a REVOKE that is already true costs nothing, and
-- assuming it held is how a SECURITY DEFINER function that deletes users ends
-- up callable by anon.
BEGIN;

REVOKE ALL ON FUNCTION public.erase_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erase_user(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_user(uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- ⚠ RE-RUN 0049's BLOCKS (a) THROUGH (g) FIRST, UNCHANGED. This file replaces
-- that function body; every guarantee 0049 proved has to be proved again, not
-- assumed to have survived a rewrite. In particular (a) — anon and
-- authenticated refused, 42501 — and (f) — the purge escape still dies with the
-- transaction. Those two are the dangerous ones.
--
-- Then, the new coverage. Build ONE probe person carrying a row in every table:
--
--   probe-erase-v2@example.test  with
--     · a lesson_credit_transactions row
--     · a private_bookings row as user_id (someone else as teacher)
--     · a SECOND private_bookings row with user_id NULL and their email
--     · a cancellation_requests row against the first booking
--     · a notification_events row with user_id set   + 3 deliveries
--     · a notification_events row with user_id NULL and their email + 1 delivery
--     · 2 push_tokens
--     · an interest_registrations row
--     · a waitlist row
--     · a cohort_enrolments row
--
-- (a) ⚠ COUNT EVERY ROW BEFORE ERASING, AND WRITE THE NUMBERS DOWN.
-- SELECT
--   (SELECT count(*) FROM public.cancellation_requests   WHERE lower(requested_by_email)=lower('probe-erase-v2@example.test')) AS cancels,
--   (SELECT count(*) FROM public.notification_events     WHERE lower(email)=lower('probe-erase-v2@example.test') OR user_id=<uid>) AS events,
--   (SELECT count(*) FROM public.push_tokens             WHERE user_id=<uid>) AS tokens,
--   (SELECT count(*) FROM public.interest_registrations  WHERE lower(email)=lower('probe-erase-v2@example.test')) AS interest,
--   (SELECT count(*) FROM public.waitlist                WHERE lower(email)=lower('probe-erase-v2@example.test')) AS waitlist,
--   (SELECT count(*) FROM public.private_bookings        WHERE lower(email)=lower('probe-erase-v2@example.test')) AS bookings,
--   (SELECT count(*) FROM public.cohort_enrolments       WHERE lower(email)=lower('probe-erase-v2@example.test')) AS enrolments;
-- EXPECT: 1, 2, 2, 1, 1, 2, 1.
--   ⚠ IF ANY IS 0 THE PROBE IS INCOMPLETE AND THE TEST BELOW PROVES LESS THAN
--   IT APPEARS TO. A zero-row table cannot fail an erasure check. This is the
--   whole "zero rows is not proof" rule, applied to the fixture rather than the
--   result.
--
-- (b) erase, and read the receipt
-- SELECT public.erase_user('<uid>');
-- PASS: every count in (a) appears in the returned jsonb, matching:
--   cancellation_requests_removed 1 · notification_events_removed 2 ·
--   notification_deliveries_removed 4 · push_tokens_removed 2 ·
--   interest_registrations_removed 1 · waitlist_removed 1 ·
--   bookings_scrubbed 2 · enrolments_scrubbed 1 · email_columns_scanned ≥ 7.
--   ⚠ A COUNT OF 0 WHERE (a) SAID 1 IS A FAILURE EVEN THOUGH THE CALL
--   SUCCEEDED. That is the partial-success-reported-as-success shape, and it is
--   the reason the receipt exists at all.
--
-- (c) ⚠ THE ADDRESS IS GONE FROM EVERY COLUMN, CHECKED INDEPENDENTLY OF THE
--     FUNCTION'S OWN SWEEP — a self-check that passes is not evidence when the
--     self-check is the thing under test.
-- SELECT 'cancellation_requests' t, count(*) FROM public.cancellation_requests WHERE lower(requested_by_email)=lower('probe-erase-v2@example.test')
-- UNION ALL SELECT 'notification_events', count(*) FROM public.notification_events WHERE lower(email)=lower('probe-erase-v2@example.test')
-- UNION ALL SELECT 'interest_registrations', count(*) FROM public.interest_registrations WHERE lower(email)=lower('probe-erase-v2@example.test')
-- UNION ALL SELECT 'waitlist', count(*) FROM public.waitlist WHERE lower(email)=lower('probe-erase-v2@example.test')
-- UNION ALL SELECT 'private_bookings', count(*) FROM public.private_bookings WHERE lower(email)=lower('probe-erase-v2@example.test')
-- UNION ALL SELECT 'cohort_enrolments', count(*) FROM public.cohort_enrolments WHERE lower(email)=lower('probe-erase-v2@example.test');
-- PASS: 0 on every line.
--
-- (d) …AND THE RECORDS THAT MUST SURVIVE, SURVIVED
-- SELECT id, email, notes, user_id FROM public.private_bookings WHERE id IN (<the two>);
-- PASS: both rows present · email 'erased-<id>@ailemy.invalid' · notes NULL ·
--   user_id NULL. The lesson happened; the person is gone. THIS is the
--   assertion 0049's block (e) was reaching for and did not make.
-- SELECT amount_pence, stripe_ref, email, parent_name, parent_contact
--   FROM public.cohort_enrolments WHERE id = <the enrolment>;
-- PASS: amount_pence and stripe_ref UNCHANGED; the other three erased.
--   ⚠ IF amount_pence CHANGED, the scrub is over-broad and has destroyed a
--   financial record. Stop and say so.
--
-- (e) ⚠ SABOTAGE — PROVE THE SWEEP ACTUALLY BITES. A guard that has never been
--     seen to fail has not been shown to work, and the first version of the
--     reconcile guard in this repo passed for every possible input.
-- CREATE TABLE public.sabotage_probe (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
-- INSERT INTO public.sabotage_probe (email) VALUES ('probe-sabotage@example.test');
-- (create a user with that address, then) SELECT public.erase_user('<uid>');
-- PASS: 'erase_user: the address still appears in 1 — sabotage_probe.email
--   (1 row(s)). NOTHING WAS ERASED…'
-- SELECT count(*) FROM auth.users WHERE email='probe-sabotage@example.test';
-- PASS: 1 — ⚠ THE USER IS STILL THERE. That is the point: the refusal rolled
--   the whole erasure back rather than completing most of it.
-- DROP TABLE public.sabotage_probe;
-- (then re-run the erase) PASS: succeeds.
--   ⚠ RUN BOTH HALVES. Watching it refuse proves the check fires; watching it
--   then succeed proves the check was the cause and not some other fault.
--
-- (f) the teacher refusal still stands (0049 (d), re-run because the order of
--     the check moved to the top of the function)
-- PASS: 'erase_user: … is the teacher on N booking(s)…' and the teacher survives.
--
-- (g) ⚠ CLEANUP DELETES ONLY WHAT THIS RUN CREATED, BY CAPTURED id — never a
--     WHERE email LIKE 'probe-%' sweep across a live table. The probes above are
--     mostly erased by the test itself; what remains is the surviving scrubbed
--     private_bookings and cohort_enrolments rows, whose ids were captured in
--     (d). Delete those two by id, then confirm:
-- SELECT count(*) FROM auth.users WHERE email LIKE 'probe-erase-v2%';
-- PASS: 0.
--
-- ----------------------------------------------------------------------------
-- ⚠ ROLLBACK
-- ----------------------------------------------------------------------------
-- Re-apply 0049's SECTION 1 verbatim; CREATE OR REPLACE restores the previous
-- body and grants are unaffected. Nothing in this file alters a table.
