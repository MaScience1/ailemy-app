"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

// ⚠ CANCELLATION_CUTOFF_HOURS is NOT re-exported from here. A "use server"
// module may only export async functions, and re-exporting a constant through
// one fails the build with a message that does not mention the constant.
import { planCancellation, canRedeem, explainCancellation } from "./cancellation.ts";
import { stripeConfig } from "./config.ts";
import { planRestore, planSpend } from "./credits.ts";
import { eventKey, notifyQuietly } from "./notify";
import { parseSlotKey } from "./slots.ts";
import { loadOpenSlots } from "./readers";
import { loadMyTuition } from "./student";

/**
 * The booking lifecycle: the part that WRITES (§31, §36, §38–§42, §80).
 *
 * ============================================================================
 * ⚠ EVERY DECISION HERE IS MADE BY A PURE FUNCTION THAT ALREADY EXISTS
 * ============================================================================
 * planSpend, planRestore, planCancellation and canRedeem decide; this file
 * executes. Nothing below re-states a rule — if a refusal is wrong, it is wrong
 * in one place, provable with no credentials, and already sabotage-tested.
 *
 * ⚠ WHAT IS BUILT AND WHAT IS NOT, AND WHY THE LINE IS THERE.
 * Redeeming a credit is COMPLETE. Buying anything is not, and cannot be: Stripe
 * has no keys in any environment, so beginCheckout() refuses loudly rather than
 * half-working. That is not the same line as "no booking until Stripe" — see
 * canRedeem's header. A credit is money already taken.
 */

export type BookingResult = { ok: true; message: string } | { ok: false; error: string };

const SLOT_PATHS = [
  // ⚠ /my-tuition is NOT here: it redirects to /profile and has no content
  // of its own to invalidate. Revalidating a redirect is a no-op that reads
  // like coverage.
  "/", "/calendar", "/tuition", "/tuition/one-to-one", "/profile",
  "/chemistry", "/biology", "/physics",
];
function refresh() {
  for (const p of SLOT_PATHS) revalidatePath(p);
}

const NOT_MIGRATED = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);

/**
 * ⚠ EVERY CODE THAT CAN REACH A STUDENT IS TRANSLATED, AND THE TWO RACE CODES
 * ARE TRANSLATED DIFFERENTLY. 23P01 is somebody else got there first; 23505 on
 * the ledger is your own request arriving twice. Telling a student "an error
 * occurred" for either is how a support conversation starts with no facts.
 */
function explain(error: { code?: string; message?: string }, context: string): string {
  const code = error.code ?? "";
  if (NOT_MIGRATED.has(code)) {
    return `Booking is not switched on yet on this deployment. (${context}: ${code})`;
  }
  if (code === "23P01") {
    return "Someone booked that time while you were deciding. Pick another — nothing has been taken from your account.";
  }
  if (code === "23505") {
    return "That request has already gone through. Refresh the page to see it.";
  }
  if (code === "23514") return `The database refused this: ${error.message}`;
  if (code === "23001") {
    return "The credit ledger is append-only and refused this change. Nothing was altered — please tell us.";
  }
  if (code === "42501") {
    return `Permission denied writing ${context}. This is a grant problem on the server, not something you did.`;
  }
  return error.message ?? `Unknown error (${context}).`;
}

// ── redeem a credit ─────────────────────────────────────────────────────────

