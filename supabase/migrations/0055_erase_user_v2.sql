-- ============================================================================
-- 0055_PROPOSED_erase_user_v2.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-20, last of 0051–0055. Renamed off
-- _PROPOSED_ once verified.
--
-- ============================================================================
-- ⚠⚠ VERIFICATION IS 2 BLOCKS OF ROUGHLY FIFTEEN. THIS FILE IS THE LEAST
-- VERIFIED OF THE FIVE AND THE HEADER SAYS SO IN THE FIRST LINE FOR A REASON.
-- ============================================================================
--   0049(a) anon CANNOT call erase_user — 42501 permission denied for
--           function erase_user. The single most dangerous object in this
--           schema is unreachable from a browser key.                       ✓
--   0049(b) an unknown id raises P0002 'erase_user: no such user …' — which
--           also proves v2 is installed, callable, and reaches its first
--           guard rather than silently succeeding.                          ✓
--
--   ⊘ EVERYTHING ELSE IS NOT RUN:
--       0049(c) erase a user carrying a ledger row
--       0049(d) the teacher refusal
--       0049(e) a student booking does not block, and survives anonymised
--       0049(f) ⚠ THE PURGE ESCAPE STILL DIES WITH ITS TRANSACTION — the one
--               that, if it had silently broken, leaves the ledger no longer
--               append-only. Rewriting this function body is exactly the event
--               that could break it, and it has NOT been re-observed.
--       0049(g) an ordinary DELETE still refused
--       0055(a)(b) the full probe and its receipt
--       0055(c)(d) the address gone, the records that must survive surviving
--       0055(e) BOTH HALVES of the sweep sabotage
--       0055(f2)(f3) the marker pre-check and its bare-23503 sabotage
--       0055(f4) storage_purge_required in the receipt
--
--   Every one needs an auth.users identity to create and then erase. I did not
--   create one: 0048 and 0049 each left a probe user in production that could
--   not be removed, and a script that calls a function whose purpose is to
--   delete a person is not something to start unasked. Founder pastes issued
--   for all of it.
--
--   ⚠ DO NOT READ THE 'APPLIED' ABOVE AS 'PROVEN'. The function is installed
--   and gated. What it DOES has not been watched once.
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
-- ⚠ WHERE cohort_enrolments COMES FROM, because it is not obvious and was
-- queried in review: 0009_cohort_intensive.sql line 53. It is under migration
-- control and always has been. It is hard to find because 0009 is the ONLY
-- lowercase-DDL migration in this folder — `create table if not exists
-- public.cohort_enrolments` — so any case-sensitive grep for CREATE TABLE or
-- REFERENCES auth.users misses it and every one of its four tables. That is
-- also how the first draft of THIS file missed three more auth.users foreign
-- keys in the same migration; see the marker check below.
--
--   CASCADES  profiles (0001), user_roles (0027), exam_attempts and their
--             responses (0028), subscriptions, student_questions,
--             teacher_availability + availability_blocks (0045),
--             submissions + topic_assessments (0009).
--             Verified as ON DELETE CASCADE from auth.users(id) by a
--             CASE-INSENSITIVE sweep; no statement needed and none added, but
--             they are listed so a future reader does not have to re-derive the
--             list to trust this function.
--
--   REFUSED   submission_feedback.marker_id (0009 line 129) — see below.
--
-- ============================================================================
-- ⚠ ONE FOREIGN KEY IN THE SCHEMA HAS NO ON DELETE CLAUSE AT ALL, AND IT
-- BLOCKS ERASURE TODAY
-- ============================================================================
--     marker_id uuid not null references auth.users(id)
--
-- No ON DELETE means NO ACTION. Erasing anyone who has ever marked a submission
-- raises 23503 at `DELETE FROM auth.users` — after every delete and scrub in
-- this function has already run. The transaction rolls back, so nothing is
-- half-done, but the operator gets
--   'update or delete on table "users" violates foreign key constraint'
-- with no indication of which table, which person, or what to do.
--
-- ⚠ THIS IS ALREADY TRUE OF 0049 IN PRODUCTION. It is not introduced here.
-- Nobody has hit it because nobody has yet asked to erase a marker.
--
-- The fix is a NAMED refusal before any write, the same shape as the teacher
-- check — not a change to the foreign key. A marker's marking is the STUDENT's
-- feedback: marks_awarded, marks_available and a comment in mark-scheme
-- language. Cascading it away would delete another person's record of their own
-- work to erase the marker, which is the wrong trade in the same way the
-- teacher case is. A human reassigns, then erases.
--
-- ⚠ CHANGING THAT FK TO SET NULL IS THE RIGHT LONG-TERM ANSWER and it is NOT
-- done here: marker_id is NOT NULL, so it needs a nullable column and a
-- decision about what an unattributed mark means. That is its own migration,
-- its own number, and its own conversation.
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
--
-- ============================================================================
-- ⚠ AND IT CANNOT REACH THE FILES. THE FUNCTION REPORTS THEM INSTEAD OF
-- PRETENDING.
-- ============================================================================
-- 0009 creates a private `submissions` bucket and stores a student's uploaded
-- work — photographs of a child's handwriting — under a folder named by their
-- uid: the policy is
--     (storage.foldername(name))[1] = auth.uid()::text
-- submissions.storage_path and submission_feedback.marked_file_path point into
-- it, and both rows CASCADE away when the person is deleted.
--
-- ⚠ DELETING A ROW IN storage.objects WOULD NOT DELETE THE FILE. The object row
-- is metadata; only the Storage API removes both. So deleting those rows here
-- would orphan the binary in the bucket AND destroy the only record of its
-- path — making the file permanently unreachable and permanently undeletable.
-- That is strictly worse than leaving it.
--
-- So this function touches no storage row and instead RETURNS the prefix and
-- the count, and the caller purges through the Storage API. The count is taken
-- BEFORE the cascade, because afterwards there is nothing left to count. Same
-- reasoning as push_tokens and APNs: the database's job is the row, and the
-- number is how the obligation leaves this transaction.
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
    'email_columns_scanned', cols_scanned,
    /**
     * ⚠ AN OBLIGATION, NOT A RESULT. Nothing in this transaction deleted a
     * file. The caller must purge this prefix through the Storage API; a
     * DELETE on storage.objects would strand the binary and lose its path.
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
--     · 2 submissions rows WITH a storage_path (for the storage receipt)
--     · ⚠ and, for (f2) only and SEPARATELY, a submission_feedback row naming
--       them as marker_id — kept out of the main probe because it REFUSES the
--       erasure by design and would make every other block untestable
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
-- (f2) ⚠ THE MARKER REFUSAL — the FK with no ON DELETE clause. This is the one
--      that fails as a bare 23503 if the check is ever removed, so prove both
--      halves.
-- (give the probe user a submission_feedback row as marker_id, then)
-- SELECT public.erase_user('<uid>');
-- PASS: 'erase_user: … has marked N submission(s). Reassign marker_id…'
-- SELECT count(*) FROM auth.users WHERE id='<uid>';
-- PASS: 1 — refused, not half-erased.
--
-- (f3) ⚠ SABOTAGE — CONFIRM THE BARE 23503 IS REAL AND THE CHECK IS WHAT STOPS
--      IT. Without this, (f2) proves only that a message exists.
--
--      ⚠⚠ RUN THIS INSIDE AN EXPLICIT TRANSACTION AND ROLL IT BACK. It is a
--      raw DELETE against auth.users. The SQL Editor autocommits, so a bare
--      statement here would either raise (the expected case) or DELETE A REAL
--      PERSON if you mistype the uid. BEGIN first. ROLLBACK always — even on
--      the error, because an aborted transaction still holds the session open.
--
-- BEGIN;
--   DELETE FROM auth.users WHERE id = '<the probe uid>';
-- ROLLBACK;
-- PASS: 'update or delete on table "users" violates foreign key constraint
--   … on table "submission_feedback"' — 23503, naming nothing useful. THAT is
--   what an operator would have seen before this check existed.
--   ⚠ IF IT SUCCEEDS INSTEAD, the FK has been changed since 0009 and the marker
--   check in section 1 is now dead weight guarding nothing. Say so — do not
--   quietly leave a check whose premise has gone.
--
-- Then reassign marker_id to another account and re-run erase_user.
-- PASS: succeeds.
--
-- (f4) ⚠ THE STORAGE OBLIGATION IS REPORTED, AND THE FILES ARE STILL THERE.
--      This is a receipt for work the database did NOT do; verify it says so
--      truthfully rather than assuming.
-- (give the probe user 2 submissions rows with a storage_path, then erase)
-- PASS: the returned jsonb carries
--   storage_purge_required: {bucket: 'submissions',
--                            prefix: '<uid>/', rows_referencing_files: 2}
-- SELECT count(*) FROM public.submissions WHERE user_id = '<uid>';
-- PASS: 0 — the ROWS cascaded.
-- SELECT count(*) FROM storage.objects
--  WHERE bucket_id='submissions' AND (storage.foldername(name))[1] = '<uid>';
-- PASS: the files are STILL PRESENT. ⚠ THIS IS THE EXPECTED RESULT, not a
--   failure. A 0 here would mean something deleted storage rows and stranded
--   the binaries with no record of their paths. The purge is the caller's job,
--   through the Storage API, using the prefix above.
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
