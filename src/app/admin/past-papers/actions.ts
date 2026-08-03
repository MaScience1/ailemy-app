"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const walkthroughMinsRaw = String(fd.get("walkthrough_duration_minutes") ?? "").trim();
  const walkthrough_duration_minutes = walkthroughMinsRaw
    ? Number(walkthroughMinsRaw)
    : null;
  const sortOrderRaw = String(fd.get("sort_order") ?? "").trim();
  const sort_order = sortOrderRaw ? Number(sortOrderRaw) : 0;
  const status = String(fd.get("status") ?? "live").trim();

  return {
    course_id,
    unit_id,
    slug,
    paper_name,
    year,
    session,
    paper_code,
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
  if (!fields.year || fields.year < 1900 || fields.year > 2200)
    return "Year must be a plausible integer";
  if (!["draft", "live", "in_progress", "coming_soon", "archived"].includes(fields.status))
    return "Invalid status";
  return null;
}

async function uploadIfPresent(
  supabase: ReturnType<typeof createAdminClient>,
  paperId: string,
  file: File | null,
  kind: "paper" | "markscheme" | "examiner-report",
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
  const safeExt = (ext ?? "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `papers/${paperId}/${kind}-${Date.now()}.${safeExt}`;
  const buf = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(PAPERS_BUCKET)
    .upload(path, new Uint8Array(buf), {
      contentType: file.type || "application/pdf",
      upsert: true,
    });
  if (error) throw new Error(`Upload failed (${kind}): ${error.message}`);
  return path;
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

    const supabase = createAdminClient();
    const { data: inserted, error: insertError } = await supabase
      .from("past_papers")
      .insert({
        course_id: fields.course_id,
        unit_id: fields.unit_id,
        slug: fields.slug,
        year: fields.year,
        session: fields.session,
        paper_code: fields.paper_code,
        paper_name: fields.paper_name,
        walkthrough_mux_playback_id: fields.walkthrough_mux_playback_id,
        walkthrough_duration_minutes: fields.walkthrough_duration_minutes,
        status: fields.status,
        sort_order: fields.sort_order,
      })
      .select("id")
      .single();
    if (insertError || !inserted)
      return { ok: false, error: insertError?.message ?? "Insert failed" };
    const paperId = inserted.id as string;

    const paperFile = fd.get("paper_file") as File | null;
    const msFile = fd.get("markscheme_file") as File | null;
    const erFile = fd.get("examiner_report_file") as File | null;
    let paper_pdf_path: string | null = null;
    let markscheme_pdf_path: string | null = null;
    let examiner_report_pdf_path: string | null = null;
    try {
      paper_pdf_path = await uploadIfPresent(supabase, paperId, paperFile, "paper");
      markscheme_pdf_path = await uploadIfPresent(
        supabase,
        paperId,
        msFile,
        "markscheme",
      );
      examiner_report_pdf_path = await uploadIfPresent(
        supabase,
        paperId,
        erFile,
        "examiner-report",
      );
    } catch (e) {
      await supabase.from("past_papers").delete().eq("id", paperId);
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Upload failed",
      };
    }

    if (paper_pdf_path || markscheme_pdf_path || examiner_report_pdf_path) {
      const paths: Record<string, string | null> = {
        paper_pdf_path,
        markscheme_pdf_path,
      };
      // Only send the examiner-report column when there is something to store,
      // so a database that has not yet had migration 0012 applied still accepts
      // question-paper / mark-scheme uploads instead of failing the whole write.
      if (examiner_report_pdf_path) {
        paths.examiner_report_pdf_path = examiner_report_pdf_path;
      }
      await supabase.from("past_papers").update(paths).eq("id", paperId);
    }

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
    const paperFile = fd.get("paper_file") as File | null;
    const msFile = fd.get("markscheme_file") as File | null;
    const erFile = fd.get("examiner_report_file") as File | null;
    let paper_pdf_path: string | null | undefined;
    let markscheme_pdf_path: string | null | undefined;
    let examiner_report_pdf_path: string | null | undefined;
    try {
      paper_pdf_path = await uploadIfPresent(supabase, paperId, paperFile, "paper");
      markscheme_pdf_path = await uploadIfPresent(
        supabase,
        paperId,
        msFile,
        "markscheme",
      );
      examiner_report_pdf_path = await uploadIfPresent(
        supabase,
        paperId,
        erFile,
        "examiner-report",
      );
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Upload failed",
      };
    }

    const patch: Record<string, unknown> = {
      course_id: fields.course_id,
      unit_id: fields.unit_id,
      slug: fields.slug,
      year: fields.year,
      session: fields.session,
      paper_code: fields.paper_code,
      paper_name: fields.paper_name,
      walkthrough_mux_playback_id: fields.walkthrough_mux_playback_id,
      walkthrough_duration_minutes: fields.walkthrough_duration_minutes,
      status: fields.status,
      sort_order: fields.sort_order,
    };
    if (paper_pdf_path !== null) patch.paper_pdf_path = paper_pdf_path;
    if (markscheme_pdf_path !== null) patch.markscheme_pdf_path = markscheme_pdf_path;
    // Same reasoning as createPastPaper: omit the column unless a file was
    // actually uploaded, so edits keep working before 0012 is applied.
    if (examiner_report_pdf_path) {
      patch.examiner_report_pdf_path = examiner_report_pdf_path;
    }

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
