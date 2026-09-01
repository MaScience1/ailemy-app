/**
 * Recommended next — deterministic V1, and it says so.
 *
 * ============================================================================
 * ⚠ THIS IS A SORT, NOT A TUTOR
 * ============================================================================
 * The ranking is four bands, in order, each sorted by a rule a student could
 * verify from the numbers shown beside it:
 *
 *   1. weak            emerging, floor met — the marks say revise this first,
 *                      weakest ratio first
 *   2. developing      partial mastery — push it over, weakest first
 *   3. finish-evidence below the 12-mark floor — closest to a rating first,
 *                      because a few more marks turns "unrated" into a state
 *   4. not-started     curriculum order; points with a live lesson first,
 *                      because "start here" should name somewhere to start
 *
 * Secure points are never recommended — recommending what a student is
 * demonstrably fine at is how a recommendation stops being read.
 *
 * A future engine (Smart Study, the Weakness Engine) replaces THIS FUNCTION
 * behind the same RecommendedItem[] shape; the UI does not change.
 */

import type {
  CourseMastery,
  RecommendedItem,
  SpecMasteryFacts,
  SpecUnitNode,
} from "./types.ts";
import { unstartedFacts } from "./mastery.ts";

export function recommendNext(input: {
  units: SpecUnitNode[];
  mastery: CourseMastery;
  limit?: number;
}): RecommendedItem[] {
  const limit = input.limit ?? 3;
  if (limit <= 0) return [];

  // Every point, in curriculum order (units and topics arrive sorted, points
  // arrive code-sorted from the loader).
  const points: { code: string; topicId: string; hasLiveLesson: boolean }[] = [];
  for (const u of input.units) {
    for (const t of u.topics) {
      for (const p of t.points) {
        points.push({
          code: p.code,
          topicId: t.id,
          hasLiveLesson: p.lessons.some((l) => l.live),
        });
      }
    }
  }

  const weak: RecommendedItem[] = [];
  const developing: RecommendedItem[] = [];
  const finishEvidence: RecommendedItem[] = [];
  const notStarted: RecommendedItem[] = [];

  for (const p of points) {
    const facts: SpecMasteryFacts = input.mastery.byCode[p.code] ?? unstartedFacts();
    switch (facts.state) {
      case "emerging":
        weak.push({ specCode: p.code, topicId: p.topicId, reason: "weak", facts });
        break;
      case "developing":
        developing.push({ specCode: p.code, topicId: p.topicId, reason: "developing", facts });
        break;
      case "insufficient":
        finishEvidence.push({ specCode: p.code, topicId: p.topicId, reason: "finish-evidence", facts });
        break;
      case "unstarted":
        notStarted.push({ specCode: p.code, topicId: p.topicId, reason: "not-started", facts });
        break;
      case "secure":
        break;
    }
  }

  const ratio = (f: SpecMasteryFacts) => f.awarded / Math.max(1, f.outOf);
  weak.sort((a, b) => ratio(a.facts) - ratio(b.facts));
  developing.sort((a, b) => ratio(a.facts) - ratio(b.facts));
  finishEvidence.sort((a, b) => a.facts.marksShortOfFloor - b.facts.marksShortOfFloor);
  // ⚠ STABLE within the band: curriculum order is preserved, live-lesson
  // points merely float ahead of lesson-less ones.
  const liveFirst = new Map(points.map((p) => [p.code, p.hasLiveLesson]));
  notStarted.sort((a, b) =>
    Number(liveFirst.get(b.specCode) ?? false) - Number(liveFirst.get(a.specCode) ?? false),
  );

  return [...weak, ...developing, ...finishEvidence, ...notStarted].slice(0, limit);
}
