/**
 * Course insights — every Phase-2 dimension, computed once, server-side.
 *
 * ============================================================================
 * ⚠ ONE ORCHESTRATOR, ZERO NEW ARITHMETIC
 * ============================================================================
 * This file owns NO thresholds and NO state rules. It groups the SAME usable
 * evidence buildCourseMastery counts (same filter, exported from mastery.ts)
 * by spec code and topic, hands each bucket to the pure engines — trendFor,
 * retentionFor, retrievalQueue, strengthsFor/weaknessesFor, masterySeries —
 * and assembles their outputs into one serialisable CourseInsights the page
 * computes once and the components merely render (§2 of the Phase 2 spec:
 * no authoritative calculation in React).
 *
 * Pure: no database, no clock — nowIso is an argument, so every verdict is
 * reproducible in a test to the millisecond.
 */

import { MASTERY_SECURE_AT } from "../account/academic.ts";
import { compareSpecCodes } from "./codes.ts";
import { masterySeries } from "./history.ts";
import { courseVocabulary, unstartedFacts, usableEvidence } from "./mastery.ts";
import { retentionFor, retrievalStateFor } from "./retention.ts";
import { retrievalQueue } from "./retrieval.ts";
import { strengthsFor, weaknessesFor } from "./rankings.ts";
import { trendFor } from "./trend.ts";
import type {
  CourseInsights,
  CourseMastery,
  EvidenceSummary,
  MasteryEvidenceRow,
  SpecUnitNode,
} from "./types.ts";

/** "k of n recent answers successful" looks at this many newest answers. */
export const RECENT_ANSWER_WINDOW = 5;

export function buildCourseInsights(input: {
  units: SpecUnitNode[];
  mastery: CourseMastery;
  evidence: MasteryEvidenceRow[];
  nowIso: string;
}): CourseInsights {
  const { topicOfCode } = courseVocabulary(input.units);
  const { usable } = usableEvidence(topicOfCode, input.evidence);

  const byCode = new Map<string, MasteryEvidenceRow[]>();
  const byTopic = new Map<string, MasteryEvidenceRow[]>();
  for (const r of usable) {
    (byCode.get(r.specCode) ?? byCode.set(r.specCode, []).get(r.specCode)!).push(r);
    const topicId = topicOfCode.get(r.specCode)!;
    (byTopic.get(topicId) ?? byTopic.set(topicId, []).get(topicId)!).push(r);
  }

  const trendByCode: CourseInsights["trendByCode"] = {};
  const retentionByCode: CourseInsights["retentionByCode"] = {};
  const evidenceByCode: CourseInsights["evidenceByCode"] = {};
  const points: {
    specCode: string;
    topicId: string;
    facts: ReturnType<typeof unstartedFacts>;
    trend: ReturnType<typeof trendFor>;
    retention: ReturnType<typeof retentionFor>;
  }[] = [];

  for (const [code, rows] of byCode) {
    const facts = input.mastery.byCode[code] ?? unstartedFacts();
    const trend = trendFor(rows);
    const retention = retentionFor({ facts, rows, nowIso: input.nowIso });
    trendByCode[code] = trend;
    retentionByCode[code] = retention;
    evidenceByCode[code] = summarise(rows, trend.state, retention);
    points.push({ specCode: code, topicId: topicOfCode.get(code)!, facts, trend, retention });
  }
  points.sort((a, b) => compareSpecCodes(a.specCode, b.specCode));

  const trendByTopic: CourseInsights["trendByTopic"] = {};
  for (const [topicId, rows] of byTopic) trendByTopic[topicId] = trendFor(rows);

  return {
    trendByCode,
    trendByTopic,
    retentionByCode,
    queue: retrievalQueue({ points }),
    strengths: strengthsFor({ points }),
    weaknesses: weaknessesFor({ points }),
    series: masterySeries({
      units: input.units,
      evidence: input.evidence,
      nowIso: input.nowIso,
    }),
    evidenceByCode,
  };
}

/**
 * The §10 evidence summary — the facts behind a state, in the shape the point
 * drawer prints. "Successful" reuses the demonstration threshold (>= 75% of
 * that answer's tariff — a correct 1-marker), so the drawer and the retention
 * engine can never disagree about what counted.
 */
function summarise(
  rows: MasteryEvidenceRow[],
  trend: EvidenceSummary["trend"],
  retention: ReturnType<typeof retentionFor>,
): EvidenceSummary {
  const dated = [...rows].sort((a, b) =>
    (b.attemptedAt ?? "").localeCompare(a.attemptedAt ?? ""),
  );
  const recent = dated.slice(0, RECENT_ANSWER_WINDOW);
  let awarded = 0;
  let outOf = 0;
  let examMarks = 0;
  for (const r of rows) {
    awarded += r.markAwarded;
    outOf += r.markAvailable;
    if (r.source === "exam-paper") examMarks += r.markAvailable;
  }
  return {
    recentSuccessful: recent.filter(
      (r) => r.markAwarded / r.markAvailable >= MASTERY_SECURE_AT,
    ).length,
    recentTotal: recent.length,
    lastDemonstratedAt: retention.lastDemonstratedAt,
    trend,
    retrievalState: retrievalStateFor(retention),
    awarded,
    outOf,
    examMarks,
  };
}
