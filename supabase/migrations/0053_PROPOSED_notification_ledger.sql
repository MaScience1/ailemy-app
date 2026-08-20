-- ============================================================================
-- 0053_PROPOSED_notification_ledger.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED. Number allocated by the planning chat. Independent
-- of 0051 and 0052; must precede 0055, which names all three of its tables.
-- Run each section separately.
--
-- ============================================================================
-- ⚠ ONE EVENT ROW DRIVES EMAIL, IN-APP AND PUSH — WEB AND MOBILE ALIKE
-- ============================================================================
-- This is the shape the founder asked for explicitly, and it is the shape that
-- survives a mobile client existing later.
--
--   notification_events        WHAT HAPPENED, once. "The Saturday Chemistry
--                              lesson moved from 19:00 to 20:00." One row per
--                              real-world fact, per recipient.
--   notification_deliveries    HOW IT WAS TOLD TO THEM, once per channel.
--                              email / in_app / push, each with its own status,
--                              provider id, attempt count and error.
--
-- ⚠ WHY NOT ONE TABLE PER CHANNEL. Three tables means three idempotency keys,
-- three retry policies, and three chances for the email to say 20:00 while the
-- push says 19:00. With one event row, every channel renders the SAME fact and
-- a bug fixes once.
--
-- ⚠ WHY NOT A COLUMN PER CHANNEL ON ONE ROW. Adding SMS or WhatsApp later would
-- be a migration and a rewrite of every query. A delivery ROW per channel makes
-- a new channel an INSERT.
--
-- ⚠ AND IT IS AN OUTBOX, NOT A LOG. The row is written IN THE SAME TRANSACTION
-- as the thing it describes, before any provider is called. A sender picks up
-- 'pending' rows afterwards. That is what makes a crash mid-send recoverable:
-- the intent is durable even when the send is not. payment_events (0047) is the
-- right idea but the wrong shape — it is keyed (provider, event_id) around
-- Stripe's identifiers and cannot represent "tell this person this thing".
--
-- ⚠ MOBILE-READY WITHOUT A MOBILE CLIENT. push_tokens exists so the phone has
-- somewhere to register; nothing sends to it yet. The alternative — bolting it
-- on later — is the rewrite §52 asks us to avoid.
-- ============================================================================

-- ── SECTION 1: TABLES ───────────────────────────────────────────────────────
BEGIN;

/**
 * One real-world fact, addressed to one person.
 *
 * `payload` is the rendered FACTS (old time, new time, lesson title), never
 * rendered COPY. Copy lives in templates that can be fixed and re-rendered; a
 * stored sentence cannot be corrected after the fact.
 */
CREATE TABLE IF NOT EXISTS public.notification_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Durable address: a recipient may be erased, or may not have an account.
  email        text,

  kind         text NOT NULL,
  subject_type text,
  subject_id   uuid,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,

  /**
   * ⚠ THE IDEMPOTENCY KEY, AND THE WHOLE REASON §50 EXISTS. Built from the FACT,
   * not from the moment: 'booking_confirmed:<booking uuid>' or
   * 'session_moved:<session uuid>:<new starts_at>:<user uuid>'. A retried
   * server action, a re-render, or a webhook redelivery computes the same key
   * and the unique index refuses the second row. Correctness comes from the
   * constraint, not from the handler remembering it already ran.
   */
  idempotency_key text NOT NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notification_events_kind_check CHECK (kind IN (
    'booking_confirmed','booking_cancelled','credit_restored',
    'session_moved','session_cancelled','session_added',
    'cancellation_requested','cancellation_resolved','announcement'
  )),
  -- ⚠ SOMEWHERE TO SEND IT. A row addressed to nobody is unsendable and
  -- unfixable; refuse it at write time where the caller can still do something.
  CONSTRAINT notification_events_has_recipient
    CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_idempotency
  ON public.notification_events (idempotency_key);

CREATE INDEX IF NOT EXISTS notification_events_user_idx
  ON public.notification_events (user_id, created_at DESC);