/**
 * Book a 1-to-1 lesson with a credit the student already holds (§31, §36).
 *
 * ============================================================================
 * ⚠ THE BOOKING IS WRITTEN FIRST AND THE CREDIT SECOND. THAT ORDER IS CHOSEN.
 * ============================================================================
 * PostgREST gives no transaction across two statements, so one of them lands
 * first and the pair can break in the middle. The two failure directions are
 * not equally bad:
 *
 *   credit first, booking second  →  the booking loses the 23P01 race, the
 *                                    credit is already gone, and there is no
 *                                    booking id to restore it against.
 *                                    THE STUDENT PAYS AND GETS NOTHING.
 *   booking first, credit second  →  the ledger write fails, the compensating
 *                                    delete below removes the booking. If even
 *                                    that fails, the student has a lesson they
 *                                    did not pay a credit for.
 *                                    WE GIVE AWAY A LESSON.
 *
 * Giving away a lesson is recoverable and detectable. Taking a credit and
 * delivering nothing is neither, and it is the version a family would be right
 * to be angry about. So: booking first.
 *
 * ⚠ THE CORRECT FIX IS AN RPC DOING BOTH IN ONE TRANSACTION, and it is not
 * written here because the schema is closed through 0055 (0056 is reserved for
 * the 0045 slot_fits CHECK). It is the first thing to build at the next window.
 *
 * ⚠ AND THE RACE IS STILL DECIDED BY THE DATABASE. isStillOpen() below is
 * courtesy — two students can both read "open" microseconds apart. 0046's
 * exclusion constraint is what actually serialises them, and 23P01 is the
 * loser's answer.
 */
export async function bookWithCredit(_prev: BookingResult | null, fd: FormData): Promise<BookingResult> {
  const key = String(fd.get("slot_key") ?? "").trim();
  const slotRef = parseSlotKey(key);
  if (!slotRef) return { ok: false, error: "That time is no longer on the page. Reload and try again." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "Sign in to use a lesson credit." };
  }

  const now = new Date();
  const me = await loadMyTuition(now);

  // ⚠ NOTE THE ABSENCE: stripeConfig() IS NOT CONSULTED. A credit is already
  // paid for; keyless Stripe blocks buying, not redeeming.
  const redeem = canRedeem({ signedIn: me.signedIn, creditBalance: me.creditBalance });
  if (!redeem.ok) {
    return {
      ok: false,
      error: redeem.reason === "not-signed-in"
        ? "Sign in to use a lesson credit."
        : "You have no lesson credits left.",
    };
  }

  // ⚠ RE-CHECKED AGAINST FRESH DATA, IGNORING THIS STUDENT'S OWN HOLD. The list
  // the browser rendered is already stale by the time it is clicked.
  const day = slotRef.startsAt.toISOString().slice(0, 10);
  const fresh = await loadOpenSlots({
    from: day, to: day, now, ignoreHoldsForEmail: user.email,
  });
  if (fresh.reason) return { ok: false, error: `Could not check that time (${fresh.reason}).` };
  const slot = fresh.slots.find((s) => s.key === key);
  if (!slot) {
    return { ok: false, error: "That time is no longer available. Pick another — nothing has been taken from your account." };
  }

  const db = createAdminClient();

  // ── 1. the booking. The exclusion constraint decides the race. ───────────
  const created = await db.from("private_bookings").insert({
    teacher_id: slot.teacherId,
    user_id: user.id,
    email: user.email,
    subject: slot.subject,
    starts_at: slot.startsAt.toISOString(),
    ends_at: slot.endsAt.toISOString(),
    // paid_with 'credit' is what makes private_bookings_single_needs_payment
    // inapplicable — a credit booking has no payment_ref and must not invent one.
    paid_with: "credit",
    status: "confirmed",
    // ⚠ booking_ref IS NOT SET HERE. 0051's DEFAULT generates it, and the
    // column is selected back so the student can be told it in the same breath
    // as "booked" — a reference they are given only by email is a reference
    // they do not have when they need it.
  }).select("id,booking_ref").single();

  if (created.error) return { ok: false, error: explain(created.error, "private_bookings") };
  const bookingId = (created.data as { id: string }).id;

  // ── 2. the credit. planSpend refuses a replay against this same booking. ─
  const spend = planSpend(me.ledger, user.id, bookingId, now);
  if (!spend.ok) {
    await compensate(db, bookingId, "planner refused the spend");
    return {
      ok: false,
      error: spend.reason === "no-credits"
        ? "You have no lesson credits left."
        : "That credit has already been used for this lesson.",
    };
  }

  const debited = await db.from("lesson_credit_transactions").insert({
    user_id: spend.tx.userId, delta: spend.tx.delta, reason: spend.tx.reason,
    booking_id: spend.tx.bookingId, idempotency_key: spend.tx.idempotencyKey,
    expires_at: spend.tx.expiresAt,
  });

  if (debited.error) {
    await compensate(db, bookingId, `${debited.error.code}`);
    return { ok: false, error: explain(debited.error, "lesson_credit_transactions") };
  }

  // ⚠ THE STUDENT'S OWN HOLD ON THIS SLOT IS NOW MEANINGLESS. Left behind it
  // would block the slot for fifteen minutes AFTER it was legitimately booked —
  // harmless for them, misleading for everyone else. Deleted by the identity we
  // hold, never a sweep of the table.
  await db.from("booking_holds").delete()
    .eq("teacher_id", slot.teacherId)
    .eq("starts_at", slot.startsAt.toISOString())
    .ilike("email", user.email);

  /**
   * ⚠ THE OUTBOX ROW, AFTER THE FACT IT DESCRIBES — not before, and not inside
   * the same transaction, because PostgREST does not offer one. It is written
   * quietly: the lesson IS booked, and failing the student's booking because an
   * outbox row did not write would be a lie about the thing they care about.
   *
   * The key is the BOOKING ID, so a double-submitted form records one fact.
   */
  const ref = (created.data as { booking_ref?: string | null }).booking_ref ?? null;
  await notifyQuietly({
    kind: "booking_confirmed",
    userId: user.id,
    email: user.email,
    subjectType: "private_booking",
    subjectId: bookingId,
    // Facts a template renders, never a rendered sentence.
    payload: {
      bookingRef: ref,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      subject: slot.subject,
      paidWith: "credit",
    },
    idempotencyKey: eventKey("booking_confirmed", bookingId),
  });

  refresh();
  return {
    ok: true,
    message: ref
      ? `Booked — your reference is ${ref}. It is on your calendar.`
      : "Booked. It is on your calendar.",
  };
}

