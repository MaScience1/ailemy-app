import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  Play,
} from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { MuxLessonPlayer } from "@/components/lesson/MuxLessonPlayer";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseBySubjectPathwayAndSlug,
  getPastPaperByCourseAndSlug,
  getSubjectBySlug,
} from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import { getPaperExamMeta } from "@/lib/exam/paper-exam-meta";
import { getPaperPublicUrl } from "@/lib/storage/papers";

type Params = Promise<{
  subject: string;
  pathway: string;
  course: string;
  paper: string;
}>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const {
    subject: subjectSlug,
    pathway: pathwaySlug,
    course: courseSlug,
    paper: paperSlug,
  } = await params;

  if (!isPathway(pathwaySlug)) return { title: "Paper not found · Ailemy" };

  const course = await getCourseBySubjectPathwayAndSlug(
    subjectSlug,
    pathwaySlug,
    courseSlug,
  );
  if (!course) return { title: "Paper not found · Ailemy" };

  const paper = await getPastPaperByCourseAndSlug(course.id, paperSlug);
  if (!paper) return { title: "Paper not found · Ailemy" };

  return {
    title: `${paper.paper_name} · ${course.name} · Ailemy`,
    // ⚠ §58 — this promised "try the question interactively" on every paper.
    // generateMetadata has no ingestion state to hand and fetching it here
    // would be a second round trip per request for a search-result snippet, so
    // the description now names only what every paper genuinely offers.
    description: `${paper.paper_code ?? "Past paper"} — ${paper.session} ${paper.year}. Download the question paper, mark scheme and examiner report.`,
  };
}

