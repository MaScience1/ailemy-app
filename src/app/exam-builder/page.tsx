import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { getNavSession } from "@/lib/auth/nav-session";

/**
 * /exam-builder — a real page for a product that is not built yet.
 *
 * ============================================================================
 * ⚠ WHY THIS PAGE EXISTS AT ALL, AND WHAT IT REFUSES TO DO
 * ============================================================================
 * Exam Builder occupies a primary navigation slot because the brief asks for
 * it as a flagship destination. The engine does not exist. Those two facts
 * meet here, and the resolution is that this page is HONEST and USEFUL rather
 * than a mockup:
 *
 *   · it says plainly that it is not built yet, above the fold, in the first
 *     sentence a student reads;
 *   · it explains what it will do, so the nav slot means something;
 *   · it hands over two things that work TODAY — lesson practice and past
 *     papers — so nobody arrives and leaves with nothing.
 *
 * What it must never grow, until the engine is real:
 *   · a "Build my exam" button that does nothing
 *   · selectors that look operable and are not
 *   · a question count, a topic count, or any figure implying inventory
 *
 * Every one of those would be a working-looking product that isn't, which is
 * the failure this codebase has spent five builds removing.
 */

export const metadata: Metadata = {
  title: "Exam Builder — Ailemy",
  description:
    "Build practice exams around the topics, difficulty and question styles you need. In development — lesson practice and past papers are available now.",
};

export default async function ExamBuilderPage() {
  const session = await getNavSession();

  return (
    <>
      <SiteNav session={session} />
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-4xl px-6 py-12 sm:px-10 sm:py-16">
          <header className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/50">
              Exam Builder
            </p>
            <h1 className="font-display mt-4 text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
              Build an exam around what you need to practise.
            </h1>

            {/* ⚠ THE HONEST SENTENCE COMES FIRST, NOT IN A FOOTNOTE. A student
                should know what they have arrived at before they read the
                pitch, not after. */}
            <p className="mt-6 rounded-lg border border-ink/15 bg-snow px-5 py-4 text-base leading-relaxed text-ink/80">
              <span className="font-medium text-ink">This is not built yet.</span> It is the
              next thing being built, and there is nothing to try on this page today. What
              already works is below.
            </p>
          </header>

          <section className="mt-12" aria-labelledby="what-it-will-do">
            <h2 id="what-it-will-do" className="font-display text-2xl font-medium tracking-tight">
              What it will do
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/70">
              Choose a subject and course, then narrow it down to the topics you are weakest
              on. Pick the kinds of question you want — multiple choice, short answer,
              calculations, longer written answers — how hard they should be, how much maths
              you want in them, and how long the paper should take. Ailemy assembles a paper
              from that and marks it the same way it marks a past paper.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink/70">
              It is different from browsing questions: you describe the practice you need and
              get a paper built for it, rather than picking questions one at a time.
            </p>
          </section>

          {/* ── what actually works today ─────────────────────────────────── */}
          <section className="mt-12" aria-labelledby="available-now">
            <h2 id="available-now" className="font-display text-2xl font-medium tracking-tight">
              Available now
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/70">
              Both of these do part of what Exam Builder will do, and both work today.
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              <li>
                <Link
                  href="/past-papers"
                  className="flex h-full flex-col justify-between gap-4 rounded-xl border border-ink/10 bg-snow p-5 transition-all duration-300 hover:border-ink/30 motion-safe:hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                      Real exam papers
                    </p>
                    <h3 className="font-display mt-2 text-xl font-medium tracking-tight">
                      Past Papers
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/70">
                      Sit a real paper, get it marked, and see where the marks went.
                    </p>
                  </div>
                  <p className="text-sm font-medium text-ink">Browse past papers →</p>
                </Link>
              </li>
              <li>
                <Link
                  href="/resources"
                  className="flex h-full flex-col justify-between gap-4 rounded-xl border border-ink/10 bg-snow p-5 transition-all duration-300 hover:border-ink/30 motion-safe:hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                      Targeted practice
                    </p>
                    <h3 className="font-display mt-2 text-xl font-medium tracking-tight">
                      Lesson practice
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/70">
                      Every published lesson generates a fresh set of questions on its own
                      content, marked instantly.
                    </p>
                  </div>
                  <p className="text-sm font-medium text-ink">Find a lesson →</p>
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
