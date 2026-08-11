/**
 * Which past paper does a URL segment mean?
 *
 * ============================================================================
 * PURE, AND SEPARATE FROM past-paper-filters.ts ON PURPOSE
 * ============================================================================
 * That module is `server-only` and alias-imports the Supabase clients, so node
 * cannot load it in a test. This decision is the one part worth pinning
 * without a database: it is the rule that stops a Biology link serving the
 * Chemistry paper, and it took a real defect to arrive at.
 *
 * No imports. The caller does the querying and hands the candidates over.
 *
 * ============================================================================
 * ⚠ A SLUG IS UNIQUE ONLY WITHIN A COURSE
 * ============================================================================
 * "unit-1-may-june-2025" is three different papers: Chemistry WCH11/01,
 * Physics WPH11/01 and Biology WBI11/01. Across the catalogue 72 of 90 slugs
 * are used by more than one course.
 *
 * An earlier version took "the newest" match. That silently served one
 * subject's paper under another subject's link, with nothing logged and
 * nothing visibly wrong — a student following a Biology link sat the Chemistry
 * paper. Refusing is the only safe answer when the caller has not said which
 * course it means, and the refusal has to be DISTINGUISHABLE from "no such
 * paper" or the caller cannot tell a missing paper from an under-specified
 * link.
 */

export type PaperCandidate = { course?: { slug?: string | null } | null };

export type PaperChoice<T> =
  | { ok: true; paper: T }
  /** Nothing matched at all. The paper does not exist, or is not visible. */
  | { ok: false; reason: "not_found" }
  /**
   * Several courses use this slug and no course was supplied. The caller must
   * say which it means — this is NOT the same as not_found, and collapsing
   * them sends someone hunting for a paper that is sitting right there.
   */
  | { ok: false; reason: "ambiguous"; matches: number }
  /**
   * Several papers share a slug WITHIN one course, which UNIQUE (course_id,
   * slug) is supposed to make impossible. Refuse rather than pick, and say
   * that the constraint is not holding — picking would hide a broken index.
   */
  | { ok: false; reason: "constraint_violated"; matches: number };

/**
 * ⚠ AN ID NEEDS NO COURSE. When the caller looked the row up by primary key
 * there is at most one candidate and no ambiguity is possible, so this
 * function is only ever deciding between slug matches. It does not need to
 * know which kind of lookup produced the rows — one row is one row.
 */
export function choosePaper<T extends PaperCandidate>(
  rows: readonly T[],
  courseSlug?: string,
): PaperChoice<T> {
  const candidates = rows.filter((r) => r.course);

  if (courseSlug) {
    const scoped = candidates.filter((r) => r.course?.slug === courseSlug);
    if (scoped.length > 1) {
      return { ok: false, reason: "constraint_violated", matches: scoped.length };
    }
    return scoped[0] ? { ok: true, paper: scoped[0] } : { ok: false, reason: "not_found" };
  }

  if (candidates.length > 1) {
    return { ok: false, reason: "ambiguous", matches: candidates.length };
  }
  return candidates[0]
    ? { ok: true, paper: candidates[0] }
    : { ok: false, reason: "not_found" };
}
