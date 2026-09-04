/**
 * History — what did we believe at date X, and how has the figure moved?
 *
 * ============================================================================
 * ⚠ HISTORY IS DERIVED, NEVER STORED (Service 3 spec §4/§15)
 * ============================================================================
 * The attempt tables are append-only with timestamps, so "mastery as of X"
 * is buildCourseMastery over the rows that existed by X — the SAME
 * calculation, the same floor, the same bands, filtered by time. No snapshot
 * table exists and none is created until a measured performance problem
 * demands one (see the Phase 2 report's measurement).
 *
 * ⚠ NO FUTURE LEAKAGE: a row with attemptedAt > at simply does not exist for
 * that view. Rows WITHOUT a timestamp cannot be placed in time and are
 * excluded from every as-of view (practice rows always carry attempted_at,
 * exam rows submitted_at — the untimestamped row is theoretical, but the
 * rule for it is written down rather than left to chance).
 *
 * THE SERIES: up to SERIES_POINTS weekly points ending now, each the
 * CUMULATIVE course marks (and masteryPercent, which refuses below the floor
 * exactly as it does live) as of that instant. Weekly because evidence
 * arrives in study sessions, not continuously — finer buckets would draw
 * noise, coarser would hide a term. The series starts at the first
 * timestamped evidence; no points are manufactured before it.
 */

import { masteryPercent } from "../account/academic.ts";
import { buildCourseMastery, courseVocabulary, usableEvidence } from "./mastery.ts";
import type {
  CourseMastery,
  MasteryEvidenceRow,
  SeriesPoint,
  SpecUnitNode,
} from "./types.ts";

export const SERIES_POINTS = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The mastery model, as it stood at `atIso`. Same calculation, older world. */
export function masteryAsOf(input: {
  units: SpecUnitNode[];
  evidence: MasteryEvidenceRow[];
  atIso: string;
}): CourseMastery {
  return buildCourseMastery({
    units: input.units,
    evidence: input.evidence.filter(
      (r) => r.attemptedAt !== null && r.attemptedAt <= input.atIso,
    ),
  });
}

/**
 * Course-level cumulative series — one pass over the sorted usable evidence,
 * O(rows + points), so a term of history costs what one page load costs.
 */
export function masterySeries(input: {
  units: SpecUnitNode[];
  evidence: MasteryEvidenceRow[];
  nowIso: string;
  points?: number;
}): SeriesPoint[] {
  const { topicOfCode } = courseVocabulary(input.units);
  const { usable } = usableEvidence(topicOfCode, input.evidence);
  const dated = usable
    .filter((r) => r.attemptedAt !== null)
    .sort((a, b) => a.attemptedAt!.localeCompare(b.attemptedAt!));
  if (dated.length === 0) return [];

  const pointCount = Math.max(2, input.points ?? SERIES_POINTS);
  const now = Date.parse(input.nowIso);
  const first = Date.parse(dated[0].attemptedAt!);

  // Weekly boundaries ending now, clipped to when evidence began — a series
  // that started before the student did would be flat manufactured zeros.
  const boundaries: number[] = [];
  for (let k = pointCount - 1; k >= 0; k--) boundaries.push(now - k * WEEK_MS);
  const wanted = boundaries.filter((b) => b >= first);
  if (wanted.length === 0) return seriesAt([now], dated);
  // Always end at now, even when the first evidence is newer than every
  // weekly boundary except the last.
  return seriesAt(wanted, dated);
}

function seriesAt(boundaries: number[], sortedRows: MasteryEvidenceRow[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  let i = 0;
  let awarded = 0;
  let outOf = 0;
  for (const b of boundaries) {
    while (i < sortedRows.length && Date.parse(sortedRows[i].attemptedAt!) <= b) {
      awarded += sortedRows[i].markAwarded;
      outOf += sortedRows[i].markAvailable;
      i += 1;
    }
    out.push({
      atIso: new Date(b).toISOString(),
      awarded,
      outOf,
      percent: masteryPercent(awarded, outOf),
    });
  }
  return out;
}
