"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  examSessionsSentence,
  isExamSession,
} from "@/lib/catalogue/exam-sessions";
import {
  isUploadGroupId,
  readSubmittedPaperPath,
} from "@/lib/storage/paper-uploads";

const PAPERS_BUCKET = "papers";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function readFields(fd: FormData) {
  const course_id = String(fd.get("course_id") ?? "").trim();
  const unit_id = String(fd.get("unit_id") ?? "").trim() || null;
  const slug = String(fd.get("slug") ?? "").trim();
  const paper_name = String(fd.get("paper_name") ?? "").trim();
  const yearRaw = String(fd.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : NaN;
  const session = String(fd.get("session") ?? "").trim();
  const paper_code = String(fd.get("paper_code") ?? "").trim() || null;
  const walkthrough_mux_playback_id =
    String(fd.get("walkthrough_mux_playback_id") ?? "").trim() || null;
  // Exam facts (migration 0015). Blank means "not recorded yet", which is a
  // legitimate state — the results card omits the row and the test timer says
  // so — hence null rather than a default.
  const durationRaw = String(fd.get("duration_minutes") ?? "").trim();
  const duration_minutes = durationRaw ? Number(durationRaw) : null;
  const totalMarksRaw = String(fd.get("total_marks") ?? "").trim();
  const total_marks = totalMarksRaw ? Number(totalMarksRaw) : null;

  // The length of the walkthrough VIDEO — a different fact from
  // duration_minutes above, and deliberately left alone.
  const walkthroughMinsRaw = String(fd.get("walkthrough_duration_minutes") ?? "").trim();
  const walkthrough_duration_minutes = walkthroughMinsRaw
    ? Number(walkthroughMinsRaw)
    : null;
  const sortOrderRaw = String(fd.get("sort_order") ?? "").trim();
  const sort_order = sortOrderRaw ? Number(sortOrderRaw) : 0;
  const status = String(fd.get("status") ?? "live").trim();

  // The browser now uploads straight to Storage and submits only the object
  // path. Each is validated against the exact shape this app mints — a client
  // that chooses where it uploads must not be able to point a row at some
  // other object in the bucket. `null` on a field means "no file in this slot".
  const paperPath = readSubmittedPaperPath(fd.get("paper_pdf_path"));
  const msPath = readSubmittedPaperPath(fd.get("markscheme_pdf_path"));
  const erPath = readSubmittedPaperPath(fd.get("examiner_report_pdf_path"));
  const upload_group_id = String(fd.get("upload_group_id") ?? "").trim();

  return {
    course_id,
    unit_id,
    slug,
    paper_name,
    year,
    session,
    paper_code,
    duration_minutes,
    total_marks,
    paperPath,
    msPath,
    erPath,
    upload_group_id,
    walkthrough_mux_playback_id,
    walkthrough_duration_minutes,
    sort_order,
    status,
  };
}

function validate(fields: ReturnType<typeof readFields>): string | null {
  if (!fields.course_id) return "Course is required";
  if (!fields.slug) return "Slug is required";
  if (!/^[a-z0-9-]+$/.test(fields.slug))
    return "Slug must be lowercase letters, numbers and hyphens only";
  if (!fields.paper_name) return "Paper name is required";
  if (!fields.session) return "Session is required";
  // The dropdown is UI friction, not a guard — a crafted or replayed POST
  // reaches this action directly. The /past-papers filters match on the stored
  // string, so a single off-list value silently splits one session's papers
  // into two buckets. Rejecting here is the actual enforcement.
  if (!isExamSession(fields.session))
    return `Session must be ${examSessionsSentence()}`;
  if (!fields.year || fields.year < 1900 || fields.year > 2200)
    return "Year must be a plausible integer";
  // Optional, but if given must be a positive whole number. 0015 declares
  // CHECK (x IS NULL OR x > 0) on both, so an out-of-range value would
  // otherwise surface as a raw constraint-violation message. Number("abc") is
  // NaN, which Postgres rejects too — caught here for the same reason.
  for (const [label, value] of [
    ["Exam duration (minutes)", fields.duration_minutes],
    ["Total marks", fields.total_marks],
  ] as const) {
    if (value === null) continue;
    if (!Number.isInteger(value) || value < 1)
      return `${label} must be a whole number greater than zero, or left blank`;
  }
  // A malformed path means either a tampered submission or a bug in the upload
  // flow. Either way it must never reach the row.
  for (const [label, res] of [
    ["Question paper", fields.paperPath],
    ["Mark scheme", fields.msPath],
    ["Examiner report", fields.erPath],
  ] as const) {
    if (!res.ok) return `${label}: unrecognised upload path — re-attach the file`;
  }
  if (!["draft", "live", "in_progress", "coming_soon", "archived"].includes(fields.status))
    return "Invalid status";
  return null;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export async function createPastPaper(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await assertAdmin();
    const fields = readFields(fd);
    const err = validate(fields);
    if (err) return { ok: false, error: err };

    // The row id IS the upload group id, so the objects the browser already
    // wrote sit under a prefix that matches the row from the moment it exists.
    // Falling back to a server-minted id keeps a submission without any files
    // working even if the hidden field is missing.
    const paperId = isUploadGroupId(fields.upload_group_id)
      ? fields.upload_group_id
      : crypto.randomUUID();

    const supabase = createAdminClient();

    // One INSERT now — the paths are already known, so there is no upload step
    // between insert and update, and therefore no half-written row to unwind.
    const row: Record<string, unknown> = {
      id: paperId,
      course_id: fields.course_id,
      unit_id: fields.unit_id,
      slug: fields.slug,
      year: fields.year,
      session: fields.session,
      paper_code: fields.paper_code,
      paper_name: fields.paper_name,
      duration_minutes: fields.duration_minutes,
      total_marks: fields.total_marks,
      paper_pdf_path: fields.paperPath.ok ? fields.paperPath.path : null,
      markscheme_pdf_path: fields.msPath.ok ? fields.msPath.path : null,
      walkthrough_mux_playback_id: fields.walkthrough_mux_playback_id,
      walkthrough_duration_minutes: fields.walkthrough_duration_minutes,
      status: fields.status,
      sort_order: fields.sort_order,
    };
    // Only send the examiner-report column when there is something to store, so
    // a database without migration 0012 still accepts the other two slots.
    const erValue = fields.erPath.ok ? fields.erPath.path : null;
    if (erValue) row.examiner_report_pdf_path = erValue;

    const { error: insertError } = await supabase.from("past_papers").insert(row);
    if (insertError) return { ok: false, error: insertError.message };

    revalidatePath("/admin/past-papers");
    revalidatePath("/past-papers");
    return { ok: true, data: { id: paperId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------
export async function updatePastPaper(
  paperId: string,
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();
    const fields = readFields(fd);
    const err = validate(fields);
    if (err) return { ok: false, error: err };

    const supabase = createAdminClient();
    const patch: Record<string, unknown> = {
      course_id: fields.course_id,
      unit_id: fields.unit_id,
      slug: fields.slug,
      year: fields.year,
      session: fields.session,
      paper_code: fields.paper_code,
      paper_name: fields.paper_name,
      duration_minutes: fields.duration_minutes,
      total_marks: fields.total_marks,
      walkthrough_mux_playback_id: fields.walkthrough_mux_playback_id,
      walkthrough_duration_minutes: fields.walkthrough_duration_minutes,
      status: fields.status,
      sort_order: fields.sort_order,
      paper_pdf_path: fields.paperPath.ok ? fields.paperPath.path : null,
      markscheme_pdf_path: fields.msPath.ok ? fields.msPath.path : null,
    };

    // The form pre-fills each slot with the stored path, so an untouched form
    // resubmits what was already there and an empty field genuinely means the
    // admin pressed Remove. That replaces the old remove_* checkboxes.
    //
    // Examiner report is included whenever the form actually submitted the
    // field, which is what makes "Remove" able to clear it. Keying on presence
    // rather than on truthiness is the difference between clearing a slot and
    // silently leaving the old path in place.
    //
    // This does mean the admin WRITE path now requires migration 0012. That is
    // already applied here, and the read path in past-paper-filters.ts still
    // degrades on its own; the alternative was a hidden "was it set" flag that
    // the form would have had to invent.
    const erValue = fields.erPath.ok ? fields.erPath.path : null;
    if (fd.has("examiner_report_pdf_path")) {
      patch.examiner_report_pdf_path = erValue;
    }

    // NOTE: clearing a slot drops the REFERENCE, not the object. The PDF stays
    // in the bucket, so a mistaken removal is recoverable and a file shared by
    // another row cannot be pulled out from under it. See migration 0016 for
    // the orphan sweep.

    const { error: updateError } = await supabase
      .from("past_papers")
      .update(patch)
      .eq("id", paperId);
    if (updateError) return { ok: false, error: updateError.message };

    revalidatePath("/admin/past-papers");
    revalidatePath("/past-papers");
    revalidatePath(`/admin/past-papers/${paperId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
export async function deletePastPaper(
  paperId: string,
): Promise<{ error?: string }> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();

    const { data: files } = await supabase.storage
      .from(PAPERS_BUCKET)
      .list(`papers/${paperId}`);
    if (files && files.length > 0) {
      const paths = files.map((f) => `papers/${paperId}/${f.name}`);
      const { error } = await supabase.storage.from(PAPERS_BUCKET).remove(paths);
      if (error) console.error("[admin/past-papers] storage cleanup failed", error);
    }

    const { error } = await supabase.from("past_papers").delete().eq("id", paperId);
    if (error) return { error: error.message };
    revalidatePath("/admin/past-papers");
    revalidatePath("/past-papers");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// PUBLISH / UNPUBLISH
// ---------------------------------------------------------------------------
export async function setPastPaperStatus(
  paperId: string,
  status: "live" | "draft",
): Promise<{ error?: string }> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("past_papers")
      .update({ status })
      .eq("id", paperId);
    if (error) return { error: error.message };
    revalidatePath("/admin/past-papers");
    revalidatePath("/past-papers");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
