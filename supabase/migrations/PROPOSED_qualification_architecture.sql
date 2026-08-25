-- ============================================================================
-- _PROPOSED_ — exam board as data, per-subject preference, tuition linkage
-- ----------------------------------------------------------------------------
-- ⚠ NOT APPLIED. NOT NUMBERED. DO NOT RUN AS IT STANDS.
--
-- The number comes from the planning chat and nowhere else. This file must NOT
-- assume the next free integer — a folder listing cannot show a reservation,
-- and this folder is the only rebuild path.
--
-- ⚠ ALLOCATION AS OF 2026-08-23. This note used to read "0068+ is already
-- queued by the lesson-experience batch (PROPOSED_lesson_sections_and_content
-- .sql)". That is no longer the position:
--
--     0068 .... TAKEN — tuition booking RPC, applied and live.
--     0069 .... TAKEN — repair of 0068, written and PARKED, not yet applied.
--     0070+ ... UNISSUED.
--
-- Unissued is not the same as free. It means no number above 0069 has been
-- allocated to anything, including to this file — so this file still must NOT
-- assume 0070. Ask for a number; do not count to one.
--
-- ⚠ HOW LITTLE THIS NEEDS TO BE, AND WHY
-- ----------------------------------------------------------------------------
-- §20 says fit the current architecture rather than invent tables, and the
-- current architecture already models almost all of this — since 0001:
--
--   curricula          11 rows, board+qualification pairs (edexcel-ial,
--                      aqa-gcse, cie-igcse …), slug UNIQUE and URL-safe
--   courses.curriculum_id  NOT NULL FK → curricula
--   courses.pathway    (0005) the qualification grouping
--   curricula.region   'International' | 'United Kingdom' | 'United States'
--
-- So Subject → Qualification → Board → Course is ALREADY representable, and
-- `curricula.slug` is already in the projection every /learn page reads
-- (queries.ts COURSE_SELECT). The LEVEL tier above it is pure derivation and
-- needs no column at all. NOTHING in this file is required for the shipped
-- feature to work — the app runs today, on the schema as it is.
--
-- What each section buys is the removal of one hardcoded mapping.
-- ============================================================================

-- ══ SECTION 1 — board and specification as data, not as a constant ══════════
BEGIN;

-- ⚠ REPLACES CURRICULUM_BOARD IN src/lib/qualifications/model.ts. Today the
-- board a curriculum belongs to is a hand-written map in TypeScript, because
-- the column does not exist. That map is correct and reviewable, and it is
-- still a second place the truth lives.
ALTER TABLE public.curricula
  ADD COLUMN IF NOT EXISTS exam_board text,
  ADD COLUMN IF NOT EXISTS specification_code text;

-- Nullable on purpose: `ib` and `ap` are not board-based qualifications, and
-- forcing a board onto them would invent a fact. A CHECK constrains the
-- vocabulary without requiring a value.
ALTER TABLE public.curricula
  DROP CONSTRAINT IF EXISTS curricula_exam_board_check;
ALTER TABLE public.curricula
  ADD CONSTRAINT curricula_exam_board_check CHECK (
    exam_board IS NULL OR exam_board IN ('edexcel','aqa','ocr','cambridge','oxfordaqa')
  );

-- Backfill exactly the mapping the application already uses, so applying this
-- changes no behaviour on the day it runs.
UPDATE public.curricula SET exam_board = 'edexcel'   WHERE slug IN ('edexcel-ial','edexcel-igcse','edexcel-alevel','edexcel-gcse');
UPDATE public.curricula SET exam_board = 'aqa'       WHERE slug IN ('aqa-alevel','aqa-gcse');
UPDATE public.curricula SET exam_board = 'ocr'       WHERE slug IN ('ocr-alevel','ocr-gcse');
UPDATE public.curricula SET exam_board = 'cambridge' WHERE slug IN ('cie-igcse');

CREATE INDEX IF NOT EXISTS curricula_exam_board_idx
  ON public.curricula (exam_board) WHERE exam_board IS NOT NULL;

