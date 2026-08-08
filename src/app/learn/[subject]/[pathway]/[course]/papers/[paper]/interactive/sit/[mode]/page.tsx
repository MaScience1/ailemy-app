import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Hourglass, Timer, Wand2 } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseBySubjectPathwayAndSlug,
  getPastPaperByCourseAndSlug,
  getSubjectBySlug,
} from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import { getPaperExamMeta } from "@/lib/exam/paper-exam-meta";

/**
 * The exam player's front door — which is all it is, for now.
 *
 * This page exists so the routing skeleton is REAL: the mode screen links to
 * URLs that resolve, validate their mode, 404 on a bad one, and load the same
 * paper the player will load. Step 3 replaces the body of this file with the
 * player and changes nothing about how it is reached.
 *
 * It says plainly that it is not built. It does not fake a loading state, show
 * a disabled question, or imply the feature is a moment away — a placeholder
 * that pretends is worse than no link at all, because it costs the reader time
 * before it disappoints them.
 */

const MODES = {
  exam: {
    name: "Exam mode",
    eyebrow: "Timed · no help",
    icon: Timer,
    blurb:
      "The clock runs, the mark scheme stays shut, and everything is marked at the end — as close to the real thing as a screen gets.",
    building: [
      "A timer that matches the paper's own duration",
      "One question at a time, with the paper beside it",
      "Every answer marked against the examiner's own points",
      "A breakdown at the end showing which marks you earned and why",
    ],
  },
  practice: {
    name: "Practice mode",
    eyebrow: "Untimed · marked as you go",
    icon: Wand2,
    blurb:
      "No clock. Answer a question, get it marked, see the examiner's criteria behind it, then move on when you're ready.",
    building: [
      "Mark any answer the moment you finish it",
      "The examiner's own accept and reject rules, shown after you commit",
      "Examiner-report commentary on where candidates lost the mark",
      "Retry a question without losing what you wrote first",
    ],
  },
} as const;

type Mode = keyof typeof MODES;

function isMode(value: string): value is Mode {
  return value === "exam" || value === "practice";
}

type Params = Promise<{
  subject: string;
  pathway: string;
  course: string;
  paper: string;
  mode: string;
}>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { mode } = await params;
  if (!isMode(mode)) return { title: "Not found · Ailemy" };
  return {
    title: `${MODES[mode].name} — coming next · Ailemy`,
    description: `${MODES[mode].name} is being built. ${MODES[mode].blurb}`,
  };
}

export default async function SitModePage({ params }: { params: Params }) {
  const {
    subject: subjectSlug,
    pathway: pathwaySlug,
    course: courseSlug,
    paper: paperSlug,
    mode,
  } = await params;

  // An unknown mode is a 404, not a redirect to a default. Silently choosing a
  // mode for someone who asked for a different one is how a student ends up
  // timed when they meant to practise.
  if (!isMode(mode)) notFound();
  if (!isPathway(pathwaySlug)) notFound();

  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) notFound();

  const course = await getCourseBySubjectPathwayAndSlug(
    subjectSlug,
    pathwaySlug,
    courseSlug,
  );
  if (!course) notFound();

  const paper = await getPastPaperByCourseAndSlug(course.id, paperSlug);
  if (!paper) notFound();

  // Guard the route the way the player will have to. Reaching a sit mode for a
  // paper with nothing seeded is a 404 rather than an empty player — and it
  // means the URL cannot be shared into a dead end even though the mode screen
  // never offers it.
  const examMeta = await getPaperExamMeta(paper.id, paper.total_marks ?? null);
  if (!examMeta.hasQuestions) notFound();

  const config = MODES[mode];
  const Icon = config.icon;
  const pathway = PATHWAY_COPY[pathwaySlug];
  const courseHref = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}`;
  const paperHref = `${courseHref}/papers/${paperSlug}`;

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <main className="min-h-screen bg-parchment text-ink">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-10 sm:py-16">
          <Breadcrumb
            crumbs={[
              { label: "Learn", href: "/learn" },
              { label: subject.name, href: `/learn/${subject.slug}` },
              {
                label: pathway.name,
                href: `/learn/${subject.slug}/${pathwaySlug}`,
              },
              { label: course.name, href: courseHref },
              { label: paper.paper_name, href: paperHref },
              { label: config.name },
            ]}
          />

          <div className="mt-10 rounded-lg border border-ink/10 bg-snow p-7 sm:p-10">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-md"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--subject-accent) 12%, transparent)",
                  color: "var(--subject-accent)",
                }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-mono inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-parchment px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-ink/60">
                <Hourglass className="h-3 w-3" aria-hidden="true" />
                Coming next
              </span>
            </div>

            <p className="font-mono mt-7 text-[10px] uppercase tracking-[0.25em] text-ink/50">
              {config.eyebrow}
            </p>
            {/* One expression, not `{config.name} isn't built yet.` — JSX
                trims the leading space off a text node that runs to a newline,
                which silently rendered "Exam modeisn't built yet." */}
            <h1 className="font-display mt-2 text-3xl font-medium leading-[1.1] tracking-tight sm:text-5xl">
              {`${config.name} isn't built yet.`}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-ink/65">
              {config.blurb}
            </p>

            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
              What it will do
            </p>
            <ul className="mt-4 space-y-2.5">
              {config.building.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-sm leading-relaxed text-ink/70"
                >
                  <span
                    className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--subject-accent)" }}
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>

            {/* Proof the pipeline behind it is real, not a mock-up. These are
                counted live from the seeded rows for this exact paper. */}
            <div className="mt-9 border-t border-ink/10 pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">
                Ready for this paper
              </p>
              <p className="font-mono mt-2 text-sm text-ink/70">
                {examMeta.answerableCount} question
                {examMeta.answerableCount === 1 ? "" : "s"} ·{" "}
                {examMeta.seededMarks} mark
                {examMeta.seededMarks === 1 ? "" : "s"} seeded
                {examMeta.isPartial && examMeta.paperTotalMarks !== null && (
                  <span className="text-ink/45">
                    {" "}
                    of {examMeta.paperTotalMarks}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href={`${paperHref}/interactive`}
              className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Choose another mode
            </Link>
            <Link
              href={`${paperHref}/practice`}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55 transition-colors hover:text-ink"
            >
              Open the whiteboard instead
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
