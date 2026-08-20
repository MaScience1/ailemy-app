-- ============================================================================
-- 0052_PROPOSED_cancellation_requests.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. Number allocated by the planning chat. Apply AFTER
-- 0051: this table references private_bookings. Run each section separately.
--
-- Cash-paid cancellations that a human must decide (§41, §54).
--
-- ============================================================================
-- ⚠ WHY A TABLE AND NOT A STATUS VALUE
-- ============================================================================
-- 0046's private_bookings_status_check permits exactly confirmed | cancelled |
-- completed | no_show. Adding 'cancellation_requested' to that list would be
-- the cheap change and the wrong one: a request is not a state of the LESSON,
-- it is a conversation about it. The lesson is still confirmed while the
-- request is open — the student should still turn up if nobody replies.
--
-- Collapsing them also loses who asked, when, why, what was decided and by
-- whom, which is precisely what §54 needs Admin to see.
--
-- ⚠ A CREDIT-PAID CANCELLATION INSIDE THE WINDOW DOES NOT COME HERE (§40). That
-- path is self-service: cancel, restore exactly one credit, done. This table is
-- for the cases a policy cannot decide alone — cash refunds, and anything
-- inside the cutoff.
-- ============================================================================

-- ── SECTION 1: TABLE ────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS public.cancellation_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid NOT NULL REFERENCES public.private_bookings(id) ON DELETE RESTRICT,

  -- ⚠ WHO ASKED, CAPTURED AT THE TIME. user_id may later be nulled by an
  -- erasure; requested_by_email is the durable record of the conversation.
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_email text NOT NULL,

  reason         text,
  -- Free text from the family. Distinct from `resolution_note`, which is ours.
  student_note   text,

  status         text NOT NULL DEFAULT 'open',
  resolution     text,
  resolution_note text,
  resolved_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at    timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cancellation_requests_status_check
    CHECK (status IN ('open','resolved','withdrawn')),
  CONSTRAINT cancellation_requests_resolution_check
    CHECK (resolution IS NULL OR resolution IN ('refunded','credited','rescheduled','declined')),
  CONSTRAINT cancellation_requests_email_shape
    CHECK (position('@' IN requested_by_email) > 1),

  -- ⚠ A RESOLVED REQUEST MUST SAY WHAT WAS DECIDED, AND WHEN. Without this a
  -- request can be marked resolved with no outcome recorded — which is exactly
  -- how "I was told I'd get a refund" becomes unanswerable.
  CONSTRAINT cancellation_requests_resolved_needs_outcome
    CHECK (status <> 'resolved' OR (resolution IS NOT NULL AND resolved_at IS NOT NULL))
);

-- ⚠ ONE OPEN REQUEST PER BOOKING. A student pressing the button twice must not
-- create two threads for one lesson; partial, so a resolved request does not
-- block a later one if the lesson is rescheduled and cancelled again.
CREATE UNIQUE INDEX IF NOT EXISTS cancellation_requests_one_open_per_booking
  ON public.cancellation_requests (booking_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS cancellation_requests_queue_idx
  ON public.cancellation_requests (status, created_at DESC);

COMMIT;

-- ── SECTION 2: ROW-LEVEL SECURITY ───────────────────────────────────────────
BEGIN;

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

-- ⚠ NO anon POLICY. RLS denies by default; the absence IS the protection.

-- A student sees their own requests, so the UI can say "we have this".
DROP POLICY IF EXISTS cancellation_requests_read_own ON public.cancellation_requests;
CREATE POLICY cancellation_requests_read_own
  ON public.cancellation_requests FOR SELECT TO authenticated
  USING (public.cancellation_requests.user_id = auth.uid());

/**
 * ⚠ A STUDENT MAY CREATE ONE, FOR A BOOKING THAT IS THEIRS — and the WITH CHECK
 * proves the second half rather than trusting the form. Without the EXISTS
 * clause a student could open a cancellation request against someone else's
 * lesson, which is not a data leak but is a denial-of-service on another
 * family's booking.
 *
 * ============================================================================
 * ⚠ AND IT MUST PIN THE OUTCOME COLUMNS, OR A STUDENT CAN FILE THEIR OWN REFUND
 * ============================================================================
 * The first draft of this policy checked only ownership. INSERT is granted at
 * table level, so a student could name every column — and this row satisfies
 * every constraint in section 1:
 *
 *     INSERT INTO public.cancellation_requests
 *       (booking_id, user_id, requested_by_email,
 *        status, resolution, resolved_at, resolved_by)
 *     VALUES (<their own booking>, auth.uid(), 'them@example.com',
 *             'resolved', 'refunded', now(), <an admin's uuid>);
 *
 * cancellation_requests_resolved_needs_outcome is SATISFIED by it — that
 * constraint exists to stop a resolution with no outcome recorded, and this has
 * one. The read-own policy then hands it straight back to them.
 *
 * That fabricates the precise artefact this file's own header says the table
 * exists to make answerable: "I was told I'd get a refund" — now with a row, a
 * timestamp, and an administrator's user id on it. The header worried about the
 * record being ABSENT and the policy let a student FORGE it.
 *
 * ⚠ THE FOUR PINS ARE NOT INTERCHANGEABLE WITH THE STATUS PIN ALONE. status
 * ='open' with resolution='refunded' would be a contradiction the CHECK does
 * not catch (it only constrains rows that ARE resolved), and resolved_by alone
 * names a decision-maker for a decision nobody made. Each column that records
 * OUR side of the conversation is pinned to its no-decision-yet value.
 *
 * ⚠ THE ADMIN PATH IS UNAFFECTED. cancellation_requests_staff_all is a separate
 * FOR ALL policy and policies are OR'd, so staff recording a phone call as
 * already-resolved still insert normally. This narrows students only.
 */
DROP POLICY IF EXISTS cancellation_requests_insert_own ON public.cancellation_requests;
CREATE POLICY cancellation_requests_insert_own
  ON public.cancellation_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.cancellation_requests.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.private_bookings b
       WHERE b.id = public.cancellation_requests.booking_id
         AND b.user_id = auth.uid()
    )
    -- A student opens a request. They do not resolve it, and they do not get
    -- to say who did.
    AND public.cancellation_requests.status = 'open'
    AND public.cancellation_requests.resolution IS NULL
    AND public.cancellation_requests.resolved_by IS NULL
    AND public.cancellation_requests.resolved_at IS NULL
  );

