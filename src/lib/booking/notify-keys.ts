/**
 * Notification kinds and idempotency keys — the pure half of the outbox.
 *
 * ⚠ SPLIT OUT OF notify.ts SO A SUITE CAN IMPORT IT. notify.ts is `server-only`
 * and pulls the admin Supabase client through the "@/" alias; plain `node`
 * resolves neither, so anything a test needs to reason about has to live in a
 * module with no imports at all. This file has none, deliberately — adding one
 * would silently make the whole suite unloadable.
 */

export type NotifyKind =
  | "booking_confirmed" | "booking_cancelled" | "credit_restored"
  | "session_moved" | "session_cancelled" | "session_added"
  | "cancellation_requested" | "cancellation_resolved" | "announcement";

export type NotifyChannel = "email" | "in_app" | "push";

/**
 * ⚠ THE KEY IS BUILT FROM THE FACT, NEVER FROM THE MOMENT.
 *
 * 'booking_confirmed:<uuid>' recomputes to the same string on a retried server
 * action, a double-submitted form, or a replayed webhook — and 0053's unique
 * index refuses the second row. A key containing now() would be unique every
 * time, which is exactly the same as having no key at all.
 *
 * `extra` is for facts that legitimately recur for one subject: a lesson moved
 * twice is TWO things to tell somebody, so the new time goes in the key.
 */
export function eventKey(kind: NotifyKind, subjectId: string, extra?: string): string {
  return extra ? `${kind}:${subjectId}:${extra}` : `${kind}:${subjectId}`;
}
