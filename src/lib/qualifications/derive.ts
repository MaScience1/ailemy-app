import type { SupportStatus } from "./support.ts";

/**
 * The pure derivations behind the course selector.
 *
 * ============================================================================
 * ⚠ SEPARATE FROM tree.ts SO A TEST CAN ACTUALLY RUN THEM
 * ============================================================================
 * The suites here are plain Node programs with no bundler, so a module that
 * imports `@/lib/supabase/server` cannot be loaded by one — and tree.ts must,
 * because it queries. Left inside it, every rule below could only be checked
 * by regex against its own source, which tests that the code was TYPED, not
 * that it WORKS.
 *
 * So the functions that decide what the selector asks live here, importing
 * nothing but a type. tree.ts calls them; the suite calls the same ones.
 */

// ── derivations ─────────────────────────────────────────────────────────────

/**
 * The stage a course represents within its board, read off the course name.
 *
 * ⚠ DERIVED FROM THE REAL NAME, NOT A LOOKUP TABLE. "Edexcel IAL AS Chemistry"
 * and "Edexcel IAL A2 Chemistry" are two course records under one curriculum,
 * and the only thing distinguishing them for a student is the stage. A mapping
 * table of slug → "AS" would need editing every time a course is added; this
 * tracks whatever the catalogue actually says.
 *
 * Returning null is the important case: a board with one course has no stage
 * to choose, so the selector SKIPS the step entirely rather than showing a row
 * with a single button in it (§3, §15).
 */
export function stageOf(courseName: string): string | null {
  const m = courseName.match(/\b(AS|A2|SL|HL)\b/);
  return m ? m[1] : null;
}

/**
 * "Units 1–3", from the unit NAMES.
 *
 * ============================================================================
 * ⚠ THE NUMBER COMES FROM THE NAME, NOT THE CODE — AND THAT IS A BUG FIX
 * ============================================================================
 * The first version read digits out of `units.code`, which for Edexcel IAL is
 * the paper code: WCH11, WCH12, WCH13. It rendered "Units 11–13" under AS
 * Chemistry, which is not what the units are called — the names say "Unit 1",
 * "Unit 2", "Unit 3". It was caught by looking at the page, not by a test,
 * because every assertion about it was written against the same wrong idea.
 *
 * It was also a §30 violation: WCH11 is an internal code, and printing it as
 * a unit number exposes catalogue terminology to a fifteen-year-old.
 *
 * ⚠ NO FALLBACK TO THE CODE. If a name carries no "Unit N", this returns null
 * and the card simply says nothing. Guessing from the code is precisely how
 * the wrong answer got printed the first time, and a missing line is better
 * than a confident wrong one.
 */
export function unitSummary(names: readonly string[]): string | null {
  const nums = names
    .map((n) => Number(n.match(/\bUnit\s+(\d+)/i)?.[1]))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const lo = nums[0], hi = nums[nums.length - 1];
  return lo === hi ? `Unit ${lo}` : `Units ${lo}–${hi}`;
}

/** The strongest status in a set — a level is as good as its best route. */
export function strongestStatus(rows: readonly { status: SupportStatus }[]): SupportStatus {
  const rank: Record<SupportStatus, number> = {
    full_support: 0, supported: 1, expanding: 2, coming_soon: 3,
  };
  if (rows.length === 0) return "coming_soon";
  return [...rows].sort((a, b) => rank[a.status] - rank[b.status])[0].status;
}


export type SubjectHoldings = {
  liveLessons: number;
  pastPapers: number;
  error: string | null;
};


/**
 * What the card says instead of a tuition status word (§4).
 *
 * ⚠ COUNTS, NOT ADJECTIVES. "Expanding" is a judgement that ages; "90 past
 * papers" is checkable and changes itself. Where there is genuinely nothing
 * published it says so plainly rather than borrowing an encouraging word.
 */
export function holdingsLabel(h: SubjectHoldings): string {
  if (h.error) return "Contents unavailable";
  const parts: string[] = [];
  if (h.liveLessons > 0) parts.push(`${h.liveLessons} lesson${h.liveLessons === 1 ? "" : "s"}`);
  if (h.pastPapers > 0) parts.push(`${h.pastPapers} past paper${h.pastPapers === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" · ") : "Nothing published yet";
}

/**
 * What a Resources subject card says about itself (§4, §6).
 *
 * ⚠ THE SHELVES, NOT THE SALES PITCH. SUBJECTS[].blurb is homepage copy and
 * ends in tuition — "…progress tracking and live tuition", "…register interest
 * for priority access". Both shipped inside /resources through the shared
 * card, alongside the "Register interest" eyebrow, and both are tuition inside
 * a study library. This describes what a student will find there instead, and
 * it is chosen by what the counts say rather than written per subject.
 */
export function resourcesBlurb(h: SubjectHoldings): string {
  if (h.error) return "The contents of this subject could not be loaded.";
  if (h.liveLessons > 0 && h.pastPapers > 0)
    return "Lessons, revision notes, practice questions and past papers, organised by course and topic.";
  if (h.liveLessons > 0)
    return "Lessons, revision notes and practice questions, organised by course and topic.";
  if (h.pastPapers > 0)
    return "Past papers to sit and have marked. Lessons for this subject are still in preparation.";
  return "Nothing is published for this subject yet.";
}
