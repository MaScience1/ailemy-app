-- ============================================================================
-- _PROPOSED_ — lesson section state, notes, worked examples, exam-question map
-- ----------------------------------------------------------------------------
-- ⚠ NOT APPLIED. NOT NUMBERED. DO NOT RUN THIS FILE AS IT STANDS.
--
-- The number comes from the planning chat and from nowhere else — not from
-- `ls`, not from "highest plus one". The folder currently ends at 0067 and
-- 0062 is parked, but a folder listing cannot show a RESERVATION, and a
-- migration written under a number somebody else has been promised overwrites
-- a live file in the only rebuild path this project has. When the founder
-- issues numbers, this file splits into as many numbered files as they
-- allocate, each renamed from _PROPOSED_ only once it is applied, with the
-- observed verification results written into its header in the same act.
--
-- ⚠ WHY FOUR TABLES AND NOT SIX COLUMNS ON lesson_view_state
-- ----------------------------------------------------------------------------
-- lesson_view_state (0064) is keyed PRIMARY KEY (user_id, lesson_id) — one row
-- per student per lesson. It cannot carry six per-section states. It is also
-- the table whose grants are COLUMN-SCOPED AND ENUMERATED:
--
--     GRANT INSERT (user_id, lesson_id, last_frame_index, deck_version,
--                   slides_visited, slides_completed_at) …
--     GRANT UPDATE (last_frame_index, deck_version, slides_visited,
--                   slides_completed_at) …
--
-- so every column added to it later is NOT covered by those grants and its
-- writes fail 42501 — silently, from the client's point of view, and far from
-- the cause. Adding six completion columns there would mean re-issuing both
-- grants and would still leave one row per lesson trying to describe six
-- things. A section-keyed table is the smaller change and the honest shape.
--
-- ⚠ AND IT IS A ROLLUP, NOT A SECOND EVIDENCE STORE (§26/§91 — no parallel
-- record systems). The EVIDENCE stays where it already lives:
--     slides    → lesson_view_state.slides_visited / .slides_completed_at (0064)
--     practice  → lesson_practice_attempts / _answers (0065)
--     exam      → exam_attempts / question_attempts / marking_results (0028)
-- This table stores only the derived verdict plus a POINTER to the evidence.
-- Nothing here duplicates a mark, a score or an answer.
--
-- ⚠ A COMPLETION FLAG COULD NOT LIVE ON lesson_practice_attempts EVEN IF WE
-- WANTED IT THERE: 0065's refuse_practice_mutation() raises restrict_violation
-- on EVERY UPDATE to that table, including through the erasure GUC door. A
-- flag written there could never be corrected.
-- ============================================================================

