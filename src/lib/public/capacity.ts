import "server-only";

import { createClient } from "@supabase/supabase-js";

import { describeCapacity, type Capacity } from "./capacity-rules";

export * from "./capacity-rules";

/**
 * Reading real capacity (§14).
 *
 * ⚠ THE ONLY SOURCE IS public.cohort_seats_taken (0063). NEVER A ROW COUNT.
 * cohort_enrolments is PII and no client holds SELECT on it; 0063 exposes a
 * SECURITY DEFINER function returning one integer — paid, active seats on a
 * public cohort. Counting rows here would need a grant that must not exist.
 *
 * ⚠ AND IT DEGRADES TO SILENCE, NOT TO A NUMBER. If 0063 is not applied the RPC
 * returns PGRST202. The honest response is no capacity line at all: the brief
 * says expose scarcity only when it is based on actual data, and "20 places
 * left" derived from a failed call is exactly the fake scarcity it forbids.
 */

/** ⚠ ANON, DELIBERATELY. The figure is public; the rows are not. */
function anonDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * ⚠ ONE RPC PER COHORT, AND THE CALLER DECIDES HOW MANY COHORTS. There is no
 * "fetch capacity for everything" helper, because the homepage shows one
 * Chemistry cohort and a page that showed thirty would be making thirty calls
 * without noticing. Awkward at scale is the correct shape here.
 */
export async function loadCapacity(cohortSlug: string, cap: number): Promise<Capacity> {
  const db = anonDb();
  if (!db) return { known: false, reason: "Capacity is unavailable." };

  const { data, error } = await db.rpc("cohort_seats_taken", { cohort_slug: cohortSlug });

  if (error) {
    /**
     * ⚠ PGRST202 MEANS 0063 IS NOT APPLIED, and that is a deployment state
     * rather than a fault. Either way the answer is the same — say nothing —
     * but the reason distinguishes them for anyone reading a log.
     */
    const notMigrated = error.code === "PGRST202" || error.code === "42883";
    return {
      known: false,
      reason: notMigrated
        ? "Capacity reporting is not enabled yet (0063 not applied)."
        : `Capacity could not be read (${error.code ?? "unknown"}).`,
    };
  }
  if (typeof data !== "number") {
    // ⚠ NOT `?? 0`. A null here is an unanswered question, and turning it into
    // zero would render "20 places left" on no information at all.
    return { known: false, reason: "Capacity returned no figure." };
  }
  return describeCapacity(data, cap);
}
