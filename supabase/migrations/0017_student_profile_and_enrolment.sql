-- ============================================================================
-- 0017_student_profile_and_enrolment.sql
-- Ailemy — student profile expansion + per-course enrolment grades.
--
-- APPLIED TO PRODUCTION 2026-08-06, by hand via the Supabase SQL Editor.
-- Verified live: all nine new student_courses columns and all ten new profiles
-- columns respond. Do not re-run casually — section 4 rewrites the table under
-- ACCESS EXCLUSIVE. It is re-runnable if you must (every step is guarded), but
-- read section 4 first.
--
-- Decisions incorporated:
--   * Guardians: NO new table. cohort_enrolments.parent_name / parent_contact
--     (0009:62-63) remain the single store for guardian contact.
--   * Resits: the primary key IS relaxed, so a resit creates a separate
--     student_courses row (section 4).
--   * Security: grades a student does not author are not student-writable, and
--     nothing new is hung off the forgeable parent_students link.
--
-- Grades live on the existing student_courses relationship: AS Chemistry and
-- A2 Chemistry are separate courses with separate grades.
--
-- SAFETY. One transaction. Additive and re-runnable throughout, EXCEPT the
-- primary-key relaxation in section 4, which is isolated, pre-flight-checked
-- and separately reversible.
--
-- RUN THIS FIRST — section 4 rewrites the table under ACCESS EXCLUSIVE:
--     SELECT count(*) FROM public.student_courses;
-- ============================================================================

-- Fail fast rather than queue behind a long transaction and stall both apps.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;


-- ============================================================================
-- 1. PROFILES — WHO THE STUDENT IS
-- ============================================================================
-- Only attributes belonging to the PERSON. Per-enrolment values are section 3.
--
-- ⚠ DISCLOSURE, true of every column added here. 0001 defines
--     profiles_parent_read_student ... USING (id IN (SELECT student_id FROM
--       parent_students WHERE parent_id = auth.uid()))
-- which selects ROWS, not columns — so every column below becomes readable by
-- anyone holding a parent_students link. That link is forgeable: 0001's
-- parent_students_insert_own is WITH CHECK (auth.uid() = parent_id OR
-- auth.uid() = student_id) and 0003 grants INSERT to authenticated, so any
-- signed-in user can insert a row naming themselves parent of anyone, with no
-- confirmation step.
--
-- Pre-existing, not introduced here — but this migration widens what leaks
-- through it. PREREQUISITE WORK: add confirmed_at/status to parent_students and
-- require the student to accept the link. That is why date_of_birth is absent.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_band text;

-- Guards test conrelid as well as conname: constraint names are unique per
-- table, not per schema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_age_band_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_age_band_check
      CHECK (age_band IS NULL OR age_band IN
             ('under_13','13_15','16_17','18_plus','prefer_not_to_say'));
  END IF;
END $$;

-- Free text rather than an enum: the honest option set is not closed, and
-- self-described values must fit. The app offers a suggested list.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city        text;

-- IANA zone name, e.g. 'Asia/Qatar'. Not a fixed offset: offsets change with
-- daylight saving, so '+03:00' silently rots.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_name text;

