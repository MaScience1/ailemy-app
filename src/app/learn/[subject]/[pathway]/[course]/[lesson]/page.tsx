import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Clock } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { StatusBadge } from "@/components/catalogue/status-badge";
import { VideoPlaceholder } from "@/components/catalogue/video-placeholder";
import { MuxLessonPlayer } from "@/components/lesson/MuxLessonPlayer";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseBySubjectPathwayAndSlug,
  getLessonByCourseAndSlug,
  getLessonNeighbours,
  getSubjectBySlug,
} from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import type {
  CourseWithRelations,
  LessonForPage,
  LessonNeighbour,
  Subject,
} from "@/lib/catalogue/types";

type Params = Promise<{
  subject: string;
  pathway: string;
  course: string;
  lesson: string;
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
    lesson: lessonSlug,
  } = await params;

  if (!isPathway(pathwaySlug)) {
    return { title: "Lesson not found · Ailemy" };
  }

  const [course, lesson] = await Promise.all([
    getCourseBySubjectPathwayAndSlug(subjectSlug, pathwaySlug, courseSlug),
    getLessonByCourseAndSlug(courseSlug, lessonSlug),
  ]);

  if (!course || !lesson) {
    return { title: "Lesson not found · Ailemy" };
  }

  return {
    title: `${lesson.title} · ${course.name} · Ailemy`,
    description: lesson.description ?? undefined,
  };
}

export default async function LessonPage({ params }: { params: Params }) {
  const {
    subject: subjectSlug,
    pathway: pathwaySlug,
    course: courseSlug,
    lesson: lessonSlug,
  } = await params;

  if (!isPathway(pathwaySlug)) {
    notFound();
  }

  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) {
    notFound();
  }

  const [course, lesson] = await Promise.all([
    getCourseBySubjectPathwayAndSlug(subjectSlug, pathwaySlug, courseSlug),
    getLessonByCourseAndSlug(courseSlug, lessonSlug),
  ]);

  if (!course || !lesson) {
    notFound();
  }

  // Coming-soon lessons get the placeholder variant — different shape,
  // different intent. Only render the full lesson page for live content.
  if (lesson.status !== "live") {
    return (
      <ComingSoonLesson
        course={course}
        lesson={lesson}
        subject={subject}
        subjectSlug={subjectSlug}
        pathwaySlug={pathwaySlug}
        courseSlug={courseSlug}
      />
    );
  }

  // Prev/next nav — only meaningful when we have a lesson_number to anchor on.
  const neighbours =
    lesson.lesson_number != null
      ? await getLessonNeighbours(course.id, lesson.lesson_number)
      : { prev: null, next: null };

  return (
    <LiveLesson
      course={course}
      lesson={lesson}
      subject={subject}
      subjectSlug={subjectSlug}
      pathwaySlug={pathwaySlug}
      courseSlug={courseSlug}
      prev={neighbours.prev}
      next={neighbours.next}
    />
  );
}

// ---------------------------------------------------------------------------
// LIVE LESSON VARIANT
// ---------------------------------------------------------------------------

