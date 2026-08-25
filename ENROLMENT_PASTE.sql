-- ============================================================================
-- ENROL ONE STUDENT WHO HAS PAID
-- ============================================================================
-- Companion to ENROLMENT_RUNBOOK.md. Read the two traps there first.
--
-- ⚠ DO NOT PASTE THIS FILE IN ONE GO. Run SECTION 1, read the result, then
--    SECTION 2, and so on. A long paste into the Supabase SQL Editor has
--    already applied PARTIALLY and reported success once in this project.
--
-- ⚠ THIS PASTE WRITES TWO ROWS, IN TWO TABLES. cohort_enrolments buys the live
--    seat; student_courses is what makes /profile's "My courses" section — and
--    the whole Academic Overview behind it — render at all. Nothing in the
--    application ever writes student_courses (one reference in src/, a SELECT),
--    so without this row a paying student reads "You are not studying any
--    courses yet." forever.
--
-- ⚠ AND student_courses.student_id REFERENCES profiles(id), NOT auth.users(id).
--    A profiles row is normally created by the on_auth_user_created trigger,
--    but that trigger swallows its own exceptions (0002) — so an account CAN
--    exist with no profiles row, and Section 1 counts it rather than assuming.
--
-- ⚠ FIVE VALUES VARY, NOT TWO. The brief said student email and cohort slug.
--    `amount_pence` and `stripe_ref` also vary per payment, and they are NOT
--    optional: cohort_seats_taken() (0063:83-88) requires
--        status='active' AND amount_pence > 0 AND stripe_ref IS NOT NULL
--    or the public "0 of 20 places taken" counter never moves, on the tuition
--    page, the homepage hero, the calendar and the day panel. Access would
--    work and the site would still advertise an empty cohort.
--    They are NOT derived from cohorts.price_pence on purpose: that column is
--    a catalogue price, and since Stripe became the pricing source it may not
--    be what this family was actually charged. amount_pence is a payment
--    RECORD; inventing it would make a real payment unprovable.
--
-- ⚠ HOW TO FILL THEM IN — DO THIS ONCE, BEFORE RUNNING ANYTHING.
--    Each section must run on its own (see the partial-paste warning above), so
--    the four values appear in each of the four sections. They must be
--    IDENTICAL in all four. Section 1 checking one student while Section 3
--    inserts a different one is the single way this file can hurt you.
--
--    So: FIND-AND-REPLACE ACROSS THE WHOLE FILE, four times, before you run
--    Section 1. Do not edit section by section as you go.
--
--        STUDENT@EXAMPLE.COM        -> the student's account email
--        ial-chemistry-as-sep-2026  -> the cohort slug (leave if it is the AS)
--        85000                      -> the amount actually charged, minor units
--        STRIPE_REFERENCE           -> the Stripe payment reference
--
--    There is no PASTE_YOUR_X_HERE marker anywhere: every value above is a
--    realistic-looking literal, so a missed one shows up as a preflight count
--    of 0 in Section 1 rather than as a syntax error deep in the run.
--
-- ⚠ EMAILS ARE COMPARED WITH btrim(lower(...)) ON BOTH SIDES, EVERYWHERE.
--    /signup stores whatever was typed, with no .trim() (signup/page.tsx:144),
--    while the magic-link path trims (sign-in-form.tsx:32). So an account can
--    exist with trailing whitespace, and a plain `=` would miss it. Note that
--    claim_enrolment() itself uses only lower() (0009:77) — which does not
--    matter here, because this paste sets user_id directly rather than relying
--    on the claim.
--
-- ⚠ RLS WILL NOT GET IN YOUR WAY, AND is_staff() IS A RED HERRING HERE. The
--    write policy on this table is `for all using (public.is_staff())`
--    (0009:186), and is_staff() reads auth.uid(), which is NULL for the
--    `postgres` role — so it returns false in the SQL Editor no matter what.
--    That does not matter: FORCE ROW LEVEL SECURITY is deliberately not set
--    anywhere in this schema (0027:187), so the table owner bypasses RLS
--    entirely. Run this as the default SQL Editor role.
--
-- ⚠ NOTHING HERE IS DESTRUCTIVE. No DELETE, no UPDATE, no DROP, no default
--    target of any kind. The single INSERT is fail-closed: if the student has
--    no account, or the slug is wrong, it inserts NOTHING and returns no rows.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 0 — the four inputs. EDIT THIS BLOCK ONLY.
-- ════════════════════════════════════════════════════════════════════════════
-- Copy this block to the top of each section below that references `input`.
-- (Sections 1, 2, 3 and 4 each begin with it already inlined — just replace the
-- four values the same way in each, or edit once here and re-copy.)
--
--   student_email — the STUDENT's Ailemy account email, not the payer's.
--   cohort_slug   — one of exactly these three. COPY IT, DO NOT TYPE IT:
--                     'ial-chemistry-as-sep-2026'   Edexcel IAL Chemistry AS
--                     'igcse-chemistry-y11'         Year 11 GCSE / IGCSE
--                     'igcse-chemistry-y10'         Year 10 GCSE / IGCSE
--                   ⚠ THERE IS A FOURTH SLUG THAT LOOKS ALMOST IDENTICAL:
--                     'ial-chem-as-sep-2026'  — the old 12-week exam intensive
--                     (0009:254), is_public = false. Five characters shorter
--                     than the real AS slug. Enrolling onto it gives access to
--                     a different product and never touches the seat count.
--                     Section 1 will NOT catch this: the cohort exists, so
--                     cohorts_found returns 1. Read the slug twice.
--   amount_minor  — what Stripe actually charged, in minor units.
--                   ⚠ UNIT IS AN OPEN QUESTION — see the end of the runbook.
--                     850 QAR as QAR minor units = 85000.
--   stripe_ref    — the Stripe payment / session reference, for the audit trail.
--   course_slug   — which catalogue course the student is studying. This is a
--                   FIFTH input and it cannot be derived: `cohorts` has NO
--                   course_id column, so nothing links a cohort to a course.
--                   For the AS cohort this is 'edexcel-ial-as-chemistry'.
--                   Other seeded slugs: edexcel-ial-a2-chemistry,
--                   edexcel-gcse-chemistry, cie-igcse-chemistry.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — PREFLIGHT. Both counts MUST be exactly 1. Stop if not.
-- ════════════════════════════════════════════════════════════════════════════
-- This is the step that prevents the silent no-op. The INSERT in Section 3
-- JOINs on these two lookups; if either finds nothing it inserts nothing and
-- says so only by returning no rows. Read these numbers before going on.