-- --- Curriculum preference (FK, replacing the proposed free-text exam_board)-
-- Named curriculum_id, NOT exam_board_id: curricula does not contain exam
-- boards. Its 11 rows are mostly board+qualification pairs — Edexcel appears
-- four times (IAL, IGCSE, A-Level, GCSE), AQA twice (A-Level, GCSE) —
-- alongside board-less qualifications such as International Baccalaureate
-- Diploma and Advanced Placement.
--
-- A DEFAULT/PREFERENCE, not the source of truth: real curricula are derivable
-- via student_courses -> courses.curriculum_id, which already exists. This
-- exists so the catalogue can open on the right qualification before the
-- student has enrolled on anything.
--
-- Adding this FK takes SHARE ROW EXCLUSIVE on curricula, briefly blocking
-- writes to it. Harmless — curricula is written only by admin tooling.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS curriculum_id uuid
  REFERENCES public.curricula(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_curriculum
  ON public.profiles (curriculum_id) WHERE curriculum_id IS NOT NULL;

-- NOT ADDED, deliberately:
--   date_of_birth       — see the disclosure note above; age_band supersedes it.
--   qualification_level — duplicates courses.level / courses.pathway, and one
--                         profile value cannot describe a student taking GCSE
--                         and AS at once.
--   year_group, exam_session — section 3; they vary per enrolment.
--   parent_*            — guardian contact stays on cohort_enrolments.


-- ============================================================================
-- 2. PROFILES — APP SETTINGS
-- ============================================================================
-- The only columns with defaults: a setting always has an effective value,
-- because the app must render something before the user has chosen.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';       -- BCP 47

-- ISO 3166-1 alpha-2. Nullable: unlike language there is no sane default, and
-- guessing is worse than not knowing.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region text;

-- Constrained, unlike gender: this set genuinely is closed and the app branches
-- exhaustively on it, so an unexpected value is a rendering bug rather than a
-- person the schema failed to represent.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_theme_preference_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_theme_preference_check
      CHECK (theme_preference IN ('light','dark','system'));
  END IF;
END $$;

-- JSONB is right HERE and wrong for grades: an open-ended bag of booleans,
-- always read and written whole, never queried across users, expected to gain
-- keys without a migration. Nothing joins to it, nothing aggregates it.
--   { "email": { "marking": true }, "push": { "marking": false },
--     "quiet_hours": { "start": "22:00", "end": "07:00" } }
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;


-- ============================================================================
-- 3. STUDENT_COURSES — ENROLMENT CONTEXT, GRADES, LIFECYCLE
-- ============================================================================
-- Extended in place. No parallel enrolment table: student_courses already IS
-- the student<->course relationship, with RLS from 0001 and grants from 0003.
-- student_id, course_id and enrolled_at are untouched.

-- --- 3a. Enrolment context --------------------------------------------------
-- 'Year 12', 'Grade 11', 'Private candidate'. Text, not int: Year 12 / Grade 11
-- / Lower Sixth are the same thing in different systems, and an int forces a
-- lossy mapping. Nullable so private candidates need not invent one.
ALTER TABLE public.student_courses
  ADD COLUMN IF NOT EXISTS year_group text;

-- exam_session and academic_year are NOT NULL DEFAULT '' — deliberately, and
-- unlike every other new column here. Both reasons concern the uniqueness key
-- in section 4:
--
--   1. A key built on COALESCE(col,'') is an EXPRESSION index. Postgres infers
--      an ON CONFLICT arbiter only from an exact column/expression match, and
--      PostgREST's on_conflict= parameter accepts column NAMES only. An
--      expression key therefore makes upsert unreachable from both apps.
--   2. With nullable columns, '' and NULL are two spellings of "not specified"
--      that a unique key treats as different rows.
--
-- '' means "not specified". Existing rows all take '', so uniqueness collapses
-- to the old (student_id, course_id) rule — nothing unique before becomes
-- duplicable after.
--
-- TYPE DECISION: text, not a foreign key. There is no session lookup table in
-- this database — I probed exam_sessions, sessions, exam_series, series,
-- sittings and assessment_sessions and all return PGRST205 (absent). The
-- existing schema models a sitting as free text: past_papers.session is
-- `text NOT NULL` (0007:27) holding 'January', 'May-June', 'October-November'.
-- Use the SAME vocabulary here; academic_year supplies the year, so the two
-- fields are complementary rather than redundant. If a sessions table is
-- introduced later, this becomes a FK in its own migration.
ALTER TABLE public.student_courses
  ADD COLUMN IF NOT EXISTS exam_session text NOT NULL DEFAULT '';

-- '2026/27'. Distinct from exam_session: a January 2027 and a May-June 2027
-- sitting share academic year 2026/27. This is the field that rolls over each
-- September.
ALTER TABLE public.student_courses
  ADD COLUMN IF NOT EXISTS academic_year text NOT NULL DEFAULT '';

-- --- 3b. Grades -------------------------------------------------------------
-- All free text: the valid set depends on qualification (A*–U for A-level, 9–1
-- for GCSE, 7–1 for IB, 5–1 for AP). One enum cannot cover them, and one enum
-- per system would mean the column's type depends on a value in another table,
-- which Postgres cannot express. Validation belongs in the app, where the
-- course's curriculum is known.
--
-- AUTHORSHIP DIFFERS PER COLUMN, and section 5 grants accordingly:
--   target_grade          — the student's own aspiration.  Student-writable.
--   current_working_grade — a teacher's assessment.        NOT student-writable.
--   predicted_grade       — teacher/centre issued.         NOT student-writable.
--   final_grade           — exam board issued.             NOT student-writable.
ALTER TABLE public.student_courses ADD COLUMN IF NOT EXISTS target_grade          text;
ALTER TABLE public.student_courses ADD COLUMN IF NOT EXISTS current_working_grade text;
ALTER TABLE public.student_courses ADD COLUMN IF NOT EXISTS predicted_grade       text;
ALTER TABLE public.student_courses ADD COLUMN IF NOT EXISTS final_grade           text;

-- --- 3c. Lifecycle ----------------------------------------------------------
-- text + CHECK rather than a Postgres enum, matching cohort_enrolments.status
-- in 0009. Adding a value later is a CHECK swap inside one migration rather
-- than an ALTER TYPE with its transaction restrictions.
--
-- DEFAULT 'active' so existing rows — created by a student enrolling, with no
-- other plausible reading — stay correct without a backfill.
ALTER TABLE public.student_courses
  ADD COLUMN IF NOT EXISTS enrollment_status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_courses_enrollment_status_check'
      AND conrelid = 'public.student_courses'::regclass
  ) THEN
    ALTER TABLE public.student_courses
      ADD CONSTRAINT student_courses_enrollment_status_check
      CHECK (enrollment_status IN ('planned','active','completed','withdrawn'));
  END IF;
