"use server";

import {
  createAttempt,
  saveAnswer,
  setFlagged,
  submitAttempt,
  type ResponsePayload,
} from "@/lib/exam/attempts";
import { ANSWER_TYPES, type AnswerType } from "@/lib/exam/question-set";
import { narrowResponsePayload } from "@/lib/exam/response-payload";

/**
 * The player's server actions.
 *
 * Thin on purpose. Every rule lives in @/lib/exam/attempts so the mobile app
 * can reuse it; this file exists only to expose those functions to a browser
 * and to distrust what the browser sends.
 *
 * WHAT CROSSES THE BOUNDARY, AND WHAT CANNOT. The client sends a paper id, a
 * mode, a question_attempts id and an answer payload. It never sends what a
 * question is worth, whose attempt it is, or whether the attempt is still
 * open. max_marks is snapshotted by the database function; ownership is
 * enforced by RLS on every statement; submission state is enforced by a
 * trigger. A forged id here writes nothing — it is not trusted, it is simply
 * unable to match a row the caller owns.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

/** Reject anything that is not a plausible uuid before it reaches the database. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createAttemptAction(
  paperId: string,
  mode: "exam" | "practice",
): Promise<{ ok: true; attemptId: string } | { ok: false; error: string }> {
  if (!UUID_RE.test(paperId)) {
    return { ok: false, error: "That paper could not be found." };
  }
  if (mode !== "exam" && mode !== "practice") {
    return { ok: false, error: "Unknown mode." };
  }
  const result = await createAttempt(paperId, mode);
  return result.ok
    ? { ok: true, attemptId: result.data }
    : { ok: false, error: result.error };
}

export async function saveAnswerAction(
  questionAttemptId: string,
  answerType: string,
  payload: unknown,
): Promise<ActionResult> {
  if (!UUID_RE.test(questionAttemptId)) {
    return { ok: false, error: "That question could not be found." };
  }
  if (!ANSWER_TYPES.includes(answerType as AnswerType)) {
    return { ok: false, error: "Unknown answer type." };
  }
  const narrowed = narrowResponsePayload(payload);
  if (!narrowed) {
    return { ok: false, error: "That answer could not be read." };
  }

  const result = await saveAnswer(
    questionAttemptId,
    answerType as AnswerType,
    narrowed,
  );
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function setFlaggedAction(
  questionAttemptId: string,
  flagged: boolean,
): Promise<ActionResult> {
  if (!UUID_RE.test(questionAttemptId)) {
    return { ok: false, error: "That question could not be found." };
  }
  const result = await setFlagged(questionAttemptId, flagged === true);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function submitAttemptAction(
  attemptId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(attemptId)) {
    return { ok: false, error: "That attempt could not be found." };
  }
  const result = await submitAttempt(attemptId);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
