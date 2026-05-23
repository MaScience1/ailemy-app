import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { StatusBadge } from "@/components/catalogue/status-badge";
import { listSubjects, type SubjectWithAvailability } from "@/lib/catalogue/queries";
import { getSubjectCopy } from "@/lib/catalogue/subject-descriptions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Choose your subject · Ailemy",
  description:
    "Spec-led science learning for IB, IGCSE and A-Level students. Start with Chemistry.",
};

export default async function LearnPage() {
  const subjects = await listSubjects();

  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
        <Breadcrumb crumbs={[{ label: "Learn" }]} />

        <header className="mt-10 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
            Catalogue
          </p>
          <h1 className="font-display mt-5 text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            Choose your subject.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
            Spec-led courses for IB, IGCSE and A-Level students. We&apos;re
            starting with Chemistry — Physics and Biology will follow.
          </p>
        </header>

        <section className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {subjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </section>
      </div>
    </main>
  );
}

function SubjectCard({ subject }: { subject: SubjectWithAvailability }) {
  const copy = getSubjectCopy(subject.slug);
  const available = subject.hasInProgressCourse;
  const href = `/learn/${subject.slug}`;

  const cardClass = cn(
    "group/card relative flex h-full flex-col justify-between gap-10 rounded-xl border border-ink/15 bg-ink p-8 text-parchment transition-all duration-300 ease-out sm:p-10",
    available
      ? "hover:-translate-y-1 hover:border-ink/40 hover:bg-ink"
      : "cursor-not-allowed opacity-60",
  );

  const Content = (
    <>
      <div>
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-parchment/55">
            Subject
          </p>
          <StatusBadge
            status={available ? "in_progress" : "coming_soon"}
            label={available ? "Available" : "Coming soon"}
            className={
              available
                ? "bg-signal text-ink"
                : "bg-snow/10 text-parchment/70"
            }
          />
        </div>

        <h2 className="font-display mt-8 text-3xl font-medium tracking-tight md:text-4xl">
          {subject.name}
        </h2>

        <p className="mt-4 text-sm leading-relaxed text-parchment/70">
          {copy.description}
        </p>

        {!available && copy.comingSoonNote && (
          <p className="mt-3 text-xs text-parchment/45">{copy.comingSoonNote}</p>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm font-medium">
        {available ? (
          <span className="inline-flex items-center gap-2 text-signal transition-transform duration-300 group-hover/card:translate-x-1">
            Explore courses
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-parchment/45">
            Not yet open
          </span>
        )}
      </div>
    </>
  );

  if (!available) {
    return (
      <div
        aria-disabled="true"
        className={cardClass}
        title={`${subject.name} — coming soon`}
      >
        {Content}
      </div>
    );
  }

  return (
    <Link href={href} className={cardClass}>
      {Content}
    </Link>
  );
}