-- ══ SECTION 1 — lesson_section_state (the six-section rollup) ═══════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_section_state (
  user_id       uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  lesson_id     uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  -- ⚠ A KEY WITH A CHECK, NOT SIX COLUMNS. A seventh section is then a CHECK
  -- amendment; six columns would be a grant re-issue every time (see header).
  section_key   text NOT NULL,
  status        text NOT NULL DEFAULT 'not_started',
  -- How it completed: the student said so, or the app observed the evidence.
  -- Kept because "auto" and "manual" are different claims and the UI says which.
  source        text,
  first_seen_at timestamptz,
  completed_at  timestamptz,
  -- ⚠ A POINTER, NEVER THE PAYLOAD. {"attempt_id": "…"} or {"slides": 25} —
  -- not marks, not answers, not anything the evidence tables already own.
  evidence_ref  jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lesson_section_state_pk PRIMARY KEY (user_id, lesson_id, section_key),
  CONSTRAINT lesson_section_state_key_check CHECK (
    section_key IN ('video','slides','notes','worked_examples','practice','exam_questions')
  ),
  CONSTRAINT lesson_section_state_status_check CHECK (
    status IN ('not_started','in_progress','complete')
  ),
  CONSTRAINT lesson_section_state_source_check CHECK (
    source IS NULL OR source IN ('manual','auto')
  ),
  -- A complete row without a timestamp is a lie the table can refuse to hold.
  CONSTRAINT lesson_section_state_complete_has_time CHECK (
    status <> 'complete' OR completed_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS lesson_section_state_lesson_idx
  ON public.lesson_section_state (lesson_id);

-- Reuses 0001's function — a second copy would drift from the first.
DROP TRIGGER IF EXISTS touch_lesson_section_state ON public.lesson_section_state;
CREATE TRIGGER touch_lesson_section_state
  BEFORE UPDATE ON public.lesson_section_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.lesson_section_state ENABLE ROW LEVEL SECURITY;

-- ⚠ THE PREDICATE GOES IN BOTH USING AND WITH CHECK. USING alone filters what
-- a student may SEE; without WITH CHECK they may still WRITE a row carrying
-- somebody else's user_id. 0064's policies carry both for this reason.
CREATE POLICY lss_own_read ON public.lesson_section_state
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY lss_own_insert ON public.lesson_section_state
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY lss_own_update ON public.lesson_section_state
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ⚠ STAFF CAN READ, BECAUSE A TEACHER WHO CANNOT SEE PROGRESS CANNOT TEACH.
-- lesson_view_state (0064) has no staff policy and that is why no staff view
-- of deck progress is possible today; 0065's lpa_staff_read is the precedent
-- being followed here rather than the omission.
CREATE POLICY lss_staff_read ON public.lesson_section_state
  FOR SELECT TO authenticated USING (public.is_staff());

-- ⚠ COLUMN-SCOPED, AND THE KEY COLUMNS ARE ABSENT FROM UPDATE ON PURPOSE.
-- That is also why the application writes UPDATE-then-INSERT and never
-- .upsert(): PostgREST compiles upsert to ON CONFLICT DO UPDATE SET including
-- the key columns, which this grant refuses. 0064's header records the same
-- trap after it bit once.
GRANT SELECT ON public.lesson_section_state TO authenticated;
GRANT INSERT (user_id, lesson_id, section_key, status, source, first_seen_at, completed_at, evidence_ref)
  ON public.lesson_section_state TO authenticated;
GRANT UPDATE (status, source, completed_at, evidence_ref)
  ON public.lesson_section_state TO authenticated;

-- ⚠ NO DELETE, DELIBERATELY. There is no "reset my progress" control in the
-- product, and 0021 revoked DELETE on `progress` for exactly this reason. If a
-- restart-lesson feature is ever wanted it gets its own migration and its own
-- decision — not an accidental grant made today.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_section_state FROM anon, authenticated;

COMMIT;

-- ══ SECTION 2 — lesson_notes ═══════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  uuid NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  body_md    text NOT NULL,
  status     text NOT NULL DEFAULT 'draft',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_notes_status_check CHECK (status IN ('draft','published','unavailable'))
);

DROP TRIGGER IF EXISTS touch_lesson_notes ON public.lesson_notes;
CREATE TRIGGER touch_lesson_notes
  BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

-- ⚠ NO CLIENT GRANTS AT ALL — same stance as lesson_decks and
-- lesson_family_status (0064). Notes are teaching material: the admin client
-- writes them, the server reads them and renders them. A student's browser
-- never needs a row from this table, so it never gets the privilege to ask.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_notes FROM anon, authenticated;

COMMIT;

-- ══ SECTION 3 — lesson_worked_examples ═════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_worked_examples (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  sort_order   integer NOT NULL DEFAULT 0,
  title        text NOT NULL DEFAULT '',
  prompt       text NOT NULL,
  -- ⚠ ORDERED STEPS AS jsonb, VALIDATED IN SHAPE HERE AND IN THE READER.
  -- [{"label":"identify the data","body":"…"}, …] — the reveal order IS the
  -- teaching, so it is stored as a sequence, not as free text with headings.
  steps        jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer       text NOT NULL,
  marks        integer,
  spec_code    text,
  review_slide integer,
  status       text NOT NULL DEFAULT 'draft',
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lwe_status_check CHECK (status IN ('draft','published','unavailable')),
  CONSTRAINT lwe_steps_is_array CHECK (jsonb_typeof(steps) = 'array'),
  CONSTRAINT lwe_marks_sane CHECK (marks IS NULL OR marks BETWEEN 0 AND 30)
);

CREATE INDEX IF NOT EXISTS lesson_worked_examples_lesson_idx
  ON public.lesson_worked_examples (lesson_id, sort_order);

DROP TRIGGER IF EXISTS touch_lesson_worked_examples ON public.lesson_worked_examples;
CREATE TRIGGER touch_lesson_worked_examples
  BEFORE UPDATE ON public.lesson_worked_examples
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.lesson_worked_examples ENABLE ROW LEVEL SECURITY;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_worked_examples FROM anon, authenticated;

COMMIT;

-- ══ SECTION 4 — lesson_paper_questions (the lesson ↔ exam question map) ═════
BEGIN;

-- ⚠ A MAP, NOT A QUESTION STORE (§19). The questions stay in paper_questions,
-- where the reviewed marking path already reads them. What is missing is only
-- the link from a lesson to the subset that assesses it.
--
-- ⚠ THE ALTERNATIVE WAS CONSIDERED AND REJECTED FOR A REASON WORTH RECORDING:
-- lesson_spec_points.spec_point_id → spec_points.code could be joined against
-- question_spec_points.spec_code (0035) with no new table at all. Both halves
-- exist. But question_spec_points has ZERO rows, zero readers and zero writers
-- across the whole repository, both codes are free text with no FK and no
-- verified format agreement, and the generated Unit 1 fixture carries 48
-- questions and not one spec point. That route costs no migration and all of
-- the authoring work, on an untested join. An explicit, curatable link table
-- is the honest cost.
CREATE TABLE IF NOT EXISTS public.lesson_paper_questions (
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id)         ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.paper_questions(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_paper_questions_pk PRIMARY KEY (lesson_id, question_id)
);

CREATE INDEX IF NOT EXISTS lesson_paper_questions_lesson_idx
  ON public.lesson_paper_questions (lesson_id, sort_order);

ALTER TABLE public.lesson_paper_questions ENABLE ROW LEVEL SECURITY;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_paper_questions FROM anon, authenticated;

COMMIT;

-- ══ SECTION 4b — flashcard note decks (added 2026-08-23) ═══════════════════
-- ⚠ EXTENDED IN PLACE, NOT WRITTEN AS A THIRD FILE. lesson_notes above is
-- prose notes; this is the CARD format of the same section. Two files both
-- defining "how a lesson stores its notes" is how a rebuild ends up with
-- whichever one happened to run last.
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_card_decks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  subject     text NOT NULL,
  title       text NOT NULL,
  topic       text,
  description text,
  spec_codes  text[] NOT NULL DEFAULT '{}',
  -- ⚠ CARDS AS jsonb, AND THE REASON IS THE CONTENT MODEL, NOT LAZINESS.
  -- A card is an ordered list of typed blocks — definition, formula with its
  -- symbol table, callout, comparison — which relational columns model badly
  -- and a join table models worse. The application type (src/lib/flashcards/
  -- types.ts) is already plain JSON precisely so a deck can be fetched,
  -- cached and stored offline unchanged. Card IDENTITY is not lost: every
  -- card carries its own id inside the array, and saved cards reference it.
  cards       jsonb NOT NULL DEFAULT '[]'::jsonb,
  status      text NOT NULL DEFAULT 'draft',
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lcd_status_check CHECK (status IN ('draft','published','unavailable')),
  CONSTRAINT lcd_subject_check CHECK (subject IN ('chemistry','biology','physics')),
  CONSTRAINT lcd_cards_is_array CHECK (jsonb_typeof(cards) = 'array')
);

