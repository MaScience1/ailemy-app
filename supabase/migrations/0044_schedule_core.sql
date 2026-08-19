-- ============================================================================
-- 0044_PROPOSED_schedule_core.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-19, IN THREE ROUNDS. Renamed from
-- 0044_PROPOSED_ once verified. VERIFICATION: ALL 33 RUNNABLE ASSERTIONS PASS.
--
-- ============================================================================
-- ⚠ IT TOOK THREE ROUNDS, AND THAT IS WORTH RECORDING
-- ============================================================================
-- Each run reported no errors in the SQL Editor, and each time part of the file
-- had not applied. The parts arrived in this order:
--
--   round 1   tables, CHECK constraints, the partial unique index, and
--             ALTER TABLE … ENABLE ROW LEVEL SECURITY.
--   round 2   the GRANT / REVOKE statements (section 5), run by hand.
--   round 3   the CREATE POLICY block (section 4), run by hand.
--
-- ⚠ THE FAULTS MASKED EACH OTHER, WHICH IS THE LESSON. A missing GRANT denies
-- before RLS is ever reached, so while the grant was absent every anon read
-- returned 42501 — and "no grant" was indistinguishable from "no grant AND no
-- policy". The missing policies only became visible once the grants landed.
-- A verification that had stopped at "anon sees nothing, good" would have
-- signed off a database with no read policies at all.
--
-- ⚠ AND THAT IS WHY (h) IS PAIRED WITH (i). "anon sees 0 rows" was TRUE in all
-- three rounds and meant something different each time: no grant, then no
-- policy, then finally the is_public gate doing its job. Only the positive half
-- — publish the cohort, anon now sees exactly 1 — distinguishes them.
--
-- ----------------------------------------------------------------------------
-- VERIFICATION RESULT — 33 of 33 runnable assertions PASSED
-- ----------------------------------------------------------------------------
--   (a) weekday 0 refused BY cohort_schedules_weekday_iso, 23514        ✓
--       …weekday 8 refused                                              ✓
--       ⚠ THE getUTCDay() TRAP, CLOSED. Sunday is 7 under ISO and 0
--       under JS. A 0 stored here is a rule the reader never matches —
--       nobody turns up and nothing errors.
--   (b) weekday 2 accepted; timezone defaults to 'Asia/Qatar';
--       is_active true — so (a) is not a column refusing everything     ✓
--   (c) inverted times refused BY cohort_schedules_time_ordered         ✓
--       backwards validity window refused BY …_window_ordered           ✓
--   (d) first override accepted; a SECOND for the same lesson refused
--       BY tuition_sessions_one_override_per_occurrence, 23505          ✓
--   (e) a morning clinic AND an evening mock on one date both insert    ✓
--   (f) untimed one-off refused BY …_oneoff_needs_times                 ✓
--       backwards session refused BY …_instants_ordered                 ✓
--       kind 'party' refused BY …_kind_check                            ✓
--   (g) a CANCELLED one-off without times IS allowed                    ✓
--   (h) anon sees 0 schedule rows and 0 sessions for a PRIVATE cohort   ✓
--       …while service_role proves the rule exists (1 row)              ✓
--   (i) anon sees exactly 1 schedule row once the cohort is published   ✓
--       …and all 4 sessions become visible                              ✓
--       …and unpublishing hides BOTH again — one switch, both ways      ✓
--   (j) school-wide holiday (cohort_id NULL) readable by anon           ✓
--       backwards break refused BY schedule_periods_ordered             ✓
--       a break scoped to a PRIVATE cohort hidden from anon             ✓
--       …and visible once that cohort is published                      ✓
--   (k) anon INSERT refused on all three, 42501                         ✓
--       anon UPDATE refused; start_time provably unchanged at 19:00:00  ✓
--       anon DELETE refused; all 4 session rows survive                 ✓
--   extra: publishing the probe exposed NO row belonging to any other
--       non-public cohort — the gate leaks nothing sideways             ✓
--   (l) every probe row deleted by its captured id, count=1 each;
--       all three tables back to 0 rows                                 ✓
--
--   ⚠ (m) THE THREE PRIVILEGES WAS NOT RUN AND IS NOT CLAIMED.
--   information_schema.role_table_grants is not exposed through PostgREST and
--   TRUNCATE/TRIGGER/REFERENCES cannot be exercised over REST, so there is no
--   behavioural substitute. The REVOKEs were issued in round 2; whether they
--   took is UNCHECKED. Block (m) still needs the SQL Editor.
--
-- ⚠ THE POLICY BODIES WERE QUALIFIED BEFORE ROUND 3 — public.<table>.cohort_id
-- rather than a bare cohort_id. Unqualified, Postgres resolves against the
-- innermost scope first, so the day `cohorts` gains a column of that name the
-- policy would compare the subquery's row to itself and admit everything. The
-- applied version is the qualified one.
--
-- STATE ON THE SITE: the tables are empty, so the reader reaches the database,
-- finds no rules, and falls back to the published AS timetable in code —
-- reporting "no schedule rows yet" rather than the "42501: permission denied"
-- it reported before round 2. The public calendar becomes database-driven the
-- moment a timetable is created in /admin/calendar.
-- ============================================================================
--
-- ⚠ THREE NEW TABLES. Nothing in the schema models a timetable today, and this
-- was checked rather than assumed: cohorts (0009/0041/0042) carries
-- schedule_summary, which is FREE TEXT — the sentence printed on the AS card —
-- and cohort_weeks (0009) is CONTENT (week_number, spec_points, a Mux id,
-- release_at), not a schedule. There is no weekday, no start_time and no
-- timezone column anywhere in the database.
--
-- ============================================================================
-- ⚠ SIXTY LESSONS ARE NOT SIXTY ROWS
-- ============================================================================
-- cohort_schedules holds the RULE — "every Tuesday, 19:00–21:30 Asia/Qatar,
-- 15 Sep 2026 to 21 May 2027". tuition_sessions holds only DEPARTURES from it:
-- a moved lesson, a cancelled lesson, or a one-off that never had a rule
-- (onboarding, a revision clinic, a mock). schedule_periods holds holidays.
--
-- Materialising every occurrence at creation time would mean each later edit
-- has to find and rewrite dozens of rows, and "move one Tuesday" becomes a
-- data migration. §8 asks for recurrence AND overrides precisely because that
-- is the only shape in which editing one lesson and editing the series are
-- different acts.
--
-- ============================================================================
-- ⚠ A TIMETABLE IS A WALL CLOCK, NOT AN INSTANT
-- ============================================================================
-- start_time/end_time are `time`, not `timestamptz`, and the zone is stored
-- beside them. "Tuesday 7pm Doha" is a rule about a clock face; which instant
-- it means depends on the date. Storing one instant and adding seven days is
-- how a term timetable silently drifts an hour halfway through in any zone with
-- DST — and while Asia/Qatar has none today, the London students reading the
-- converted time have it twice a year.
--
-- tuition_sessions.starts_at/ends_at ARE timestamptz, and correctly so: a moved
-- lesson is a specific instant somebody chose, not a rule.
-- ============================================================================

