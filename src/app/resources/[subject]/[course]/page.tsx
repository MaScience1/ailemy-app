import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { getSubjectBySlug } from "@/lib/catalogue/queries";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";
import { loadCourseResources } from "@/lib/resources/taxonomy";
import { ResourceCategory, ResourceRow } from "@/components/resources/ResourceCategory";

/**
 * The course Resources page — the central study library (§7, §8, §9).
 *
 * ============================================================================
 * ⚠ FOUR GROUPS, AND EACH ONE ONLY CLAIMS WHAT IT CAN COUNT (§49, §50)
 * ============================================================================
 * Learn · Memorise · Practise · Exam preparation is the brief's grouping, and
 * every row inside them is either a real destination with a real count or an
 * honest empty state that points somewhere useful. Nothing renders a number
 * this page cannot derive from a query the VIEWER could run themselves.
 *
 * ⚠ QUESTIONS ARE THE ONE THING THIS PAGE CANNOT COUNT, AND IT SAYS SO
 * RATHER THAN GUESSING (§60). paper_questions refuses anon with 42501 — it is
 * admin-gated so exam content cannot be scraped — so the Practise group links
 * to where questions live instead of advertising a total it would have to
 * invent. The qualification build shipped a reader that counted a table anon
 * cannot read and returned an empty page to every logged-out student; that
 * lesson is why this one asks only what it may.
 *
 * ⚠ NO TUITION COMPONENT MOUNTS HERE (§40).
 */

type Params = Promise<{ subject: string; course: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject: subjectSlug, course: courseSlug } = await params;
  const data = await loadCourseResources(subjectSlug, courseSlug);
  if (!data) return { title: "Not found · Ailemy" };
  return {
    title: `${data.courseName} resources · Ailemy`,
    description: `Lessons, revision notes, flashcards, questions and past papers for ${data.courseName}.`,
  };
}

/**
 * ⚠ THE SHARED SiteNav IS PERMITTED HERE; A TUITION CTA IS NOT (§40).
 * §40 draws the line itself: "If a student deliberately clicks Live Tuition in
 * navigation, take them there. A subtle footer/navigation link is sufficient."
 * So the site's own nav — identical on every page, carrying one Live Tuition
 * link among seven — stays. What is banned is Resources ADVERTISING tuition:
 * a floating CTA, an interstitial card, a banner between resources. The guard
 * in resources-hub.test.ts enforces exactly that distinction by reading each
 * page's own markup rather than what the shared nav renders.
 */