DROP TRIGGER IF EXISTS touch_lesson_card_decks ON public.lesson_card_decks;
CREATE TRIGGER touch_lesson_card_decks
  BEFORE UPDATE ON public.lesson_card_decks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.lesson_card_decks ENABLE ROW LEVEL SECURITY;

-- No client grants — same stance as lesson_notes and lesson_decks. Decks are
-- teaching material: the server reads them and renders them, so a student's
-- browser never needs the privilege to ask for one.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_card_decks FROM anon, authenticated;

COMMIT;

-- ══ SECTION 4c — where a student is in a deck, and which cards they kept ════
BEGIN;

-- ⚠ A BOOKMARK, NOT EVIDENCE (§13). This says which card a student stopped
-- on. It is not progress, not performance, and nothing derives a completion
-- from it — lesson_section_state('notes') above is where "notes reviewed"
-- lives, and reaching the last card does NOT set it (§40).
CREATE TABLE IF NOT EXISTS public.student_deck_progress (
  user_id      uuid NOT NULL REFERENCES auth.users(id)             ON DELETE CASCADE,
  deck_id      uuid NOT NULL REFERENCES public.lesson_card_decks(id) ON DELETE CASCADE,
  last_card    integer NOT NULL DEFAULT 0,
  cards_viewed integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sdp_pk PRIMARY KEY (user_id, deck_id),
  CONSTRAINT sdp_last_card_sane CHECK (last_card >= 0),
  CONSTRAINT sdp_viewed_sane CHECK (cards_viewed >= 0)
);

