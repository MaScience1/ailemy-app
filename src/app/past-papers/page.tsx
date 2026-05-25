import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import {
  getPastPapersHubData,
  type HubCourseEntry,
  type HubSubjectSection,
} from "@/lib/catalogue/queries";
import {
  deriveStatus,
  getStatusBadge,
} from "@/lib/catalogue/status";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Past Exam Papers · IB, IGCSE, A-Level · Ailemy",
  description:
    "Free past papers for Edexcel IAL, IGCSE, AQA, OCR, CIE, IB and more. Download PDFs, attempt interactively with our whiteboard, plus examiner walkthrough videos.",
};

export default async function PastPapersHubPage() {
  const data = await getPastPapersHubData();

  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
          <Breadcrumb crumbs={[{ label: "Past Papers" }]} />

          <header className="mt-10 max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/60">
              Exam Archive
            </p>
            <h1 className="font-display mt-5 text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
              Past papers.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
              Free past papers for international curricula. Download PDFs,
              attempt interactively with our whiteboard, and watch examiner
              walkthroughs.
            </p>
            <p className="font-mono mt-6 text-xs uppercase tracking-[0.2em] text-ink/55">
              {data.totalPapers}{" "}
              {data.totalPapers === 1 ? "paper" : "papers"} across{" "}
              {data.curriculaWithPapers}{" "}
              {data.curriculaWithPapers === 1 ? "curriculum" : "curricula"}
            </p>
          </header>

          <div className="mt-16 space-y-20">
            {data.subjects.length === 0 ? (
              <EmptyArchive />
            ) : (
              data.subjects.map((subject) => (
                <SubjectSection key={subject.id} subject={subject} />
              ))
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SubjectSection({ subject }: { subject: HubSubjectSection }) {
  const themeStyle = getSubjectThemeStyle({
    slug: subject.slug,
    color_as: subject.colorAs,
    color_a2: subject.colorA2,
  });

  return (
    <section style={themeStyle} aria-labelledby={`subject-${subject.slug}`}>
      <div className="border-b border-ink/10 pb-5">
        {/* Full-width 4px subject-accent stripe above the heading */}
        <span
          aria-hidden="true"
          className="block h-1 w-full rounded-full"
          style={{ backgroundColor: "var(--subject-accent)" }}
        />
        <h2
          id={`subject-${subject.slug}`}
          className="font-display mt-5 text-3xl font-medium tracking-tight md:text-4xl"
        >
          {subject.name}
        </h2>
        <p className="font-mono mt-3 text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {subject.totalPapers}{" "}
          {subject.totalPapers === 1 ? "paper" : "papers"} across{" "}
          {subject.courseCount}{" "}
          {subject.courseCount === 1 ? "course" : "courses"}
        </p>
      </div>

      {subject.courses.length === 0 ? (
        <EmptySubject subjectName={subject.name} />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {subject.courses.map((course) => (
            <li key={course.id}>
              <CoursePapersCard course={course} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CoursePapersCard({ course }: { course: HubCourseEntry }) {
  const status = deriveStatus({
    // Counts collapse cleanly into the entity-status helper: a course with
    // ≥1 paper is "available", everything else is "coming_soon". Past papers
    // don't have a preview state — they're either uploaded or not.
    totalLessons: course.paperCount,
    liveLessons: course.paperCount,
  });
  const badge = getStatusBadge(status);
  const isAvailable = status === "available";
  const href = `/learn/${course.subjectSlug}/${course.pathway}/${course.slug}/exam-questions`;

  const cardClass = cn(
    "group/papers flex h-full flex-col gap-5 rounded-lg border border-ink/10 bg-snow p-6 transition-all duration-200 ease-out sm:p-7",
    isAvailable
      ? "cursor-pointer hover:translate-y-[-2px] hover:border-[var(--subject-accent)] hover:shadow-sm"
      : "cursor-not-allowed opacity-70",
  );

  const Body = (
    <>
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            {course.boardName} · {course.level}
          </p>
          <span
            className={cn(
              "font-mono inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]",
              badge.className,
            )}
          >
            {badge.label}
          </span>
        </div>
        <h3 className="font-display mt-5 text-xl font-medium leading-snug tracking-tight">
          {course.name}
        </h3>
        <p className="font-mono mt-4 text-[10px] uppercase tracking-[0.2em] text-ink/45">
          {isAvailable
            ? `${course.paperCount} ${course.paperCount === 1 ? "paper" : "papers"}`
            : "Papers coming soon"}
        </p>
      </div>

      <div className="mt-auto pt-1 text-sm font-medium">
        {isAvailable ? (
          <span
            className="inline-flex items-center gap-2 transition-transform duration-200 group-hover/papers:translate-x-1"
            style={{ color: "var(--subject-accent)" }}
          >
            Browse papers
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
            NOT YET OPEN
          </span>
        )}
      </div>
    </>
  );

  if (!isAvailable) {
    return (
      <div className={cardClass} aria-disabled="true">
        {Body}
      </div>
    );
  }

  return (
    <Link href={href} className={cardClass}>
      {Body}
    </Link>
  );
}

function EmptySubject({ subjectName }: { subjectName: string }) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-ink/15 bg-snow/50 p-8 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink/55">
        Coming soon
      </p>
      <p className="mt-3 text-sm text-ink/65">
        No {subjectName} courses are open yet. Check back as the catalogue
        grows.
      </p>
    </div>
  );
}

function EmptyArchive() {
  return (
    <div className="rounded-xl border border-ink/10 bg-snow p-10 text-center">
      <p className="font-display text-2xl font-medium tracking-tight">
        The archive is still being built.
      </p>
      <p className="mt-3 text-sm text-ink/65">
        Past papers will land here as we add them — by subject, by board, by
        year.
      </p>
    </div>
  );
}