END $$;

ALTER TABLE public.student_courses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- BACKFILL. Seed updated_at from the row's own history rather than leaving
-- every pre-existing enrolment claiming it was modified at migration time.
-- Runs BEFORE the trigger is created, so the two do not fight. Idempotent:
-- only touches rows still carrying the migration stamp.
UPDATE public.student_courses
   SET updated_at = enrolled_at
 WHERE enrolled_at IS NOT NULL
   AND updated_at > enrolled_at;

DROP TRIGGER IF EXISTS touch_student_courses ON public.student_courses;
CREATE TRIGGER touch_student_courses
  BEFORE UPDATE ON public.student_courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ============================================================================
-- 4. RESITS — RELAXING THE PRIMARY KEY
-- ============================================================================
-- THE ONE NON-ADDITIVE CHANGE IN THIS FILE.
--
-- student_courses is PRIMARY KEY (student_id, course_id): exactly one enrolment
-- per student per course, forever. Resits and repeat sittings are therefore
-- unrepresentable. Per your decision, a resit creates a SEPARATE row.
--
-- The change: add a surrogate id, drop the composite PK, re-assert uniqueness
-- one level looser — one enrolment per (student, course, academic_year,
-- exam_session). exam_session is in the key because a January and a May-June
-- sitting share an academic year; keying on academic_year alone would forbid
-- exactly the within-year resit this section exists to allow.
--
-- ⚠ THIS REWRITES THE TABLE. gen_random_uuid() is VOLATILE, so the PG11+
-- fast-default optimisation does NOT apply: the ADD COLUMN below rewrites the
-- whole heap under ACCESS EXCLUSIVE, blocking reads and writes for its
-- duration. That is not incidental — per-row evaluation is what gives each row
-- a distinct UUID, without which PRIMARY KEY (id) could not be created. Every
-- other ADD COLUMN in this file uses a non-volatile default and is a
-- catalogue-only metadata change.

-- --- 4a. PRE-FLIGHT: prove the new key holds BEFORE touching the old one ----
-- Runs before any constraint is dropped, so a violation aborts the whole
-- transaction with the table still intact rather than failing halfway.
--
-- Under the current composite PK this cannot fail on a first run: every row is
-- unique on (student_id, course_id) and both new columns default to ''. It
-- exists for the re-run and drifted cases — if a previous partial application
-- left the PK already relaxed, real duplicates may exist, and CREATE UNIQUE
-- INDEX would otherwise fail after the PK had been dropped.
DO $$
DECLARE
  dupe_count int;
  sample     text;
