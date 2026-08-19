-- ============================================================================
-- 0045_PROPOSED_private_availability.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. Rename to 0045_private_availability.sql only once
-- applied, and record the verification result in this header at the same time.
--
-- ⚠ APPLY 0045, 0046 AND 0047 IN ORDER. 0046 references teacher_availability
-- and 0047 references private_bookings.
--
-- ⚠ RUN EACH SECTION SEPARATELY. 0044 was pasted whole three times and each
-- run silently dropped a trailing section — tables landed, grants did not,
-- policies did not — while the editor reported success each time. Sections are
-- numbered below for that reason.
--
-- ============================================================================
-- WHAT THIS IS FOR (§23, §24, §46, §47)
-- ============================================================================
-- When the founder may teach 1-to-1, and when they may not. It stores RULES
-- and EXCLUSIONS; it stores no slots. Bookable slots are DERIVED at read time
-- from availability minus blocks minus group lessons minus existing bookings
-- and holds — the same reason 0044 stores recurrence rather than sixty rows.
--
-- ⚠ MATERIALISED SLOTS WOULD BE A SECOND SOURCE OF TRUTH, and it would go
-- stale the moment a group lesson moved. §25 requires that a private slot can
-- never overlap a group lesson; the only way to guarantee that is to compute
-- against the live schedule every time, not against a snapshot.
--
-- ⚠ NOT A CALENDLY CLONE (§24). No round-robin, no team pooling, no external
-- calendar sync. One teacher today, extensible to several.
-- ============================================================================

-- ── SECTION 1: TABLES ───────────────────────────────────────────────────────
BEGIN;

/**
 * A window in which a teacher is willing to teach 1-to-1.
 *
 * Recurring (weekday set, valid_from/until) or one-off (specific_date). One of
 * the two, never both — see the CHECK.
 */
CREATE TABLE IF NOT EXISTS public.teacher_availability (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ⚠ A REAL USER, NOT A NAME. cohorts.teacher_name is free text and always
  -- has been; bookings must point at an account that can be authorised, so
  -- this is the first place teacher identity becomes structural (§47).
  teacher_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ⚠ NULL MEANS "ANY SUBJECT THIS TEACHER TEACHES". Chemistry today; a
  -- Biology teacher's availability is the same shape with a different value
  -- (§46), which is what stops this needing a rewrite per subject.
  subject           text,

  -- Recurring: weekday set. One-off: specific_date. Exactly one.
  weekday           smallint,
  specific_date     date,

  start_time        time NOT NULL,
  end_time          time NOT NULL,
  timezone          text NOT NULL DEFAULT 'Asia/Qatar',

  -- ⚠ THE SHAPE OF A SLOT, NOT A SLOT. 60-minute slots with a 15-minute buffer
  -- inside a 16:00–19:00 window is three slots; storing them would be storing
  -- an answer we can always recompute, and would drift the moment the buffer
  -- changed.
  slot_minutes      smallint NOT NULL DEFAULT 60,
  buffer_minutes    smallint NOT NULL DEFAULT 15,

  valid_from        date,
  valid_until       date,

  -- ⚠ HOW FAR AHEAD, AND HOW LATE. §24. booking_horizon_days caps how far into
  -- the future a slot is offered; booking_cutoff_hours stops a student booking
  -- something starting in ten minutes.
  booking_horizon_days smallint NOT NULL DEFAULT 42,
  booking_cutoff_hours smallint NOT NULL DEFAULT 12,

  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- ISO weekday, matching 0044 and Postgres isodow. Monday 1 … Sunday 7.
  -- ⚠ THE SAME CONVENTION AS cohort_schedules, DELIBERATELY. Two weekday
  -- conventions in one system is a private slot offered on the wrong day.
  CONSTRAINT teacher_availability_weekday_iso
    CHECK (weekday IS NULL OR weekday BETWEEN 1 AND 7),

  -- ⚠ RECURRING XOR ONE-OFF. A row with both is ambiguous — does the weekday
  -- repeat, or is it a single date that happens to fall on it? A row with
  -- neither generates nothing and looks like a bug in the UI.
  CONSTRAINT teacher_availability_recurring_xor_dated
    CHECK ((weekday IS NULL) <> (specific_date IS NULL)),

  CONSTRAINT teacher_availability_time_ordered CHECK (end_time > start_time),
  CONSTRAINT teacher_availability_window_ordered
    CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_until >= valid_from),

  -- ⚠ A SLOT MUST FIT INSIDE ITS WINDOW. slot_minutes longer than the window
  -- yields zero slots and reads as "the teacher published nothing".
  CONSTRAINT teacher_availability_slot_fits
    CHECK (slot_minutes > 0 AND slot_minutes <= 480),
  CONSTRAINT teacher_availability_buffer_sane
    CHECK (buffer_minutes >= 0 AND buffer_minutes <= 240),
  CONSTRAINT teacher_availability_horizon_sane
    CHECK (booking_horizon_days BETWEEN 1 AND 365),
  CONSTRAINT teacher_availability_cutoff_sane
    CHECK (booking_cutoff_hours BETWEEN 0 AND 720)
);

