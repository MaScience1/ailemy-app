"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { planRestore } from "@/lib/booking/credits.ts";
import { eventKey, notifyQuietly } from "@/lib/booking/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Resolving a cancellation request (§54) — the other end of 0052.
 *
 * ============================================================================
 * ⚠ RESOLVING IS A DECISION ABOUT MONEY, SO IT RECORDS WHO MADE IT
 * ============================================================================
 * 0052 exists because "I was told I'd get a refund" has to be answerable. That
 * needs four things on the row — what was decided, when, by whom, and any note
 * — and the constraint refuses a resolution missing the first two. This action
 * supplies all four or does not write.
 *
 * ⚠ resolved_by COMES FROM THE ADMIN'S OWN SESSION, NOT FROM THE FORM. The
 * write goes through service_role, which has no auth.uid(), so the id is read
 * from the session client first and passed in. A form field would let a browser
 * name somebody else as the decision-maker on a refund record.
 */

type Result = { ok: true; message: string } | { ok: false; error: string };

const RESOLUTIONS = ["refunded", "credited", "rescheduled", "declined"] as const;
type Resolution = (typeof RESOLUTIONS)[number];

/**
 * ⚠ THREE OF THE FOUR OUTCOMES CANCEL THE LESSON. `declined` does not — that is
 * what declining a cancellation MEANS, and leaving the booking confirmed is the
 * whole difference between the two answers. Backwards, this frees a slot the
 * family was told to keep attending.
 */
const CANCELS_THE_LESSON: Record<Resolution, boolean> = {
  refunded: true, credited: true, rescheduled: true, declined: false,
};

function explain(error: { code?: string; message?: string }, context: string): string {
  const code = error.code ?? "";
  if (["PGRST205", "42P01", "PGRST204", "42703"].includes(code)) {
    return `Migration 0052 is not applied on this deployment (${context}: ${code}).`;
  }
  if (code === "23514") {
    return `The database refused this — a resolved request must carry an outcome and a timestamp. (${error.message})`;
  }
  if (code === "23001") {
    return "The credit ledger is append-only and refused this. The request was NOT resolved.";
  }
  return error.message ?? `Unknown error (${context}).`;
}

export async function resolveRequest(id: string, _prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing request id." };

  const resolution = String(fd.get("resolution") ?? "").trim() as Resolution;
  if (!RESOLUTIONS.includes(resolution)) {
    return { ok: false, error: `Choose one of: ${RESOLUTIONS.join(", ")}.` };
  }
  const note = String(fd.get("resolution_note") ?? "").trim() || null;

  const session = await createServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired — sign in again." };

  const db = createAdminClient();
  const now = new Date().toISOString();

  const current = await db.from("cancellation_requests")
    .select("id,booking_id,user_id,status").eq("id", id).maybeSingle();
  if (current.error) return { ok: false, error: explain(current.error, "cancellation_requests") };
  if (!current.data) return { ok: false, error: "That request no longer exists — reload the page." };
  const req = current.data as { booking_id: string; user_id: string | null; status: string };
  if (req.status !== "open") return { ok: false, error: "That request is already resolved." };

  /**
   * ⚠ THE LESSON IS CANCELLED FIRST AND THE REQUEST IS MARKED RESOLVED LAST.
   * Reversed, a failure on the second write leaves the queue saying "resolved,
   * refunded" over a lesson still sitting confirmed on the family's calendar —
   * the exact disagreement 0052 exists to prevent. This way a failure leaves
   * the request OPEN, which is visible and re-runnable.
   */
  if (CANCELS_THE_LESSON[resolution]) {
    const c = await db.from("private_bookings")
      .update({ status: "cancelled", cancelled_at: now, cancelled_by: "admin", updated_at: now })
      .eq("id", req.booking_id).eq("status", "confirmed").select("id");
    if (c.error) return { ok: false, error: explain(c.error, "private_bookings") };
    // 0 rows is not a failure: the lesson may already have been cancelled
    // another way, and that must not block the decision being recorded.
  }

  // ⚠ A CREDIT COMES BACK ONLY FOR 'credited', AND ONLY IF ONE WAS SPENT.
  // planRestore refuses a booking that never consumed a credit — restoring one
  // for a cash lesson would mint a credit from nothing — and refuses a second
  // restore. 0047's partial index is the backstop behind both.
  let creditNote = "";
  if (resolution === "credited" && req.user_id) {
    const led = await db.from("lesson_credit_transactions")
      .select("id,user_id,delta,reason,booking_id,idempotency_key,expires_at,created_at")
      .eq("user_id", req.user_id);
    if (led.error) return { ok: false, error: explain(led.error, "lesson_credit_transactions") };
    const txs = ((led.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id), userId: String(r.user_id), delta: Number(r.delta),
      reason: String(r.reason) as never, bookingId: r.booking_id ? String(r.booking_id) : null,
      idempotencyKey: r.idempotency_key ? String(r.idempotency_key) : null,
      expiresAt: r.expires_at ? String(r.expires_at) : null, createdAt: String(r.created_at),
    }));
    const plan = planRestore(txs, req.user_id, req.booking_id);
    if (plan.ok) {
      const ins = await db.from("lesson_credit_transactions").insert({
        user_id: plan.tx.userId, delta: plan.tx.delta, reason: plan.tx.reason,
        booking_id: plan.tx.bookingId, idempotency_key: plan.tx.idempotencyKey,
        expires_at: plan.tx.expiresAt,
      });
      creditNote = ins.error ? " ⚠ The credit did NOT go back — check the ledger." : " A credit went back.";
      if (ins.error) console.error("[admin] credit restore failed", { id, code: ins.error.code });
    } else {
      // ⚠ REPORTED, NOT SWALLOWED. "Credited" on a lesson that never consumed a
      // credit is a decision the admin should know did not take effect.
      creditNote = plan.reason === "nothing-was-spent"
        ? " No credit was restored — that lesson was not paid for with one."
        : " No credit was restored — one was already given back.";
    }
  }

  const done = await db.from("cancellation_requests").update({
    status: "resolved", resolution, resolution_note: note,
    resolved_by: user.id, resolved_at: now, updated_at: now,
  }).eq("id", id).eq("status", "open").select("id");

  if (done.error) return { ok: false, error: explain(done.error, "cancellation_requests") };
  if ((done.data ?? []).length === 0) {
    return { ok: false, error: "Somebody else resolved that request first. Reload the page." };
  }

  await notifyQuietly({
    kind: "cancellation_resolved",
    userId: req.user_id, email: null,
    subjectType: "cancellation_request", subjectId: id,
    payload: { resolution, bookingId: req.booking_id, lessonCancelled: CANCELS_THE_LESSON[resolution] },
    idempotencyKey: eventKey("cancellation_resolved", id),
  });

  for (const p of ["/profile", "/my-tuition", "/calendar", "/admin/cancellations"]) revalidatePath(p);
  return { ok: true, message: `Recorded as ${resolution}.${creditNote}` };
}
