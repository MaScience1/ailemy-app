import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Clock } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { StatusBadge } from "@/components/catalogue/status-badge";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseBySubjectPathwayAndSlug,
  getLessonByCourseAndSlug,
  getSubjectBySlug,
  listLessonsForCourse,
} from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import type {
  CourseWithRelations,
  LessonForPage,
  LessonNeighbour,
  Subject,
} from "@/lib/catalogue/types";
import { InlineEditBoundary } from "@/components/admin-inline/InlineEditBoundary";
import { LessonEditBarSlot } from "@/components/admin-inline/slots";
import { LessonExamQuestions } from "@/components/lesson/LessonExamQuestions";
import { LessonNotes } from "@/components/lesson/LessonNotes";
import { LessonOutro } from "@/components/lesson/LessonOutro";
import { LessonPractice } from "@/components/lesson/LessonPractice";
import { LessonJourney, LessonProgressProvider } from "@/components/lesson/LessonProgress";
import { LessonSection, SectionUnavailable } from "@/components/lesson/LessonSectionShell";
import { LessonSlides } from "@/components/lesson/LessonSlides";
import { LessonWorkedExamples } from "@/components/lesson/LessonWorkedExamples";
import { LessonVideo } from "@/components/lesson/LessonVideo";
import type { PlayerFrame } from "@/components/lesson/LessonPlayer";
import { TuitionCta } from "@/components/tuition/TuitionCta";
import { flattenFrames } from "@/lib/lesson-deck/manifest.ts";
import { frameUrl, loadPublishedDeck } from "@/lib/lesson-deck/store.ts";
import { readCompletion } from "@/lib/lesson/completion";
import {
  loadLessonExamQuestions,
  loadLessonNotes,
  loadWorkedExamples,
} from "@/lib/lesson/content";
import type { LessonSectionKey } from "@/lib/lesson/sections.ts";
import { createClient } from "@/lib/supabase/server";

/**
 * ⚠ THE WATERMARK IS THE SIGNED-IN ADDRESS (§7), AND ANONYMOUS IS A REAL CASE.
 * Returning null (not "") matters: the player renders the plain "Ailemy" mark
 * for a null and appends the identifier for a string. The previous code passed
 * "" for anonymous viewers, which is falsy, so the anonymous watermark
 * silently disappeared while the comment claimed it was there.
 */
async function deckWatermark(): Promise<string | null> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  return user?.email ?? null;
}

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

  // The boundary self-gates: for a student it renders children untouched and
  // pulls in no client module at all.
  const wrap = (node: React.ReactNode) => (
    <InlineEditBoundary
      kind="lesson"
      courseId={course.id}
      lessonIds={[lesson.id]}
    >
      {node}
    </InlineEditBoundary>
  );

  // Coming-soon lessons get the placeholder variant — different shape,
  // different intent. Only render the full lesson page for live content.
  if (lesson.status !== "live") {
    return wrap(
      <ComingSoonLesson
        course={course}
        lesson={lesson}
        subject={subject}
        subjectSlug={subjectSlug}
        pathwaySlug={pathwaySlug}
        courseSlug={courseSlug}
      />,
    );
  }

  /**
   * ⚠ ONE LIST GIVES POSITION, TOTAL AND NEIGHBOURS — AND FIXES A REAL BUG.
   * ==========================================================================
   * getLessonNeighbours() had no `.neq("status","archived")` while
   * listLessonsForCourse() does, so Previous/Next could offer a lesson the
   * course index deliberately hides — the 2026-08-22 reflow archived two rows
   * whose content was merged elsewhere, and prev/next walked straight back
   * into them. Deriving both from the SAME list the index renders means the
   * sequence a student walks is by construction the sequence they were shown.
   *
   * It also supplies §62's "Lesson N of M" honestly: M is the number of
   * lessons actually in this course's teaching order, counted, never typed.
   */
  const siblings = await listLessonsForCourse(course.id);
  const position = siblings.findIndex((l) => l.slug === lesson.slug);
  const prev = position > 0 ? siblings[position - 1] : null;
  const next = position >= 0 && position < siblings.length - 1 ? siblings[position + 1] : null;

  return wrap(
    <LiveLesson
      course={course}
      lesson={lesson}
      subject={subject}
      subjectSlug={subjectSlug}
      pathwaySlug={pathwaySlug}
      courseSlug={courseSlug}
      prev={prev ? { slug: prev.slug, title: prev.title, lesson_number: prev.lesson_number } : null}
      next={next ? { slug: next.slug, title: next.title, lesson_number: next.lesson_number } : null}
      position={position >= 0 ? position + 1 : null}
      courseLessonCount={siblings.length}
      coursePublishedCount={siblings.filter((l) => l.status === "live").length}
    />,
  );
}

