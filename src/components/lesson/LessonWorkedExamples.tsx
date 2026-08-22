"use client";

import { useCallback, useEffect, useState } from "react";

import { track } from "@/lib/analytics/posthog";
import { Markdown } from "@/lib/lesson/markdown";
import type { WorkedExample } from "@/lib/lesson/content";
import { useLessonProgress } from "./LessonProgress";

/**
 * Worked examples — the board, one step at a time (§13, §14).
 *
 * ============================================================================
 * ⚠ THE REVEAL ORDER IS THE TEACHING, SO IT IS ENFORCED
 * ============================================================================
 * A good worked example is not a question with the answer underneath it: the
 * value is in pausing between "what am I given" and "which equation" and
 * trying it yourself. So steps unlock one at a time and the answer is the last
 * thing available — a student who wants it immediately can click through, but
 * the default path is the classroom one.
 *
 * ⚠ COMPLETION MEANS EVERY EXAMPLE WAS OPENED TO ITS ANSWER (§15) — real
 * evidence of the click, not "the section was rendered". Nothing here judges
 * whether the student understood it; that is what practice and exam questions
 * are for, and conflating the two would be §27's collapse of completion into
 * performance.
 */

export function LessonWorkedExamples({
  examples,
  lessonSlug,
}: {
  examples: WorkedExample[];
  lessonSlug: string;
}) {
  const { mark } = useLessonProgress();
  // revealed[i] = how many steps of example i are open; steps.length + 1 = answer shown
  const [revealed, setRevealed] = useState<number[]>(() => examples.map(() => 0));

  const allDone = examples.every((ex, i) => revealed[i] > ex.steps.length);

  useEffect(() => {
    if (allDone) mark("worked_examples", "auto", { examples: examples.length });
  }, [allDone, mark, examples.length]);

  const advance = useCallback(
    (i: number) => {
      setRevealed((r) => {
        const next = [...r];
        next[i] = Math.min(examples[i].steps.length + 1, next[i] + 1);
        return next;
      });
      track("worked_example_opened", { lesson: lessonSlug });
    },
    [examples, lessonSlug],
  );

  const gotoSlide = (n: number) => {
    track("review_resource_clicked", { lesson: lessonSlug, resource: "slide", slide: n });
    window.dispatchEvent(new CustomEvent("ailemy:lesson-goto-slide", { detail: { slideN: n } }));
  };

  return (
    <ol className="grid gap-4">
      {examples.map((ex, i) => {
        const open = revealed[i];
        const answerShown = open > ex.steps.length;
        const nextLabel = answerShown
          ? null
          : open === ex.steps.length
            ? "Show answer"
            : `Show step ${open + 1}`;

        return (
          <li key={ex.id} className="rounded-lg border border-ink/10 bg-snow p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-lg font-medium tracking-tight">
                Example {i + 1}
                {ex.title ? <span className="text-ink/60"> · {ex.title}</span> : null}
              </h3>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                {ex.specCode ? `Spec ${ex.specCode}` : ""}
                {ex.specCode && ex.marks !== null ? " · " : ""}
                {ex.marks !== null ? `${ex.marks} mark${ex.marks === 1 ? "" : "s"}` : ""}
              </p>
            </div>

            <div className="mt-3 text-sm leading-relaxed text-ink/80">
              <Markdown source={ex.prompt} />
            </div>

            {open > 0 && (
              <ol className="mt-4 grid gap-3 border-l-2 border-ink/15 pl-4">
                {ex.steps.slice(0, open).map((s, si) => (
                  <li key={si}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                      Step {si + 1} · {s.label}
                    </p>
                    <div className="mt-1">
                      <Markdown source={s.body} />
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {answerShown && (
              <div className="mt-4 rounded border border-ink/15 bg-ink/[0.03] px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">Answer</p>
                <div className="mt-1">
                  <Markdown source={ex.answer} />
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {nextLabel && (
                <button
                  type="button"
                  onClick={() => advance(i)}
                  className="rounded-full border border-ink/25 px-4 py-1.5 text-sm transition-colors hover:border-ink hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {nextLabel} →
                </button>
              )}
              {ex.reviewSlide !== null && (
                <button
                  type="button"
                  onClick={() => gotoSlide(ex.reviewSlide!)}
                  className="text-sm text-ink/60 underline underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Review slide {ex.reviewSlide}
                </button>
              )}
              {answerShown && (
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
                  fully revealed
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
