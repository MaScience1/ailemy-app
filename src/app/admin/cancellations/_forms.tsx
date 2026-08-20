"use client";

import { useActionState, useState } from "react";

import { resolveRequest } from "./actions";

type Result = { ok: true; message: string } | { ok: false; error: string };

const RESOLUTIONS = [
  { value: "refunded", label: "Refunded — money back", cancels: true },
  { value: "credited", label: "Credited — a lesson credit back", cancels: true },
  { value: "rescheduled", label: "Rescheduled — we moved it", cancels: true },
  { value: "declined", label: "Declined — the lesson stands", cancels: false },
] as const;

/**
 * ⚠ THE FORM SAYS WHAT EACH OUTCOME DOES TO THE LESSON, BEFORE IT IS CHOSEN.
 * Three of the four cancel the booking and one deliberately does not. That is
 * the whole difference between the answers, and an admin should not have to
 * learn it by watching a family's calendar change.
 */
export function ResolveForm({ id, paidWith }: { id: string; paidWith: string }) {
  const [state, submit, pending] = useActionState<Result | null, FormData>(
    resolveRequest.bind(null, id), null,
  );
  const [choice, setChoice] = useState<string>("");
  const picked = RESOLUTIONS.find((r) => r.value === choice);

  if (state?.ok) {
    return <p className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{state.message}</p>;
  }

  return (
    <form action={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          name="resolution" required value={choice} onChange={(e) => setChoice(e.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="" disabled>Decide…</option>
          {RESOLUTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <input
          name="resolution_note" placeholder="Note (optional, internal)"
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button type="submit" disabled={pending || !choice}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">
          {pending ? "Recording…" : "Record decision"}
        </button>
      </div>

      {picked && (
        <p className="text-xs text-slate-600">
          {picked.cancels
            ? "This CANCELS the lesson and frees the slot."
            : "This LEAVES the lesson booked — the student should still attend."}
          {picked.value === "credited" && (
            <> A credit goes back only if one was spent on it; a cash lesson gets nothing here.</>
          )}
          {picked.value === "refunded" && paidWith === "credit" && (
            <>{" "}⚠ This lesson was paid for with a CREDIT, not money — “credited” is probably what you want.</>
          )}
          {picked.value === "refunded" && (
            <>{" "}⚠ Recording a refund does not move any money. Stripe is keyless; issue it there yourself.</>
          )}
        </p>
      )}

      {state && !state.ok && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{state.error}</p>
      )}
    </form>
  );
}
