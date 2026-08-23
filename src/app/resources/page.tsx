import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";

import { SubjectCard } from "@/components/home/SubjectCard";
import { ResourceSearch } from "@/components/resources/ResourceSearch";
import { searchResources } from "@/lib/resources/search";
import { SUBJECTS } from "@/lib/public/catalogue";
import { loadSubjectHoldings, holdingsLabel, resourcesBlurb } from "@/lib/qualifications/tree";
import { subjectColour, subjectVars } from "@/lib/design/subject-colours";

/**
 * The Resources landing page (§4, §17).
 *
 * ============================================================================
 * ⚠ NO TUITION COMPONENT MOUNTS ANYWHERE UNDER /resources (§1, §40)
 * ============================================================================
 * This is a study environment, not a sales surface. There is no TuitionCta, no
 * interstitial card between resources, no floating "need help?" bar — and a
 * test fails the build if one appears on any /resources route, because the
 * rule is easy to break by accident six months from now when somebody mounts
 * a global CTA in a layout. Live Tuition stays reachable from the site nav,
 * which is enough.
 */

export const metadata: Metadata = {
  title: "Resources — Ailemy",
  description:
    "Lessons, revision notes, flashcards, exam questions and past papers, organised around what you actually study.",
};

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
/** One shape for a subject we could not count, used by both labels. */
const EMPTY_HOLDINGS = { liveLessons: 0, pastPapers: 0, error: null };

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getNavSession();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query.length >= 2 ? await searchResources(query) : null;
  /**
   * ⚠ §4 — WHAT THE LIBRARY HOLDS, NOT WHETHER A TUITION COHORT IS RUNNING.
   * SubjectCard's default eyebrow is the subject's TUITION status, so Biology
   * and Physics rendered "Register interest" above a card that opens a
   * resources listing. Here the eyebrow is counted from the shelves.
   */
  const holdings = await loadSubjectHoldings(SUBJECTS.map((s) => s.slug));

  return (
    <>
      <SiteNav session={session} />
      <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 sm:py-16">
        <header className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/50">Resources</p>
          <h1 className="font-display mt-4 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
            Everything you need to study science.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink/70">
            Lessons, revision notes, flashcards, exam questions and past papers — organised
            around what you actually study.
          </p>
        </header>

        {/* ⚠ §1 — mt-8 → mt-3. The search sat 32px below the supporting
            sentence, which read as a separate band rather than the next thing
            to do. 12px binds it to the copy above it without touching its
            size, shape or styling. */}
        <div className="mt-3 max-w-2xl">
          <Suspense fallback={<div className="h-[52px] rounded-full border border-ink/10 bg-snow" />}>
            <ResourceSearch />
          </Suspense>
        </div>

        {results ? (
          <SearchResults results={results} />
        ) : (
          <section className="mt-12" aria-labelledby="subjects-heading">
            <h2 id="subjects-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
              Choose your subject
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {SUBJECTS.map((s) => (
                <SubjectCard
                  key={s.slug}
                  subject={s}
                  href={`/resources/${s.slug}`}
                  ctaLabel="Browse resources"
                  eyebrow={holdingsLabel(holdings[s.slug] ?? EMPTY_HOLDINGS)}
                  blurb={resourcesBlurb(holdings[s.slug] ?? EMPTY_HOLDINGS)}
                  dataCta="resources_subject_opened"
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
      <SiteFooter />
    </>
  );
}

function SearchResults({ results }: { results: Awaited<ReturnType<typeof searchResources>> }) {
  if (results.error) {
    return (
      <p role="alert" className="mt-10 rounded-lg border border-ink/15 bg-snow px-4 py-3 text-sm text-ink/75">
        Search could not run just now — {results.error}
      </p>
    );
  }

  return (
    <section className="mt-10" aria-live="polite">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
        {results.hits.length} result{results.hits.length === 1 ? "" : "s"} for &ldquo;{results.query}&rdquo;
      </h2>

      {results.hits.length === 0 ? (
        /* §50 — an empty result says what to do next, not just "nothing". */
        <div className="mt-5 rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] px-5 py-4">
          <p className="text-sm text-ink/70">
            Nothing matched &ldquo;{results.query}&rdquo;.
          </p>
          <p className="mt-2 text-sm text-ink/60">
            Try a topic name — &ldquo;bonding&rdquo;, &ldquo;energetics&rdquo;, &ldquo;moles&rdquo; — or{" "}
            <Link href="/resources" className="underline underline-offset-4 hover:text-ink">
              browse by subject
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-2">
          {results.hits.map((hit, i) => {
            const colour = subjectColour(hit.subjectSlug);
            return (
              <li key={`${hit.kind}-${i}`} style={subjectVars(colour)}>
                <Link
                  href={hit.href}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-ink/10 bg-snow px-4 py-3 transition-colors hover:border-[var(--subject-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="min-w-0">
                    {/* ⚠ SUBJECT IS NAMED, NOT ONLY COLOURED (§57). */}
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--subject-text)]">
                      {hit.subjectSlug}
                    </span>
                    <span className="ml-2 text-sm text-ink">{hit.title}</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                    {hit.meta}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* ⚠ WHAT SEARCH DOES NOT COVER, SAID PLAINLY (§60). Exam question text
          is admin-gated, so a student must not conclude Ailemy has no
          questions on a topic because search found none. */}
      <p className="mt-5 text-xs leading-relaxed text-ink/50">
        Search covers lessons, topics, units and past papers. It does not search{" "}
        {results.notSearched.join(" or ")} — open a course to reach those.
      </p>
    </section>
  );
}
