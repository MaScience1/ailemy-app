import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PaperPdfViewer } from "@/components/paper/PaperPdfViewer";
import { getPaperBySlug } from "@/lib/catalogue/past-paper-filters";

import { TestTimer } from "./_timer";

/**
 * Test workspace — SHELL ONLY.
 *
 * In this commit: the paper viewer at full height, a countdown timer pinned to
 * the top, and an empty region reserved for the answer interface. There is no
 * answer capture, no marking and no persistence — nothing a student does here
 * is recorded anywhere, including the timer, which restarts on reload.
 *
 * Publicly accessible: /past-papers/* is absent from isProtectedPath() in
 * src/lib/supabase/middleware.ts, so no gate applies. Gating comes later.
 *
 * LAYOUT: below lg the page scrolls normally (the answer region sits under the
 * viewer and must be reachable); at lg and above it becomes a fixed-height,
 * non-scrolling workspace with the viewer and answer region side by side. The
 * header is sticky in both modes, so the clock is never scrolled away.
 */

/**
 * past_papers has NO exam-duration column — 0007 stores only
 * walkthrough_duration_minutes, which is the length of the walkthrough VIDEO
 * and must not be confused for the length of the exam. Until a real
 * duration_minutes column exists, every paper counts down from this constant.
 */
const DEFAULT_DURATION_MINUTES = 90;

export const dynamic = "force-dynamic";

type Params = Promise<{ paper: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { paper: slug } = await params;
  const paper = await getPaperBySlug(slug);
  if (!paper) return { title: "Paper not found · Ailemy" };
  return {
    title: `Test · ${paper.session} ${paper.year} · ${paper.courseName} · Ailemy`,
    description: `Sit ${paper.courseName} ${paper.session} ${paper.year} under timed conditions.`,
    // A scratch workspace has nothing to offer search; the paper's own page does.
    robots: { index: false, follow: true },
  };
}

export default async function PaperTestPage({ params }: { params: Params }) {
  const { paper: slug } = await params;
  const paper = await getPaperBySlug(slug);
  if (!paper) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-parchment text-ink lg:h-screen lg:overflow-hidden">
      <header className="sticky top-0 z-40 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ink/15 bg-ink px-4 py-3 text-snow sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href="/past-papers"
            className="font-mono inline-flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-parchment/70 transition-colors hover:text-snow"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Past papers</span>
          </Link>
          <span className="hidden text-parchment/30 sm:inline">·</span>
          <p className="truncate text-sm">
            {paper.paperCode && (
              <span className="font-mono mr-2 text-[11px] uppercase tracking-[0.2em] text-signal">
                {paper.paperCode}
              </span>
            )}
            <span className="font-display font-medium text-snow">
              {paper.session} {paper.year}
            </span>
          </p>
        </div>

        <TestTimer durationMinutes={DEFAULT_DURATION_MINUTES} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        {/* Paper — the primary focus, two-thirds of the workspace on desktop. */}
        <div className="min-h-0 lg:h-full lg:w-2/3">
          <PaperPdfViewer
            url={paper.questionPaperUrl}
            title={`${paper.courseName} — ${paper.session} ${paper.year} question paper`}
            heightClass="h-[70vh] lg:h-full"
          />
        </div>

        {/* Answer interface goes here in a later commit. Deliberately empty —
            no inputs, no state, no capture. Sized so the real interface drops
            in without the workspace re-flowing. */}
        <aside
          aria-label="Answer interface"
          className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-ink/25 bg-snow/60 p-6 lg:h-full lg:min-h-0 lg:w-1/3"
        >
          <p className="font-mono text-center text-[11px] uppercase leading-relaxed tracking-[0.2em] text-ink/45">
            Answer interface
            <span className="mt-2 block normal-case tracking-normal text-ink/35">
              Not built yet — nothing you type anywhere on this page is saved.
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}
