import Link from "next/link";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { Editable } from "@/components/admin-inline/Editable";
import { NewPageSlot } from "@/components/admin-inline/page-slots";

type SubjectCardProps = {
  title: string;
  lines: string[];
  accentClass: string;
  /** Destination subject hub in the catalogue, e.g. /learn/chemistry. */
  href: string;
};

function SubjectCard({
  title,
  lines,
  accentClass,
  href,
  copyId,
}: SubjectCardProps & { copyId: string }) {
  return (
    <Link
      href={href}
      className="group flex cursor-pointer flex-col rounded-lg border border-ink/10 bg-snow p-8 transition-all duration-200 ease-out hover:translate-y-[-2px] hover:border-ink/25 hover:shadow-md sm:p-10"
    >
      <div
        className={`h-0.5 w-10 ${accentClass} transition-all duration-300 ease-out group-hover:w-16`}
        aria-hidden="true"
      />
      <h3 className="font-display mt-6 text-2xl font-medium tracking-tight">
        <Editable id={`${copyId}.title`} default={title} />
      </h3>
      <div className="mt-5 space-y-1 text-sm leading-relaxed text-ink/70">
        {lines.map((line, i) => (
          <p key={line}>
            <Editable id={`${copyId}.line.${i}`} default={line} />
          </p>
        ))}
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="bg-parchment text-ink">
      <SiteNav />

      {/*
        Single-column hero. min-h is a fixed 640px rather than a viewport
        fraction so the fold does not move with browser chrome.

        The vertical rhythm below (mt-10/mt-8/mt-12/mt-8) is the pre-artefact
        spacing. It had been tightened on mobile only to keep the top of the
        artefact slot above the fold; with the slot gone that constraint no
        longer applies, so the original rhythm is restored.
      */}
      <section className="flex min-h-[640px] items-center">
        <div className="animate-fade-in mx-auto w-full max-w-7xl px-6 py-10 sm:px-10 sm:py-12">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
            EDEXCEL IAL <span className="text-signal/70">·</span> CHEMISTRY AS
          </p>

          <h1 className="font-display mt-10 max-w-[760px] text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
            <Editable
              id="home.hero.title"
              default="Learn how the marks are awarded."
            />
          </h1>

          <p className="mt-8 max-w-[620px] text-lg leading-[1.65] text-ink/70">
            <Editable
              id="home.hero.subtitle"
              default="Every specification point, taught and marked to the Edexcel mark scheme."
            />
          </p>

          {/* Stacks full-width below md, side-by-side from md up. */}
          <div className="mt-12 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <Link
              href="/past-papers"
              className="inline-flex w-full items-center justify-center rounded-md bg-signal px-6 py-3 font-medium text-ink transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-signal/90 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink md:w-auto"
            >
              <Editable
                id="home.hero.cta.primary"
                default="Watch a paper walkthrough →"
              />
            </Link>
            <Link
              href="/intensive"
              className="inline-flex w-full items-center justify-center rounded-md border border-ink/15 bg-transparent px-6 py-3 font-medium text-ink transition-all duration-200 ease-out hover:border-ink/40 hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink md:w-auto"
            >
              <Editable
                id="home.hero.cta.secondary"
                default="See the 12-week intensive →"
              />
            </Link>
          </div>

          <NewPageSlot />

          <p className="mt-8 max-w-[520px] text-sm leading-relaxed text-ink/55">
            <Editable
              id="home.hero.footnote"
              default="Written by a Chemistry teacher — 8 years' experience, PGCE, examiner-level mark scheme knowledge."
            />
          </p>
        </div>
      </section>

      <section id="subjects" className="border-t border-ink/10">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28">
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            <SubjectCard
              title="Chemistry"
              lines={[
                "Real exam walkthroughs.",
                "Spec-point lessons.",
                "AI tutoring.",
              ]}
              accentClass="bg-subject-chem-as"
              href="/learn/chemistry"
              copyId="home.subject.chemistry"
            />
            <SubjectCard
              title="Biology"
              lines={[
                "Processes made visible.",
                "Memory + understanding.",
                "Exam mastery.",
              ]}
              accentClass="bg-subject-bio-as"
              href="/learn/biology"
              copyId="home.subject.biology"
            />
            <SubjectCard
              title="Physics"
              lines={[
                "Visual explanations.",
                "Vector intuition.",
                "Problem solving.",
              ]}
              accentClass="bg-subject-physics-as"
              href="/learn/physics"
              copyId="home.subject.physics"
            />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
