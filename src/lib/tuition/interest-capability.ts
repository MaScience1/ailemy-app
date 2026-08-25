import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Can the interest funnel actually store anything yet?
 *
 * ============================================================================
 * ⚠ THE MIGRATION IS PROPOSED AND UNAPPLIED, SO TODAY THIS IS FALSE.
 * ============================================================================
 * _PROPOSED_tuition_subject_interest.sql adds the columns this funnel needs to
 * interest_registrations. Until the founder numbers and applies it there is
 * nowhere to write, and planning override 5 is explicit about what must NOT
 * happen in the meantime: no stubbed success, no localStorage, no JSON
 * fallback. The UI renders an honest "not open yet" line instead.
 *
 * ⚠ IT PROBES A COLUMN, NOT A TABLE. interest_registrations already exists and
 * already takes inserts from the current interest page, so "does the table
 * exist" would answer true and be useless. What decides this is whether the
 * NEW columns are there.
 *
 * ⚠ AND THE PROBE SHAPE MATTERS. `.select(col).limit(1)` surfaces a missing
 * column as PostgREST 42703. `{ head: true, count: "exact" }` returns no error
 * for a column that is not there — a probe shaped that way reports success
 * against a schema that cannot hold the data.
 */

/** The column that only exists once the proposed migration has been applied. */
const SENTINEL_COLUMN = "tuition_mode";

export type InterestCapability = {
  canRegister: boolean;
  /** Why not, for the server log and the admin banner. Never shown to a visitor. */
  reason?: string;
};

export async function interestCapability(): Promise<InterestCapability> {
  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (err) {
    return { canRegister: false, reason: err instanceof Error ? err.message : "admin client unavailable" };
  }

  const res = await db.from("interest_registrations").select(SENTINEL_COLUMN).limit(1);
  if (res.error) {
    /**
     * ⚠ 42703 IS THE EXPECTED ANSWER TODAY, and it is not a fault — it is the
     * migration not having been applied. Distinguished from a real outage so
     * the log says which one it is.
     */
    const code = res.error.code ?? "";
    return {
      canRegister: false,
      reason: code === "42703" || code === "PGRST204"
        ? `interest schema not applied (${code}) — _PROPOSED_tuition_subject_interest.sql is unnumbered and unapplied`
        : `${code}: ${res.error.message}`,
    };
  }
  return { canRegister: true };
}
