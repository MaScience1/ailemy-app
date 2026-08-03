import { getEditContext } from "@/lib/admin/edit-mode";
import { getCopyValue } from "@/lib/copy/site-copy";

/**
 * Editable page copy.
 *
 * Renders plain text for EVERY visitor — the DB override if one exists, else
 * the `default` string, which is the copy that already lived in the JSX. So a
 * page wrapped in <Editable> looks and reads identically to before, and keeps
 * working if migration 0010 was never applied.
 *
 * Only for an admin with edit mode on does it defer-import the click-to-edit
 * client component. That deferral matters for the same reason it does in
 * AdminOverlay: a static import would pull the editor (and its save action)
 * into the page's client graph for every visitor.
 *
 * Emits no wrapper element of its own in read mode, so it can sit inside an
 * existing <h1>/<p> without disturbing layout or typography.
 */
export async function Editable({
  id,
  default: fallback,
}: {
  /** Stable dot-namespaced key, e.g. "home.hero.title". */
  id: string;
  /** The copy currently hardcoded in the JSX. Always required. */
  default: string;
}) {
  const [override, { editMode }] = await Promise.all([
    getCopyValue(id),
    getEditContext(),
  ]);
  const value = override ?? fallback;

  if (!editMode) return <>{value}</>;

  const { EditableClient } = await import("./EditableClient");
  return <EditableClient copyKey={id} value={value} />;
}
