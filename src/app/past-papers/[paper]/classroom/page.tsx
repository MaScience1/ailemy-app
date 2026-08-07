import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Monitor } from "lucide-react";

import { PaperViewer } from "@/components/paper/PaperViewer";
import { getPaperBySlug } from "@/lib/catalogue/past-paper-filters";

/**
 * Classroom presentation workspace — SHELL ONLY (Phase 1).
 *
 * Present in this commit: the route, the presentation chrome, and the shared
 * paper viewer at presentation size with page-level navigation.
 *
 * DELIBERATELY ABSENT (Phase 3): pen, highlighter, eraser, text, shapes,
 * undo/redo, laser pointer, the mark-scheme side panel, the blank whiteboard
 * and full-screen. No annotation surface is stubbed either — an inert toolbar
 * that silently does nothing is worse than an honest absence.
 *
 * MARK SCHEME: not wired up here yet, and deliberately not passed to the
 * viewer. Even in classroom mode it must be an explicit teacher action, never
 * something on screen by default (spec §5 tab 2, §6).
 *
 * Visually distinct from the student page on purpose (spec §5): dark
 * presentation chrome, paper centred and dominant, no answer column.
 *
 * Publicly accessible, like the rest of /past-papers.
 */

export const dynamic = "force-dynamic";

type Params = Promise<{ paper: string }>;
/**
 * ?course=<course-slug>. A paper slug is unique only within a course — both
 * Chemistry and Biology have a "unit-1-january-2019" — so without it the
 * lookup cannot tell which subject's paper was asked for and refuses.
 */
type Search = Promise<Record<string, string | string[] | undefined>>;

function courseParam(sp: Record<string, string | string[] | undefined>) {
  const v = sp.course;
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const { paper: slug } = await params;
  const paper = await getPaperBySlug(slug, courseParam(await searchParams));
  if (!paper) return { title: "Paper not found · Ailemy" };
  return {
    title: `Classroom · ${paper.session} ${paper.year} · ${paper.courseName} · Ailemy`,
    description: `Present ${paper.courseName} ${paper.session} ${paper.year} to a class.`,
    robots: { index: false, follow: true },
  };
}

export default async function PaperClassroomPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { paper: slug } = await params;
  const paper = await getPaperBySlug(slug, courseParam(await searchParams));
  if (!paper) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-ink text-snow lg:h-screen lg:overflow-hidden">
      <header className="sticky top-0 z-40 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-snow/10 bg-ink px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href="/past-papers"
            className="font-mono inline-flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-parchment/70 transition-colors hover:text-snow"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Exit classroom</span>
          </Link>
          <span className="hidden text-parchment/30 sm:inline">·</span>
          <p className="truncate text-sm">
            {paper.paperCode && (
              <span className="font-mono mr-2 text-[11px] uppercase tracking-[0.2em] text-signal">
                {paper.paperCode}
              </span>
            )}
            <span className="font-display font-medium text-snow">
              {paper.courseName} — {paper.session} {paper.year}
            </span>
          </p>
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-parchment/50">
          Classroom mode
        </p>
      </header>

      {/* Spec §8: classroom is designed for desktop, laptop, interactive display
          and tablet landscape. Access is NOT blocked on a phone — the notice is
          advisory only. */}
      <p className="flex items-center gap-2 border-b border-snow/10 bg-snow/[0.03] px-4 py-2.5 text-xs text-parchment/60 lg:hidden">
        <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        For the best classroom experience, use a tablet, laptop or interactive
        display.
      </p>

      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-5">
        <PaperViewer
          url={paper.questionPaperUrl}
          title={`${paper.courseName} — ${paper.session} ${paper.year} question paper`}
          mode="classroom"
          className="mx-auto w-full max-w-6xl"
        />
      </div>
    </div>
  );
}
