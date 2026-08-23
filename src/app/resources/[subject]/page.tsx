import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { getSubjectBySlug } from "@/lib/catalogue/queries";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";
import { listCoursesForSubject } from "@/lib/resources/taxonomy";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";

/**
 * Resources → subject: which course, from the courses that really exist.
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

  const courses = await listCoursesForSubject(slug);
  const colour = subjectColour(slug);

  // ⚠ ORDERED BY WHAT A STUDENT CAN ACTUALLY USE. A course with published
  // lessons is more useful than one without, and saying so with order is
  // honest where a "recommended" badge would be a claim.
  const sorted = [...courses].sort(
    (a, b) => b.liveLessons - a.liveLessons || a.name.localeCompare(b.name),
  );

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
            <p className="font-mono mt-5 text-xs uppercase tracking-[0.2em] text-ink/55">
              Choose your course
            </p>
          </header>

          {sorted.length === 0 ? (
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
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {sorted.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/resources/${slug}/${c.slug}`}
                    className="flex h-full flex-col justify-between gap-4 rounded-xl border border-ink/10 bg-snow p-5 transition-all duration-300 hover:border-[var(--subject-accent)] motion-safe:hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                        {c.curriculumName}
                        {c.pathway && isPathway(c.pathway) ? ` · ${PATHWAY_COPY[c.pathway].name}` : ""}
                      </p>
                      <h2 className="font-display mt-2 text-xl font-medium tracking-tight">{c.name}</h2>
                    </div>
                    {/* §49 — a real count, or nothing. */}
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                      {c.liveLessons > 0
                        ? `${c.liveLessons} published lesson${c.liveLessons === 1 ? "" : "s"}`
                        : "Curriculum mapped · lessons in preparation"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
    </div>
  );
}