/**
 * One attempt to tell them, per channel.
 *
 * ⚠ THE IN-APP BELL IS A DELIVERY, NOT A SEPARATE FEATURE. read_at on the
 * channel='in_app' row is what §47's "Schedule updates" panel reads. That is
 * why there is no separate in_app_messages table: it would be a second copy of
 * the same fact, free to disagree with the email.
 */
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,

  channel      text NOT NULL,
  status       text NOT NULL DEFAULT 'pending',

  -- Provider truth, for reconciling a bounce or a spam quarantine.
  provider     text,
  provider_message_id text,
  error        text,
  attempts     smallint NOT NULL DEFAULT 0,

  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  read_at      timestamptz,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notification_deliveries_channel_check
    CHECK (channel IN ('email','in_app','push')),
  CONSTRAINT notification_deliveries_status_check
    CHECK (status IN ('pending','sent','failed','suppressed','skipped')),
  -- ⚠ A SENT DELIVERY MUST SAY WHEN. Without it "did we tell them?" is
  -- unanswerable, which is the question this table exists for.
  CONSTRAINT notification_deliveries_sent_needs_time
    CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);

-- ⚠ ONE DELIVERY PER CHANNEL PER EVENT. This is the second half of §50: the
-- event key stops two events; this stops two emails for one event.
CREATE UNIQUE INDEX IF NOT EXISTS notification_deliveries_one_per_channel
  ON public.notification_deliveries (event_id, channel);

-- The sender's queue: pending work, oldest first.
CREATE INDEX IF NOT EXISTS notification_deliveries_pending_idx
  ON public.notification_deliveries (status, scheduled_for)
  WHERE status = 'pending';

/**
 * Where a phone can be reached (§52, §68). Nothing sends to it yet.
 *
 * ⚠ ONE ROW PER DEVICE, NOT PER USER. A student with a phone and a tablet has
 * two; revoking one must not silence the other.
 */
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT push_tokens_platform_check CHECK (platform IN ('ios','android','web'))
);

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_unique ON public.push_tokens (token);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx
  ON public.push_tokens (user_id) WHERE revoked_at IS NULL;

COMMIT;

-- ── SECTION 2: ROW-LEVEL SECURITY ───────────────────────────────────────────
BEGIN;

ALTER TABLE public.notification_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens             ENABLE ROW LEVEL SECURITY;

-- ⚠ NO anon POLICY ANYWHERE IN THIS FILE. These rows say who was told what
-- about which lesson. RLS denies by default and that absence is the protection.

DROP POLICY IF EXISTS notification_events_read_own ON public.notification_events;
CREATE POLICY notification_events_read_own
  ON public.notification_events FOR SELECT TO authenticated
  USING (public.notification_events.user_id = auth.uid());

DROP POLICY IF EXISTS notification_events_staff_read ON public.notification_events;
CREATE POLICY notification_events_staff_read
  ON public.notification_events FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS notification_deliveries_read_own ON public.notification_deliveries;
CREATE POLICY notification_deliveries_read_own
  ON public.notification_deliveries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notification_events e
     WHERE e.id = public.notification_deliveries.event_id AND e.user_id = auth.uid()
  ));

/**
 * ⚠ A STUDENT MAY MARK THEIR OWN IN-APP MESSAGE READ, AND NOTHING ELSE.
 * Scoped to channel='in_app' in the USING and again in the WITH CHECK, because
 * a policy that admits a row for UPDATE without re-stating the condition lets
 * the row be moved OUT of the set it was allowed from — here, flipping an
 * email delivery to 'sent'. Column-level UPDATE narrows it to read_at alone.
 */