function LiveLesson({
  course,
  lesson,
  subject,
  subjectSlug,
  pathwaySlug,
  courseSlug,
  prev,
  next,
}: {
  course: CourseWithRelations;
  lesson: LessonForPage;
  subject: Subject;
  subjectSlug: string;
  pathwaySlug: string;
  courseSlug: string;
  prev: LessonNeighbour | null;
  next: LessonNeighbour | null;
}) {
  const paddedNumber = lesson.lesson_number
    ? String(lesson.lesson_number).padStart(2, "0")
    : null;
  const pathway = PATHWAY_COPY[pathwaySlug as keyof typeof PATHWAY_COPY];

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
              {
                label: course.name,
                href: `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}`,
              },
              {
                label: "Lessons",
                href: `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}/lessons`,
              },
              { label: lesson.title },
            ]}
          />

          <header className="mt-8 max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
              {paddedNumber && (
                <p
                  className="font-mono text-xs uppercase tracking-[0.25em]"
                  style={{ color: "var(--subject-accent)" }}
                >
                  Lesson {paddedNumber}
                </p>
              )}
              <StatusBadge status="live" label="Live" />
              {lesson.is_core_practical && (
                <span className="font-mono inline-flex items-center rounded-full bg-flask px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-snow">
                  Core Practical
                </span>
              )}
            </div>

            <h1 className="font-display mt-6 text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">
              {lesson.title}.
            </h1>

            {lesson.spec_points.length > 0 && (
              <div className="font-mono mt-6 flex flex-wrap items-center gap-2 text-xs tracking-wide text-ink/65">
                <span className="uppercase text-ink/45">Spec points</span>
                {lesson.spec_points.map((sp) => (
                  <span
                    key={sp.id}
                    className="rounded bg-ink/[0.06] px-2 py-0.5 font-medium text-ink/75"
                    style={{ borderLeft: "1px solid var(--subject-accent)" }}
                  >
                    {sp.code}
                  </span>
                ))}
              </div>
            )}

            {lesson.estimated_duration_minutes != null && (
              <p className="font-mono mt-3 inline-flex items-center gap-1.5 text-xs tracking-wide text-ink/55">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {lesson.estimated_duration_minutes} min
              </p>
            )}
          </header>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
            <div className="min-w-0">
              {lesson.voice_video_mux_id ? (
                <MuxLessonPlayer
                  playbackId={lesson.voice_video_mux_id}
                  title={lesson.title}
                />
              ) : (
                <VideoPlaceholder />
              )}

              {lesson.description && (
                <section className="mt-10">
                  <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
                    About this lesson
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-[1.7] text-ink/80">
                    {lesson.description}
                  </p>
                </section>
              )}

              {lesson.summary_md && (
                <section className="mt-10">
                  <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
                    Summary
                  </h2>
                  <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-[1.7] text-ink/80">
                    {lesson.summary_md}
                  </p>
                </section>
              )}
            </div>

            <aside className="space-y-5 lg:sticky lg:top-10 lg:self-start">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-ink/55" aria-hidden="true" />
                <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
                  This lesson covers
                </h2>
              </div>

              {lesson.spec_points.length === 0 ? (
                <p className="text-sm text-ink/55">
                  Spec point mapping coming soon.
                </p>
              ) : (
                <ul className="space-y-3">
                  {lesson.spec_points.map((sp) => (
                    <li
                      key={sp.id}
                      className="rounded-lg border border-ink/10 bg-snow p-5 transition-colors hover:border-[var(--subject-accent)]"
                    >
                      <div className="flex items-baseline gap-3">
                        <span
                          className="font-mono text-sm font-semibold"
                          style={{ color: "var(--subject-accent)" }}
                        >
                          {sp.code}
                        </span>
                        <h3 className="font-display text-base font-medium leading-snug tracking-tight">
                          {sp.title}
                        </h3>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-ink/70">
                        {sp.description}
                      </p>
                      {sp.command_terms && sp.command_terms.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {sp.command_terms.map((term) => (
                            <span
                              key={term}
                              className="font-mono rounded bg-parchment px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/60"
                            >
                              {term}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>

          <PrevNextNav
            subjectSlug={subjectSlug}
            pathwaySlug={pathwaySlug}
            courseSlug={courseSlug}
            prev={prev}
            next={next}
          />
        </div>
      </main>
    </div>
  );
}

function PrevNextNav({
  subjectSlug,
  pathwaySlug,
  courseSlug,
  prev,
  next,
}: {
  subjectSlug: string;
  pathwaySlug: string;
  courseSlug: string;
  prev: LessonNeighbour | null;
  next: LessonNeighbour | null;
}) {
  return (
    <nav
      aria-label="Lesson navigation"
      className="mt-16 grid gap-4 border-t border-ink/10 pt-8 sm:grid-cols-2 sm:gap-6"
    >
      <NeighbourCard
        direction="prev"
        subjectSlug={subjectSlug}
        pathwaySlug={pathwaySlug}
        courseSlug={courseSlug}
        neighbour={prev}
      />
      <NeighbourCard
        direction="next"
        subjectSlug={subjectSlug}
        pathwaySlug={pathwaySlug}
        courseSlug={courseSlug}
        neighbour={next}
      />
    </nav>
  );
}

function NeighbourCard({
  direction,
  subjectSlug,
  pathwaySlug,
  courseSlug,
  neighbour,
}: {
  direction: "prev" | "next";
  subjectSlug: string;
  pathwaySlug: string;
  courseSlug: string;
  neighbour: LessonNeighbour | null;
}) {
  const isPrev = direction === "prev";
  const label = isPrev ? "Previous lesson" : "Next lesson";
  const alignClass = isPrev ? "" : "sm:text-right sm:items-end";
  const Icon = isPrev ? ArrowLeft : ArrowRight;

  if (!neighbour) {
    return (
      <div
        className={`flex flex-col gap-2 rounded-lg border border-ink/10 bg-snow p-5 opacity-50 ${alignClass}`}
        aria-disabled="true"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/45">
          {label}
        </p>
        <p className="text-sm text-ink/45">
          {isPrev ? "You're at the start." : "You're at the end."}
        </p>
      </div>
    );
  }

  const href = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}/${neighbour.slug}`;
  const padded = neighbour.lesson_number
    ? String(neighbour.lesson_number).padStart(2, "0")
    : null;

  return (
    <Link
      href={href}
      className={`group/nav flex flex-col gap-3 rounded-lg border border-ink/10 bg-snow p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--subject-accent)] ${alignClass}`}
    >
      <span className="font-mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-ink/55">
        {isPrev && <Icon className="h-3 w-3" aria-hidden="true" />}
        {label}
        {!isPrev && <Icon className="h-3 w-3" aria-hidden="true" />}
      </span>
      {padded && (
        <p
          className="font-mono text-xs uppercase tracking-[0.2em]"
          style={{ color: "var(--subject-accent)" }}
        >
          Lesson {padded}
        </p>
      )}
      <p className="font-display text-base font-medium leading-snug tracking-tight">
        {neighbour.title}
      </p>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// COMING SOON VARIANT
// ---------------------------------------------------------------------------

function ComingSoonLesson({
  course,
  lesson,
  subject,
  subjectSlug,
  pathwaySlug,
  courseSlug,
}: {
  course: CourseWithRelations;
  lesson: LessonForPage;
  subject: Subject;
  subjectSlug: string;
  pathwaySlug: string;
  courseSlug: string;
}) {
  const paddedNumber = lesson.lesson_number
    ? String(lesson.lesson_number).padStart(2, "0")
    : null;
  const pathway = PATHWAY_COPY[pathwaySlug as keyof typeof PATHWAY_COPY];

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10 sm:py-24">
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
              {
                label: "Lessons",
                href: `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}/lessons`,
              },
              { label: lesson.title },
            ]}
          />

          <div className="mt-14 text-center">
            {paddedNumber && (
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
                Lesson {paddedNumber}
              </p>
            )}
            <h1 className="font-display mt-6 text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              {lesson.title}.
            </h1>
            {lesson.description && (
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink/70">
                {lesson.description}
              </p>
            )}
          </div>

          <div className="mt-12 rounded-lg border border-ink/10 bg-snow p-10 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-flask">
              Coming soon
            </p>
            <p className="font-display mt-5 text-2xl font-medium tracking-tight">
              We&apos;re organising this lesson now.
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-ink/65">
              Drop your email and we&apos;ll let you know the moment it goes live.
            </p>

            <form
              method="post"
              action="#"
              className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="you@school.com"
                className="font-sans h-10 flex-1 rounded-md border border-ink/15 bg-parchment px-3 text-sm text-ink placeholder:text-ink/40 focus-visible:border-flask focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flask/30"
              />
              <button
                type="submit"
                disabled
                className="font-sans h-10 rounded-md bg-flask px-5 text-sm font-medium text-snow opacity-70"
                title="Email capture wiring coming in a later session"
              >
                Notify me
              </button>
            </form>
            <p className="font-mono mt-4 text-[10px] uppercase tracking-[0.2em] text-ink/40">
              Form wiring coming in a later session
            </p>
          </div>

          <div className="mt-12 flex justify-center">
            <Link
              href={`/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}/lessons`}
              className="inline-flex items-center gap-2 rounded-md border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-[var(--subject-accent)] hover:bg-ink/[0.04]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to lessons
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
