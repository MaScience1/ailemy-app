"use client";

import { useState, useTransition } from "react";

import { deleteAnnouncement, setAnnouncementEnabled } from "./actions";

/**
 * The two one-click operations, kept out of the edit form.
 *
 * ⚠ DELETE ASKS TWICE. There is no undo for a deleted row, and this button sits
 * next to a switch that is safe to press. Two different consequences must not
 * be one click apart.
 */
export function RowActions({ id, enabled, title }: { id: string; enabled: boolean; title: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setAnnouncementEnabled(id, !enabled))}
        className={`rounded border px-2.5 py-1 text-xs disabled:opacity-40 ${
          enabled ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-700"
        }`}
      >
        {enabled ? "On" : "Off"}
      </button>

      {confirming ? (
        <>
          <span className="text-xs text-red-800">Delete “{title}” permanently?</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteAnnouncement(id))}
            className="rounded border border-red-600 bg-red-600 px-2.5 py-1 text-xs text-white disabled:opacity-40"
          >
            Yes, delete
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
        >
          Delete
        </button>
      )}

      {error && <span className="text-xs text-red-800">{error}</span>}
    </div>
  );
}
