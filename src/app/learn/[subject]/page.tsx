import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { StatusBadge } from "@/components/catalogue/status-badge";
import {
  getSubjectBySlug,
  listCoursesForSubject,
} from "@/lib/catalogue/queries";
import { getSubjectCopy } from "@/lib/catalogue/subject-descriptions";
import type { CourseWithRelations } from "@/lib/catalogue/types";
import { cn } from "@/lib/utils";

type Params = Promise<{ subject: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { subject: subjectSlug } = await params;
  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) {
    return { title: "Subject not found · Ailemy" };
  }
  return {
    title: `${subject.name} · Ailemy`,
    description: getSubjectCopy(subject.slug).description,
  };
}

export default async function SubjectPage({ params }: { params: Params }) {
  const { subject: subjectSlug } = await params;
  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) notFound();

  const courses = await listCoursesForSubject(subject.id);
  const copy = getSubjectCopy(subject.slug);

  // Group courses by curriculum, preserving the catalogue sort_order of the
  // curricula (which we read off the first occurrence of each curriculum).
  const grouped = groupCoursesByCurriculum(courses);

  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
        <Breadcrumb
          crumbs={[
            { label: "Learn", href: "/learn" },
            { label: subject.name },
          ]}
        />

        <header className="mt-10 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
            Subject
          </p>
          <h1 className="font-display mt-5 text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            {subject.name}.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
            {copy.description}
          </p>
        </header>

        <section className="mt-16 space-y-16">
          {grouped.length === 0 ? (
            <EmptyState />
          ) : (
            grouped.map((group) => (
              <CurriculumGroup
                key={group.curriculumId}
                title={group.curriculumName}
                region={group.region}
                courses={group.courses}
                subjectSlug={subject.slug}
              />
            ))
          )}
        </section>
      </div>
    </main>
  );
}

type CurriculumGroup = {
  curriculumId: string;
  curriculumName: string;
  region: string | null;
  courses: CourseWithRelations[];
};

function groupCoursesByCurriculum(
  courses: CourseWithRelations[],
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
}: {
  title: string;
  region: string | null;
  courses: CourseWithRelations[];
  subjectSlug: string;
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
            <CourseCard course={course} subjectSlug={subjectSlug} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CourseCard({
  course,
  subjectSlug,
}: {
  course: CourseWithRelations;
  subjectSlug: string;
}) {
  const isOpen = course.status === "in_progress" || course.status === "live";
  const href = `/learn/${subjectSlug}/${course.slug}`;

  const className = cn(
    "group/card flex h-full flex-col justify-between gap-8 rounded-xl border border-ink/10 bg-snow p-6 transition-all duration-300 ease-out sm:p-7",
    isOpen
      ? "hover:-translate-y-1 hover:border-ink/25"
      : "cursor-not-allowed opacity-70",
  );

  const Body = (
    <>
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            {course.level}
          </p>
          <StatusBadge status={course.status} />
        </div>
        <h3 className="font-display mt-5 text-xl font-medium tracking-tight">
          {course.name}
        </h3>
        {course.description && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink/65">
            {course.description}
          </p>
        )}
        {course.estimated_launch && !isOpen && (
          <p className="font-mono mt-4 text-[10px] uppercase tracking-[0.2em] text-ink/40">
            Est. {course.estimated_launch}
          </p>
        )}
      </div>

      <div className="text-sm font-medium">
        {isOpen ? (
          <span className="inline-flex items-center gap-2 text-ink transition-transform duration-300 group-hover/card:translate-x-1">
            Start course
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
            Notify me
          </span>
        )}
      </div>
    </>
  );

  if (!isOpen) {
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

function EmptyState() {
  return (
    <div className="rounded-xl border border-ink/10 bg-snow p-10 text-center">
      <p className="font-display text-2xl font-medium tracking-tight">
        Nothing here yet.
      </p>
      <p className="mt-3 text-sm text-ink/60">
        We&apos;re organising courses for this subject. Check back soon.
      </p>
    </div>
  );
}
