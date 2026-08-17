import "server-only";

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getStaffStatus } from "@/lib/admin/staff";
import { createClient } from "@/lib/supabase/server";
import { getPaperPublicUrl } from "@/lib/storage/papers";
import { mergeBatchIntoBook } from "@/lib/exam/precedent";
import {
  buildReview,
  sortForReview,
  countUnruled,
  countApproved,
  nextRevision,
  toFixture,
  emitFixtureSource,
  pointsFullyRuled,
  isResolved,
  type LineKind,
  type LineRuling,
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

/**
 * Which questions wear the VERIFIED badge.
 *
 * ⚠ A UNION, SO THE BADGE CAN ONLY EVER BE GAINED. The five hand-transcribed
 * questions keep it because the claim they carry — "an independent
 * transcription agreed with this" — is still true and is not something a
 * reviewer can re-earn by clicking. Everything else earns it by having every
 * proposed marking point explicitly ruled, which is the white card being
 * accepted rather than defaulted through.
 *
 * That is why single-pass approval left it unstamped: it was a hardcoded list
 * of five, so Q3 and Q4 could show APPROVED and never VERIFIED however
 * carefully they were reviewed.
 *
 * ⚠ DISPLAY ONLY. toFixture does not read this, and Emit still gates on
 * approvedAt/approvedBy and unruled lines exactly as before.
 */
function verifiedFor(set: ProposalSet, rulings: RulingBook): string[] {
  const out = new Set(HAND_VERIFIED);
  for (const q of set.questions) {
    if (pointsFullyRuled(q, rulings[q.questionNumber])) out.add(q.questionNumber);
  }
  return [...out];
}

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
      verifiedQuestions: verifiedFor(file, file.rulings ?? {}),
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

export type EmitResultReport =
  | { ok: true; path: string; questions: number; bytes: number }
  | { ok: false; error: string; refusals?: string[] };

/**
 * Turn approved rulings into a fixture module the seeder can load.
 *
 * ============================================================================
 * ⚠ IT WRITES TO A `.generated.ts` PATH AND NOWHERE ELSE
 * ============================================================================
 * `scripts/exam-seed/wch11-01-2025-may-june.ts` is HAND-TRANSCRIBED. It is the
 * source of truth for the five questions the extractor is measured against,
 * and it is imported by seven files — the seeder and five test suites, one of
 * which (markscheme-verified) exists precisely to compare the extractor's
 * output to it. Overwriting it would destroy the only independent record of
 * what the right answer is, AND make the test that would have caught the
 * damage compare the extractor to itself.
 *
 * So the target path is derived from the slug, forced to `.generated.ts`, and
 * checked against that suffix before a single byte is written. A generated
 * file and a transcribed one never share a name.
 *
 * ⚠ AND IT REFUSES IN PRODUCTION, like saveRulings, because this writes to the
 * repository working tree — which a deployed instance does not have.
 */
export async function emitFixture(paperSlug: string): Promise<EmitResultReport> {
  const staff = await getStaffStatus();
  if (!staff.ok || !canWriteFrom(staff.roles)) {
    return { ok: false, error: "Emitting a fixture needs a marker or admin role." };
  }
  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      error:
        "A fixture is written into the repository working tree, which a deployed instance does not have. Run this tool locally.",
    };
  }

  let file: StoredFile;
  try {
    file = JSON.parse(await readFile(proposalsPath(paperSlug), "utf8")) as StoredFile;
  } catch (e) {
    return { ok: false, error: `Could not read the proposals file: ${e instanceof Error ? e.message : String(e)}` };
  }

  const result = toFixture(file, file.rulings ?? {});
  if (!result.ok) {
    // ⚠ THE REFUSALS ARE THE ANSWER, NOT AN ERROR. toFixture declines a
    // question that is unapproved, has an unruled line, or has no tariff — and
    // naming which is what tells a reviewer where to go next.
    return { ok: false, error: "Nothing was emitted — some questions are not ready.", refusals: result.refusals };
  }

  const target = resolve(process.cwd(), "scripts/exam-seed", `${paperSlug}.generated.ts`);
  if (!target.endsWith(".generated.ts")) {
    return { ok: false, error: "Refusing to write: the target is not a .generated.ts path." };
  }

  const source = emitFixtureSource(result, paperSlug, new Date().toISOString());
  try {
    await writeFile(target, source, "utf8");
  } catch (e) {
    return { ok: false, error: `Could not write the fixture: ${e instanceof Error ? e.message : String(e)}` };
  }
  return {
    ok: true,
    path: `scripts/exam-seed/${paperSlug}.generated.ts`,
    questions: result.questions.length,
    bytes: source.length,
  };
}

