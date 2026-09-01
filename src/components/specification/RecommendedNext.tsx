import Link from "next/link";

import type { RecommendedItem, SpecUnitNode } from "@/lib/specification/types";
import { StateLabel } from "./mastery-meta";

/**
 * Recommended next — the deterministic V1 list, rendered with its reasons on
 * display. Every entry shows the numbers the ranking used, so a student can
 * check the recommendation instead of trusting it (recommend.ts is the sort;
 * this only names things).
 *
 * ⚠ ACTION LINKS ARE REAL OR ABSENT. An entry whose point has a live lesson
 * links to it; one that does not shows no button — a "Practise" control that
 * opens nothing is worse than none.
 */

const REASON_COPY: Record<RecommendedItem["reason"], string> = {
  weak: "Below half marks — revise this first.",
  developing: "Partly there — push it over.",
  "finish-evidence": "A little more practice and this gets a rating.",
  "not-started": "Not started — next in the course order.",
};

export function RecommendedNext({
  items,
  units,
  lessonBase,
  specHref,
}: {
  items: RecommendedItem[];
  units: SpecUnitNode[];
  lessonBase: string | null;
  /** The explorer's own path, for deep links that open the point. */
  specHref: string;
}) {
  if (items.length === 0) return null;

  // Resolve each code back to its point and topic for display.
  const byCode = new Map<
    string,
    { title: string; topicName: string; liveLessonSlug: string | null; liveLessonTitle: string | null }
  >();
  for (const u of units) {
    for (const t of u.topics) {
      for (const p of t.points) {
        const live = p.lessons.find((l) => l.live) ?? null;
        byCode.set(p.code, {
          title: p.title ?? p.description,
          topicName: t.name,
          liveLessonSlug: live?.slug ?? null,
          liveLessonTitle: live?.title ?? null,
        });
      }
    }
  }

  return (
    <section aria-labelledby="recommended-heading" className="rounded-xl border border-ink/10 bg-snow p-5">
      <h2 id="recommended-heading" className="font-display text-lg font-medium tracking-tight">
        Recommended next
      </h2>
      <ol className="mt-3 grid gap-3">
        {items.map((item) => {
          const info = byCode.get(item.specCode);
          if (!info) return null;
          return (
            <li key={item.specCode} className="border-s-2 border-[var(--subject-border)] ps-3">
              <Link
                href={`${specHref}?point=${encodeURIComponent(item.specCode)}`}
                className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--subject-text)]">
                  {item.specCode} · {info.topicName}
                </span>
                <span className="mt-0.5 block text-sm font-medium text-ink group-hover:underline group-hover:underline-offset-4">
                  {info.title}
                </span>
              </Link>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink/65">
                <StateLabel state={item.facts.state} />
                {item.facts.outOf > 0 && (
                  <span className="font-mono text-[10px] text-ink/45">
                    {item.facts.awarded} of {item.facts.outOf} marks
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-ink/60">{REASON_COPY[item.reason]}</p>
              {info.liveLessonSlug && lessonBase && (
                <p className="mt-1 text-xs">
                  <Link
                    href={`${lessonBase}/${info.liveLessonSlug}`}
                    /* -my/py: a 44px hit area on a phone without moving the
                       layout — the Breadcrumb's own trick. */
                    className="-my-3 inline-block py-3 underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    Open {info.liveLessonTitle} →
                  </Link>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