-- ⚠ NO STUDENT UPDATE POLICY. Resolving is an admin act; a student who could
-- UPDATE could mark their own request 'resolved' with resolution 'refunded'.
DROP POLICY IF EXISTS cancellation_requests_staff_all ON public.cancellation_requests;
CREATE POLICY cancellation_requests_staff_all
  ON public.cancellation_requests FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

COMMIT;

-- ── SECTION 3: GRANTS + NOTIFY ──────────────────────────────────────────────
BEGIN;

GRANT SELECT ON public.cancellation_requests TO authenticated;

/**
 * ⚠ COLUMN-LEVEL INSERT, BECAUSE RLS FILTERS ROWS AND NEVER COLUMNS.
 *
 * The tightened WITH CHECK in section 2 is sufficient on its own to stop a
 * student filing their own refund. This is the second layer, and it is the
 * layer AGENTS.md names for exactly this problem: "To restrict WHICH COLUMNS a
 * client may write, use a column-level grant." A table-wide INSERT behind a row
 * policy still lets a client NAME any column; only this stops it.
 *
 * The two fail differently, which is the point of having both:
 *   · naming `resolution` at all  → 42501, permission denied for column
 *   · naming it via some path the grant misses → the policy refuses the ROW
 *
 * ⚠ THIS IS A CONTRACT ON THE CLIENT: a student INSERT must NOT name status,
 * resolution, resolution_note, resolved_by, resolved_at, created_at or
 * updated_at — not even to send status='open'. Sending a legal value for an
 * ungranted column is still 42501. The defaults fill status='open' and the rest
 * stay NULL, which is exactly the row section 2 permits.
 *
 * ⚠ STRIKE THIS BLOCK IF YOU WANT ONE LAYER, NOT TWO. It was not in the
 * finding as raised; the WITH CHECK alone closes the hole, and this adds a
 * contract the server action has to honour. Keeping it is the house pattern
 * (0018 profiles, 0053 notification_deliveries); dropping it costs a layer and
 * nothing else. Revert by restoring:
 *     GRANT SELECT, INSERT ON public.cancellation_requests TO authenticated;
 */
GRANT INSERT (booking_id, user_id, requested_by_email, reason, student_note)
  ON public.cancellation_requests TO authenticated;

-- ⚠ TABLE-WIDE, AND SAFE ONLY BECAUSE NO STUDENT UPDATE POLICY EXISTS. Staff
-- resolving a request need every outcome column, and the ONLY thing standing
-- between a student and this grant is the absence of a policy admitting their
-- row for UPDATE. Verification (g) is the assertion that the absence holds; if
-- a student UPDATE policy is ever added, this must become column-level too.
GRANT UPDATE ON public.cancellation_requests TO authenticated;