WITH input AS (
  SELECT
    'STUDENT@EXAMPLE.COM'              ::text    AS student_email,
    'ial-chemistry-as-sep-2026'        ::text    AS cohort_slug,
    85000                              ::integer AS amount_minor,
    'STRIPE_REFERENCE'                 ::text    AS stripe_ref,
    'edexcel-ial-as-chemistry'         ::text    AS course_slug
)
SELECT
  (SELECT count(*) FROM auth.users u, input i
    WHERE btrim(lower(u.email)) = btrim(lower(i.student_email)))            AS accounts_found,
  (SELECT count(*) FROM public.cohorts c, input i
    WHERE c.slug = i.cohort_slug)                             AS cohorts_found,
  (SELECT count(*) FROM public.cohort_enrolments e
     JOIN public.cohorts c ON c.id = e.cohort_id, input i
    WHERE c.slug = i.cohort_slug
      AND btrim(lower(e.email)) = btrim(lower(i.student_email)))        AS already_enrolled,
  (SELECT count(*) FROM public.profiles p, input i
    WHERE p.id = (SELECT u.id FROM auth.users u
                   WHERE btrim(lower(u.email)) = btrim(lower(i.student_email))))
                                                                       AS profiles_found,
  (SELECT count(*) FROM public.courses c, input i
    WHERE c.slug = i.course_slug)                                      AS courses_found;

-- accounts_found  = 1 → good.
--                 = 0 → the student has NOT signed up. Send them to /signup.
--                       Do NOT insert an email-only row: for group tuition
--                       claim_enrolment() never runs and it would grant nothing.
--                 > 1 → two accounts share that email case-insensitively.
--                       STOP and decide which is the student.
-- cohorts_found   = 1 → good.  = 0 → wrong slug; check the three above.
-- already_enrolled= 0 → good.  > 0 → they already have a seat. STOP.
-- profiles_found  = 1 → good.
--                 = 0 → the account exists but has NO profiles row. The
--                       on_auth_user_created trigger swallows its own errors
--                       (0002), so this happens silently. Section 3's second
--                       INSERT would insert nothing. Fix the profile first.
-- courses_found   = 1 → good.  = 0 → wrong course slug; see Section 0.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — POSITIVE CONTROL, BEFORE. Both numbers MUST be 0.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ THIS DOES NOT CALL is_enrolled(). It cannot: is_enrolled() reads auth.uid(),
--   which is NULL for the `postgres` role in the SQL Editor, so it returns false
--   there no matter what — a false from the editor is not evidence of anything.
--   Instead this evaluates is_enrolled()'s OWN predicate (0009:83-87) with the
--   student's real id substituted for auth.uid(). Same test, checkable here.

WITH input AS (
  SELECT
    'STUDENT@EXAMPLE.COM'              ::text    AS student_email,
    'ial-chemistry-as-sep-2026'        ::text    AS cohort_slug,
    85000                              ::integer AS amount_minor,
    'STRIPE_REFERENCE'                 ::text    AS stripe_ref,
    'edexcel-ial-as-chemistry'         ::text    AS course_slug
)
SELECT
  (SELECT count(*)
     FROM public.cohort_enrolments e
     JOIN public.cohorts c ON c.id = e.cohort_id, input i
    WHERE c.slug = i.cohort_slug
      AND e.user_id = (SELECT u.id FROM auth.users u
                        WHERE btrim(lower(u.email)) = btrim(lower(i.student_email)))
      AND e.status IN ('paid','active','completed'))     AS access_would_pass,
  (SELECT public.cohort_seats_taken(i.cohort_slug) FROM input i)
                                                          AS public_seats_taken;

