-- ============================================================================
-- 0051_PROPOSED_booking_reference.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED TO PRODUCTION 2026-08-20, first of 0051–0055. Renamed off
-- _PROPOSED_ once verified.
--
-- VERIFICATION: 9 of 10 blocks RUN AND PASSING, 1 NOT RUN.
--   (a)  0 NULL booking_ref of 0 pre-existing rows                        ✓
--   (b)  a new booking receives one from the DEFAULT — AIL-8YY3TV7J       ✓
--   (b2) ⚠ AND IT WAS service_role THAT INSERTED IT. Run through a
--        service-role PostgREST client, which IS that role over the wire a
--        booking actually takes — a stronger check than SET ROLE, and the
--        one (b) alone could never make because (b) runs as the owner.       ✓
--   (c)  every ref in the table matches ^AIL-[23456789A-HJKMNP-Z]{8}$,
--        0 malformed                                                        ✓
--   (d)  a duplicate ref is refused, 23505 private_bookings_ref_unique      ✓
--        ⚠ run with TWO probe bookings present; with one it is a no-op
--        that looks like a pass.
--   (e)  anon SELECT refused 42501 — NOT an empty result                    ✓
--   (f)  anon cannot EXECUTE generate_booking_ref, 42501                    ✓
--        …and service_role CAN — the §3 grant, proven in both directions.   ✓
--
--   (h)  the three privileges — observed 2026-08-20 via founder paste.
--        anon and authenticated each hold FALSE for TRUNCATE, TRIGGER and
--        REFERENCES; the control (authenticated SELECT) came back TRUE.       ✓
--        ⚠ THE CONTROL IS WHY THE SIX FALSES MEAN ANYTHING. Asked with
--        has_table_privilege() rather than role_table_grants, because that
--        view only lists grants where the grantee is a currently ENABLED
--        role — true here only because Supabase makes postgres a member of
--        both, which is an assumption. has_table_privilege answers directly
--        and ERRORS on a table or role that does not exist, so it cannot
--        return a reassuring silence.
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

/**
 * ============================================================================
 * ⚠ AND service_role IS GRANTED IT EXPLICITLY, AFTER THE REVOKES
 * ============================================================================
 * A column DEFAULT is evaluated with the privileges of the role performing the
 * INSERT, not the table owner's. Booking creation runs as service_role, so
 * service_role must hold EXECUTE on this function or every real booking fails
 * with 42501 — on a table whose owner can insert into it perfectly well.
 *
 * ⚠ AND THE VERIFICATION ABOVE CANNOT CATCH THAT. Block (b) runs in the SQL
 * Editor as `postgres`, this function's owner, who holds EXECUTE
 * unconditionally. A green (b) is fully consistent with every production
 * booking failing. That is why (b2) below exists and why it names the role.
 *
 * ⚠ WHY THE EXPLICIT GRANT WHEN service_role PROBABLY HAS IT ALREADY.
 * 0014 line 91 sets, in this folder, applied:
 *
 *     ALTER DEFAULT PRIVILEGES IN SCHEMA public
 *       GRANT EXECUTE ON FUNCTIONS TO service_role;
 *
 * so a function created in `public` should receive a DIRECT grant at creation
 * time — and a direct grant is NOT removed by the REVOKE ... FROM PUBLIC above.
 * The sibling clause of that same statement is empirically live: 0044's tables
 * were created after 0014's snapshot, carry no service_role grant of their own,
 * and the AS timetable was nonetheless seeded through them by a service_role
 * client.
 *
 * That is strong evidence, and it is still evidence about a SIBLING clause
 * rather than a grant on this function. Two inferences hold it up — that
 * 0014's default privilege is still in force in the catalogue, and that this
 * file is applied by the same role 0014 was, since ALTER DEFAULT PRIVILEGES
 * without FOR ROLE binds to the role that ran it. 0026 records that nobody has
 * ever been able to read pg_default_acl from this repository to check the
 * first. One line removes both inferences.
 *
 * ⚠ IT MUST COME AFTER THE REVOKES, NOT BEFORE. A REVOKE issued afterwards
 * would undo it, and the two lines above are exactly the shape a future edit
 * would copy-paste `service_role` into by accident.
 */
GRANT EXECUTE ON FUNCTION public.generate_booking_ref() TO service_role;

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
-- (b2) ⚠ AS service_role — THE ROLE THAT ACTUALLY CREATES BOOKINGS, and the
--      one thing (b) structurally cannot test because it runs as the owner.
-- SET ROLE service_role;
-- INSERT INTO public.private_bookings (teacher_id,email,starts_at,ends_at,paid_with,payment_ref)
--   VALUES (<t>,'svc@example.test','2027-06-02T13:00Z','2027-06-02T14:00Z','single','pi_svc');
-- SELECT booking_ref FROM public.private_bookings WHERE payment_ref='pi_svc';
-- RESET ROLE;
-- PASS: an AIL- reference, generated by the DEFAULT while running as service_role.
--
--   ⚠ TWO DIFFERENT FAILURES ARE POSSIBLE HERE AND THEY MEAN DIFFERENT THINGS.
--   Read the message, do not just note that it failed:
--
--     'permission denied for function generate_booking_ref'
--        → the GRANT in section 3 did not take, or was revoked after it. The
--          DEFAULT cannot fire. Every production booking would fail. Fix
--          section 3 and re-run.
--
--     'permission denied for table private_bookings'
--        → a DIFFERENT and PRE-EXISTING gap, not caused by this file: 0046
--          grants only `authenticated` SELECT and never names service_role, so
--          service_role's table privileges on it rest on 0014's
--          ALTER DEFAULT PRIVILEGES ... ON TABLES. If this is what you see,
--          STOP and report it — booking creation is already broken in
--          production and no part of this migration is the cause.
--
--   ⚠ RESET ROLE even if the INSERT fails, or the rest of the session runs as
--   service_role and every later check silently measures the wrong role.
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
-- SET ROLE anon; SELECT public.generate_booking_ref(); RESET ROLE;
-- PASS: permission denied for function generate_booking_ref.
--   ⚠ RUN THIS AND (b2) TOGETHER. They are the two halves of one claim: the
--   function is reachable by exactly the role that needs it and by no other.
--   Either alone is consistent with the grant being wrong in one direction.
--
-- (g) cleanup by the id created, never a filter sweep.
--
-- (h) the three privileges
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='private_bookings'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