/**
 * ⚠ A COMPENSATING DELETE, AND IT SHOUTS IF IT FAILS.
 *
 * Swallowing this error would leave a confirmed lesson nobody paid for and no
 * record that it happened. It cannot be retried automatically — if the delete
 * is failing, retrying it is failing too — so it goes to the log with the
 * booking id, which is the only thing that makes it findable later.
 */
async function compensate(
  db: ReturnType<typeof createAdminClient>, bookingId: string, why: string,
): Promise<void> {
  const undo = await db.from("private_bookings").delete().eq("id", bookingId).select("id");
  if (undo.error || (undo.data ?? []).length === 0) {
    console.error(
      "[booking] ORPHANED BOOKING — credit was not debited and the booking could not be removed.",
      { bookingId, why, deleteError: undo.error?.code ?? "no rows deleted" },
    );
  }
}

// ── cancel ──────────────────────────────────────────────────────────────────

/**
 * Cancel a lesson the student paid for with a credit, in good time (§40).
 *
 * ⚠ IT READS THE BOOKING AS THE STUDENT FIRST. The row that decides the
 * outcome comes back through 0046's own-row policy, so a booking that is not
 * theirs is not merely refused by planCancellation — it is never returned. The
 * planner's "not-yours" branch is the second line, not the first.
 */
