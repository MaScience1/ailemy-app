import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Hourglass, Timer, Wand2 } from "lucide-react";

import { Breadcrumb } from "@/components/catalogue/breadcrumb";
import { ExamUnavailable } from "@/components/exam/ExamUnavailable";
import { StartExamButton } from "@/components/exam/StartExamButton";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseBySubjectPathwayAndSlug,
  getPastPaperByCourseAndSlug,
  getSubjectBySlug,
} from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import { findOpenAttempt } from "@/lib/exam/attempts";
import { getPaperExamMeta } from "@/lib/exam/paper-exam-meta";
import { createClient } from "@/lib/supabase/server";

import { createAttemptAction } from "../actions";

/**
 * The front door for both sit modes. They are at different stages, so this file
 * branches rather than pretending they are the same:
 *
 *   exam      BUILT. A start/resume screen. Creating an attempt is an explicit
 *             click, never a side effect of loading this page — otherwise a
 *             refresh, a back button or a link preflight would each start a new
 *             sitting. The player itself lives at ../../attempt/[attemptId].
 *
 *   practice  NOT BUILT. Keeps the honest placeholder: it does not fake a
 *             loading state or imply the feature is a moment away.
 *
 * Both still validate the mode, 404 on an unknown one, and 404 for a paper with
 * nothing seeded — so neither URL can be shared into a dead end.
 */

const MODES = {
  exam: {
    name: "Exam mode",
    // NOT "Timed · no help" — there is no timer yet, and the bullet list on
    // this very screen says so. An eyebrow that contradicts the page is worse
    // than a plain one.
    eyebrow: "Answer · submit",
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
  if (mode === "exam") {
    return {
      title: "Exam mode · Ailemy",
      description:
        "Answer every question in the paper and submit. Your answers save as you type.",
      robots: { index: false, follow: false },
    };
  }
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

  const config = MODES[mode];
  const Icon = config.icon;
  const pathway = PATHWAY_COPY[pathwaySlug];
  const courseHref = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}`;
  const paperHref = `${courseHref}/papers/${paperSlug}`;

  // ⚠ `unavailable` BEFORE `hasQuestions`, always. They used to be the same
  // all-zero shape, so a failed count 404'd a paper that is live and fully
  // seeded — a claim about the data made on the strength of an outage.
  if (examMeta.unavailable) {
    return (
      <div style={getSubjectThemeStyle(subject)}>
        <ExamUnavailable
          title="We couldn't check this paper"
          message="Something went wrong looking up which questions are ready to sit, so this isn't being shown — the paper itself is fine."
          backHref={paperHref}
        />
      </div>
    );
  }
  if (!examMeta.hasQuestions) notFound();

  // ── EXAM MODE IS BUILT ──────────────────────────────────────────────────
  // Practice mode falls through to the placeholder below, unchanged.
  if (mode === "exam") {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    // Sitting a paper writes rows owned by a user, so there has to be one.
    // Signed-out visitors get a sign-in prompt rather than a failing button.
    const open = user ? await findOpenAttempt(paper.id, "exam") : null;

    // ⚠ A LOOKUP FAILURE MUST NOT BECOME "no attempt in progress". That is
    // what this used to do, and the screen would then offer "Start the paper"
    // — creating a SECOND attempt at a sitting the student was midway
    // through, leaving the first stranded. Refusing to render the button is
    // the only safe answer when we cannot tell.
    if (open && !open.ok) {
      return (
        <div style={getSubjectThemeStyle(subject)}>
          <ExamUnavailable
            title="We couldn't check your progress"
            message="Something went wrong looking up whether you already have this paper in progress, so we're not offering to start it — that could have left you with two sittings."
            backHref={paperHref}
          />
        </div>
      );
    }
    const openAttemptId = open?.ok ? open.data : null;

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

              <p className="font-mono mt-7 text-[10px] uppercase tracking-[0.25em] text-ink/50">
                {config.eyebrow}
              </p>
              <h1 className="font-display mt-2 text-3xl font-medium leading-[1.1] tracking-tight sm:text-5xl">
                {paper.paper_name}
              </h1>

              <dl className="font-mono mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.18em] text-ink/55">
                <div>
                  <dt className="sr-only">Questions</dt>
                  <dd>
                    {examMeta.answerableCount} question
                    {examMeta.answerableCount === 1 ? "" : "s"}
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Marks</dt>
                  <dd>
                    {examMeta.seededMarks} mark
                    {examMeta.seededMarks === 1 ? "" : "s"}
                    {examMeta.isPartial && examMeta.paperTotalMarks !== null && (
                      <span className="text-ink/40">
                        {" "}
                        of {examMeta.paperTotalMarks}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {/* Honest about what this is NOT yet, before they commit time. */}
              <ul className="mt-8 space-y-2.5">
                {[
                  "Your answers save as you type and survive a refresh",
                  "There is no timer yet — take as long as you like",
                  "Nothing is marked yet; submitting records that you're done",
                  "Some question types can't be answered on screen yet and are marked as such",
                ].map((item) => (
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

              <div className="mt-9 border-t border-ink/10 pt-7">
                {!user ? (
                  <>
                    <p className="text-sm leading-relaxed text-ink/65">
                      Sitting a paper saves your answers to your account, so
                      you&apos;ll need to sign in first.
                    </p>
                    <Link
                      href={`/login?next=${encodeURIComponent(`${paperHref}/interactive/sit/exam`)}`}
                      className="font-mono mt-4 inline-flex items-center gap-2 rounded-md border border-ink/15 bg-signal px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-ink transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      Sign in to start
                    </Link>
                  </>
                ) : openAttemptId ? (
                  <>
                    <p className="text-sm leading-relaxed text-ink/65">
                      You already have this paper open. Pick up where you left
                      off — starting again would leave the first one behind.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link
                        href={`${paperHref}/interactive/attempt/${openAttemptId}`}
                        className="font-mono inline-flex items-center gap-2 rounded-md border border-ink/15 bg-signal px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-ink transition-all hover:-translate-y-0.5 hover:shadow-md"
                      >
                        Resume
                      </Link>
                      <StartExamButton
                        paperId={paper.id}
                        attemptHrefBase={`${paperHref}/interactive/attempt`}
                        onCreate={createAttemptAction}
                        label="Start again"
                      />
                    </div>
                  </>
                ) : (
                  <StartExamButton
                    paperId={paper.id}
                    attemptHrefBase={`${paperHref}/interactive/attempt`}
                    onCreate={createAttemptAction}
                  />
                )}
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
            </div>
          </div>
        </main>
      </div>
    );
  }

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
