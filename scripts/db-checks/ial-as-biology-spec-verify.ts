/**
 * IAL AS Biology specification — live-database verification (the post-apply gate).
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/ial-as-biology-spec-verify.ts [--baseline] [--verified]
 *
 * READ-ONLY. Anon key only — everything checked here is public catalogue
 * data; no service role, no student data (AGENTS.md: an audit never holds a
 * key that can do more than the audit needs).
 *
 * ============================================================================
 * ⚠ THE EXPECTATION IS DERIVED FROM THE COMMITTED EXTRACTIONS, NEVER TYPED
 * ============================================================================
 * Every expected topic, slug, code, statement, count and unit assignment is
 * recomputed from scripts/spec-extract/wbi-as-issue2.json — the artefact seed
 * 012 itself was generated from, which the repo suite (spec-wbi-as.test.ts)
 * has already checked against the official document's own line dump. The
 * 4CH1, 4BI1 and 4PH1 regression expectations come from THEIR committed
 * extractions the same way. Nothing here restates a number by hand.
 *
 * --baseline : report the current state without asserting (the pre-apply
 *              record: expected to show 3 units / 0 topics / 0 points /
 *              100 lessons / 48 papers for AS Biology and populated,
 *              untouched sibling courses). Run it BEFORE applying 012, keep
 *              the output with the application note.
 * default    : assert the post-012 state and exit non-zero on ANY drift:
 *              missing/extra/duplicate codes, wording drift (formulae and
 *              the 3.5(ii) source typo included), wrong topic, wrong UNIT
 *              (the unit-ed course's extra surface), a topic without
 *              unit_id, a Unit 3 topic (nothing may be fabricated there),
 *              archived collisions, A2 Biology rows, or sibling courses
 *              that no longer hold their own specifications.
 * --verified : additionally assert the post-013 lifecycle (Phase 3): every
 *              point 'live' with verified_at set. Without the flag,
 *              lifecycle is not asserted either way, so the same gate serves
 *              pre- and post-013 states.
 *
 * ============================================================================
 * OWNER-RUN SQL FALLBACK (SQL Editor, read-only) — when this script cannot
 * run (no .env.local), the single PRECHECK statement below answers every
 * baseline question in one result table. Run it BEFORE applying 012:
 *
 *   SELECT 'course' AS fact,
 *          count(*)::text AS value,
 *          string_agg(c.id::text || ' ' || c.status, ',') AS detail
 *     FROM courses c WHERE c.slug = 'edexcel-ial-as-biology'
 *   UNION ALL
 *   SELECT 'as biology units', count(*)::text,
 *          string_agg(u.slug || '=' || u.code, ',' ORDER BY u.sort_order)
 *     FROM units u JOIN courses c ON c.id = u.course_id
 *    WHERE c.slug = 'edexcel-ial-as-biology'
 *   UNION ALL
 *   SELECT 'as biology topics', count(*)::text, NULL
 *     FROM topics t JOIN courses c ON c.id = t.course_id
 *    WHERE c.slug = 'edexcel-ial-as-biology'
 *   UNION ALL
 *   SELECT 'as biology spec points', count(*)::text, NULL
 *     FROM spec_points p JOIN topics t ON t.id = p.topic_id
 *     JOIN courses c ON c.id = t.course_id
 *    WHERE c.slug = 'edexcel-ial-as-biology'
 *   UNION ALL
 *   SELECT 'as biology lessons', count(*)::text, NULL
 *     FROM lessons l JOIN courses c ON c.id = l.course_id
 *    WHERE c.slug = 'edexcel-ial-as-biology'
 *   UNION ALL
 *   SELECT 'as biology lesson mappings', count(*)::text, NULL
 *     FROM lesson_spec_points lsp
 *     JOIN lessons l ON l.id = lsp.lesson_id
 *     JOIN courses c ON c.id = l.course_id
 *    WHERE c.slug = 'edexcel-ial-as-biology'
 *   UNION ALL
 *   SELECT 'as biology question mappings', count(*)::text, NULL
 *     FROM question_spec_points qsp
 *     JOIN paper_questions q ON q.id = qsp.question_id
 *     JOIN past_papers pp ON pp.id = q.paper_id
 *     JOIN courses c ON c.id = pp.course_id
 *    WHERE c.slug = 'edexcel-ial-as-biology'
 *   UNION ALL
 *   SELECT 'as biology papers by unit', count(*)::text,
 *          string_agg(DISTINCT pp.paper_code, ',')
 *     FROM past_papers pp JOIN courses c ON c.id = pp.course_id
 *    WHERE c.slug = 'edexcel-ial-as-biology'
 *   UNION ALL
 *   SELECT 'a2 biology topics/points',
 *          count(DISTINCT t.id)::text || '/' || count(p.id)::text, NULL
 *     FROM courses c
 *     LEFT JOIN topics t ON t.course_id = c.id
 *     LEFT JOIN spec_points p ON p.topic_id = t.id
 *    WHERE c.slug = 'edexcel-ial-a2-biology'
 *   UNION ALL
 *   SELECT 'chemistry topics/points/verified/C',
 *          count(DISTINCT t.id)::text || '/' || count(p.id)::text || '/' ||
 *          count(p.id) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL)::text || '/' ||
 *          count(p.id) FILTER (WHERE p.code LIKE '%C')::text, NULL
 *     FROM courses c
 *     LEFT JOIN topics t ON t.course_id = c.id
 *     LEFT JOIN spec_points p ON p.topic_id = t.id
 *    WHERE c.slug = 'edexcel-igcse-chemistry'
 *   UNION ALL
 *   SELECT 'igcse biology topics/points/verified/B',
 *          count(DISTINCT t.id)::text || '/' || count(p.id)::text || '/' ||
 *          count(p.id) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL)::text || '/' ||
 *          count(p.id) FILTER (WHERE p.code LIKE '%B')::text, NULL
 *     FROM courses c
 *     LEFT JOIN topics t ON t.course_id = c.id
 *     LEFT JOIN spec_points p ON p.topic_id = t.id
 *    WHERE c.slug = 'edexcel-igcse-biology'
 *   UNION ALL
 *   SELECT 'physics topics/points/verified/P',
 *          count(DISTINCT t.id)::text || '/' || count(p.id)::text || '/' ||
 *          count(p.id) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL)::text || '/' ||
 *          count(p.id) FILTER (WHERE p.code LIKE '%P')::text, NULL
 *     FROM courses c
 *     LEFT JOIN topics t ON t.course_id = c.id
 *     LEFT JOIN spec_points p ON p.topic_id = t.id
 *    WHERE c.slug = 'edexcel-igcse-physics'
 *   UNION ALL
 *   SELECT 'ial chemistry live/verified/archived',
 *          count(p.id) FILTER (WHERE p.status = 'live')::text || '/' ||
 *          count(p.id) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL)::text || '/' ||
 *          count(p.id) FILTER (WHERE p.status = 'archived')::text, NULL
 *     FROM courses c
 *     LEFT JOIN topics t ON t.course_id = c.id
 *     LEFT JOIN spec_points p ON p.topic_id = t.id
 *    WHERE c.slug = 'edexcel-ial-as-chemistry'
 *   UNION ALL
 *   SELECT 'non-as-biology spec total', count(p.id)::text, NULL
 *     FROM spec_points p JOIN topics t ON t.id = p.topic_id
 *     JOIN courses c ON c.id = t.course_id
 *    WHERE c.slug <> 'edexcel-ial-as-biology'
 *   UNION ALL
 *   SELECT 'END OF PRECHECK', 'sentinel', NULL;
 *
 *   Expected before 012: course 1 row (uuid cef65cb4-…, live), 3 units
 *   (unit-1=WBI11, unit-2=WBI12, unit-3=WBI13), 0 topics, 0 spec points,
 *   100 lessons, 0 lesson mappings, 0 question mappings, 48 papers
 *   (WBI11/01, WBI12/01, WBI13/01), a2 0/0, chemistry 28/182/182/52,
 *   igcse biology 22/176/176/42, physics 30/195/195/48, ial 157/157/1,
 *   non-as-biology total 711, and the sentinel row — if the sentinel row is
 *   missing, the paste was truncated.
 * ============================================================================
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const COURSE_SLUG = "edexcel-ial-as-biology";
const A2_SLUG = "edexcel-ial-a2-biology";
const CHEM_SLUG = "edexcel-igcse-chemistry";
const BIO_SLUG = "edexcel-igcse-biology";
const PHYS_SLUG = "edexcel-igcse-physics";
const IAL_CHEM_SLUG = "edexcel-ial-as-chemistry";
const BASELINE = process.argv.includes("--baseline");
/** After 013 (the official-verification lifecycle pass, Phase 3): every point
 *  must be status 'live' with verified_at set. */