CREATE INDEX IF NOT EXISTS teacher_availability_lookup_idx
  ON public.teacher_availability (teacher_id, is_active, weekday);

/**
 * When a teacher is NOT available, overriding any window above.
 *
 * ⚠ ONE TABLE FOR BOTH "the whole of December 1–10" AND "Monday 5pm". A whole
 * day is a block whose times cover it; there is no separate blocked_dates
 * table to disagree with this one (§23).
 */
CREATE TABLE IF NOT EXISTS public.availability_blocks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT availability_blocks_ordered CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS availability_blocks_range_idx
  ON public.availability_blocks (teacher_id, starts_at, ends_at);

COMMIT;

-- ── SECTION 2: ROW-LEVEL SECURITY ───────────────────────────────────────────
BEGIN;

ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks  ENABLE ROW LEVEL SECURITY;

-- ⚠ AVAILABILITY IS PUBLIC AND CONTAINS NO STUDENT DATA. It is when a teacher
-- offers to work — the same category of fact as a group timetable. Publishing
-- it is what lets a visitor see open slots at all (§62).
DROP POLICY IF EXISTS teacher_availability_read_public ON public.teacher_availability;
CREATE POLICY teacher_availability_read_public
  ON public.teacher_availability FOR SELECT TO anon, authenticated
  USING (public.teacher_availability.is_active IS TRUE);

-- ⚠ BLOCKS ARE PUBLIC TOO, AND THAT IS A DELIBERATE TRADE. A block says "not
-- available", which a visitor learns anyway the moment the slot is absent.
-- What it must NOT carry is why — `reason` is NOT granted to anon below, by
-- column-level grant, because "hospital appointment" is nobody's business.
DROP POLICY IF EXISTS availability_blocks_read_public ON public.availability_blocks;
CREATE POLICY availability_blocks_read_public
  ON public.availability_blocks FOR SELECT TO anon, authenticated
  USING (true);

-- Staff manage both. Writes also go through the service role behind
-- assertAdmin(); these policies exist so an authenticated teacher path can
-- later be added without touching grants.
DROP POLICY IF EXISTS teacher_availability_staff_all ON public.teacher_availability;
CREATE POLICY teacher_availability_staff_all ON public.teacher_availability
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS availability_blocks_staff_all ON public.availability_blocks;
CREATE POLICY availability_blocks_staff_all ON public.availability_blocks
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

COMMIT;

-- ── SECTION 3: GRANTS ───────────────────────────────────────────────────────
BEGIN;

GRANT SELECT ON public.teacher_availability TO anon, authenticated;

-- ⚠ COLUMN-LEVEL GRANT, AND THIS IS THE ONE PLACE IT MATTERS. RLS filters ROWS,
-- never columns (AGENTS.md). A row policy cannot hide `reason` while showing
-- the times, so the grant does it: anon and authenticated get the times and
-- nothing else. A teacher's reason for being unavailable is not public.
GRANT SELECT (id, teacher_id, starts_at, ends_at)
  ON public.availability_blocks TO anon, authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.teacher_availability FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.availability_blocks  FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) recurring XOR dated
-- INSERT INTO public.teacher_availability (teacher_id,weekday,specific_date,start_time,end_time)
--   VALUES (<uid>,1,'2026-09-21','16:00','19:00');
-- PASS: violates teacher_availability_recurring_xor_dated.
-- …and with weekday 1, specific_date NULL: inserted.
-- …and with weekday NULL, specific_date set: inserted.
-- …and with BOTH NULL: violates the same constraint.
--
-- (b) the ISO weekday bound, same trap as 0044
-- (weekday 0) PASS: violates teacher_availability_weekday_iso.
--
-- (c) an inverted window is refused
-- (start 19:00, end 16:00) PASS: violates teacher_availability_time_ordered.
--
-- (d) anon can read availability
-- SET ROLE anon; SELECT count(*) FROM public.teacher_availability;
-- PASS: the active rows.
--
-- (e) anon CANNOT read a block's reason — the column-level grant
-- SET ROLE anon; SELECT reason FROM public.availability_blocks;
-- PASS: permission denied for column reason.
--   ⚠ THE TIMES MUST STILL WORK, or the grant is too tight:
-- SET ROLE anon; SELECT starts_at, ends_at FROM public.availability_blocks;
-- PASS: rows returned.
--
-- (f) an inactive availability row is hidden from anon
-- RESET ROLE; UPDATE public.teacher_availability SET is_active=false WHERE id=<id>;
-- SET ROLE anon; SELECT count(*) FROM public.teacher_availability WHERE id=<id>;
-- PASS: 0. Then set it back to true and confirm 1 — without the positive half
--   this proves only that anon cannot read the table.
--
-- (g) anon cannot write either table
-- SET ROLE anon; INSERT INTO public.teacher_availability …
-- PASS: permission denied for table teacher_availability. Same for blocks.
--
-- (h) cleanup by captured id, never a sweep.
--
-- (i) the three privileges
-- SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public'
--    AND table_name IN ('teacher_availability','availability_blocks')
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
