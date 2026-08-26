-- ============================================================================
-- ENROLMENT REHEARSAL — muhammed1993@hotmail.co.uk onto the AS cohort
-- ============================================================================
-- Written 2026-08-27. Onboarding is Sun 13 September, 17 days out.
-- Author holds no database credentials. NOTHING in this file has been run.
-- Every number below is stated as an EXPECTATION, never as an observation.
--
-- ⚠ RUN ONE SECTION AT A TIME. Read the result before running the next.
--    A long paste into the Supabase SQL Editor has silently applied only part
--    of itself on this project before (0029-0035). Each section below is
--    self-contained and repeats its own inputs, so there is nothing to scroll
--    back for and no section depends on a variable set by another.
--
-- ⚠ THIS REHEARSAL IS VISIBLE ON THE PUBLIC SITE WHILE IT IS RUNNING.
--    Section 5 inserts a row that is deliberately PAID and ACTIVE, because
--    that is the only kind the seat counter counts. From the moment it lands
--    until Section 10 removes it, ailemy.com/tuition shows the AS cohort as
--    "1 of 20 places taken" instead of "0 of 20". That is the proof the
--    rehearsal exists to produce, and it is also a real change to what a real
--    visitor sees. Do the whole thing in one sitting.
--
-- ============================================================================
-- WHAT A RIGHT-REASON RED LOOKS LIKE  (the rehearsal worked; stop and read)
-- ============================================================================
--   Section 1 returns is_public = false
--       You are on 'ial-chem-as-sep-2026', the 2009 12-week intensive. It is a
--       different product and the seat counter ignores it. Fix the slug.
--   Section 1 returns profiles_found = 0
--       The student has no profiles row. student_courses.student_id references
--       profiles, so Section 6 would fail on a foreign key. Have them sign in
--       once first.
--   Section 5 returns 0 rows
--       The guard fired: this user already holds an enrolment somewhere. That
--       is the /intensive breakage this file exists to prevent. Investigate
--       before forcing anything.
--   Section 6 raises 23503 (foreign key violation) on student_id
--       Same cause as profiles_found = 0. Right reason, later stop.
--   Section 9 returns the same number as Section 2
--       The row landed but is not countable: amount_pence is NULL or <= 0, or
--       stripe_ref is NULL, or the cohort is not public. All four conditions
--       are required together (0063).
--
-- ============================================================================
-- WHAT A WRONG-REASON RED LOOKS LIKE  (the rehearsal proved nothing; fix it)
-- ============================================================================
--   42501  permission denied            — not running as postgres/owner.
--   42P01  relation does not exist      — wrong project or wrong schema.
--   42883  function does not exist      — cohort_seats_taken absent, so 0063
--                                         was never applied. Sections 2 and 9
--                                         are meaningless until it is.
--   23505  duplicate key on the id      — a PREVIOUS rehearsal was not torn
--                                         down. Run Section 10 first, then
--                                         start again. This is fail-closed and
--                                         it is working as intended.
--   22P02  invalid input syntax for uuid — a literal below was edited. Don't.
--
-- ============================================================================
-- FACTS THIS FILE IS BUILT ON — all read from the repository, none from memory
-- ============================================================================
--   cohort_enrolments.user_id   -> auth.users(id)         0009:56
--   student_courses.student_id  -> profiles(id)            0001:137
--   profiles.id                 -> auth.users(id)          0001:119
--       So the two ids carry the SAME value — but they are reached by
--       different routes and only one of them fails loudly when the profile is
--       missing. Section 1 resolves through profiles for that reason.
--
--   is_enrolled(p_cohort)       0009:80 — SECURITY DEFINER, and its predicate
--       accepts status IN ('paid','active','completed'), matched on auth.uid().
--   cohort_seats_taken(slug)    0063:73 — requires ALL of:
--       c.is_public IS TRUE, e.status = 'active',
--       e.amount_pence IS NOT NULL, e.amount_pence > 0, e.stripe_ref IS NOT NULL
--
--   ⚠ WHY status = 'active' AND NOT THE 'paid' DEFAULT, STATED PRECISELY.
--     'paid' WOULD satisfy is_enrolled() and /intensive — both accept it. It
--     would NOT satisfy the seat counter, which tests status = 'active'
--     exactly. So 'paid' produces a student with working access and a seat
--     count that never moves: half-right, and the half that is wrong is the
--     half nobody looks at. 'active' is the only value all three agree on.
--
--   /intensive reads cohort_enrolments filtered ONLY on user_id, with
--       .maybeSingle() and NO cohort filter (src/lib/intensive/enrolment.ts:49).
--       A second enrolment row for this user — on ANY cohort — makes that call
--       return an error, which the reader turns into state: "pending". The
--       student loses access and nothing logs an error. Section 5 guards it.
--       Note the table's own UNIQUE (cohort_id, email) does NOT cover this: it
--       permits a second row on a DIFFERENT cohort, which is the breaking case.
--
--   "My courses" reads student_courses joined to courses with an INNER join,
--       filtered on student_id alone (src/lib/account/profile-reader.ts:99-108).
--       enrollment_status is SELECTED but not filtered on, so its 'active'
--       default is sufficient.
--
-- ============================================================================
-- THE TWO IDs ARE FIXED LITERALS, DELIBERATELY
-- ============================================================================
-- Both inserted rows carry an id chosen here rather than a generated default.
-- That is what lets Section 10 delete BY ID with no captured value to copy
-- across, no "newest row" heuristic, and no possibility of removing somebody
-- else's enrolment. This project has erased the wrong account once already by
-- defaulting a destructive block to "the newest user".
--
--   ae000000-0000-4000-8000-000000000001   the cohort_enrolments row
--   ae000000-0000-4000-8000-000000000002   the student_courses row
--
-- If a rehearsal is abandoned half-way, Section 10 is safe to run on its own
-- and safe to run twice.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — PREFLIGHT. Read all five columns before going on.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT exactly one row:
--   slug         = ial-chemistry-as-sep-2026
--   title        = Edexcel IAL Chemistry AS   (or whatever it now reads)
--   is_public    = true                        ⚠ if false, WRONG SLUG
--   seat_cap     = 20
--   users_found  = 1
--   profiles_found = 1
--
-- ⚠ THE TWO SLUGS ARE FIVE CHARACTERS APART AND BOTH EXIST. This section
--    returns BOTH so the difference is on screen rather than in your memory.
--    The wrong one is not an error — it is a real cohort, and enrolling onto
--    it would look like it worked.