const EXPECT_VERIFIED = process.argv.includes("--verified");

// ── env: anon key, hand-parsed like every db-check ──────────────────────────
// (existsSync first: a worktree may legitimately have no .env.local, and an
//  absent file is the SKIPPED case, not a crash.)
const env: Record<string, string> = {};
if (existsSync(join(ROOT, ".env.local"))) {
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
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

import { pointTitle, topicSlug } from "../spec-extract/generate-wbi-as-seed.ts";

type Extraction = {
  meta: {
    counts: {
      points: number; topics: number; practical: number;
      byUnit: Record<string, number>;
    };
  };
  topics: { number: number; unit: number; name: string; order: number }[];
  points: { code: string; topic: number; unit: number; number: number; text: string; practical: boolean }[];
};
const json: Extraction = JSON.parse(
  readFileSync(join(ROOT, "scripts/spec-extract/wbi-as-issue2.json"), "utf8"),
);
// The siblings' regression expectations, derived from THEIR committed extractions.
type ChemExtraction = { meta: { counts: { points: number; topics: number; cOnly: number } } };
const chem: ChemExtraction = JSON.parse(
  readFileSync(join(ROOT, "scripts/spec-extract/4ch1-issue3.json"), "utf8"),
);
type BioExtraction = { meta: { counts: { points: number; topics: number; bOnly: number } } };
const bio: BioExtraction = JSON.parse(
  readFileSync(join(ROOT, "scripts/spec-extract/4bi1-issue3.json"), "utf8"),
);
type PhysExtraction = { meta: { counts: { points: number; topics: number; pOnly: number } } };
const phys: PhysExtraction = JSON.parse(
  readFileSync(join(ROOT, "scripts/spec-extract/4ph1-issue4.json"), "utf8"),
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

  const units = await rows<{ id: string; slug: string; code: string | null; name: string; sort_order: number }>(
    `units?course_id=eq.${courseId}&select=id,slug,code,name,sort_order&order=sort_order`,
  );
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
  const lessons = await rows<{ id: string }>(`lessons?course_id=eq.${courseId}&select=id`);
  const papers = await rows<{ id: string; paper_code: string | null }>(
    `past_papers?course_id=eq.${courseId}&select=id,paper_code`,
  );

  const sibling = async (slug: string) => {
    const c = await rows<{ id: string }>(`courses?slug=eq.${slug}&select=id`);
    const ts = c.length
      ? await rows<{ id: string }>(`topics?course_id=eq.${c[0].id}&select=id`)
      : [];
    const ps = ts.length
      ? await rows<{ code: string; topic_id: string; status: string; verified_at: string | null }>(
          `spec_points?topic_id=in.(${ts.map((t) => t.id).join(",")})&select=code,topic_id,status,verified_at`,
        )
      : [];
    return { topics: ts, points: ps };
  };
  const a2 = await sibling(A2_SLUG);
  const chemLive = await sibling(CHEM_SLUG);
  const bioLive = await sibling(BIO_SLUG);
  const physLive = await sibling(PHYS_SLUG);
  const ialChem = await sibling(IAL_CHEM_SLUG);

  console.log(`course ${course[0].slug} (${courseId}) "${course[0].name}"`);
  console.log(`  units rows: ${units.length} (${units.map((u) => `${u.slug}=${u.code}`).join(", ")})`);
  console.log(`  topics: ${topics.length} · spec points: ${points.length} · lessons: ${lessons.length} · papers: ${papers.length}`);
  console.log(`  A2 Biology sibling: ${a2.points.length} points across ${a2.topics.length} topics`);
  console.log(`  4CH1 sibling: ${chemLive.points.length} points across ${chemLive.topics.length} topics`);
  console.log(`  4BI1 sibling: ${bioLive.points.length} points across ${bioLive.topics.length} topics`);
  console.log(`  4PH1 sibling: ${physLive.points.length} points across ${physLive.topics.length} topics`);
  console.log(`  IAL Chem sibling: ${ialChem.points.length} points across ${ialChem.topics.length} topics`);

  if (BASELINE) {
    console.log("\nBASELINE ONLY — nothing asserted. Expected pre-apply: 3 units"
      + ` (unit-1/WBI11, unit-2/WBI12, unit-3/WBI13), 0 topics, 0 points,`
      + ` 100 lessons, 48 papers for AS Biology; A2 0/0;`
      + ` 4CH1 ${chem.meta.counts.topics}/${chem.meta.counts.points};`
      + ` 4BI1 ${bio.meta.counts.topics}/${bio.meta.counts.points};`
      + ` 4PH1 ${phys.meta.counts.topics}/${phys.meta.counts.points}; IAL Chem populated.`);
    return;
  }

  console.log("\nAsserting against the committed extraction:");
  check("the three existing AS units are present and correctly coded (WBI11/WBI12/WBI13 — this seed created none)",
    units.length === 3 &&
    units.map((u) => `${u.slug}=${u.code}`).join(",") === "unit-1=WBI11,unit-2=WBI12,unit-3=WBI13",
    units.map((u) => `${u.slug}=${u.code}`).join(","));
  check(`exactly ${json.meta.counts.topics} topics (derived)`, topics.length === json.meta.counts.topics, topics.length);
  check("every topic is unit-linked (no NULL unit_id — the inverse of the IGCSE shape)",
    topics.every((t) => t.unit_id !== null),
    topics.filter((t) => t.unit_id === null).map((t) => t.slug).join(","));
  const unitBySlug = new Map(units.map((u) => [u.slug, u.id]));
  check("topics sit 2 on unit-1, 2 on unit-2, 0 on unit-3 (Unit 3 defines no syllabus content)",
    topics.filter((t) => t.unit_id === unitBySlug.get("unit-1")).length === 2 &&
    topics.filter((t) => t.unit_id === unitBySlug.get("unit-2")).length === 2 &&
    topics.filter((t) => t.unit_id === unitBySlug.get("unit-3")).length === 0);
  check("no archived topics", topics.every((t) => t.status !== "archived"));

  const expectedTopics = json.topics.map((x) => ({
    slug: topicSlug(x.number, x.name),
    code: `Topic ${x.number}`,
    name: x.name,
    sort_order: x.order,
    unitId: unitBySlug.get(`unit-${x.unit}`),
  }));
  check("topic slugs, codes, names, order AND unit assignments match the extraction exactly",
    topics.length === expectedTopics.length &&
    topics.every((t, i) =>
      t.slug === expectedTopics[i].slug && t.code === expectedTopics[i].code &&
      t.name === expectedTopics[i].name && t.sort_order === expectedTopics[i].sort_order &&
      t.unit_id === expectedTopics[i].unitId),
    JSON.stringify(topics.map((t, i) => [t.slug, expectedTopics[i]?.slug])
      .filter(([a, b]) => a !== b).slice(0, 3)));

  const topicIdBySlug = new Map(topics.map((t) => [t.slug, t.id]));
  const expectedPointRows = json.points.map((p) => {
    const x = json.topics.find((tt) => tt.number === p.topic)!;
    return {
      code: p.code,
      text: p.text,
      number: p.number,
      unit: p.unit,
      topicId: topicIdBySlug.get(topicSlug(x.number, x.name)),
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
  check("every point sits on its own topic (and therefore its own unit)",
    expectedPointRows.every((e) => liveByCode.get(e.code)?.topic_id === e.topicId),
    expectedPointRows.filter((e) => liveByCode.get(e.code)?.topic_id !== e.topicId)
      .map((e) => e.code).slice(0, 8).join(","));
  const topicUnit = new Map(topics.map((t) => [t.id, t.unit_id]));
  check(`per-unit split is ${json.meta.counts.byUnit["1"]}/${json.meta.counts.byUnit["2"]} (derived from the extraction)`,
    points.filter((p) => topicUnit.get(p.topic_id) === unitBySlug.get("unit-1")).length === json.meta.counts.byUnit["1"] &&
    points.filter((p) => topicUnit.get(p.topic_id) === unitBySlug.get("unit-2")).length === json.meta.counts.byUnit["2"]);
  check("every statement carries the exact official wording (formulae, notes, the 3.5(ii) source typo included)",
    expectedPointRows.every((e) => liveByCode.get(e.code)?.description === e.text),
    expectedPointRows.filter((e) => liveByCode.get(e.code)?.description !== e.text)
      .map((e) => e.code).slice(0, 8).join(","));
  check("every title is the derived trim of its own official stem (the NOT NULL column that sank 006's apply #1)",
    expectedPointRows.every((e) => liveByCode.get(e.code)?.title === pointTitle(e.text)),
    expectedPointRows.filter((e) => liveByCode.get(e.code)?.title !== pointTitle(e.text))
      .map((e) => e.code).slice(0, 8).join(","));
  check("sort_order is the official number", expectedPointRows.every(
    (e) => liveByCode.get(e.code)?.sort_order === e.number));
  check(`${json.meta.counts.practical} core-practical statements (derived)`,
    points.filter((p) => p.description.startsWith("CORE PRACTICAL ")).length === json.meta.counts.practical);
  check("no archived points", points.every((p) => p.status !== "archived"));
  if (EXPECT_VERIFIED) {
    check("post-013 lifecycle: every point is 'live' with verified_at set",
      points.every((p) => p.status === "live" && p.verified_at !== null),
      `${points.filter((p) => p.status !== "live" || p.verified_at === null).length} not yet verified`);
  }

  check("A2 Biology untouched: 0 topics, 0 points (AS/A2 isolation)",
    a2.topics.length === 0 && a2.points.length === 0,
    `${a2.topics.length} topics, ${a2.points.length} points`);
  check(`4CH1 sibling unchanged: ${chem.meta.counts.topics} topics / ${chem.meta.counts.points} points / ${chem.meta.counts.cOnly} C-suffix (derived from ITS extraction)`,
    chemLive.topics.length === chem.meta.counts.topics &&
    chemLive.points.length === chem.meta.counts.points &&
    chemLive.points.filter((p) => p.code.endsWith("C")).length === chem.meta.counts.cOnly,
    `${chemLive.topics.length} topics, ${chemLive.points.length} points`);
  check(`4BI1 sibling unchanged: ${bio.meta.counts.topics} topics / ${bio.meta.counts.points} points / ${bio.meta.counts.bOnly} B-suffix (derived from ITS extraction)`,
    bioLive.topics.length === bio.meta.counts.topics &&
    bioLive.points.length === bio.meta.counts.points &&
    bioLive.points.filter((p) => p.code.endsWith("B")).length === bio.meta.counts.bOnly,
    `${bioLive.topics.length} topics, ${bioLive.points.length} points`);
  check(`4PH1 sibling unchanged: ${phys.meta.counts.topics} topics / ${phys.meta.counts.points} points / ${phys.meta.counts.pOnly} P-suffix (derived from ITS extraction)`,
    physLive.topics.length === phys.meta.counts.topics &&
    physLive.points.length === phys.meta.counts.points &&
    physLive.points.filter((p) => p.code.endsWith("P")).length === phys.meta.counts.pOnly,
    `${physLive.topics.length} topics, ${physLive.points.length} points`);
  check("IAL Chemistry still holds its own specification (isolation, not displacement)",
    ialChem.points.length >= 100, ialChem.points.length);
  const foreignTopicIds = new Set([
    ...a2.topics.map((t) => t.id),
    ...chemLive.topics.map((t) => t.id),
    ...bioLive.topics.map((t) => t.id),
    ...physLive.topics.map((t) => t.id),
    ...ialChem.topics.map((t) => t.id),
  ]);
  check("no AS Biology point landed on a foreign topic and vice versa",
    points.every((p) => !foreignTopicIds.has(p.topic_id)) &&
    [...a2.points, ...chemLive.points, ...bioLive.points, ...physLive.points, ...ialChem.points]
      .every((p) => !topicIds.includes(p.topic_id)));
  const sharedChem = points.filter((p) => chemLive.points.some((q2) => q2.code === p.code)).length;
  const sharedBio = points.filter((p) => bioLive.points.some((q2) => q2.code === p.code)).length;
  const sharedPhys = points.filter((p) => physLive.points.some((q2) => q2.code === p.code)).length;
  const sharedIal = points.filter((p) => ialChem.points.some((q2) => q2.code === p.code)).length;
  console.log(`  (textual code collisions correctly co-existing — with 4CH1: ${sharedChem}, with 4BI1: ${sharedBio}, with 4PH1: ${sharedPhys}, with IAL Chem: ${sharedIal})`);

  console.log(failures === 0 ? "\nALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("VERIFICATION ABORTED:", e.message);
  process.exit(1);
});
