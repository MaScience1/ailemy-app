import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getSubjectBySlug,
  listCoursesForSubjectAndPathway,
} from "@/lib/catalogue/queries";
import {
  deriveStatus,
  getStatusBadge,
  getStatusCta,
} from "@/lib/catalogue/status";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import type { CourseWithCounts } from "@/lib/catalogue/types";
import { cn } from "@/lib/utils";
import { Editable } from "@/components/admin-inline/Editable";

type Params = Promise<{ subject: string; pathway: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { subject: subjectSlug, pathway: pathwaySlug } = await params;
  if (!isPathway(pathwaySlug)) {
    return { title: "Pathway not found · Ailemy" };
  }
  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) {
    return { title: "Subject not found · Ailemy" };
  }
  const pathway = PATHWAY_COPY[pathwaySlug];
  return {
    title: `${pathway.name} ${subject.name} · Ailemy`,
    description: pathway.description,
  };
}

export default async function PathwayPage({ params }: { params: Params }) {
  const { subject: subjectSlug, pathway: pathwaySlug } = await params;

  if (!isPathway(pathwaySlug)) {
    notFound();
  }

  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) {
    notFound();
  }

  const pathway = PATHWAY_COPY[pathwaySlug];
  const courses = await listCoursesForSubjectAndPathway(subject.id, pathwaySlug);
  const grouped = groupCoursesByCurriculum(courses);

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
          <Breadcrumb
            crumbs={[
              { label: "Learn", href: "/learn" },
              { label: subject.name, href: `/learn/${subject.slug}` },
              { label: pathway.name },
            ]}
          />

          <header className="mt-10 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
              {pathway.ageRange}
            </p>
            <h1 className="font-display mt-5 text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
              {pathway.name} {subject.name}.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
              <Editable
                id={`learn.pathway.${pathwaySlug}.description`}
                default={pathway.description}
              />
            </p>
          </header>

          <section className="mt-16 space-y-16">
            {grouped.length === 0 ? (
              <EmptyPathway subjectName={subject.name} pathwayName={pathway.name} />
            ) : (
              grouped.map((group) => (
                <CurriculumGroup
                  key={group.curriculumId}
                  title={group.curriculumName}
                  region={group.region}
                  courses={group.courses}
                  subjectSlug={subject.slug}
                  pathwaySlug={pathwaySlug}
                />
              ))
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

type CurriculumGroup = {
  curriculumId: string;
  curriculumName: string;
  region: string | null;
  courses: CourseWithCounts[];
};

function groupCoursesByCurriculum(
  courses: CourseWithCounts[],
): CurriculumGroup[] {
  const map = new Map<string, CurriculumGroup>();
  for (const course of courses) {
    const id = course.curriculum.id;
    if (!map.has(id)) {
      map.set(id, {
        curriculumId: id,
        curriculumName: course.curriculum.name,
        region: course.curriculum.region,
        courses: [],
      });
    }
    map.get(id)!.courses.push(course);
  }
  return [...map.values()];
}

function CurriculumGroup({
  title,
  region,
  courses,
  subjectSlug,
  pathwaySlug,
}: {
  title: string;
  region: string | null;
  courses: CourseWithCounts[];
  subjectSlug: string;
  pathwaySlug: string;
}) {
  return (
    <div>
      <div className="border-b border-ink/10 pb-4">
        <h2 className="font-display text-2xl font-medium tracking-tight md:text-3xl">
          {title}
        </h2>
        {region && (
          <p className="font-mono mt-2 text-xs uppercase tracking-[0.2em] text-ink/50">
            {region}
          </p>
        )}
      </div>

      <ul className="mt-6 grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {courses.map((course) => (
          <li key={course.id}>
            <CourseCard
              course={course}
              subjectSlug={subjectSlug}
              pathwaySlug={pathwaySlug}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CourseCard({
  course,
  subjectSlug,
  pathwaySlug,
}: {
  course: CourseWithCounts;
  subjectSlug: string;
  pathwaySlug: string;
}) {
  // Derive entity status from lesson counts instead of trusting course.status,
  // which is set per-row in the catalogue seed and doesn't reflect "has the
  // course been seeded with lessons yet" — that distinction is what gives us
  // the new PREVIEW state for browseable-but-not-live courses.
  const status = deriveStatus(course);
  // Card targets the course choice hub (not the lessons grid directly) so
  // students see Lessons and Exam Papers as peer options instead of having
  // to back out and re-enter to discover papers.
  const href = `/learn/${subjectSlug}/${pathwaySlug}/${course.slug}`;

  const badge = getStatusBadge(status);
  const cta = getStatusCta(status, "Open course →");

  const isClickable = !cta.isDisabled;

  const className = cn(
    "group/card flex h-full flex-col justify-between gap-8 rounded-xl border border-ink/10 bg-snow p-6 transition-all duration-300 ease-out sm:p-7",
    isClickable && "hover:-translate-y-1 hover:border-[var(--subject-accent)]",
    status === "preview" && "text-ink/85",
    status === "coming_soon" && "cursor-not-allowed opacity-70",
  );

  const Body = (
    <>
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            {course.level}
          </p>
          <span
            className={cn(
              "font-mono inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]",
              badge.className,
            )}
          >
            {badge.label}
          </span>
        </div>
        <h3 className="font-display mt-5 text-xl font-medium tracking-tight">
          {course.name}
        </h3>
        {course.description && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink/65">
            {course.description}
          </p>
        )}
        {course.estimated_launch && status === "coming_soon" && (
          <p className="font-mono mt-4 text-[10px] uppercase tracking-[0.2em] text-ink/40">
            Est. {course.estimated_launch}
          </p>
        )}
        {status !== "coming_soon" && course.totalLessons > 0 && (
          <p className="font-mono mt-4 text-[10px] uppercase tracking-[0.2em] text-ink/45">
            {course.totalLessons}{" "}
            {course.totalLessons === 1 ? "lesson" : "lessons"}
          </p>
        )}
      </div>

      <div className="text-sm font-medium">
        {status === "available" && (
          <span className="inline-flex items-center gap-2 text-ink transition-transform duration-300 group-hover/card:translate-x-1">
            {cta.label.replace(/\s?→$/, "")}
            <ArrowRight
              className="h-4 w-4 text-[var(--subject-accent)]"
              aria-hidden="true"
            />
          </span>
        )}
        {status === "preview" && (
          <span className="inline-flex items-center gap-2 text-ink/80 transition-transform duration-300 group-hover/card:translate-x-1">
            {cta.label.replace(/\s?→$/, "")}
            <ArrowRight
              className="h-4 w-4 text-[var(--subject-accent)]"
              aria-hidden="true"
            />
          </span>
        )}
        {status === "coming_soon" && (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
            {cta.label}
          </span>
        )}
      </div>
    </>
  );

  if (!isClickable) {
    return (
      <div className={className} aria-disabled="true">
        {Body}
      </div>
    );
  }

  return (
    <Link href={href} className={className}>
      {Body}
    </Link>
  );
}

function EmptyPathway({
  subjectName,
  pathwayName,
}: {
  subjectName: string;
  pathwayName: string;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-snow p-10 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
        Coming soon
      </p>
      <p className="font-display mt-5 text-2xl font-medium tracking-tight">
        No {subjectName} courses for {pathwayName} yet.
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink/60">
        We&apos;re organising courses for this pathway. In the meantime, try
        another pathway or browse the full catalogue.
      </p>
    </div>
  );
}
