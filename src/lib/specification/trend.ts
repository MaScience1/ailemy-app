/**
 * The trend engine — is this bucket improving, declining, stable or stalled?
 *
 * ============================================================================
 * ⚠ THE CLASSIFICATION, EXACTLY, SO IT CAN BE ARGUED WITH
 * ============================================================================
 * Two evidence WINDOWS are compared, both counted in ASSESSED MARKS (§95:
 * marks, never answer counts — a six-mark explanation is not two MCQs):
 *
 *   recent   = the newest answers, walked backwards until their tariff
 *              reaches TREND_WINDOW_MARKS
 *   earlier  = the next answers back, filled the same way
 *
 * Anything older than the two windows is ignored — the question is "how does
 * recent work compare with the work just before it", not "with the student's
 * first-ever attempt". Rows without a timestamp cannot be placed and are
 * excluded. If EITHER window cannot be filled the verdict is
 * insufficient-evidence — a trend claimed off half a window is the same
 * false precision §22 forbids in a percentage.
 *
 * Then, with r = recent marks ratio and e = earlier marks ratio:
 *
 *   r - e >= +TREND_MOVE_AT      → improving
 *   r - e <= -TREND_MOVE_AT      → declining
 *   otherwise, r >= SECURE_AT    → stable    (flat where flat is fine)
 *   otherwise                    → stalled   (flat where flat is the problem)
 *
 * STALLED is deliberately the flat-below-secure case and nothing subtler:
 * both windows are full, so at least 2 x TREND_WINDOW_MARKS of assessed work
 * says repeated practice is not producing meaningful improvement — the state
 * Hydrogen reads as "more questions alone may not work". It can NEVER fire on
 * trivial evidence, because insufficient-evidence fires first.
 *
 * TREND_MOVE_AT = 0.15: a move smaller than 15 points of ratio across
 * 12-mark windows is one answer's worth of noise (one 2-mark swing on 12
 * marks is 0.17). A round number on purpose, like every threshold here.
 */

import {
  MASTERY_EVIDENCE_FLOOR_MARKS,
  MASTERY_SECURE_AT,
} from "../account/academic.ts";
import type { MasteryEvidenceRow, SpecTrend } from "./types.ts";

/** Window size in assessed marks — the evidence floor, reused: the same
 *  quantity of marks that earns a mastery state earns a window. */
export const TREND_WINDOW_MARKS = MASTERY_EVIDENCE_FLOOR_MARKS;

/** The smallest ratio move the windows can distinguish from noise. */
export const TREND_MOVE_AT = 0.15;

const INSUFFICIENT: SpecTrend = {
  state: "insufficient-evidence",
  recentRatio: null,
  earlierRatio: null,
  recentMarks: 0,
  earlierMarks: 0,
};

/**
 * Rows may arrive in any order; only rows with a timestamp participate.
 * Deterministic for identical input, including ties: same-instant rows are
 * ordered by (attemptId, qIndex) so two runs can never disagree.
 */
export function trendFor(rows: MasteryEvidenceRow[]): SpecTrend {
  const dated = rows
    .filter((r) => r.attemptedAt !== null)
    .sort(
      (a, b) =>
        a.attemptedAt!.localeCompare(b.attemptedAt!) ||
        a.attemptId.localeCompare(b.attemptId) ||
        a.qIndex - b.qIndex,
    );

  // Walk backwards from the newest, filling recent then earlier.
  let recentAwarded = 0, recentMarks = 0;
  let earlierAwarded = 0, earlierMarks = 0;
  for (let i = dated.length - 1; i >= 0; i--) {
    const r = dated[i];
    if (recentMarks < TREND_WINDOW_MARKS) {
      recentAwarded += r.markAwarded;
      recentMarks += r.markAvailable;
    } else if (earlierMarks < TREND_WINDOW_MARKS) {
      earlierAwarded += r.markAwarded;
      earlierMarks += r.markAvailable;
    } else {
      break; // older than both windows — not this question's evidence
    }
  }

  if (recentMarks < TREND_WINDOW_MARKS || earlierMarks < TREND_WINDOW_MARKS) {
    return INSUFFICIENT;
  }

  const recentRatio = recentAwarded / recentMarks;
  const earlierRatio = earlierAwarded / earlierMarks;
  const delta = recentRatio - earlierRatio;

  const state =
    delta >= TREND_MOVE_AT
      ? "improving"
      : delta <= -TREND_MOVE_AT
        ? "declining"
        : recentRatio >= MASTERY_SECURE_AT
          ? "stable"
          : "stalled";

  return { state, recentRatio, earlierRatio, recentMarks, earlierMarks };
}
