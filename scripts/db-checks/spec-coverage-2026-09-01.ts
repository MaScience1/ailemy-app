/**
 * READ-ONLY: data-quality audit of the IAL AS Chemistry specification rows
 * seeded by supabase/seed/004_ial_as_chem_specification.sql.
 *
 * ⚠ THE EXPECTATION IS DERIVED, NEVER TYPED (AGENTS.md). The expected code
 * list is re-read from the seed file itself, so this audit cannot drift from
 * what was actually seeded; a hand-typed list here would agree with a memory
 * of the seed, not the seed.
 *
 * Checks: counts by unit/topic vs the seed; missing codes; duplicate codes
 * across the course; orphan points (topic outside the course); unit/topic
 * mapping validity (a point's code prefix must equal its topic's number);
 * malformed codes; lesson links per point; evidence per code (COUNTS ONLY —
 * no per-student rows are read, only aggregates over spec_code).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i < 0 || line.trim().startsWith("#")) continue;
  env.set(line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, ""));
}
const svc = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let issues = 0;
const flag = (msg: string) => { issues++; console.log(`  ✗ ${msg}`); };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

// ── expectation, derived from the seed file ─────────────────────────────────
const seedSql = readFileSync("supabase/seed/004_ial_as_chem_specification.sql", "utf8");
const expectedCodes = new Set(
  [...seedSql.matchAll(/^-- (\d{1,2}\.\d{1,2}) — from deck/gm)].map((m) => m[1]),
);
const expectedTopicSlugs = new Set(
  [...seedSql.matchAll(/WHERE t\.slug = '([a-z0-9-]+)'/g)].map((m) => m[1]),
);
console.log(`expected (from seed file): ${expectedCodes.size} spec points across ${expectedTopicSlugs.size} topics\n`);

// ── actual rows ─────────────────────────────────────────────────────────────
const { data: course, error: cErr } = await svc
  .from("courses").select("id, name").eq("slug", "edexcel-ial-as-chemistry").single();
if (cErr || !course) throw new Error(`course read failed: ${cErr?.message}`);

const { data: units, error: uErr } = await svc
  .from("units").select("id, slug, code, name").eq("course_id", course.id).order("sort_order");
if (uErr) throw new Error(`units: ${uErr.message}`);
const { data: topics, error: tErr } = await svc
  .from("topics").select("id, slug, code, name, unit_id, status").eq("course_id", course.id).order("sort_order");
if (tErr) throw new Error(`topics: ${tErr.message}`);
const topicIds = topics!.map((t) => t.id);
const { data: points, error: pErr } = await svc
  .from("spec_points").select("id, topic_id, code, title, description, status").in("topic_id", topicIds).limit(2000);
if (pErr) throw new Error(`spec_points: ${pErr.message}`);

// counts by unit and topic
console.log("── counts by unit/topic ──");
for (const u of units!) {
  const ts = topics!.filter((t) => t.unit_id === u.id);
  const n = ts.reduce((s, t) => s + points!.filter((p) => p.topic_id === t.id && p.status !== "archived").length, 0);
  console.log(`${u.code}  ${ts.length} topics · ${n} live spec points`);
  for (const t of ts) {
    const mine = points!.filter((p) => p.topic_id === t.id && p.status !== "archived");
    console.log(`    ${t.code ?? "—"}  ${t.name}: ${mine.length}`);
  }
}
const unitless = topics!.filter((t) => !t.unit_id || !units!.some((u) => u.id === t.unit_id));
if (unitless.length) flag(`topics with missing/foreign unit_id: ${unitless.map((t) => t.slug).join(", ")}`);
else ok("every topic maps to a real unit of this course");

// ── missing / extra / archived ──────────────────────────────────────────────
console.log("\n── seed vs database ──");
const live = points!.filter((p) => p.status !== "archived");
const liveCodes = new Set(live.map((p) => p.code));
const missing = [...expectedCodes].filter((c) => !liveCodes.has(c));
const extra = [...liveCodes].filter((c) => !expectedCodes.has(c));
if (missing.length) flag(`seeded codes missing from DB: ${missing.join(", ")}`);
else ok(`all ${expectedCodes.size} seeded codes present and live`);
if (extra.length) flag(`live codes NOT in the seed: ${extra.join(", ")}`);
else ok("no unexpected live codes");
const archived = points!.filter((p) => p.status === "archived").map((p) => p.code);
console.log(`  archived (expected: exactly 1.13): ${archived.join(", ") || "none"}`);
if (archived.join(",") !== "1.13") flag("archived set is not exactly {1.13}");

// ── duplicates / malformed / mapping ────────────────────────────────────────
console.log("\n── integrity ──");
const seen = new Map<string, number>();
for (const p of live) seen.set(p.code, (seen.get(p.code) ?? 0) + 1);
const dups = [...seen].filter(([, n]) => n > 1);
if (dups.length) flag(`duplicate codes across the course: ${dups.map(([c]) => c).join(", ")}`);
else ok("no duplicate codes across the course");

const malformed = live.filter((p) => !/^\d{1,2}\.\d{1,2}$/.test(p.code));
if (malformed.length) flag(`malformed codes: ${malformed.map((p) => p.code).join(", ")}`);
else ok("every code matches N.N");

const topicNum = new Map(topics!.map((t) => [t.id, Number((t.code ?? "").replace(/\D+/g, ""))]));
const misfiled = live.filter((p) => Number(p.code.split(".")[0]) !== topicNum.get(p.topic_id));
if (misfiled.length) flag(`points whose code prefix ≠ their topic number: ${misfiled.map((p) => p.code).join(", ")}`);
else ok("every point's code prefix matches its topic's number");

const empty = live.filter((p) => !p.title?.trim() || !p.description?.trim());
if (empty.length) flag(`points with empty title/description: ${empty.map((p) => p.code).join(", ")}`);
else ok("every live point carries a title and a statement");

// orphans: any spec_point in the WHOLE table whose topic_id is not a real topic
const { data: allPoints, error: apErr } = await svc.from("spec_points").select("id, topic_id").limit(5000);
const { data: allTopics, error: atErr } = await svc.from("topics").select("id").limit(5000);
if (apErr || atErr) throw new Error(`orphan scan: ${apErr?.message ?? atErr?.message}`);
const topicSet = new Set(allTopics!.map((t) => t.id));
const orphans = allPoints!.filter((p) => !topicSet.has(p.topic_id));
if (orphans.length) flag(`orphan spec_points (topic_id not in topics): ${orphans.length}`);
else ok("no orphan spec_points anywhere (FK holds, verified)");

// ── lesson links ────────────────────────────────────────────────────────────
console.log("\n── lesson links ──");
const { data: links, error: lErr } = await svc
  .from("lesson_spec_points").select("lesson_id, spec_point_id").limit(5000);
if (lErr) throw new Error(`links: ${lErr.message}`);
const linked = new Set(links!.map((l) => l.spec_point_id));
const withLesson = live.filter((p) => linked.has(p.id));
console.log(`  points with ≥1 linked lesson: ${withLesson.length} of ${live.length} (${withLesson.map((p) => p.code).sort().join(", ") || "none"})`);
console.log(`  points with NO linked lesson: ${live.length - withLesson.length} — links are admin-curated (publish-readiness gate), deliberately not auto-written by the seed`);

// ── evidence coverage (aggregate counts only) ───────────────────────────────
console.log("\n── practice evidence per code (aggregates only) ──");
const { data: answers, error: aErr } = await svc
  .from("lesson_practice_answers").select("spec_code").limit(10000);
if (aErr) throw new Error(`answers: ${aErr.message}`);
const evidence = new Map<string, number>();
for (const a of answers!) evidence.set(a.spec_code, (evidence.get(a.spec_code) ?? 0) + 1);
const withEvidence = live.filter((p) => evidence.has(p.code));
console.log(`  answer rows in table: ${answers!.length}`);
console.log(`  codes with ANY evidence: ${[...evidence.keys()].sort().join(", ") || "none"}`);
console.log(`  live points with evidence: ${withEvidence.length} of ${live.length}`);
const strayEvidence = [...evidence.keys()].filter((c) => !liveCodes.has(c));
if (strayEvidence.length) flag(`evidence codes with NO live spec point: ${strayEvidence.join(", ")}`);
else ok("every evidence code maps to a live spec point");

console.log(`\n${issues === 0 ? "AUDIT CLEAN" : `AUDIT: ${issues} issue(s)`}`);
process.exit(issues === 0 ? 0 : 1);
