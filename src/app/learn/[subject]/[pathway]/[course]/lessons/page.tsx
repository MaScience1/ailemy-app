import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Beaker } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { StatusBadge } from "@/components/catalogue/status-badge";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseBySubjectPathwayAndSlug,
  getSubjectBySlug,
  listLessonsForCourse,
  listUnitsForCourse,
} from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import type { LessonForCatalogue, Unit } from "@/lib/catalogue/types";
import { cn } from "@/lib/utils";
import { InlineEditBoundary } from "@/components/admin-inline/InlineEditBoundary";
import {
  LessonAddSlot,
  LessonControlsSlot,
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
    return { title: "Lessons not found · Ailemy" };
  }
  const course = await getCourseBySubjectPathwayAndSlug(
    subjectSlug,
    pathwaySlug,
    courseSlug,
  );
  if (!course) {
    return { title: "Lessons not found · Ailemy" };
  }
  return {
    title: `Lessons · ${course.name} · Ailemy`,
    description: course.description ?? undefined,
  };
}

export default async function LessonsPage({ params }: { params: Params }) {
  const {
    subject: subjectSlug,
    pathway: pathwaySlug,
    course: courseSlug,
  } = await params;

  if (!isPathway(pathwaySlug)) {
    notFound();
  }

  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) {
    notFound();
  }

  const course = await getCourseBySubjectPathwayAndSlug(
    subjectSlug,
    pathwaySlug,
    courseSlug,
  );
  if (!course) {
    notFound();
  }

  const [units, lessons] = await Promise.all([
    listUnitsForCourse(course.id),
    listLessonsForCourse(course.id),
  ]);

  // Bucket lessons by unit. Lessons with no unit_id fall under "Other".
  const lessonsByUnit = new Map<string | null, LessonForCatalogue[]>();
  for (const lesson of lessons) {
    const key = lesson.unit_id ?? null;
    if (!lessonsByUnit.has(key)) lessonsByUnit.set(key, []);
    lessonsByUnit.get(key)!.push(lesson);
  }

  // Render order = unit sort_order, then "Other" if any unitless lessons exist.
  const sections: { unit: Unit | null; lessons: LessonForCatalogue[] }[] = [];
  for (const unit of units) {
    const items = lessonsByUnit.get(unit.id) ?? [];
    if (items.length > 0) sections.push({ unit, lessons: items });
  }
  const orphan = lessonsByUnit.get(null);
  if (orphan && orphan.length > 0) {
    sections.push({ unit: null, lessons: orphan });
  }

  const totalLessons = lessons.length;
  const pathway = PATHWAY_COPY[pathwaySlug];
  const courseHref = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}`;

  // Every edit affordance below is a self-gating SERVER slot: it renders null
  // for a student, and only then defers to a client import. Nothing here adds
  // markup or JS to the student view.
  return (
    <InlineEditBoundary
      kind="lesson"
      courseId={course.id}
      lessonIds={lessons.map((l) => l.id)}
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
              { label: course.name, href: courseHref },
              { label: "Lessons" },
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
              {sections.length} {sections.length === 1 ? "unit" : "units"}
            </p>
          </header>

          <LessonAddSlot
            label="+ Add lesson to this course"
            note="New lessons are prefilled with this course."
          />

          <div className="mt-12 space-y-20">
            {sections.length === 0 ? (
              <EmptyCourse />
            ) : (
              sections.map(({ unit, lessons }) => (
                <UnitSection
                  key={unit?.id ?? "orphan"}
                  unit={unit}
                  lessons={lessons}
                  subjectSlug={subjectSlug}
                  pathwaySlug={pathwaySlug}
                  courseSlug={courseSlug}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
    </InlineEditBoundary>
  );
}

function UnitSection({
  unit,
  lessons,
  subjectSlug,
  pathwaySlug,
  courseSlug,
}: {
  unit: Unit | null;
  lessons: LessonForCatalogue[];
  subjectSlug: string;
  pathwaySlug: string;
  courseSlug: string;
}) {
  return (
    <section>
      <div className="border-b border-ink/10 pb-5">
        {unit?.code && (
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
            {unit.code}
          </p>
        )}
        <h2 className="font-display mt-3 text-3xl font-medium tracking-tight md:text-4xl">
          {unit?.name ?? "Other lessons"}
        </h2>
        {unit?.description && (
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink/65">
            {unit.description}
          </p>
        )}
        <p className="font-mono mt-4 text-[11px] uppercase tracking-[0.2em] text-ink/45">
          {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
        </p>
        <LessonAddSlot
          label={unit ? `+ Add lesson to ${unit.name}` : "+ Add unitless lesson"}
          unitId={unit?.id ?? null}
        />
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <LessonCard
              lesson={lesson}
              subjectSlug={subjectSlug}
              pathwaySlug={pathwaySlug}
              courseSlug={courseSlug}
            />
            {/*
              Controls sit OUTSIDE the card. The card is an <a>, and nesting
              <button> inside <a> is invalid HTML and breaks keyboard nav.
            */}
            <LessonControlsSlot id={lesson.id} title={lesson.title} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LessonCard({
  lesson,
  subjectSlug,
  pathwaySlug,
  courseSlug,
}: {
  lesson: LessonForCatalogue;
  subjectSlug: string;
  pathwaySlug: string;
  courseSlug: string;
}) {
  const isLive = lesson.status === "live";
  const href = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}/${lesson.slug}`;

  const className = cn(
    "group/lesson relative flex h-full flex-col gap-5 rounded-lg border border-ink/10 bg-snow p-6 transition-all duration-300 ease-out",
    isLive
      ? "hover:-translate-y-1 hover:border-[var(--subject-accent)]"
      : "cursor-not-allowed opacity-75",
  );

  const Body = (
    <>
      {lesson.is_core_practical && (
        <span className="font-mono absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-flask px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-snow">
          <Beaker className="h-3 w-3" aria-hidden="true" />
          Core Practical
        </span>
      )}

      <div>
        <p
          className="font-mono text-xs uppercase tracking-[0.25em]"
          style={{ color: "var(--subject-accent)" }}
        >
          Lesson {String(lesson.lesson_number ?? "").padStart(2, "0")}
        </p>
        <h3 className="font-display mt-4 text-lg font-medium leading-snug tracking-tight">
          {lesson.title}
        </h3>
      </div>

      {lesson.spec_point_codes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lesson.spec_point_codes.map((code) => (
            <span
              key={code}
              className="font-mono rounded bg-parchment px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ink/65"
              style={{ borderLeft: "1px solid var(--subject-accent)" }}
            >
              {code}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-1 text-sm font-medium">
        {isLive ? (
          <span
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-snow transition-colors duration-200"
            style={{ backgroundColor: "var(--subject-accent)" }}
          >
            Start lesson
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
            Coming soon
          </span>
        )}
      </div>
    </>
  );

  if (!isLive) {
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

function EmptyCourse() {
  return (
    <div className="rounded-xl border border-ink/10 bg-snow p-10 text-center">
      <p className="font-display text-2xl font-medium tracking-tight">
        No lessons published yet.
      </p>
      <p className="mt-3 text-sm text-ink/60">
        We&apos;re organising lessons for this course. Check back soon.
      </p>
    </div>
  );
}
