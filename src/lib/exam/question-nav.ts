/**
 * Canonical question paths, and where a question's evidence lives.
 *
 * ============================================================================
 * PURE AND IMPORT-FREE, DELIBERATELY
 * ============================================================================
 * The review surface is a client component and the loader is `server-only`.
 * This is the logic both need and neither can own, and it is the part worth
 * testing without a browser, a database or a PDF.
 *
 * ============================================================================
 * ⚠ THE BUG THIS EXISTS TO FIX: 0-BASED EXTRACTION, 1-BASED VIEWER
 * ============================================================================
 * extract-markscheme.py writes `"page": page_no` where page_no comes from
 * `range(doc.page_count)` — ZERO-based. pdf.js `getPage(n)` is ONE-based. The
 * review surface passed the artefact's number straight to the viewer, so every
 * question rendered the page BEFORE its own:
 *
 *   Q3  artefact page 5  ->  viewer shows physical page 5
 *   physical page 5 actually contains  Q1 and Q2
 *
 * which is exactly the reported symptom, and it is silent: every page is a
 * real mark-scheme page full of plausible rows, so nothing looks broken until
 * you read the question numbers.
 *
 * The conversion happens HERE, once, in toViewerPage(). Nowhere else may add
 * or subtract one from a page number.
 */

// ============================================================================
// CANONICAL QUESTION PATHS
// ============================================================================

/**
 * A question number decomposed into its hierarchy.
 *
 * ⚠ SEGMENTS, NOT A STRING. "20(a)" and "20(b)" share a prefix, and
 * `startsWith` cannot tell "20(a) is part of 20" from "20(a) is 20(a)(i)'s
 * parent" — or, worse, that "2" is a prefix of "20". Every comparison in this
 * file is on the segment array.
 */
export type QuestionPath = {
  /** As printed: "20(a)(i)". */
  raw: string;
  /** ["20", "a", "i"] — the top-level number first, then each bracket. */
  segments: string[];
  /** "20.a.i" — stable, comparable, safe as a key. */
  canonical: string;
  /** How deep: 20 -> 1, 20(a) -> 2, 20(a)(i) -> 3. */
  depth: number;
};

const SEGMENT_RE = /^\s*(\d+)\s*((?:\([^()]+\))*)\s*$/;

/**
 * Parse a printed question number into a canonical path.
 *
 * Returns null for anything that is not a question number, rather than
 * guessing — an unparseable label must not silently become a sibling of
 * something real.
 */
export function parseQuestionPath(raw: string): QuestionPath | null {
  if (typeof raw !== "string") return null;
  const m = SEGMENT_RE.exec(raw);
  if (!m) return null;
  const [, num, brackets] = m;
  const parts = (brackets.match(/\([^()]+\)/g) ?? []).map((b) =>
    b.slice(1, -1).trim().toLowerCase(),
  );
  if (parts.some((p) => p.length === 0)) return null;
  const segments = [num, ...parts];
  return {
    raw: raw.trim(),
    segments,
    canonical: segments.join("."),
    depth: segments.length,
  };
}

/** Exactly the same question. "20(a)" is NOT "20", and NOT "20(b)". */
export function isSameQuestion(a: QuestionPath, b: QuestionPath): boolean {
  return a.canonical === b.canonical;
}

/**
 * Is `ancestor` a strict ancestor of `descendant`?
 *
 * 20 is an ancestor of 20(a) and of 20(a)(i). 20(a) is NOT an ancestor of
 * 20(b). A question is not its own ancestor.
 *
 * ⚠ SEGMENT-WISE. A string prefix test would call "2" an ancestor of "20",
 * which would attach Q2's mark scheme to every part of Q20.
 */
export function isAncestorOf(ancestor: QuestionPath, descendant: QuestionPath): boolean {
  if (ancestor.depth >= descendant.depth) return false;
  return ancestor.segments.every((s, i) => descendant.segments[i] === s);
}

// ============================================================================
// EXAM ORDER
// ============================================================================

/**
 * A lowercase roman numeral's value, or null if the segment is not one.
 *
 * ⚠ ONLY i, v AND x, DELIBERATELY. C, D, L and M are also roman digits, so a
 * general parser reads the part letter "(c)" as 100 and sorts it after "(i)".
 * Restricting the alphabet to {i,v,x} makes the ambiguity provably harmless:
 * for every SINGLE letter that remains ambiguous — i, v, x — the roman order
 * and the alphabetic order agree (i<v<x is 1<5<10), and any pair involving a
 * letter outside the set falls through to the string comparison below, which
 * is the right answer for letters. The two orders only diverge from two
 * characters up — (viii) vs (ix) — which is never a part letter.
 *
 * ⚠ ROUND-TRIPPED, so non-canonical spellings are REFUSED rather than
 * silently valued. "iiii" and "vv" return null and sort as strings; inventing
 * a number for them would impose an order the paper never printed.
 */
