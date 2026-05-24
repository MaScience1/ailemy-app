import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, ClipboardList } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { StatusBadge } from "@/components/catalogue/status-badge";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseChoiceData,
  getSubjectBySlug,
} from "@/lib/catalogue/queries";
import {
  deriveStatus,
  getStatusBadge,
  type EntityStatus,
} from "@/lib/catalogue/status";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import { cn } from "@/lib/utils";

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
  const data = await getCourseChoiceData(subjectSlug, pathwaySlug, courseSlug);
  if (!data) {
    return { title: "Course not found · Ailemy" };
  }
  return {
    title: `${data.course.name} · Ailemy`,
    description: `Choose your path: spec-led video lessons or interactive exam paper practice for ${data.course.name}.`,
  };
}

export default async function CourseChoiceHubPage({
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

  const data = await getCourseChoiceData(subjectSlug, pathwaySlug, courseSlug);
  if (!data) notFound();

  const { course, lessonStats, paperStats } = data;
  const pathway = PATHWAY_COPY[pathwaySlug];
  const courseBase = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}`;

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
          <Breadcrumb
            crumbs={[
              { label: "Learn", href: "/learn" },
              { label: subject.name, href: `/learn/${subject.slug}` },
              {
                label: pathway.name,
                href: `/learn/${subject.slug}/${pathwaySlug}`,
              },
              { label: course.name },
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
              {lessonStats.totalLessons}{" "}
              {lessonStats.totalLessons === 1 ? "lesson" : "lessons"} ·{" "}
              {lessonStats.unitCount}{" "}
              {lessonStats.unitCount === 1 ? "unit" : "units"} ·{" "}
              {paperStats.totalPapers}{" "}
              {paperStats.totalPapers === 1 ? "paper" : "papers"}
            </p>
          </header>

          <section
            aria-label="Course paths"
            className="mt-14 grid gap-6 md:mt-20 md:grid-cols-2 md:gap-8"
          >
            <LessonsCard
              href={`${courseBase}/lessons`}
              stats={lessonStats}
            />
            <ExamPapersCard
              href={`${courseBase}/exam-questions`}
              stats={paperStats}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Choice cards
// ---------------------------------------------------------------------------

type LessonsStats = {
  totalLessons: number;
  liveLessons: number;
  unitCount: number;
};

function LessonsCard({
  href,
  stats,
}: {
  href: string;
  stats: LessonsStats;
}) {
  const status = deriveStatus({
    totalLessons: stats.totalLessons,
    liveLessons: stats.liveLessons,
  });
  const meta =
    stats.totalLessons === 0
      ? "Lessons coming soon"
      : `${stats.totalLessons} ${stats.totalLessons === 1 ? "lesson" : "lessons"} · ${stats.unitCount} ${stats.unitCount === 1 ? "unit" : "units"}`;

  return (
    <ChoiceCard
      href={href}
      status={status}
      eyebrow="Study"
      title="Lessons"
      description="Spec-by-spec teaching with examiner-led video walkthroughs."
      meta={meta}
      availableCtaLabel="Start learning →"
      previewCtaLabel="Browse lessons →"
      icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
    />
  );
}

type PapersStats = {
  totalPapers: number;
  livePapers: number;
};

function ExamPapersCard({
  href,
  stats,
}: {
  href: string;
  stats: PapersStats;
}) {
  // Papers have a simpler two-state model: either at least one live paper
  // exists (AVAILABLE) or none (COMING SOON). No "preview" — a paper is
  // either uploaded and live, or it doesn't exist yet.
  const status: EntityStatus =
    stats.livePapers > 0 ? "available" : "coming_soon";

  const meta =
    stats.totalPapers === 0
      ? "Papers coming soon"
      : `${stats.totalPapers} ${stats.totalPapers === 1 ? "paper" : "papers"}`;

  return (
    <ChoiceCard
      href={href}
      status={status}
      eyebrow="Practise"
      title="Exam Papers"
      description="Past papers, mark schemes, and interactive practice whiteboards."
      meta={meta}
      availableCtaLabel="Open exam papers →"
      // ExamPapers has no preview state, but the prop is required by the
      // shared ChoiceCard signature. Never rendered for this card.
      previewCtaLabel="Open exam papers →"
      icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
    />
  );
}

// Generic choice-hub card. Two of these sit side-by-side on the hub.
function ChoiceCard({
  href,
  status,
  eyebrow,
  title,
  description,
  meta,
  availableCtaLabel,
  previewCtaLabel,
  icon,
}: {
  href: string;
  status: EntityStatus;
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
  availableCtaLabel: string;
  previewCtaLabel: string;
  icon: React.ReactNode;
}) {
  const badge = getStatusBadge(status);
  // CTA copy per status. We don't reuse getStatusCta from status.ts here
  // because that helper hard-codes the preview label to the catalogue-wide
  // "Browse curriculum →" — fine for the subject/pathway/course cards out
  // in the catalogue, but the choice hub wants per-card copy ("Browse
  // lessons →" vs ignored). Inline keeps both CTAs explicit and local.
  const cta = (() => {
    if (status === "available")
      return { label: availableCtaLabel, isDisabled: false };
    if (status === "preview")
      return { label: previewCtaLabel, isDisabled: false };
    return { label: "NOT YET OPEN", isDisabled: true };
  })();
  const isClickable = !cta.isDisabled;

  const cardClass = cn(
    "group/choice relative flex h-full flex-col gap-8 overflow-hidden rounded-2xl border border-ink/10 bg-snow p-8 transition-all duration-200 ease-out sm:p-10",
    isClickable
      ? "cursor-pointer hover:translate-y-[-2px] hover:border-[var(--subject-accent)] hover:shadow-md"
      : "cursor-not-allowed opacity-70",
    status === "preview" && "text-ink/90",
  );

  const Stripe = (
    <span
      aria-hidden="true"
      className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
      style={{ backgroundColor: "var(--subject-accent)" }}
    />
  );

  const Body = (
    <>
      {Stripe}

      <div className="flex items-start justify-between gap-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-md"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--subject-accent) 12%, transparent)",
            color: "var(--subject-accent)",
          }}
        >
          {icon}
        </span>
        <span
          className={cn(
            "font-mono inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]",
            badge.className,
          )}
        >
          {badge.label}
        </span>
      </div>

      <div>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
          {eyebrow}
        </p>
        <h2 className="font-display mt-3 text-3xl font-medium tracking-tight md:text-4xl">
          {title}
        </h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink/65">
          {description}
        </p>
        <p className="font-mono mt-5 text-[11px] uppercase tracking-[0.2em] text-ink/45">
          {meta}
        </p>
      </div>

      <div className="mt-auto pt-2 text-sm font-medium">
        {status === "coming_soon" ? (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
            {cta.label}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-2 transition-transform duration-200 group-hover/choice:translate-x-1"
            style={{ color: "var(--subject-accent)" }}
          >
            {cta.label.replace(/\s?→$/, "")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </>
  );

  if (!isClickable) {
    return (
      <div className={cardClass} aria-disabled="true">
        {Body}
      </div>
    );
  }

  return (
    <Link href={href} className={cardClass}>
      {Body}
    </Link>
  );
}
