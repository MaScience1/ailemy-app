import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  attachInsights,
  gradeFor,
  topicPerformance,
  whereMarksWent,
  type GradeVerdict,
  type InsightVerdict,
  type LossVerdict,
  type MarkedQuestionLite,
  type TopicVerdict,
  type ResultsContext,
} from "@/lib/exam/results-insights";

/**
 * The four things a results screen may say beyond the marks.
 *
 * ⚠ EVERY READ IS CHECKED, AND A FAILED READ IS NOT AN EMPTY TABLE. That
 * distinction is the whole point of this file. question_topics is empty today,
 * so "no rows" is the NORMAL state — which means a swallowed error would be
 * indistinguishable from it, and the screen would say "no topics mapped yet"
 * during an outage. Each verdict below is therefore either a computed answer or
 * an explicit refusal naming which of the two it is.
 *
 * Read with the service role because examiner_report_insights is staff-gated by
 * 0028 and a student cannot read it — the same reason marking reads it that way.
 * Only the derived, student-safe verdicts leave this function.
 */

export type { ResultsContext };

export async function getResultsContext(input: {
  paperId: string;
  paperTotal: number;
  confirmedMarks: number;
  questions: MarkedQuestionLite[];
}): Promise<ResultsContext> {
  const db = createAdminClient();
  const questionIds = input.questions.map((q) => q.questionId);

  const failed = (what: string, code: string | undefined, message: string) =>
    `We couldn't read ${what} just now (${code ?? "?"}), so nothing is being shown for it rather than an empty one.`;

  // ── topics ──────────────────────────────────────────────────────────────
  let topics: TopicVerdict;
  {
    const { data, error } = await db
      .from("question_topics")
      .select("question_id, topic")
      .in("question_id", questionIds);
    topics = error
      ? { available: false, reason: failed("topic mapping", error.code, error.message) }
      : topicPerformance({
          questions: input.questions,
          topics: (data ?? []).map((r) => ({ questionId: r.question_id, topic: r.topic })),
        });
  }

  // ── grade boundaries ────────────────────────────────────────────────────
  let grade: GradeVerdict;
  {
    const { data, error } = await db
      .from("grade_boundaries")
      .select("paper_id, grade, raw_mark_min, boundary_source, source_note")
      .eq("paper_id", input.paperId);
    grade = error
      ? { available: false, reason: failed("grade boundaries", error.code, error.message) }
      : gradeFor({
          paperId: input.paperId,
          confirmedMarks: input.confirmedMarks,
          paperTotal: input.paperTotal,
          boundaries: (data ?? []).map((r) => ({
            paperId: r.paper_id,
            grade: r.grade,
            rawMarkMin: r.raw_mark_min,
            boundarySource: r.boundary_source as "official" | "estimated",
            sourceNote: r.source_note,
          })),
        });
  }

  // ── examiner insights ───────────────────────────────────────────────────
  let insights: InsightVerdict;
  {
    const { data, error } = await db
      .from("examiner_report_insights")
      .select("question_id, insight_text, insight_type")
      .in("question_id", questionIds);
    insights = error
      ? { available: false, reason: failed("the examiner report", error.code, error.message) }
      : attachInsights({
          questions: input.questions,
          insights: (data ?? []).map((r) => ({
            questionId: r.question_id,
            insightText: r.insight_text,
            insightType: r.insight_type,
          })),
        });
  }

  // Needs no table at all — it is computed from what just happened.
  const loss = whereMarksWent(input.questions);

  return { grade, topics, insights, loss };
}