BEGIN
  SELECT count(*), COALESCE(string_agg(detail, '; '), '')
    INTO dupe_count, sample
  FROM (
    SELECT format('student=%s course=%s year=%s session=%s (x%s)',
                  student_id, course_id, academic_year, exam_session, count(*)) AS detail
    FROM public.student_courses
    GROUP BY student_id, course_id, academic_year, exam_session
    HAVING count(*) > 1
    LIMIT 5
  ) d;

  IF dupe_count > 0 THEN
    RAISE EXCEPTION
      'ABORTING: % duplicate enrolment group(s) violate the intended key '
      '(student_id, course_id, academic_year, exam_session). No changes made. '
      'Examples: %. Resolve these rows, then re-run.',
      dupe_count, sample;
  END IF;
END $$;

-- --- 4b. Surrogate key ------------------------------------------------------
ALTER TABLE public.student_courses
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

DO $$
DECLARE
  pk_cols int;
BEGIN
  SELECT array_length(conkey, 1) INTO pk_cols
  FROM pg_constraint
  WHERE conrelid = 'public.student_courses'::regclass AND contype = 'p';

  IF pk_cols IS NULL THEN
    -- No primary key at all: an interrupted earlier run, or drift. Repair
    -- rather than silently skip.
    ALTER TABLE public.student_courses
      ADD CONSTRAINT student_courses_pkey PRIMARY KEY (id);
  ELSIF pk_cols = 2 THEN
    -- The original composite key. Replace it.
    ALTER TABLE public.student_courses DROP CONSTRAINT student_courses_pkey;
    ALTER TABLE public.student_courses
      ADD CONSTRAINT student_courses_pkey PRIMARY KEY (id);
  END IF;
  -- pk_cols = 1: already migrated. Nothing to do.
END $$;

-- Dropping the composite PK removes the NOT NULL it implied. Re-assert both
-- explicitly rather than rely on version-dependent behaviour.
ALTER TABLE public.student_courses ALTER COLUMN student_id SET NOT NULL;
ALTER TABLE public.student_courses ALTER COLUMN course_id  SET NOT NULL;

-- --- 4c. The replacement uniqueness guarantee -------------------------------
-- Plain columns, not expressions, so ON CONFLICT and PostgREST's on_conflict=
-- can both infer it. Existing rows (academic_year='' and exam_session='')
-- collapse to the old (student_id, course_id) rule.
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_courses_enrolment
  ON public.student_courses (student_id, course_id, academic_year, exam_session);

-- --- 4d. Indexes ------------------------------------------------------------
-- No standalone (student_id) index: uq_student_courses_enrolment leads with it,
-- and Postgres uses a leading-column prefix for the "this student's enrolments"
-- access path. course_id is genuinely uncovered.
CREATE INDEX IF NOT EXISTS idx_student_courses_course
  ON public.student_courses (course_id);


-- ============================================================================
-- 5. THE MISSING UPDATE PATH — GRANTED PER COLUMN
-- ============================================================================
-- WITHOUT THIS SECTION EVERY COLUMN ADDED IN SECTION 3 IS READ-ONLY FOREVER.
--
-- 0001 gave student_courses only SELECT/INSERT/DELETE policies; 0003 granted
-- only SELECT/INSERT/DELETE. There is no UPDATE path at all, because until now
-- the table held nothing a student could change. Postgres checks the GRANT
-- before RLS, so no policy can rescue a missing grant — the identical fault
-- 0009 shipped with and 0014 had to repair. It surfaces as an opaque
-- "permission denied for table student_courses" long after this looks fine.
--
-- COLUMN-LEVEL, NOT TABLE-WIDE. RLS filters ROWS and never COLUMNS, so a
-- table-wide GRANT UPDATE would let a student set any value in their own row:
-- self-award final_grade or predicted_grade, or rewrite course_id to point the
-- enrolment at a different course. Only genuinely student-owned columns are
-- granted.
GRANT UPDATE (year_group, exam_session, academic_year, target_grade, enrollment_status)
  ON public.student_courses TO authenticated;

-- current_working_grade, predicted_grade and final_grade are deliberately NOT
-- granted: teacher, centre or board issued. Writable today only by service_role
-- (0014). A staff write path should reuse public.is_staff() from 0009 rather
-- than invent a second admin signal.

