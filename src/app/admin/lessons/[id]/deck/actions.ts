"use server";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadLocalDeck } from "@/lib/lesson-deck/store.ts";
import { familyByKey, saveStatus } from "@/lib/practice/registry.ts";

/**
 * Admin deck lifecycle (§9–§12) and family status (§63, §66–§67).
 *
 * ============================================================================
 * ⚠ THE LIFECYCLE IS: ingest (CLI) → stage (here) → preview → publish (here)
 * ============================================================================
 * Rendering needs LibreOffice, which the deployed runtime does not have — so
 * INGESTION runs where soffice lives (the founder's machine today, a worker
 * later): scripts/lesson-ingest/ingest.py writes content/decks/<slug>/v<k>.
 * STAGING uploads that bundle's student-safe files to the private bucket.
 * PUBLISHING points lessons.deck_path at the staged version — one column, one
 * question, and the live deck is never touched while a new version stages
 * (§10): v2 uploads beside v1, and rollback is pointing deck_path back.
 *
 * ⚠ WHAT STAGING UPLOADS, EXACTLY, AND WHAT IT NEVER UPLOADS:
 *     frames/*.png + manifest.json  →  lessons/<id>/deck/v<k>/     (servable)
 *     source.pptx                   →  lesson-sources/<id>/v<k>/   (admin only)
 *     notes.json                    →  NOWHERE. Speaker notes stay on the
 *                                      ingest machine (§22). Serving them to
 *                                      anyone requires a deliberate future
 *                                      feature, not a path traversal.
 * The student asset route refuses the lesson-sources/ prefix outright AND
 * refuses non-image extensions under lessons/ — two fences (§70).
 *
 * ⚠ EVERY UPLOAD IS RECORDED in the returned receipt so a staging can be
 * reversed by exact path — the cleanup-deletes-only-what-it-created rule.
 */

type ActionResult = { ok: true; detail: string } | { ok: false; reason: string };

const BUNDLE_ROOT = join(process.cwd(), "content", "decks");

export async function stageDeck(input: {
  lessonId: string;
  slug: string;
  version: number;
}): Promise<ActionResult> {
  await assertAdmin();
  const { lessonId, slug, version } = input;
  if (!/^[0-9a-f-]{36}$/.test(lessonId) || !/^[a-z0-9-]+$/.test(slug) || !Number.isInteger(version)) {
    return { ok: false, reason: "malformed input" };
  }

  // Parse-validate the local bundle BEFORE any byte moves (§9 — a broken
  // bundle must fail staging, not publishing).
  const local = await loadLocalDeck(slug, version);
  if (!local.available) return { ok: false, reason: local.reason };

  const dir = join(BUNDLE_ROOT, slug, `v${version}`);
  const admin = createAdminClient();
  const uploaded: string[] = [];

  const put = async (bucketPath: string, bytes: Buffer, contentType: string) => {
    const { error } = await admin.storage
      .from("assets")
      .upload(bucketPath, bytes, { contentType, upsert: true });
    if (error) throw new Error(`${bucketPath}: ${error.message}`);
    uploaded.push(bucketPath);
  };

  try {
    const frames = (await readdir(join(dir, "frames"))).filter((f) => f.endsWith(".png"));
    if (frames.length !== local.manifest.frameCount) {
      return {
        ok: false,
        reason: `bundle incomplete: manifest says ${local.manifest.frameCount} frames, directory has ${frames.length}`,
      };
    }
    for (const f of frames) {
      await put(`lessons/${lessonId}/deck/v${version}/frames/${f}`, await readFile(join(dir, "frames", f)), "image/png");
    }
    await put(
      `lessons/${lessonId}/deck/v${version}/manifest.json`,
      await readFile(join(dir, "manifest.json")),
      "application/json",
    );
    // The protected source — different prefix, never route-servable (§6, §70).
    try {
      await put(
        `lesson-sources/${lessonId}/v${version}/source.pptx`,
        await readFile(join(dir, "source.pptx")),
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
      // Bundle predates source copying — staging proceeds; the sha256 in the
      // manifest still identifies the exact source on the ingest machine.
    }
    return { ok: true, detail: `staged ${uploaded.length} object(s) to v${version}` };
  } catch (e) {
    return {
      ok: false,
      reason: `upload failed after ${uploaded.length} object(s): ${e instanceof Error ? e.message : String(e)} — staged paths: ${uploaded.join(", ") || "none"}`,
    };
  }
}

export async function publishDeck(input: { lessonId: string; version: number }): Promise<ActionResult> {
  await assertAdmin();
  const { lessonId, version } = input;
  const deckPath = `lessons/${lessonId}/deck/v${version}`;

  const admin = createAdminClient();
  // ⚠ PUBLISH ONLY WHAT IS ACTUALLY STAGED — the manifest must exist in the
  // bucket, or deck_path would point students at nothing.
  const { data, error } = await admin.storage.from("assets").download(`${deckPath}/manifest.json`);
  if (error || !data) {
    return { ok: false, reason: `v${version} is not staged (no manifest in bucket): ${error?.message ?? ""}` };
  }

  const { error: upErr } = await admin.from("lessons").update({ deck_path: deckPath }).eq("id", lessonId);
  if (upErr) return { ok: false, reason: upErr.message };
  revalidatePath("/admin/lessons/" + lessonId);
  return { ok: true, detail: `published ${deckPath}` };
}

export async function unpublishDeck(input: { lessonId: string }): Promise<ActionResult> {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("lessons").update({ deck_path: null }).eq("id", input.lessonId);
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/admin/lessons/" + input.lessonId);
  return { ok: true, detail: "deck unpublished — the lesson page is back to video/placeholder" };
}

export async function setFamilyStatus(input: {
  key: string;
  status: "draft" | "approved" | "disabled";
}): Promise<ActionResult> {
  await assertAdmin();
  if (!familyByKey(input.key)) return { ok: false, reason: `unknown family ${input.key}` };
  await saveStatus(input.key, input.status);
  return { ok: true, detail: `${input.key} → ${input.status}` };
}