export default async function PaperDetailPage({
  params,
}: {
  params: Params;
}) {
  const {
    subject: subjectSlug,
    pathway: pathwaySlug,
    course: courseSlug,
    paper: paperSlug,
  } = await params;

  if (!isPathway(pathwaySlug)) notFound();

  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) notFound();

  const course = await getCourseBySubjectPathwayAndSlug(
    subjectSlug,
    pathwaySlug,
    courseSlug,
  );
  if (!course) notFound();

  const paper = await getPastPaperByCourseAndSlug(course.id, paperSlug);
  if (!paper) notFound();

  const paperUrl = getPaperPublicUrl(paper.paper_pdf_path);
  const markschemeUrl = getPaperPublicUrl(paper.markscheme_pdf_path);
  const examinerReportUrl = getPaperPublicUrl(paper.examiner_report_pdf_path);
  const pathway = PATHWAY_COPY[pathwaySlug];

  const courseHref = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}`;
  const examQuestionsHref = `${courseHref}/exam-questions`;
  /**
   * "Try interactively" opens the mode-selection screen rather than dropping
   * straight into the whiteboard. The whiteboard itself is unchanged and still
   * lives at .../practice — the mode screen's "Teach this paper" routes there,
   * so the old flow is one extra click away, never gone.
   */
  const interactiveHref = `${courseHref}/papers/${paperSlug}/interactive`;

  /**
   * ⚠ §58 — THE INTERACTIVE CARD IS EARNED, NOT ASSUMED.
   *
   * This card used to render on EVERY paper. It does not depend on the PDFs;
   * it depends on question ingestion, and exactly one paper has been ingested
   * (WCH11/01 May–June 2025). On every other paper in the archive it was a
   * promise with nothing behind it — the reader clicks "Try interactively" and
   * arrives at a mode screen for a paper that has no questions.
   *
   * hasQuestions is real ingestion state: at least one paper_questions row for
   * THIS paper id. When it is false the three download cards stand on their own,
   * which is the honest offer — question paper, mark scheme, examiner report.
   *
   * ⚠ IT FAILS CLOSED. getPaperExamMeta never throws; a failed count returns
   * hasQuestions:false, so an outage hides a working card rather than
   * advertising a broken one.
   */
  const examMeta = await getPaperExamMeta(paper.id, paper.total_marks ?? null);

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10 sm:py-16">
          <Breadcrumb
            crumbs={[
              { label: "Learn", href: "/learn" },
              { label: subject.name, href: `/learn/${subject.slug}` },
              {
                label: pathway.name,
                href: `/learn/${subject.slug}/${pathwaySlug}`,
              },
              { label: course.name, href: courseHref },
              { label: "Exam Questions", href: examQuestionsHref },
              { label: paper.paper_name },
            ]}
          />

          <header className="mt-8 max-w-3xl">
            {paper.paper_code && (
              <p
                className="font-mono text-xs uppercase tracking-[0.25em]"
                style={{ color: "var(--subject-accent)" }}
              >
                {paper.paper_code}
              </p>
            )}
            <h1 className="font-display mt-5 text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">
              {paper.paper_name}.
            </h1>
            <p className="font-mono mt-4 text-xs uppercase tracking-[0.2em] text-ink/55">
              {paper.session} · {paper.year}
            </p>
          </header>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
            {/* LEFT — CTAs */}
            <section aria-label="Paper resources" className="space-y-4">
              <DownloadCard
                href={paperUrl}
                title="Download question paper"
                subtitle={paper.paper_code ?? "PDF"}
                icon={<FileText className="h-5 w-5" aria-hidden="true" />}
                emptyMessage="Question paper PDF will appear here once uploaded."
              />

              {/* The two optional documents are ALWAYS rendered: when absent
                  they show the muted, non-clickable state rather than
                  vanishing, so the set of documents a paper can have is
                  legible from the page itself and a gap reads as "not yet"
                  rather than as "this paper never has one".

                  The mark scheme previously disappeared when null, which made
                  its own emptyMessage unreachable — the row is now consistent
                  with the examiner report below it. */}
              <DownloadCard
                href={markschemeUrl}
                title="Download mark scheme"
                emptyTitle="Mark scheme — not yet available"
                subtitle="Examiner-issued"
                icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
              />

              <DownloadCard
                href={examinerReportUrl}
                title="Download examiner report"
                emptyTitle="Examiner report — not yet available"
                subtitle="PDF"
                icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
              />

              {examMeta.hasQuestions && (
              <Link
                href={interactiveHref}
                className="group/practice flex items-center justify-between gap-4 rounded-lg border border-ink/10 bg-signal p-5 text-ink transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/70">
                    Highlighted
                  </p>
                  <p className="font-display mt-1 text-lg font-medium tracking-tight">
                    Try interactively
                  </p>
                  <p className="mt-1 text-xs text-ink/65">
                    Teach it with a class on the whiteboard, or sit it and have
                    Ailemy mark your answers.
                  </p>
                </div>
                <ArrowRight
                  className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover/practice:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              )}

              <Link
                href={examQuestionsHref}
                className="font-mono inline-flex items-center gap-1.5 pt-2 text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-ink"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                All papers
              </Link>
            </section>

            {/* RIGHT — Walkthrough video */}
            <section aria-label="Examiner walkthrough" className="space-y-4">
              <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
                Examiner walkthrough
              </h2>

              {paper.walkthrough_mux_playback_id ? (
                <>
                  <MuxLessonPlayer
                    playbackId={paper.walkthrough_mux_playback_id}
                    title={`${paper.paper_name} walkthrough`}
                  />
                  {paper.walkthrough_duration_minutes != null && (
                    <p className="font-mono text-xs text-ink/55">
                      {paper.walkthrough_duration_minutes} min
                    </p>
                  )}
                </>
              ) : (
                <WalkthroughPlaceholder />
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function DownloadCard({
  href,
  title,
  /**
   * Heading for the empty state, when "not yet available" reads better than the
   * imperative used on the live card. Used by the two OPTIONAL documents; the
   * question paper keeps the default (`title`) because its absence is a data
   * error rather than a normal state, and there it earns the fuller
   * explanation that `emptyMessage` gives.
   */
  emptyTitle,
  subtitle,
  icon,
  emptyMessage,
}: {
  href: string | null;
  title: string;
  emptyTitle?: string;
  subtitle: string;
  icon: React.ReactNode;
  /** Omit when the heading already says it — see the examiner report card. */
  emptyMessage?: string;
}) {
  if (!href) {
    return (
      <div
        className="rounded-lg border border-dashed border-ink/15 bg-snow/50 p-5 text-ink/55"
        aria-disabled="true"
      >
        <div className="flex items-center gap-3">
          <span className="text-ink/40">{icon}</span>
          <div>
            <p className="font-display text-base font-medium tracking-tight text-ink/75">
              {emptyTitle ?? title}
            </p>
            <p className="font-mono mt-0.5 text-[10px] uppercase tracking-[0.2em]">
              Awaiting upload
            </p>
          </div>
        </div>
        {emptyMessage && <p className="mt-3 text-xs text-ink/55">{emptyMessage}</p>}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group/dl flex items-center justify-between gap-4 rounded-lg border border-ink/10 bg-snow p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--subject-accent)]"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-md"
          style={{
            backgroundColor: "color-mix(in srgb, var(--subject-accent) 12%, transparent)",
            color: "var(--subject-accent)",
          }}
        >
          {icon}
        </span>
        <div>
          <p className="font-display text-base font-medium tracking-tight">
            {title}
          </p>
          <p className="font-mono mt-0.5 text-[10px] uppercase tracking-[0.2em] text-ink/55">
            {subtitle}
          </p>
        </div>
      </div>
      <Download
        className="h-4 w-4 shrink-0 text-ink/55 transition-transform duration-300 group-hover/dl:translate-y-0.5"
        aria-hidden="true"
      />
    </a>
  );
}

function WalkthroughPlaceholder() {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-ink/10 bg-ink text-snow">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 96px)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-snow/15 bg-snow/[0.04]">
          <Play
            className="h-5 w-5 translate-x-[1px] fill-snow/70 text-snow/70"
            aria-hidden="true"
          />
        </span>
        <div className="space-y-2">
          <p className="font-display text-xl font-medium tracking-tight">
            Examiner walkthrough coming soon
          </p>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-parchment/45">
            Watch us solve every question, examiner-style
          </p>
        </div>
      </div>
    </div>
  );
}
