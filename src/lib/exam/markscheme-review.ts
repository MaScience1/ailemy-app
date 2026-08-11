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
  nextRevision,
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
  /** Everything already ruled, so a refresh restores the screen. */
  rulings: RulingBook;
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

  // ⚠ A SLUG IS NOT UNIQUE, AND .maybeSingle() ON ONE IS A BUG.
  //
  // This is the same lesson regions.ts already learned, and this file was
  // written afterwards without inheriting it — a second lookup instead of a
  // reuse. `slug` is unique within a COURSE: "unit-1-may-june-2025" is
  // Chemistry WCH11/01, Physics WPH11/01 and Biology WBI11/01. Across the
  // catalogue 72 of 90 slugs sit on more than one row.
  //
  // So .maybeSingle() raised PGRST116 — "multiple (or no) rows returned" — and
  // the page rendered "We couldn't load this paper" for EVERY paper. It failed
  // in the right direction, which is why it was survivable: it refused rather
  // than picking a subject at random and showing a Chemistry reviewer the
  // Biology mark scheme. But it never once worked.
  //
  // An id needs no guess. A slug is disambiguated the way regions.ts does it:
  // prefer the candidate that actually has a proposal set and questions.
  const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    paperSlug,
  );
  const query = db
    .from("past_papers")
    .select("id, slug, paper_name, paper_code, markscheme_pdf_path");
  const { data: papers, error } = await (looksLikeId
    ? query.eq("id", paperSlug)
    : query.eq("slug", paperSlug));

  // ⚠ AN ERROR IS OURS; AN ABSENT ROW IS THEIRS. Folding them together sends
  // someone hunting for a catalogue problem that does not exist.
  if (error) {
    return { ok: false, reason: "unavailable", detail: `${error.code ?? "?"}: ${error.message}` };
  }
  const candidates = (papers ?? []) as {
    id: string;
    slug: string;
    paper_name: string;
    paper_code: string | null;
    markscheme_pdf_path: string | null;
  }[];
  if (candidates.length === 0) return { ok: false, reason: "not_found" };

  // With several subjects sharing the slug, the one this tool means is the one
  // whose questions have been seeded — an unseeded paper has nothing for a
  // mark scheme to attach to. That is a guess, and the way not to guess is to
  // put the id in the URL.
  let paper = candidates[0];
  if (candidates.length > 1) {
    const { data: counts } = await db
      .from("paper_questions")
      .select("paper_id")
      .in("paper_id", candidates.map((p) => p.id));
    const seeded = new Set((counts ?? []).map((r: { paper_id: string }) => r.paper_id));
    paper = candidates.find((p) => seeded.has(p.id)) ?? candidates[0];
  }

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
      // ⚠ THE STORED RULINGS THEMSELVES, NOT JUST THE COUNTS.
      //
      // The client seeds its draft from this on mount, which is what makes a
      // mid-session refresh survivable. Without it the page came back with an
      // empty draft: every radio unselected and every line counted as still
      // needing a ruling, on a question that had been saved ten minutes
      // earlier. The work was on disk the whole time — the screen just could
      // not see it, which is the version of losing an hour that also makes you
      // do the hour again.
      rulings: file.rulings ?? {},
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

export type SaveResult =
  | { ok: true; revision: number }
  /**
   * `conflict` is set only when another writer got there first. Every other
   * failure is a plain error. They are distinguished because the RECOVERY is
   * different: a conflict means "look at the other version before you retry",
   * everything else means "try again".
   */
  | { ok: false; error: string; conflict?: boolean };

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
  /**
   * The revision this client last SAW for this question. Undefined means "I
   * believe nobody has ruled on it yet".
   *
   * ⚠ THIS IS THE ONLY THING STANDING BETWEEN TWO TABS AND A SILENT
   * OVERWRITE. The read-modify-write below re-reads the file, so a save to
   * question 14 never clobbers question 15 — but two tabs on the SAME question
   * were last-write-wins, and the tab that lost was never told. A reviewer who
   * rules on 22(c) in one tab, refines it in another, and saves the first
   * would have watched the refinement disappear with a green "saved" next to
   * it.
   */
  baseRevision?: number,
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

  // ⚠ COMPARED AGAINST WHAT IS ON DISK RIGHT NOW, re-read a few lines above.
  // Comparing against anything the client sent would be asking the tab whose
  // write we are trying to validate whether its write is valid.
  const verdict = nextRevision((file.rulings ?? {})[questionNumber], baseRevision);
  if (!verdict.ok) {
    return {
      ok: false,
      conflict: true,
      error:
        `${questionNumber} was changed somewhere else after this tab loaded it ` +
        `(this tab has revision ${verdict.clientRevision}, the file has ${verdict.diskRevision}). ` +
        `Your ruling has NOT been saved and is still on screen. Reload to see the other version — ` +
        `reloading will replace what is in front of you, so copy anything you want to keep first.`,
    };
  }

  file.rulings = {
    ...(file.rulings ?? {}),
    [questionNumber]: { ...rulings, revision: verdict.revision },
  };

  try {
    await writeFile(path, JSON.stringify(file, null, 2) + "\n", "utf8");
  } catch (e) {
    return { ok: false, error: `Could not write the proposals file: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true, revision: verdict.revision };
}