-- access_would_pass  MUST be 0 here. If it is already 1, they can see the
--                    cohort and you have nothing to do — STOP.
-- public_seats_taken write this number down. Section 4 must show it +1.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — THE INSERT. Fail-closed. Expect EXACTLY ONE row back.
-- ════════════════════════════════════════════════════════════════════════════
-- If this returns NO rows, nothing was inserted — go back to Section 1.
-- The email is stored lowercased on purpose: UNIQUE (cohort_id, email) is
-- case-SENSITIVE, so mixed case would let one person hold two seats and be
-- counted twice by the public seat counter.

WITH input AS (
  SELECT
    'STUDENT@EXAMPLE.COM'              ::text    AS student_email,
    'ial-chemistry-as-sep-2026'        ::text    AS cohort_slug,
    85000                              ::integer AS amount_minor,
    'STRIPE_REFERENCE'                 ::text    AS stripe_ref,
    'edexcel-ial-as-chemistry'         ::text    AS course_slug
)
INSERT INTO public.cohort_enrolments
  (cohort_id, user_id, email, status, amount_pence, stripe_ref, source_tag)
SELECT
  c.id,
  u.id,                       -- ⚠ NOT NULL: group tuition never self-links
  btrim(lower(i.student_email)),
  'active',                   -- ⚠ NOT the 'paid' default, and not 'completed'.
  i.amount_minor,             --    'active' is the ONLY status accepted by all
                              --    of: is_enrolled (0009:86), /profile
                              --    (student.ts:75) and cohort_seats_taken
                              --    (0063:85). Every other legal value fails one.
  i.stripe_ref,
  'manual-paylink'
FROM input i
JOIN public.cohorts   c ON c.slug = i.cohort_slug
JOIN auth.users       u ON btrim(lower(u.email)) = btrim(lower(i.student_email))
RETURNING id, cohort_id, user_id, email, status, amount_pence, stripe_ref;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3b — THE COURSE ROW. Expect EXACTLY ONE row back.
-- ════════════════════════════════════════════════════════════════════════════
-- Without this, /profile's "My courses" reads "You are not studying any courses
-- yet." and the entire Academic Overview behind it never renders — for a family
-- that has paid. Nothing in the application writes this table.
--
-- Fail-closed the same way: it JOINs profiles and courses, so a missing profile
-- or a wrong slug inserts nothing and returns no rows rather than erroring.
-- ON CONFLICT is deliberately absent — a second run should tell you it collided
-- (23505 on the composite PK) rather than reporting a silent success.

WITH input AS (
  SELECT
    'STUDENT@EXAMPLE.COM'              ::text    AS student_email,
    'ial-chemistry-as-sep-2026'        ::text    AS cohort_slug,
    85000                              ::integer AS amount_minor,
    'STRIPE_REFERENCE'                 ::text    AS stripe_ref,
    'edexcel-ial-as-chemistry'         ::text    AS course_slug
)
INSERT INTO public.student_courses (student_id, course_id)
SELECT p.id, c.id
FROM input i
JOIN auth.users     u ON btrim(lower(u.email)) = btrim(lower(i.student_email))
JOIN public.profiles p ON p.id = u.id
JOIN public.courses  c ON c.slug = i.course_slug
RETURNING student_id, course_id, enrolled_at;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — POSITIVE CONTROL, AFTER. Proves access changed, not just a row.
-- ════════════════════════════════════════════════════════════════════════════

WITH input AS (
  SELECT
    'STUDENT@EXAMPLE.COM'              ::text    AS student_email,
    'ial-chemistry-as-sep-2026'        ::text    AS cohort_slug,
    85000                              ::integer AS amount_minor,
    'STRIPE_REFERENCE'                 ::text    AS stripe_ref,
    'edexcel-ial-as-chemistry'         ::text    AS course_slug
)
SELECT
  (SELECT count(*)
     FROM public.cohort_enrolments e
     JOIN public.cohorts c ON c.id = e.cohort_id, input i
    WHERE c.slug = i.cohort_slug
      AND e.user_id = (SELECT u.id FROM auth.users u
                        WHERE btrim(lower(u.email)) = btrim(lower(i.student_email)))
      AND e.status IN ('paid','active','completed'))     AS access_would_pass,
  (SELECT public.cohort_seats_taken(i.cohort_slug) FROM input i)
                                                          AS public_seats_taken,
  (SELECT count(*)
     FROM public.cohort_enrolments e
     JOIN public.cohorts c ON c.id = e.cohort_id, input i
    WHERE c.slug = i.cohort_slug AND e.user_id IS NULL)   AS orphan_rows_on_cohort;

-- access_would_pass     MUST now be 1.  Still 0 → the row has a NULL user_id
--                       or a status outside the three; read Section 3's output.
-- public_seats_taken    MUST be Section 2's number + 1. Unchanged → status is
--                       not 'active', or amount_pence/stripe_ref is NULL.
-- orphan_rows_on_cohort SHOULD be 0. Anything above 0 is a row that will never
--                       grant group access on its own — worth clearing up.

-- Then tell the family to REFRESH the page. Not sign out and back in: every
-- check is a live server-side query, so it takes effect on the next request.
