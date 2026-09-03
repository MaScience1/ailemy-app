/**
 * Strengths and weaknesses — evidence-aware, never "lowest percentage wins".
 *
 * ============================================================================
 * ⚠ THE WEAKNESS SCORE, EXACTLY (Service 3 spec §9/§16)
 * ============================================================================
 * Candidates: points whose evidence floor is met and whose marks ratio is
 * below MASTERY_SECURE_AT — i.e. emerging and developing. Points BELOW the
 * floor are not weaknesses; they are unknowns, and recommendNext() already
 * routes them as finish-evidence. A 0-of-1 point can therefore never outrank
 * ten repeated failures — it never enters the ranking at all.
 *
 *   score = (SECURE_AT - ratio) x confidenceWeight + trendBump
 *
 *   confidenceWeight   high 1.0 · limited WEAKNESS_LIMITED_WEIGHT (0.6)
 *                      — the same shortfall on thin evidence matters, but
 *                      less than the same shortfall proven over 24+ marks
 *   trendBump          declining +0.15 · stalled +0.10 · otherwise 0
 *                      — getting worse (or provably not getting better)
 *                      outranks an equal ratio that is improving
 *
 * Highest score first; ties by spec-code order, so the ranking is fully
 * deterministic. Every row carries a reason built from the same numbers.
 *
 * STRENGTHS are the mirror without the arithmetic: secure points, high
 * confidence before limited, then higher ratio, then code order — a strength
 * needs no priority formula because nothing is triaged by it.
 */

import { MASTERY_SECURE_AT } from "../account/academic.ts";
import { compareSpecCodes } from "./codes.ts";
import type {
  RankedArea,
  RetentionFacts,
  SpecMasteryFacts,
  SpecTrend,
} from "./types.ts";

export const WEAKNESS_LIMITED_WEIGHT = 0.6;
export const WEAKNESS_DECLINING_BUMP = 0.15;
export const WEAKNESS_STALLED_BUMP = 0.1;

type PointInput = {
  specCode: string;
  topicId: string;
  facts: SpecMasteryFacts;
  trend: SpecTrend;
  retention: RetentionFacts;
};

export function weaknessesFor(input: {
  points: PointInput[];
  limit?: number;
}): RankedArea[] {
  const scored: (RankedArea & { score: number })[] = [];
  for (const p of input.points) {
    if (p.facts.state !== "emerging" && p.facts.state !== "developing") continue;
    const ratio = p.facts.awarded / Math.max(1, p.facts.outOf);
    const weight = p.facts.evidenceConfidence === "high" ? 1 : WEAKNESS_LIMITED_WEIGHT;
    const bump =
      p.trend.state === "declining"
        ? WEAKNESS_DECLINING_BUMP
        : p.trend.state === "stalled"
          ? WEAKNESS_STALLED_BUMP
          : 0;
    scored.push({
      specCode: p.specCode,
      topicId: p.topicId,
      facts: p.facts,
      trend: p.trend.state,
      reason: weaknessReason(p),
      score: (MASTERY_SECURE_AT - ratio) * weight + bump,
    });
  }
  scored.sort(
    (a, b) => b.score - a.score || compareSpecCodes(a.specCode, b.specCode),
  );
  const limit = input.limit ?? scored.length;
  return scored.slice(0, Math.max(0, limit)).map(({ score: _s, ...row }) => row);
}

export function strengthsFor(input: {
  points: PointInput[];
  limit?: number;
}): RankedArea[] {
  const rows: RankedArea[] = [];
  for (const p of input.points) {
    if (p.facts.state !== "secure") continue;
    rows.push({
      specCode: p.specCode,
      topicId: p.topicId,
      facts: p.facts,
      trend: p.trend.state,
      reason: strengthReason(p),
    });
  }
  rows.sort((a, b) => {
    const conf =
      Number(b.facts.evidenceConfidence === "high") -
      Number(a.facts.evidenceConfidence === "high");
    if (conf !== 0) return conf;
    const ratio =
      b.facts.awarded / Math.max(1, b.facts.outOf) -
      a.facts.awarded / Math.max(1, a.facts.outOf);
    if (ratio !== 0) return ratio;
    return compareSpecCodes(a.specCode, b.specCode);
  });
  const limit = input.limit ?? rows.length;
  return rows.slice(0, Math.max(0, limit));
}

function weaknessReason(p: PointInput): string {
  const parts = [`${p.facts.awarded} of ${p.facts.outOf} marks`];
  if (p.trend.state === "declining") parts.push("recent work is weaker than before");
  else if (p.trend.state === "stalled") parts.push("practice isn't moving it yet");
  if (p.facts.evidenceConfidence === "limited") parts.push("limited evidence so far");
  if (p.retention.failStreak >= 2) parts.push(`${p.retention.failStreak} misses in a row`);
  return parts.join(" · ");
}

function strengthReason(p: PointInput): string {
  const parts = [`${p.facts.awarded} of ${p.facts.outOf} marks`];
  if (p.facts.evidenceConfidence === "high") parts.push("high confidence");
  if (p.retention.band === "fresh") parts.push("recently demonstrated");
  else if (p.retention.retrievalDue) parts.push("not shown for a while");
  return parts.join(" · ");
}
