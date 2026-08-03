import { getEditContext } from "@/lib/admin/edit-mode";

/**
 * Self-gating SERVER slots for the inline controls.
 *
 * Each returns null for anyone who is not an admin in edit mode, and only then
 * defers to `await import()` for the client component. Pages render these
 * unconditionally — no `{editing && ...}` needed — and never import a client
 * edit component directly, which is what keeps the edit code out of the public
 * bundle. See InlineEditBoundary for the measurement that motivated this.
 */

export async function LessonControlsSlot({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const { editMode } = await getEditContext();
  if (!editMode) return null;
  const { LessonInlineControls } = await import("./LessonInlineControls");
  return (
    <div className="mt-2 flex justify-end">
      <LessonInlineControls id={id} title={title} />
    </div>
  );
}

export async function LessonAddSlot({
  label,
  unitId = null,
  note,
}: {
  label?: string;
  unitId?: string | null;
  note?: string;
}) {
  const { editMode } = await getEditContext();
  if (!editMode) return null;
  const { LessonAddButton } = await import("./LessonInlineControls");
  return (
    <div className="mt-4 flex items-center gap-3">
      <LessonAddButton label={label} unitId={unitId} />
      {note && <span className="text-xs text-ink/55">{note}</span>}
    </div>
  );
}

export async function PaperControlsSlot({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const { editMode } = await getEditContext();
  if (!editMode) return null;
  const { PaperInlineControls } = await import("./PaperInlineControls");
  return (
    <div className="mt-2 flex justify-end">
      <PaperInlineControls id={id} title={title} />
    </div>
  );
}

export async function PaperAddSlot({
  label,
  unitId = null,
  note,
}: {
  label?: string;
  unitId?: string | null;
  note?: string;
}) {
  const { editMode } = await getEditContext();
  if (!editMode) return null;
  const { PaperAddButton } = await import("./PaperInlineControls");
  return (
    <div className="mt-4 flex items-center gap-3">
      <PaperAddButton label={label} unitId={unitId} />
      {note && <span className="text-xs text-ink/55">{note}</span>}
    </div>
  );
}

/** Edit toolbar for a single lesson (used on the lesson detail page). */
export async function LessonEditBarSlot({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const { editMode } = await getEditContext();
  if (!editMode) return null;
  const { LessonInlineControls } = await import("./LessonInlineControls");
  return (
    <div className="mt-6 flex items-center gap-3 rounded-lg border border-dashed border-ink/25 bg-snow/70 p-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
        Editing
      </span>
      <LessonInlineControls id={id} title={title} />
    </div>
  );
}
