/**
 * 4CH1 specification — live-database verification (the post-apply gate).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/igcse-4ch1-spec-verify.ts [--baseline]
 *
 * READ-ONLY. Anon key only — everything checked here is public catalogue
 * data; no service role, no student data (AGENTS.md: an audit never holds a
 * key that can do more than the audit needs).
 *
 * ============================================================================
 * ⚠ THE EXPECTATION IS DERIVED FROM THE COMMITTED EXTRACTION, NEVER TYPED
 * ============================================================================
 * Every expected topic, slug, code, statement and count is recomputed from
 * scripts/spec-extract/4ch1-issue3.json — the artefact the seed itself was
 * generated from, which the repo suite (spec-4ch1.test.ts) has already
 * checked against the official document's own line dump. Nothing here
 * restates a number by hand.
 *
 * --baseline : report the current state without asserting (the pre-apply
 *              record: expected to show 0 topics / 0 points for 4CH1 and a
 *              populated IAL course). Run it BEFORE applying 006, keep the
 *              output with the application note.
 * default    : assert the post-apply state and exit non-zero on ANY drift:
 *              missing/extra/duplicate codes, wording drift, wrong topic,
 *              non-NULL unit_id, units rows, archived collisions, or an IAL
 *              course that no longer holds its own specification.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const COURSE_SLUG = "edexcel-igcse-chemistry";
const IAL_SLUG = "edexcel-ial-as-chemistry";
const BASELINE = process.argv.includes("--baseline");
/** After 007 (the official-verification lifecycle pass): every point must be
 *  status 'live' with verified_at set. Without the flag, lifecycle is not
 *  asserted either way, so the same gate serves pre- and post-007 states. */
const EXPECT_VERIFIED = process.argv.includes("--verified");

// ── env: anon key, hand-parsed like every db-check ──────────────────────────
const env: Record<string, string> = {};
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2];
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !ANON) {
  console.error("SKIPPED — no .env.local with anon credentials");
  process.exit(2);
}

// ⚠ Real GETs with real bodies — the head:true/count-only shape has swallowed
// PGRST205 before and let a check pass against a table that did not exist.
async function rows<T>(path: string): Promise<T[]> {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

import { pointTitle, topicSlug } from "../spec-extract/generate-4ch1-seed.ts";

type Extraction = {
  meta: { counts: { points: number; topics: number; cOnly: number } };
  topics: { section: number; letter: string; name: string; order: number }[];
  points: { code: string; number: number; topicOrder: number; text: string }[];
};
const json: Extraction = JSON.parse(
  readFileSync(join(ROOT, "scripts/spec-extract/4ch1-issue3.json"), "utf8"),
);

let failures = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures += 1;
    console.log(`  ✗ ${name}${got !== undefined ? `\n      ${String(got)}` : ""}`);
  }
};

