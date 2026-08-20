import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { eventKey, type NotifyChannel, type NotifyKind } from "./notify-keys.ts";

/**
 * The notification outbox writer (§47, §50, §52) — 0053.
 *
 * ============================================================================
 * ⚠ THIS WRITES INTENT. NOTHING HERE SENDS ANYTHING.
 * ============================================================================
 * A row in notification_events says "this person should be told this fact".
 * A row in notification_deliveries says "…by this channel, and here is how that
 * went". No provider is called from this file and none is configured. That is
 * the whole point of an outbox: the intent is durable before the send exists,
 * so the sender can be written later and pick up everything already queued.
 *
 * ⚠ IN-APP IS DIFFERENT FROM THE OTHER TWO, AND IS MARKED sent IMMEDIATELY.
 * For email and push, writing the row is a promise someone else must keep. For
 * in_app, writing the row IS the delivery — the bell reads
 * notification_deliveries directly, so the message is in front of the student
 * the moment this commits. Leaving it 'pending' would put it in the sender's
 * queue forever waiting for a send that is not a thing that happens.
 *
 * ⚠ push IS NOT QUEUED YET, DELIBERATELY. push_tokens exists and is empty, and
 * no sender exists. A 'pending' push row would sit in the queue indefinitely
 * and make the queue's depth a lie. The channel is added when there is
 * something to send to.
 *
 * ============================================================================
 * ⚠ IT CANNOT SHARE A TRANSACTION WITH ITS CAUSE, AND SAYS SO
 * ============================================================================
 * 0053's header describes the row being written IN THE SAME TRANSACTION as the
 * thing it describes. PostgREST gives no transaction across statements, so this
 * runs immediately after the cause instead. Two consequences, both handled:
 *
 *   · A crash between the two loses the notification, not the booking. The
 *     idempotency key is built from the FACT, so a reconciliation job can
 *     recreate it later and the unique index makes that safe.
 *   · A failure here must NEVER fail the caller. The lesson is booked; telling
 *     a student their booking failed because an outbox row did not write would
 *     be a lie about the thing they care about.
 *
 * The RPC that would make it atomic is the same one bookWithCredit wants, and
 * it is the first thing to build at the next schema window.
 */

// ⚠ RE-EXPORTED so a caller has one import site for the outbox and does not
// have to know which half of it is pure.
export { eventKey };
export type { NotifyChannel, NotifyKind };

export type NotifyResult =
  | { ok: true; eventId: string; channels: NotifyChannel[] }
  /** The fact was already recorded. A retry, not a fault. */
  | { ok: true; eventId: null; channels: []; duplicate: true }
  | { ok: false; reason: string };

export async function notify(args: {
  kind: NotifyKind;
  userId: string | null;
  email: string | null;
  subjectType?: string;
  subjectId?: string;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
  channels?: NotifyChannel[];
}): Promise<NotifyResult> {
  // ⚠ MIRRORS notification_events_has_recipient. Refused here so the caller
  // gets a sentence instead of a 23514, and refused again by the database.
  if (args.userId === null && args.email === null) {
    return { ok: false, reason: "no recipient: both user_id and email are null" };
  }

  const channels = args.channels ?? ["email", "in_app"];
  const db = createAdminClient();

  const ev = await db.from("notification_events").insert({
    user_id: args.userId,
    email: args.email,
    kind: args.kind,
    subject_type: args.subjectType ?? null,
    subject_id: args.subjectId ?? null,
    // ⚠ FACTS, NOT COPY. Old time, new time, lesson title — never a rendered
    // sentence. Copy lives in templates that can be fixed and re-rendered; a
    // stored sentence cannot be corrected after the fact.
    payload: args.payload ?? {},
    idempotency_key: args.idempotencyKey,
  }).select("id").single();

  if (ev.error) {
    // ⚠ A DUPLICATE KEY IS A SUCCESS. It means this exact fact is already
    // recorded and somebody is already being told. Treating it as an error
    // would make every retry look like a fault and encourage a caller to
    // "fix" it by removing the key.
    if (ev.error.code === "23505") return { ok: true, eventId: null, channels: [], duplicate: true };
    return { ok: false, reason: `${ev.error.code}: ${ev.error.message}` };
  }

  const eventId = (ev.data as { id: string }).id;
  const now = new Date().toISOString();
  const written: NotifyChannel[] = [];

  for (const channel of channels) {
    const row = await db.from("notification_deliveries").insert({
      event_id: eventId,
      channel,
      // See the header: for in_app, writing the row IS the delivery.
      status: channel === "in_app" ? "sent" : "pending",
      sent_at: channel === "in_app" ? now : null,
    }).select("id");
    // A duplicate delivery is the same non-event as a duplicate key above.
    if (!row.error || row.error.code === "23505") written.push(channel);
    else {
      console.error("[notify] delivery row refused", { eventId, channel, code: row.error.code });
    }
  }

  return { ok: true, eventId, channels: written };
}

/**
 * Fire-and-report: never throws, never propagates into the caller's result.
 *
 * ⚠ THE CALLER'S ACTION ALREADY SUCCEEDED BY THE TIME THIS RUNS. Reporting a
 * booking as failed because an outbox row did not write would be a lie about
 * the only thing the student cares about. It is logged with the key, which is
 * what makes it replayable — the key IS the recovery handle.
 */
export async function notifyQuietly(args: Parameters<typeof notify>[0]): Promise<void> {
  try {
    const r = await notify(args);
    if (!r.ok) {
      console.error("[notify] outbox write failed", { key: args.idempotencyKey, reason: r.reason });
    }
  } catch (e) {
    console.error("[notify] outbox write threw", {
      key: args.idempotencyKey, error: e instanceof Error ? e.message : String(e),
    });
  }
}
