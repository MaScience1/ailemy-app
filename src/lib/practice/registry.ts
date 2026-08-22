import "server-only";

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Family, FamilyStatus } from "./engine.ts";
import { FAMILIES as L1 } from "./families/definitions-formulae-and-the-mole.ts";
import { FAMILIES as L2 } from "./families/balancing-equations-full-and-ionic.ts";
import { FAMILIES as L3 } from "./families/relative-mass-molar-mass-and-ppm.ts";
import { FAMILIES as L4 } from "./families/solution-concentration.ts";
import { FAMILIES as L5 } from "./families/empirical-and-molecular-formulae.ts";

export { buildSourcePack } from "./engine.ts";

/**
 * The family registry and its approval state (§36, §61–§67).
 *
 * ============================================================================
 * ⚠ FAMILIES ARE CODE; THEIR STATUS IS DATA; STUDENTS SEE ONLY "approved"
 * ============================================================================
 * A family's generator is deterministic TypeScript reviewed like any other
 * code — that is what makes §37's "the LLM never decides the numerical
 * answer" enforceable at all. Its serving STATUS is data the founder
 * controls from admin: every family is born "draft" and serves NOBODY until
 * the founder approves it (§67 — these families were AI-drafted, so approval
 * is not a formality; it is the ruling). Admin preview passes includeDraft
 * and is the only caller allowed to.
 *
 * ⚠ STATUS LIVES IN public.lesson_family_status (0064) — planning's ruling:
 * the table is the store, JSON is a DEV FALLBACK ONLY. Both readers below try
 * the table first through the admin client (the table deliberately has no
 * client grants, like lesson_decks); a PGRST205 — table absent, i.e. 0064 not
 * applied on this database — falls back to content/practice-status.json with
 * a server log so the fallback can never masquerade as the real store. Any
 * OTHER database error is surfaced, not swallowed: a broken store must not
 * quietly read as "everything is draft".
 */

/**
 * ⚠ L2–L5 WERE AI-DRAFTED AND AI-AUDITED, AND THAT IS WHY DRAFT STATUS IS THE
 * DEFAULT AND THE GATE. Each module was drafted from its deck's extracted
 * text, then adversarially audited (chemistry recomputed by hand, grounding
 * terms machine-checked, impossible-hydrocarbon and cross-variant-feedback
 * errors caught and fixed). None of that substitutes for the founder: every
 * family serves students only after explicit admin approval (§67).
 */
const ALL_FAMILIES: Family[] = [...L1, ...L2, ...L3, ...L4, ...L5];

export function familiesForLesson(lessonSlug: string): Family[] {
  return ALL_FAMILIES.filter((f) => f.lessonSlug === lessonSlug);
}

export function familyByKey(key: string): Family | null {
  return ALL_FAMILIES.find((f) => f.key === key) ?? null;
}

// ── status store: lesson_family_status first, JSON dev fallback (see header) ─

const STATUS_PATH = join(process.cwd(), "content", "practice-status.json");

const isStatus = (v: unknown): v is FamilyStatus =>
  v === "draft" || v === "approved" || v === "disabled";

/** PGRST205 = the table is not in the schema cache — 0064 not applied HERE.
 *  The one condition that legitimately routes to the JSON fallback. */
const tableAbsent = (e: { code?: string } | null) => e?.code === "PGRST205";

async function loadStatusesFromFile(): Promise<Record<string, FamilyStatus>> {
  try {
    const raw = JSON.parse(await readFile(STATUS_PATH, "utf8")) as Record<string, unknown>;
    const out: Record<string, FamilyStatus> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (isStatus(v)) out[k] = v;
    }
    return out;
  } catch {
    // No file either — every family is draft, which serves nobody. The safe zero.
    return {};
  }
}

export async function loadStatuses(): Promise<Record<string, FamilyStatus>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("lesson_family_status").select("family_key, status");
  if (error) {
    if (tableAbsent(error)) {
      console.warn("[practice] lesson_family_status absent (0064 not applied) — using JSON dev fallback");
      return loadStatusesFromFile();
    }
    // ⚠ A BROKEN STORE IS AN ERROR, NOT AN EMPTY MAP. Returning {} here would
    // silently un-approve every family — a refusal that looks like a state.
    throw new Error(`lesson_family_status read failed: ${error.message}`);
  }
  const out: Record<string, FamilyStatus> = {};
  for (const row of data ?? []) {
    if (typeof row.family_key === "string" && isStatus(row.status)) out[row.family_key] = row.status;
  }
  return out;
}

export async function saveStatus(key: string, status: FamilyStatus): Promise<void> {
  const family = familyByKey(key);
  if (!family) throw new Error(`unknown family: ${key}`);

  const admin = createAdminClient();
  // The table needs the lesson's id; the registry knows only the slug.
  const { data: lesson, error: lessonErr } = await admin
    .from("lessons").select("id").eq("slug", family.lessonSlug).maybeSingle();
  if (lessonErr) throw new Error(`lesson lookup failed: ${lessonErr.message}`);

  if (lesson) {
    const { error } = await admin.from("lesson_family_status").upsert(
      { family_key: key, lesson_id: lesson.id, status },
      { onConflict: "family_key" },
    );
    if (!error) return;
    if (!tableAbsent(error)) throw new Error(`lesson_family_status write failed: ${error.message}`);
    console.warn("[practice] lesson_family_status absent (0064 not applied) — writing JSON dev fallback");
  }

  // Dev fallback — 0064 not applied on this database (or the lesson row is
  // missing, which only happens on a dev database without the catalogue).
  const all = await loadStatusesFromFile();
  all[key] = status;
  await mkdir(join(process.cwd(), "content"), { recursive: true });
  await writeFile(STATUS_PATH, JSON.stringify(all, null, 1));
}
