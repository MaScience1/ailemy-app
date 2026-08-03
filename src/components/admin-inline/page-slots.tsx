import { getEditContext } from "@/lib/admin/edit-mode";
import type { PageRow } from "./PageEditor";

/**
 * Self-gating server slots for dynamic-page authoring. Same discipline as
 * ./slots: return null for non-admins, and only then defer-import the client
 * editor so it stays out of the public bundle.
 */

export async function NewPageSlot() {
  const { editMode } = await getEditContext();
  if (!editMode) return null;
  const { PageEditorLauncher } = await import("./PageEditor");
  return (
    <div className="mt-6 flex items-center gap-3 rounded-lg border border-dashed border-ink/25 bg-snow/60 p-3">
      <PageEditorLauncher mode="create" label="+ New page" />
      <span className="text-xs text-ink/55">
        Creates a standalone page at the slug you choose.
      </span>
    </div>
  );
}

export async function EditPageSlot({ page }: { page: PageRow }) {
  const { editMode } = await getEditContext();
  if (!editMode) return null;
  const { PageEditorLauncher } = await import("./PageEditor");
  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-dashed border-ink/25 bg-snow/70 p-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
        {page.status === "published" ? "Published" : "Draft — only you see this"}
      </span>
      <PageEditorLauncher mode="edit" initial={page} label="✎ Edit page" />
    </div>
  );
}
