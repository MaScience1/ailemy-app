"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Type-to-confirm delete button. Renders inline as a small red button; on
 * click opens a modal that requires the user to type the exact `confirmText`
 * before enabling the delete button. On confirm, calls the passed server
 * action.
 *
 * The server action MUST call assertAdmin() first (that's the real gate).
 * This UI is friction, not authorisation.
 */
export function DeleteConfirm({
  action,
  confirmText,
  entityLabel,
  small = false,
}: {
  action: () => Promise<{ error?: string }>;
  confirmText: string;
  entityLabel: string;
  small?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = typed === confirmText && !isPending;

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTyped("");
          setError(null);
          setOpen(true);
        }}
        className={
          small
            ? "rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
            : "rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
        }
      >
        Delete
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Delete {entityLabel}?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This deletes the DB row and any storage object it points to. It
              cannot be undone.
            </p>
            <p className="mt-4 text-sm text-slate-700">
              To confirm, type the exact title:
            </p>
            <p className="mt-1 rounded bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800">
              {confirmText}
            </p>
            <input
              type="text"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              placeholder="type the title exactly"
              disabled={isPending}
            />
            {error && (
              <p className="mt-2 text-sm text-red-700">{error}</p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={!canConfirm}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