const ROMAN_DIGITS: Record<string, number> = { i: 1, v: 5, x: 10 };
const ROMAN_UNITS: readonly [number, string][] = [
  [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
];

function toRoman(n: number): string {
  let out = "";
  let left = n;
  for (const [value, glyph] of ROMAN_UNITS) {
    while (left >= value) {
      out += glyph;
      left -= value;
    }
  }
  return out;
}

export function romanValue(segment: string): number | null {
  if (!/^[ivx]+$/.test(segment)) return null;
  let total = 0;
  for (let i = 0; i < segment.length; i++) {
    const cur = ROMAN_DIGITS[segment[i]];
    const next = ROMAN_DIGITS[segment[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total > 0 && toRoman(total) === segment ? total : null;
}

/**
 * Canonical exam order: 2 before 10 before 20, 20 before 20(a), 20(a)(i)
 * before 20(a)(ii) before 20(b), 20(b) before 21.
 *
 * ⚠ THREE COMPARISONS, IN THIS ORDER, AND NONE OF THEM IS `<` ON THE WHOLE
 * STRING. As printed strings, "10" sorts before "2" and "(ix)" before
 * "(viii)"; both are wrong, and both are the kind of wrong a reviewer reads as
 * a missing question rather than a sorting bug.
 */
export function compareQuestionPaths(a: QuestionPath, b: QuestionPath): number {
  const n = Math.min(a.segments.length, b.segments.length);
  for (let i = 0; i < n; i++) {
    const x = a.segments[i];
    const y = b.segments[i];
    if (x === y) continue;

    // 1. Numbers as numbers. This is the top-level question number, always.
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny;

    // 2. Roman subparts as numbers.
    const rx = romanValue(x);
    const ry = romanValue(y);
    if (rx !== null && ry !== null) return rx - ry;

    // 3. Part letters as letters.
    return x < y ? -1 : 1;
  }
  // A parent sorts before its own parts: 20 before 20(a).
  return a.segments.length - b.segments.length;
}

/**
 * Compare two question numbers as printed, for sorting a list of them.
 *
 * ⚠ AN UNPARSEABLE LABEL SORTS LAST AND KEEPS ITS PLACE, rather than being
 * dropped or thrown on. Array.prototype.sort is stable, so returning 0 between
 * two unparseable labels leaves them in the order the artefact recorded. A
 * navigator that silently omits a question it could not name would hide work
 * that still needs ruling — the opposite of what the list is for.
 */
export function compareQuestionNumbers(a: string, b: string): number {
  const pa = parseQuestionPath(a);
  const pb = parseQuestionPath(b);
  if (pa && pb) return compareQuestionPaths(pa, pb);
  if (pa) return -1;
  if (pb) return 1;
  return 0;
}

/**
 * Canonical exam order, as a NEW array.
 *
 * ⚠ A COPY, NEVER IN PLACE. The list this sorts is the loader's own data, and
 * the artefact's recorded order is provenance: it is the order the extractor
 * read the mark scheme in. This is a display concern and must not reach back
 * into the thing being displayed.
 */
export function sortByQuestionNumber<T>(rows: readonly T[], of: (row: T) => string): T[] {
  return [...rows].sort((x, y) => compareQuestionNumbers(of(x), of(y)));
}

/**
 * Find the row whose question number IS this one.
 *
 * ⚠ EXACT ONLY, AND THAT IS THE POINT. The temptation is to fall back to an
 * ancestor when the exact part is not seeded — "no row for 20(a)? use 20" —
 * and that is precisely the mis-mapping the spec forbids: it would put the
 * reviewer on Q20's stem while the card shows 20(a). A missing row is answered
 * by block provenance below, not by a nearby row.
 */
export function findExactRow<T extends { questionNumber: string }>(
  rows: readonly T[],
  target: QuestionPath,
): T | null {
  for (const r of rows) {
    const p = parseQuestionPath(r.questionNumber);
    if (p && isSameQuestion(p, target)) return r;
  }
  return null;
}

// ============================================================================
// WHERE THE EVIDENCE IS
// ============================================================================

/** Anything in the artefact carrying a page and a y. */
export type Located = { page: number; y: number };

export type SourceLocation = {
  /** 1-based, ready for pdf.js. See toViewerPage. */
  page: number;
  /** Top of the band, in PDF points, top-left origin, y down. */
  top: number;
  /** Bottom of the band. Always > top. */
  bottom: number;
  /** Where the location came from, so the UI can say so and tests can assert it. */
  basis: "block-provenance" | "canonical-row";
};

/**
 * ⚠ THE ONLY PLACE A PAGE INDEX IS CONVERTED. See the header.
 */
export const toViewerPage = (extractionPage: number): number => extractionPage + 1;

/**
 * A minimum band height in points.
 *
 * A single line's y is a point, not a region; highlighting one point produces
 * a hairline the eye slides off. This is roughly one table row.
 */
const MIN_BAND = 18;

/**
 * Locate a mark-scheme block's own evidence, from the block's own extraction.
 *
 * ⚠ EVERY BLOCK HAS THIS, WHICH IS WHY IT IS THE FALLBACK THAT CANNOT FAIL.
 * Only 10 of WCH11/01's 47 blocks have a seeded paper_questions row, but all
 * 47 carry a page and a y for their mark cell, their points and their flagged
 * lines. So selection never produces a dead click: where the canonical row is
 * missing, the block still knows where it came from.
 *
 * The band spans everything the block owns on its FIRST page, so moving
 * between two questions on one page moves the highlight rather than sitting at
 * the top of a page they share.
 */
export function locateBlock(block: {
  page?: number | null;
  marks?: Located | null;
  points?: readonly Located[];
  requiresRuling?: readonly Located[];
  guidance?: readonly Located[];
}): SourceLocation | null {
  const anchorPage = block.marks?.page ?? block.page;
  if (anchorPage === null || anchorPage === undefined) return null;

  const ys: number[] = [];
  const collect = (xs?: readonly Located[]) => {
    for (const x of xs ?? []) {
      if (x && x.page === anchorPage && Number.isFinite(x.y)) ys.push(x.y);
    }
  };
  if (block.marks && block.marks.page === anchorPage) ys.push(block.marks.y);
  collect(block.points);
  collect(block.requiresRuling);
  collect(block.guidance);

  if (ys.length === 0) return null;
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    page: toViewerPage(anchorPage),
    top,
    bottom: bottom - top < MIN_BAND ? top + MIN_BAND : bottom,
    basis: "block-provenance",
  };
}

/**
 * Turn a location into what the viewer needs: a page, a highlight band as a
 * percentage of page height, and a scroll target that CENTRES the band.
 *
 * ⚠ PERCENTAGES, NOT PIXELS. The canvas is re-scaled to the pane width on
 * every resize, so a pixel offset computed at one width is wrong at another.
 * The mapper already learned this; the same rule applies here.
 */
export type ViewerTarget = {
  page: number;
  /** 0..100 from the top of the page. */
  topPct: number;
  heightPct: number;
  /** 0..1: where to put the band's centre in the scroll container. */
  centreFraction: number;
  basis: SourceLocation["basis"];
};

export function toViewerTarget(loc: SourceLocation, pageHeightPt: number): ViewerTarget | null {
  if (!(pageHeightPt > 0)) return null;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const topPct = clamp((loc.top / pageHeightPt) * 100);
  const bottomPct = clamp((loc.bottom / pageHeightPt) * 100);
  return {
    page: loc.page,
    topPct,
    heightPct: Math.max(0.5, bottomPct - topPct),
    centreFraction: (topPct + bottomPct) / 200,
    basis: loc.basis,
  };
}

/**
 * Does moving from one target to another need a page change, a scroll, or
 * neither?
 *
 * ⚠ THE SAME-PAGE CASE IS THE BUG THE SPEC NAMES. Q1 and Q2 share a page; the
 * old code only ever called setPage, so moving between them changed nothing on
 * screen and the reviewer was left hunting. "scroll" is a real outcome, and
 * the caller must act on it.
 */
export type NavMove = "page" | "scroll" | "none";

export function navMove(from: ViewerTarget | null, to: ViewerTarget): NavMove {
  if (!from) return "page";
  if (from.page !== to.page) return "page";
  return Math.abs(from.topPct - to.topPct) < 0.01 ? "none" : "scroll";
}
