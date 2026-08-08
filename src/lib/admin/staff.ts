import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Role-backed staff gating. No ADMIN_EMAIL, anywhere in this file.
 *
 * ============================================================================
 * WHY THIS EXISTS ALONGSIDE lib/admin/auth.ts
 * ============================================================================
 * `getAdminStatus()` in auth.ts compares the session's email to the
 * ADMIN_EMAIL environment variable. That is how the whole /admin area is gated
 * today, and it has two properties this tool must not inherit: it cannot
 * express "marker but not admin", and it makes authorisation a deployment
 * setting rather than a fact in the database that RLS can also see.
 *
 * The region tool is gated on ROLES, because the rows it produces are gated on
 * roles: 0028's `question_regions_write` policy is
 * `has_role('marker') OR has_role('admin')` with no is_staff() and therefore
 * no ADMIN_EMAIL arm. Gating the page on anything else would mean a page that
 * renders for someone whose writes the database will refuse — an authorisation
 * check that disagrees with the one that actually decides.
 *
 * ⚠ NOT is_staff() EITHER, and deliberately. That function still carries the
 * temporary ADMIN_EMAIL fallback 0027 introduced, so calling it would smuggle
 * the env var back in through SQL. Dropping that arm is proposed as 0033. Once
 * it lands, is_staff() and this module agree by construction; until then, this
 * reads the roles directly and the difference is only that this one is already
 * correct.
 *
 * ============================================================================
 * WHY IT READS user_roles DIRECTLY RATHER THAN CALLING has_role()
 * ============================================================================
 * 0027's `user_roles_read_own` policy is a bare column comparison —
 * `user_id = auth.uid()` — calling no function, which is what makes it
 * recursion-proof. A session can always read its own roles and nobody else's,
 * so the read is both safe and sufficient. It also needs no EXECUTE grant:
 * 0027 issues none on has_role(), and relying on PostgreSQL's default grant to
 * PUBLIC would be a dependency nobody wrote down.
 */

export type StaffRole = "teacher" | "marker" | "admin";

export type StaffStatus =
  | { ok: true; userId: string; roles: StaffRole[] }
  /** Signed out, or signed in with no staff role. Same answer, deliberately. */
  | { ok: false; reason: "not_staff" }
  /** We could not find out. NOT the same as "no". */
  | { ok: false; reason: "unavailable"; detail: string };

export async function getStaffStatus(): Promise<StaffStatus> {
  const db = await createClient();

  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();

  // ⚠ An auth outage is not "you are not staff". Folding them together is how
  // a signed-in admin gets shown a sign-in wall and concludes their account is
  // broken — the same defect class as a failed read rendering as empty data.
  if (userError) {
    console.error(`[staff] auth.getUser: ${userError.message}`);
    return { ok: false, reason: "unavailable", detail: userError.message };
  }
  if (!user) return { ok: false, reason: "not_staff" };

  const { data, error } = await db.from("user_roles").select("role");
  if (error) {
    console.error(`[staff] user_roles: ${error.code ?? "?"}: ${error.message}`);
    return { ok: false, reason: "unavailable", detail: `${error.code ?? "?"}: ${error.message}` };
  }

  // RLS scopes this to the caller's own rows; no user_id filter is needed and
  // adding one would imply the policy might not be doing its job.
  const roles = ((data ?? []) as { role: string }[])
    .map((r) => r.role)
    .filter((r): r is StaffRole => r === "teacher" || r === "marker" || r === "admin");

  if (roles.length === 0) return { ok: false, reason: "not_staff" };
  return { ok: true, userId: user.id, roles };
}

/** May this session WRITE regions? Mirrors 0028's question_regions_write. */
export function canWriteRegions(roles: StaffRole[]): boolean {
  return roles.includes("marker") || roles.includes("admin");
}

/**
 * The first line of every region server action.
 *
 * Server actions are directly invocable by anything that can guess the
 * endpoint, so a page-level gate is not a gate. Returns a result rather than
 * throwing, so an outage and a refusal stay distinguishable all the way to the
 * caller instead of collapsing into one thrown Error.
 */
export async function requireRegionWriter(): Promise<
  { ok: true; userId: string; roles: StaffRole[] } | { ok: false; error: string }
> {
  const status = await getStaffStatus();
  if (!status.ok) {
    if (status.reason === "unavailable") {
      return {
        ok: false,
        error: "We couldn't check your permissions just now. Please try again shortly.",
      };
    }
    // Deliberately vague: does not distinguish signed-out from signed-in-
    // without-a-role, for the same reason getAttemptForPlayer does not
    // distinguish missing from not-yours.
    return { ok: false, error: "Not authorised." };
  }
  if (!canWriteRegions(status.roles)) {
    return { ok: false, error: "Not authorised." };
  }
  return { ok: true, userId: status.userId, roles: status.roles };
}
