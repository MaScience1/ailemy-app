"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Publish/unpublish toggle. Flips between the existing `content_status`
 * values 'draft' and 'live' — the schema's enum has more values (in_progress,
 * coming_soon, archived) that aren't relevant to a two-state toggle; the
 * full-edit form is where the other values can be set.
 */
export function StatusToggle({
  currentStatus,
  action,
}: {
  currentStatus: string;
  action: (next: "live" | "draft") => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isLive = currentStatus === "live";
  const next = isLive ? "draft" : "live";

  function toggle() {
    startTransition(async () => {
      const result = await action(next);
      if (result?.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={
        (isLive
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50") +
        " rounded border px-2 py-1 text-xs font-medium transition disabled:opacity-50"
      }
      title={`Status: ${currentStatus}. Click to set to '${next}'.`}
    >
      {isPending ? "…" : isLive ? "Live" : currentStatus}
    </button>
  );
}
