import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";
import { Editable } from "@/components/admin-inline/Editable";

/**
 * PUBLIC marketing page for the Chemistry AS exam intensive.
 *
 * Deliberately OUTSIDE the (gated) route group, so no enrolment check runs and
 * a logged-out visitor can read it — this is the page the homepage CTA points
 * at. The cohort content itself lives at /intensive/dashboard inside (gated),
 * where the enrolment gate in (gated)/layout.tsx still applies unchanged.
 *
 * Follows the marketing conventions of / and /past-papers (SiteNav + SiteFooter,
 * parchment/ink, font-display) rather than the ai-* utilities used by the
 * sign-in screen, since this page is entered from the homepage and should read
 * as part of the same surface.
 *
 * All copy is <Editable>, so it can be revised inline in edit mode without a
 * deploy; the strings below are the fallback defaults.
 */

export const metadata: Metadata = {
  title: "Chemistry AS Exam Intensive · Ailemy",
  description:
    "A twelve-week Edexcel IAL Chemistry AS intensive: every specification point taught, and every answer marked against the real mark scheme.",
};

export default async function IntensiveMarketingPage() {
  const session = await getNavSession();

  return (
    <div className="bg-parchment text-ink">
      <SiteNav session={session} />

      <section className="flex min-h-[70vh] items-center">
        <div className="animate-fade-in mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
            CHEMISTRY AS <span className="text-signal/70">·</span> 12-WEEK
            INTENSIVE
          </p>

          <h1 className="font-display mt-10 max-w-[760px] text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
            <Editable
              id="intensive.hero.title"
              default="Twelve weeks. Every answer marked by hand."
            />
          </h1>

          <p className="mt-8 max-w-[620px] text-lg leading-[1.65] text-ink/70">
            <Editable
              id="intensive.hero.subtitle"
              default="A guided run through Edexcel IAL Chemistry AS — one specification point at a time, with your written answers marked against the real mark scheme."
            />
          </p>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/intensive/sign-in"
              className="inline-flex items-center justify-center rounded-md bg-signal px-6 py-3 font-medium text-ink transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-signal/90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              <Editable
                id="intensive.hero.cta.primary"
                default="Sign in to the cohort →"
              />
            </Link>
            <Link
              href="/past-papers"
              className="inline-flex items-center justify-center rounded-md border border-ink/15 bg-transparent px-6 py-3 font-medium text-ink transition-all duration-200 ease-out hover:border-ink/40 hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              <Editable
                id="intensive.hero.cta.secondary"
                default="See a paper walkthrough first"
              />
            </Link>
          </div>

          <p className="mt-8 max-w-[520px] text-sm leading-relaxed text-ink/55">
            <Editable
              id="intensive.hero.footnote"
              default="Already enrolled? Signing in takes you straight to your cohort."
            />
          </p>
        </div>
      </section>

      <section className="border-t border-ink/10">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28">
          <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
            <Editable
              id="intensive.included.title"
              default="What the twelve weeks cover."
            />
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3 md:gap-8">
            <IncludedCard
              copyId="intensive.included.spec"
              title="Every specification point"
              body="Worked through in order, so nothing is left to revise blind the week before the exam."
            />
            <IncludedCard
              copyId="intensive.included.marking"
              title="Answers marked by hand"
              body="You write, you submit, it comes back annotated against the mark scheme the examiner actually uses."
            />
            <IncludedCard
              copyId="intensive.included.papers"
              title="Full paper walkthroughs"
              body="Whole past papers taken apart question by question, showing where the marks are won and dropped."
            />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function IncludedCard({
  copyId,
  title,
  body,
}: {
  copyId: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-ink/10 bg-snow p-8 sm:p-10">
      <div
        className="h-0.5 w-10 bg-subject-chem-as"
        aria-hidden="true"
      />
      <h3 className="font-display mt-6 text-2xl font-medium tracking-tight">
        <Editable id={`${copyId}.title`} default={title} />
      </h3>
      <p className="mt-5 text-sm leading-relaxed text-ink/70">
        <Editable id={`${copyId}.body`} default={body} />
      </p>
    </div>
  );
}