BEGIN;

-- ── 1. THE RULES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cohort_schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id   uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,

  -- ISO weekday, matching Postgres EXTRACT(isodow): Monday = 1 … Sunday = 7.
  -- ⚠ NOT getUTCDay()'s Sunday = 0. One convention, written down, because two
  -- off-by-one conventions in one system is a lesson on the wrong day.
  weekday     smallint NOT NULL,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  timezone    text NOT NULL DEFAULT 'Asia/Qatar',

  valid_from  date NOT NULL,
  valid_until date,                    -- NULL = open-ended
  label       text,                    -- e.g. 'Teaching session'
  is_active   boolean NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cohort_schedules_weekday_iso CHECK (weekday BETWEEN 1 AND 7),
  -- ⚠ A LESSON MUST END AFTER IT STARTS. An inverted rule generates sessions
  -- that render as negative-length and sort wrongly, and reads on screen as
  -- "the calendar is broken" rather than as a typo.
  CONSTRAINT cohort_schedules_time_ordered CHECK (end_time > start_time),
  CONSTRAINT cohort_schedules_window_ordered
    CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS cohort_schedules_cohort_idx
  ON public.cohort_schedules (cohort_id, weekday);

-- ── 2. HOLIDAYS AND BREAKS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schedule_periods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ⚠ NULL MEANS EVERY COHORT — a school holiday. A cohort_id means one class
  -- pauses while the rest continue. Both are real, and collapsing them into
  -- "one row per cohort" would make a school closure an n-row edit.
  cohort_id  uuid REFERENCES public.cohorts(id) ON DELETE CASCADE,
  starts_on  date NOT NULL,
  ends_on    date NOT NULL,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT schedule_periods_ordered CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS schedule_periods_range_idx
  ON public.schedule_periods (starts_on, ends_on);

