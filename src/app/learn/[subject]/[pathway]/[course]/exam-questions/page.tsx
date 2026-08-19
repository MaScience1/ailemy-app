import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText, Video } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { StatusBadge } from "@/components/catalogue/status-badge";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseBySubjectPathwayAndSlug,
  getSubjectBySlug,
  listLessonsForCourse,
  listPastPapersForCourse,
  listUnitsForCourse,
} from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import type { PastPaper, Unit } from "@/lib/catalogue/types";
import { InlineEditBoundary } from "@/components/admin-inline/InlineEditBoundary";
import {
  PaperAddSlot,
  PaperControlsSlot,
} from "@/components/admin-inline/slots";

type Params = Promise<{
  subject: string;
  pathway: string;
  course: string;
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
  } = await params;
  if (!isPathway(pathwaySlug)) {
    return { title: "Course not found · Ailemy" };
  }
  const course = await getCourseBySubjectPathwayAndSlug(
    subjectSlug,
    pathwaySlug,
    courseSlug,
  );
  if (!course) {
    return { title: "Course not found · Ailemy" };
  }
  return {
    title: `Exam Papers · ${course.name} · Ailemy`,
    description: `Past papers, mark schemes and examiner-style walkthroughs for ${course.name}.`,
  };
}

export default async function ExamQuestionsPage({
  params,
}: {
  params: Params;
}) {
  const {
    subject: subjectSlug,
    pathway: pathwaySlug,
    course: courseSlug,
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

  const [units, lessons, papers] = await Promise.all([
    listUnitsForCourse(course.id),
    listLessonsForCourse(course.id),
    listPastPapersForCourse(course.id),
  ]);

  // Bucket papers by unit. Papers without unit_id fall under an "Other" bucket.
  const papersByUnit = new Map<string | null, PastPaper[]>();
  for (const paper of papers) {
    const key = paper.unit_id ?? null;
    if (!papersByUnit.has(key)) papersByUnit.set(key, []);
    papersByUnit.get(key)!.push(paper);
  }

  const totalLessons = lessons.length;
  const pathway = PATHWAY_COPY[pathwaySlug];

  return (
    <InlineEditBoundary
      kind="paper"
      courseId={course.id}
      paperIds={papers.map((p) => p.id)}
    >
    <div style={getSubjectThemeStyle(subject)}>
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-10 sm:py-20">
          <Breadcrumb
            crumbs={[
              { label: "Learn", href: "/learn" },
              { label: subject.name, href: `/learn/${subject.slug}` },
              {
                label: pathway.name,
                href: `/learn/${subject.slug}/${pathwaySlug}`,
              },
              {
                label: course.name,
                href: `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}`,
              },
              { label: "Exam Papers" },
            ]}
          />

          <header className="mt-10 max-w-3xl">
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
                {course.curriculum.short_name} · {course.level}
              </p>
              <StatusBadge status={course.status} />
            </div>
            <h1 className="font-display mt-5 text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">
              {course.name}.
            </h1>
            {course.description && (
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/70">
                {course.description}
              </p>
            )}
            <p className="font-mono mt-6 text-xs uppercase tracking-[0.2em] text-ink/55">
              {totalLessons} {totalLessons === 1 ? "lesson" : "lessons"} ·{" "}
              {papers.length} {papers.length === 1 ? "paper" : "papers"}
            </p>
          </header>

          {units.length === 0 ? (
            <EmptyAllUnits />
          ) : (
            <div className="mt-12 space-y-20">
              {units.map((unit) => (
                <UnitPapers
                  key={unit.id}
                  unit={unit}
                  papers={papersByUnit.get(unit.id) ?? []}
                  subjectSlug={subjectSlug}
                  pathwaySlug={pathwaySlug}
                  courseSlug={courseSlug}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
    </InlineEditBoundary>
  );
}

function UnitPapers({
  unit,
  papers,
  subjectSlug,
  pathwaySlug,
  courseSlug,
}: {
  unit: Unit;
  papers: PastPaper[];
  subjectSlug: string;
  pathwaySlug: string;
  courseSlug: string;
}) {
  return (
    <section>
      <div className="border-b border-ink/10 pb-5">
        {unit.code && (
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
            {unit.code}
          </p>
        )}
        <h2 className="font-display mt-3 text-3xl font-medium tracking-tight md:text-4xl">
          {unit.name}
        </h2>
        <p className="font-mono mt-4 text-[11px] uppercase tracking-[0.2em] text-ink/45">
          {papers.length} {papers.length === 1 ? "paper" : "papers"}
        </p>
        <PaperAddSlot
          label={`+ Add past paper to ${unit.name}`}
          unitId={unit.id}
        />
      </div>

      {papers.length === 0 ? (
        <EmptyUnit unitCode={unit.code ?? unit.name} />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {papers.map((paper) => (
            <li key={paper.id}>
              <PaperCard
                paper={paper}
                subjectSlug={subjectSlug}
                pathwaySlug={pathwaySlug}
                courseSlug={courseSlug}
              />
              {/* Outside the card: the card is an <a>, no <button> nesting. */}
              <PaperControlsSlot id={paper.id} title={paper.paper_name} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PaperCard({
  paper,
  subjectSlug,
  pathwaySlug,
  courseSlug,
}: {
  paper: PastPaper;
  subjectSlug: string;
  pathwaySlug: string;
  courseSlug: string;
}) {
  const href = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}/papers/${paper.slug}`;
  const hasWalkthrough = Boolean(paper.walkthrough_mux_playback_id);

  return (
    <Link
      href={href}
      className="group/paper flex h-full flex-col gap-5 rounded-lg border border-ink/10 bg-snow p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[var(--subject-accent)]"
    >
      <div>
        {paper.paper_code && (
          <p
            className="font-mono text-xs uppercase tracking-[0.2em]"
            style={{ color: "var(--subject-accent)" }}
          >
            {paper.paper_code}
          </p>
        )}
        <h3 className="font-display mt-3 text-xl font-medium leading-snug tracking-tight">
          {paper.paper_name}
        </h3>
        <p className="font-mono mt-2 text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {paper.session} · {paper.year}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="font-mono inline-flex items-center gap-1 rounded bg-parchment px-1.5 py-0.5 uppercase tracking-wide text-ink/65">
          <FileText className="h-2.5 w-2.5" aria-hidden="true" />
          PDF
        </span>
        {hasWalkthrough && (
          <span className="font-mono inline-flex items-center gap-1 rounded bg-parchment px-1.5 py-0.5 uppercase tracking-wide text-ink/65">
            <Video className="h-2.5 w-2.5" aria-hidden="true" />
            Walkthrough
          </span>
        )}
      </div>

      <div className="mt-auto pt-1 text-sm font-medium">
        <span className="inline-flex items-center gap-2 text-ink transition-transform duration-300 group-hover/paper:translate-x-1">
          Open paper
          <ArrowRight
            className="h-4 w-4"
            style={{ color: "var(--subject-accent)" }}
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}

function EmptyUnit({ unitCode }: { unitCode: string }) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-ink/15 bg-snow/50 p-8 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
        Coming soon
      </p>
      <p className="mt-3 text-sm text-ink/65">
        No past papers uploaded yet for {unitCode}. We&apos;re adding papers
        continuously — check back soon.
      </p>
    </div>
  );
}

function EmptyAllUnits() {
  return (
    <div className="mt-16 rounded-xl border border-ink/10 bg-snow p-10 text-center">
      <p className="font-display text-2xl font-medium tracking-tight">
        Past papers coming soon.
      </p>
      <p className="mt-3 text-sm text-ink/65">
        We&apos;re organising units and papers for this course.
      </p>
    </div>
  );
}