-- WITH CHECK is spelled out rather than relying on Postgres reusing USING as
-- the check when WITH CHECK is absent. The fallback would be correct here;
-- stating both makes the intent legible and survives a later edit that narrows
-- USING for visibility without meaning to narrow what may be written.
DROP POLICY IF EXISTS student_courses_update_own ON public.student_courses;
CREATE POLICY student_courses_update_own
  ON public.student_courses
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- The three 0001 policies (read_own, insert_own, delete_own) are untouched.
-- They carry no TO clause and so apply to PUBLIC; this one is scoped TO
-- authenticated. Deliberate and harmless — anon holds no privilege on this
-- table — recorded so it does not read as an oversight later.

-- Restated for legibility; ADD COLUMN inherits table privileges, so the new
-- profiles columns are already covered by 0003. Idempotent.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Deliberately NO grant to anon anywhere in this migration.

-- ⚠ OPTIONAL HARDENING — NOT ENABLED, out of scope by design.
-- profiles' table-wide UPDATE grant lets a client write ANY column of its own
-- row, including role and founding_member. No policy consults profiles.role
-- today (staff identity is is_staff(), by email), so this is latent rather than
-- live — but it becomes a real escalation path the moment anything reads that
-- column. Enabling it is a behaviour change that could break an existing
-- client, so it belongs in its own migration:
--
--   REVOKE UPDATE ON public.profiles FROM authenticated;
--   GRANT UPDATE (full_name, country, age_band, gender, city, timezone,
--                 school_name, curriculum_id, language, region,
--                 theme_preference, notification_preferences)
--     ON public.profiles TO authenticated;


-- ============================================================================
-- 6. GUARDIAN CONTACT — NO NEW TABLE, BY DECISION
-- ============================================================================
-- Guardian details stay on public.cohort_enrolments.parent_name and
-- .parent_contact (0009:62-63, "WhatsApp for the fortnightly note"). No
-- student_guardians table is created and no guardian columns are added to
-- profiles, so this migration introduces no new store for third-party PII.
--
-- Two consequences worth recording:
--   * Guardian contact remains COHORT-SCOPED. A student with no
--     cohort_enrolments row has nowhere to record a guardian. When a
--     non-cohort need appears, that is the moment to revisit — not now.
--   * Existing RLS on cohort_enrolments already governs this data
--     ("own enrolment" plus is_staff()), so nothing here widens access.
--
-- No parent-read policy is added anywhere in this migration, deliberately: the
-- parent_students link is forgeable (see the disclosure note in section 1), so
-- hanging any new read path off it would be a self-service disclosure route.


-- ============================================================================
-- 7. COMMENTS — intent that survives into \d output
-- ============================================================================
COMMENT ON COLUMN public.profiles.curriculum_id IS
  'Preferred curriculum (board+qualification, e.g. Edexcel IAL). A catalogue default, NOT the source of truth — real curricula come via student_courses -> courses.curriculum_id.';
COMMENT ON COLUMN public.profiles.age_band IS
  'Preferred over date_of_birth, which is deliberately absent. Answers safeguarding questions without storing a precise identifier.';
COMMENT ON COLUMN public.profiles.timezone IS
  'IANA zone name, e.g. Asia/Qatar. Not a fixed UTC offset — offsets change with DST.';
COMMENT ON COLUMN public.student_courses.exam_session IS
  'Sitting name, same vocabulary as past_papers.session: January, May-June, October-November. Empty string means not specified. NOT NULL so the enrolment uniqueness index stays ON CONFLICT-inferable.';
COMMENT ON COLUMN public.student_courses.academic_year IS
  'e.g. 2026/27. Rolls over each September. Empty string means not specified. Complements exam_session, which carries no year.';
COMMENT ON COLUMN public.student_courses.current_working_grade IS
  'Teacher assessment of present performance. Distinct from predicted_grade (forecast outcome). Not student-writable.';
COMMENT ON COLUMN public.student_courses.final_grade IS
  'Awarded by the exam board. Not student-writable; service_role only until a staff write path exists.';
COMMENT ON INDEX public.uq_student_courses_enrolment IS
  'Replaces PRIMARY KEY (student_id, course_id). One enrolment per student per course per academic year per sitting, so a resit is a separate row.';