-- ── 3. OVERRIDES AND ONE-OFFS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tuition_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id   uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,

  -- ⚠ NULL schedule_id IS A ONE-OFF, not a missing link: onboarding, a revision
  -- clinic, a mock. A non-null one overrides THAT rule's occurrence on
  -- occurs_on. The two meanings are distinguished by the column being null,
  -- which is why there is no separate "is_one_off" flag to disagree with it.
  schedule_id uuid REFERENCES public.cohort_schedules(id) ON DELETE CASCADE,

  -- The date, in the rule's own timezone, that this row speaks about.
  occurs_on   date NOT NULL,

  status      text NOT NULL DEFAULT 'scheduled',
  kind        text NOT NULL DEFAULT 'teaching',
  title       text,
  starts_at   timestamptz,             -- required for a one-off or a move
  ends_at     timestamptz,
  timezone    text,
  note        text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tuition_sessions_status_check CHECK (status IN ('scheduled','cancelled')),
  CONSTRAINT tuition_sessions_kind_check
    CHECK (kind IN ('teaching','onboarding','revision','mock','clinic')),
  CONSTRAINT tuition_sessions_instants_ordered
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),

  -- ⚠ A ONE-OFF WITHOUT TIMES CANNOT EXIST. There is no rule for it to inherit
  -- from, so a row like that would render at midnight or be silently dropped.
  -- Refused here so an admin is told at the point of creation. A CANCELLED
  -- one-off is exempt: cancelling something is not the moment to demand times
  -- for it.
  CONSTRAINT tuition_sessions_oneoff_needs_times
    CHECK (
      schedule_id IS NOT NULL
      OR status = 'cancelled'
      OR (starts_at IS NOT NULL AND ends_at IS NOT NULL)
    )
);

-- ⚠ ONE OVERRIDE PER RULE PER DATE. Two rows for the same occurrence is an
-- ambiguity the reader cannot resolve — it would pick whichever arrived first
-- and the admin would see their edit ignored. Partial, because one-offs
-- (schedule_id NULL) are legitimately repeatable on a date.
CREATE UNIQUE INDEX IF NOT EXISTS tuition_sessions_one_override_per_occurrence
  ON public.tuition_sessions (schedule_id, occurs_on)
  WHERE schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tuition_sessions_window_idx
  ON public.tuition_sessions (occurs_on, cohort_id);

-- ── 4. ROW-LEVEL SECURITY (§62) ─────────────────────────────────────────────
ALTER TABLE public.cohort_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuition_sessions ENABLE ROW LEVEL SECURITY;

