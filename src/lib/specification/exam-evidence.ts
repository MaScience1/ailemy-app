/**
 * Marked exam questions → the canonical mastery evidence contract.
 *
 * ============================================================================
 * ⚠ PURE, LIKE mastery.ts — THE LOADER READS, THIS FILE DECIDES
 * ============================================================================
 * loadExamEvidence() in queries.ts does the (RLS-scoped, student-filtered)
 * reading and hands the raw rows here. Everything a test needs to pin lives in
 * this file with no credentials: which rows qualify, how a question becomes
 * one MasteryEvidenceRow, and what happens to a question with several or zero
 * spec codes.
 *
 * THE PRIMARY-CODE POLICY, WRITTEN DOWN (§33 of the Service 3 spec — no
 * opaque weighting): a question mapped to several specification points
 * contributes its marks to ONE of them — the mapping's first, by
 * display_order, ties broken by code string so the choice is deterministic.
 * The alternatives were both worse: duplicating the row into every code
 * counts the same marks twice the moment two codes share a topic, and
 * splitting the tariff across codes invents per-code marks no examiner ever
 * awarded. One question, one row, its full assessed tariff, exactly once —
 * the idempotency the evidence model promises.
 *
 * ⚠ A QUESTION WITH NO SPEC CODE IS COUNTED, NOT DROPPED SILENTLY. It cannot
 * feed a specification map (there is nowhere to put it), but the page should
 * be able to say "N marked exam questions aren't tagged yet" rather than
 * quietly showing a thinner record.
 */

import type { MasteryEvidenceRow } from "./types.ts";

export type ExamAttemptRow = {
  id: string;
  /** exam_attempts.mode — 'exam' or 'practice'. Anything else is treated as
   *  not-exam-conditions, the claim that needs less evidence. */
  mode: string;
  submittedAt: string | null;
};

export type MarkedQuestionRow = {
  questionAttemptId: string;
  examAttemptId: string;
  questionId: string;
  awardedMarks: number;
  assessedOutOf: number;
};

export type SpecLinkRow = {
  questionId: string;
  specCode: string;
  displayOrder: number;
};

export function examEvidenceRows(input: {
  attempts: ExamAttemptRow[];
  marked: MarkedQuestionRow[];
  specLinks: SpecLinkRow[];
}): { ok: true; rows: MasteryEvidenceRow[]; unmappedQuestions: number } {
  const attemptById = new Map(input.attempts.map((a) => [a.id, a]));

  // Primary spec code per question: lowest display_order, ties by code.
  const primaryByQuestion = new Map<string, string>();
  const bestOrder = new Map<string, { order: number; code: string }>();
  for (const link of input.specLinks) {
    const prev = bestOrder.get(link.questionId);
    if (
      !prev ||
      link.displayOrder < prev.order ||
      (link.displayOrder === prev.order && link.specCode < prev.code)
    ) {
      bestOrder.set(link.questionId, { order: link.displayOrder, code: link.specCode });
    }
  }
  for (const [questionId, best] of bestOrder) primaryByQuestion.set(questionId, best.code);

  const rows: MasteryEvidenceRow[] = [];
  let unmappedQuestions = 0;

  for (const m of input.marked) {
    const attempt = attemptById.get(m.examAttemptId);
    // A marked question whose attempt was not in the read belongs to someone
    // else's join bug; producing evidence for it would attribute marks with
    // no owner context. Set aside with the unmapped, loudly countable.
    if (!attempt) {
      unmappedQuestions += 1;
      continue;
    }
    const specCode = primaryByQuestion.get(m.questionId);
    if (!specCode) {
      unmappedQuestions += 1;
      continue;
    }
    rows.push({
      // question_attempts.id is unique per question per sitting, so
      // `${id}#0` can never collide with another evidence row — the same
      // uniqueness contract practice rows get from (attempt_id, q_index).
      attemptId: m.questionAttemptId,
      qIndex: 0,
      specCode,
      markAwarded: m.awardedMarks,
      // ⚠ assessed_out_of, NEVER max_marks — the tariff the marker reached.
      markAvailable: m.assessedOutOf,
      attemptedAt: attempt.submittedAt,
      source: "exam-paper",
      examConditions: attempt.mode === "exam",
    });
  }

  return { ok: true, rows, unmappedQuestions };
}
