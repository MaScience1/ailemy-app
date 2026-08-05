import { headers } from "next/headers";

import { getEditContext } from "@/lib/admin/edit-mode";

/**
 * Root admin overlay: the fixed bottom-right "Edit mode" toggle.
 *
 * PAYLOAD GUARANTEE — and why this is a <form>, not a React button:
 *
 *   A Client Component here would be imported into the root layout's module
 *   graph. Turbopack then emits its chunk and loads it on EVERY route, for
 *   EVERY visitor, even though this component returns null server-side and the
 *   component is never rendered. Measured on a production build: logged-out
 *   visitors to `/` downloaded a chunk containing the "Edit mode ON" label and
 *   the setEditMode action reference. Wrapping the import in `await import()`
 *   did NOT help — the client reference is still hoisted into a shared chunk.
 *
 *   A plain <form method="POST"> has no module at all. Non-admins get `null`
 *   here, which means literally zero bytes: no markup, no script, nothing to
 *   discover in devtools. The toggle also works with JS disabled.
 *
 * The POST target re-checks assertAdmin(), so the cookie cannot be set by
 * anyone else even though the endpoint is publicly reachable.
 */
export async function AdminOverlay() {
  const { isAdmin, editMode } = await getEditContext();

  if (!isAdmin) return null;

  // Return the admin to the page they toggled from.
  const h = await headers();
  const current =
    h.get("x-invoke-path") ??
    h.get("next-url") ??
    h.get("x-pathname") ??
    "/";

  return (
    <form
      method="POST"
      action="/api/admin/edit-mode"
      className="fixed bottom-5 right-5 z-[9999] print:hidden"
    >
      <input type="hidden" name="on" value={editMode ? "0" : "1"} />
      <input type="hidden" name="next" value={current} />
      <button
        type="submit"
        title={
          editMode
            ? "Edit mode is ON — click to return to the student view"
            : "Edit mode is OFF — click to show inline editing controls"
        }
        // cursor-pointer because a <button> in a form otherwise shows the
        // default arrow. active:scale-95 + hover:shadow-xl are the only motion:
        // 150ms ease-out, shorter than the site's 200ms marketing idiom because
        // press feedback should feel immediate rather than animated. Tailwind's
        // bare `transition` already covers transform and box-shadow, so no
        // transition-all is needed.
        className={
          "inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg ring-1 transition duration-150 ease-out hover:shadow-xl active:scale-95 " +
          (editMode
            ? "bg-flask text-snow ring-flask/40 hover:bg-flask/90"
            : "bg-ink text-parchment ring-ink/20 hover:bg-ink/90")
        }
      >
        <span
          aria-hidden="true"
          className={
            "inline-block h-2 w-2 rounded-full " +
            (editMode ? "bg-signal" : "bg-parchment/50")
          }
        />
        {editMode ? "Edit mode ON" : "Edit mode"}
      </button>
    </form>
  );
}
