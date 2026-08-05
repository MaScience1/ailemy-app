import Link from "next/link";
import { ClipboardCheck, FileText, PlayCircle, ScrollText } from "lucide-react";

import type { PaperResult } from "@/lib/catalogue/past-paper-filters";

/**
 * The row of document chips for a paper — question paper, mark scheme,
 * examiner report, walkthrough.
 *
 * Extracted from PaperRow so the single-result view can render the SAME links.
 * Without this, narrowing the filters to one paper removed every document
 * except the question paper: filtering by Document type = Mark scheme down to a
 * single row would show "Question paper not yet uploaded" and offer no way to
 * reach the mark scheme that was filtered FOR. The doc filter selects on which
 * PDF a row has, and the three *_pdf_path columns are independently nullable,
 * so that combination is reachable, not hypothetical.
 */

export function DocLink({
  href,
  label,
  icon,
  external = true,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-parchment px-2.5 py-1 text-xs font-medium text-ink transition hover:border-flask hover:text-flask";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {icon}
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {icon}
      {label}
    </Link>
  );
}

export function PaperDocLinks({
  paper,
  /**
   * The single-paper view already renders the question paper as a pill and in
   * the embedded viewer, so repeating it as a chip there would be noise. The
   * list still shows it, since a list row has no viewer.
   */
  showQuestionPaper = true,
  className = "mt-3",
}: {
  paper: PaperResult;
  showQuestionPaper?: boolean;
  className?: string;
}) {
  const qp = showQuestionPaper ? paper.questionPaperUrl : null;
  const walkthrough = paper.walkthroughPlaybackId && paper.detailHref;
  // Keyed on walkthroughPlaybackId, NOT on `walkthrough`, to preserve the
  // list's existing behaviour exactly: a paper whose walkthrough exists but
  // whose detailHref is null renders no chip and no message, rather than
  // claiming "no documents" about a paper that has one.
  const nothing =
    !qp &&
    !paper.markSchemeUrl &&
    !paper.examinerReportUrl &&
    !paper.walkthroughPlaybackId;

  // With the question paper suppressed, "nothing here" is already said by the
  // viewer beneath — so render nothing at all rather than contradict it.
  if (nothing && !showQuestionPaper) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {qp && (
        <DocLink
          href={qp}
          icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Question paper"
        />
      )}
      {paper.markSchemeUrl && (
        <DocLink
          href={paper.markSchemeUrl}
          icon={<ScrollText className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Mark scheme"
        />
      )}
      {paper.examinerReportUrl && (
        <DocLink
          href={paper.examinerReportUrl}
          icon={<ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Examiner report"
        />
      )}
      {walkthrough && (
        <DocLink
          href={paper.detailHref!}
          external={false}
          icon={<PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />}
          label={
            paper.walkthroughMinutes
              ? `Walkthrough · ${paper.walkthroughMinutes} min`
              : "Walkthrough"
          }
        />
      )}
      {nothing && (
        <span className="text-xs text-ink/45">No documents attached yet.</span>
      )}
    </div>
  );
}