SELECT c.slug,
       c.title,
       c.is_public,
       c.seat_cap,
       (SELECT count(*) FROM auth.users  u WHERE lower(btrim(u.email)) = 'muhammed1993@hotmail.co.uk') AS users_found,
       (SELECT count(*) FROM public.profiles p
          JOIN auth.users u2 ON u2.id = p.id
         WHERE lower(btrim(u2.email)) = 'muhammed1993@hotmail.co.uk')                                  AS profiles_found
  FROM public.cohorts c
 WHERE c.slug IN ('ial-chemistry-as-sep-2026', 'ial-chem-as-sep-2026')
 ORDER BY c.slug;

-- ⚠ TWO ROWS COME BACK. 'ial-chem-as-sep-2026' should read is_public = false.
--   You want the row whose slug is the LONGER one. Read it twice.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — THE COURSE ROW'S TARGET. Must return exactly one row.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: one row, slug = edexcel-ial-as-chemistry.
--
-- ⚠ THIS CANNOT BE DERIVED FROM THE COHORT. `cohorts` has no course_id column,
--    so nothing in the database links the AS cohort to the AS course. It is a
--    separate fact and it is stated here rather than inferred.

SELECT id, slug, name, level, status
  FROM public.courses
 WHERE slug = 'edexcel-ial-as-chemistry';


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — SEAT COUNTER, BEFORE. Write the number down.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: 0, if no paid seat has been sold yet.
-- Whatever it returns, Section 9 must return exactly this number PLUS ONE.

SELECT public.cohort_seats_taken('ial-chemistry-as-sep-2026') AS seats_taken_before;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — NEGATIVE CONTROL, BEFORE. Both must be false / 0.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: is_enrolled_would_return = false, courses_rows = 0.
--
-- ⚠ THE PREDICATE IS EVALUATED WITH THE STUDENT'S ID SUBSTITUTED, NOT BY
--    CALLING is_enrolled(). The function matches on auth.uid(), which is NULL
--    for the postgres role in the SQL Editor — so calling it here returns false
--    no matter what the data says, and a false would prove nothing. This is the
--    same query body from 0009:80 with e.user_id compared to the student's id.

