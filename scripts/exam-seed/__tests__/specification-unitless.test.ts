/**
 * Unit-less course support — a specification whose topics hang directly off
 * the course (IGCSE 4CH1, UK GCSE) must render whole, and a unit-ed course
 * (IAL) must render EXACTLY as it did before grouping.ts existed.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/specification-unitless.test.ts
 *
 * ============================================================================
 * ⚠ THE DEFECT THIS SUITE PINS
 * ============================================================================
 * queries.ts and taxonomy.ts both built unit nodes with
 * `topics.filter(t => t.unitId === u.id)` — so a topic with unit_id NULL, or
 * a course with no units rows at all (every IGCSE course, by
 * bulk-import-papers.ts's own convention), produced an EMPTY tree and the
 * page said "not mapped yet" about a fully seeded specification. grouping.ts
 * is now the one place that decision lives; this suite covers the pure
 * grouping contract, the downstream engines over a unit-less tree, and (as a
 * source gate, since the explorer is a client component plain node cannot
 * import) the UI rules that keep the noun "unit" off courses without units.
 *
 * No credentials, no database — fixtures only, like every mastery suite.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  groupTopicsByUnit,
  UNGROUPED_UNIT_ID,
} from "../../../src/lib/specification/grouping.ts";
import {
  buildCourseMastery,
  courseVocabulary,
} from "../../../src/lib/specification/mastery.ts";
import { buildCourseInsights } from "../../../src/lib/specification/insights.ts";
import { recommendNext } from "../../../src/lib/specification/recommend.ts";
import { MASTERY_EVIDENCE_FLOOR_MARKS } from "../../../src/lib/account/academic.ts";
import type {
  MasteryEvidenceRow,
  SpecUnitNode,
} from "../../../src/lib/specification/types.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const repo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

// ── fixtures ────────────────────────────────────────────────────────────────

const point = (code: string) => ({
  id: `p-${code}`,
  code,
  title: `Point ${code}`,
  description: `Statement for ${code}`,
  commandTerms: [],
  lessons: [],
});

type TopicRow = {
  id: string;
  code: string | null;
  name: string;
  unitId: string | null;
  points: ReturnType<typeof point>[];
};
const topic = (id: string, unitId: string | null, codes: string[]): TopicRow => ({
  id,
  code: id.toUpperCase(),
  name: `Topic ${id}`,
  unitId,
  points: codes.map(point),
});

const unit = (id: string, code: string, name: string) => ({ id, code, name });

/** The IAL shape: two units, every topic owned. */
const IAL_UNITS = [unit("u1", "WCH11", "Unit 1"), unit("u2", "WCH12", "Unit 2")];
const IAL_TOPICS = [
  topic("t1", "u1", ["1.1", "1.2"]),
  topic("t2", "u1", ["2.1"]),
  topic("t3", "u2", ["3.1", "3.2"]),
];

/** The IGCSE shape: no units rows at all, every topic unit_id NULL —
 *  exactly what the live edexcel-igcse-chemistry course will hold once
 *  seeded (verified 2026-09-04: units [], topics []). */
const IGCSE_TOPICS = [
  topic("g1", null, ["1.1", "1.2"]),
  topic("g2", null, ["2.1", "2.2"]),
  topic("g3", null, ["3.1"]),
];

/** Rebuild what queries.ts makes of a grouping — the SpecUnitNode mapping is
 *  three lines there; mirroring it keeps this suite's engine inputs honest. */
const toSpecUnits = (
  units: { id: string; code: string | null; name: string }[],
  topics: TopicRow[],
): SpecUnitNode[] =>
  groupTopicsByUnit(units, topics).map(({ unit: u, topics: ts }) => ({
    id: u?.id ?? UNGROUPED_UNIT_ID,
    code: u?.code ?? null,
    name: u?.name ?? "Ungrouped",
    topics: ts.map(({ unitId: _u, ...rest }) => rest),
  }));

const answers = (code: string, correct: number, total: number): MasteryEvidenceRow[] =>
  Array.from({ length: total }, (_, i) => ({
    attemptId: `a-${code}`,
    qIndex: i,
    specCode: code,
    markAwarded: i < correct ? 1 : 0,
    markAvailable: 1,
    attemptedAt: "2026-09-01T10:00:00Z",
    source: "lesson-practice" as const,
    examConditions: false,
  }));

