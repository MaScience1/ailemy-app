"use server";

import { revalidatePath } from "next/cache";

import {
  saveRulings,
  emitFixture,
  applyBatch,
  bulkApprove,
  addManualBlock,
  addManualLine,
  convertMisfiledLines,
  type SaveResult,
  type EmitResultReport,
  type BatchConfirmation,
  type BatchResult,
  type BulkApproveResult,
  type ManualBlockInput,
  type ManualBlockResult,
  type ManualLineInput,
  type ManualLineResult,
  type ConvertManyResult,
} from "@/lib/exam/markscheme-review";
import type { QuestionRulings } from "@/lib/exam/markscheme-proposals";

/**
 * ⚠ THE ACTION RE-CHECKS THE ROLE. It does not trust that the page rendered.
 *
 * A server action is a public endpoint: the fact that the page it was rendered
 * beside performed a check says nothing about who is calling it now. saveRulings
 * calls getStaffStatus itself, which reads user_roles through the caller's own
 * session — the same fact 0028's write policies check.
 */
export async function saveQuestionRulingsAction(
  paperSlug: string,
  questionNumber: string,
  rulings: QuestionRulings,
  /** The revision this tab last saw for this question. See saveRulings. */
  baseRevision?: number,
): Promise<SaveResult> {
  if (!paperSlug || !questionNumber) {
    return { ok: false, error: "Missing paper or question." };
  }

  // ⚠ APPROVAL IS PAIRED OR ABSENT, and it is checked HERE as well as in the
  // emitter. 0028 constrains regions the same way: a timestamp with no approver
  // is not interpretable, and a client that sent one half — a bug, a stale tab,
  // a hand-crafted request — must not create a row nobody can read.
  const half =
    Boolean(rulings.approvedAt) !== Boolean(rulings.approvedBy);
  if (half) {
    return {
      ok: false,
      error: "Approval needs both a timestamp and an approver, or neither.",
    };
  }

  const result = await saveRulings(paperSlug, questionNumber, rulings, baseRevision);
  if (result.ok) {
    revalidatePath(`/admin/papers/${paperSlug}/markscheme`);
  }
  return result;
}

/**
 * ⚠ RE-CHECKS THE ROLE, like the save action. A server action is a public
 * endpoint; the page having rendered says nothing about who is calling now.
 */
export async function emitFixtureAction(paperSlug: string): Promise<EmitResultReport> {
  if (!paperSlug) return { ok: false, error: "Missing paper." };
  return emitFixture(paperSlug);
}

/**
 * ⚠ EVERY ACTION BELOW RE-CHECKS THE ROLE inside its library function, for the
 * same reason saveQuestionRulingsAction does: a server action is a public
 * endpoint, and the page having rendered says nothing about who is calling now.
 */

/**
 * Write the batch the founder confirmed.
 *
 * ⚠ THE ARGUMENT IS A LIST OF TICKED LINES, NOT AN INSTRUCTION TO MATCH. The
 * matching happened in the browser, the founder saw every line beside its
 * verdict and source, and only what survived their untickings arrives here.
 * applyBatch re-checks each one against the file on disk anyway.
 */
export async function applyBatchAction(
  paperSlug: string,
  confirmations: BatchConfirmation[],
): Promise<BatchResult> {
  if (!paperSlug) {
    return { ok: false, applied: 0, skipped: [], errors: ["Missing paper."] };
  }
  const result = await applyBatch(paperSlug, confirmations);
  if (result.applied > 0) revalidatePath(`/admin/papers/${paperSlug}/markscheme`);
  return result;
}

/** Approve the questions the founder ticked. Eligibility is re-checked on disk. */
export async function bulkApproveAction(
  paperSlug: string,
  questionNumbers: string[],
  approvedBy: string,
): Promise<BulkApproveResult> {
  if (!paperSlug) {
    return { ok: false, approved: [], refused: [], errors: ["Missing paper."] };
  }
  const result = await bulkApprove(paperSlug, questionNumbers, approvedBy);
  if (result.approved.length > 0) revalidatePath(`/admin/papers/${paperSlug}/markscheme`);
  return result;
}

/** Add a block the extractor reported but could not propose — 21(b)(i). */
export async function addManualBlockAction(
  paperSlug: string,
  input: ManualBlockInput,
): Promise<ManualBlockResult> {
  if (!paperSlug) return { ok: false, error: "Missing paper." };
  const result = await addManualBlock(paperSlug, input);
  if (result.ok) revalidatePath(`/admin/papers/${paperSlug}/markscheme`);
  return result;
}

/**
 * Append a hand-transcribed line to an existing block.
 *
 * ⚠ IF THE QUESTION WAS APPROVED, THE APPROVAL IS WITHDRAWN — see addManualLine.
 * An approval must always refer to the content that was on screen when it was
 * given, and Emit gates on exactly that field.
 */
export async function addManualLineAction(
  paperSlug: string,
  input: ManualLineInput,
): Promise<ManualLineResult> {
  if (!paperSlug) return { ok: false, error: "Missing paper." };
  const result = await addManualLine(paperSlug, input);
  if (result.ok) revalidatePath(`/admin/papers/${paperSlug}/markscheme`);
  return result;
}

/**
 * Restore a whole selection of misfiled lines in one save.
 *
 * ⚠ THE SINGLE-LINE VERSION RELOADED AFTER EVERY RESTORE, and there are 61 of
 * these. A sweep that costs a page load per line is a sweep nobody finishes,
 * which leaves the sentences buried — the tool protecting nothing.
 */
export async function convertMisfiledLinesAction(
  paperSlug: string,
  lines: { questionNumber: string; text: string }[],
): Promise<ConvertManyResult> {
  if (!paperSlug) {
    return { ok: false, restored: [], skipped: [], approvalsWithdrawn: [], errors: ["Missing paper."] };
  }
  const result = await convertMisfiledLines(paperSlug, lines);
  if (result.restored.length > 0) revalidatePath(`/admin/papers/${paperSlug}/markscheme`);
  return result;
}
