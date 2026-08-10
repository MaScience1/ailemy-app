import "server-only";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getStaffStatus } from "@/lib/admin/staff";

/**
 * Who may use /admin — decided by a ROLE ROW, not by an environment variable.
 *
 * ============================================================================
 * WHAT CHANGED AND WHY
 * ============================================================================
 * This module used to compare the session's email to ADMIN_EMAIL. That is
 * authorisation by deployment setting, and it has three properties that made
 * it wrong here:
 *
 *   it cannot be scoped     one variable, one answer. No "marker but not
 *                           admin", though 0028's write policies already draw
 *                           exactly that line.
 *   it cannot be revoked    taking someone's access away needs an env change
 *                           and a redeploy, not an UPDATE.
 *   it disagreed with the   every write policy 0028 installed gates on
 *   database                has_role(). A page that admits someone the
 *                           database will refuse is an authorisation check
 *                           that does not decide anything — it just moves the
 *                           failure somewhere less legible.
 *
 * 0033 removed the same hardcoded email from is_staff() in SQL. This is the
 * application half of that change: the two now agree because they read the
 * same table.
 *
 * ============================================================================
 * ⚠ THE SHAPE OF getAdminStatus() IS DELIBERATELY UNCHANGED
 * ============================================================================
 * Sixteen call sites — the layout, six inline-edit components, four server
 * action modules, two API routes — depend on `{ ok, email }`. Changing the
 * shape here would mean editing all of them in the same commit as the
 * authorisation change, and an authorisation change should be reviewable on
 * its own. The `reason` field is additive: callers that ignore it behave
 * exactly as they did.
 *
 * ⚠ AND `ok: false` STILL MEANS "DO NOT LET THEM IN". getStaffStatus can
 * answer `unavailable` — we could not find out — which is NOT the same as "no"
 * and is kept distinguishable in `reason` for anything that wants to say so.
 * But every gate must FAIL CLOSED: an outage that opened /admin would be a
 * far worse failure than an outage that closed it. The distinction exists to
 * be reported, not to be admitted on.
 */

export type AdminStatus = {
  ok: boolean;
  email: string | null;
  /**
   * Present only when ok is false.
   *   not_staff    they hold no admin role (or are signed out)
   *   unavailable  the check itself failed — fail closed, but say so
   */
  reason?: "not_staff" | "unavailable";
  detail?: string;
};

export async function getAdminStatus(): Promise<AdminStatus> {
  const status = await getStaffStatus();

  if (status.ok) {
    // ⚠ 'admin' SPECIFICALLY, not any staff role. A marker may rule on a mark
    // scheme; that must not also mean they may delete a past paper. teacher
    // and marker are real roles with narrower rights, and collapsing them into
    // "staff, therefore admin" would hand out the widest permission in the
    // system to the two roles created precisely to avoid that.
    if (!status.roles.includes("admin")) {
      return { ok: false, email: await emailOf(), reason: "not_staff" };
    }
    return { ok: true, email: await emailOf() };
  }

  if (status.reason === "unavailable") {
    return { ok: false, email: null, reason: "unavailable", detail: status.detail };
  }
  return { ok: false, email: null, reason: "not_staff" };
}

/** The session's email, for display only. It decides nothing. */
async function emailOf(): Promise<string | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

/**
 * MUST be the first line of every admin server action. The proxy gates
 * /admin/* pages, but server actions are directly invocable by anything that
 * can guess the endpoint — a page-level gate is not a gate.
 *
 * Throws on failure so the action returns an error rather than proceeding.
 */
export async function assertAdmin(): Promise<void> {
  const { ok, reason } = await getAdminStatus();
  if (!ok) {
    // ⚠ An outage says so; a refusal does not say why.
    //
    // "We couldn't check your permissions" and "Not authorised" are different
    // facts and a person debugging deserves the right one. But the refusal
    // stays deliberately vague: it does not distinguish signed-out from
    // signed-in-without-a-role, because that difference is only useful to
    // someone probing for valid accounts.
    throw new Error(
      reason === "unavailable"
        ? "We couldn't check your permissions just now. Please try again shortly."
        : "Not authorised",
    );
  }
}
