"use client";

import Link from "next/link";

import { track } from "@/lib/analytics/posthog";
import type { LessonExamQuestion } from "@/lib/lesson/content";

/**
 * The lesson's exam questions (§19–§23).
 *
 * ============================================================================
 * ⚠ THIS COMPONENT DELIBERATELY DOES NOT MARK ANYTHING
 * ============================================================================
 * §19 is explicit: do NOT build another independent marking engine. The one
 * that exists is substantial and reviewed — a two-tier marker, a ~1000-line
 * chemical-equation comparator with its own suite, numeric tolerance rules,
 * and an evidence gate that checks a model's sentence against the real mark
 * scheme and the student's own answer before any explanation is allowed out.
 * Re-implementing any of that here would produce a second, unreviewed opinion
 * about a student's work.
 *
 * ⚠ AND IT CANNOT SIMPLY CALL THE EXISTING ONE EITHER, FOR A SCHEMA REASON.
 * An attempt is created by create_exam_attempt(paper_id, mode), which inserts
 * one row for EVERY question in the paper and snapshots the total from those
 * rows. There is no way to open an attempt over "the three questions on this
 * lesson" without either a filtered RPC or a new attempt concept — both of
 * which are schema, and schema is propose-don't-apply on this branch.
 *
 * So this renders the mapped questions and hands the student to the reviewed
 * path that genuinely works today. When the filtered-attempt RPC lands, the
 * answer box and "Mark my answer" belong here — and they will call the SAME
 * marker, never a copy of it.
 */

export function LessonExamQuestions({
  questions,
  lessonSlug,
}: {
  questions: LessonExamQuestion[];
  lessonSlug: string;
}) {
  return (
    <div className="grid gap-3">
      <ol className="grid gap-2">
        {questions.map((q, i) => (
          <li
            key={q.questionId}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-ink/10 bg-snow px-4 py-3"
          >
            <span className="text-sm">
              <span className="font-mono text-xs text-ink/45">Q{i + 1}</span>{" "}
              <Link
                href={`/learn/papers/${q.paperId}#q-${q.questionId}`}
                onClick={() => track("exam_question_started", { lesson: lessonSlug })}
                className="underline underline-offset-4 transition-colors hover:text-ink"
              >
                {q.questionRef || "Question"}
              </Link>
            </span>
            {q.marks !== null && (
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                {q.marks} mark{q.marks === 1 ? "" : "s"}
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* ⚠ SAYS WHAT MARKING IS AND IS NOT (§21, R2). AI marking on this
          platform is provisional by design — the second tier always returns
          "requires review" and its marks are deliberately excluded from a
          confirmed total until a human countersigns. A student must not read
          a provisional judgement as a grade. */}
      <p className="text-xs leading-relaxed text-ink/55">
        Answers are marked against the real mark scheme. Where the marker cannot be certain,
        the result is shown as provisional until a teacher confirms it.
      </p>
    </div>
  );
}
