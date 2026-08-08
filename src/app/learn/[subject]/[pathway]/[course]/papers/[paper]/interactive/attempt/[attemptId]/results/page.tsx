import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ExamUnavailable } from "@/components/exam/ExamUnavailable";
import { ResultsView } from "@/components/exam/ResultsView";
import { isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseBySubjectPathwayAndSlug,
  getPastPaperByCourseAndSlug,
  getSubjectBySlug,
} from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import { getAttemptForPlayer } from "@/lib/exam/attempts";
import { claudeMarker } from "@/lib/exam/ai-marker";
import { markAttempt } from "@/lib/exam/marking";

/**
 * The marked paper.
 *
 * Marking runs HERE, on the server, on load — not on submit. Three reasons:
 * a submit that has to wait for marking is a submit that can time out; marking
 * is idempotent (marking_results upserts, awarded_marks is overwritten) so a
 * refresh corrects rather than duplicates; and re-marking after the AI marker
 * is switched on needs no migration, just a reload.
 *
 * markAttempt proves ownership through the student's own session BEFORE it
 * touches the service-role client, so an attempt id in this URL cannot be used
 * to mark — or read — somebody else's paper.
 */
export const metadata: Metadata = {
  title: "Your marked paper · Ailemy",
  robots: { index: false, follow: false },
};

type Params = Promise<{
  subject: string;
  pathway: string;
  course: string;
  paper: string;
  attemptId: string;
}>;

export default async function ResultsPage({ params }: { params: Params }) {
  const {
    subject: subjectSlug,
    pathway: pathwaySlug,
    course: courseSlug,
    paper: paperSlug,
    attemptId,
  } = await params;

  if (!isPathway(pathwaySlug)) notFound();
  const subject = await getSubjectBySlug(subjectSlug);
  if (!subject) notFound();
  const course = await getCourseBySubjectPathwayAndSlug(subjectSlug, pathwaySlug, courseSlug);
  if (!course) notFound();
  const paper = await getPastPaperByCourseAndSlug(course.id, paperSlug);
  if (!paper) notFound();

  const paperHref = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}/papers/${paperSlug}`;

  const lookup = await getAttemptForPlayer(attemptId);
  if (!lookup.ok) {
    if (lookup.reason === "not_found") notFound();
    return (
      <div style={getSubjectThemeStyle(subject)}>
        <ExamUnavailable
          title="We couldn't load your marked paper"
          message="Something went wrong reading this sitting, so no marks are being shown — rather than showing you a total we can't stand behind."
          backHref={paperHref}
        />
      </div>
    );
  }
  const attempt = lookup.data;
  if (attempt.paperId !== paper.id) notFound();

  // An unsubmitted attempt has no results — send them back to finish it,
  // rather than showing a page of zeros that reads like a bad score.
  if (!attempt.submittedAt) {
    redirect(`${paperHref}/interactive/attempt/${attemptId}`);
  }

  // Tier 2 is wired here and nowhere else — one explicit argument, so the
  // marker in use is visible at the call site rather than buried in an import.
  const result = await markAttempt(attemptId, claudeMarker);
  // NOT notFound(). Ownership was already proved above, so a failure here is
  // ours — a database read that errored, not a paper that does not exist. A
  // 404 would tell the student their submitted work is gone.
  if (!result.ok) {
    return (
      <div style={getSubjectThemeStyle(subject)}>
        <ExamUnavailable
          title="Your paper couldn't be marked"
          message={result.error}
          backHref={paperHref}
        />
      </div>
    );
  }

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <ResultsView
        summary={result.data}
        paperTitle={paper.paper_name}
        paperCode={paper.paper_code}
        paperHref={paperHref}
        submittedAt={attempt.submittedAt}
      />
    </div>
  );
}
