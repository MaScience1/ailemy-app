import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { ResponsePayload } from "./attempts";
import {
  describeReconciliation,
  reconcileMarking,
  type MarkingReconciliation,
} from "./reconcile";
import {
  markMcq,
  markNumeric,
  tierFor,
  workingFrom,
  WORKING_UNDER_REVIEW,
  type DeterministicResult,
  type PointVerdict,
} from "./deterministic";

/**
 * The marking engine.
 *
 * ============================================================================
 * TWO TIERS, AND THE LINE BETWEEN THEM IS THE POINT
 * ============================================================================
 *   Tier 1  mcq, numeric, numeric_with_unit
 *           Pure comparison in ./deterministic.ts. Real marks.
 *           confidence = 'deterministic'.
 *
 *   Tier 2  short_text, long_text
 *           A model judges the answer against each criterion.
 *           PROVISIONAL marks. confidence = 'requires_review', ALWAYS.
 *
 *   Neither structure, graph, chemical_equation, mechanism, apparatus,
 *           freehand, other — no editor collected an answer, so there is
 *           nothing to mark and nothing is written.
 *
 * The tier is decided by answer_type on the server. A client cannot ask for
 * one tier or the other, because a client is never consulted.
 *
 * ============================================================================
 * ⚠ WHY THIS FILE USES THE SERVICE ROLE, AND WHY THAT IS NOT A LEAK
 * ============================================================================
 * Marking must read mark_scheme_items and write marking_results. 0028 gives a
 * student no policy that reaches either — deliberately — so marking cannot run
 * as the student, and it does not: every query here uses createAdminClient.
 *
 * That is safe only because of where this code runs and what it returns. It is
 * `server-only`, so the build fails if it is ever imported into a client
 * bundle. And NOTHING IT RETURNS CARRIES MARK-SCHEME TEXT: the caller receives
 * awarded counts and per-point evidence written for the student, never a
 * criterion, never an accept/reject rule, never the expected answer for a
 * question they got wrong. The mark scheme is read here and dies here.
 *
 * ⚠ Ownership is checked FIRST, through the student's own session, before the
 * admin client is touched at all. The service role bypasses RLS, so an
 * attempt id arriving from anywhere must be proven to belong to the caller
 * before any privileged read happens.
 */

// ============================================================================
// TIER 2 — NOT WIRED
// ============================================================================

/**
 * The model version recorded on every AI-marked result.
 *
 * It is stored so a mark can always be traced to what produced it: when the
 * marker changes, old results stay attributable to the old one rather than
 * silently inheriting the new one's reputation.
 */
export type { MarkingReconciliation } from "./reconcile";

export const MARKING_MODEL = "claude-opus-5";
export const PROMPT_VERSION = "wch11-marker-v1";

export type AiPointJudgement = {
  pointCode: string;
  awarded: boolean;
  /** One short sentence quoting what in the answer earned or missed it. */
  evidence: string;
};

/**
 * What the model is asked to judge. Assembled here so the shape is reviewable
 * without reading prompt-construction code, and so the reject rules are
 * structurally impossible to omit.
 */
export type AiMarkingRequest = {
  questionNumber: string;
  questionText: string | null;
  commandWord: string | null;
  maxMarks: number;
  studentAnswer: string;
  /**
   * The student's method, verbatim, or null when they showed none.
   *
   * ⚠ EVIDENCE, NOT AN ANSWER KEY. This is the only thing that makes a method
   * mark assessable — M1–M5 of 20(b)(iii) are five calculation steps, and the
   * final number cannot show whether any of them happened. The prompt below
   * still requires every evidence string to quote the STUDENT'S OWN WORDS, so
   * adding this widens what the model may READ, never what it may say back.
   */
  studentWorking: string | null;
  points: {
    pointCode: string;
    criterion: string;
    guidance: string | null;
    accept: string[];
    /** MUST be checked before awarding. See the prompt. */
    reject: string[];
  }[];
};

export type AiMarker = (
  request: AiMarkingRequest,
) => Promise<{ ok: true; judgements: AiPointJudgement[] } | { ok: false; error: string }>;

/**
 * Build the marking prompt.
 *
 * Exported and pure so it can be reviewed and tested without an API key — the
 * prompt is the part of an AI marker most likely to be wrong, and the part
 * least likely to be read if it is buried inside a network call.
 *
 * THE REJECT RULES COME LAST AND ARE FRAMED AS A VETO. 23(c)(ii) M1 carries
 * "Do not award ions move": a student who says the ions move has produced a
 * plausible-sounding answer that the examiner explicitly forbids. Anything
 * softer than an explicit final check invites the model to award it.
 */