async function main() {
  const course = await rows<{ id: string; name: string; slug: string }>(
    `courses?slug=eq.${COURSE_SLUG}&select=id,name,slug`,
  );
  if (course.length !== 1) throw new Error(`course ${COURSE_SLUG}: ${course.length} rows`);
  const courseId = course[0].id;

  const units = await rows<{ id: string }>(`units?course_id=eq.${courseId}&select=id`);
  const topics = await rows<{
    id: string; slug: string; code: string | null; name: string;
    unit_id: string | null; status: string; sort_order: number;
  }>(`topics?course_id=eq.${courseId}&select=id,slug,code,name,unit_id,status,sort_order&order=sort_order`);
  const topicIds = topics.map((t) => t.id);
  const points = topicIds.length
    ? await rows<{
        id: string; topic_id: string; code: string; title: string; description: string;
        status: string; verified_at: string | null; sort_order: number;
      }>(`spec_points?topic_id=in.(${topicIds.join(",")})&select=id,topic_id,code,title,description,status,verified_at,sort_order`)
    : [];

  const ial = await rows<{ id: string }>(`courses?slug=eq.${IAL_SLUG}&select=id`);
  const ialTopics = ial.length
    ? await rows<{ id: string }>(`topics?course_id=eq.${ial[0].id}&select=id`)
    : [];
  const ialPoints = ialTopics.length
    ? await rows<{ code: string; topic_id: string }>(
        `spec_points?topic_id=in.(${ialTopics.map((t) => t.id).join(",")})&select=code,topic_id`,
      )
    : [];

  console.log(`course ${course[0].slug} (${courseId}) "${course[0].name}"`);
  console.log(`  units rows: ${units.length} · topics: ${topics.length} · spec points: ${points.length}`);
  console.log(`  IAL comparison course: ${ialPoints.length} points across ${ialTopics.length} topics`);

  if (BASELINE) {
    console.log("\nBASELINE ONLY — nothing asserted. Expected pre-apply: 0 topics, 0 points.");
    return;
  }

  console.log("\nAsserting against the committed extraction:");
  check(`no units rows for the course (4CH1 has no unit layer)`, units.length === 0, units.length);
  check(`exactly ${json.meta.counts.topics} topics (derived)`, topics.length === json.meta.counts.topics, topics.length);
  check("every topic has unit_id NULL", topics.every((t) => t.unit_id === null),
    topics.filter((t) => t.unit_id !== null).map((t) => t.slug).join(","));
  check("no archived topics", topics.every((t) => t.status !== "archived"));

  const expectedTopics = json.topics.map((x) => ({
    slug: topicSlug(x.section, x.letter, x.name),
    code: `${x.section}(${x.letter})`,
    name: x.name,
    sort_order: x.order,
  }));
  check("topic slugs, codes, names and order match the extraction exactly",
    topics.length === expectedTopics.length &&
    topics.every((t, i) =>
      t.slug === expectedTopics[i].slug && t.code === expectedTopics[i].code &&
      t.name === expectedTopics[i].name && t.sort_order === expectedTopics[i].sort_order),
    JSON.stringify(topics.map((t, i) => [t.slug, expectedTopics[i]?.slug])
      .filter(([a, b]) => a !== b).slice(0, 3)));

  const topicIdBySlug = new Map(topics.map((t) => [t.slug, t.id]));
  const expectedPointRows = json.points.map((p) => {
    const x = json.topics.find((tt) => tt.order === p.topicOrder)!;
    return {
      code: p.code,
      text: p.text,
      number: p.number,
      topicId: topicIdBySlug.get(topicSlug(x.section, x.letter, x.name)),
    };
  });

  const liveByCode = new Map(points.map((p) => [p.code, p]));
  check(`exactly ${json.meta.counts.points} spec points (derived)`, points.length === json.meta.counts.points, points.length);
  check("no duplicate codes across the course",
    new Set(points.map((p) => p.code)).size === points.length);
  const missing = expectedPointRows.filter((e) => !liveByCode.has(e.code)).map((e) => e.code);
  const extra = points.filter((p) => !expectedPointRows.some((e) => e.code === p.code)).map((p) => p.code);
  check("no missing codes", missing.length === 0, missing.slice(0, 8).join(","));
  check("no extra codes", extra.length === 0, extra.slice(0, 8).join(","));
  check("every point sits on its own sub-topic",
    expectedPointRows.every((e) => liveByCode.get(e.code)?.topic_id === e.topicId),
    expectedPointRows.filter((e) => liveByCode.get(e.code)?.topic_id !== e.topicId)
      .map((e) => e.code).slice(0, 8).join(","));
  check("every statement carries the exact official wording",
    expectedPointRows.every((e) => liveByCode.get(e.code)?.description === e.text),
    expectedPointRows.filter((e) => liveByCode.get(e.code)?.description !== e.text)
      .map((e) => e.code).slice(0, 8).join(","));
  check("every title is the derived trim of its own official stem (the NOT NULL column that sank apply #1)",
    expectedPointRows.every((e) => liveByCode.get(e.code)?.title === pointTitle(e.text)),
    expectedPointRows.filter((e) => liveByCode.get(e.code)?.title !== pointTitle(e.text))
      .map((e) => e.code).slice(0, 8).join(","));
  check("sort_order is the official number", expectedPointRows.every(
    (e) => liveByCode.get(e.code)?.sort_order === e.number));
  check(`${json.meta.counts.cOnly} C-suffix (Paper 2-only) points (derived)`,
    points.filter((p) => p.code.endsWith("C")).length === json.meta.counts.cOnly);
  check("no archived points", points.every((p) => p.status !== "archived"));
  if (EXPECT_VERIFIED) {
    check("post-007 lifecycle: every point is 'live' with verified_at set",
      points.every((p) => p.status === "live" && p.verified_at !== null),
      `${points.filter((p) => p.status !== "live" || p.verified_at === null).length} not yet verified`);
  }

  check("IAL course still holds its own specification (isolation, not displacement)",
    ialPoints.length >= 100, ialPoints.length);
  const ialTopicIds = new Set(ialTopics.map((t) => t.id));
  check("no 4CH1 point landed on an IAL topic and vice versa",
    points.every((p) => !ialTopicIds.has(p.topic_id)) &&
    ialPoints.every((p) => !topicIds.includes(p.topic_id)));
  const shared = points.filter((p) => ialPoints.some((q2) => q2.code === p.code)).length;
  console.log(`  (textual code collisions with IAL, correctly co-existing: ${shared})`);

  console.log(failures === 0 ? "\nALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("VERIFICATION ABORTED:", e.message);
  process.exit(1);
});