// ---------------------------------------------------------------------------
// LIVE LESSON VARIANT
// ---------------------------------------------------------------------------

async function LiveLesson({
  course,
  lesson,
  subject,
  subjectSlug,
  pathwaySlug,
  courseSlug,
  prev,
  next,
  position,
  courseLessonCount,
  coursePublishedCount,
}: {
  course: CourseWithRelations;
  lesson: LessonForPage;
  subject: Subject;
  subjectSlug: string;
  pathwaySlug: string;
  courseSlug: string;
  prev: LessonNeighbour | null;
  next: LessonNeighbour | null;
  position: number | null;
  courseLessonCount: number;
  coursePublishedCount: number;
}) {
  const paddedNumber = lesson.lesson_number
    ? String(lesson.lesson_number).padStart(2, "0")
    : null;
  const pathway = PATHWAY_COPY[pathwaySlug as keyof typeof PATHWAY_COPY];

  /**
   * ⚠ PRESENCE IS DECIDED HERE, ONCE, FOR ALL SIX SECTIONS (§89, §R4).
   * ==========================================================================
   * Practice and the video used to be CHILDREN of the deck section, which
   * returned null whenever the deck manifest failed to load. One unreadable
   * manifest therefore removed the player, the practice and the video
   * placeholder together, silently — a lesson that looked finished and did
   * nothing. Each section now loads its own content and is mounted
   * independently; a missing one shrinks to a compact honest line (§90) and
   * takes nothing else with it.
   *
   * The four loads run together — they are independent reads and the page
   * already makes more round-trips than it should.
   */
  const [deck, notes, examples, examQuestions, completion] = await Promise.all([
    loadPublishedDeck(lesson.deck_path),
    loadLessonNotes(lesson.id),
    loadWorkedExamples(lesson.id),
    loadLessonExamQuestions(lesson.id),
    readCompletion(lesson.id),
  ]);

  const watermark = await deckWatermark();

  const frames: PlayerFrame[] = deck.available
    ? flattenFrames(deck.manifest).map((f) => ({
        index: f.index,
        slideN: f.slideN,
        step: f.step,
        stepCount: f.stepCount,
        url: frameUrl(deck, f.path),
        buildLabel: f.buildLabel,
      }))
    : [];

  // §76 — the FIRST slide carrying each spec chip, from the deck's own detection.
  const specTargets: { code: string; slideN: number }[] = [];
  if (deck.available) {
    for (const s of deck.manifest.slides) {
      for (const code of s.specCodes) {
        if (!specTargets.some((t) => t.code === code)) specTargets.push({ code, slideN: s.n });
      }
    }
    specTargets.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }

  /**
   * ⚠ THE DENOMINATOR IS WHAT THIS LESSON HAS (§89). A lesson with no video and
   * no exam questions is complete at 4/4 — not stuck at 4/6 forever, waiting
   * for content nobody has written. Practice is present whenever the lesson has
   * a deck, because practice is generated from the deck's own content.
   */
  const present: LessonSectionKey[] = [];
  if (lesson.voice_video_mux_id) present.push("video");
  if (deck.available) present.push("slides");
  if (notes.available) present.push("notes");
  if (examples.available) present.push("worked_examples");
  if (deck.available) present.push("practice");
  if (examQuestions.available) present.push("exam_questions");

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-10 sm:py-16">
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

            <LessonEditBarSlot id={lesson.id} title={lesson.title} />

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

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              {lesson.estimated_duration_minutes != null && (
                <p className="font-mono inline-flex items-center gap-1.5 text-xs tracking-wide text-ink/55">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {lesson.estimated_duration_minutes} min
                </p>
              )}
              {/* ⚠ §62 — BOTH NUMBERS ARE COUNTED, AND THE SECOND ONE MATTERS.
                  "Lesson 1 of 81" is true of the course's teaching order and
                  matches the index the student just came from — but 80 of
                  those 81 are not written yet, so the figure alone advertises
                  a course that does not exist. Where the two differ, both are
                  shown; where every lesson is published, the qualifier
                  disappears rather than stating the obvious. */}
              {position !== null && courseLessonCount > 0 && (
                <p className="font-mono text-xs tracking-wide text-ink/55">
                  Lesson {position} of {courseLessonCount}
                  {coursePublishedCount < courseLessonCount && (
                    <span className="text-ink/40">
                      {" "}· {coursePublishedCount} published so far
                    </span>
                  )}
                </p>
              )}
            </div>
          </header>

          <LessonProgressProvider
            lessonId={lesson.id}
            lessonSlug={lesson.slug}
            present={present}
            initialStates={completion.states}
            initialStore={completion.store}
            initialReason={completion.reason}
          >
            {/* §29 — mobile keeps a compact scrollable stepper, not a second
                sticky bar competing with the tuition CTA for the same space. */}
            <LessonJourney variant="strip" />

            <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
              <div className="grid min-w-0 gap-14">
                {/* ── 1 · WATCH ─────────────────────────────────────────── */}
                <LessonSection
                  section="video"
                  title="Lesson video"
                  completable={Boolean(lesson.voice_video_mux_id)}
                >
                  {lesson.voice_video_mux_id ? (
                    <LessonVideo
                      playbackId={lesson.voice_video_mux_id}
                      title={lesson.title}
                      lessonSlug={lesson.slug}
                    />
                  ) : (
                    /* ⚠ COMPACT, NOT A 16:9 BLACK HOLE (§5). A full-bleed
                       "video coming soon" was the largest thing on a lesson
                       whose actual teaching — the deck below — is finished. */
                    <SectionUnavailable
                      what="No video for this lesson yet."
                      next={
                        deck.available
                          ? "The interactive slides below teach the whole lesson."
                          : undefined
                      }
                    />
                  )}
                </LessonSection>

                {/* ── 2 · LEARN ─────────────────────────────────────────── */}
                <LessonSection
                  section="slides"
                  title="Interactive lesson slides"
                  meta={deck.available ? `${deck.manifest.slideCount} slides` : undefined}
                  completable={deck.available}
                >
                  {deck.available ? (
                    <LessonSlides
                      lessonSlug={lesson.slug}
                      version={deck.manifest.version}
                      frames={frames}
                      slideCount={deck.manifest.slideCount}
                      watermark={watermark}
                      specTargets={specTargets}
                    />
                  ) : (
                    /* ⚠ A SET-BUT-UNLOADABLE deck_path USED TO RENDER NOTHING
                       AT ALL — no player, no message. The student saw a gap
                       and the page looked finished. It now says so. */
                    <SectionUnavailable
                      what={
                        lesson.deck_path
                          ? "These slides could not be loaded just now."
                          : "Interactive slides are not published for this lesson yet."
                      }
                      next={lesson.deck_path ? "Reloading the page usually fixes it." : undefined}
                    />
                  )}
                </LessonSection>

                {/* ── 3 + 4 · CONSOLIDATE and UNDERSTAND, side by side (§10, §74) */}
                <div className="grid gap-10 xl:grid-cols-2">
                  <LessonSection section="notes" completable={notes.available}>
                    {notes.available ? (
                      <LessonNotes body={notes.body} lessonSlug={lesson.slug} />
                    ) : (
                      <SectionUnavailable what={notes.reason} />
                    )}
                  </LessonSection>

                  <LessonSection
                    section="worked_examples"
                    meta={examples.available ? `${examples.examples.length} examples` : undefined}
                    completable={examples.available}
                  >
                    {examples.available ? (
                      <LessonWorkedExamples examples={examples.examples} lessonSlug={lesson.slug} />
                    ) : (
                      <SectionUnavailable what={examples.reason} />
                    )}
                  </LessonSection>
                </div>

                {/* ── 5 + 6 · CHECK and APPLY (§16) ─────────────────────── */}
                <div className={examQuestions.available ? "grid gap-10 xl:grid-cols-2" : "grid gap-10"}>
                  <LessonSection
                    section="practice"
                    title="Check your understanding"
                    completable={deck.available}
                  >
                    {deck.available ? (
                      <LessonPractice lessonSlug={lesson.slug} />
                    ) : (
                      <SectionUnavailable what="Practice questions come from this lesson's slides, which are not published yet." />
                    )}
                  </LessonSection>

                  <LessonSection
                    section="exam_questions"
                    completable={examQuestions.available}
                  >
                    {examQuestions.available ? (
                      <LessonExamQuestions questions={examQuestions.questions} lessonSlug={lesson.slug} />
                    ) : (
                      /* ⚠ SCHEMA-BLOCKED, AND POINTED SOMEWHERE REAL. The
                         lesson→question mapping is a parked migration; the
                         course's exam papers exist and work today, so the
                         empty state sends the student there rather than
                         spending their attention on "coming soon". */
                      <SectionUnavailable
                        what={examQuestions.reason}
                        next={
                          <Link
                            href={`/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}/exam-questions`}
                            className="underline underline-offset-4 transition-colors hover:text-ink"
                          >
                            Browse this course&rsquo;s exam papers →
                          </Link>
                        }
                      />
                    )}
                  </LessonSection>
                </div>

                {lesson.description && (
                  <section>
                    <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
                      About this lesson
                    </h2>
                    <p className="mt-4 max-w-3xl text-base leading-[1.7] text-ink/80">
                      {lesson.description}
                    </p>
                  </section>
                )}

                {lesson.summary_md && (
                  <section>
                    <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
                      Summary
                    </h2>
                    <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-[1.7] text-ink/80">
                      {lesson.summary_md}
                    </p>
                  </section>
                )}

                {/* §31, §66 — the honest close: what is done, what is left. */}
                <LessonOutro
                  nextHref={
                    next
                      ? `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}/${next.slug}`
                      : null
                  }
                  nextTitle={next?.title ?? null}
                  nextNumber={next?.lesson_number ?? null}
                />
              </div>

              <aside className="space-y-5 lg:sticky lg:top-10 lg:self-start">
                {/* §24, §28 — the journey rail follows the student down the page. */}
                <LessonJourney />

                <div className="flex items-center gap-2 pt-2">
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
          </LessonProgressProvider>

          <PrevNextNav
            subjectSlug={subjectSlug}
            pathwaySlug={pathwaySlug}
            courseSlug={courseSlug}
            prev={prev}
            next={next}
          />
        </div>

        {/* ⚠ §42, §71 — ONE STICKY THING AT THE BOTTOM, NOT TWO. The lesson
            already has a bottom-anchored element on mobile: the journey strip
            is sticky at the TOP, deliberately, so these two never fight for
            the same edge. targetId is left at its default and this page has no
            #tuition section, so the CTA navigates rather than scrolling to
            nothing. */}
        <TuitionCta subject={subject.slug} revealAfter={400} />
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

          <LessonEditBarSlot id={lesson.id} title={lesson.title} />

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