-- ⚠ anon GETS NOTHING. This table names a student and describes their money.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.cancellation_requests FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) a resolved request must carry an outcome
-- INSERT ... (booking_id, requested_by_email, status) VALUES (<b>,'a@example.test','resolved');
-- PASS: violates cancellation_requests_resolved_needs_outcome.
-- ...and with resolution='refunded', resolved_at=now(): inserted.
--
-- (b) one OPEN request per booking
-- (insert two 'open' rows for the same booking)
-- PASS: duplicate key violates "cancellation_requests_one_open_per_booking".
-- ...and once the first is resolved, a second 'open' row IS accepted — the
--    index is partial. Without this half, (b) proves only that the table
--    rejects things.
--
-- (c) an off-list resolution is refused
-- (resolution='vibes') PASS: violates cancellation_requests_resolution_check.
--
-- (d) anon is refused OUTRIGHT
-- SET ROLE anon; SELECT count(*) FROM public.cancellation_requests;
-- PASS: permission denied for table cancellation_requests.
--   ⚠ A 0 WOULD BE A FAILURE — it would mean a grant exists and RLS filtered.
--
-- (e) student A sees only their own
-- (from A's session) SELECT count(*) FROM public.cancellation_requests;
-- PASS: only rows with user_id = A. Insert one for B; A's count is unchanged.
--
-- (f) ⚠ THE ONE THAT MATTERS — A CANNOT OPEN A REQUEST AGAINST B'S BOOKING
-- (from A's session) INSERT ... (booking_id, user_id, requested_by_email)
--   VALUES (<B's booking>, auth.uid(), 'a@example.test');
-- PASS: new row violates row-level security policy.
-- ...and against their OWN booking: inserted.
--
-- (f2) ⚠ SABOTAGE — A STUDENT CANNOT FILE THEIR OWN REFUND
--      This is the assertion the first draft of the policy would have failed.
--      Run it against their OWN booking, so the only thing under test is the
--      outcome pin and not ownership.
-- (from A's session)
-- INSERT INTO public.cancellation_requests
--   (booking_id, user_id, requested_by_email, status, resolution, resolved_at)
-- VALUES (<A's OWN booking>, auth.uid(), 'a@example.test',
--         'resolved', 'refunded', now());
-- PASS: refused.
--
--   ⚠ EITHER MESSAGE IS A PASS, AND THEY PROVE DIFFERENT LAYERS. Note which
--   one you get:
--     'permission denied for column status'  → the column-level INSERT grant
--        in section 3 caught it. The policy was never consulted.
--     'new row violates row-level security policy' → the WITH CHECK caught it.
--   If section 3's column grant was struck, only the second is possible.
--
-- (f3) ...AND THE ORDINARY REQUEST STILL WORKS, so (f2) is not a table
--      refusing everything — the half that makes (f2) mean anything.
-- (from A's session)
-- INSERT INTO public.cancellation_requests
--   (booking_id, user_id, requested_by_email, reason)
-- VALUES (<A's OWN booking>, auth.uid(), 'a@example.test', 'Exam clash');
-- PASS: inserted.
-- SELECT status, resolution, resolved_by, resolved_at
--   FROM public.cancellation_requests WHERE id = <it>;
-- PASS: 'open', NULL, NULL, NULL — the defaults, not the client.
--
-- (f4) ⚠ AND THE REAL ADMIN PATH IS UNTOUCHED. The tightening must narrow
--      students only. Admin writes in this codebase go through
--      createAdminClient() — service_role, which holds table-wide privileges
--      from 0014's ALTER DEFAULT PRIVILEGES and BYPASSRLS. Neither section 2's
--      WITH CHECK nor section 3's column grant applies to it at all.
-- SET ROLE service_role;
-- INSERT INTO public.cancellation_requests (booking_id, user_id, requested_by_email,
--   status, resolution, resolved_at, resolved_by)
--   VALUES (<any booking>, <that student>, 's@example.test',
--           'resolved', 'refunded', now(), <admin uuid>);
-- RESET ROLE;
-- PASS: inserted. This is how Admin records a decision made on the phone.
--
--   ⚠ THE `TO authenticated` STAFF POLICY IS A FALLBACK FOR A PATH THE APP
--   DOES NOT USE, and it is worth knowing what it can and cannot do. A staff
--   member acting through their own SESSION holds the same `authenticated`
--   column grant as a student, so with section 3 in place they cannot name the
--   outcome columns on INSERT either — they would insert, then UPDATE, which
--   cancellation_requests_staff_all permits and the table-wide UPDATE grant
--   covers. That costs nothing today because no such path exists. If one is
--   ever built, either give it service_role or strike the column grant.
--
-- (g) a student cannot resolve their own request
-- (from A's session) UPDATE public.cancellation_requests
--   SET status='resolved', resolution='refunded', resolved_at=now() WHERE user_id=auth.uid();
-- PASS: 0 rows updated — no student UPDATE policy exists.
--
-- (h) cleanup by captured id, never a sweep.
--
-- (i) the three privileges
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='cancellation_requests'
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