-- curricula is read by everyone (catalogue_public_read_curricula, 0001) and
-- written only by admin tooling, so no new grant is needed. Restated because
-- a new column on a public table is exactly where a privilege creeps in.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.curricula FROM anon, authenticated;

COMMIT;

-- ══ SECTION 2 — the boards the brief names that have no row yet ═════════════
-- ⚠ DATA, NOT SCHEMA — AND DELIBERATELY SEPARATE SO IT CAN BE DECLINED.
-- Cambridge International AS & A Level and OxfordAQA are named in the brief
-- (§8, §5) and have no `curricula` row, so they cannot appear anywhere in the
-- UI today. Inserting them makes the ARCHITECTURE show them; it does not make
-- them supported — with no courses and no lessons the derivation returns
-- "Coming soon" for both, which is the truth (§41).
--
-- Left unapplied so the decision is the founder's: a board on the page with
-- nothing behind it is breadth to some readers and noise to others.
BEGIN;

INSERT INTO public.curricula (slug, name, short_name, region, description, sort_order, exam_board)
VALUES
  ('cie-ial', 'Cambridge International AS & A Level', 'Cambridge IAL', 'International',
   'Cambridge Assessment International Education AS & A Level', 12, 'cambridge'),
  ('oxfordaqa-igcse', 'OxfordAQA International GCSE', 'OxfordAQA IGCSE', 'International',
   'OxfordAQA International GCSE', 13, 'oxfordaqa'),
  ('oxfordaqa-ial', 'OxfordAQA International A-Level', 'OxfordAQA IAL', 'International',
   'OxfordAQA International Advanced Level', 14, 'oxfordaqa')
ON CONFLICT (slug) DO NOTHING;

-- ⚠ NO COURSE SHELLS ARE CREATED FOR THEM. An empty course row would make the
-- board render one tier deeper with nothing in it, which is the thin doorway
-- §26 forbids. Courses arrive when content does.

COMMIT;

-- ══ SECTION 3 — per-subject qualification preference (§17, §18) ═════════════
BEGIN;

