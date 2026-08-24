import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { grantFor, idempotencyKeyFor } from "./entitlements";
import { isCourse, isMode, isPackage, type Course, type Mode, type Package } from "./tuition-types";

/**
 * Turn a verified Stripe event into an entitlement — exactly once.
 *
 * ============================================================================
 * ⚠ IDEMPOTENCY IS ENFORCED BY THE DATABASE, NOT BY A CHECK-THEN-WRITE.
 * ============================================================================
 * lesson_credit_transactions carries a UNIQUE index on idempotency_key
 * (0047), so a replayed event fails the INSERT. Reading first and then writing
 * would leave a window between the two in which Stripe's retry — which it
 * sends by design on any timeout — lands a second batch of credits. The unique
 * violation is the SUCCESS path here: it means the grant already happened.
 *
 * ⚠ AND THE GRANT IS DERIVED FROM METADATA WE SET, NOT FROM THE AMOUNT PAID.
 * Reading "how many credits" off a price would make a discount silently change
 * what somebody owns.
 */

/** Postgres unique-violation. A replay, not a failure. */
const UNIQUE_VIOLATION = "23505";

export type GrantOutcome =
  | { status: "granted"; detail: string }
  | { status: "already_granted"; detail: string }
  | { status: "ignored"; detail: string }
  | { status: "failed"; detail: string };

type SessionLike = {
  id?: unknown;
  client_reference_id?: unknown;
  metadata?: Record<string, unknown> | null;
  customer?: unknown;
  currency?: unknown;
  amount_total?: unknown;
};

export async function applyGrant(args: {
  eventId: string;
  eventType: string;
  session: SessionLike;
}): Promise<GrantOutcome> {
  const { eventId, eventType, session } = args;
  const md = (session.metadata ?? {}) as Record<string, unknown>;

  const course = md.course, mode = md.mode, pkg = md.package;
  if (!isCourse(course) || !isMode(mode) || !isPackage(pkg)) {
    /**
     * ⚠ IGNORED, NOT FAILED. An event for something this app did not sell — a
     * Payment Link, a dashboard invoice, another integration — is not an error
     * and must be acknowledged, or Stripe retries it forever.
     */
    return { status: "ignored", detail: `no ailemy selection metadata on ${eventType}` };
  }

  const userId = typeof session.client_reference_id === "string" ? session.client_reference_id
    : typeof md.user_id === "string" ? md.user_id : null;
  if (!userId) {
    // ⚠ FAILED, NOT IGNORED. We sold something and cannot say to whom; that
    // must be retried and, if it persists, seen by a human.
    return { status: "failed", detail: "no ailemy user id on a session we created" };
  }

  const grant = grantFor(course as Course, mode as Mode, pkg as Package);
  if (!grant) return { status: "ignored", detail: `no entitlement for ${mode}/${pkg}` };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (err) {
    return { status: "failed", detail: err instanceof Error ? err.message : "admin client unavailable" };
  }

  if (grant.kind === "one_to_one_credits") {
    const res = await db.from("lesson_credit_transactions").insert({
      user_id: userId,
      delta: grant.credits,
      reason: "purchase",
      idempotency_key: idempotencyKeyFor(eventId),
    });
    if (res.error) {
      if (res.error.code === UNIQUE_VIOLATION) {
        return { status: "already_granted", detail: `${eventId} was already applied` };
      }
      return { status: "failed", detail: `${res.error.code}: ${res.error.message}` };
    }
    return { status: "granted", detail: `${grant.credits} ${grant.level} credit(s)` };
  }

  /**
   * ⚠ A GROUP PURCHASE WRITES AN ENTITLEMENT, NEVER A CREDIT ROW. Different
   * table, different shape — the mistake cannot be made by editing a number.
   */
  const res = await db.from("entitlements").insert({
    user_id: userId,
    kind: "cohort",
    subject_ref: grant.course,
    source: "stripe",
    source_ref: typeof session.id === "string" ? session.id : eventId,
    status: "active",
  });
  if (res.error) {
    if (res.error.code === UNIQUE_VIOLATION) {
      // entitlements_one_active_per_subject — they already hold this seat.
      return { status: "already_granted", detail: `${grant.course} already active` };
    }
    return { status: "failed", detail: `${res.error.code}: ${res.error.message}` };
  }
  return { status: "granted", detail: `${grant.course} ${grant.term} enrolment` };
}

/**
 * Which events carry a completed purchase.
 *
 * ⚠ ONLY WHAT THIS ARCHITECTURE NEEDS (§22). Subscribing to every event and
 * ignoring most of them makes the log useless and the retry behaviour
 * unpredictable. `async_payment_succeeded` matters because a delayed method
 * completes after the browser has gone; `async_payment_failed` and the
 * subscription-lifecycle events are acknowledged so Stripe stops retrying, and
 * are logged for a human rather than silently dropped.
 */
export const GRANTING_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
] as const;

export const ACKNOWLEDGED_EVENTS = [
  "checkout.session.async_payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;
