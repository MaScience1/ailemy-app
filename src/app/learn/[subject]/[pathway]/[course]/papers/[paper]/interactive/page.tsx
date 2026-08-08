import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { ModeSelector } from "@/components/exam/ModeSelector";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseBySubjectPathwayAndSlug,
  getPastPaperByCourseAndSlug,
  getSubjectBySlug,
} from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import { getPaperExamMeta } from "@/lib/exam/paper-exam-meta";
import { getPaperPublicUrl } from "@/lib/storage/papers";

/**
 * Mode selection — the screen "Try interactively" now opens.
 *
 * This is a NEW LAYER in front of the old entry point, not a replacement for
 * anything. The paper page keeps all three download cards untouched, and the
 * tldraw practice viewer at ../practice is unchanged and still reachable —
 * "Teach this paper" routes straight to it.
 *
 * SERVER COMPONENT, and it has to be: getPaperExamMeta reads paper_questions
 * with the service-role client because `anon` has no grant on that table, and
 * it carries `import "server-only"`. Making this "use client" would fail the
 * build rather than leak the key — which is the point of that import.
 */

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
    title: `Teach or sit · ${paper.paper_name} · Ailemy`,
    description: `Present ${paper.paper_name} to a class, or sit it and have Ailemy mark your answers against the examiner mark scheme.`,
  };
}

export default async function InteractiveModePage({
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

  // The one privileged read on this page, and it returns three integers and a
  // boolean — see the long note in paper-exam-meta.ts.
  const examMeta = await getPaperExamMeta(paper.id, paper.total_marks ?? null);

  const pathway = PATHWAY_COPY[pathwaySlug];
  const courseHref = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}`;
  const examQuestionsHref = `${courseHref}/exam-questions`;
  const paperHref = `${courseHref}/papers/${paperSlug}`;
  const paperUrl = getPaperPublicUrl(paper.paper_pdf_path);

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
              { label: paper.paper_name, href: paperHref },
              { label: "Interactive" },
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
              How would you like to work?
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink/65">
              {paper.paper_name}
            </p>
            {/* Session and year are already inside paper_name ("May-June 2025 –
                Unit 1 Question Paper"), so this line carries only what that
                string does not: how long the exam runs and what it is worth. */}
            {(paper.duration_minutes != null || paper.total_marks != null) && (
              <p className="font-mono mt-3 text-xs uppercase tracking-[0.2em] text-ink/50">
                {[
                  paper.duration_minutes != null &&
                    `${paper.duration_minutes} minutes`,
                  paper.total_marks != null && `${paper.total_marks} marks`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </header>

          <section aria-label="Choose a mode" className="mt-10 sm:mt-14">
            <ModeSelector
              meta={examMeta}
              teachHref={`${paperHref}/practice`}
              sitExamHref={`${paperHref}/interactive/sit/exam`}
              sitPracticeHref={`${paperHref}/interactive/sit/practice`}
            />
          </section>

          {/* Partial-coverage note, below the fold rather than inside the card.
              The card already carries the numbers; this explains what they
              mean, and only when they need explaining. */}
          {examMeta.isPartial && examMeta.paperTotalMarks !== null && (
            <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink/55">
              <span className="font-medium text-ink/75">
                Part of this paper is ready.
              </span>{" "}
              {examMeta.seededMarks} of {examMeta.paperTotalMarks} marks have
              been broken into questions Ailemy can mark. The rest of the paper
              is in the PDF — download it above, or open the whiteboard.
            </p>
          )}

          {/* The download route stays one click away from here, so choosing to
              come to this screen never costs a student the simple path. */}
          <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-ink/10 pt-6">
            <Link
              href={paperHref}
              className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Back to the paper
            </Link>
            {paperUrl && (
              <a
                href={paperUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-ink"
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                Download the PDF instead
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
