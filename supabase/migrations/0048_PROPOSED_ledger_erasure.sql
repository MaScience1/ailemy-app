-- ============================================================================
-- 0048_PROPOSED_ledger_erasure.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. Apply AFTER 0047. Run each section separately.
--
-- ============================================================================
-- ⚠ FIXES A REAL DEFECT IN 0047 THAT ITS OWN VERIFICATION EXPOSED
-- ============================================================================
-- 0047's append-only trigger works exactly as specified — proven: UPDATE and
-- DELETE are both refused even from service_role, the role that holds every
-- grant. That is the whole point of it and it is not being weakened here.
--
-- What was wrong is that "append-only" was made ABSOLUTE, and two foreign keys
-- on the same table perform writes:
--
--   booking_id REFERENCES private_bookings(id) ON DELETE SET NULL
--     deleting a booking fires an UPDATE on the ledger → trigger refuses
--   user_id    REFERENCES auth.users(id)       ON DELETE CASCADE
--     deleting a user fires a DELETE on the ledger    → trigger refuses
--
-- ⚠ THE SECOND ONE IS THE SERIOUS ONE: NO USER WHO HAS EVER HELD A CREDIT CAN
-- BE DELETED. The interest form tells families "you may ask us to delete them
-- at any time" and the privacy policy says the same. A ledger that cannot be
-- erased makes that promise impossible to keep, and it would have been
-- discovered the first time somebody asked.
--
-- Found by running 0047's verification: cleanup could not remove two probe
-- users, and the error named the trigger.
--
-- ============================================================================
-- ⚠ THE FIX IS A NAMED, DELIBERATE ESCAPE — NOT A WEAKER TRIGGER
-- ============================================================================
-- The trigger still refuses every ordinary UPDATE and DELETE, from every role.
-- It yields only when a session has explicitly set
--
--     SET LOCAL app.ledger_purge = 'on';
--
-- SET LOCAL, so it dies with the transaction and cannot leak into the next
-- statement on a pooled connection. Nothing in the application sets it; it is
-- for an erasure routine a human runs, and it appears in the audit trail of
-- whoever ran it.
--
-- ⚠ THIS IS NOT A BACK DOOR ROUND THE AUDIT TRAIL. Correcting a balance still
-- means writing a compensating row — the escape does not make that easier.
-- What it makes possible is deleting a PERSON, which is a different act with a
-- different justification, and which the law requires be possible.
-- ============================================================================

-- ── SECTION 1: THE TRIGGER LEARNS ONE EXCEPTION ─────────────────────────────
BEGIN;

CREATE OR REPLACE FUNCTION public.refuse_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- ⚠ current_setting(..., true) — the `true` means "missing is NULL, not an
  -- error". Without it every ordinary write would fail with a confusing
  -- unrecognized-configuration-parameter error instead of the intended message.
  IF coalesce(current_setting('app.ledger_purge', true), 'off') = 'on' THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  RAISE EXCEPTION
    'lesson_credit_transactions is append-only: % refused. Insert a compensating row instead, or SET LOCAL app.ledger_purge = ''on'' for a deliberate erasure.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

COMMIT;

-- ── SECTION 2: THE REFERENCES STOP PERFORMING HIDDEN WRITES ─────────────────
BEGIN;

-- ⚠ A BOOKING THAT CONSUMED A CREDIT SHOULD BE CANCELLED, NOT DELETED, and
-- RESTRICT says so in one clear error rather than through a trigger message
-- about a table the caller was not touching. Cancelling is already the
-- supported act: 0046's exclusion constraint frees the slot on cancellation,
-- and planRestore() gives the credit back.
ALTER TABLE public.lesson_credit_transactions
  DROP CONSTRAINT IF EXISTS lesson_credit_transactions_booking_id_fkey;
ALTER TABLE public.lesson_credit_transactions
  ADD CONSTRAINT lesson_credit_transactions_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES public.private_bookings(id) ON DELETE RESTRICT;

