/**
 * READ-ONLY post-commit verification of the WCH11/01 spec-point mappings
 * (owner-requested, 2026-09-03). Asserts, and exits non-zero on any failure:
 *
 *   1. question_spec_points holds EXACTLY the overlay's mappings — 18 rows,
 *      all on this paper's questions, codes and display_order matching
 *      spec-points.unit-1-may-june-2025.json byte-for-byte, and nothing else
 *      anywhere in the table (it was empty before this seeding).
 *   2. Every mapped code resolves to a specification point of the paper's own
 *      course that is NOT archived and IS verified (verified_at set).
 *   3. No duplicates (belt-and-braces over the DB UNIQUE).
 *   4. No mapping to 1.13 or any archived/inactive point.
 *   5. The future evidence path: the REAL mapping rows just read, fed through
 *      the pure examEvidenceRows() with one synthetic in-memory marked row
 *      (nothing written anywhere), produce a canonical MasteryEvidenceRow
 *      attributed to the mapping's primary code.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/mastery-mapping-verify-2026-09-03.ts
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { examEvidenceRows } from "../../src/lib/specification/exam-evidence.ts";
import specOverlay from "../exam-seed/spec-points.unit-1-may-june-2025.json" with { type: "json" };

const PAPER_ID = "f7577346-3c45-4b3a-b944-d52542863358"; // WCH11/01 May-June 2025
const COURSE_SLUG = "edexcel-ial-as-chemistry";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

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
const OVERLAY = (specOverlay as { specPoints: Record<string, string[]> }).specPoints;

// ── the whole table, then this paper's questions ────────────────────────────
const all = await db
  .from("question_spec_points")
  .select("id, question_id, spec_code, spec_text, display_order");
if (all.error) throw new Error(`question_spec_points: ${all.error.message}`);
const rows = all.data ?? [];

const pq = await db
  .from("paper_questions")
  .select("id, question_number")
  .eq("paper_id", PAPER_ID);
if (pq.error) throw new Error(`paper_questions: ${pq.error.message}`);
const numberById = new Map((pq.data ?? []).map((q) => [q.id as string, q.question_number as string]));

const expectedTotal = Object.values(OVERLAY).reduce((n, codes) => n + codes.length, 0);
t(`table holds exactly ${expectedTotal} rows`, rows.length === expectedTotal, rows.length);
t("every row belongs to this paper's questions",
  rows.every((r) => numberById.has(r.question_id as string)),
  rows.filter((r) => !numberById.has(r.question_id as string)).length + " foreign row(s)");

// ── exact agreement with the overlay, order included ────────────────────────
const byNumber = new Map<string, { code: string; order: number; text: string | null }[]>();
for (const r of rows) {
  const n = numberById.get(r.question_id as string)!;
  const arr = byNumber.get(n) ?? [];
  arr.push({ code: r.spec_code as string, order: r.display_order as number, text: r.spec_text as string | null });
  byNumber.set(n, arr);
}
for (const arr of byNumber.values()) arr.sort((a, b) => a.order - b.order);

t("mapped question set is exactly the overlay's",
  [...byNumber.keys()].sort().join("|") === Object.keys(OVERLAY).sort().join("|"),
  [...byNumber.keys()].sort().join(","));
t("every mapping matches the overlay, order included (order IS the primary ranking)",
  Object.entries(OVERLAY).every(
    ([n, codes]) => (byNumber.get(n) ?? []).map((x) => x.code).join("|") === codes.join("|"),
  ));
t("no duplicate (question, code) pair",
  new Set(rows.map((r) => `${r.question_id}#${r.spec_code}`)).size === rows.length);
t("every row carries the catalogue wording in spec_text",
  rows.every((r) => typeof r.spec_text === "string" && (r.spec_text as string).length > 0));

// ── codes resolve to live, verified, non-archived points of the course ──────
const course = await db.from("courses").select("id").eq("slug", COURSE_SLUG).single();
if (course.error) throw new Error(`courses: ${course.error.message}`);
const topics = await db.from("topics").select("id").eq("course_id", course.data.id);
if (topics.error) throw new Error(`topics: ${topics.error.message}`);
const sp = await db
  .from("spec_points")
  .select("code, status, verified_at")
  .in("topic_id", (topics.data ?? []).map((tp) => tp.id));
if (sp.error) throw new Error(`spec_points: ${sp.error.message}`);
const pointByCode = new Map((sp.data ?? []).map((p) => [p.code as string, p]));

const mappedCodes = [...new Set(rows.map((r) => r.spec_code as string))];
t("every mapped code exists in the course specification",
  mappedCodes.every((c) => pointByCode.has(c)),
  mappedCodes.filter((c) => !pointByCode.has(c)).join(","));
t("no mapped code is archived (1.13 included)",
  mappedCodes.every((c) => pointByCode.get(c)?.status !== "archived") &&
    !mappedCodes.includes("1.13"));
t("every mapped code is a VERIFIED point (verified_at set)",
  mappedCodes.every((c) => pointByCode.get(c)?.verified_at != null),
  mappedCodes.filter((c) => pointByCode.get(c)?.verified_at == null).join(","));

// ── the future evidence path, over the REAL mapping rows (nothing written) ──
const mappedQ = (pq.data ?? []).find((q) => q.question_number === "20(b)(ii)");
const evidence = examEvidenceRows({
  attempts: [{ id: "synthetic-ea", mode: "exam", submittedAt: "2026-09-03T12:00:00Z" }],
  marked: [{
    questionAttemptId: "synthetic-qa",
    examAttemptId: "synthetic-ea",
    questionId: mappedQ?.id as string,
    awardedMarks: 2,
    assessedOutOf: 2,
  }],
  specLinks: rows.map((r) => ({
    questionId: r.question_id as string,
    specCode: r.spec_code as string,
    displayOrder: r.display_order as number,
  })),
});
t("a marked attempt on a mapped question yields one canonical evidence row",
  evidence.rows.length === 1 && evidence.unmappedQuestions === 0);
t("…attributed to the mapping's PRIMARY code (20(b)(ii) → 1.3)",
  evidence.rows[0]?.specCode === "1.3", evidence.rows[0]?.specCode);
t("…with exam conditions and the assessed tariff",
  evidence.rows[0]?.examConditions === true && evidence.rows[0]?.markAvailable === 2);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