export function buildMarkingPrompt(request: AiMarkingRequest): string {
  const points = request.points
    .map((p) => {
      const lines = [`${p.pointCode} (1 mark) — awarded for: ${p.criterion}`];
      if (p.guidance) lines.push(`  Examiner guidance: ${p.guidance.replace(/\n/g, " ")}`);
      if (p.accept.length) {
        lines.push(`  ALSO ACCEPT: ${p.accept.join(" | ")}`);
      }
      if (p.reject.length) {
        lines.push(`  MUST NOT AWARD IF: ${p.reject.join(" | ")}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  return [
    `You are marking one question from an Edexcel International A-Level Chemistry paper, against the examiner's own mark scheme. Award each point independently.`,
    ``,
    `QUESTION ${request.questionNumber}${request.commandWord ? ` (${request.commandWord})` : ""} — ${request.maxMarks} mark${request.maxMarks === 1 ? "" : "s"}`,
    request.questionText ?? "(the question is a diagram)",
    ``,
    `THE STUDENT'S ANSWER:`,
    request.studentAnswer,
    ``,
    // The working is a SEPARATE labelled block, not appended to the answer.
    // These are different artefacts marked against different points: the final
    // answer decides the answer mark (which Tier 1 has usually already
    // decided), the working carries the method marks. Merging them invites the
    // model to award a method mark because the final number happened to be
    // right, which is the exact inference the mark scheme forbids.
    ...(request.studentWorking
      ? [`THE STUDENT'S WORKING (their method, as they wrote it):`, request.studentWorking, ``]
      : []),
    `MARK SCHEME:`,
    points,
    ``,
    `HOW TO MARK:`,
    `- Judge each point separately. A student can earn some and miss others.`,
    `- Award a point if the answer conveys the criterion, even in different words. Chemistry is marked on meaning, not phrasing.`,
    `- Award a point when the answer matches anything under ALSO ACCEPT.`,
    `- BEFORE awarding any point, check its MUST NOT AWARD IF list. If the answer matches one of those, the point is NOT awarded, however well the rest of it reads. This overrides everything above.`,
    `- Do not award marks for correct chemistry the mark scheme does not ask for.`,
    ...(request.studentWorking
      ? [
          `- These are METHOD marks. Award each one from the WORKING — the step must actually appear there. A correct final answer is not evidence that a method step was carried out, and must not earn a method mark on its own.`,
          `- Working is often terse and unlabelled: a number, a formula, an arrow. Credit a step that is clearly present even if it is not written out in words.`,
          `- If the working does not show a step, that point is NOT awarded. For evidence, say only that the working does not show it. Do NOT state what the step was, what figure it should have produced, or any part of the mark scheme — the student reads this, and telling them the answer they missed hands them the mark scheme.`,
        ]
      : []),
    `- Evidence must quote or closely paraphrase the student's own words, in one sentence.`,
  ].join("\n");
}

/**
 * ⚠ NOT WIRED. Returns "not configured" until an AiMarker is supplied.
 *
 * Switching Tier 2 on needs three things, none of which are assumed here:
 *   1. `npm i @anthropic-ai/sdk`
 *   2. ANTHROPIC_API_KEY in the server environment (already present locally)
 *   3. An AiMarker implementation passed to markAttempt()
 *
 * The seam is a function parameter rather than an import so that the engine,
 * the prompt and every guarantee below are reviewable and testable with no
 * network and no key — and so that turning Tier 2 on is one explicit wiring
 * decision rather than a side effect of setting an environment variable.
 */
export const UNWIRED_MARKER: AiMarker = async () => ({
  ok: false,
  error: "The AI marker is not configured yet, so this answer has not been marked.",
});


/**
 * Tier 2 over the mark-scheme points Tier 1 did not judge, read from the
 * student's working.
 *
 * ============================================================================
 * WHY THIS IS A SEPARATE PASS RATHER THAN A WIDER TIER 1
 * ============================================================================
 * Tier 1 compares one number against one expected value. That is all it can do
 * with certainty, and its authority comes from not doing anything else. M1–M5
 * of 20(b)(iii) are "calculation of litres of fuel used", "…of mass of fuel
 * used", and so on — judgements about a method written in prose and arithmetic,
 * which is a reading task. So the method marks go to the tier that reads, and
 * they carry that tier's confidence: requires_review, always, and excluded
 * from the confirmed total.
 *
 * ⚠ THE CAP IS NOT DECORATION. Tier 1 has usually already claimed some of the
 * tariff via marks_on_correct_answer — 20(b)(iii) awards 1 of 6 for the final
 * answer — and the remaining mark-scheme points can outnumber the marks left.
 * Without a cap a question could report more marks than it is worth. It is
 * reported when it binds rather than applied silently, because a cap that
 * binds means the scheme and the transcribed figure disagree, and somebody
 * should look at that.
 */
/**
 * The student's final answer as a sentence, for the model.
 *
 * Not "" for an unanswered question: the model is being asked to judge method
 * marks, and "no final answer was given" is a materially different situation
 * from a wrong one. Saying nothing would let it assume an answer it cannot see.
 */
function describeNumericAnswer(response: ResponsePayload | null): string {
  if (!response || response.kind !== "numeric") return "(no final answer was given)";
  const value = response.value.trim();
  if (!value) return "(no final answer was given)";
  const unit = (response.unit ?? "").trim();
  return unit ? `${value} ${unit}` : value;
}

/**
 * The only thing a student is told about a method mark they did not earn.
 *
 * One constant, never the model's words — see the filter in
 * markMethodFromWorking() for why.
 */
const METHOD_NOT_SHOWN =
  "Your working doesn't show this step. If you did it, writing it down would let it be credited.";

type MethodOutcome = {
  /** Did Tier 2 run at all? False when there was no working, or nothing left. */
  ran: boolean;
  points: PointVerdict[];
  awarded: number;
  /** Set when the model failed. Tier 1's marks still stand. */
  error: string | null;
};

const NO_METHOD_PASS: MethodOutcome = { ran: false, points: [], awarded: 0, error: null };

async function markMethodFromWorking(
  aiMarker: AiMarker,
  input: {
    questionNumber: string;
    questionText: string | null;
    commandWord: string | null;
    maxMarks: number;
    studentAnswer: string;
    working: string;
    /** Only the points Tier 1 left unjudged. */
    criteria: {
      point_code: string;
      criterion: string;
      guidance: string | null;
      accept: string[] | null;
      reject: string[] | null;
    }[];
    /** Marks still available on this question after Tier 1 took its share. */
    cap: number;
  },
): Promise<MethodOutcome> {
  const result = await aiMarker({
    questionNumber: input.questionNumber,
    questionText: input.questionText,
    commandWord: input.commandWord,
    maxMarks: input.maxMarks,
    studentAnswer: input.studentAnswer,
    studentWorking: input.working,
    points: input.criteria.map((c) => ({
      pointCode: c.point_code,
      criterion: c.criterion,
      guidance: c.guidance,
      accept: c.accept ?? [],
      reject: c.reject ?? [],
    })),
  });

  if (!result.ok) return { ran: true, points: [], awarded: 0, error: result.error };

  // ⚠ ONLY THE POINTS WE ASKED ABOUT. A model that returns a judgement for a
  // point Tier 1 already decided would otherwise overwrite an arithmetic
  // verdict with an opinion, through the same upsert key.
  const asked = new Set(input.criteria.map((c) => c.point_code));
  const points = result.judgements
    .filter((j) => asked.has(j.pointCode))
    .map((j) => ({
      pointCode: j.pointCode,
      awarded: j.awarded,
      // ⚠ A NOT-AWARDED METHOD POINT GETS A FIXED SENTENCE, NOT THE MODEL'S.
      //
      // This is a structural boundary, not a second opinion about the prompt.
      // When the working does NOT contain a step there are no student words to
      // quote, so the only material the model holds for that sentence is the
      // point's own criterion and guidance — and for 20(b)(iii) the guidance IS
      // the worked solution, number by number ("(11400) × 9.25 = 105 450",
      // "× 0.749 (× 1000) = 78 982 000"). deterministic.ts's boundary note is
      // explicit that criterion and guidance prose reach the client under NO
      // circumstance, and a prompt instruction is a request, not an invariant.
      //
      // It also closes the injection route: the working is up to 20k characters
      // of student-controlled text sharing a prompt with the full mark scheme,
      // and this is the field that would carry anything extracted back out.
      // An awarded point still carries the model's sentence, which quotes the
      // student's own working — text they wrote and can already see.
      evidence: j.awarded ? j.evidence : METHOD_NOT_SHOWN,
    }));

  const raw = points.filter((pt) => pt.awarded).length;
  // A belt-and-braces assertion now, not a silent clamp. The caller refuses to
  // run this pass at all when the points outnumber the marks, so reaching here
  // means the judgement count exceeded a cap that was already >= the number of
  // points asked about — which cannot happen unless the model returned a point
  // twice, and claudeMarker already de-duplicates.
  if (raw > input.cap) {
    console.error(
      `[marking] ${input.questionNumber}: Tier 2 returned ${raw} awarded method mark(s) ` +
        `against a cap of ${input.cap} on ${input.criteria.length} point(s). Refusing the ` +
        `whole method pass rather than reporting more marks than the question is worth.`,
    );
    return { ran: true, points: [], awarded: 0, error: "Your working could not be marked reliably." };
  }
  return { ran: true, points, awarded: raw, error: null };
}

// ============================================================================
// ORCHESTRATION
// ============================================================================

export type MarkedQuestion = {
  questionAttemptId: string;
  questionNumber: string;
  answerType: string;
  maxMarks: number;
  /** null when nothing could be marked. NEVER a silent zero. */
  awardedMarks: number | null;
  /**
   * The denominator SHOWN — only the tariff actually assessed. A correct
   * 20(b)(iii) reads "n/n confirmed" with the rest flagged for review, never
   * "n/6", because the unassessed marks were not lost.
   */
  assessedOutOf: number | null;
  /** Tariff excluded from both numerator and denominator. */
  unassessedMarks: number;
  /** WORKING_NOT_CAPTURED, or null. */
  unassessedReason: string | null;
  tier: "deterministic" | "ai" | "unmarkable";
  /** 'requires_review' on every AI-marked question, without exception. */
  confidence: "deterministic" | "requires_review" | null;
  points: PointVerdict[];
  /**
   * Method marks Tier 2 awarded from the student's working.
   *
   * ⚠ NOT INCLUDED IN awardedMarks WHEN THE QUESTION ALSO HAS CONFIRMED MARKS,
   * and that separation is the whole contract. A correct 20(b)(iii) with
   * working confirms 1 mark by arithmetic and may collect up to 5 more from a
   * model; adding them together would launder a provisional judgement into the
   * confirmed total, which is what `confidence` exists to prevent. The
   * confirmed total sums awardedMarks over questions whose confidence is
   * 'deterministic', so these have to live somewhere else — here.
   *
   * When Tier 1 confirmed NOTHING, the question is wholly provisional and
   * behaves like any other AI-marked question: confidence is 'requires_review'
   * and awardedMarks carries the same number as this field.
   */
  provisionalMarks: number;
  /** How many method points Tier 2 actually judged. The denominator for the above. */
  provisionalOutOf: number;
  /** Tier 2's per-point verdicts on the method. Empty unless working was shown. */
  provisionalPoints: PointVerdict[];
  /** Present when the question could not be marked; shown to the student. */
  note: string | null;
};

export type MarkingSummary = {
  attemptId: string;
  /** Marks from Tier 1 only. This is the number that can be trusted. */
  confirmedAwarded: number;
  confirmedAvailable: number;
  /** Marks from Tier 2. Provisional — never added to the confirmed total. */
  provisionalAwarded: number;
  provisionalAvailable: number;
  /**
   * Tariff nobody could assess — whole unmarkable questions PLUS the
   * remainder of partially-assessed ones. Never in the confirmed denominator.
   */
  needsReviewAvailable: number;
  /**
   * Questions whose mark was computed but could not be written to the
   * database. NOT zero means the screen is under-reporting and the student
   * must be told so — never silently.
   */
  persistenceFailures: number;
  /**
   * Proof that nothing was dropped. See MarkingReconciliation.
   *
   * markAttempt refuses to return a summary whose buckets do not add up, so
   * reading this is confirmation rather than an invitation to re-check — but
   * an audit should assert on it anyway, because an assertion that lives only
   * inside the thing being audited is not independent evidence.
   */
  reconciliation: MarkingReconciliation;
  questions: MarkedQuestion[];
};


type QuestionRow = {
  id: string;
  question_number: string;
  question_text: string | null;
  answer_type: string;
  command_word: string | null;
  /** The paper's own sequence. The ONLY correct order to render results in. */
  display_order: number;
};

/** 0031 — a separate, staff-only table. Never columns on paper_questions. */
type ExpectedAnswerRow = {
  question_id: string;
  expected_value: string;
  expected_unit: string | null;
  answer_tolerance: number | null;
  accepted_values: string[] | null;
  marks_on_correct_answer: number | null;
};

/**
 * Mark a submitted attempt.
 *
 * Safe to re-run: marking_results upserts on (question_attempt_id, point_code)
 * and awarded_marks is overwritten, so a re-mark corrects rather than
 * duplicates. 0030's trigger permits writing awarded_marks to a submitted
 * attempt while still refusing edits to the student's answers — which is
 * exactly the split marking needs.
 */
export async function markAttempt(
  attemptId: string,
  aiMarker: AiMarker = UNWIRED_MARKER,
): Promise<{ ok: true; data: MarkingSummary } | { ok: false; error: string }> {
  // --- ownership, as the student, before any privileged read ---------------
  const session = await createClient();
  const { data: owned, error: ownErr } = await session
    .from("exam_attempts")
    .select("id, submitted_at")
    .eq("id", attemptId)
    .maybeSingle();

  // An ERROR is ours; an absent row is theirs. Checked separately, and in this
  // order, because folding them together told a student their submitted paper
  // did not exist whenever this read failed. Not-found and not-yours DO stay
  // folded together — that pair is deliberate, for the reason below.
  if (ownErr) {
    console.error(`[marking] ownership read: ${ownErr.code ?? "?"}: ${ownErr.message}`);
    return {
      ok: false,
      error: "We couldn't open your paper just now. Nothing has been lost — please try again shortly.",
    };
  }
  if (!owned) {
    // Not found and not-yours are the same answer, for the same reason
    // getAttemptForPlayer gives it: a probe should look like a typo.
    return { ok: false, error: "That attempt could not be found." };
  }
  if (!(owned as { submitted_at: string | null }).submitted_at) {
    return { ok: false, error: "This attempt has not been submitted yet." };
  }

  return markSubmittedAttempt(attemptId, aiMarker);
}

/**
 * The marking engine, with the ownership gate already passed.
 *
 * ⚠ SPLIT OUT SO IT CAN BE RUN, NOT SO THE GATE CAN BE SKIPPED. markAttempt
 * builds a cookie-backed client to prove the attempt belongs to the caller, so
 * it only works inside a request with a signed-in student's cookies — which
 * made the engine impossible to exercise against real rows without one.
 *
 * To be precise about what that bought, because the obvious reading is wrong:
 * this file begins with `import "server-only"`, so NOTHING here runs under
 * plain `node` — a script cannot import it whatever the split. What the split
 * allows is driving the engine from a server route inside the app, where the
 * module graph is intact but no student session exists. That is how working
 * capture was verified end to end against the live paper and a real model.
 *
 * ⚠ AND THEREFORE: THIS FUNCTION TRUSTS ITS CALLER COMPLETELY. It reads and
 * writes with the service role and asks nobody's permission. The ONLY
 * legitimate callers are markAttempt, which has just proved ownership and
 * submission, and an operator-run script. It must never be reachable from a
 * route, an action, or anything else that takes an attemptId from a client —
 * that would hand any signed-in student the marks and evidence for any paper
 * on the system.
 */
export async function markSubmittedAttempt(
  attemptId: string,
  aiMarker: AiMarker = UNWIRED_MARKER,
): Promise<{ ok: true; data: MarkingSummary } | { ok: false; error: string }> {
  // --- privileged from here -----------------------------------------------
  const db = createAdminClient();

  // ⚠ EVERY READ BELOW IS CHECKED. They were not, and `const { data } = await`
  // silently discarded the error object on all five: a failed read of
  // question_expected_answers would have left `expected` null and turned every
  // numeric question into "not markable" — a plausible-looking results page
  // produced by an outage. That is the same failure mode as the swallowed
  // write in persist(), and it is exactly how PGRST205 hid earlier today.
  //
  // These are not per-question degradations. Each of these tables feeds every
  // question, so a failure means the whole paper would be mismarked. Marking
  // is idempotent and re-runs on every page load, so refusing outright and
  // asking the student to reload loses nothing.
  const qaRes = await db
    .from("question_attempts")
    .select("id, question_id, max_marks")
    .eq("exam_attempt_id", attemptId);
  const qaFail = readFailed("question_attempts", qaRes.error);
  if (qaFail) return qaFail;
  if (!qaRes.data?.length) return { ok: false, error: "This attempt has no questions." };

  const qas = qaRes.data as { id: string; question_id: string; max_marks: number }[];

  const questionsRes = await db
    .from("paper_questions")
    .select(
      "id, question_number, question_text, answer_type, command_word, display_order",
    )
    .in("id", qas.map((r) => r.question_id));
  const questionsFail = readFailed("paper_questions", questionsRes.error);
  if (questionsFail) return questionsFail;
  const qById = new Map(((questionsRes.data ?? []) as QuestionRow[]).map((q) => [q.id, q]));

  // ⚠ PAPER ORDER, EXPLICITLY. question_attempts has no ordering of its own,
  // and PostgREST returns heap order — which is stable only while nothing is
  // updated. The moment marking started actually writing awarded_marks (0032),
  // updated rows moved and the results screen listed 22(c) above question 1.
  // getAttemptForPlayer already sorts by display_order for the same reason;
  // this is the same rule, applied to the same rows, one screen later.
  qas.sort(
    (a, b) => (qById.get(a.question_id)?.display_order ?? 0) - (qById.get(b.question_id)?.display_order ?? 0),
  );

  // Read privileged: question_expected_answers has no policy a student can
  // satisfy, which is the point — see 0031.
  const expectedRes = await db
    .from("question_expected_answers")
    .select(
      "question_id, expected_value, expected_unit, answer_tolerance, accepted_values, marks_on_correct_answer",
    )
    .in("question_id", qas.map((r) => r.question_id));
  const expectedFail = readFailed("question_expected_answers", expectedRes.error);
  if (expectedFail) return expectedFail;
  const expectedByQ = new Map(
    ((expectedRes.data ?? []) as ExpectedAnswerRow[]).map((e) => [e.question_id, e]),
  );

  const responsesRes = await db
    .from("student_responses")
    .select("question_attempt_id, response_payload")
    .in("question_attempt_id", qas.map((r) => r.id));
  const responsesFail = readFailed("student_responses", responsesRes.error);
  if (responsesFail) return responsesFail;
  const responseByQa = new Map(
    ((responsesRes.data ?? []) as { question_attempt_id: string; response_payload: ResponsePayload }[]).map(
      (r) => [r.question_attempt_id, r.response_payload],
    ),
  );

  // ⚠ WHAT AN EARLIER RUN ALREADY DECIDED. The results page marks on EVERY
  // load, and Tier 2 is a model call: re-running it re-samples a judgement that
  // is supposed to be fixed. Without this read a student who pressed refresh
  // could watch their provisional method marks change from 4/5 to 2/5 and back,
  // each load overwriting the last through the same upsert key — and a load
  // where the model failed would leave the previous run's awarded rows standing
  // while the screen reported the question unmarked.
  //
  // Tier 1 needs no such protection: it is pure, so re-running it is free and
  // returns the same verdict every time. Only the model-judged points are
  // remembered, identified by a non-null model_version.
  const priorRes = await db
    .from("marking_results")
    .select("question_attempt_id, point_code, awarded, evidence, model_version")
    .in("question_attempt_id", qas.map((r) => r.id));
  const priorFail = readFailed("marking_results", priorRes.error);
  if (priorFail) return priorFail;
  const priorByQa = new Map<string, Map<string, { awarded: boolean; evidence: string }>>();
  for (const row of (priorRes.data ?? []) as {
    question_attempt_id: string;
    point_code: string;
    awarded: boolean;
    evidence: string | null;
    model_version: string | null;
  }[]) {
    if (!row.model_version) continue; // Tier 1's own rows are recomputed, not reused.
    const forQa = priorByQa.get(row.question_attempt_id) ?? new Map();
    forQa.set(row.point_code, { awarded: row.awarded, evidence: row.evidence ?? METHOD_NOT_SHOWN });
    priorByQa.set(row.question_attempt_id, forQa);
  }

  const schemeRes = await db
    .from("mark_scheme_items")
    .select("question_id, point_code, criterion, guidance, accept, reject, display_order")
    .in("question_id", qas.map((r) => r.question_id))
    .order("display_order", { ascending: true });
  const schemeFail = readFailed("mark_scheme_items", schemeRes.error);
  if (schemeFail) return schemeFail;
  const scheme = schemeRes.data;
  const schemeByQ = new Map<string, typeof scheme extends null ? never : NonNullable<typeof scheme>>();
  for (const item of (scheme ?? []) as {
    question_id: string;
    point_code: string;
    criterion: string;
    guidance: string | null;
    accept: string[] | null;
    reject: string[] | null;
    display_order: number;
  }[]) {
    const list = schemeByQ.get(item.question_id) ?? ([] as never[]);
    (list as unknown[]).push(item);
    schemeByQ.set(item.question_id, list);
  }

  const marked: MarkedQuestion[] = [];
  let persistenceFailures = 0;
  // Rows this run wrote AND read back — persist() asserts the row count, so
  // this counts landings, not attempts.
  let persistedRows = 0;

  /**
   * The mark was computed and could not be stored, so it is not shown.
   *
   * Discarding a correct mark is the deliberate choice here. The alternative —
   * showing it anyway — is what produced a green results page over six failed
   * writes: a number on this screen has to mean a number in the database, or
   * it means nothing at all.
   */
  const persistFailed = (
    qa: { id: string; max_marks: number },
    q: QuestionRow,
    tier: "deterministic" | "ai",
    error: unknown,
  ): MarkedQuestion => {
    persistenceFailures += 1;
    console.error(
      `[marking] ${q.question_number}: mark computed but NOT SAVED — ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      questionAttemptId: qa.id,
      questionNumber: q.question_number,
      answerType: q.answer_type,
      maxMarks: qa.max_marks,
      awardedMarks: null,
      assessedOutOf: null,
      unassessedMarks: qa.max_marks,
      unassessedReason: "the mark could not be saved",
      provisionalMarks: 0,
      provisionalOutOf: 0,
      provisionalPoints: [],
      tier,
      confidence: null,
      points: [],
      note: "This question was marked, but the mark couldn't be saved, so it isn't being shown. Reloading this page will try again.",
    };
  };

  for (const qa of qas) {
    const q = qById.get(qa.question_id);
    // ⚠ `continue` HERE WAS A SILENT DROP: the question vanished from the
    // results entirely — not shown as unmarked, not counted, not logged. Ten
    // questions in, nine out, and the screen looked complete. That is the
    // failure shape this whole file has been chasing, so it is now the one
    // thing that stops the run: an input we cannot account for means the
    // output cannot be trusted to be about this attempt.
    //
    // It should be unreachable — getAttemptForPlayer proves the same invariant
    // one screen earlier, and 0030 creates these rows from paper_questions in
    // a single transaction. Unreachable is exactly when to assert.
    if (!q) {
      console.error(
        `[marking] question_attempt ${qa.id} references question ${qa.question_id}, absent from paper_questions. Refusing to mark a partial paper.`,
      );
      return {
        ok: false,
        error: "Your paper couldn't be marked just now. Nothing has been lost — please try again shortly.",
      };
    }
    const criteria = (schemeByQ.get(qa.question_id) ?? []) as unknown as {
      point_code: string;
      criterion: string;
      guidance: string | null;
      accept: string[] | null;
      reject: string[] | null;
    }[];
    const response = responseByQa.get(qa.id) ?? null;
    const tier = tierFor(q.answer_type);

    if (tier === "unmarkable") {
      marked.push({
        questionAttemptId: qa.id,
        questionNumber: q.question_number,
        answerType: q.answer_type,
        maxMarks: qa.max_marks,
        awardedMarks: null,
        assessedOutOf: null,
        unassessedMarks: qa.max_marks,
        unassessedReason: null,
        tier,
        confidence: null,
        points: [],
        provisionalMarks: 0,
        provisionalOutOf: 0,
        provisionalPoints: [],
        note: "This question type can't be answered or marked on screen yet.",
      });
      continue;
    }

    if (tier === "deterministic") {
      const simple = criteria.map((c) => ({ pointCode: c.point_code, criterion: c.criterion }));
      const result: DeterministicResult =
        q.answer_type === "mcq"
          ? markMcq(
              response,
              qa.max_marks,
              expectedByQ.get(qa.question_id)?.expected_value ?? null,
              simple,
            )
          : markNumeric(
              response,
              qa.max_marks,
              (() => {
                const e = expectedByQ.get(qa.question_id) ?? null;
                // marks_on_correct_answer is capped against the tariff
                // snapshotted on THIS attempt, which a database CHECK cannot
                // reach — max_marks lives on question_attempts. A stated
                // figure above the tariff is a transcription error, and it is
                // reported rather than silently honoured.
                let stated = e?.marks_on_correct_answer ?? null;
                if (stated !== null && stated > qa.max_marks) {
                  console.error(
                    `[marking] ${q.question_number}: marks_on_correct_answer ${stated} exceeds max_marks ${qa.max_marks}; capping. Fix the transcription.`,
                  );
                  stated = qa.max_marks;
                }
                return {
                  expectedValue: e?.expected_value ?? null,
                  expectedUnit: e?.expected_unit ?? null,
                  tolerance: e?.answer_tolerance ?? null,
                  acceptedValues: e?.accepted_values ?? null,
                  marksOnCorrectAnswer: stated,
                  requiresUnit: q.answer_type === "numeric_with_unit",
                };
              })(),
              simple,
            );

      // ── THE METHOD PASS ────────────────────────────────────────────────
      //
      // Whatever Tier 1 decided, the marks it did NOT decide are the method
      // marks. They were a dead end before working existed; with working they
      // go to Tier 2. The three inputs are all derived, never guessed:
      //
      //   which points   every mark-scheme point Tier 1 returned no verdict on
      //   how many marks the tariff Tier 1 left on the table
      //   the evidence   the student's working, trimmed, or nothing at all
      //
      // ⚠ WITH NO WORKING, EVERY LINE BELOW IS SKIPPED and this branch behaves
      // exactly as it did before. That is the "not penalised for leaving it
      // blank" guarantee, expressed as control flow rather than as a promise.
      const working = workingFrom(response);
      const judged = new Set(result.markable ? result.points.map((pt) => pt.pointCode) : []);
      const methodCriteria = criteria.filter((c) => !judged.has(c.point_code));
      const reviewCap = result.markable ? result.unassessedMarks : qa.max_marks;

      // ⚠ POINTS AND MARKS ARE DIFFERENT UNITS, AND THIS IS WHERE THEY MUST
      // AGREE. marking_results.awarded is boolean — 0028 is explicit that one
      // point cannot award more than one mark — so N method points can carry at
      // most N marks. reviewCap is what the tariff has left after Tier 1 took
      // marks_on_correct_answer. When there are MORE points than marks left,
      // there is no honest mapping: awarding every point would report a 6-mark
      // question as worth 7, and clamping the total while persisting every
      // awarded flag would make the stored rows contradict the printed number.
      //
      // So the pass does not run. That is a transcription disagreement between
      // the mark scheme and marks_on_correct_answer, it is logged as one, and
      // the marks stay exactly where they were before working existed.
      const methodFits = methodCriteria.length <= reviewCap;
      if (working !== null && reviewCap > 0 && methodCriteria.length > 0 && !methodFits) {
        console.error(
          `[marking] ${q.question_number}: ${methodCriteria.length} unjudged mark-scheme ` +
            `point(s) but only ${reviewCap} mark(s) left after marks_on_correct_answer ` +
            `(${qa.max_marks} total). Method marking skipped — check the transcription.`,
        );
      }
      // Verdicts an earlier run already reached on exactly these points.
      const prior = priorByQa.get(qa.id);
      const stored = methodCriteria
        .map((c) => {
          const hit = prior?.get(c.point_code);
          return hit ? { pointCode: c.point_code, awarded: hit.awarded, evidence: hit.evidence } : null;
        })
        .filter((v): v is PointVerdict => v !== null);
      const allStored = methodCriteria.length > 0 && stored.length === methodCriteria.length;

      const method: MethodOutcome = allStored
        ? {
            // Already judged. Re-asking the model would be asking a different
            // question of the same evidence and calling the answer the same.
            ran: true,
            points: stored,
            awarded: stored.filter((pt) => pt.awarded).length,
            error: null,
          }
        : working !== null && reviewCap > 0 && methodCriteria.length > 0 && methodFits
          ? await markMethodFromWorking(aiMarker, {
              questionNumber: q.question_number,
              questionText: q.question_text,
              commandWord: q.command_word,
              maxMarks: qa.max_marks,
              studentAnswer: describeNumericAnswer(response),
              working,
              criteria: methodCriteria,
              cap: reviewCap,
            })
          : NO_METHOD_PASS;

      // The model failed, but an earlier run had already judged some of these.
      // Use what is STORED rather than reporting nothing: those verdicts are
      // real, they are already in the database, and reporting the question as
      // unjudged would put the screen at odds with the rows behind it. Nothing
      // is invented — points with no stored verdict simply stay unjudged.
      const salvaged: MethodOutcome | null =
        method.error !== null && stored.length > 0
          ? { ran: true, points: stored, awarded: stored.filter((pt) => pt.awarded).length, error: null }
          : null;
      const outcome: MethodOutcome = salvaged ?? method;

      if (!result.markable) {
        // Tier 1 abstained — a mismatch, a null marks_on_correct_answer, or
        // nothing entered. It still awards NOTHING: abstaining is not a zero,
        // and that rule is untouched by working.
        if (!outcome.ran || outcome.error !== null) {
          // ⚠ TIER 1'S REASON SURVIVES. `outcome.error ?? result.reason` dropped
          // it whenever the model failed — and the method pass only runs when
          // working was shown, so the student who filled the box was the ONLY
          // one who lost the accurate explanation of why their answer was not
          // marked. They now get both, in that order.
          const reason =
            outcome.error !== null ? `${result.reason} (${outcome.error})` : result.reason;
          marked.push({
            questionAttemptId: qa.id,
            questionNumber: q.question_number,
            answerType: q.answer_type,
            maxMarks: qa.max_marks,
            awardedMarks: null,
            assessedOutOf: null,
            unassessedMarks: qa.max_marks,
            unassessedReason: reason,
            tier,
            confidence: null,
            points: [],
            provisionalMarks: 0,
            provisionalOutOf: 0,
            provisionalPoints: [],
            note: reason,
          });
          continue;
        }
        // Wholly provisional, and shaped like every other AI-marked question:
        // awardedMarks carries the provisional figure and confidence says so,
        // which keeps it out of the confirmed total.
        try {
          await persist(db, qa.id, outcome.awarded, "requires_review", outcome.points.map(byTier2));
          persistedRows += 1;
        } catch (error) {
          marked.push(persistFailed(qa, q, tier, error));
          continue;
        }
        marked.push({
          questionAttemptId: qa.id,
          questionNumber: q.question_number,
          answerType: q.answer_type,
          maxMarks: qa.max_marks,
          awardedMarks: outcome.awarded,
          assessedOutOf: outcome.points.length,
          unassessedMarks: Math.max(0, qa.max_marks - outcome.points.length),
          unassessedReason:
            qa.max_marks - outcome.points.length > 0 ? WORKING_UNDER_REVIEW : null,
          tier,
          confidence: "requires_review",
          points: outcome.points,
          provisionalMarks: outcome.awarded,
          provisionalOutOf: outcome.points.length,
          provisionalPoints: outcome.points,
          note: `${result.reason} ${outcome.awarded} of ${outcome.points.length} method mark(s) were judged from your working, and need review.`,
        });
        continue;
      }

      const awarded = clamp(result.awarded, qa.max_marks, q.question_number);
      // ONE persist call for both tiers: two would each write awarded_marks,
      // and the second would overwrite the first.
      try {
        await persist(db, qa.id, awarded, "deterministic", [
          ...result.points.map(byTier1),
          ...outcome.points.map(byTier2),
        ]);
        persistedRows += 1;
      } catch (error) {
        marked.push(persistFailed(qa, q, tier, error));
        continue;
      }
      // One mark-scheme point carries at most one mark (0028: `awarded boolean`),
      // and the pass is refused outright when the points outnumber the marks —
      // so subtracting a point count from a mark count is sound HERE and only
      // here.
      const leftUnassessed = Math.max(
        0,
        result.markable
          ? result.unassessedMarks - (outcome.error === null ? outcome.points.length : 0)
          : 0,
      );
      const methodNote =
        outcome.error !== null
          ? ` Your working could not be reviewed just now — ${outcome.error}`
          : outcome.ran
            ? ` ${outcome.awarded} of ${outcome.points.length} method mark(s) were judged from your working, and need review.`
            : "";
      marked.push({
        questionAttemptId: qa.id,
        questionNumber: q.question_number,
        answerType: q.answer_type,
        maxMarks: qa.max_marks,
        // ⚠ Tier 1's figure ONLY. The provisional method marks are reported
        // beside it, never added into it.
        awardedMarks: awarded,
        assessedOutOf: result.assessedOutOf,
        // ⚠ MARKS TIER 2 JUDGED LEAVE THIS BUCKET. needsReviewAvailable sums
        // unassessedMarks and means "tariff nobody could assess"; the
        // provisional bucket now counts the same method marks. Leaving them in
        // both would report 6 marks of outcome on a 6-mark question worth 1
        // confirmed + 5 provisional, and the totals would stop adding up.
        unassessedMarks: leftUnassessed,
        // markNumeric already says WORKING_UNDER_REVIEW when working was
        // shown. The only case it cannot know about is Tier 2 failing after
        // the fact, where promising a review that did not happen would be the
        // same false reassurance in a different place.
        unassessedReason:
          leftUnassessed === 0
            ? null
            : outcome.ran && outcome.error !== null
              ? outcome.error
              : result.unassessedReason,
        tier,
        confidence: "deterministic",
        points: result.points,
        provisionalMarks: outcome.awarded,
        provisionalOutOf: outcome.points.length,
        provisionalPoints: outcome.points,
        // Counts what was actually judged, not the tariff Tier 1 left — those
        // differ whenever the scheme has fewer points than marks, and the same
        // card also prints the remainder as "not assessed", so overstating here
        // reported the same marks in two places at once.
        note:
          outcome.ran && outcome.error === null && outcome.points.length > 0
            ? `${outcome.points.length} method mark${outcome.points.length === 1 ? "" : "s"} ` +
              `assessed from your working and awaiting review` +
              (leftUnassessed > 0
                ? `, and ${leftUnassessed} more could not be assessed.`
                : ".")
            : result.unassessedReason
              ? `${result.unassessedMarks} mark${result.unassessedMarks === 1 ? "" : "s"} on this ` +
                `question could not be assessed — ${
                  outcome.error !== null ? outcome.error : result.unassessedReason
                }.`
              : null,
      });
      continue;
    }

    // --- Tier 2 -----------------------------------------------------------
    const text = response && response.kind === "text" ? response.text.trim() : "";
    if (!text) {
      try {
        await persist(db, qa.id, 0, "requires_review", []);
        persistedRows += 1;
      } catch (error) {
        marked.push(persistFailed(qa, q, tier, error));
        continue;
      }
      marked.push({
        questionAttemptId: qa.id,
        questionNumber: q.question_number,
        answerType: q.answer_type,
        maxMarks: qa.max_marks,
        awardedMarks: 0,
        assessedOutOf: qa.max_marks,
        unassessedMarks: 0,
        unassessedReason: null,
        tier,
        confidence: "requires_review",
        points: [],
        provisionalMarks: 0,
        provisionalOutOf: 0,
        provisionalPoints: [],
        note: "No answer was given.",
      });
      continue;
    }

    const aiResult = await aiMarker({
      questionNumber: q.question_number,
      questionText: q.question_text,
      commandWord: q.command_word,
      maxMarks: qa.max_marks,
      studentAnswer: text,
      // Long-form answers carry their own method inline; there is no separate
      // working field on a text response.
      studentWorking: null,
      points: criteria.map((c) => ({
        pointCode: c.point_code,
        criterion: c.criterion,
        guidance: c.guidance,
        accept: c.accept ?? [],
        reject: c.reject ?? [],
      })),
    });

    if (!aiResult.ok) {
      marked.push({
        questionAttemptId: qa.id,
        questionNumber: q.question_number,
        answerType: q.answer_type,
        maxMarks: qa.max_marks,
        awardedMarks: null,
        assessedOutOf: null,
        unassessedMarks: qa.max_marks,
        unassessedReason: aiResult.error,
        tier,
        confidence: null,
        points: [],
        provisionalMarks: 0,
        provisionalOutOf: 0,
        provisionalPoints: [],
        note: aiResult.error,
      });
      continue;
    }

    const points: PointVerdict[] = aiResult.judgements.map((j) => ({
      pointCode: j.pointCode,
      awarded: j.awarded,
      evidence: j.evidence,
    }));
    const awarded = clamp(points.filter((p) => p.awarded).length, qa.max_marks, q.question_number);

    // 'requires_review' is hardcoded, not derived from anything the model
    // returned. A model cannot promote its own marking to authoritative.
    try {
      await persist(db, qa.id, awarded, "requires_review", points.map(byTier2));
      persistedRows += 1;
    } catch (error) {
      marked.push(persistFailed(qa, q, tier, error));
      continue;
    }
    marked.push({
      questionAttemptId: qa.id,
      questionNumber: q.question_number,
      answerType: q.answer_type,
      maxMarks: qa.max_marks,
      awardedMarks: awarded,
      assessedOutOf: qa.max_marks,
      unassessedMarks: 0,
      unassessedReason: null,
      tier,
      confidence: "requires_review",
      points,
      // A wholly AI-marked question: every mark on it is provisional, so the
      // two figures agree by construction rather than by coincidence.
      provisionalMarks: awarded,
      provisionalOutOf: points.length,
      provisionalPoints: points,
      note: null,
    });
  }

  const confirmed = marked.filter((m) => m.confidence === "deterministic");
  const provisional = marked.filter((m) => m.confidence === "requires_review");

  const check = reconcileMarking({
    questionsIn: qas.length,
    responsesIn: responseByQa.size,
    marked,
    persisted: persistedRows,
    persistFailed: persistenceFailures,
  });

  // ⚠ THE RUN FAILS RATHER THAN RETURNING A SUMMARY THAT DOES NOT ADD UP.
  // A short summary is precisely how a dropped question hides: the screen
  // renders, the totals look plausible, and the only evidence is a question
  // that is missing from a page nobody is counting.
  if (!check.ok) {
    console.error(
      `[marking] RECONCILIATION FAILED for attempt ${attemptId}: ${check.problem}. ${describeReconciliation(check.reconciliation)}`,
    );
    return {
      ok: false,
      error: "Your paper couldn't be marked just now. Nothing has been lost — please try again shortly.",
    };
  }
  const reconciliation = check.reconciliation;

  return {
    ok: true,
    data: {
      attemptId,
      confirmedAwarded: sum(confirmed.map((m) => m.awardedMarks ?? 0)),
      // assessedOutOf, NOT maxMarks. Tariff this marker could not reach is
      // excluded from the denominator as well as the numerator: counting it
      // would present unassessable marks as marks the student lost.
      confirmedAvailable: sum(confirmed.map((m) => m.assessedOutOf ?? 0)),
      // ⚠ ACROSS ALL QUESTIONS, NOT JUST THE PROVISIONAL BUCKET. `provisional`
      // is questions whose CONFIDENCE is requires_review — a whole AI-marked
      // question. A numeric question with working is not one of those: its
      // confidence is deterministic because its awarded_marks are, and its
      // method marks are provisional alongside. Summing the bucket would have
      // reported 0 provisional marks on the very question this exists for.
      provisionalAwarded: sum(marked.map((m) => m.provisionalMarks)),
      provisionalAvailable: sum(
        marked.map((m) =>
          m.confidence === "requires_review" ? (m.assessedOutOf ?? 0) : m.provisionalOutOf,
        ),
      ),
      needsReviewAvailable: sum(marked.map((m) => m.unassessedMarks)),
      persistenceFailures,
      reconciliation,
      questions: marked,
    },
  };
}

/**
 * A read that failed, reported rather than absorbed.
 *
 * Returns the caller's error result, or null when there was no error — so the
 * call site reads `const fail = readFailed(...); if (fail) return fail;` and a
 * forgotten check is visible as a missing line rather than as an absent
 * destructured field.
 *
 * The student sees one sentence with no Postgres in it; the code goes to the
 * server log, because "PGRST205" and "42501" mean opposite things and the
 * difference is invisible without it.
 */
function readFailed(
  label: string,
  error: { code?: string; message: string } | null,
): { ok: false; error: string } | null {
  if (!error) return null;
  console.error(`[marking] read ${label}: ${error.code ?? "?"}: ${error.message}`);
  return {
    ok: false,
    error: "Your paper couldn't be marked just now. Nothing has been lost — please try again shortly.",
  };
}

/**
 * awarded_marks <= max_marks, enforced here because 0028 deliberately does not.
 *
 * That file's note says half an invariant is worse than none: the database
 * cannot express "a mark is capped by the tariff snapshotted on a sibling
 * column" without a trigger it chose not to write, so the marking layer owns
 * it. A breach is a bug in a marker, so it is logged loudly rather than
 * silently clamped and forgotten.
 */
function clamp(awarded: number, maxMarks: number, questionNumber: string): number {
  const safe = Math.max(0, Math.min(awarded, maxMarks));
  if (safe !== awarded) {
    console.error(
      `[marking] ${questionNumber}: marker returned ${awarded} of ${maxMarks}; clamped to ${safe}. This is a marker bug.`,
    );
  }
  return safe;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * A write that did not land.
 *
 * ⚠ THIS THROWS. IT USED TO console.error AND RETURN.
 *
 * That version reported success on writes the database refused. 0030's
 * question_attempts trigger blocked every awarded_marks write to a submitted
 * attempt — which is every attempt this function is ever called on — so all
 * six writes on a real sitting failed, every awarded_marks stayed NULL, and
 * the results screen rendered a clean set of marks from the in-memory summary
 * on top of an empty column. A check that reports a pass when it should report
 * a fail is worse than no check: nothing looked wrong for as long as nobody
 * queried the table directly.
 *
 * So: persistence failure is now loud, the caller renders the affected
 * question as NOT MARKED, and the mark it computed is discarded rather than
 * shown. A number on that screen must mean a number in the database.
 */
class PersistError extends Error {
  constructor(table: string, code: string, detail: string) {
    super(`${table}: ${code}: ${detail}`);
    this.name = "PersistError";
  }
}

/**
 * A verdict plus WHO REACHED IT.
 *
 * ⚠ PROVENANCE IS PER POINT, not per call, because one question can now carry
 * both kinds. A 20(b)(iii) with working has M6 decided by arithmetic and M1–M5
 * judged by a model, in the same question_attempt. marking_results has held a
 * per-row model_version since 0028 for exactly this audit; passing one version
 * for a whole call would have stamped Tier 1's verdict with a model that never
 * saw it, which is the sort of quiet falsehood a review queue is built on.
 */
type PersistablePoint = PointVerdict & {
  modelVersion: string | null;
  promptVersion: string | null;
};

/** Tier 1 reached it: no model, no prompt. */
const byTier1 = (p: PointVerdict): PersistablePoint => ({
  ...p,
  modelVersion: null,
  promptVersion: null,
});
/** Tier 2 reached it: stamped, so a reviewer can see what judged it. */
const byTier2 = (p: PointVerdict): PersistablePoint => ({
  ...p,
  modelVersion: MARKING_MODEL,
  promptVersion: PROMPT_VERSION,
});

async function persist(
  db: ReturnType<typeof createAdminClient>,
  questionAttemptId: string,
  awarded: number,
  confidence: "deterministic" | "requires_review",
  points: PersistablePoint[],
): Promise<void> {
  if (points.length > 0) {
    const { data, error } = await db
      .from("marking_results")
      .upsert(
        points.map((p) => ({
          question_attempt_id: questionAttemptId,
          point_code: p.pointCode,
          awarded: p.awarded,
          evidence: p.evidence,
          model_version: p.modelVersion,
          prompt_version: p.promptVersion,
        })),
        { onConflict: "question_attempt_id,point_code" },
      )
      .select("point_code");
    if (error) throw new PersistError("marking_results", error.code ?? "?", error.message);
    // An upsert that matches no row returns no error. Row count is the only
    // proof the write happened — see the note on `.select("id")` below.
    if ((data?.length ?? 0) !== points.length) {
      throw new PersistError(
        "marking_results",
        "row_count",
        `wrote ${data?.length ?? 0} of ${points.length} points`,
      );
    }
  }

  // ⚠ .select("id") IS LOAD-BEARING. Without it PostgREST returns neither rows
  // nor an error when the filter matches nothing, so an update against a
  // deleted or invisible row is indistinguishable from one that worked.
  // updated_at is not sent: 0028's touch_question_attempts trigger sets it,
  // and sending it would need an UPDATE privilege on a column students should
  // not hold — see 0032.
  const { data, error } = await db
    .from("question_attempts")
    .update({ awarded_marks: awarded, confidence })
    .eq("id", questionAttemptId)
    .select("id");
  if (error) throw new PersistError("question_attempts", error.code ?? "?", error.message);
  if ((data?.length ?? 0) !== 1) {
    throw new PersistError("question_attempts", "row_count", `updated ${data?.length ?? 0} rows, expected 1`);
  }
}