DROP POLICY IF EXISTS notification_deliveries_mark_read ON public.notification_deliveries;
CREATE POLICY notification_deliveries_mark_read
  ON public.notification_deliveries FOR UPDATE TO authenticated
  USING (
    public.notification_deliveries.channel = 'in_app'
    AND EXISTS (
      SELECT 1 FROM public.notification_events e
       WHERE e.id = public.notification_deliveries.event_id AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.notification_deliveries.channel = 'in_app'
    AND EXISTS (
      SELECT 1 FROM public.notification_events e
       WHERE e.id = public.notification_deliveries.event_id AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS notification_deliveries_staff_all ON public.notification_deliveries;
CREATE POLICY notification_deliveries_staff_all
  ON public.notification_deliveries FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- A device registers and revokes itself; it never reads another's.
DROP POLICY IF EXISTS push_tokens_own ON public.push_tokens;
CREATE POLICY push_tokens_own
  ON public.push_tokens FOR ALL TO authenticated
  USING (public.push_tokens.user_id = auth.uid())
  WITH CHECK (public.push_tokens.user_id = auth.uid());

COMMIT;

-- ── SECTION 3: GRANTS + NOTIFY ──────────────────────────────────────────────
BEGIN;

GRANT SELECT ON public.notification_events TO authenticated;
GRANT SELECT ON public.notification_deliveries TO authenticated;

-- ⚠ COLUMN-LEVEL UPDATE, BECAUSE RLS FILTERS ROWS AND NEVER COLUMNS. The policy
-- above admits the right ROW; only this stops a student writing status='sent',
-- provider_message_id, or attempts on it.
GRANT UPDATE (read_at) ON public.notification_deliveries TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;

-- ⚠ NO INSERT ON EVENTS OR DELIVERIES FOR ANY CLIENT. Notifications are created
-- server-side, in the transaction that caused them. A student who could insert
-- could send themselves — or forge — a schedule change.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.notification_events     FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.notification_deliveries FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.push_tokens             FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- (a) ⚠ THE IDEMPOTENCY KEY — the reason this file exists
-- INSERT INTO public.notification_events (user_id,kind,idempotency_key)
--   VALUES (<u>,'session_moved','session_moved:abc:2026-09-19T17:00Z:<u>');
-- INSERT ... the identical row again;
-- PASS: duplicate key violates "notification_events_idempotency".
--   This is what stops a retried server action emailing twice.
--
-- (b) ONE DELIVERY PER CHANNEL PER EVENT
-- (two 'email' deliveries for one event)
-- PASS: duplicate key violates "notification_deliveries_one_per_channel".
-- ...and 'email' + 'in_app' + 'push' for the SAME event all insert — three
--    channels, one fact. Without this half, (b) proves only that the index
--    rejects things.
--
-- (c) a row addressed to nobody is refused
-- (user_id NULL and email NULL) PASS: violates notification_events_has_recipient.
--
-- (d) a 'sent' delivery must carry sent_at
-- PASS: violates notification_deliveries_sent_needs_time.
--
-- (e) anon is refused OUTRIGHT on all three
-- SET ROLE anon; SELECT count(*) FROM public.notification_events;
-- PASS: permission denied. Repeat for deliveries and push_tokens.
--   ⚠ A 0 WOULD BE A FAILURE — it would mean a grant exists and RLS filtered.
--
-- (f) student A sees only their own events, and only their own deliveries
-- (from A's session, with an event for B present) PASS: A's rows only.
--
-- (g) ⚠ A CAN MARK AN in_app DELIVERY READ, AND NOTHING ELSE
-- (from A's session) UPDATE public.notification_deliveries SET read_at=now()
--   WHERE channel='in_app';                                   PASS: 1 row.
-- UPDATE ... SET status='sent' WHERE channel='in_app';        PASS: permission
--   denied for column status — the column-level grant, not the policy.
-- UPDATE ... SET read_at=now() WHERE channel='email';         PASS: 0 rows —
--   the policy, not the grant. Both halves matter and they fail differently.
--
-- (h) A cannot insert an event for themselves or anyone
-- PASS: permission denied — no INSERT grant to authenticated at all.
--
-- (i) a device registers only its own token
-- (from A's session) INSERT INTO public.push_tokens (user_id,token,platform)
--   VALUES (<B's uid>,'tok','ios');
-- PASS: new row violates row-level security policy.
-- ...with auth.uid(): inserted.
--
-- (j) cleanup by captured id. ⚠ Deleting the probe USER cascades events and
--    tokens; deliveries cascade from events.
--
-- (k) the three privileges
-- SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public'
--    AND table_name IN ('notification_events','notification_deliveries','push_tokens')
--    AND grantee IN ('anon','authenticated')
--    AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- PASS: zero rows.
--
-- (l) anon holds NO privilege at all on any of the three
-- SELECT table_name, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public'
--    AND table_name IN ('notification_events','notification_deliveries','push_tokens')
--    AND grantee='anon';
-- PASS: zero rows.
