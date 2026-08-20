import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Does interest_registrations have 0043's demand columns yet?
 *
 * ============================================================================
 * ⚠ A FIELD THAT CANNOT BE STORED IS NOT SHOWN
 * ============================================================================
 * 0043 is PROPOSED and unapplied. The form could render year group, exam year
 * and notes anyway and quietly drop them — the row would still be written and
 * the parent would still see "thank you". That is the worst outcome this page
 * can produce: a family answers three more questions and nothing keeps the
 * answers, with nobody on either side told.
 *
 * So the fields are gated on a real probe of the real table. Before 0043 the
 * form asks eight questions and stores eight; after 0043 it asks eleven and
 * stores eleven. It is never asking a question it will throw away.
 *
 * ⚠ PROBED WITH THE SERVICE ROLE, AND ONLY FOR SHAPE. anon holds no SELECT on
 * this table (0040) and must not — so a capability probe cannot be made as the
 * visitor. This reads one column name from at most one row and never returns
 * data to the page; the answer is a boolean.
 *
 * ⚠ .select(col).limit(1), NOT head/count. A head request with count:exact
 * returns no error for a missing table or column, so the probe would report
 * "present" for something absent — the exact shape that let a seed run against
 * a table that did not exist.
 */

export type InterestCapabilities = {
  /** True when year_group, exam_year and student_notes all exist. */
  hasDemandFields: boolean;
  /** Present when they do not — the code and message, for a dev banner or a log. */
  reason?: string;
};

/**
 * Memoised for the life of the process. The answer changes exactly once, when
 * the founder applies 0043, and a redeploy follows. Probing on every render
 * would put a round trip in front of a form that is mostly read and rarely
 * submitted.
 */
let cached: InterestCapabilities | null = null;

export async function interestCapabilities(): Promise<InterestCapabilities> {
  if (cached) return cached;

  try {
    const db = createAdminClient();
    const { error } = await db
      .from("interest_registrations")
      .select("year_group,exam_year,student_notes")
      .limit(1);

    cached = error
      ? { hasDemandFields: false, reason: `${error.code ?? "?"}: ${error.message}` }
      : { hasDemandFields: true };
  } catch (e) {
    // A missing service-role key must not take the page down — the form works
    // perfectly well without the three extra questions.
    cached = { hasDemandFields: false, reason: e instanceof Error ? e.message : "probe failed" };
  }
  return cached;
}

/** Test seam: forget the memo. Not called in application code. */
export function resetInterestCapabilities(): void {
  cached = null;
}
