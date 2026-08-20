"use client";

import { useActionState } from "react";

import { bookWithCredit, type BookingResult } from "@/lib/booking/actions";

/**
 * Redeem one lesson credit for one slot.
 *
 * ⚠ A FORM, NOT A LINK. Booking is a mutation: it must not be reachable by a
 * GET, prefetched by the router, or replayed by a browser back button. The slot
 * key travels in a hidden field and is re-resolved server-side against fresh
 * availability — the list this button sits in was already stale when it
 * rendered.
 *
 * ⚠ AND THE ERROR IS SHOWN NEXT TO THE SLOT IT BELONGS TO. A page-level banner
 * saying "that time has gone" when forty times are listed makes the student
 * hunt for which one.
 */
export function BookWithCredit({ slotKey, label }: { slotKey: string; label: string }) {
  const [state, submit, pending] = useActionState<BookingResult | null, FormData>(bookWithCredit, null);

  return (
    <form action={submit} className="shrink-0">
      <input type="hidden" name="slot_key" value={slotKey} />
      <button
        type="submit"
        disabled={pending || state?.ok === true}
        className="rounded-full border border-ink/20 px-4 py-1.5 text-sm transition-colors hover:border-ink/40 disabled:opacity-40"
        aria-label={`Use one lesson credit for ${label}`}
      >
        {pending ? "Booking…" : state?.ok ? "Booked" : "Use a credit"}
      </button>
      {state && !state.ok && (
        <p role="alert" className="mt-1 max-w-xs text-[11px] leading-snug text-red-800">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mt-1 max-w-xs text-[11px] leading-snug text-emerald-800">{state.message}</p>
      )}
    </form>
  );
}