SELECT
  EXISTS (
    SELECT 1
      FROM public.cohort_enrolments e
      JOIN public.cohorts c   ON c.id = e.cohort_id
      JOIN auth.users     u   ON u.id = e.user_id
     WHERE c.slug = 'ial-chemistry-as-sep-2026'
       AND lower(btrim(u.email)) = 'muhammed1993@hotmail.co.uk'
       AND e.status IN ('paid','active','completed')
  ) AS is_enrolled_would_return,
  (SELECT count(*)
     FROM public.student_courses sc
     JOIN public.profiles p ON p.id = sc.student_id
     JOIN auth.users     u2 ON u2.id = p.id
    WHERE lower(btrim(u2.email)) = 'muhammed1993@hotmail.co.uk'
  ) AS courses_rows,
  (SELECT count(*)
     FROM public.cohort_enrolments e2
     JOIN auth.users u3 ON u3.id = e2.user_id
    WHERE lower(btrim(u3.email)) = 'muhammed1993@hotmail.co.uk'
  ) AS existing_enrolments_any_cohort;

-- ⚠ existing_enrolments_any_cohort MUST BE 0. If it is 1 or more, Section 5
--    will correctly refuse to insert, because a second row breaks /intensive.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — THE ENROLMENT ROW. Expect EXACTLY ONE row returned.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: one row back, status = 'active', amount_pence = 85000,
--         stripe_ref = 'rehearsal-2026-08-27'.
-- ZERO ROWS = the guard fired = this user already holds an enrolment. Stop.
--
-- ⚠ status IS WRITTEN EXPLICITLY. The column default is 'paid' (0009:57) and
--    'paid' does not satisfy the seat counter. Never let the default apply.
--
-- ⚠ THE GUARD IS ON user_id ACROSS ALL COHORTS, not on this cohort. The table's
--    UNIQUE (cohort_id, email) already stops a duplicate on the SAME cohort;
--    it permits a second row on a DIFFERENT one, and that is precisely the row
--    that makes /intensive's .maybeSingle() return an error and silently
--    downgrade the student to "pending".
--
-- ⚠ amount_pence IS STRIPE'S FIGURE, IN THE MINOR UNITS STRIPE SETTLED.
--    850 QAR = 85000. It is not derived from cohorts.price_pence and it is
--    never converted. For a rehearsal there is no real charge, so this is a
--    stand-in for the shape of a real one — which is why Section 10 removes it.

INSERT INTO public.cohort_enrolments
       (id, cohort_id, user_id, email, status, amount_pence, stripe_ref, source_tag)
SELECT 'ae000000-0000-4000-8000-000000000001'::uuid,
       c.id,
       u.id,
       lower(btrim(u.email)),
       'active',
       85000,
       'rehearsal-2026-08-27',
       'rehearsal'
  FROM public.cohorts c
  CROSS JOIN auth.users u
 WHERE c.slug = 'ial-chemistry-as-sep-2026'
   AND lower(btrim(u.email)) = 'muhammed1993@hotmail.co.uk'
   AND NOT EXISTS (
     SELECT 1 FROM public.cohort_enrolments x WHERE x.user_id = u.id
   )
RETURNING id, cohort_id, user_id, email, status, amount_pence, stripe_ref;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 6 — THE COURSE ROW. Expect EXACTLY ONE row returned.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: one row, enrollment_status = 'active'.
--
-- ⚠ student_id COMES FROM profiles, NOT auth.users. The two hold the same uuid
--    (profiles.id references auth.users.id), so a mistake here does NOT throw —
--    it inserts against an id that happens to be valid. Resolving through
--    profiles means a missing profile raises 23503 instead of writing a row
--    nobody can see.
--
-- ⚠ id IS THE PRIMARY KEY HERE, not a spare column. 0017 §4b replaced the
--    original composite (student_id, course_id) key with a surrogate, which is
--    what lets Section 10 delete one exact row.
--
-- ⚠ THE GUARD BELOW IS DELIBERATELY STRICTER THAN THE TABLE'S OWN KEY. 0017
--    §4a states the intended uniqueness as (student_id, course_id,
--    academic_year, exam_session) — so the table permits a resit as a second
--    row on the same course. This guard refuses on (student_id, course_id)
--    alone, because a rehearsal has no business creating the second one and a
--    silent extra row is the thing being rehearsed against.

