import Link from "next/link";

import { PaperPdfViewer } from "@/components/paper/PaperPdfViewer";
import type { PaperResult } from "@/lib/catalogue/past-paper-filters";
import type { PaperInitial } from "@/app/admin/past-papers/_form";

import { PaperRowControls } from "./_admin-controls";
import { PaperDocLinks } from "./_doc-links";

/**
 * Single-result view for /past-papers.
 *
 * Shown INSTEAD of the list when the active filters resolve to exactly one
 * paper. Zero results still get the list page's empty state and two-or-more
 * still get the list, so this is purely an additional branch.
 *
 * Server component — the buttons are links and the viewer is an iframe, so
 * nothing here needs a client boundary. The only client code is the admin
 * control strip, which renders solely in edit mode.
 */

/** Shared geometry so the two pills are the same size to the pixel. */
const PILL_BASE =
  "inline-flex w-full items-center justify-center rounded-full border px-6 py-3 text-sm font-medium transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink";

export function SinglePaperView({
  paper,
  admin,
}: {
  paper: PaperResult;
  admin: {
    initial: PaperInitial | undefined;
    courses: { id: string; label: string }[];
    units: { id: string; label: string; parentId: string }[];
    optionsError: string | null;
  } | null;
}) {
  const pdfUrl = paper.questionPaperUrl;

  return (
    <section
      aria-label={`${paper.paperName} — question paper`}
      className="mt-4"
    >
      <div className="rounded-lg border border-ink/10 bg-snow p-5 sm:p-8">
        {/* Which paper am I looking at? Mirrors the list row's metadata line. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                {paper.boardName} · {paper.subjectName} · {paper.courseLevel}
              </p>
              {paper.paperCode && (
                <span className="font-mono rounded bg-ink/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-ink/70">
                  {paper.paperCode}
                </span>
              )}
              {paper.status !== "live" && (
                <span className="font-mono rounded bg-flask/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-flask">
                  {paper.status}
                </span>
              )}
            </div>
            <h2 className="font-display mt-2 text-2xl font-medium tracking-tight">
              {paper.session} {paper.year}
              <span className="ml-2 text-base font-normal text-ink/55">
                {paper.courseName}
              </span>
            </h2>

            {/* The mark scheme, examiner report and walkthrough would otherwise
                be unreachable here — this view replaces the list row that
                carries them, and the pills below cover only the question paper.
                Filtering by Document type = Mark scheme down to one result made
                the very document filtered for impossible to open. */}
            <PaperDocLinks paper={paper} showQuestionPaper={false} />
          </div>

          {/* Edit/Delete would otherwise be unreachable for a single result,
              since this view replaces the list row that normally carries them.
              Reuses the existing controls — no new write path. */}
          {admin?.initial && (
            <div className="shrink-0">
              <PaperRowControls
                paper={admin.initial}
                courses={admin.courses}
                units={admin.units}
                optionsError={admin.optionsError}
              />
            </div>
          )}
        </div>

        {/* Actions — centred stack, both pills full-width and identical size.
            gap-2 is 8px. The primary carries a transparent border so it matches
            the outlined secondary's box height exactly rather than sitting 2px
            shorter. */}
        <div className="mx-auto mt-6 flex w-full max-w-md flex-col gap-2">
          <Link
            href={`/past-papers/${paper.slug}/test`}
            className={`${PILL_BASE} border-transparent bg-signal text-ink hover:-translate-y-0.5 hover:bg-signal/90 hover:shadow-md`}
          >
            Start test
          </Link>

          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${PILL_BASE} border-ink/15 bg-transparent text-ink hover:-translate-y-0.5 hover:border-ink/40 hover:bg-ink/[0.03]`}
            >
              Download as PDF
            </a>
          ) : (
            <span
              aria-disabled="true"
              className={`${PILL_BASE} cursor-not-allowed border-ink/10 bg-transparent text-ink/35`}
            >
              Download as PDF
            </span>
          )}
        </div>

        <div className="mt-6">
          <PaperPdfViewer
            url={pdfUrl}
            title={`${paper.courseName} — ${paper.session} ${paper.year} question paper`}
          />
        </div>
      </div>
    </section>
  );
}
