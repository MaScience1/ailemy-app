import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Loads every site_copy override once per request.
 *
 * One query for the whole page rather than one per <Editable> — a course page
 * can easily contain a dozen editable strings, and React's cache() collapses
 * them into a single round-trip.
 *
 * GRACEFUL DEGRADATION is the point here: migration 0010 is applied by hand,
 * so this must behave correctly against a database where `site_copy` does not
 * exist yet. Any error (missing table, RLS, network) resolves to an empty map,
 * which makes every <Editable> fall back to its hardcoded JSX default. The
 * site renders exactly as it does today.
 */
export const getSiteCopy = cache(async (): Promise<Map<string, string>> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("site_copy").select("key, value");
    if (error) {
      // Expected before 0010 is applied — log once per request, don't throw.
      console.warn("[site-copy] unavailable, using defaults:", error.message);
      return new Map();
    }
    return new Map(
      (data ?? []).map((r) => [r.key as string, r.value as string]),
    );
  } catch (e) {
    console.warn("[site-copy] lookup failed, using defaults:", e);
    return new Map();
  }
});

/** Resolved value for one key, or null when there is no override. */
export async function getCopyValue(key: string): Promise<string | null> {
  const all = await getSiteCopy();
  return all.get(key) ?? null;
}