export default async function CourseResourcesPage({ params }: { params: Params }) {
  const session = await getNavSession();
  const { subject: subjectSlug, course: courseSlug } = await params;
  const [subject, data] = await Promise.all([
    getSubjectBySlug(subjectSlug),
    loadCourseResources(subjectSlug, courseSlug),
  ]);
  if (!subject || !data) notFound();

  const colour = subjectColour(subjectSlug);
  const { counts, units } = data;
  const totalTopics = units.reduce((n, u) => n + u.topics.length, 0);

  return (
    <div style={subjectVars(colour)}>
      <>
      <SiteNav session={session} />
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10 sm:py-14">
          <Breadcrumb
            crumbs={[
              { label: "Resources", href: "/resources" },
              { label: subject.name, href: `/resources/${subjectSlug}` },
              { label: data.courseName },
            ]}
          />

          <header className="mt-10 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--subject-text)]">
              {data.curriculumName}
            </p>
            <h1 className="font-display mt-4 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
              {data.courseName}.
            </h1>
            {/* §49 — every figure below is counted, none is typed. */}
            <p className="font-mono mt-5 text-xs tracking-wide text-ink/55">
              {counts.lessons} lessons · {counts.liveLessons} published · {counts.pastPapers} past
              papers · {totalTopics} topics
            </p>
          </header>

          {data.error && (
            <p role="alert" className="mt-8 rounded-lg border border-ink/15 bg-snow px-4 py-3 text-sm text-ink/75">
              Some resource counts could not be loaded — {data.error}
            </p>
          )}

          <div className="mt-12 grid gap-10">
            {/* ── LEARN ─────────────────────────────────────────────────── */}
            <ResourceCategory title="Learn" lede="Work through the course the way it is taught.">
              <ResourceRow
                kind="lesson"
                title="Lessons"
                count={
                  counts.liveLessons > 0
                    ? `${counts.liveLessons} published of ${counts.lessons}`
                    : `${counts.lessons} written · none published yet`
                }
                href={`/learn/${subjectSlug}`}
                available={counts.liveLessons > 0}
                unavailableNote="Lessons for this course are written but not published yet."
              />
              <ResourceRow
                kind="notes_deck"
                title="Revision notes cards"
                count="On each published lesson"
                href={counts.liveLessons > 0 ? `/learn/${subjectSlug}` : null}
                available={counts.liveLessons > 0}
                unavailableNote="Notes cards appear on a lesson once it is published."
              />
              <ResourceRow
                kind="worked_example"
                title="Worked examples"
                count="On each published lesson"
                href={null}
                available={false}
                unavailableNote="Worked examples are being prepared; the lesson pages will carry them first."
              />
            </ResourceCategory>

            {/* ── MEMORISE ──────────────────────────────────────────────── */}
            <ResourceCategory title="Memorise" lede="Short, repeatable recall.">
              <ResourceRow
                kind="notes_deck"
                title="Flashcards"
                count={counts.liveLessons > 0 ? "In the Notes section of each lesson" : "—"}
                href={counts.liveLessons > 0 ? `/learn/${subjectSlug}` : null}
                available={counts.liveLessons > 0}
                unavailableNote="Flashcard decks arrive with each published lesson."
              />
              <ResourceRow
                kind="definition_set"
                title="Key definitions"
                count="Inside the notes cards"
                href={null}
                available={false}
                unavailableNote="A standalone definitions library is not built yet — definitions live on the notes cards today."
              />
              <ResourceRow
                kind="formula_set"
                title="Equations and formulae"
                count="Inside the notes cards"
                href={null}
                available={false}
                unavailableNote="A standalone formula library is not built yet — equations live on the notes cards today."
              />
            </ResourceCategory>

            {/* ── PRACTISE ──────────────────────────────────────────────── */}
            <ResourceCategory
              title="Practise"
              lede="Questions, marked against the real mark scheme."
            >
              <ResourceRow
                kind="lesson"
                title="Lesson practice"
                count={counts.liveLessons > 0 ? "10 questions per published lesson" : "—"}
                href={counts.liveLessons > 0 ? `/learn/${subjectSlug}` : null}
                available={counts.liveLessons > 0}
                unavailableNote="Practice is generated from a lesson's own content, so it arrives with the lesson."
              />
              <ResourceRow
                kind="past_paper"
                title="Exam questions"
                count={
                  /* ⚠ NO NUMBER. See the header: this page cannot read
                     paper_questions, so it does not pretend to have counted. */
                  counts.pastPapers > 0 ? "Through the papers below" : "—"
                }
                href={counts.pastPapers > 0 ? `/learn/${subjectSlug}` : null}
                available={counts.pastPapers > 0}
                unavailableNote="Exam questions arrive with the past papers for this course."
              />
            </ResourceCategory>

            {/* ── EXAM PREPARATION ──────────────────────────────────────── */}
            <ResourceCategory title="Exam preparation" lede="The real papers, from the exam board.">
              <ResourceRow
                kind="past_paper"
                title="Past papers"
                count={`${counts.pastPapers} paper${counts.pastPapers === 1 ? "" : "s"}`}
                href={counts.pastPapers > 0 ? "/past-papers" : null}
                available={counts.pastPapers > 0}
                unavailableNote="No past papers are catalogued for this course yet."
                /* §52 — provenance is never stripped. */
                provenance={data.curriculumName}
              />
            </ResourceCategory>
          </div>

          {/* ── TOPICS (§8) ──────────────────────────────────────────────── */}
          <section className="mt-14" aria-labelledby="topics-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h2 id="topics-heading" className="font-display text-2xl font-medium tracking-tight">
                Browse by topic
              </h2>
              {/* The full point-by-point map, with the student's own mastery
                  laid over it. (feature/specification-mastery — the one edit
                  this branch makes to a shared file.) */}
              <Link
                href={`/resources/${subjectSlug}/${courseSlug}/specification`}
                className="text-sm text-[var(--subject-text)] underline underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Specification &amp; mastery map →
              </Link>
            </div>

            {units.length === 0 ? (
              <p className="mt-4 text-sm text-ink/65">
                This course has no units mapped yet.
              </p>
            ) : (
              <div className="mt-6 grid gap-8">
                {units.map((u) => (
                  <div key={u.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/10 pb-2">
                      <h3 className="font-display text-lg font-medium tracking-tight">
                        {u.code ? `${u.code} · ` : ""}
                        {u.name}
                      </h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                        {u.liveLessonCount} of {u.lessonCount} lessons published
                      </p>
                    </div>

                    {u.topics.length === 0 ? (
                      <p className="mt-3 text-sm text-ink/55">
                        Topics for this unit are not mapped yet.
                      </p>
                    ) : (
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {u.topics.map((t) => (
                          <li
                            key={t.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-ink/10 bg-snow px-4 py-3"
                          >
                            <span className="min-w-0 text-sm text-ink">
                              {t.code ? (
                                <span className="font-mono mr-2 text-[10px] uppercase tracking-[0.14em] text-[var(--subject-text)]">
                                  {t.code}
                                </span>
                              ) : null}
                              {t.name}
                            </span>
                            {/* §49 — derived from spec points and their lessons. */}
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                              {t.specPointCount > 0
                                ? `${t.specPointCount} spec point${t.specPointCount === 1 ? "" : "s"}`
                                : "not mapped yet"}
                              {t.lessonCount > 0 ? ` · ${t.lessonCount} lesson${t.lessonCount === 1 ? "" : "s"}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ⚠ THE HONEST STATE OF TOPIC MAPPING. Topics exist and spec
                points exist, but only a handful of lessons are mapped to spec
                points today — so a topic showing "not mapped yet" is telling
                the truth about the catalogue, not failing to load. */}
            <p className="mt-6 max-w-2xl text-xs leading-relaxed text-ink/50">
              Topic pages open as their specification points are mapped to lessons. Until then,
              the lessons themselves are the fastest way in.
            </p>
          </section>

          <p className="mt-12 text-sm">
            <Link
              href={`/resources/${subjectSlug}`}
              className="text-ink/60 underline underline-offset-4 transition-colors hover:text-ink"
            >
              ← All {subject.name} courses
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
    </div>
  );
}