-- ⚠ SAVED CARDS ARE RELATIONAL, THOUGH THE CARDS THEMSELVES ARE jsonb — and
-- that asymmetry is deliberate. §24 wants "revise my weak cards" to be
-- possible later, which means saved cards must be QUERYABLE across decks and
-- joinable against spec points. A jsonb array of saved ids on the profile
-- would have made that a full-table scan forever.
CREATE TABLE IF NOT EXISTS public.student_saved_cards (
  user_id    uuid NOT NULL REFERENCES auth.users(id)               ON DELETE CASCADE,
  deck_id    uuid NOT NULL REFERENCES public.lesson_card_decks(id) ON DELETE CASCADE,
  -- The card's id WITHIN its deck's jsonb array. Not an FK, because the card
  -- is not a row; the deck FK above is what keeps this from outliving it.
  card_id    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssc_pk PRIMARY KEY (user_id, deck_id, card_id),
  CONSTRAINT ssc_card_id_shape CHECK (card_id ~ '^[A-Za-z0-9_-]{1,64}$')
);

CREATE INDEX IF NOT EXISTS ssc_user_idx ON public.student_saved_cards (user_id);

DROP TRIGGER IF EXISTS touch_student_deck_progress ON public.student_deck_progress;
CREATE TRIGGER touch_student_deck_progress
  BEFORE UPDATE ON public.student_deck_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.student_deck_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_saved_cards   ENABLE ROW LEVEL SECURITY;

-- Predicate in BOTH USING and WITH CHECK — USING alone filters what a student
-- SEES while still letting them write a row carrying somebody else's user_id.
CREATE POLICY sdp_own_read   ON public.student_deck_progress
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY sdp_own_insert ON public.student_deck_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY sdp_own_update ON public.student_deck_progress
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY ssc_own_read   ON public.student_saved_cards
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ssc_own_insert ON public.student_saved_cards
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY ssc_own_delete ON public.student_saved_cards
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Column-scoped, key columns absent from UPDATE — so the writer must be
-- UPDATE-then-INSERT, never .upsert() (PostgREST compiles upsert to
-- ON CONFLICT DO UPDATE SET including the keys, which this grant refuses).
GRANT SELECT ON public.student_deck_progress TO authenticated;
GRANT INSERT (user_id, deck_id, last_card, cards_viewed)
  ON public.student_deck_progress TO authenticated;
GRANT UPDATE (last_card, cards_viewed)
  ON public.student_deck_progress TO authenticated;

-- Unstarring must work, so DELETE is granted here where student_deck_progress
-- deliberately has none: a saved card is a choice, a bookmark is a position.
GRANT SELECT, DELETE ON public.student_saved_cards TO authenticated;
GRANT INSERT (user_id, deck_id, card_id) ON public.student_saved_cards TO authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.student_deck_progress FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.student_saved_cards   FROM anon, authenticated;

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

-- ══ VERIFICATION (run after applying; every line should return zero rows) ═══
-- 1. The three privileges no client may hold, on all four new tables:
-- SELECT table_name, grantee, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE table_schema = 'public'
--    AND table_name IN ('lesson_section_state','lesson_notes',
--                       'lesson_worked_examples','lesson_paper_questions')
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
--
-- 2. RLS is on for all four:
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('lesson_section_state','lesson_notes',
--                    'lesson_worked_examples','lesson_paper_questions');
--
-- 3. The three content tables have NO client grants at all:
-- SELECT table_name, grantee, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE table_schema = 'public'
--    AND table_name IN ('lesson_notes','lesson_worked_examples','lesson_paper_questions')
--    AND grantee IN ('anon','authenticated');
--
-- 4. ⚠ THE UPSERT TRAP, PROVEN RATHER THAN ASSUMED. From an authenticated
--    session (not the SQL editor's postgres role, which bypasses all of this):
--    an UPDATE touching section_key must be REFUSED 42501, while
--    UPDATE-then-INSERT succeeds. If that refusal does NOT fire, the grants
--    are wider than this file intends and the application's write shape is
--    resting on nothing.
