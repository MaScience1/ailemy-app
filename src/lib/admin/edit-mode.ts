import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { getAdminStatus } from "./auth";

/**
 * Cookie that carries the edit-mode flag. Deliberately NOT httpOnly-sensitive:
 * it grants no privilege by itself. Every privileged read is gated on
 * getAdminStatus() and every write on assertAdmin(), so a student who forges
 * this cookie gets exactly nothing — the server still renders the student view
 * because isAdmin is false.
 */
export const EDIT_MODE_COOKIE = "ailemy_edit_mode";

export type EditContext = {
  /** True only when the session email matches ADMIN_EMAIL. */
  isAdmin: boolean;
  /** True only when isAdmin AND the toggle is on. Never true for a student. */
  editMode: boolean;
};

const STUDENT_VIEW: EditContext = { isAdmin: false, editMode: false };

/**
 * Resolve admin + edit-mode ONCE per request.
 *
 * React's cache() dedupes this across the whole server render, so a page that
 * asks in the layout, in six card components and in forty <Editable> blocks
 * still performs exactly one auth check.
 *
 * Performance note: getAdminStatus() hits Supabase over the network. To keep
 * that cost off anonymous visitors (the overwhelming majority of traffic on
 * /learn and /past-papers), we short-circuit when no Supabase auth cookie is
 * present at all. That is a pure optimisation, not a security decision — a
 * forged/garbage auth cookie still falls through to the real getUser() check
 * and fails there.
 */
export const getEditContext = cache(async (): Promise<EditContext> => {
  const cookieStore = await cookies();

  // Fast path: no Supabase session cookie => cannot possibly be the admin.
  const hasSupabaseSession = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!hasSupabaseSession) return STUDENT_VIEW;

  // getAdminStatus() no longer throws on missing config — it reads a role row,
  // and there is no config to be missing. The try/catch stays anyway: it now
  // covers a network or database failure during the roles read, and the
  // handling is the same either way. A failed admin check must NOT take the
  // public site down for signed-in students; on this path "we could not find
  // out" and "not an admin" both mean the student view, which is the safe
  // answer and the one the overwhelming majority of callers want.
  let ok = false;
  try {
    ({ ok } = await getAdminStatus());
  } catch (e) {
    console.error("[edit-mode] admin check failed; treating as non-admin", e);
    return STUDENT_VIEW;
  }
  if (!ok) return STUDENT_VIEW;

  return {
    isAdmin: true,
    editMode: cookieStore.get(EDIT_MODE_COOKIE)?.value === "1",
  };
});

/**
 * Convenience for the common branch: "should this page render edit affordances?"
 * Returns false for every non-admin, and for an admin with the toggle off — in
 * which case the page output is byte-identical to the student view.
 */
export async function isEditing(): Promise<boolean> {
  const { editMode } = await getEditContext();
  return editMode;
}