COMMIT;

-- PostgREST serves from a cached schema. Without this, both apps see PGRST204
-- ("column does not exist in the schema cache") for every new column. Supabase
-- usually reloads via an event trigger, but that is platform behaviour this
-- migration does not control.
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 8. POST-APPLY VERIFICATION (read-only — run after COMMIT)
-- ============================================================================
-- Primary key is now the surrogate id:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'public.student_courses'::regclass AND contype = 'p';
--
-- Uniqueness index exists, on plain columns (therefore inferable):
--   SELECT indexdef FROM pg_indexes
--    WHERE tablename = 'student_courses' AND indexname = 'uq_student_courses_enrolment';
--
-- All three CHECK constraints landed on the right relations:
--   SELECT conrelid::regclass, conname FROM pg_constraint
--    WHERE conname IN ('profiles_age_band_check','profiles_theme_preference_check',
--                      'student_courses_enrollment_status_check');
--
-- Column UPDATE grants are exactly the five intended — and crucially do NOT
-- include predicted_grade, current_working_grade or final_grade:
--   SELECT column_name FROM information_schema.column_privileges
--    WHERE table_name = 'student_courses' AND grantee = 'authenticated'
--      AND privilege_type = 'UPDATE' ORDER BY column_name;
--
-- No enrolment claims a fabricated modification time:
--   SELECT count(*) FROM public.student_courses WHERE updated_at > enrolled_at;
--
-- No guardian table was created:
--   SELECT to_regclass('public.student_guardians');   -- expect NULL


-- ============================================================================
-- 9. ROLLBACK
-- ============================================================================
-- LOCKING AND REWRITE SUMMARY — what each step costs:
--   * All ADD COLUMNs on profiles and student_courses take ACCESS EXCLUSIVE
--     briefly but are catalogue-only metadata changes: their defaults are
--     non-volatile (literals, or now(), which is STABLE). No heap rewrite.
--   * EXCEPT section 4b's `id uuid NOT NULL DEFAULT gen_random_uuid()`. That
--     default is VOLATILE, so it REWRITES THE ENTIRE HEAP under ACCESS
--     EXCLUSIVE. This is the only rewriting statement in the file.
--   * DROP/ADD CONSTRAINT ... PRIMARY KEY takes ACCESS EXCLUSIVE and builds an
--     index; it does not rewrite.
--   * CREATE UNIQUE INDEX (non-concurrent) takes SHARE, blocking writes but not
--     reads, for the duration of the build.
--   * The curriculum_id FK takes SHARE ROW EXCLUSIVE on curricula.
--   * lock_timeout = 5s means any of these aborts rather than queues.
--
-- ⚠ ROLLBACK ORDER MATTERS, and not in the obvious way. DROP COLUMN
-- academic_year auto-drops uq_student_courses_enrolment with it — Postgres
-- removes the whole index, no CASCADE needed and no error raised. Drop the
-- columns first and the duplicate check below runs against a table that has
-- already lost every uniqueness guarantee, while the DROP INDEX afterwards is a
-- silent no-op. So: CHECK AND RESTORE THE KEY FIRST, DROP COLUMNS LAST.
--
-- STEP 1 — can the composite key be restored at all?
--   SELECT student_id, course_id, count(*)
--   FROM public.student_courses GROUP BY 1,2 HAVING count(*) > 1;
--
--   Rows returned => students hold multiple enrolments on one course: exactly
--   the resits this migration exists to allow. STOP. Rolling back now means
--   choosing which enrolment to destroy, which is a data decision and not a
--   migration step. Decide that first, separately.
--
-- STEP 2 — restore the original uniqueness constraint (only if step 1 was empty):
--   BEGIN;
--   ALTER TABLE public.student_courses DROP CONSTRAINT student_courses_pkey;
--   ALTER TABLE public.student_courses
--     ADD CONSTRAINT student_courses_pkey PRIMARY KEY (student_id, course_id);
--   DROP INDEX IF EXISTS public.uq_student_courses_enrolment;
--   ALTER TABLE public.student_courses DROP COLUMN IF EXISTS id;
--   COMMIT;
--
--   (Re-adding the composite PK re-implies NOT NULL on both columns, so the
--   explicit SET NOT NULL from 4b needs no undoing.)
--
-- STEP 3 — the additive parts. DROP THE TRIGGER BEFORE THE COLUMN: it is
-- declared BEFORE UPDATE ON, not BEFORE UPDATE OF, so it carries no column
-- dependency and survives DROP COLUMN updated_at. Left behind, it makes every
-- subsequent row-level UPDATE fail with `record "new" has no field
-- "updated_at"` — and service_role, which bypasses RLS, can update this table,
-- so that is a real regression rather than a theoretical one.
--   BEGIN;
--   DROP TRIGGER IF EXISTS touch_student_courses ON public.student_courses;
--   DROP POLICY  IF EXISTS student_courses_update_own ON public.student_courses;
--   REVOKE UPDATE (year_group, exam_session, academic_year, target_grade,
--                  enrollment_status) ON public.student_courses FROM authenticated;
--   ALTER TABLE public.student_courses
--     DROP COLUMN IF EXISTS year_group,            DROP COLUMN IF EXISTS exam_session,
--     DROP COLUMN IF EXISTS academic_year,         DROP COLUMN IF EXISTS target_grade,
--     DROP COLUMN IF EXISTS current_working_grade, DROP COLUMN IF EXISTS predicted_grade,
--     DROP COLUMN IF EXISTS final_grade,           DROP COLUMN IF EXISTS enrollment_status,
--     DROP COLUMN IF EXISTS updated_at;
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS age_band,    DROP COLUMN IF EXISTS gender,
--     DROP COLUMN IF EXISTS city,        DROP COLUMN IF EXISTS timezone,
--     DROP COLUMN IF EXISTS school_name, DROP COLUMN IF EXISTS curriculum_id,
--     DROP COLUMN IF EXISTS language,    DROP COLUMN IF EXISTS region,
--     DROP COLUMN IF EXISTS theme_preference,
--     DROP COLUMN IF EXISTS notification_preferences;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';
--
--   (CHECK constraints and the partial index on curriculum_id drop with their
--   columns. updated_at's seeded values cannot be "restored" — the column
--   itself is new, so there is nothing underneath it.)
--
-- Nothing in section 6 needs rolling back: no guardian object was created.


