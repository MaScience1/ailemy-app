import {
  BOARD_COPY,
  CURRICULUM_BOARD,
  FLAGSHIP_CURRICULUM,
  type Board,
} from "./model.ts";

/**
 * Support status — DERIVED from content that exists, never declared (§41).
 *
 * ============================================================================
 * ⚠ WHY THIS IS A FUNCTION AND NOT A COLUMN OF LABELS
 * ============================================================================
 * The brief's own illustration shows AQA and OCR as "Expanding · Core lessons
 * · Practice". Typing that in would have made the interface look symmetrical
 * and made the product a liar: as of 2026-08-23 the database holds 171
 * Chemistry lessons for edexcel-ial and **zero** for every other curriculum —
 * AQA, OCR, Cambridge, Edexcel GCSE, Edexcel IGCSE and Edexcel UK A-Level all
 * have courses with no lessons at all. There is no shared core-content layer
 * mapped to them yet, so "Expanding" would be a claim about content nobody
 * has written.
 *
 * Deriving from counts means the badge cannot drift: the day a lesson is
 * published against AQA, AQA stops saying "Coming soon" on its own, and the
 * day one is unpublished it goes back. Nobody has to remember.
 *
 * ⚠ CAPABILITY CHIPS ARE THE SAME RULE, PER CAPABILITY (§27). A chip appears
 * only where that capability genuinely works for that route. An empty chip
 * row is a truthful answer.
 */

export const SUPPORT_STATUSES = ["full_support", "supported", "expanding", "coming_soon"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const CAPABILITIES = ["lessons", "practice", "past_papers", "marking", "progress", "tuition"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABEL: Record<Capability, string> = {
  lessons: "Lessons",
  practice: "Practice",
  past_papers: "Past papers",
  marking: "Marking",
  progress: "Progress",
  tuition: "Live tuition",
};

/** Raw, countable facts about one curriculum within one subject. */
export type CoverageCounts = {
  courses: number;
  lessons: number;
  liveLessons: number;
  /** Lessons with a published deck — what the practice engine generates from. */
  lessonsWithDecks: number;
  pastPapers: number;
  /**
   * ⚠ TUITION IS CONFIGURED, NOT DERIVED, AND §29 IS WHY IT IS A SEPARATE
   * FIELD. Platform coverage and live-tuition availability are different
   * facts: a board can be fully supported by the learning platform with no
   * cohort running, and that must not read as "no support". It is not
   * derivable today because `cohorts` (0009) carries only a slug — no
   * curriculum_id, no subject_id — so nothing links a cohort to a
   * curriculum. The parked _PROPOSED_ migration adds that column; until it
   * lands the caller passes the answer in explicitly.
   */
  hasTuition: boolean;
};

export const EMPTY_COVERAGE: CoverageCounts = {
  courses: 0, lessons: 0, liveLessons: 0, lessonsWithDecks: 0,
  pastPapers: 0, hasTuition: false,
};

/**
 * Which capabilities genuinely work for a curriculum (§27).
 *
 * ⚠ progress AND marking ARE NOT PLATFORM-WIDE CLAIMS. Progress tracking is
 * real only where there is something to track — a live lesson. Marking is
 * real only where there are paper questions to mark. Both features exist in
 * the codebase for every route; that is not the same as them being useful on
 * a route with no content, and a chip saying otherwise would be exactly the
 * §27 violation.
 */
export function capabilitiesFor(c: CoverageCounts): Capability[] {
  const out: Capability[] = [];
  if (c.liveLessons > 0) out.push("lessons");
  if (c.lessonsWithDecks > 0) out.push("practice");
  if (c.pastPapers > 0) out.push("past_papers");
  // ⚠ MARKING IS DERIVED FROM PAPERS, NOT FROM QUESTION ROWS, AND THE REASON
  // IS A PERMISSION BOUNDARY. `paper_questions` refuses anon with 42501 — it
  // is admin-gated so exam content is not scrapeable — so counting it from a
  // public page asked a question the reader is not allowed to ask and failed
  // the whole board list for every logged-out student. A page must derive its
  // claims from what its own viewer may read; anything else is a privilege
  // leak waiting to be written, or an outage waiting to happen.
  if (c.pastPapers > 0) out.push("marking");
  if (c.liveLessons > 0) out.push("progress");
  if (c.hasTuition) out.push("tuition");
  return out;
}

/**
 * The status ladder. Read it as "what can a student actually do here today".
 *
 *   coming_soon — nothing published. Courses may exist as empty shells; a
 *                 shell is not an offering.
 *   expanding   — the curriculum is mapped and lessons are written, but none
 *                 are published yet. Real work, honestly not usable yet.
 *   supported   — at least one published lesson: there is something to learn.
 *   full_support— published lessons AND the exam apparatus around them (past
 *                 papers with questions to mark). The flagship shape.
 */
export function supportStatusFor(c: CoverageCounts): SupportStatus {
  if (c.liveLessons === 0) return c.lessons > 0 ? "expanding" : "coming_soon";
  if (c.pastPapers > 0) return "full_support";
  return "supported";
}

export type BoardSupport = {
  board: Board;
  boardName: string;
  curriculumSlug: string;
  curriculumName: string;
  status: SupportStatus;
  capabilities: Capability[];
  counts: CoverageCounts;
  isFlagship: boolean;
};

export function boardSupport(input: {
  curriculumSlug: string;
  curriculumName: string;
  counts: CoverageCounts;
}): BoardSupport | null {
  const board = CURRICULUM_BOARD[input.curriculumSlug];
  // ⚠ A curriculum with no board mapping (ib, ap) is NOT rendered as a board.
  // Returning null rather than guessing keeps the "which board?" step honest.
  if (!board) return null;
  const status = supportStatusFor(input.counts);
  return {
    board,
    boardName: BOARD_COPY[board].name,
    curriculumSlug: input.curriculumSlug,
    curriculumName: input.curriculumName,
    status,
    capabilities: capabilitiesFor(input.counts),
    counts: input.counts,
    // ⚠ FLAGSHIP IS A CLAIM ABOUT DEPTH, SO IT IS ONLY TRUE WHILE IT EARNS IT.
    // A curriculum badged flagship with nothing published would be the
    // loudest possible false claim on the page.
    isFlagship: input.curriculumSlug === FLAGSHIP_CURRICULUM && status !== "coming_soon",
  };
}

/** Display order: what a student can use most, first — flagship always leads. */
export function orderBoards(rows: BoardSupport[]): BoardSupport[] {
  const rank: Record<SupportStatus, number> = {
    full_support: 0, supported: 1, expanding: 2, coming_soon: 3,
  };
  return [...rows].sort((a, b) =>
    Number(b.isFlagship) - Number(a.isFlagship) ||
    rank[a.status] - rank[b.status] ||
    a.boardName.localeCompare(b.boardName),
  );
}
