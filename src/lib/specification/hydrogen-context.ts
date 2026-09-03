/**
 * The Hydrogen read contract — built and tested in Phase 2, WIRED IN PHASE 3.
 *
 * ============================================================================
 * ⚠ MASTERY DETERMINES ACADEMIC STATE; HYDROGEN INTERPRETS IT (master rule)
 * ============================================================================
 * masteryContextFor() reduces the SAME CourseInsights the student's own page
 * renders into the structured state Hydrogen will read — so the tutor and the
 * student can never be told different things. It is a pure reduction: no new
 * thresholds, no re-ranking, no database, no clock.
 *
 * PHASE BOUNDARY, deliberately hard: nothing on any Hydrogen branch imports
 * this file yet, this branch imports nothing of Hydrogen's, and no server
 * action exposes it. Phase 3 wires it into TutorContext behind Hydrogen's own
 * gates, after review. Hydrogen never writes mastery — its future retrieval
 * answers enter as evidence through the same attempt tables as everything
 * else.
 */

import type {
  CourseInsights,
  CourseMastery,
  MasteryContext,
  SpecUnitNode,
} from "./types.ts";

/** How many rows each area list carries — enough to act on, small enough to
 *  fit a prompt without drowning it. */
export const CONTEXT_AREA_LIMIT = 5;

export function masteryContextFor(input: {
  courseId: string;
  units: SpecUnitNode[];
  mastery: CourseMastery;
  insights: CourseInsights;
}): MasteryContext {
  const { insights } = input;

  const withTrend = (state: "improving" | "declining" | "stalled") =>
    Object.entries(insights.trendByCode)
      .filter(([, t]) => t.state === state)
      .map(([specCode]) => ({
        specCode,
        topicId: topicOf(input.units, specCode),
        trend: state,
      }))
      .slice(0, CONTEXT_AREA_LIMIT);

  return {
    courseId: input.courseId,
    weakestAreas: insights.weaknesses.slice(0, CONTEXT_AREA_LIMIT),
    strongestAreas: insights.strengths.slice(0, CONTEXT_AREA_LIMIT),
    retrievalDue: insights.queue.slice(0, CONTEXT_AREA_LIMIT),
    recentlyImproved: withTrend("improving"),
    decliningAreas: withTrend("declining"),
    stalledAreas: withTrend("stalled"),
    currentSpecificationPosition: positionOf(input.units, input.mastery),
    recentPerformance: insights.series.slice(-4),
    summary: input.mastery.summary,
  };
}

function topicOf(units: SpecUnitNode[], specCode: string): string {
  for (const u of units) {
    for (const t of u.topics) {
      if (t.points.some((p) => p.code === specCode)) return t.id;
    }
  }
  return "";
}

/**
 * "Where the student is": the first point with NO evidence that comes after
 * the last point with ANY evidence, in curriculum order — the next unopened
 * page, not the furthest-ever page. null when nothing has been attempted or
 * everything has.
 */
function positionOf(
  units: SpecUnitNode[],
  mastery: CourseMastery,
): MasteryContext["currentSpecificationPosition"] {
  const ordered: { specCode: string; topicId: string }[] = [];
  for (const u of units) {
    for (const t of u.topics) {
      for (const p of t.points) ordered.push({ specCode: p.code, topicId: t.id });
    }
  }
  let lastTouched = -1;
  for (let i = 0; i < ordered.length; i++) {
    if (mastery.byCode[ordered[i].specCode]) lastTouched = i;
  }
  if (lastTouched === -1) return null;
  for (let i = lastTouched + 1; i < ordered.length; i++) {
    if (!mastery.byCode[ordered[i].specCode]) return ordered[i];
  }
  return null;
}