-- ============================================================================
-- 10. ASSUMPTIONS — please confirm or correct
--
-- 1. UNIQUENESS IS (student_id, course_id, academic_year, exam_session), which
--    matches your expectation. It allows a January and a May-June resit within
--    one academic year. If a student can legitimately hold TWO enrolments on
--    the same course in the SAME sitting, the key needs an attempt number.
--
-- 2. exam_session IS TEXT, NOT A FOREIGN KEY. No session lookup table exists
--    (exam_sessions, sessions, exam_series, series, sittings and
--    assessment_sessions all absent), and the existing schema models a sitting
--    as free text at past_papers.session (0007:27). Use the same vocabulary.
--    If you want a sessions table, that is its own migration and this column
--    becomes a FK then.
--
-- 3. '' RATHER THAN NULL for academic_year and exam_session, to keep the
--    uniqueness index ON CONFLICT-inferable and to avoid ''/NULL being two
--    spellings of "not specified". Revert both to nullable if you prefer NULL
--    semantics and can live without upsert on this table.
--
-- 4. GRADES ARE FREE TEXT, validated in the app. A grade_scale lookup keyed off
--    the course's curriculum is more correct and more work.
--
-- 5. ONLY target_grade IS STUDENT-WRITABLE among the four grades, per your
--    instruction that students must not modify awarded or predicted grades.
--    current_working_grade is included in that restriction on the grounds that
--    it is a teacher's assessment; say so if students should self-report it.
--
-- 6. enrollment_status DEFAULTS TO 'active' for existing rows, avoiding a
--    backfill. Values: planned, active, completed, withdrawn.
--
-- 7. date_of_birth IS NOT ADDED — age_band only, per data minimisation and
--    because profiles_parent_read_student would expose it through a forgeable
--    parent link.
--
-- 8. NO STAFF READ/WRITE POLICY was added. Staff have no policy granting access
--    to student data outside the cohort tables; inventing one here would be a
--    security decision made by accident. The three non-student-writable grades
--    are service_role-only until that path is designed.
-- ============================================================================