// ============================================================================
// BATCH APPLY AND BULK APPROVE
// ============================================================================

/** One line the founder ticked on the batch review screen. */
export type BatchConfirmation = {
  questionNumber: string;
  sourceLine: string;
  kind: LineKind;
  option?: string;
  precedentId?: string;
};

export type BatchResult = {
  ok: boolean;
  applied: number;
  /** Lines deliberately not written, each with the reason. Never silent. */
  skipped: { questionNumber: string; sourceLine: string; reason: string }[];
  errors: string[];
};

/**
 * Write a batch of confirmed rulings — through saveRulings, one question at a
 * time, exactly as manual ruling does.
 *
 * ============================================================================
 * ⚠ THIS FUNCTION IS THE FOUNDER PRESSING CONFIRM. IT IS NOT A DECISION.
 * ============================================================================
 * Every entry in `confirmations` is a line they saw in full, beside its target
 * verdict and its source location, and left ticked. Nothing computes its way
 * into this list — the planner produces candidates, the screen shows them, and
 * only what survives the founder's untickings arrives here.
 *
 * ⚠ THE SAME CODE PATH, AND THAT IS LOAD-BEARING. saveRulings owns the
 * revision check, the re-read, the production refusal and the per-question
 * write. A batch writer that opened the file itself would be a second set of
 * those guarantees to keep correct, and the first one to drift would do so
 * silently, on the path that writes the most rows at once.
 *
 * ⚠ THREE REFUSALS, EACH RECORDED RATHER THAN SWALLOWED:
 *   - an APPROVED question is never touched, at all;
 *   - a line that already carries a ruling is never overwritten;
 *   - a distractor ruling with no valid option is not written, because
 *     isResolved would call it unresolved and the founder would be told the
 *     question was finished when it was not.
 */
