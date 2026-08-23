// ⚠ RELATIVE, NOT "@/…", AND DELIBERATELY SO. The test suites are plain Node
// programs with no bundler, so a tsconfig path alias makes a module
// unloadable by them — and this one carries the taxonomy the suite exists to
// check. Aliases are fine in components; they are not fine in the modules a
// bare-node suite has to import.
import { PATHWAY_COPY, type Pathway } from "../catalogue/pathways.ts";

/**
 * Subject → Level → Qualification → Exam board.
 *
 * ============================================================================
 * ⚠ THIS FILE DESCRIBES STRUCTURE. IT NEVER CLAIMS COMPLETENESS (§41)
 * ============================================================================
 * Every "does Ailemy support this?" answer is DERIVED at runtime from real
 * content counts — live lessons, past papers, the capabilities actually wired
 * for that route — in support.ts. Nothing here says "Expanding" or "Full
 * support", because a hand-typed status is exactly the fabricated
 * completeness the brief forbids: it would be true on the day it was typed
 * and a lie the moment content moved, with nothing to catch it.
 *
 * So this module carries identity and shape only:
 *   which levels exist, which qualifications sit under them, which exam
 *   board a curriculum belongs to, and which curriculum is the flagship.
 *
 * ⚠ IT REUSES WHAT IS ALREADY THERE (§20). The database already models this
 * hierarchy and has since 0001: `curricula` holds 11 board+qualification
 * pairs (edexcel-ial, aqa-gcse, cie-igcse …), `courses.curriculum_id` points
 * at them, and `courses.pathway` (0005) is the qualification grouping. What
 * was genuinely missing is only the LEVEL above pathway and an explicit
 * BOARD field — the first is pure derivation, the second is the one mapping
 * below and a parked _PROPOSED_ column to replace it with data.
 *
 * ⚠ NOTHING HERE IS CHEMISTRY-SPECIFIC (§33). The same structure powers
 * Biology and Physics the day they have courses; subject is a parameter
 * everywhere, never a branch.
 */

// ── level: the first student-facing choice (§CORE) ──────────────────────────

export const LEVELS = ["gcse", "a-level"] as const;
export type Level = (typeof LEVELS)[number];

export const isLevel = (v: string): v is Level => (LEVELS as readonly string[]).includes(v);

export const LEVEL_COPY: Record<Level, {
  slug: Level;
  /** Card title, with the subject appended by the caller. */
  name: string;
  /** The two qualifications it groups, said plainly. */
  subtitle: string;
  ageRange: string;
  description: string;
}> = {
  gcse: {
    slug: "gcse",
    name: "GCSE",
    subtitle: "GCSE + International GCSE",
    ageRange: "Year 10–11",
    description:
      "Build strong foundations with lessons, exam practice and specification-mapped support for UK and international GCSE qualifications.",
  },
  "a-level": {
    slug: "a-level",
    name: "A-Level",
    subtitle: "A-Level + International A-Level",
    ageRange: "Year 12–13",
    description:
      "Advanced study from atomic structure to organic synthesis, with lessons, exam practice and board-specific support.",
  },
};

/**
 * Which existing pathways sit under each level.
 *
 * ⚠ "NATIONAL" IS NOT A WORD THIS PRODUCT USES (§2). The opposite of
 * international is UK, and the pathway slugs already said so.
 *
 * ⚠ ib AND ap ARE DELIBERATELY ABSENT, AND THAT IS NOT AN OVERSIGHT. They are
 * not GCSE or A-Level qualifications, so they cannot honestly hang under
 * either level. They keep their own pathway slugs and routes; the
 * two-card level chooser simply does not claim to cover them.
 */
export const LEVEL_PATHWAYS: Record<Level, readonly Pathway[]> = {
  gcse: ["uk-gcse", "igcse"],
  "a-level": ["uk-a-level", "international-a-level"],
};

