import { ClipboardCheck, Download, ScrollText } from "lucide-react";

import type { PaperResult } from "@/lib/catalogue/past-paper-filters";
import type { PaperInitial } from "@/app/admin/past-papers/_form";

import { PaperRowControls } from "./_admin-controls";
import { PaperPreview } from "./_paper-preview";
import { StartTestModal } from "./_start-test-modal";
import { canOfferPaperTest } from "@/lib/past-papers/workspaces";

/**
 * Result card for a single filtered paper (spec §1).
 *
 * Shown INSTEAD of the list when the filters resolve to exactly one paper. Zero
 * results keep the empty state and two-or-more keep the list.
 *
 * The PDF is NOT rendered by default any more — §1 is explicit that the whole
 * paper must not sit inside the results card, so it lives behind the "Preview
 * paper" disclosure. This supersedes the inline-by-default viewer from 6e916b3.
 *
 * NO FABRICATED METADATA (§15.13): Duration and Total marks come from columns
 * added by migration 0015 and are null both before that migration is applied
 * and before the value has been entered. Every metadata row is omitted when its
 * value is null rather than shown with a placeholder or a guess.
 *
 * Server component. The only client islands are the mode-selection modal and
 * the preview disclosure, so a visitor who does not interact downloads neither
 * the dialog nor pdf.js.
 */

/**
 * 90 -> "1 h 30 min"; 45 -> "45 min"; 120 -> "2 h". Null stays null.
 *
 * Exported so the list card in page.tsx reuses this rather than growing a
 * second copy that could drift. The compact form replaces the previous
 * "1 hour 30 minutes": it now also has to sit inline in the list row next to
 * the mark total, where the long form dominated the line.
 */
export function formatDuration(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  return parts.join(" ");
}

/**
 * The full unit title, e.g. "Unit 1: Structure, Bonding and Introduction to
 * Organic Chemistry". Null when the paper has no unit — the units join is a
 * LEFT join, so an unmapped paper is ordinary, not an error.
 *
 * units.code is NOT part of this. Measured against the 12 rows in the table,
 * that column holds an exam-board paper code — "WCH11", "WBI12" — while
 * units.name already begins "Unit N:". Prefixing the code produced
 * "WCH11: Unit 1: Structure, …", doubling the label with a value the card
 * already shows in its own paper-code badge.
 */
export function formatUnitTitle(unitName: string | null): string | null {
  return unitName || null;
}

/**
 * The short unit label for the list card: "Unit 1" … "Unit 6".
 *
 * Parsed out of units.name because nothing else carries it — see above, the
 * code column is a paper code. All 12 current rows match /^Unit \d+/; a name
 * that does not (another board's units, when they arrive) falls back to the
 * full name rather than to nothing, so the card never silently drops a unit it
 * simply could not abbreviate.
 */
export function formatUnitLabel(unitName: string | null): string | null {
  if (!unitName) return null;
  const m = unitName.match(/^\s*(Unit\s+\d+)/i);
  return m ? m[1].replace(/\s+/g, " ") : unitName;
}

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
  const duration = formatDuration(paper.durationMinutes);
  const unitLine = formatUnitTitle(paper.unitName);

  // Rows are built as data so a null value drops out entirely rather than
  // rendering an empty or invented field.
  const facts: { label: string; value: string }[] = [
    paper.paperCode ? { label: "Paper code", value: paper.paperCode } : null,
    duration ? { label: "Duration", value: duration } : null,
    paper.totalMarks != null
      ? { label: "Total marks", value: String(paper.totalMarks) }
      : null,
  ].filter((f): f is { label: string; value: string } => f !== null);

  return (
    <section aria-label={`${paper.paperName} — paper details`} className="mt-4">
      <div className="rounded-lg border border-ink/10 bg-snow p-6 shadow-sm sm:p-9">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          {/* LEFT — identity and facts */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                {paper.boardName} · {paper.subjectName} · {paper.courseLevel}
              </p>
              {paper.status !== "live" && (
                <span className="font-mono rounded bg-flask/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-flask">
                  {paper.status}
                </span>
              )}
            </div>

            <h2 className="font-display mt-3 text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
              {paper.courseName}
            </h2>

            {unitLine && (
              <p className="mt-2 text-base text-ink/70">{unitLine}</p>
            )}

            <p className="font-display mt-1 text-lg text-ink/60">
              {paper.session} {paper.year}
            </p>

            {facts.length > 0 && (
              <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3">
                {facts.map((f) => (
                  <div key={f.label}>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                      {f.label}
                    </dt>
                    <dd className="font-mono mt-1 text-sm text-ink/80">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* RIGHT — actions */}
          <div className="w-full shrink-0 lg:w-[280px]">
            <div className="flex flex-col gap-2.5">
              {/* ⚠ GATED ON canOfferPaperTest(). The modal's primary card
                  promises a timed exam with saved answers; the workspace it
                  opens says nothing typed on it is saved. Nothing is deleted —
                  see USABLE_PAPER_WORKSPACES for the one-line reversal. */}
              {canOfferPaperTest() ? (
                <StartTestModal
                  slug={paper.slug}
                  courseSlug={paper.courseSlug}
                  paperLabel={`${paper.courseName} · ${paper.session} ${paper.year}`}
                />
              ) : null}

              {paper.questionPaperUrl ? (
                <a
                  href={paper.questionPaperUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-ink/20 bg-transparent px-6 py-3 text-sm font-medium text-ink transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-ink/40 hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download PDF
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-ink/10 bg-transparent px-6 py-3 text-sm font-medium text-ink/35"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download PDF
                </span>
              )}
            </div>

            {/* Secondary documents — rendered only when they exist. */}
            {(paper.markSchemeUrl || paper.examinerReportUrl) && (
              <div className="mt-4 flex flex-col gap-2.5">
                {paper.markSchemeUrl && (
                  <SecondaryLink
                    href={paper.markSchemeUrl}
                    icon={<ScrollText className="h-3.5 w-3.5" aria-hidden="true" />}
                    label="View Mark Scheme"
                  />
                )}
                {paper.examinerReportUrl && (
                  <SecondaryLink
                    href={paper.examinerReportUrl}
                    icon={<ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                    label="View Examiner Report"
                  />
                )}
              </div>
            )}

            {/* Edit/Delete would otherwise be unreachable for a single result,
                since this card replaces the list row that carries them. */}
            {admin?.initial && (
              <div className="mt-5 border-t border-ink/10 pt-4">
                <PaperRowControls
                  paper={admin.initial}
                  courses={admin.courses}
                  units={admin.units}
                  optionsError={admin.optionsError}
                />
              </div>
            )}
          </div>
        </div>

        <PaperPreview
          url={paper.questionPaperUrl}
          title={`${paper.courseName} — ${paper.session} ${paper.year} question paper`}
        />
      </div>
    </section>
  );
}

function SecondaryLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm font-medium text-ink/65 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      {icon}
      {label}
    </a>
  );
}
