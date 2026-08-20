-- ============================================================================
-- 00XX_PROPOSED_booking_reference.sql   ⚠ NUMBER COMES FROM THE PLANNING CHAT
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. 0050 is reserved (announcement targeting); expect
-- 0051+. Run each section separately: a long paste has silently dropped its
-- trailing sections three times in this project while reporting success.
--
-- A human-readable handle for a private booking (§74, §75).
--
-- ⚠ WHY NOT THE UUID. A parent on WhatsApp cannot read
-- "eb0b28b9-e081-408f-8f8d-70d1acaf3c64" aloud, and pasting it into a support
-- message exposes an internal identifier for no benefit. A short code is
-- quotable, checkable, and says nothing about how many bookings exist.
-- ============================================================================

-- ── SECTION 1: COLUMN AND GENERATOR ─────────────────────────────────────────
BEGIN;

ALTER TABLE public.private_bookings
  ADD COLUMN IF NOT EXISTS booking_ref text;

/**
 * ⚠ THE ALPHABET EXCLUDES 0/O/1/I/L. Those are the characters a person
 * mis-transcribes over the phone, and a reference exists precisely to be read
 * aloud. 8 characters from a 31-symbol alphabet is ~10^12 combinations, so
 * collisions are vanishingly rare — and the unique index below turns "rare"
 * into "impossible" rather than trusting the odds.
 *
 * ⚠ NOT SEQUENTIAL. AIL-000042 tells a competitor how many lessons have been
 * booked, and tells a curious student which reference to guess next.
 */
CREATE OR REPLACE FUNCTION public.generate_booking_ref()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet CONSTANT text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  out text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN 'AIL-' || out;
END;
$$;

COMMENT ON COLUMN public.private_bookings.booking_ref IS
  'Human-readable handle, quoted in confirmation email and support. Ambiguous characters (0 O 1 I L) excluded; random rather than sequential so it leaks no volume.';

COMMIT;

-- ── SECTION 2: BACKFILL, THEN CONSTRAIN ─────────────────────────────────────
-- ⚠ ORDER MATTERS AND IS NOT INTERCHANGEABLE. A unique index over a column
-- that is NULL on every existing row would succeed (NULLs do not collide) and
-- then the DEFAULT would start filling it — leaving old bookings permanently
-- unreferenceable. Backfill first, verify, then constrain.
BEGIN;

UPDATE public.private_bookings
   SET booking_ref = public.generate_booking_ref()
 WHERE booking_ref IS NULL;

COMMIT;

-- ⚠ VERIFY THE BACKFILL BEFORE CONSTRAINING. If this returns anything other
-- than 0, STOP — the unique index below will fail and leave section 2 half
-- applied.
--   SELECT count(*) FROM public.private_bookings WHERE booking_ref IS NULL;
--   EXPECT: 0
--   SELECT count(*) - count(DISTINCT booking_ref) FROM public.private_bookings;
--   EXPECT: 0   (no collisions in the backfill)

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS private_bookings_ref_unique
  ON public.private_bookings (booking_ref);

ALTER TABLE public.private_bookings
  ALTER COLUMN booking_ref SET DEFAULT public.generate_booking_ref();

-- ⚠ NOT NULL LAST, and only once every row has one. Setting it before the
-- backfill would refuse the migration on a populated table.
ALTER TABLE public.private_bookings
  ALTER COLUMN booking_ref SET NOT NULL;

COMMIT;

-- ── SECTION 3: GRANTS ───────────────────────────────────────────────────────
BEGIN;

-- ⚠ NO NEW GRANT NEEDED, AND NONE IS ISSUED. authenticated already holds
-- table-level SELECT on private_bookings (0046) and a table-level grant covers
-- columns added later. anon still holds NOTHING on this table.
--
-- ⚠ THE GENERATOR IS NOT CALLABLE BY A CLIENT. Postgres grants EXECUTE on new
-- functions to PUBLIC by default; without this revoke, anon could call it. It
-- is harmless in itself, but a function no client needs should not be reachable
-- by one.
REVOKE ALL ON FUNCTION public.generate_booking_ref() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_booking_ref() FROM anon, authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.private_bookings FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) every existing booking has a reference
-- SELECT count(*) FROM public.private_bookings WHERE booking_ref IS NULL;
-- PASS: 0.
--
-- (b) a new booking gets one automatically
-- INSERT INTO public.private_bookings (teacher_id,email,starts_at,ends_at,paid_with,payment_ref)
--   VALUES (<t>,'a@example.test','2027-06-01T13:00Z','2027-06-01T14:00Z','single','pi_ref');
-- SELECT booking_ref FROM public.private_bookings WHERE payment_ref='pi_ref';
-- PASS: 'AIL-XXXXXXXX', 12 characters, no 0/O/1/I/L.
--
-- (c) the shape is right and the alphabet is respected
-- SELECT bool_and(booking_ref ~ '^AIL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$')
--   FROM public.private_bookings;
-- PASS: true.
--
-- (d) duplicates are impossible
-- UPDATE public.private_bookings SET booking_ref = (
--   SELECT booking_ref FROM public.private_bookings WHERE id <> <this id> LIMIT 1
-- ) WHERE id = <this id>;
-- PASS: duplicate key violates "private_bookings_ref_unique".
--   ⚠ NEEDS TWO ROWS TO MEAN ANYTHING. With one booking in the table this
--   silently does nothing and looks like a pass.
--
-- (e) anon still cannot read the table at all
-- SET ROLE anon; SELECT booking_ref FROM public.private_bookings;
-- PASS: permission denied for table private_bookings.
--   ⚠ AN EMPTY RESULT WOULD BE A FAILURE — it would mean a grant appeared.
--
-- (f) anon cannot call the generator
-- SET ROLE anon; SELECT public.generate_booking_ref();
-- PASS: permission denied for function generate_booking_ref.
--
-- (g) cleanup by the id created, never a filter sweep.
--
-- (h) the three privileges
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='private_bookings'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
