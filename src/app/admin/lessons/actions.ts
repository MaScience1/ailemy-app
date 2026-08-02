"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ASSETS_BUCKET = "assets";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Extract non-file fields from a lesson FormData submission and coerce them.
 * Kept separate from the file-handling paths so both create and update read
 * from a single source of truth.
 */
function readLessonFields(fd: FormData) {
  const title = String(fd.get("title") ?? "").trim();
  const slug = String(fd.get("slug") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim() || null;
  const status = String(fd.get("status") ?? "draft").trim();
  const access = String(fd.get("access") ?? "paid").trim();
  const courseId = String(fd.get("course_id") ?? "").trim() || null;
  const unitId = String(fd.get("unit_id") ?? "").trim() || null;
  const topicId = String(fd.get("topic_id") ?? "").trim() || null;
  const lessonNumberRaw = String(fd.get("lesson_number") ?? "").trim();
  const lessonNumber = lessonNumberRaw ? Number(lessonNumberRaw) : null;
  const sortOrderRaw = String(fd.get("sort_order") ?? "").trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
  const voiceMux = String(fd.get("voice_video_mux_id") ?? "").trim() || null;
  const worksheetMux = String(fd.get("worksheet_video_mux_id") ?? "").trim() || null;
  const animatedMux = String(fd.get("animated_video_mux_id") ?? "").trim() || null;
  const specPointIds = fd.getAll("spec_point_ids").map(String).filter(Boolean);

  return {
    title,
    slug,
    description,
    status,
    access,
    course_id: courseId,
    unit_id: unitId,
    topic_id: topicId,
    lesson_number: lessonNumber,
    sort_order: sortOrder,
    voice_video_mux_id: voiceMux,
    worksheet_video_mux_id: worksheetMux,
    animated_video_mux_id: animatedMux,
    specPointIds,
  };
}

function validate(fields: ReturnType<typeof readLessonFields>): string | null {
  if (!fields.title) return "Title is required";
  if (!fields.slug) return "Slug is required";
  if (!/^[a-z0-9-]+$/.test(fields.slug)) {
    return "Slug must be lowercase letters, numbers and hyphens only";
  }
  if (!["draft", "live", "in_progress", "coming_soon", "archived"].includes(fields.status)) {
    return "Invalid status";
  }
  if (!["free", "paid"].includes(fields.access)) {
    return "Invalid access value";
  }
  return null;
}

async function uploadIfPresent(
  supabase: ReturnType<typeof createAdminClient>,
  lessonId: string,
  file: File | null,
  kind: "deck" | "thumbnail",
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const safeExt = (ext ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `lessons/${lessonId}/${kind}-${Date.now()}.${safeExt}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(path, new Uint8Array(arrayBuffer), {
      contentType: file.type || undefined,
      upsert: true,
    });
  if (error) {
    throw new Error(`Upload failed (${kind}): ${error.message}`);
  }
  return path;
}

async function syncSpecPoints(
  supabase: ReturnType<typeof createAdminClient>,
  lessonId: string,
  specPointIds: string[],
): Promise<void> {
  await supabase.from("lesson_spec_points").delete().eq("lesson_id", lessonId);
  if (specPointIds.length > 0) {
    const rows = specPointIds.map((sp) => ({
      lesson_id: lessonId,
      spec_point_id: sp,
    }));
    const { error } = await supabase.from("lesson_spec_points").insert(rows);
    if (error) throw new Error(`Linking spec points failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export async function createLesson(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await assertAdmin();

    const fields = readLessonFields(formData);
    const err = validate(fields);
    if (err) return { ok: false, error: err };

    const supabase = createAdminClient();

    // 1. Insert lesson row to get an ID for storage pathing.
    const { data: inserted, error: insertError } = await supabase
      .from("lessons")
      .insert({
        title: fields.title,
        slug: fields.slug,
        description: fields.description,
        status: fields.status,
        access: fields.access,
        course_id: fields.course_id,
        unit_id: fields.unit_id,
        lesson_number: fields.lesson_number,
        sort_order: fields.sort_order,
        voice_video_mux_id: fields.voice_video_mux_id,
        worksheet_video_mux_id: fields.worksheet_video_mux_id,
        animated_video_mux_id: fields.animated_video_mux_id,
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      return { ok: false, error: insertError?.message ?? "Insert failed" };
    }
    const lessonId = inserted.id as string;

    // 2. Upload any provided files under the id-scoped path.
    const deckFile = formData.get("deck_file") as File | null;
    const thumbFile = formData.get("thumbnail_file") as File | null;
    let deckPath: string | null = null;
    let thumbPath: string | null = null;
    try {
      deckPath = await uploadIfPresent(supabase, lessonId, deckFile, "deck");
      thumbPath = await uploadIfPresent(supabase, lessonId, thumbFile, "thumbnail");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      // Roll back the DB row so we don't leave an orphan with no assets.
      await supabase.from("lessons").delete().eq("id", lessonId);
      return { ok: false, error: msg };
    }

    // 3. Patch the row with file paths + link spec points.
    if (deckPath || thumbPath) {
      await supabase
        .from("lessons")
        .update({
          deck_path: deckPath,
          thumbnail_path: thumbPath,
        })
        .eq("id", lessonId);
    }

    try {
      await syncSpecPoints(supabase, lessonId, fields.specPointIds);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Linking spec points failed";
      return { ok: false, error: msg };
    }

    revalidatePath("/admin/lessons");
    return { ok: true, data: { id: lessonId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------
export async function updateLesson(
  lessonId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await assertAdmin();

    const fields = readLessonFields(formData);
    const err = validate(fields);
    if (err) return { ok: false, error: err };

    const supabase = createAdminClient();

    // Uploads (only if a new file was provided; empty file inputs come through
    // as zero-size Files, which uploadIfPresent skips).
    const deckFile = formData.get("deck_file") as File | null;
    const thumbFile = formData.get("thumbnail_file") as File | null;
    let deckPath: string | null | undefined;
    let thumbPath: string | null | undefined;
    try {
      deckPath = await uploadIfPresent(supabase, lessonId, deckFile, "deck");
      thumbPath = await uploadIfPresent(supabase, lessonId, thumbFile, "thumbnail");
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
    }

    const patch: Record<string, unknown> = {
      title: fields.title,
      slug: fields.slug,
      description: fields.description,
      status: fields.status,
      access: fields.access,
      course_id: fields.course_id,
      unit_id: fields.unit_id,
      lesson_number: fields.lesson_number,
      sort_order: fields.sort_order,
      voice_video_mux_id: fields.voice_video_mux_id,
      worksheet_video_mux_id: fields.worksheet_video_mux_id,
      animated_video_mux_id: fields.animated_video_mux_id,
    };
    if (deckPath !== null) patch.deck_path = deckPath;
    if (thumbPath !== null) patch.thumbnail_path = thumbPath;

    const { error: updateError } = await supabase
      .from("lessons")
      .update(patch)
      .eq("id", lessonId);
    if (updateError) return { ok: false, error: updateError.message };

    try {
      await syncSpecPoints(supabase, lessonId, fields.specPointIds);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Linking spec points failed",
      };
    }

    revalidatePath("/admin/lessons");
    revalidatePath(`/admin/lessons/${lessonId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
export async function deleteLesson(
  lessonId: string,
): Promise<{ error?: string }> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();

    // Best-effort cleanup of storage objects. list() returns everything under
    // the id-scoped prefix regardless of naming convention.
    const { data: files } = await supabase.storage
      .from(ASSETS_BUCKET)
      .list(`lessons/${lessonId}`);
    if (files && files.length > 0) {
      const paths = files.map((f) => `lessons/${lessonId}/${f.name}`);
      const { error: removeError } = await supabase.storage
        .from(ASSETS_BUCKET)
        .remove(paths);
      if (removeError) {
        // Log but don't block DB delete — an orphaned file is fixable, an
        // orphaned pointer with a broken UI is worse.
        console.error("[admin/lessons] storage cleanup failed", removeError);
      }
    }

    // lesson_spec_points cascade-deletes via FK.
    const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
    if (error) return { error: error.message };

    revalidatePath("/admin/lessons");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// PUBLISH / UNPUBLISH
// ---------------------------------------------------------------------------
export async function setLessonStatus(
  lessonId: string,
  status: "live" | "draft",
): Promise<{ error?: string }> {
  try {
    await assertAdmin();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("lessons")
      .update({ status })
      .eq("id", lessonId);
    if (error) return { error: error.message };
    revalidatePath("/admin/lessons");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
