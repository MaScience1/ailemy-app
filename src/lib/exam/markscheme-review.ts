import "server-only";

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getStaffStatus } from "@/lib/admin/staff";
import { createClient } from "@/lib/supabase/server";
import { getPaperPublicUrl } from "@/lib/storage/papers";
import {
  buildReview,
  sortForReview,
  countUnruled,
  countApproved,
  type ProposalSet,
  type RulingBook,
  type ReviewItem,
} from "@/lib/exam/markscheme-proposals";

/**
 * Loading and persisting mark-scheme review state.
 *
 * ============================================================================
 * ⚠ RULINGS LIVE IN A FILE, NOT IN A TABLE, AND THAT IS THE POINT
 * ============================================================================
 * There is no `markscheme_proposals` table and this does not add one. Adding
 * schema for review state would put half-reviewed examiner prose into the same
 * database that decides student marks, before anybody had agreed it was right.
 *
 * So the proposal set and its rulings are a working FILE under
 * scripts/exam-seed/proposals/, and approval EMITS A FIXTURE which the seeder —
 * already idempotent, journalled, dry-run-first, and already refusing to
 * overwrite a human approval — writes. Nothing here writes a production row.
 *
 * ⚠ THE COST OF THAT CHOICE, STATED PLAINLY: this is a LOCAL AUTHORING TOOL. It
 * writes to the repository working tree, so it works when the app is run on the
 * machine that holds the repo and does not work on a deployed instance, where
 * the filesystem is read-only and ephemeral. saveRulings() refuses outright in
 * production rather than appearing to save and losing the work. A reviewer who
 * loses an hour of rulings to a silent no-op would be right never to trust it
 * again.
 *
 * ============================================================================
 * GATED ON ROLES, NOT ON ADMIN_EMAIL
 * ============================================================================
 * getStaffStatus reads user_roles through the caller's own session — the same
 * fact 0028's write policies check. It does NOT call is_staff(); 0033 removed
 * that function's email arm, and this page never depended on it.
 */

export type ReviewData = {
  paperId: string;
  paperSlug: string;
  paperName: string;
  paperCode: string | null;
  /** The MARK SCHEME pdf, not the question paper. */
  markSchemeUrl: string | null;
  items: ReviewItem[];
  unruled: number;
  approved: number;
  total: number;
  /** Questions already transcribed by hand and seeded — the accuracy evidence. */
  verifiedQuestions: string[];
  roles: string[];
  canWrite: boolean;
  /** False on a deployed instance: rulings cannot be persisted there. */
  canPersist: boolean;
};

export type ReviewResult =
  | { ok: true; data: ReviewData }
  | { ok: false; reason: "not_staff" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "no_proposals"; detail: string }
  | { ok: false; reason: "unavailable"; detail: string };

/**
 * The five questions transcribed by hand on Day 0 and seeded.
 *
 * Shown alongside the rest so a reviewer can watch the extractor agree with
 * their own transcription before trusting it on the other 42. Confidence in a
 * tool is earned on cases where the answer is already known.
 */
const HAND_VERIFIED = ["1", "2", "20(a)", "20(b)(iii)", "22(c)"];

const canWriteFrom = (roles: readonly string[]) =>
  roles.includes("marker") || roles.includes("admin");

/**
 * ⚠ KEYED ON THE PAPER SLUG, NOT THE PAPER CODE, and they are not the same.
 * WCH11/01 May-June 2025 has paper_code "WCH11/01" and slug
 * "unit-1-may-june-2025". The first version of this file was named after the
 * code, so the loader looked for a file that did not exist and the page would
 * have reported "nobody has run the extractor yet" forever — an honest-sounding
 * message about the wrong thing. The URL carries the slug; so does the file.
 */
const proposalsPath = (slug: string) =>
  resolve(process.cwd(), "scripts/exam-seed/proposals", `${slug}.markscheme.json`);

type StoredFile = ProposalSet & { rulings?: RulingBook };

export async function getMarkSchemeReview(paperSlug: string): Promise<ReviewResult> {
  const staff = await getStaffStatus();
  if (!staff.ok) {
    return staff.reason === "unavailable"
      ? { ok: false, reason: "unavailable", detail: staff.detail ?? "staff status could not be read" }
      : { ok: false, reason: "not_staff" };
  }

  const db = await createClient();
  const { data: paper, error } = await db
    .from("past_papers")
    .select("id, slug, paper_name, paper_code, markscheme_pdf_path")
    .eq("slug", paperSlug)
    .maybeSingle();

  // ⚠ AN ERROR IS OURS; AN ABSENT ROW IS THEIRS. Folding them together sends
  // someone hunting for a catalogue problem that does not exist.
  if (error) {
    return { ok: false, reason: "unavailable", detail: `${error.code ?? "?"}: ${error.message}` };
  }
  if (!paper) return { ok: false, reason: "not_found" };

  let file: StoredFile;
  try {
    file = JSON.parse(await readFile(proposalsPath(paperSlug), "utf8")) as StoredFile;
  } catch (e) {
    // Not an outage and not a missing paper — nobody has run the extractor yet.
    // Saying so is more useful than either of the other two answers.
    return {
      ok: false,
      reason: "no_proposals",
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  const items = sortForReview(buildReview(file, file.rulings ?? {}));

  return {
    ok: true,
    data: {
      paperId: paper.id,
      paperSlug: paper.slug,
      paperName: paper.paper_name,
      paperCode: paper.paper_code,
      markSchemeUrl: getPaperPublicUrl(paper.markscheme_pdf_path),
      items,
      unruled: countUnruled(items),
      approved: countApproved(items),
      total: items.length,
      verifiedQuestions: HAND_VERIFIED,
      roles: staff.roles,
      canWrite: canWriteFrom(staff.roles),
      canPersist: process.env.NODE_ENV !== "production",
    },
  };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Persist one question's rulings.
 *
 * ⚠ READ-MODIFY-WRITE OF THE WHOLE FILE, and it re-reads first rather than
 * trusting a copy the client sent. The client holds a view that may be minutes
 * old; writing its whole book back would silently undo a ruling made in another
 * tab. Only the named question is replaced.
 */
export async function saveRulings(
  paperSlug: string,
  questionNumber: string,
  rulings: RulingBook[string],
): Promise<SaveResult> {
  const staff = await getStaffStatus();
  // ⚠ THE SAME PAIR 0028's write policies check. A page that let a teacher save
  // would be a page whose writes the database then refuses.
  if (!staff.ok || !canWriteFrom(staff.roles)) {
    return { ok: false, error: "Saving a ruling needs a marker or admin role." };
  }
  if (process.env.NODE_ENV === "production") {
    // Refused loudly rather than no-oped. A save that appears to work and
    // silently discards an hour of rulings is worse than one that refuses.
    return {
      ok: false,
      error:
        "Rulings are written to the repository working tree, which a deployed instance does not have. Run this tool locally.",
    };
  }

  const path = proposalsPath(paperSlug);
  let file: StoredFile;
  try {
    file = JSON.parse(await readFile(path, "utf8")) as StoredFile;
  } catch (e) {
    return { ok: false, error: `Could not read the proposals file: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!file.questions.some((q) => q.questionNumber === questionNumber)) {
    return { ok: false, error: `${questionNumber} is not in this proposal set.` };
  }

  file.rulings = { ...(file.rulings ?? {}), [questionNumber]: rulings };

  try {
    await writeFile(path, JSON.stringify(file, null, 2) + "\n", "utf8");
  } catch (e) {
    return { ok: false, error: `Could not write the proposals file: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true };
}