export function levelOf(pathway: Pathway): Level | null {
  for (const level of LEVELS) {
    if (LEVEL_PATHWAYS[level].includes(pathway)) return level;
  }
  return null;
}

// ── qualification: UK or international, within a level (§3, §6) ─────────────

export const QUALIFICATION_SCOPES = ["uk", "international"] as const;
export type QualificationScope = (typeof QUALIFICATION_SCOPES)[number];

export const isQualificationScope = (v: string): v is QualificationScope =>
  (QUALIFICATION_SCOPES as readonly string[]).includes(v);

/** The pathway a (level, scope) pair resolves to — the existing slug. */
export const SCOPE_PATHWAY: Record<Level, Record<QualificationScope, Pathway>> = {
  gcse: { uk: "uk-gcse", international: "igcse" },
  "a-level": { uk: "uk-a-level", international: "international-a-level" },
};

export const SCOPE_COPY: Record<QualificationScope, { name: string; description: string }> = {
  uk: {
    name: "UK",
    description: "Qualifications commonly taught in UK schools.",
  },
  international: {
    name: "International",
    description: "Qualifications commonly taught in international schools.",
  },
};

/** Full display name for a (level, scope), matching PATHWAY_COPY exactly. */
export function qualificationName(level: Level, scope: QualificationScope): string {
  return PATHWAY_COPY[SCOPE_PATHWAY[level][scope]].name;
}

// ── exam board ──────────────────────────────────────────────────────────────

export const BOARDS = ["edexcel", "aqa", "ocr", "cambridge", "oxfordaqa"] as const;
export type Board = (typeof BOARDS)[number];

export const BOARD_COPY: Record<Board, { slug: Board; name: string; shortName: string }> = {
  edexcel: { slug: "edexcel", name: "Pearson Edexcel", shortName: "Edexcel" },
  aqa: { slug: "aqa", name: "AQA", shortName: "AQA" },
  ocr: { slug: "ocr", name: "OCR", shortName: "OCR" },
  cambridge: { slug: "cambridge", name: "Cambridge", shortName: "Cambridge" },
  oxfordaqa: { slug: "oxfordaqa", name: "OxfordAQA", shortName: "OxfordAQA" },
};

/**
 * ⚠ THE ONE HARDCODED MAPPING IN THIS FILE, AND THE NAMED WIRING POINT.
 * ==========================================================================
 * `curricula` has slug, name, short_name and region — but no exam_board
 * column, so the board a curriculum belongs to is only implied by its slug.
 * Rather than parse a slug at runtime (which would silently mis-bucket the
 * first curriculum whose slug does not follow the convention), the mapping is
 * written out once, here, where it is reviewable.
 *
 * The parked _PROPOSED_ migration adds `curricula.exam_board` and
 * `curricula.specification_code`; when it is applied, this constant becomes a
 * fallback for rows that have not been backfilled, and then it goes away.
 *
 * Curricula deliberately absent: `ib` and `ap` are not board-based
 * qualifications. Mapping them to a board would invent a fact.
 */
export const CURRICULUM_BOARD: Record<string, Board> = {
  "edexcel-ial": "edexcel",
  "edexcel-igcse": "edexcel",
  "edexcel-alevel": "edexcel",
  "edexcel-gcse": "edexcel",
  "aqa-alevel": "aqa",
  "aqa-gcse": "aqa",
  "ocr-alevel": "ocr",
  "ocr-gcse": "ocr",
  "cie-igcse": "cambridge",
};

/**
 * The flagship route (§9, §22) — named by curriculum slug, not by board, so
 * "Edexcel" as a whole is never implied to be uniformly deep.
 *
 * ⚠ THIS IS A CLAIM ABOUT RELATIVE DEPTH AND IT IS CHECKED. The suite asserts
 * the flagship genuinely has the most live content of any curriculum for its
 * subject — if another pathway overtakes it, the test fails rather than the
 * badge quietly becoming wrong.
 */
export const FLAGSHIP_CURRICULUM = "edexcel-ial";
