import "server-only";

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

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
 * ⚠ STATUS LIVES IN content/practice-status.json UNTIL THE SCHEMA LANDS. The
 * parked _PROPOSED_ batch defines lesson_question_families with the same
 * three states; when it is applied, loadStatuses/saveStatus point at that
 * table and this file retires. The shape is one flat map so the migration is
 * a copy, not a transform. This is a wiring point, marked as such — not a
 * second permanent store.
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

// ── status store (interim file-backed; see header) ──────────────────────────

const STATUS_PATH = join(process.cwd(), "content", "practice-status.json");

export async function loadStatuses(): Promise<Record<string, FamilyStatus>> {
  try {
    const raw = JSON.parse(await readFile(STATUS_PATH, "utf8")) as Record<string, unknown>;
    const out: Record<string, FamilyStatus> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === "draft" || v === "approved" || v === "disabled") out[k] = v;
    }
    return out;
  } catch {
    // No file yet — every family is draft, which serves nobody. The safe zero.
    return {};
  }
}

export async function saveStatus(key: string, status: FamilyStatus): Promise<void> {
  if (!familyByKey(key)) throw new Error(`unknown family: ${key}`);
  const all = await loadStatuses();
  all[key] = status;
  await mkdir(join(process.cwd(), "content"), { recursive: true });
  await writeFile(STATUS_PATH, JSON.stringify(all, null, 1));
}
