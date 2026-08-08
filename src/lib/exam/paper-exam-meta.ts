import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Is this paper actually sittable, and how big is it?
 *
 * ============================================================================
 * WHY THIS IS A SHARED FUNCTION AND NOT A useEffect IN THE MODE SCREEN
 * ============================================================================
 * Three surfaces need this same answer and must agree on it:
 *
 *   1. the web mode-selection screen (today)
 *   2. the exam player, which must refuse to start a paper with no questions
 *   3. the mobile app, which will ask the same question over its own transport
 *
 * If the count lived in the React component, (2) and (3) would each grow their
 * own copy of "what counts as seeded" and the three would drift — the same
 * reason validateQuestionSet lives in question-set.ts rather than inside the
 * seed importer. One rule, one place.
 *
 * ============================================================================
 * ⚠ THIS USES THE SERVICE-ROLE CLIENT, AND THAT IS A DELIBERATE ESCALATION
 * ============================================================================
 * /learn is a public surface. The catalogue layer reads it with the standard
 * SSR client, which for a logged-out visitor is the Postgres `anon` role — and
 * migration 0028 granted `anon` NOTHING on paper_questions. Verified live: an
 * anon-key SELECT returns 42501 permission denied, at the grant layer, before
 * RLS is even consulted.
 *
 * So the SSR client cannot answer this question. It would not error visibly
 * either — it would return an error object that a naive caller reads as "no
 * questions", and every logged-out student would be told this paper has no
 * interactive mode. That is the worst possible failure: silent, plausible, and
 * wrong for the majority of visitors.
 *
 * The escalation is therefore narrow and its shape matters:
 *
 *   • This module returns ONLY AGGREGATES — a boolean and two integers. No
 *     question text, no mark scheme, no criteria, no examiner commentary.
 *     Nothing here can leak content that RLS is protecting; the mark-scheme
 *     boundary in 0028 is untouched and unreachable from this file.
 *   • `import "server-only"` at the top, inherited from admin.ts, makes the
 *     build FAIL if this is ever pulled into a client bundle. The mode screen
 *     must stay a Server Component, and this is what enforces that rather than
 *     a comment asking nicely.
 *   • "how many questions does this public paper have" is catalogue metadata
 *     of the same kind the page already shows (session, year, total marks). It
 *     is not privileged information.
 *
 * THE ALTERNATIVE, if you would rather not escalate: grant `anon` SELECT on
 * paper_questions in a migration. That is a bigger decision than it looks —
 * it publishes question_text to the open internet for every live paper — so it
 * is deliberately not taken here.
 */
export type PaperExamMeta = {
  /** True when at least one paper_questions row exists for this paper. */
  hasQuestions: boolean;
  /**
   * Every seeded row, containers included. This is the honest "how much of
   * this paper is modelled" number.
   */
  questionCount: number;
  /**
   * Answerable questions only — rows with no children. Containers hold a stem
   * and 0 marks, so counting them would tell a student they face 17 questions
   * when 10 of them are things to answer.
   */
  answerableCount: number;
  /**
   * Marks a student can actually earn from what is seeded, i.e. the sum over
   * leaves. NOT past_papers.total_marks, which is what the whole paper is
   * worth — the two differ whenever a paper is partially seeded, and WCH11/01
   * is: 25 seeded of 80.
   */
  seededMarks: number;
  /** past_papers.total_marks — the printed total. Null if unrecorded. */
  paperTotalMarks: number | null;
  /**
   * True when the seeded questions do not cover the whole paper. Drives the
   * "partial paper" disclosure on the mode screen: a student sitting 25 of 80
   * marks must be told so before they start, not discover it at question 11.
   */
  isPartial: boolean;
  /**
   * True when we could not find out. NOT the same as "this paper has nothing
   * seeded", and the difference is the whole reason this field exists.
   *
   * The failure branch used to return the same all-zero shape as an unseeded
   * paper, so a database outage told every visitor the paper had no
   * interactive mode — and the sit route, which guards on `hasQuestions`,
   * turned it into a 404 for a paper that is live and fully seeded. A failure
   * presented as a fact about the data, which is exactly what it is not.
   *
   * Callers MUST branch on this BEFORE branching on `hasQuestions`.
   */
  unavailable: boolean;
};

type QuestionRow = {
  id: string;
  parent_question_id: string | null;
  marks: number | null;
};

/**
 * The answer for a paper with nothing seeded.
 *
 * It is NO LONGER also the failure result — that was the bug. The two shapes
 * were identical, so nothing downstream could tell "nothing here" from "we
 * couldn't look". The failure branch now sets `unavailable: true`.
 */
const EMPTY: PaperExamMeta = {
  hasQuestions: false,
  questionCount: 0,
  answerableCount: 0,
  seededMarks: 0,
  paperTotalMarks: null,
  isPartial: false,
  unavailable: false,
};

/**
 * @param paperId `past_papers.id` — the UUID, never the slug. A slug is unique
 *   only within a course; two subjects already share "unit-1-january-2019".
 */
export async function getPaperExamMeta(
  paperId: string,
  /**
   * `past_papers.total_marks`, passed in because every caller has already
   * loaded the paper row. Re-fetching it here would be a second round trip for
   * a value the caller is holding.
   */
  paperTotalMarks: number | null = null,
): Promise<PaperExamMeta> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("paper_questions")
    .select("id, parent_question_id, marks")
    .eq("paper_id", paperId);

  if (error) {
    // Still does not throw — the downloads and the walkthrough on the paper
    // page work perfectly well without this, and a failed count must not take
    // the page down with it. But it no longer returns the SAME shape as an
    // unseeded paper: `unavailable` is what lets the interactive routes say
    // "we couldn't check" instead of "there is nothing here", and stops the
    // sit route 404ing a paper that is live and seeded.
    console.error(
      `[getPaperExamMeta] count failed for paper ${paperId}: ${error.code ?? "?"}: ${error.message}`,
    );
    return { ...EMPTY, paperTotalMarks, unavailable: true };
  }

  const rows = (data ?? []) as QuestionRow[];
  if (rows.length === 0) return { ...EMPTY, paperTotalMarks };

  // A row is a container if any other row names it as parent. Containers carry
  // the stem and 0 marks; the leaves carry the tariff. Summing every row would
  // work today only because containers are constrained to 0 — leaning on that
  // would silently double every total the day a container gets marks of its
  // own, so the leaf set is computed rather than assumed.
  const parentIds = new Set(
    rows.map((r) => r.parent_question_id).filter((id): id is string => id !== null),
  );
  const leaves = rows.filter((r) => !parentIds.has(r.id));
  const seededMarks = leaves.reduce((sum, r) => sum + (r.marks ?? 0), 0);

  return {
    hasQuestions: true,
    questionCount: rows.length,
    answerableCount: leaves.length,
    seededMarks,
    paperTotalMarks,
    isPartial: paperTotalMarks !== null && seededMarks < paperTotalMarks,
    unavailable: false,
  };
}