// ============================================================================
console.log("§1 grouping — the pure contract");
// ============================================================================
{
  const groups = groupTopicsByUnit(IAL_UNITS, IAL_TOPICS);
  t("IAL: one group per unit, no trailing group", groups.length === 2, groups.length);
  t("IAL: unit order preserved", groups[0]?.unit?.id === "u1" && groups[1]?.unit?.id === "u2");
  t("IAL: topics land with their own unit, in order",
    groups[0]?.topics.map((x) => x.id).join(",") === "t1,t2" &&
    groups[1]?.topics.map((x) => x.id).join(",") === "t3",
    JSON.stringify(groups.map((g) => g.topics.map((x) => x.id))));

  // The regression pin: the grouping must equal what the old inline filter
  // produced for a fully unit-ed course.
  const old = IAL_UNITS.map((u) => IAL_TOPICS.filter((x) => x.unitId === u.id));
  t("IAL: byte-for-byte what the old filter produced",
    JSON.stringify(groups.map((g) => g.topics)) === JSON.stringify(old));
}
{
  const groups = groupTopicsByUnit([], IGCSE_TOPICS);
  t("unit-less: exactly one group", groups.length === 1, groups.length);
  t("unit-less: the group is synthetic (unit null)", groups[0]?.unit === null);
  t("unit-less: EVERY topic survives, in order — the defect this file pins",
    groups[0]?.topics.map((x) => x.id).join(",") === "g1,g2,g3",
    JSON.stringify(groups[0]?.topics.map((x) => x.id)));
}
{
  // Mixed / malformed: a NULL-unit topic and a topic whose unitId names a
  // unit that does not exist (FK should prevent it; a malformed read must
  // not vanish a topic).
  const groups = groupTopicsByUnit(IAL_UNITS, [
    ...IAL_TOPICS,
    topic("stray-null", null, ["9.1"]),
    topic("stray-dangling", "u-deleted", ["9.2"]),
  ]);
  t("mixed: real units keep their topics", groups[0]?.topics.length === 2 && groups[1]?.topics.length === 1);
  t("mixed: orphans land in ONE trailing group, never dropped",
    groups.length === 3 &&
    groups[2]?.unit === null &&
    groups[2]?.topics.map((x) => x.id).join(",") === "stray-null,stray-dangling",
    JSON.stringify(groups.map((g) => [g.unit?.id ?? null, g.topics.map((x) => x.id)])));
}
{
  t("zero-topic course with units: unit groups exist, all empty, no trailing group",
    JSON.stringify(groupTopicsByUnit(IAL_UNITS, []).map((g) => [g.unit?.id, g.topics.length])) ===
    JSON.stringify([["u1", 0], ["u2", 0]]));
  t("zero-topic, zero-unit course: no groups at all (page's hasSpec stays false)",
    groupTopicsByUnit([], []).length === 0);
  t("a unit-less topic list never invents a group when empty",
    groupTopicsByUnit([], []).every(() => false) || groupTopicsByUnit([], []).length === 0);
}

// ============================================================================
console.log("§2 the mastery engine over a unit-less tree — no engine change");
// ============================================================================
{
  const units = toSpecUnits([], IGCSE_TOPICS);
  t("tree: one synthetic node under UNGROUPED_UNIT_ID",
    units.length === 1 && units[0]?.id === UNGROUPED_UNIT_ID && units[0]?.code === null);

  const vocab = courseVocabulary(units);
  t("vocabulary sees every point (5)", vocab.pointsTotal === 5, vocab.pointsTotal);
  t("vocabulary maps codes to REAL topic ids, not the synthetic group",
    vocab.topicOfCode.get("1.1") === "g1" && vocab.topicOfCode.get("3.1") === "g3");

  const FLOOR = MASTERY_EVIDENCE_FLOOR_MARKS;
  const m = buildCourseMastery({
    units,
    evidence: [...answers("1.1", FLOOR, FLOOR), ...answers("2.1", 1, 2)],
  });
  t("mastery: a floored code is rated", m.byCode["1.1"]?.state !== undefined && m.byCode["1.1"].state !== "unstarted" && m.byCode["1.1"].state !== "insufficient", m.byCode["1.1"]?.state);
  t("mastery: topic buckets are the real topics", m.byTopic["g1"]?.outOf === FLOOR, JSON.stringify(m.byTopic["g1"]));
  t("mastery: untouched points are unstarted, counted against pointsTotal",
    m.summary.pointsTotal === 5 && m.byCode["3.1"] === undefined);
  t("mastery: zero-evidence unit-less course computes clean",
    buildCourseMastery({ units, evidence: [] }).summary.outOf === 0);

  const insights = buildCourseInsights({
    units, mastery: m, evidence: [...answers("1.1", FLOOR, FLOOR), ...answers("2.1", 1, 2)],
    nowIso: "2026-09-04T12:00:00Z",
  });
  t("insights build over a synthetic group (series, rails, queue all derive)",
    Array.isArray(insights.series) && insights.series.length > 0 &&
    typeof insights.evidenceByCode === "object");

  const rec = recommendNext({ units, mastery: m, limit: 3 });
  t("recommendNext walks the synthetic group in curriculum order",
    rec.length > 0 && rec.every((r) => vocab.topicOfCode.has(r.specCode)));
}

