import { createClient } from "@/lib/supabase/server";
import type { Pathway } from "@/lib/catalogue/pathways";

import {
  LEVEL_PATHWAYS,
  SCOPE_PATHWAY,
  type Level,
  type QualificationScope,
} from "./model.ts";
import {
  boardSupport,
  orderBoards,
  EMPTY_COVERAGE,
  type BoardSupport,
  type CoverageCounts,
} from "./support.ts";

/**
 * The counts behind every support badge.
 *
 * ============================================================================
 * ⚠ ONE ROUND OF QUERIES, AND THEY READ REAL ROWS (§41)
 * ============================================================================
 * Nothing here is cached, assumed or defaulted to a friendly value. If a
 * query fails the caller is told, because a badge rendered from a failed
 * count would silently read "Coming soon" for a pathway that is actually
 * live — a fault wearing the clothes of an editorial decision, which is the
 * exact shape this codebase keeps finding and fixing.
 *
 * ⚠ THE PUBLIC CATALOGUE CLIENT, NOT THE ADMIN ONE. curricula, courses,
 * lessons and past_papers all carry `catalogue_public_read` policies from
 * 0001, so the student's own session can count them. Reaching for the
 * service-role key here would bypass RLS for data that is already public —
 * privilege with no purpose.
 *
 * ⚠ TUITION IS PASSED IN, NOT COUNTED (§29). See CoverageCounts.hasTuition:
 * `cohorts` has no curriculum FK, so the link is config until the parked
 * migration lands. TUITION_CURRICULA below is that config, and it is
 * deliberately tiny and reviewable rather than a heuristic on cohort slugs.
 */

/**
 * Curricula with a live-tuition cohort today.
 *
 * ⚠ ONE ENTRY, AND IT IS TRUE: the running cohort is IAL Chemistry AS
 * ('ial-chem-as-sep-2026'). Adding a board here that has no cohort would
 * put a "Live tuition" chip on a route where a student cannot book anything
 * — §29's whole point is that platform coverage and tuition availability are
 * different facts and must not be inferred from each other.
 */
const TUITION_CURRICULA = new Set<string>(["edexcel-ial"]);

export type QualificationCoverage = {
  pathway: Pathway;
  boards: BoardSupport[];
  /** Set when a count could not be read — the UI must say so, not guess. */
  error: string | null;
};

type CourseRow = { id: string; curriculum_id: string; pathway: string | null; deck: number };

/**
 * Coverage for one (subject, pathway) — every board that has a curriculum
 * there, with its derived status.
 */
export async function coverageForPathway(
  subjectSlug: string,
  pathway: Pathway,
): Promise<QualificationCoverage> {
  const db = await createClient();

  const { data: subject, error: subjErr } = await db
    .from("subjects").select("id").eq("slug", subjectSlug).maybeSingle();
  if (subjErr) return { pathway, boards: [], error: `subject lookup failed: ${subjErr.message}` };
  if (!subject) return { pathway, boards: [], error: null };

  const { data: courses, error: courseErr } = await db
    .from("courses")
    .select("id, curriculum_id, pathway, curricula(slug, name, short_name)")
    .eq("subject_id", subject.id)
    .eq("pathway", pathway);
  if (courseErr) return { pathway, boards: [], error: `course lookup failed: ${courseErr.message}` };

  const rows = (courses ?? []) as unknown as (CourseRow & {
    curricula: { slug: string; name: string; short_name: string } | null;
  })[];
  if (rows.length === 0) return { pathway, boards: [], error: null };

  const courseIds = rows.map((r) => r.id);

  const [{ data: lessons, error: lessonErr }, { data: papers, error: paperErr }] = await Promise.all([
    db.from("lessons").select("id, course_id, status, deck_path").in("course_id", courseIds),
    db.from("past_papers").select("id, course_id").in("course_id", courseIds),
  ]);
  if (lessonErr) return { pathway, boards: [], error: `lesson counts failed: ${lessonErr.message}` };
  if (paperErr) return { pathway, boards: [], error: `past paper counts failed: ${paperErr.message}` };

  // ⚠ paper_questions IS NOT COUNTED HERE, ON PURPOSE. It refuses anon with
  // 42501 (admin-gated so exam content cannot be scraped), so asking for it
  // from this public page turned every logged-out student's board list into
  // an error. See supportStatusFor: marking is derived from past papers,
  // which the same student can read.

  // Fold every course into its curriculum — a board's answer is the sum of
  // its courses (Edexcel IAL is AS + A2, and a student choosing "Edexcel"
  // is choosing both).
  const byCurriculum = new Map<string, { name: string; counts: CoverageCounts }>();
  for (const r of rows) {
    const slug = r.curricula?.slug;
    if (!slug) continue;
    const entry = byCurriculum.get(slug) ?? {
      name: r.curricula?.name ?? slug,
      counts: { ...EMPTY_COVERAGE, hasTuition: TUITION_CURRICULA.has(slug) },
    };
    entry.counts.courses += 1;
    for (const l of lessons ?? []) {
      if (l.course_id !== r.id) continue;
      entry.counts.lessons += 1;
      if (l.status === "live") entry.counts.liveLessons += 1;
      if (l.deck_path) entry.counts.lessonsWithDecks += 1;
    }
    for (const p of papers ?? []) {
      if (p.course_id !== r.id) continue;
      entry.counts.pastPapers += 1;
    }
    byCurriculum.set(slug, entry);
  }

  const boards: BoardSupport[] = [];
  for (const [slug, entry] of byCurriculum) {
    const s = boardSupport({ curriculumSlug: slug, curriculumName: entry.name, counts: entry.counts });
    if (s) boards.push(s);
  }
  return { pathway, boards: orderBoards(boards), error: null };
}

export async function coverageForScope(
  subjectSlug: string,
  level: Level,
  scope: QualificationScope,
): Promise<QualificationCoverage> {
  return coverageForPathway(subjectSlug, SCOPE_PATHWAY[level][scope]);
}

/**
 * Level-card summary: the boards represented under a level, for the badge row
 * on /learn/[subject].
 *
 * ⚠ THE BADGES NAME BOARDS, THEY DO NOT RANK THEM (§1). A board appears here
 * because a curriculum exists for it under this level — the card explicitly
 * does not claim those boards have equal depth, which is what the per-board
 * step exists to tell the student.
 */
export async function boardsForLevel(
  subjectSlug: string,
  level: Level,
): Promise<{ boards: BoardSupport[]; error: string | null }> {
  const results = await Promise.all(
    LEVEL_PATHWAYS[level].map((p) => coverageForPathway(subjectSlug, p)),
  );
  const error = results.find((r) => r.error)?.error ?? null;
  const seen = new Map<string, BoardSupport>();
  for (const r of results) {
    for (const b of r.boards) {
      // Keep the strongest status a board reaches anywhere under this level.
      const prev = seen.get(b.board);
      if (!prev || orderBoards([b, prev])[0] === b) seen.set(b.board, b);
    }
  }
  return { boards: orderBoards([...seen.values()]), error };
}
