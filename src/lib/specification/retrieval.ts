/**
 * The retrieval queue — which previously learned points should be retested,
 * in what order, and why.
 *
 * ============================================================================
 * ⚠ NOT RANDOM, AND EVERY ROW SAYS WHY (Service 3 spec §8/§13)
 * ============================================================================
 * Only points with an actionable retrieval state enter the queue:
 * intervention-needed, retrieval-due, review-soon. "fresh" points are
 * deliberately absent — retrieving what was demonstrated last week teaches
 * the student to ignore the queue.
 *
 * ORDERING, exactly, most urgent first:
 *
 *   1. intervention-needed          repeated recent failure on a previously
 *                                   demonstrated point — retrieval alone has
 *                                   already failed; within the group, longer
 *                                   fail streaks first
 *   2. retrieval-due                past its interval; within the group, the
 *                                   MOST OVERDUE first (age / interval,
 *                                   descending), so a 60-day-stale point
 *                                   outranks one due yesterday
 *   3. review-soon                  inside its interval but past halfway;
 *                                   same overdue-ratio ordering
 *
 * Ties break by weaker mastery ratio first, then by spec-code order — so the
 * queue is fully deterministic: identical evidence produces the identical
 * queue, run after run (the idempotence the tests pin).
 *
 * Exam proximity and prerequisite weighting are deliberately ABSENT: neither
 * input exists reliably yet, and a rank built on invented inputs is worse
 * than a simpler rank a student can check.
 */

import { compareSpecCodes } from "./codes.ts";
import { retrievalStateFor } from "./retention.ts";
import type {
  RetentionFacts,
  RetrievalCandidate,
  RetrievalState,
  SpecMasteryFacts,
} from "./types.ts";

const GROUP_ORDER: Record<RetrievalState, number> = {
  "intervention-needed": 0,
  "retrieval-due": 1,
  "review-soon": 2,
  fresh: 3, // never queued; present so the record type is total
};

export function retrievalQueue(input: {
  /** Every point of the course with its facts and retention, from insights. */
  points: {
    specCode: string;
    topicId: string;
    facts: SpecMasteryFacts;
    retention: RetentionFacts;
  }[];
  limit?: number;
}): RetrievalCandidate[] {
  const rows: (Omit<RetrievalCandidate, "priority"> & { sort: number[] })[] = [];

  for (const p of input.points) {
    const state = retrievalStateFor(p.retention);
    if (state === null || state === "fresh") continue;

    const overdue =
      p.retention.ageDays !== null && p.retention.intervalDays !== null
        ? p.retention.ageDays / p.retention.intervalDays
        : 0;
    const ratio = p.facts.outOf > 0 ? p.facts.awarded / p.facts.outOf : 0;

    rows.push({
      specCode: p.specCode,
      topicId: p.topicId,
      retrievalState: state,
      reason: reasonFor(state, p.retention),
      lastDemonstratedAt: p.retention.lastDemonstratedAt,
      masteryState: p.facts.state,
      evidenceConfidence: p.facts.evidenceConfidence,
      retention: p.retention,
      // Group asc, then urgency desc (streak or overdue-ratio), then weaker
      // mastery first. Encoded as a vector so the comparator reads plainly.
      sort: [
        GROUP_ORDER[state],
        state === "intervention-needed" ? -p.retention.failStreak : -overdue,
        ratio,
      ],
    });
  }

  rows.sort((a, b) => {
    for (let i = 0; i < a.sort.length; i++) {
      if (a.sort[i] !== b.sort[i]) return a.sort[i] - b.sort[i];
    }
    return compareSpecCodes(a.specCode, b.specCode);
  });

  const limit = input.limit ?? rows.length;
  return rows.slice(0, Math.max(0, limit)).map(({ sort: _sort, ...row }, i) => ({
    ...row,
    priority: i + 1,
  }));
}

/** One checkable sentence per queue row — the numbers it cites are the ones
 *  shown beside it. */
function reasonFor(state: RetrievalState, r: RetentionFacts): string {
  const age = r.ageDays ?? 0;
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  switch (state) {
    case "intervention-needed":
      return `${r.failStreak} recent answers in a row missed on a point you had previously demonstrated — worth revisiting properly, not just retrying.`;
    case "retrieval-due":
      return `Last demonstrated ${days(age)} ago — past its ${r.intervalDays}-day review interval.`;
    case "review-soon":
      return `Last demonstrated ${days(age)} ago — approaching its ${r.intervalDays}-day review interval.`;
    case "fresh":
      return `Recently demonstrated.`;
  }
}