-- ⚠ THE PUBLIC READ IS GATED ON THE COHORT, NOT ON THE SESSION.
-- A timetable is exactly as public as the class it belongs to. Deriving it from
-- cohorts.is_public means there is ONE switch — publishing a cohort publishes
-- its schedule and unpublishing hides it — rather than a second is_public
-- column here that can disagree with the first.
--
-- ⚠ SCOPED `TO anon, authenticated` EXPLICITLY. An unscoped policy applies to
-- PUBLIC, which is how 0009's "cohorts readable" quietly admitted anon the
-- moment 0041 granted it SELECT. Named roles, every time.
--
-- ⚠ THE OUTER COLUMN IS FULLY QUALIFIED — public.<table>.cohort_id, not a bare
-- cohort_id. Unqualified, Postgres resolves it against the INNERMOST scope
-- first, so the day `cohorts` gains a column called cohort_id the policy would
-- silently compare the subquery's own row to itself and admit everything. It is
-- correct today either way; qualifying costs nothing and removes the trap.
--
-- ⚠ AND THE SUBQUERY IS SAFE FOR anon ONLY BECAUSE anon CAN READ cohorts.
-- 0041 granted that. A role evaluating a subquery against a table it cannot
-- SELECT raises a permission error rather than returning false — the fault that
-- took down every anonymous storage read until 0013.
DROP POLICY IF EXISTS cohort_schedules_read_public ON public.cohort_schedules;
CREATE POLICY cohort_schedules_read_public
  ON public.cohort_schedules FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cohorts c
     WHERE c.id = public.cohort_schedules.cohort_id AND c.is_public IS TRUE
  ));

DROP POLICY IF EXISTS schedule_periods_read_public ON public.schedule_periods;
CREATE POLICY schedule_periods_read_public
  ON public.schedule_periods FOR SELECT TO anon, authenticated
  -- A school-wide holiday (cohort_id NULL) is public: it explains why a public
  -- timetable has a gap. It names no student and no cohort.
  USING (
    public.schedule_periods.cohort_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
       WHERE c.id = public.schedule_periods.cohort_id AND c.is_public IS TRUE
    )
  );

DROP POLICY IF EXISTS tuition_sessions_read_public ON public.tuition_sessions;
CREATE POLICY tuition_sessions_read_public
  ON public.tuition_sessions FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cohorts c
     WHERE c.id = public.tuition_sessions.cohort_id AND c.is_public IS TRUE
  ));

-- ⚠ WRITES ARE STAFF-ONLY AND GO THROUGH is_staff(). No client of any kind gets
-- INSERT/UPDATE/DELETE below, so these policies exist for the authenticated
-- staff path; the admin screens use the service role behind assertAdmin().
DROP POLICY IF EXISTS cohort_schedules_staff_all ON public.cohort_schedules;
CREATE POLICY cohort_schedules_staff_all ON public.cohort_schedules
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS schedule_periods_staff_all ON public.schedule_periods;
CREATE POLICY schedule_periods_staff_all ON public.schedule_periods
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS tuition_sessions_staff_all ON public.tuition_sessions;
CREATE POLICY tuition_sessions_staff_all ON public.tuition_sessions
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── 5. GRANTS ───────────────────────────────────────────────────────────────
-- ⚠ GRANTS ARE CHECKED BEFORE RLS. SELECT only, and nothing else to anyone:
-- every write is server-side through the service role.
GRANT SELECT ON public.cohort_schedules TO anon, authenticated;
GRANT SELECT ON public.schedule_periods TO anon, authenticated;
GRANT SELECT ON public.tuition_sessions TO anon, authenticated;

