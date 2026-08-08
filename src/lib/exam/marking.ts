import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { ResponsePayload } from "./attempts";
import {
  markMcq,
  markNumeric,
  tierFor,
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
    `MARK SCHEME:`,
    points,
    ``,
    `HOW TO MARK:`,
    `- Judge each point separately. A student can earn some and miss others.`,
    `- Award a point if the answer conveys the criterion, even in different words. Chemistry is marked on meaning, not phrasing.`,
    `- Award a point when the answer matches anything under ALSO ACCEPT.`,
    `- BEFORE awarding any point, check its MUST NOT AWARD IF list. If the answer matches one of those, the point is NOT awarded, however well the rest of it reads. This overrides everything above.`,
    `- Do not award marks for correct chemistry the mark scheme does not ask for.`,
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
  questions: MarkedQuestion[];
};

type QuestionRow = {
  id: string;
  question_number: string;
  question_text: string | null;
  answer_type: string;
  command_word: string | null;
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

  if (ownErr || !owned) {
    // Not found and not-yours are the same answer, for the same reason
    // getAttemptForPlayer gives it: a probe should look like a typo.
    return { ok: false, error: "That attempt could not be found." };
  }
  if (!(owned as { submitted_at: string | null }).submitted_at) {
    return { ok: false, error: "This attempt has not been submitted yet." };
  }

  // --- privileged from here -----------------------------------------------
  const db = createAdminClient();

  const { data: qaRows } = await db
    .from("question_attempts")
    .select("id, question_id, max_marks")
    .eq("exam_attempt_id", attemptId);
  if (!qaRows?.length) return { ok: false, error: "This attempt has no questions." };

  const qas = qaRows as { id: string; question_id: string; max_marks: number }[];

  const { data: questions } = await db
    .from("paper_questions")
    .select(
      "id, question_number, question_text, answer_type, command_word",
    )
    .in("id", qas.map((r) => r.question_id));
  const qById = new Map(((questions ?? []) as QuestionRow[]).map((q) => [q.id, q]));

  // Read privileged: question_expected_answers has no policy a student can
  // satisfy, which is the point — see 0031.
  const { data: expected } = await db
    .from("question_expected_answers")
    .select(
      "question_id, expected_value, expected_unit, answer_tolerance, accepted_values, marks_on_correct_answer",
    )
    .in("question_id", qas.map((r) => r.question_id));
  const expectedByQ = new Map(
    ((expected ?? []) as ExpectedAnswerRow[]).map((e) => [e.question_id, e]),
  );

  const { data: responses } = await db
    .from("student_responses")
    .select("question_attempt_id, response_payload")
    .in("question_attempt_id", qas.map((r) => r.id));
  const responseByQa = new Map(
    ((responses ?? []) as { question_attempt_id: string; response_payload: ResponsePayload }[]).map(
      (r) => [r.question_attempt_id, r.response_payload],
    ),
  );

  const { data: scheme } = await db
    .from("mark_scheme_items")
    .select("question_id, point_code, criterion, guidance, accept, reject, display_order")
    .in("question_id", qas.map((r) => r.question_id))
    .order("display_order", { ascending: true });
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

  for (const qa of qas) {
    const q = qById.get(qa.question_id);
    if (!q) continue;
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

      if (!result.markable) {
        marked.push({
          questionAttemptId: qa.id,
          questionNumber: q.question_number,
          answerType: q.answer_type,
          maxMarks: qa.max_marks,
          awardedMarks: null,
          assessedOutOf: null,
          unassessedMarks: qa.max_marks,
          unassessedReason: result.reason,
          tier,
          confidence: null,
          points: [],
          note: result.reason,
        });
        continue;
      }

      const awarded = clamp(result.awarded, qa.max_marks, q.question_number);
      await persist(db, qa.id, awarded, "deterministic", result.points, null, null);
      marked.push({
        questionAttemptId: qa.id,
        questionNumber: q.question_number,
        answerType: q.answer_type,
        maxMarks: qa.max_marks,
        awardedMarks: awarded,
        assessedOutOf: result.assessedOutOf,
        unassessedMarks: result.unassessedMarks,
        unassessedReason: result.unassessedReason,
        tier,
        confidence: "deterministic",
        points: result.points,
        note: result.unassessedReason
          ? `${result.unassessedMarks} mark${result.unassessedMarks === 1 ? "" : "s"} on this question could not be assessed — ${result.unassessedReason}.`
          : null,
      });
      continue;
    }

    // --- Tier 2 -----------------------------------------------------------
    const text = response && response.kind === "text" ? response.text.trim() : "";
    if (!text) {
      await persist(db, qa.id, 0, "requires_review", [], MARKING_MODEL, PROMPT_VERSION);
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
    await persist(db, qa.id, awarded, "requires_review", points, MARKING_MODEL, PROMPT_VERSION);
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
      note: null,
    });
  }

  const confirmed = marked.filter((m) => m.confidence === "deterministic");
  const provisional = marked.filter((m) => m.confidence === "requires_review");

  return {
    ok: true,
    data: {
      attemptId,
      confirmedAwarded: sum(confirmed.map((m) => m.awardedMarks ?? 0)),
      // assessedOutOf, NOT maxMarks. Tariff this marker could not reach is
      // excluded from the denominator as well as the numerator: counting it
      // would present unassessable marks as marks the student lost.
      confirmedAvailable: sum(confirmed.map((m) => m.assessedOutOf ?? 0)),
      provisionalAwarded: sum(provisional.map((m) => m.awardedMarks ?? 0)),
      provisionalAvailable: sum(provisional.map((m) => m.assessedOutOf ?? 0)),
      needsReviewAvailable: sum(marked.map((m) => m.unassessedMarks)),
      questions: marked,
    },
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

async function persist(
  db: ReturnType<typeof createAdminClient>,
  questionAttemptId: string,
  awarded: number,
  confidence: "deterministic" | "requires_review",
  points: PointVerdict[],
  modelVersion: string | null,
  promptVersion: string | null,
): Promise<void> {
  if (points.length > 0) {
    const { error } = await db.from("marking_results").upsert(
      points.map((p) => ({
        question_attempt_id: questionAttemptId,
        point_code: p.pointCode,
        awarded: p.awarded,
        evidence: p.evidence,
        model_version: modelVersion,
        prompt_version: promptVersion,
      })),
      { onConflict: "question_attempt_id,point_code" },
    );
    if (error) console.error(`[marking] marking_results: ${error.message}`);
  }

  const { error } = await db
    .from("question_attempts")
    .update({ awarded_marks: awarded, confidence, updated_at: new Date().toISOString() })
    .eq("id", questionAttemptId);
  if (error) console.error(`[marking] question_attempts: ${error.message}`);
}