-- Same reasoning: a package that has been sold is deactivated, never deleted.
-- Deleting it would orphan the record of what somebody paid for.
ALTER TABLE public.lesson_credit_transactions
  DROP CONSTRAINT IF EXISTS lesson_credit_transactions_package_id_fkey;
ALTER TABLE public.lesson_credit_transactions
  ADD CONSTRAINT lesson_credit_transactions_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES public.tuition_packages(id) ON DELETE RESTRICT;

-- ⚠ user_id KEEPS ON DELETE CASCADE, DELIBERATELY. Erasing a person must erase
-- their ledger — that is the point. The cascade now succeeds because section 1
-- lets a purge session through.
COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) THE TRIGGER STILL REFUSES ORDINARY MUTATION — the property being kept
-- INSERT INTO public.lesson_credit_transactions (user_id,delta,reason)
--   VALUES (<uid>,4,'purchase');
-- UPDATE public.lesson_credit_transactions SET delta=99 WHERE user_id=<uid>;
-- PASS: 'lesson_credit_transactions is append-only: UPDATE refused…'
-- DELETE FROM public.lesson_credit_transactions WHERE user_id=<uid>;
-- PASS: the same, for DELETE.
--   ⚠ RUN AS postgres. The trigger's job is to refuse the role that holds
--   every grant; being refused by a missing grant proves nothing.
--
-- (b) …and yields ONLY inside a purge transaction
-- BEGIN;
--   SET LOCAL app.ledger_purge = 'on';
--   DELETE FROM public.lesson_credit_transactions WHERE user_id=<uid>;
-- COMMIT;
-- PASS: rows deleted.
--
-- (c) …and the escape does NOT survive the transaction
-- DELETE FROM public.lesson_credit_transactions WHERE user_id=<uid>;
-- PASS: refused again. SET LOCAL died with the COMMIT.
--   ⚠ THIS IS THE ONE THAT MATTERS ON A POOLED CONNECTION. A plain SET would
--   leave the escape armed for whatever ran next on that backend.
--
-- (d) A USER CAN NOW BE DELETED — the defect this migration exists for
-- (create a probe user, give them a ledger row)
-- BEGIN;
--   SET LOCAL app.ledger_purge = 'on';
--   DELETE FROM auth.users WHERE id = <probe uid>;
-- COMMIT;
-- PASS: the user and their ledger rows are gone.
--   Then: SELECT count(*) FROM public.lesson_credit_transactions WHERE user_id=<uid>;
--   PASS: 0.
--
-- (e) deleting a booking that a credit paid for is REFUSED, clearly
-- DELETE FROM public.private_bookings WHERE id=<b>;
-- PASS: violates foreign key constraint
--       "lesson_credit_transactions_booking_id_fkey" — a plain FK error naming
--       the real relationship, not a trigger message about another table.
--
-- (f) …and CANCELLING it still works, which is the supported act
-- UPDATE public.private_bookings SET status='cancelled' WHERE id=<b>;
-- PASS: updated, and 0046's exclusion constraint frees the slot.
--
-- (g) a booking with NO ledger row is still freely deletable
-- PASS: deleted.
--
-- ----------------------------------------------------------------------------
-- ⚠ ONE-TIME CLEANUP OWED FROM 0047's VERIFICATION RUN
-- ----------------------------------------------------------------------------
-- That run left rows behind that could not be removed, because this defect is
-- exactly what stopped the cleanup. After applying, run:
--
-- BEGIN;
--   SET LOCAL app.ledger_purge = 'on';
--   DELETE FROM auth.users
--    WHERE email LIKE 'probe-0045-%@example.test';
-- COMMIT;
--
-- -- the one probe booking, once its ledger rows are gone with the users:
-- DELETE FROM public.private_bookings WHERE email = 'a@example.test';
--
-- Then confirm all three are empty:
-- SELECT
--   (SELECT count(*) FROM public.lesson_credit_transactions) AS ledger,
--   (SELECT count(*) FROM public.private_bookings)           AS bookings,
--   (SELECT count(*) FROM auth.users WHERE email LIKE 'probe-0045-%') AS probes;
-- PASS: 0, 0, 0.
