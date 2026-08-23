import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { getSubjectBySlug } from "@/lib/catalogue/queries";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";
import { loadSubjectTree } from "@/lib/qualifications/tree";
import { CourseSelector } from "@/components/resources/CourseSelector";

/**
 * Resources → subject: which course, asked one decision at a time.
 *
 * ============================================================================
 * ⚠ THIS PAGE USED TO BE A FLAT GRID OF EVERY COURSE IN THE SUBJECT
 * ============================================================================
 * Fourteen Chemistry cards — GCSE, IGCSE, UK A-Level, IAL AS, IAL A2, IB SL,
 * IB HL, AP — all the same size, in one alphabetical wall. It mixed academic
 * level, UK vs international, exam board and course stage into a single
 * choice, and required the student to know Ailemy's catalogue to find their
 * own course in it.
 *
 * CourseSelector asks Level → Qualification → Board → Course instead, skipping
 * any step that has only one answer. The catalogue keeps its complexity; the
 * student is asked one question at a time.
 *
 * ⚠ EVERY COURSE URL IS UNCHANGED (§37). This is a discovery-layer change:
 * /resources/<subject>/<course> is still where a course lives, still linked,
 * still deep-linkable. Nothing moved, so nothing needed a redirect.
 *
 * ⚠ NO TUITION COMPONENT MOUNTS HERE (§40). See the landing page header.
 */

type Params = Promise<{ subject: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject: slug } = await params;
  const subject = await getSubjectBySlug(slug);
  if (!subject) return { title: "Not found · Ailemy" };
  return {
    title: `${subject.name} resources · Ailemy`,
    description: `Lessons, notes, flashcards, questions and past papers for ${subject.name}.`,
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
export default async function SubjectResourcesPage({ params }: { params: Params }) {
  const session = await getNavSession();
  const { subject: slug } = await params;
  const subject = await getSubjectBySlug(slug);
  if (!subject) notFound();

  const tree = await loadSubjectTree(slug);
  const colour = subjectColour(slug);
  const hasCourses = tree.levels.length > 0 || tree.other.length > 0;

  return (
    <div style={subjectVars(colour)}>
      <>
      <SiteNav session={session} />
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10 sm:py-14">
          <Breadcrumb
            crumbs={[
              { label: "Resources", href: "/resources" },
              { label: subject.name },
            ]}
          />

          <header className="mt-10 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--subject-text)]">
              {subject.name}
            </p>
            <h1 className="font-display mt-4 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
              {subject.name} resources.
            </h1>
          </header>

          {/* ⚠ A FAILED READ IS SAID OUT LOUD, NEVER RENDERED AS "no courses".
              An empty catalogue and an unreadable one look identical in a
              grid, and this codebase has shipped that confusion before. */}
          {tree.error && (
            <p role="alert" className="mt-8 rounded-lg border border-ink/15 bg-snow px-4 py-3 text-sm text-ink/75">
              Some course information could not be loaded — {tree.error}
            </p>
          )}

          {!hasCourses && !tree.error ? (
            /* §50 — useful, not blank. */
            <div className="mt-8 rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] px-5 py-4">
              <p className="text-sm text-ink/70">
                No {subject.name} courses are in the catalogue yet.
              </p>
              <p className="mt-2 text-sm">
                <Link href="/resources" className="underline underline-offset-4 hover:text-ink">
                  Browse another subject →
                </Link>
              </p>
            </div>
          ) : (
            <div className="mt-9">
              <CourseSelector subject={slug} subjectName={subject.name} tree={tree} />
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
    </div>
  );
}
