"use client";

import { useActionState, useState, useTransition } from "react";

import { cancelOwnBooking, requestCancellation, type BookingResult } from "@/lib/booking/actions";

/**
 * What a student may do about one booked lesson (§38–§42).
 *
 * ============================================================================
 * ⚠ THE POLICY IS DECIDED ON THE SERVER AND PASSED IN. THIS COMPONENT ONLY
 * RENDERS IT.
 * ============================================================================
 * `mode` comes from planCancellation() running server-side against the real
 * row. Deciding again in the browser would be a second implementation of the
 * cutoff, free to disagree with the one that actually enforces it — and the
 * browser's clock is not a clock we control.
 *
 * The action re-runs the same planner before writing, so a stale page cannot
 * cancel something the policy would now refuse.
 */
export type CancelMode =
  | { kind: "cancel" }
  | { kind: "request"; explanation: string }
  | { kind: "none"; explanation: string };

export function BookingActions({
  bookingId, mode, label,
}: {
  bookingId: string; mode: CancelMode; label: string;
}) {
  if (mode.kind === "cancel") return <CancelButton bookingId={bookingId} label={label} />;
  if (mode.kind === "request") {
    return <RequestForm bookingId={bookingId} explanation={mode.explanation} label={label} />;
  }
  return <span className="text-xs text-ink/50">{mode.explanation}</span>;
}

function CancelButton({ bookingId, label }: { bookingId: string; label: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<BookingResult | null>(null);
  // ⚠ CONFIRMED, BECAUSE IT SPENDS SOMETHING. Cancelling frees a slot somebody
  // else may take within seconds; a misclick is not undoable by clicking again.
  const [confirming, setConfirming] = useState(false);

  if (result?.ok) return <span className="text-xs text-emerald-800">{result.message}</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <span className="text-xs text-ink/70">Cancel this lesson and take your credit back?</span>
          <button
            type="button" disabled={pending}
            onClick={() => start(async () => setResult(await cancelOwnBooking(bookingId)))}
            className="rounded-full border border-ink/30 px-3 py-1 text-xs disabled:opacity-40"
          >
            {pending ? "Cancelling…" : "Yes, cancel"}
          </button>
          <button type="button" onClick={() => setConfirming(false)}
            className="rounded-full border border-ink/15 px-3 py-1 text-xs text-ink/60">
            Keep it
          </button>
        </>
      ) : (
        <button
          type="button" onClick={() => setConfirming(true)}
          className="text-xs underline underline-offset-2 text-ink/55 hover:text-ink"
          aria-label={`Cancel ${label}`}
        >
          Cancel
        </button>
      )}
      {result && !result.ok && (
        <span role="alert" className="text-xs text-red-800">{result.error}</span>
      )}
    </div>
  );
}

/**
 * ⚠ THE LESSON STAYS BOOKED WHILE THE REQUEST IS OPEN, AND THE FORM SAYS SO.
 * 0052's whole design rests on this: a request is a conversation about a
 * lesson, not a state of it. A student who assumes "requested" means
 * "cancelled" does not turn up, and that is the failure this sentence prevents.
 */
function RequestForm({
  bookingId, explanation, label,
}: {
  bookingId: string; explanation: string; label: string;
}) {
  const [state, submit, pending] = useActionState<BookingResult | null, FormData>(requestCancellation, null);
  const [open, setOpen] = useState(false);

  if (state?.ok) return <span className="text-xs text-emerald-800">{state.message}</span>;

  if (!open) {
    return (
      <button
        type="button" onClick={() => setOpen(true)}
        className="text-xs underline underline-offset-2 text-ink/55 hover:text-ink"
        aria-label={`Ask us to cancel ${label}`}
      >
        Ask to cancel
      </button>
    );
  }

  return (
    <form action={submit} className="w-full max-w-sm space-y-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-xs leading-snug text-ink/65">{explanation}</p>
      <textarea
        name="reason" required rows={2}
        placeholder="What has come up?"
        className="w-full rounded border border-ink/20 bg-snow px-2 py-1.5 text-xs"
      />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending}
          className="rounded-full border border-ink/30 px-3 py-1 text-xs disabled:opacity-40">
          {pending ? "Sending…" : "Send request"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="rounded-full border border-ink/15 px-3 py-1 text-xs text-ink/60">
          Never mind
        </button>
      </div>
      <p className="text-[11px] text-ink/50">
        Your lesson stays booked until we reply — please still come unless we say otherwise.
      </p>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-red-800">{state.error}</p>
      )}
    </form>
  );
}
