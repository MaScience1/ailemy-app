/**
 * READ-ONLY baseline for the Phase 0/1 seeder dry-run report (owner-requested,
 * 2026-09-03). Named purpose, named targets, counts only — no student content
 * is read or printed:
 *
 *   1. question_spec_points        — rows currently present (expected: 0)
 *   2. exam_attempts on WCH11/01   — how many sittings exist, and their state
 *   3. their question_attempts     — marking state split: how much evidence
 *                                    becomes usable by Mastery after the
 *                                    mapping commit (deterministic + marked,
 *                                    with/without assessed_out_of)
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/mastery-evidence-baseline-2026-09-03.ts
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const PAPER_ID = "f7577346-3c45-4b3a-b944-d52542863358"; // WCH11/01 May-June 2025

async function env(): Promise<{ url: string; key: string }> {
  const raw = await readFile(resolve(".env.local"), "utf8");
  const map = new Map<string, string>();
  for (const line of raw.split("\n")) {
    const eq = line.indexOf("=");
    if (eq === -1 || line.trim().startsWith("#")) continue;
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, ""));
  }
  const url = map.get("NEXT_PUBLIC_SUPABASE_URL");
  const key = map.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("missing env");
  return { url, key };
}

const { url, key } = await env();
const db = createClient(url, key, { auth: { persistSession: false } });

// 1. question_spec_points — whole-table row count via a real select (the
//    head:true/count-only shape has swallowed errors before; see memory).
const qsp = await db.from("question_spec_points").select("id, spec_code");
if (qsp.error) throw new Error(`question_spec_points: ${qsp.error.message}`);
console.log(`question_spec_points rows now: ${(qsp.data ?? []).length}`);

// 2. attempts on this paper
const attempts = await db
  .from("exam_attempts")
  .select("id, mode, submitted_at")
  .eq("paper_id", PAPER_ID);
if (attempts.error) throw new Error(`exam_attempts: ${attempts.error.message}`);
const rows = attempts.data ?? [];
const submitted = rows.filter((a) => a.submitted_at !== null);
console.log(
  `exam_attempts on WCH11/01: ${rows.length} total, ${submitted.length} submitted ` +
    `(${rows.filter((a) => a.mode === "exam").length} exam-mode, ` +
    `${rows.filter((a) => a.mode === "practice").length} practice-mode)`,
);

// 3. marking state of their question_attempts
if (rows.length > 0) {
  const qa = await db
    .from("question_attempts")
    .select("id, awarded_marks, assessed_out_of, confidence")
    .in("exam_attempt_id", rows.map((a) => a.id));
  if (qa.error) throw new Error(`question_attempts: ${qa.error.message}`);
  const q = qa.data ?? [];
  const det = q.filter((r) => r.confidence === "deterministic" && r.awarded_marks !== null);
  const detWithAssessed = det.filter((r) => r.assessed_out_of !== null);
  const review = q.filter((r) => r.confidence === "requires_review");
  console.log(`question_attempts under those sittings: ${q.length}`);
  console.log(`  deterministic + marked:      ${det.length}`);
  console.log(`    …with assessed_out_of set: ${detWithAssessed.length} (pre-0080 rows self-heal on next results view)`);
  console.log(`  requires_review (excluded):  ${review.length}`);
  console.log(`  unmarked:                    ${q.length - det.length - review.length}`);
} else {
  console.log("no attempts → no question_attempts to inspect");
}