export async function applyBatch(
  paperSlug: string,
  confirmations: readonly BatchConfirmation[],
): Promise<BatchResult> {
  const staff = await getStaffStatus();
  if (!staff.ok || !canWriteFrom(staff.roles)) {
    return { ok: false, applied: 0, skipped: [], errors: ["Ruling needs a marker or admin role."] };
  }
  if (confirmations.length === 0) {
    return { ok: true, applied: 0, skipped: [], errors: [] };
  }

  let file: StoredFile;
  try {
    file = JSON.parse(await readFile(proposalsPath(paperSlug), "utf8")) as StoredFile;
  } catch (e) {
    return { ok: false, applied: 0, skipped: [], errors: [`Could not read the proposals file: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const byQuestion = new Map<string, BatchConfirmation[]>();
  for (const c of confirmations) {
    if (!byQuestion.has(c.questionNumber)) byQuestion.set(c.questionNumber, []);
    byQuestion.get(c.questionNumber)!.push(c);
  }

  const skipped: BatchResult["skipped"] = [];
  const errors: string[] = [];
  let applied = 0;

  for (const [questionNumber, entries] of byQuestion) {
    const existing = (file.rulings ?? {})[questionNumber];

    // ⚠ AN APPROVED QUESTION IS FINISHED WORK. Adding to it would change a
    // mark scheme a human has already signed, without them looking at it.
    // ⚠ THE DECISION IS mergeBatchIntoBook's, and it is pure and tested. This
    // function supplies the disk and the session; it does not re-implement the
    // refusals, because two copies of a rule protecting examiner work is one
    // copy too many.
    const merged = mergeBatchIntoBook(existing, entries.map((e) => ({
      sourceLine: e.sourceLine, kind: e.kind, option: e.option, precedentId: e.precedentId,
    })), (r) => isResolved(r as LineRuling));
    const lines = merged.lines as Record<string, LineRuling>;
    const added = merged.added;
    for (const s2 of merged.skipped) {
      skipped.push({ questionNumber, sourceLine: s2.sourceLine, reason: s2.reason });
    }

    if (added === 0) continue;

    // ⚠ APPROVAL IS NOT CARRIED ALONG. Batch fills in rulings; approving stays
    // a separate, deliberate act. `existing` is unapproved here by the check
    // above, so there is nothing to preserve, and nothing is invented.
    const result = await saveRulings(
      paperSlug,
      questionNumber,
      { points: existing?.points ?? {}, lines },
      existing?.revision ?? 0,
    );
    if (result.ok) applied += added;
    else errors.push(`${questionNumber}: ${result.error}`);
  }

  return { ok: errors.length === 0, applied, skipped, errors };
}

export type BulkApproveResult = {
  ok: boolean;
  approved: string[];
  refused: { questionNumber: string; reason: string }[];
  errors: string[];
};

/**
 * Approve several fully-resolved questions at once, through saveRulings.
 *
 * ⚠ IT RE-CHECKS ELIGIBILITY SERVER-SIDE rather than trusting the screen. The
 * list the founder ticked was computed from a view that may be minutes old; a
 * question that has since gained an unruled line must not be approved because
 * a stale tab thought it was finished. Emit gating and the reconciliation
 * guard are untouched — this only sets the same two fields the single Approve
 * button sets, and lets saveRulings increment the revision as it always does.
 */
export async function bulkApprove(
  paperSlug: string,
  questionNumbers: readonly string[],
  approvedBy: string,
): Promise<BulkApproveResult> {
  const staff = await getStaffStatus();
  if (!staff.ok || !canWriteFrom(staff.roles)) {
    return { ok: false, approved: [], refused: [], errors: ["Approving needs a marker or admin role."] };
  }
  if (!approvedBy) {
    return { ok: false, approved: [], refused: [], errors: ["An approver is required."] };
  }

  let file: StoredFile;
  try {
    file = JSON.parse(await readFile(proposalsPath(paperSlug), "utf8")) as StoredFile;
  } catch (e) {
    return { ok: false, approved: [], refused: [], errors: [`Could not read the proposals file: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const approved: string[] = [];
  const refused: BulkApproveResult["refused"] = [];
  const errors: string[] = [];

  for (const questionNumber of questionNumbers) {
    const question = file.questions.find((q) => q.questionNumber === questionNumber);
    if (!question) {
      refused.push({ questionNumber, reason: "not in this proposal set" });
      continue;
    }
    const book = (file.rulings ?? {})[questionNumber];
    if (book?.approvedAt) {
      refused.push({ questionNumber, reason: "already approved — left as it was" });
      continue;
    }

    // ⚠ THE SAME TWO CONDITIONS THE SINGLE APPROVE BUTTON ENFORCES, read from
    // disk. Every yellow line resolved, and every white card explicitly ruled.
    const unruled = question.requiresRuling.filter((l) => !isResolved(book?.lines?.[l.sourceLine]));
    if (unruled.length > 0) {
      refused.push({ questionNumber, reason: `${unruled.length} line(s) still need a ruling` });
      continue;
    }
    if (!pointsFullyRuled(question, book)) {
      refused.push({ questionNumber, reason: "a marking point has not been ruled on" });
      continue;
    }

    const result = await saveRulings(
      paperSlug,
      questionNumber,
      {
        points: book?.points ?? {},
        lines: book?.lines ?? {},
        approvedAt: new Date().toISOString(),
        approvedBy,
      },
      book?.revision ?? 0,
    );
    if (result.ok) approved.push(questionNumber);
    else errors.push(`${questionNumber}: ${result.error}`);
  }

  return { ok: errors.length === 0, approved, refused, errors };
}
