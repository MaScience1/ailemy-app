"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { track } from "@/lib/analytics/posthog";
import { SECTION_META, summarise } from "@/lib/lesson/sections.ts";
import { useLessonProgress } from "./LessonProgress";

/**
 * "Before you continue" — the honest close (§31, §66).
 *
 * ============================================================================
 * ⚠ IT CONGRATULATES COMPLETION AND CLAIMS NOTHING ABOUT MASTERY (§27)
 * ============================================================================
 * "Lesson complete" means the student covered every section this lesson has.
 * It does not mean they can do it, and this component must never imply that:
 * no grade, no "mastered", no score rolled up from the sections. Their MCQ
 * percentage sits in the practice section where it belongs, next to the
 * questions it came from. Two different facts, two different places.
 *
 * ⚠ AND IT IS A SUMMARY, NOT A GATE. A student who has not finished can still
 * move on — the next-lesson link is always live. The list tells them what is
 * outstanding; it does not lock the door.
 */

export function LessonOutro({
  nextHref,
  nextTitle,
  nextNumber,
}: {
  nextHref: string | null;
  nextTitle: string | null;
  nextNumber: number | null;
}) {
  const { present, states } = useLessonProgress();
  const { complete, total, allComplete } = summarise(present, states);
  const outstanding = present.filter((k) => states[k]?.status !== "complete");

  if (total === 0) return null;

  return (
    <section
      aria-labelledby="before-you-continue"
      className="rounded-lg border border-ink/10 bg-snow p-6 sm:p-8"
    >
      <h2 id="before-you-continue" className="font-display text-2xl font-medium tracking-tight">
        {allComplete ? "Lesson complete" : "Before you continue"}
      </h2>

      {allComplete ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
          You have worked through every part of this lesson. That records what you
          covered — how you performed is shown with the questions themselves.
        </p>
      ) : (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
          {complete} of {total} parts done. You can move on whenever you like — this is
          a checklist, not a gate.
        </p>
      )}

      <ul className="mt-5 flex flex-wrap gap-2">
        {present.map((k) => {
          const done = states[k]?.status === "complete";
          return (
            <li
              key={k}
              className={[
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                done ? "border-ink/25 bg-ink/[0.06] text-ink" : "border-ink/15 text-ink/55",
              ].join(" ")}
            >
              <span aria-hidden>{done ? <Check className="h-3 w-3" /> : "○"}</span>
              {SECTION_META[k].label}
              <span className="sr-only">{done ? " — complete" : " — not complete"}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {nextHref ? (
          <Link
            href={nextHref}
            onClick={() => track("lesson_completed", { section: allComplete ? "all" : "partial" })}
            className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {nextNumber ? `Continue to Lesson ${String(nextNumber).padStart(2, "0")}` : "Continue"}
            {nextTitle ? ` — ${nextTitle}` : ""} →
          </Link>
        ) : (
          <p className="text-sm text-ink/60">This is the last lesson in the course.</p>
        )}

        {!allComplete && outstanding.length > 0 && (
          <a
            href={`#${SECTION_META[outstanding[0]].anchor}`}
            className="text-sm text-ink/65 underline underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Finish {SECTION_META[outstanding[0]].label.toLowerCase()} →
          </a>
        )}
      </div>
    </section>
  );
}
