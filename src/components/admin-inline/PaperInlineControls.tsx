"use client";

import { DeleteConfirm } from "@/app/admin/_components/DeleteConfirm";
import { deletePastPaper } from "@/app/admin/past-papers/actions";

import { useInlineEdit } from "./InlineEditProvider";

/**
 * Pencil + trash for one past-paper card. Same guarantees as the lesson
 * controls: server-side edit-mode gate above, existing assertAdmin()-guarded
 * actions below.
 */
export function PaperInlineControls({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const api = useInlineEdit();
  if (!api) return null;

  return (
    <div
      className="flex items-center gap-1.5"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={() => api.openPaperEdit(id)}
        title={`Edit “${title}”`}
        aria-label={`Edit ${title}`}
        className="rounded border border-ink/20 bg-snow/90 px-2 py-1 text-xs font-medium text-ink shadow-sm transition hover:bg-snow"
      >
        ✎ Edit
      </button>
      <DeleteConfirm
        small
        entityLabel="past paper"
        confirmText={title}
        action={deletePastPaper.bind(null, id)}
      />
    </div>
  );
}

/** "+ Add past paper" button, prefilled with the surrounding course/unit. */
export function PaperAddButton({
  label = "+ Add past paper",
  unitId = null,
}: {
  label?: string;
  /** Prefills the unit picker when adding from inside a unit section. */
  unitId?: string | null;
}) {
  const api = useInlineEdit();
  if (!api || !api.hasPaperSupport) return null;

  return (
    <button
      type="button"
      onClick={() => api.openPaperCreate({ unit_id: unitId })}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-ink/30 bg-snow/70 px-3 py-1.5 text-sm font-medium text-ink transition hover:border-ink/50 hover:bg-snow"
    >
      {label}
    </button>
  );
}
