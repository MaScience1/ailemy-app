import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ExamPlayer } from "@/components/exam/ExamPlayer";
import { PATHWAY_COPY, isPathway } from "@/lib/catalogue/pathways";
import {
  getCourseBySubjectPathwayAndSlug,
  getPastPaperByCourseAndSlug,
  getSubjectBySlug,
} from "@/lib/catalogue/queries";
import { getSubjectThemeStyle } from "@/lib/catalogue/subject-theme";
import { ExamUnavailable } from "@/components/exam/ExamUnavailable";
import { getAttemptForPlayer } from "@/lib/exam/attempts";
import { getPaperPublicUrl } from "@/lib/storage/papers";

import {
  saveAnswerAction,
  setFlaggedAction,
  submitAttemptAction,
} from "../../sit/actions";

/**
 * The player, keyed by attempt.
 *
 * The attempt id is in the URL and that is fine: getAttemptForPlayer reads
 * through the caller's own session, so RLS returns nothing for an attempt that
 * is not theirs. Someone else's id in this URL is a 404, indistinguishable
 * from a typo — which is the correct amount to tell them.
 *
 * `noindex` because this is a private workspace with a per-attempt URL. Not a
 * security control — RLS is — but a crawled exam URL in a search index is
 * still not something to ship.
 */

export const metadata: Metadata = {
  title: "Sitting a paper · Ailemy",
  robots: { index: false, follow: false },
};

type Params = Promise<{
  subject: string;
  pathway: string;
  course: string;
  paper: string;
  attemptId: string;
}>;

export default async function AttemptPage({ params }: { params: Params }) {
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

  const course = await getCourseBySubjectPathwayAndSlug(
    subjectSlug,
    pathwaySlug,
    courseSlug,
  );
  if (!course) notFound();

  const paper = await getPastPaperByCourseAndSlug(course.id, paperSlug);
  if (!paper) notFound();

  const paperHref = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}/papers/${paperSlug}`;

  const lookup = await getAttemptForPlayer(attemptId);
  // `not_found` covers "no such attempt" and "not yours" identically — see the
  // note on getAttemptForPlayer for why they are not distinguished. An
  // `unavailable` is OURS, and must not be shown as either: a 404 here would
  // tell a student mid-exam that their sitting does not exist, and rendering a
  // partial attempt would show their saved answers as blank.
  if (!lookup.ok) {
    if (lookup.reason === "not_found") notFound();
    return (
      <div style={getSubjectThemeStyle(subject)}>
        <ExamUnavailable
          title="We couldn't open your paper"
          message="Something went wrong loading this sitting, so it isn't being shown — your answers are saved and are not affected."
          backHref={paperHref}
        />
      </div>
    );
  }
  const attempt = lookup.data;

  // An attempt id from a DIFFERENT paper would otherwise render this paper's
  // title over another paper's questions. Cheap to check, confusing to miss.
  if (attempt.paperId !== paper.id) notFound();

  // Practice mode has no player yet; an attempt created for it would land on a
  // half-built screen. Send it back to the placeholder that says so.
  if (attempt.mode !== "exam") {
    redirect(`${paperHref}/interactive/sit/practice`);
  }

  void PATHWAY_COPY[pathwaySlug];

  return (
    <div style={getSubjectThemeStyle(subject)}>
      <ExamPlayer
        attempt={attempt}
        paperHref={paperHref}
        paperTitle={paper.paper_name}
        paperCode={paper.paper_code}
        pdfUrl={getPaperPublicUrl(paper.paper_pdf_path)}
        onSave={saveAnswerAction}
        onFlag={setFlaggedAction}
        onSubmit={submitAttemptAction}
      />
    </div>
  );
}