-- ⚠ WHY profiles.curriculum_id CANNOT DO THIS, THOUGH IT ALREADY EXISTS.
-- 0017 added `profiles.curriculum_id` as a single global preference and its
-- own header records the limit: "one profile value cannot describe a student
-- taking GCSE and AS at once." §18 requires exactly what that cannot express
-- — Chemistry on Edexcel IAL while Biology is on Cambridge. So the preference
-- becomes one row per (student, subject). profiles.curriculum_id stays as the
-- catalogue-wide default and is NOT dropped: it has a reader today.
--
-- ⚠ A PREFERENCE, NEVER AN ENTITLEMENT (§37). This table says which
-- qualification a student TELLS us they study. It grants nothing. Access
-- continues to come from student_courses, entitlements and cohort_enrolments,
-- which is why a student may freely write this row and may not write those.
CREATE TABLE IF NOT EXISTS public.student_subject_qualification (
  user_id       uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  subject_id    uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  curriculum_id uuid NOT NULL REFERENCES public.curricula(id) ON DELETE CASCADE,
  -- Null when the student answered "I'm not sure" (§19) — a real answer that
  -- must not be stored as a guess.
  is_confirmed  boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_subject_qualification_pk PRIMARY KEY (user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS ssq_subject_idx ON public.student_subject_qualification (subject_id);

DROP TRIGGER IF EXISTS touch_student_subject_qualification ON public.student_subject_qualification;
CREATE TRIGGER touch_student_subject_qualification
  BEFORE UPDATE ON public.student_subject_qualification
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.student_subject_qualification ENABLE ROW LEVEL SECURITY;

-- Predicate in BOTH USING and WITH CHECK — USING alone filters what a student
-- SEES while still letting them write a row carrying somebody else's user_id.
CREATE POLICY ssq_own_read   ON public.student_subject_qualification
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ssq_own_insert ON public.student_subject_qualification
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY ssq_own_update ON public.student_subject_qualification
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ssq_own_delete ON public.student_subject_qualification
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY ssq_staff_read ON public.student_subject_qualification
  FOR SELECT TO authenticated USING (public.is_staff());

-- Column-scoped, key columns absent from UPDATE — so the writer must be
-- UPDATE-then-INSERT, never .upsert() (PostgREST compiles upsert to
-- ON CONFLICT DO UPDATE SET including the keys, which this grant refuses).
-- 0064's header records this trap after it bit once.
GRANT SELECT ON public.student_subject_qualification TO authenticated;
GRANT INSERT (user_id, subject_id, curriculum_id, is_confirmed)
  ON public.student_subject_qualification TO authenticated;
GRANT UPDATE (curriculum_id, is_confirmed)
  ON public.student_subject_qualification TO authenticated;
-- DELETE is granted deliberately: "I picked the wrong board" must be
-- correctable by the student who picked it. Nothing of record is lost —
-- this table holds a stated preference, not evidence.
GRANT DELETE ON public.student_subject_qualification TO authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.student_subject_qualification FROM anon, authenticated;

COMMIT;

-- ══ SECTION 4 — tuition availability as data (§29) ══════════════════════════
BEGIN;

-- ⚠ §29's DISTINCTION, MADE STRUCTURAL. Platform coverage and live-tuition
-- availability are different facts and must never be inferred from each
-- other. Today `cohorts` (0009) carries only a slug — 'ial-chem-as-sep-2026'
-- — so nothing links a cohort to a curriculum, and the application carries a
-- one-entry TUITION_CURRICULA set instead. This makes the link real.
ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS curriculum_id uuid REFERENCES public.curricula(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id    uuid REFERENCES public.subjects(id)  ON DELETE SET NULL;

UPDATE public.cohorts c
   SET curriculum_id = (SELECT id FROM public.curricula WHERE slug = 'edexcel-ial'),
       subject_id    = (SELECT id FROM public.subjects  WHERE slug = 'chemistry')
 WHERE c.slug LIKE 'ial-chem-%' AND c.curriculum_id IS NULL;

CREATE INDEX IF NOT EXISTS cohorts_curriculum_idx
  ON public.cohorts (curriculum_id) WHERE curriculum_id IS NOT NULL;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.cohorts FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- ERASE_USER v6 — EXECUTABLE, AND IDENTICAL IN ALL FIVE PARKED FILES
-- ============================================================================
-- ⚠ THIS REPLACES THE PROSE THAT USED TO DESCRIBE THIS CHANGE. A comment
--   describing a DELETE does not delete anything, and all five parked files
--   "had" an erase_user extension while shipping no executable DDL for it.
--
-- ⚠ THE PROSE ALSO NAMED VARIABLES THAT DO NOT EXIST. Its draft said
--   `WHERE user_id = p_user_id` and `lower(v_email)`; the live function's
--   variables are `target` and `target_email`. It could never have been
--   pasted in as written — which is what a comment costs and code does not.
--
-- ⚠ DERIVED FROM 0067's DISK TEXT, NOT REWRITTEN. Same method as v4 -> v5.
--   v6 = v5 plus: one behaviour change on interest_registrations, seven
--   guarded DELETEs, eight receipt keys. Everything else is byte identical to
--   what is live today.
--
-- ⚠ WHY THE SAME FUNCTION APPEARS IN ALL FIVE FILES. Each file must be
--   independently applicable, and a function has exactly one definition — so
--   five files each carrying a DIFFERENT v6 would silently overwrite one
--   another, and whichever applied last would erase the other four's
--   coverage. Instead all five carry the SAME text, and every per-table block
--   is guarded by to_regclass. Apply any subset, in any order: the result is
--   the same function, covering exactly the tables that exist.
--   scripts/exam-seed/__tests__/erase-user-v6-parity.test.ts fails if the
--   five copies ever drift apart, and was sabotage-proved by changing one
--   identifier in one copy.
--
-- ⚠ email_columns_scanned STAYS 8. That number is DERIVED at runtime from
--   information_schema — every text column in `public` named email or
--   %_email. Today there are exactly eight: billing_profiles.billing_email,
--   booking_holds.email, cancellation_requests.requested_by_email,
--   cohort_enrolments.email, interest_registrations.email,
--   notification_events.email, private_bookings.email, waitlist.email.
--   No parked file adds a column matching that pattern (verified on
--   executable lines, with the function body excluded — erase_user DECLAREs
--   locals called target_email and v_email that match the same pattern), so
--   0067's gate assertion `<> 8` still holds after any of them applies.
--
-- ⚠ NOT APPLIED. NOT NUMBERED. Planning issues the number; the founder
--   applies. Nothing here has run against any database.
-- ============================================================================

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
  /**
   * ⚠ v6 — THE FIVE PARKED SCHEMAS. Each counter stays 0 unless its table
   * actually exists, so this function is correct on a database where none,
   * some or all of the five parked migrations have been applied.
   */
  interest_by_user     integer := 0;
  purchases_removed_n  integer := 0;
  section_state_gone   integer := 0;
  deck_progress_gone   integer := 0;
  saved_cards_gone     integer := 0;
  qualification_gone   integer := 0;
  saved_resources_gone integer := 0;
  recent_resources_gone integer := 0;
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
  -- v5 (0067) — the staff refusal.
  staff_roles          text[] := ARRAY[]::text[];
BEGIN
  SELECT u.email INTO target_email FROM auth.users u WHERE u.id = target;
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'erase_user: no such user %', target
      USING ERRCODE = 'no_data_found';
  END IF;

  /**
   * ⚠ v5: THE STAFF REFUSAL, FIRST OF ALL — BEFORE EITHER DOOR OPENS.
   * ==========================================================================
   * On 2026-08-22 an erasure verification ran against the ADMIN account: the
   * auth row was deleted, the admin role with it (CASCADE), and every
   * created_by/approved_by attribution went NULL. The teacher and marker
   * checks below refuse when the target OWNS records others depend on; they
   * said nothing about the target holding the keys to the system itself.
   *
   * A staff member is erased by first REVOKING their roles — a deliberate,
   * visible act in user_roles — and only then erasing. The refusal names the
   * roles so the operator knows exactly what to revoke. Same shape, same
   * error code, as the teacher/marker/payer refusals: atomic, first, cheap.
   */
  SELECT coalesce(array_agg(ur.role::text ORDER BY ur.role), ARRAY[]::text[])
    INTO staff_roles
    FROM public.user_roles ur
   WHERE ur.user_id = target
     AND ur.role IN ('teacher', 'marker', 'admin');
  IF array_length(staff_roles, 1) > 0 THEN
    RAISE EXCEPTION
      'erase_user: % holds staff role(s) [%] — REFUSED. Erasing a staff account deletes the roles with it and orphans every created_by/approved_by attribution. Revoke the role(s) in user_roles first — a deliberate act, on the record — then erase. This happened once; it does not happen twice.',
      target_email, array_to_string(staff_roles, ', ')
      USING ERRCODE = 'restrict_violation';
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

  /**
   * ⚠ v6 — AND BY user_id, ONCE _PROPOSED_tuition_subject_interest HAS APPLIED.
   *
   * The email arm above ALREADY reaches the anonymous rows: the funnel writes
   * leads with no account, and matching on the address catches them whether or
   * not a user_id column exists. That half needed no change and has been true
   * since v5 — the parked file's prose claiming otherwise is superseded here.
   *
   * What the user_id column adds is the opposite case: a row LINKED to this
   * account whose `email` is somebody else's. A parent registering interest
   * from the student's signed-in session writes exactly that, and no email
   * match will ever find it. Without this arm those rows survive the erasure,
   * and the email sweep at the foot of this function would not catch them
   * either, because the address in them was never the target's.
   *
   * EXECUTE, not a static DELETE, so the reference to a column that may not
   * exist is never parsed on a database where the parked file has not applied.
   */
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'interest_registrations'
       AND column_name  = 'user_id'
  ) THEN
    EXECUTE 'DELETE FROM public.interest_registrations WHERE user_id = $1' USING target;
    GET DIAGNOSTICS interest_by_user = ROW_COUNT;
    interest_removed := interest_removed + interest_by_user;
  END IF;

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

  /**
   * ==========================================================================
   * ⚠ v6 — THE FIVE PARKED SCHEMAS, EACH GUARDED BY ITS OWN TABLE'S EXISTENCE.
   * ==========================================================================
   * Every one of these columns is `user_id uuid NOT NULL REFERENCES
   * auth.users(id) ON DELETE CASCADE`, so the delete below would remove them
   * anyway. They are named explicitly for the reason this function already
   * gives for the practice tables: a cascade is the quiet kind of coverage,
   * and the receipt must say how many.
   *
   * ⚠ AND EACH IS WRAPPED IN to_regclass SO THIS FUNCTION IS IDENTICAL IN ALL
   * FIVE PARKED FILES. Whichever of them is applied last defines the live
   * function; because the text is byte-identical and every block is guarded,
   * the order they are applied in cannot change the result, and applying one
   * without the other four is safe. erase-user-v6-parity.test.ts fails if the
   * five copies ever drift apart.
   */
  IF to_regclass('public.lesson_section_state') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.lesson_section_state WHERE user_id = $1' USING target;
    GET DIAGNOSTICS section_state_gone = ROW_COUNT;
  END IF;

  IF to_regclass('public.student_deck_progress') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.student_deck_progress WHERE user_id = $1' USING target;
    GET DIAGNOSTICS deck_progress_gone = ROW_COUNT;
  END IF;

  IF to_regclass('public.student_saved_cards') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.student_saved_cards WHERE user_id = $1' USING target;
    GET DIAGNOSTICS saved_cards_gone = ROW_COUNT;
  END IF;

  IF to_regclass('public.student_subject_qualification') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.student_subject_qualification WHERE user_id = $1' USING target;
    GET DIAGNOSTICS qualification_gone = ROW_COUNT;
  END IF;

  IF to_regclass('public.student_saved_resources') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.student_saved_resources WHERE user_id = $1' USING target;
    GET DIAGNOSTICS saved_resources_gone = ROW_COUNT;
  END IF;

  IF to_regclass('public.student_recent_resources') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.student_recent_resources WHERE user_id = $1' USING target;
    GET DIAGNOSTICS recent_resources_gone = ROW_COUNT;
  END IF;

  /**
   * ⚠ stripe_purchases IS DELETED, AND THAT IS NOT THE SAME CALL AS `payments`.
   * This function deliberately does NOT delete `payments` — that is this app's
   * own ledger, with a retention obligation that outlives an erasure request.
   * stripe_purchases is a different thing: a local mirror of records whose
   * system of record is Stripe, which holds them under its own retention
   * rules. _PROPOSED_stripe_purchases makes exactly that argument in its own
   * header — a row with the user nulled out "is a payment nobody can
   * reconcile AND still a record of a transaction, so it fails at both jobs".
   * Deleting here follows the parked file's stated intent rather than
   * overriding it, and Stripe keeps what must be kept.
   */
  IF to_regclass('public.stripe_purchases') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.stripe_purchases WHERE user_id = $1' USING target;
    GET DIAGNOSTICS purchases_removed_n = ROW_COUNT;
  END IF;

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
    'interest_registrations_by_user_id', interest_by_user,
    'lesson_section_state_removed', section_state_gone,
    'student_deck_progress_removed', deck_progress_gone,
    'student_saved_cards_removed', saved_cards_gone,
    'student_subject_qualification_removed', qualification_gone,
    'student_saved_resources_removed', saved_resources_gone,
    'student_recent_resources_removed', recent_resources_gone,
    'stripe_purchases_removed', purchases_removed_n,
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

COMMIT;

-- ══ VERIFICATION (after applying; each should return zero rows) ═════════════
-- SELECT table_name, grantee, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='student_subject_qualification'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
--
-- Boards that failed the CHECK vocabulary (should be none):
-- SELECT slug, exam_board FROM public.curricula
--  WHERE exam_board IS NOT NULL
--    AND exam_board NOT IN ('edexcel','aqa','ocr','cambridge','oxfordaqa');
--
-- ⚠ AND THE ONE THAT PROVES §37: from a real authenticated session, an
-- attempt to write a row for ANOTHER user_id must be refused. If it succeeds,
-- WITH CHECK is missing and a preference table has become a way to write
-- other people's rows.