// ============================================================================
console.log("§3 course isolation — identical code strings, different courses");
// ============================================================================
{
  // IAL 1.1 and IGCSE 1.1 are the SAME string; isolation is per-course
  // vocabulary, so each course's mastery must attribute it to ITS OWN topic.
  const ial = toSpecUnits(IAL_UNITS, IAL_TOPICS);
  const igcse = toSpecUnits([], IGCSE_TOPICS);
  const evidence = answers("1.1", 2, 3);

  const mIal = buildCourseMastery({ units: ial, evidence });
  const mIgcse = buildCourseMastery({ units: igcse, evidence });
  t("the same rows bucket to each course's OWN topic id",
    mIal.byTopic["t1"] !== undefined && mIgcse.byTopic["g1"] !== undefined &&
    mIal.byTopic["g1"] === undefined && mIgcse.byTopic["t1"] === undefined);

  // A code the unit-less course does not define is foreign evidence there.
  const foreign = buildCourseMastery({ units: igcse, evidence: answers("10.14", 1, 1) });
  t("a foreign code is set aside and counted, exactly as before",
    foreign.ignoredRows === 1 && foreign.summary.outOf === 0);
}

// ============================================================================
console.log("§4 deep-link topic resolution over the synthetic group");
// ============================================================================
{
  // The explorer opens the topic containing ?point= via units.flatMap(u =>
  // u.topics) — mirror that walk to pin that a unit-less tree resolves it.
  const igcse = toSpecUnits([], IGCSE_TOPICS);
  const found = igcse.flatMap((u) => u.topics).find((x) => x.points.some((p) => p.code === "2.2"));
  t("?point=2.2 finds its topic in a unit-less tree", found?.id === "g2", found?.id);
}

// ============================================================================
console.log("§5 UI source gates — the noun \"unit\" never renders unit-less");
// ============================================================================
// The explorer is a client component ('use client' + JSX): plain node cannot
// import it, so these are source gates in the cta-integrity style — weaker
// than execution, strong enough that deleting the guard goes red.
{
  const explorer = readFileSync(repo("src/components/specification/SpecificationExplorer.tsx"), "utf8");
  t("explorer: unit select renders only for >1 group (hidden for the sole synthetic group)",
    /units\.length > 1 &&/.test(explorer));
  t("explorer: sole synthetic group renders no group heading",
    explorer.includes("soleUngrouped") && /\{!soleUngrouped && \(/.test(explorer));
  t("explorer: soleUngrouped is derived from UNGROUPED_UNIT_ID, not a course name",
    /units\[0\]\.id === UNGROUPED_UNIT_ID/.test(explorer));

  const specPage = readFileSync(repo("src/app/resources/[subject]/[course]/specification/page.tsx"), "utf8");
  t("spec page: header counts units only when real units exist, topics otherwise",
    specPage.includes("realUnitCount > 0") && specPage.includes("topicsTotal"));
  t("spec page: the synthetic group is excluded from the unit count",
    /filter\(\(u\) => u\.id !== UNGROUPED_UNIT_ID\)/.test(specPage));

  const resourcesPage = readFileSync(repo("src/app/resources/[subject]/[course]/page.tsx"), "utf8");
  t("resources page: sole synthetic group renders no group heading",
    /units\.length === 1 && u\.id === UNGROUPED_UNIT_ID/.test(resourcesPage));

  const queries = readFileSync(repo("src/lib/specification/queries.ts"), "utf8");
  const taxonomy = readFileSync(repo("src/lib/resources/taxonomy.ts"), "utf8");
  t("both tree builders group through grouping.ts (one decision, two callers)",
    queries.includes("groupTopicsByUnit(") && taxonomy.includes("groupTopicsByUnit("));
  t("neither tree builder filters topics by unit id inline any more",
    !/topicNodes\s*\n?\s*\.filter\(\(t\) => t\.unitId === u\.id\)/.test(queries) &&
    !/topicNodes\s*\n?\s*\.filter\(\(t\) => t\.unitId === u\.id\)/.test(taxonomy));

  // ⚠ SCOPED READS, NEVER WHOLE-TABLE. loadCourseResources once fetched ALL
  // spec_points and ALL lesson_spec_points and filtered in memory — correct
  // at one course, silently truncated by PostgREST's default 1000-row cap as
  // courses accumulate (516 points across three courses after 4BI1). The
  // reads must stay filtered by the course's own topic/point ids.
  t("taxonomy scopes spec_points by the course's topic ids (no whole-table read)",
    /from\("spec_points"\)[\s\S]{0,80}\.in\("topic_id", courseTopicIds\)/.test(taxonomy) &&
    !/from\("spec_points"\)\.select\("id, topic_id"\),\s*\n/.test(taxonomy));
  t("taxonomy scopes lesson_spec_points by the course's spec point ids (no whole-table read)",
    /from\("lesson_spec_points"\)[\s\S]{0,90}\.in\("spec_point_id", specPointIds\)/.test(taxonomy) &&
    !/from\("lesson_spec_points"\)\.select\("lesson_id, spec_point_id"\),\s*\n/.test(taxonomy));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
