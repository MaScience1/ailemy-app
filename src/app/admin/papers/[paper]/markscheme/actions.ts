"use server";

import { revalidatePath } from "next/cache";

import { saveRulings, type SaveResult } from "@/lib/exam/markscheme-review";
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

  const result = await saveRulings(paperSlug, questionNumber, rulings);
  if (result.ok) {
    revalidatePath(`/admin/papers/${paperSlug}/markscheme`);
  }
  return result;
}