export async function cancelOwnBooking(bookingId: string): Promise<BookingResult> {
  if (!bookingId) return { ok: false, error: "Missing booking id." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to manage your lessons." };

  const now = new Date();
  const row = await supabase
    .from("private_bookings")
    .select("id,user_id,starts_at,status,paid_with")
    .eq("id", bookingId)
    .maybeSingle();

  if (row.error) return { ok: false, error: explain(row.error, "private_bookings") };
  if (!row.data) return { ok: false, error: "That booking is not on your account." };

  const b = row.data as unknown as Record<string, unknown>;
  const outcome = planCancellation({
    booking: {
      id: bookingId,
      userId: typeof b.user_id === "string" ? b.user_id : null,
      startsAt: new Date(String(b.starts_at)),
      status: String(b.status ?? ""),
      paidWith: String(b.paid_with ?? "single"),
    },
    viewerId: user.id,
    now,
  });

  // ⚠ A REQUEST IS NOT A FAILURE, AND THE MESSAGE SAYS SO. "request" means the
  // student should be offered the cancellation-request form, not told no.
  if (!outcome.ok) return { ok: false, error: explainCancellation(outcome) };

  const db = createAdminClient();

  // ⚠ GUARDED ON status='confirmed' IN THE UPDATE ITSELF, not only in the
  // planner. Two clicks a second apart both pass planCancellation; only the
  // first matches this filter, so only the first restores a credit.
  const cancelled = await db.from("private_bookings")
    .update({
      status: "cancelled", cancelled_at: now.toISOString(),
      cancelled_by: "student", updated_at: now.toISOString(),
    })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .select("id");

  if (cancelled.error) return { ok: false, error: explain(cancelled.error, "private_bookings") };
  if ((cancelled.data ?? []).length === 0) {
    return { ok: false, error: "That lesson was already cancelled." };
  }

  // ⚠ THE LEDGER IS READ AGAIN, NOT REUSED. planRestore's "already-restored"
  // check is only as good as the rows it is given, and a stale read would let a
  // double-click mint a second credit. 0047's partial index is the backstop.
  const me = await loadMyTuition(now);
  const restore = planRestore(me.ledger, user.id, bookingId);
  if (!restore.ok) {
    // The lesson IS cancelled — that part succeeded and must be reported as
    // success. The credit did not come back, and that is not the student's
    // problem to diagnose.
    console.error("[booking] cancelled but credit not restored", { bookingId, reason: restore.reason });
    refresh();
    return {
      ok: true,
      message: restore.reason === "already-restored"
        ? "Lesson cancelled. Your credit was already back on your account."
        : "Lesson cancelled. Your credit did not return automatically — we are on it.",
    };
  }

  const credited = await db.from("lesson_credit_transactions").insert({
    user_id: restore.tx.userId, delta: restore.tx.delta, reason: restore.tx.reason,
    booking_id: restore.tx.bookingId, idempotency_key: restore.tx.idempotencyKey,
    expires_at: restore.tx.expiresAt,
  });

  if (credited.error) {
    console.error("[booking] cancelled but credit insert failed", { bookingId, code: credited.error.code });
    refresh();
    return { ok: true, message: "Lesson cancelled. Your credit did not return automatically — we are on it." };
  }

  await notifyQuietly({
    kind: "booking_cancelled",
    userId: user.id, email: null,
    subjectType: "private_booking", subjectId: bookingId,
    payload: { cancelledBy: "student", creditRestored: true },
    idempotencyKey: eventKey("booking_cancelled", bookingId),
  });
  // ⚠ A SECOND, SEPARATE FACT. "Your lesson is cancelled" and "your credit is
  // back" are two things a student checks independently, and folding them into
  // one row would mean the credit note could never be re-sent without re-sending
  // the cancellation. Distinct keys, distinct rows.
  await notifyQuietly({
    kind: "credit_restored",
    userId: user.id, email: null,
    subjectType: "private_booking", subjectId: bookingId,
    payload: { delta: 1, reason: "cancellation_refund" },
    idempotencyKey: eventKey("credit_restored", bookingId),
  });

  refresh();
  return { ok: true, message: "Lesson cancelled and your credit is back on your account." };
}

/**
 * Ask a human to cancel something the student cannot cancel themselves (§41).
 *
 * ⚠ THIS IS THE 0052 PATH AND IT DEGRADES HONESTLY. Until the migration is
 * applied the table does not exist, and the student is told to email rather
 * than shown a form that silently loses their message.
 *
 * ⚠ IT NEVER NAMES THE OUTCOME COLUMNS. 0052's column-level INSERT grant covers
 * booking_id, user_id, requested_by_email, reason and student_note only —
 * naming `status` here would be 42501 even sending the legal value 'open'. The
 * defaults fill the rest, which is exactly the row the policy permits.
 */
export async function requestCancellation(_prev: BookingResult | null, fd: FormData): Promise<BookingResult> {
  const bookingId = String(fd.get("booking_id") ?? "").trim();
  const reason = String(fd.get("reason") ?? "").trim();
  if (!bookingId) return { ok: false, error: "Missing booking id." };
  if (!reason) return { ok: false, error: "Tell us briefly why, so we can sort it out in one reply." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Sign in to manage your lessons." };

  const owned = await supabase
    .from("private_bookings").select("id").eq("id", bookingId).maybeSingle();
  if (owned.error) return { ok: false, error: explain(owned.error, "private_bookings") };
  if (!owned.data) return { ok: false, error: "That booking is not on your account." };

  // ⚠ WRITTEN THROUGH THE SESSION CLIENT, DELIBERATELY. This is the one write
  // in this file that a STUDENT is allowed to make directly, so 0052's
  // insert-own policy and column grant are what authorise it. Using the admin
  // client here would bypass the very check that was just tightened.
  const created = await supabase.from("cancellation_requests").insert({
    booking_id: bookingId,
    user_id: user.id,
    requested_by_email: user.email,
    reason,
  }).select("id");

  if (created.error) {
    if (NOT_MIGRATED.has(created.error.code ?? "")) {
      return {
        ok: false,
        error: "Cancellation requests are not switched on yet. Email us and we will sort it out by hand.",
      };
    }
    if (created.error.code === "23505") {
      return { ok: false, error: "You already have an open request for this lesson. We will come back to you." };
    }
    return { ok: false, error: explain(created.error, "cancellation_requests") };
  }

  const requestId = ((created.data ?? []) as { id: string }[])[0]?.id ?? bookingId;
  await notifyQuietly({
    kind: "cancellation_requested",
    userId: user.id, email: user.email,
    subjectType: "cancellation_request", subjectId: requestId,
    // ⚠ THE REASON IS NOT COPIED INTO THE PAYLOAD. It is the family's own words
    // about why they cannot attend, it already lives on the request row, and a
    // second copy inside a jsonb blob is a second thing 0055's erasure would
    // have to find. One home for sensitive free text.
    payload: { bookingId, lessonStaysBooked: true },
    idempotencyKey: eventKey("cancellation_requested", requestId),
  });

  refresh();
  return { ok: true, message: "Request sent. We will come back to you — the lesson stays booked until we do." };
}

// ── buying ──────────────────────────────────────────────────────────────────

/**
 * ⚠ THE ONE PATH THAT IS GENUINELY BLOCKED, AND IT REFUSES RATHER THAN
 * PRETENDING. Stripe has no keys in any environment. This exists so that no
 * caller has to remember the rule, and so that the day a Buy button is wired up
 * it fails loudly in development rather than quietly in production.
 */
export async function beginCheckout(): Promise<BookingResult> {
  const cfg = stripeConfig();
  if (!cfg.configured) {
    console.warn("[booking] checkout attempted while Stripe is keyless; missing:", cfg.missing.join(", "));
    return {
      ok: false,
      error: "Booking opens soon — payments are not switched on yet. Register your interest and we will tell you the moment they are.",
    };
  }
  return {
    ok: false,
    error: "Checkout is not built yet. Stripe has keys, so this is the next thing to write.",
  };
}
