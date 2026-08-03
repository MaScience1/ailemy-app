"use client";

import { DeleteConfirm } from "@/app/admin/_components/DeleteConfirm";
import { deleteLesson } from "@/app/admin/lessons/actions";

import { useInlineEdit } from "./InlineEditProvider";

/**
 * Pencil + trash for one lesson card.
 *
 * Only ever rendered by a page that has already checked edit mode server-side,
 * and additionally no-ops if there is no provider above it. Both the edit and
 * the delete path terminate in existing assertAdmin()-guarded server actions.
 */
export function LessonInlineControls({
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
      // Cards are usually wrapped in a <Link>; keep clicks from navigating.
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={() => api.openLessonEdit(id)}
        title={`Edit “${title}”`}
        aria-label={`Edit ${title}`}
        className="rounded border border-ink/20 bg-snow/90 px-2 py-1 text-xs font-medium text-ink shadow-sm transition hover:bg-snow"
      >
        ✎ Edit
      </button>
      <DeleteConfirm
        small
        entityLabel="lesson"
        confirmText={title}
        action={deleteLesson.bind(null, id)}
      />
    </div>
  );
}

/** "+ Add lesson" button, prefilled with the surrounding course/unit. */
export function LessonAddButton({
  label = "+ Add lesson",
  unitId = null,
}: {
  label?: string;
  /** Prefills the unit picker when adding from inside a unit section. */
  unitId?: string | null;
}) {
  const api = useInlineEdit();
  if (!api || !api.hasLessonSupport) return null;

  return (
    <button
      type="button"
      onClick={() => api.openLessonCreate({ unit_id: unitId })}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-ink/30 bg-snow/70 px-3 py-1.5 text-sm font-medium text-ink transition hover:border-ink/50 hover:bg-snow"
    >
      {label}
    </button>
  );
}