INSERT INTO public.student_courses
       (id, student_id, course_id, enrollment_status, exam_session, academic_year)
SELECT 'ae000000-0000-4000-8000-000000000002'::uuid,
       p.id,
       co.id,
       'active',
       'Summer 2027',
       '2026-2027'
  FROM public.profiles p
  JOIN auth.users u  ON u.id = p.id
  CROSS JOIN public.courses co
 WHERE lower(btrim(u.email)) = 'muhammed1993@hotmail.co.uk'
   AND co.slug = 'edexcel-ial-as-chemistry'
   AND NOT EXISTS (
     SELECT 1 FROM public.student_courses sc
      WHERE sc.student_id = p.id AND sc.course_id = co.id
   )
RETURNING id, student_id, course_id, enrollment_status, exam_session, academic_year;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 7 — POSITIVE CONTROL: is_enrolled() would now return true.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: is_enrolled_would_return = true.
--
-- Same predicate as Section 4, unchanged, so the only difference between the
-- two answers is the row Section 5 inserted. Again: substituted, not called.

SELECT EXISTS (
  SELECT 1
    FROM public.cohort_enrolments e
    JOIN public.cohorts c ON c.id = e.cohort_id
    JOIN auth.users     u ON u.id = e.user_id
   WHERE c.slug = 'ial-chemistry-as-sep-2026'
     AND lower(btrim(u.email)) = 'muhammed1993@hotmail.co.uk'
     AND e.status IN ('paid','active','completed')
) AS is_enrolled_would_return;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 8 — POSITIVE CONTROL: the "My courses" panel would now render.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: exactly one row, course_slug = edexcel-ial-as-chemistry.
--
-- ⚠ THIS IS profile-reader.ts:99-108's OWN QUERY, not a paraphrase of it.
--    Same table, same INNER join to courses (courses!inner), same filter on
--    student_id alone, same columns. A row here that the panel does not show
--    would mean the reader and this file disagree, which is worth knowing
--    BEFORE 13 September rather than on the morning.

SELECT sc.course_id,
       sc.year_group,
       sc.exam_session,
       sc.academic_year,
       sc.enrollment_status,
       sc.target_grade,
       c.slug  AS course_slug,
       c.name  AS course_name,
       c.level,
       c.pathway
  FROM public.student_courses sc
  JOIN public.courses  c  ON c.id = sc.course_id          -- courses!inner
  JOIN public.profiles p  ON p.id = sc.student_id
  JOIN auth.users      u  ON u.id = p.id
 WHERE lower(btrim(u.email)) = 'muhammed1993@hotmail.co.uk';


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 9 — SEAT COUNTER, AFTER. Must be Section 3's number PLUS ONE.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: 1, if Section 3 returned 0.
-- Equal to Section 3 = the row is not countable. Re-read the five conditions
-- at the head of this file; one of them is not met.

SELECT public.cohort_seats_taken('ial-chemistry-as-sep-2026') AS seats_taken_after;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 10 — TEARDOWN. Deletes BY ID and by nothing else.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: two rows returned, one from each table. Then Section 3's query
--         returns its original number again — check it.
--
-- ⚠ NO EMAIL, NO SLUG, NO "newest row", NO date window. The two ids are the
--    literals this file chose and inserted; nothing else can match them. That
--    is deliberate: a teardown keyed on email would delete a REAL enrolment if
--    this account is ever used for one, and this project has already erased the
--    wrong account once by letting a destructive block default its target.
--
-- ⚠ SAFE TO RUN TWICE, AND SAFE TO RUN ON AN ABANDONED REHEARSAL. Deleting
--    nothing returns zero rows, which is not an error.
--
-- ⚠ ORDER MATTERS ONLY FOR READABILITY — the two tables are unrelated. There is
--    no foreign key between student_courses and cohort_enrolments.

DELETE FROM public.student_courses
 WHERE id = 'ae000000-0000-4000-8000-000000000002'::uuid
RETURNING id, student_id, course_id;

DELETE FROM public.cohort_enrolments
 WHERE id = 'ae000000-0000-4000-8000-000000000001'::uuid
RETURNING id, cohort_id, user_id, email, status;

-- ⚠ FINALLY, RE-RUN SECTION 3. It must return the number it returned the first
--    time. If it does not, something else changed while you were rehearsing and
--    that is worth knowing now.
