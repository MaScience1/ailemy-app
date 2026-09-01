/**
 * Course mastery, computed by the model that already owns mastery.
 *
 * ============================================================================
 * ⚠ THIS FILE CONTAINS NO THRESHOLDS AND NO STATE ARITHMETIC OF ITS OWN
 * ============================================================================
 * masteryFor() in src/lib/account/academic.ts is the one place mastery is
 * decided — the 12-mark floor, the 0.5/0.75 bands, floor-before-ratio,
 * unmapped-evidence-dropped. This adapter's whole job is to feed it practice
 * evidence twice (bucketed by spec code, then re-bucketed by topic) and to add
 * the single fact academic.ts cannot know: which points of the specification
 * have NO evidence at all ("unstarted").
 *
 * Changing what mastery MEANS belongs in academic.ts, where its tests live.
 * Changing what evidence FEEDS it belongs here. Future sources — marked exam
 * questions once assessedOutOf is stored, question_spec_points once populated
 * — join by adding rows to the same PracticeEvidenceRow-shaped input, not by
 * touching the calculation.
 *
 * Pure: no database, no imports beyond academic.ts. The suite exercises every
 * rule with no credentials, exactly like academic-read-model.test.ts.
 */

import { masteryFor, type AssessedQuestion } from "../account/academic.ts";
import type {
  CourseMastery,
  PracticeEvidenceRow,
  SpecMasteryFacts,
  SpecUnitNode,
} from "./types.ts";

const NO_EVIDENCE: Omit<SpecMasteryFacts, "state"> = {
  awarded: 0,
  outOf: 0,
  questionCount: 0,
  marksShortOfFloor: 0,
  lastPractisedAt: null,
};

export function buildCourseMastery(input: {
  units: SpecUnitNode[];
  evidence: PracticeEvidenceRow[];
}): CourseMastery {
  // The course's own vocabulary: which codes exist, and whose topic each is.
  const topicOfCode = new Map<string, string>();
  let pointsTotal = 0;
  for (const u of input.units) {
    for (const t of u.topics) {
      for (const p of t.points) {
        topicOfCode.set(p.code, t.id);
        pointsTotal += 1;
      }
    }
  }

  // ⚠ MALFORMED OR FOREIGN EVIDENCE IS SET ASIDE AND COUNTED, NEVER PATCHED.
  // A negative mark or an award above its tariff is a broken row — clamping it
  // would invent data. A spec code outside this course's specification is not
  // this course's evidence. Both are ignoredRows, so the caller can say so.
  const usable: PracticeEvidenceRow[] = [];
  let ignoredRows = 0;
  for (const r of input.evidence) {
    const malformed =
      !Number.isFinite(r.markAwarded) ||
      !Number.isFinite(r.markAvailable) ||
      r.markAvailable <= 0 ||
      r.markAwarded < 0 ||
      r.markAwarded > r.markAvailable;
    if (malformed || !topicOfCode.has(r.specCode)) {
      ignoredRows += 1;
      continue;
    }
    usable.push(r);
  }

  // One answer row = one assessed question, for masteryFor's purposes. The id
  // only needs to be unique; attempt + index is exactly that (0065's UNIQUE).
  const questions: AssessedQuestion[] = usable.map((r) => ({
    questionId: `${r.attemptId}#${r.qIndex}`,
    attemptId: r.attemptId,
    awardedMarks: r.markAwarded,
    assessedOutOf: r.markAvailable,
    maxMarks: r.markAvailable,
  }));

  // Bucketed by spec code, then re-bucketed by topic — SAME evidence, SAME
  // calculation, so a topic can never disagree with the points it contains
  // about what the marks were.
  const byCode = bucket(questions, usable, (r) => r.specCode);
  const byTopic = bucket(questions, usable, (r) => topicOfCode.get(r.specCode)!);

  const summary = {
    unstarted: 0,
    insufficient: 0,
    emerging: 0,
    developing: 0,
    secure: 0,
    pointsTotal,
    awarded: 0,
    outOf: 0,
  };
  for (const code of topicOfCode.keys()) {
    const facts = byCode[code];
    if (!facts) {
      summary.unstarted += 1;
      continue;
    }
    summary[facts.state] += 1;
    summary.awarded += facts.awarded;
    summary.outOf += facts.outOf;
  }

  return { byCode, byTopic, summary, ignoredRows };
}

function bucket(
  questions: AssessedQuestion[],
  rows: PracticeEvidenceRow[],
  keyOf: (r: PracticeEvidenceRow) => string,
): Record<string, SpecMasteryFacts> {
  const out: Record<string, SpecMasteryFacts> = {};
  if (rows.length === 0) return out;

  const verdict = masteryFor({
    questions,
    topics: rows.map((r, i) => ({ questionId: questions[i].questionId, topic: keyOf(r) })),
  });
  if (!verdict.available) return out;

  // The freshest contributing answer per bucket — a display fact, not an input
  // to any state.
  const lastAt = new Map<string, string>();
  for (const r of rows) {
    if (!r.attemptedAt) continue;
    const key = keyOf(r);
    const prev = lastAt.get(key);
    if (!prev || r.attemptedAt > prev) lastAt.set(key, r.attemptedAt);
  }

  for (const row of verdict.rows) {
    out[row.topic] = {
      state: row.state,
      awarded: row.awarded,
      outOf: row.outOf,
      questionCount: row.questionIds.length,
      marksShortOfFloor: row.marksShortOfFloor,
      lastPractisedAt: lastAt.get(row.topic) ?? null,
    };
  }
  return out;
}

/** The facts for a point or topic that has never been practised. */
export function unstartedFacts(): SpecMasteryFacts {
  return { state: "unstarted", ...NO_EVIDENCE };
}