-- ⚠ THE THREE PRIVILEGES, PER AGENTS.md — required on every CREATE TABLE, and
-- no other migration will do it. TRUNCATE is not filtered by RLS: a row policy
-- cannot protect these tables from being emptied.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.cohort_schedules   FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.schedule_periods   FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.tuition_sessions   FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION — every block must return what it claims
-- ----------------------------------------------------------------------------
-- Setup: the AS cohort is public; create a private probe cohort to test against.
-- INSERT INTO public.cohorts (slug,title,price_pence,starts_on,ends_on,status,is_public,is_active)
--   VALUES ('probe-private','probe',1,'2027-09-01','2028-06-01','interest',false,false);
--
-- (a) the three tables exist and the ISO weekday bound holds
-- INSERT INTO public.cohort_schedules (cohort_id,weekday,start_time,end_time,valid_from)
--   SELECT id, 0, '19:00', '21:30', '2026-09-15' FROM public.cohorts WHERE slug='probe-private';
-- PASS: violates check constraint "cohort_schedules_weekday_iso".
--   ⚠ 0 IS THE TRAP. getUTCDay() calls Sunday 0; isodow calls it 7. A rule
--   written with the JS convention must be refused, not stored as a silent
--   off-by-one that teaches on the wrong day.
--
-- (b) …and weekday 2 (Tuesday) is accepted
-- (same insert with weekday 2) PASS: inserted.
--
-- (c) an inverted lesson is refused
-- (insert with start_time '21:30', end_time '19:00')
-- PASS: violates check constraint "cohort_schedules_time_ordered".
--
-- (d) one override per rule per date
-- INSERT INTO public.tuition_sessions (cohort_id,schedule_id,occurs_on,status)
--   VALUES (<cohort>,<schedule>,'2026-09-15','cancelled');   -- ok
-- INSERT INTO public.tuition_sessions (cohort_id,schedule_id,occurs_on,status)
--   VALUES (<cohort>,<schedule>,'2026-09-15','scheduled');   -- second one
-- PASS: duplicate key violates "tuition_sessions_one_override_per_occurrence".
--
-- (e) …and two ONE-OFFS on the same date are still allowed
-- (two rows, schedule_id NULL, same occurs_on, both with times)
-- PASS: both inserted. A morning clinic and an evening mock is a real day.
--
-- (f) a one-off with no times is refused
-- INSERT INTO public.tuition_sessions (cohort_id,schedule_id,occurs_on,kind,status)
--   VALUES (<cohort>,NULL,'2026-09-13','onboarding','scheduled');
-- PASS: violates "tuition_sessions_oneoff_needs_times".
--
-- (g) …but a CANCELLED one-off without times is allowed
-- (same row with status 'cancelled') PASS: inserted.
--
-- (h) anon sees NOTHING for a private cohort — the sabotage
-- SET ROLE anon; SELECT count(*) FROM public.cohort_schedules;
-- PASS: 0, while the probe cohort is is_public=false.
--   ⚠ A 0 PROVES NOTHING ON ITS OWN. Run (i) as well.
--
-- (i) anon DOES see it once the cohort is published
-- RESET ROLE; UPDATE public.cohorts SET is_public=true WHERE slug='probe-private';
-- SET ROLE anon; SELECT count(*) FROM public.cohort_schedules;
-- PASS: 1. Without this, (h) proves only that anon cannot read the table at all.
--
-- (j) a school-wide holiday IS public
-- RESET ROLE; INSERT INTO public.schedule_periods (cohort_id,starts_on,ends_on,reason)
--   VALUES (NULL,'2026-12-20','2027-01-02','Winter break');
-- SET ROLE anon; SELECT count(*) FROM public.schedule_periods WHERE cohort_id IS NULL;
-- PASS: 1. It explains a gap in a public timetable and names nobody.
--
-- (k) anon cannot write any of the three
-- SET ROLE anon; INSERT INTO public.cohort_schedules (cohort_id,weekday,start_time,end_time,valid_from)
--   VALUES (<cohort>,2,'19:00','21:30','2026-09-15');
-- PASS: permission denied for table cohort_schedules. Repeat for the other two.
--
-- (l) cleanup — by the ids created, never a table-wide sweep
-- RESET ROLE;
-- DELETE FROM public.schedule_periods WHERE reason='Winter break';
-- DELETE FROM public.cohorts WHERE slug='probe-private';   -- cascades
--
-- (m) the three privileges are gone
-- SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public'
--    AND table_name IN ('cohort_schedules','schedule_periods','tuition_sessions')
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
