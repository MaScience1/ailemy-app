/**
 * 4CH1 specification extraction + seed — the pre-apply verification audit.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/spec-4ch1.test.ts
 *
 * ============================================================================
 * ⚠ THE EXPECTATION IS RE-DERIVED, NEVER TYPED (AGENTS.md)
 * ============================================================================
 * Three artefacts descend from the official Issue 3 PDF:
 *   content-lines.txt (near-source: every content line with fonts/position)
 *     → 4ch1-issue3.json (the canonical extraction)
 *       → 006_igcse_chemistry_specification.sql (the seed)
 * §1 re-parses content-lines.txt with its OWN small parser — different logic
 * from extract_4ch1.py — and every downstream count, code, order and flag is
 * checked against THAT, so the extractor cannot vouch for itself. The only
 * typed numbers in this file are cross-checks a reader can verify against
 * the printed document (4 sections, 28 lettered sub-topics).
 *
 * No credentials, no database. The post-apply twin is
 * scripts/db-checks/igcse-4ch1-spec-verify.ts.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { pointTitle, TITLE_MAX, topicSlug } from "../../spec-extract/generate-4ch1-seed.ts";
import { compareSpecCodes } from "../../../src/lib/specification/codes.ts";
import {
  groupTopicsByUnit,
  UNGROUPED_UNIT_ID,
} from "../../../src/lib/specification/grouping.ts";
import { buildCourseMastery, courseVocabulary } from "../../../src/lib/specification/mastery.ts";
import type { MasteryEvidenceRow, SpecUnitNode } from "../../../src/lib/specification/types.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const repo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// ── the three artefacts ─────────────────────────────────────────────────────
const rawLines = readFileSync(repo("scripts/spec-extract/4ch1-issue3-content-lines.txt"), "utf8")
  .split("\n");
type Extraction = {
  meta: {
    counts: {
      points: number; topics: number; cOnly: number; practical: number;
      bySection: Record<string, number>;
    };
  };
  sections: { number: number; name: string }[];
  topics: { section: number; sectionName: string; letter: string; name: string; order: number }[];
  points: {
    code: string; section: number; number: number; cOnly: boolean; practical: boolean;
    topicOrder: number; order: number; text: string;
  }[];
};
const json: Extraction = JSON.parse(
  readFileSync(repo("scripts/spec-extract/4ch1-issue3.json"), "utf8"),
);
const sql = readFileSync(repo("supabase/seed/006_igcse_chemistry_specification.sql"), "utf8");

// ============================================================================
console.log("§1 independent re-derivation from the near-source line dump");
// ============================================================================
// A deliberately different parse: statements are found by code-at-line-start,
// their extent by the next code/heading, bold by the code line's fonts.
type Derived = {
  code: string; section: number; number: number; bold: boolean;
  topicKey: string; order: number; textNorm: string;
};
const derived: Derived[] = [];
const derivedTopics: { key: string; name: string }[] = [];
{
  let started = false;
  let preview = false;
  let topicKey = "";
  let cur: { code: string; section: number; number: number; bold: boolean; topicKey: string; parts: string[] } | null = null;
  let section = 0;
  const close = () => {
    if (cur) {
      derived.push({
        code: cur.code, section: cur.section, number: cur.number, bold: cur.bold,
        topicKey: cur.topicKey, order: derived.length + 1,
        textNorm: norm(cur.parts.join(" ")),
      });
      cur = null;
    }
  };
  for (const line of rawLines) {
    const m = /^\[p=\d+ x=[\d.]+ ([^\]]*) \[([^\]]*)\]\] (.*)$/.exec(line);
    if (!m) continue;
    const fonts = m[1];
    const sizes = m[2];
    const text = m[3].trim();
    if (!text || fonts.includes("TrebuchetMS") || sizes === "8") continue;
    if (sizes.includes("16") && fonts.includes("Bold")) {
      const s = /^([1-4])\s+(.+)$/.exec(text);
      if (s) { close(); started = true; preview = false; section = Number(s[1]); topicKey = ""; continue; }
    }
    if (!started) continue;
    if (text === "The following sub-topics are covered in this section.") { preview = true; continue; }
    const sub = /^\(([a-z])\)\s+(.+)$/.exec(text);
    if (sub && fonts.includes("Bold")) {
      close(); preview = false;
      topicKey = `${section}(${sub[1]})`;
      derivedTopics.push({ key: topicKey, name: sub[2].trim() });
      continue;
    }
    if (preview || text === "Students should:") continue;
    const code = /^([1-4])\.(\d{1,2})(C?)\b\s*(.*)$/.exec(text);
    if (code) {
      close();
      cur = {
        code: `${code[1]}.${code[2]}${code[3]}`, section: Number(code[1]),
        number: Number(code[2]), bold: fonts.includes("Bold"),
        topicKey, parts: code[4] ? [code[4]] : [],
      };
      continue;
    }
    if (cur) cur.parts.push(text.replace(/^•\s*/, "• "));
  }
  close();
}

t("the dump yields the same point count as the JSON (derived, not typed)",
  derived.length === json.points.length && derived.length === json.meta.counts.points,
  `${derived.length} vs ${json.points.length}`);
t("re-derivation is plausibly the whole specification (≥ 150 points — parser-rot guard)",
  derived.length >= 150, derived.length);
t("28 lettered sub-topics across exactly 4 sections",
  derivedTopics.length === 28 && new Set(derived.map((d) => d.section)).size === 4,
  derivedTopics.length);
t("bold ⟺ C-suffix for every derived statement (the document's own Paper 2 marking)",
  derived.every((d) => d.bold === d.code.endsWith("C")),
  derived.filter((d) => d.bold !== d.code.endsWith("C")).map((d) => d.code).join(","));
t("codes are contiguous 1..N within every section — no missing, no extra",
  [1, 2, 3, 4].every((s) => {
    const nums = derived.filter((d) => d.section === s).map((d) => d.number);
    return nums.join(",") === Array.from({ length: nums.length }, (_, i) => i + 1).join(",");
  }));
t("every derived statement sits inside a lettered sub-topic",
  derived.every((d) => d.topicKey !== ""));

// ============================================================================
console.log("§2 JSON ⟷ derivation: codes, order, topics, flags, wording");
// ============================================================================
{
  const dCodes = derived.map((d) => d.code).join("|");
  const jCodes = json.points.map((p) => p.code).join("|");
  t("identical code sequence in document order", dCodes === jCodes);

  const dByCode = new Map(derived.map((d) => [d.code, d]));
  const topicKeyOf = new Map(json.topics.map((x) => [x.order, `${x.section}(${x.letter})`]));
  t("every point's topic matches the sub-topic the document put it under",
    json.points.every((p) => dByCode.get(p.code)?.topicKey === topicKeyOf.get(p.topicOrder)),
    json.points.filter((p) => dByCode.get(p.code)?.topicKey !== topicKeyOf.get(p.topicOrder))
      .map((p) => p.code).join(","));
  t("cOnly flag ⟺ official C suffix, for every point",
    json.points.every((p) => p.cOnly === p.code.endsWith("C")));
  t("meta counts are sums of the data, not assertions",
    json.meta.counts.cOnly === json.points.filter((p) => p.cOnly).length &&
    json.meta.counts.topics === json.topics.length &&
    Object.entries(json.meta.counts.bySection).every(
      ([s, n]) => json.points.filter((p) => p.section === Number(s)).length === n,
    ));
  t("practical ⟺ the official 'practical:' prefix, for every point",
    json.points.every((p) => p.practical === p.text.startsWith("practical:")) &&
    json.meta.counts.practical === json.points.filter((p) => p.practical).length);

  const wordingMismatches = json.points.filter(
    (p) => norm(p.text) !== dByCode.get(p.code)?.textNorm,
  );
  t("wording: every statement matches the near-source dump verbatim (whitespace-normalised)",
    wordingMismatches.length === 0,
    wordingMismatches.map((p) => p.code).join(","));
  t("no malformed codes (official shape N.NN with optional C)",
    json.points.every((p) => /^[1-4]\.\d{1,2}C?$/.test(p.code)));
  t("no duplicate codes",
    new Set(json.points.map((p) => p.code)).size === json.points.length);
  t("topic names match the document's bold sub-topic headings",
    json.topics.every((x, i) => derivedTopics[i]?.key === `${x.section}(${x.letter})` &&
      derivedTopics[i]?.name === x.name),
    JSON.stringify(json.topics.map((x, i) => [derivedTopics[i]?.name, x.name])
      .filter(([a, b]) => a !== b)));
}

// ============================================================================
console.log("§3 the comparator orders the REAL code set as the document does");
// ============================================================================
{
  const docOrder = json.points.map((p) => p.code);
  const bySection = new Map<number, string[]>();
  for (const p of json.points) {
    bySection.set(p.section, [...(bySection.get(p.section) ?? []), p.code]);
  }
  const sorted = [...bySection.entries()].sort((a, b) => a[0] - b[0])
    .flatMap(([, codes]) => codes.slice());
  t("sanity: per-section concatenation reproduces document order", sorted.join("|") === docOrder.join("|"));
  // ⚠ PAIRWISE, NEVER VIA sort(). Sorting a reversed array cannot expose a
  //   broken comparator: TimSort recognises the descending run by comparing
  //   ADJACENT pairs only and reverses it wholesale, so "1.5C" vs "1.10" —
  //   the exact pair the lexical fallback got wrong — is never asked. Found
  //   by sabotage: the pre-fix comparator passed the sort-based assertion.
  const misordered: string[] = [];
  for (let i = 0; i < docOrder.length; i++) {
    for (let j = i + 1; j < docOrder.length; j++) {
      if (!(compareSpecCodes(docOrder[i], docOrder[j]) < 0 &&
            compareSpecCodes(docOrder[j], docOrder[i]) > 0)) {
        misordered.push(`${docOrder[i]}⋛${docOrder[j]}`);
      }
    }
  }
  t("compareSpecCodes agrees with document order for EVERY pair of the real code set (16 471 pairs, incl. 1.5C < 1.10)",
    misordered.length === 0, misordered.slice(0, 5).join(", "));
  t("every code equals itself under the comparator",
    docOrder.every((c) => compareSpecCodes(c, c) === 0));
  t("the IAL shapes still order exactly as before (pure-numeric segments untouched)",
    compareSpecCodes("1.2", "1.10") < 0 && compareSpecCodes("10.14", "9.1") > 0 &&
    compareSpecCodes("1.4.2", "1.10") < 0 && compareSpecCodes("2.1", "2.1") === 0);
}

// ============================================================================
console.log("§4 the seed SQL is exactly the JSON, course-scoped, non-destructive");
// ============================================================================
{
  const pointInserts = [...sql.matchAll(
    /INSERT INTO spec_points \(topic_id, code, title, description, command_terms, status, sort_order\)\nSELECT t\.id, '([^']+)', '((?:[^']|'')+)', '((?:[^']|'')*)', NULL, 'draft', (\d+)\nFROM topics t JOIN courses cs ON cs\.id = t\.course_id AND cs\.slug = 'edexcel-igcse-chemistry'\nWHERE t\.slug = '([^']+)'/g,
  )].map((m) => ({
    code: m[1], title: m[2].replace(/''/g, "'"), text: m[3].replace(/''/g, "'"),
    sortOrder: Number(m[4]), slug: m[5],
  }));
  t("exactly one spec-point INSERT per JSON point, in document order",
    pointInserts.map((r) => r.code).join("|") === json.points.map((p) => p.code).join("|"),
    `${pointInserts.length} inserts`);

  const topicByOrder = new Map(json.topics.map((x) => [x.order, x]));
  t("every point INSERT targets its own sub-topic's derived slug",
    json.points.every((p, i) => {
      const x = topicByOrder.get(p.topicOrder)!;
      return pointInserts[i]?.slug === topicSlug(x.section, x.letter, x.name);
    }));
  t("every point INSERT carries the exact official wording",
    json.points.every((p, i) => pointInserts[i]?.text === p.text),
    json.points.filter((p, i) => pointInserts[i]?.text !== p.text).map((p) => p.code).slice(0, 5).join(","));
  t("sort_order is the official number within the section",
    json.points.every((p, i) => pointInserts[i]?.sortOrder === p.number));

  const topicInserts = [...sql.matchAll(
    /INSERT INTO topics \(course_id, unit_id, slug, code, name, status, sort_order\)\nSELECT c\.id, (NULL), '([^']+)', '([^']+)', '((?:[^']|'')*)', 'coming_soon', (\d+)\nFROM courses c WHERE c\.slug = 'edexcel-igcse-chemistry'/g,
  )].map((m) => ({ unitId: m[1], slug: m[2], code: m[3], name: m[4].replace(/''/g, "'") }));
  t("exactly one topic INSERT per sub-topic, every one with unit_id NULL (no fabricated units)",
    topicInserts.length === json.topics.length && topicInserts.every((r) => r.unitId === "NULL"));
  t("topic codes and names are the document's own",
    json.topics.every((x, i) =>
      topicInserts[i]?.code === `${x.section}(${x.letter})` && topicInserts[i]?.name === x.name));

  t("idempotent: topics DO NOTHING + points DO UPDATE, one conflict clause per insert",
    (sql.match(/^ON CONFLICT \(course_id, slug\) DO NOTHING;$/gm) ?? []).length === json.topics.length &&
    (sql.match(/^ON CONFLICT \(topic_id, code\) DO UPDATE$/gm) ?? []).length === json.points.length);
  t("non-destructive: no DELETE, no TRUNCATE, no UPDATE outside conflict clauses, no units rows",
    !/\bDELETE\b/i.test(sql) && !/\bTRUNCATE\b/i.test(sql) &&
    !/^\s*UPDATE\b/im.test(sql) && !/INSERT INTO units\b/.test(sql));
  t("course isolation: scoped to edexcel-igcse-chemistry on EVERY insert; IAL never named",
    (sql.match(/edexcel-igcse-chemistry/g) ?? []).length >= json.topics.length + json.points.length &&
    !sql.includes("edexcel-ial"));
  t("the self-verifying DO block pins the derived counts and the file ends with its sentinel",
    sql.includes(`expected ${json.meta.counts.topics}'`) &&
    sql.includes(`expected ${json.meta.counts.points}'`) &&
    sql.includes(`expected ${json.meta.counts.cOnly}'`) &&
    sql.trimEnd().endsWith("If this line is missing, the paste was truncated."));
  t("transactional: BEGIN before the first insert, COMMIT after the DO block",
    sql.indexOf("BEGIN;") < sql.indexOf("INSERT INTO topics") &&
    sql.indexOf("COMMIT;") > sql.indexOf("DO $$"));
}

// ============================================================================
console.log("§5 IAL untouched, and the two courses stay isolated");
// ============================================================================
{
  const ial004 = readFileSync(repo("supabase/seed/004_ial_as_chem_specification.sql"), "utf8");
  const ialCodes = new Set([...ial004.matchAll(/SELECT t\.id, '(\d{1,2}\.\d{1,2})', /g)].map((m) => m[1]));
  t("004 still parses to the whole IAL specification (≥ 100 codes — untouched)",
    ialCodes.size >= 100, ialCodes.size);
  t("the textual collision is real (shared codes exist), which is why scoping matters",
    [...ialCodes].some((c) => json.points.some((p) => p.code === c)));

  // Build the REAL 4CH1 tree the explorer would build post-seed, and a
  // minimal IAL-shaped tree sharing code "1.2"; the same evidence rows must
  // bucket into each course's own topics and never leak.
  const topicNodes = json.topics.map((x) => ({
    id: `4ch1-${x.section}${x.letter}`,
    code: `${x.section}(${x.letter})`,
    name: x.name,
    unitId: null as string | null,
    points: json.points
      .filter((p) => p.topicOrder === x.order)
      .map((p) => ({
        id: `pt-${p.code}`, code: p.code, title: null,
        description: p.text, commandTerms: [], lessons: [],
      })),
  }));
  const igcseUnits: SpecUnitNode[] = groupTopicsByUnit([], topicNodes).map(({ unit, topics }) => ({
    id: unit ?? UNGROUPED_UNIT_ID, code: null, name: "Ungrouped",
    topics: topics.map(({ unitId: _u, ...rest }) => rest),
  })) as SpecUnitNode[];
  const vocab = courseVocabulary(igcseUnits);
  t("explorer shape: one synthetic group, every point in vocabulary, real topic ids",
    igcseUnits.length === 1 && igcseUnits[0].id === UNGROUPED_UNIT_ID &&
    vocab.pointsTotal === json.points.length &&
    vocab.topicOfCode.get("1.1") === "4ch1-1a" && vocab.topicOfCode.get("4.50C") === "4ch1-4h");
  t("zero lesson links — coverage is honestly zero until real IGCSE lessons exist",
    igcseUnits[0].topics.every((x) => x.points.every((p) => p.lessons.length === 0)));

  const evidence: MasteryEvidenceRow[] = Array.from({ length: 3 }, (_, i) => ({
    attemptId: "a1", qIndex: i, specCode: "1.2", markAwarded: 1, markAvailable: 1,
    attemptedAt: null, source: "lesson-practice", examConditions: false,
  }));
  const ialUnits: SpecUnitNode[] = [{
    id: "ial-u1", code: "WCH11", name: "Unit 1",
    topics: [{ id: "ial-t1", code: "1", name: "Formulae", points: [{
      id: "ial-p", code: "1.2", title: null, description: "IAL 1.2", commandTerms: [], lessons: [],
    }] }],
  }];
  const mIgcse = buildCourseMastery({ units: igcseUnits, evidence });
  const mIal = buildCourseMastery({ units: ialUnits, evidence });
  t("code '1.2' buckets to each course's OWN topic — never across",
    mIgcse.byTopic["4ch1-1a"] !== undefined && mIal.byTopic["ial-t1"] !== undefined &&
    mIgcse.byTopic["ial-t1"] === undefined && mIal.byTopic["4ch1-1a"] === undefined);
  t("a C-only code is foreign evidence to IAL and set aside there",
    buildCourseMastery({
      units: ialUnits,
      evidence: [{ ...evidence[0], specCode: "1.5C" }],
    }).ignoredRows === 1);
  t("zero-evidence 4CH1 course computes clean over the full real tree",
    buildCourseMastery({ units: igcseUnits, evidence: [] }).summary.pointsTotal === json.points.length);
}

// ============================================================================
console.log("§6 schema-constraint preflight — required columns derived from the DDL");
// ============================================================================
// ⚠ BORN OF A PRODUCTION ROLLBACK (2026-09-04): the first apply attempt of 006
// died on spec_points.title NOT NULL, because every check compared seed ↔
// extraction and none compared seed ↔ SCHEMA. This section parses the CREATE
// TABLE statements out of the migration that owns them, derives the set of
// NOT NULL / no-DEFAULT columns, and refuses any INSERT that omits one or
// supplies a literal NULL for one. The expectation comes from the DDL, never
// from a typed list, so a future required column fails here before it can
// fail in production.
{
  const ddl = readFileSync(repo("supabase/migrations/0001_initial_schema.sql"), "utf8");
  const requiredColumns = (table: string): string[] => {
    const m = new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n\\);`).exec(ddl);
    if (!m) return [];
    return m[1].split("\n")
      .map((line) => /^\s*([a-z_]+)\s+([a-z_\[\]]+.*)$/.exec(line.replace(/,\s*(--.*)?$/, "")))
      .filter((c): c is RegExpExecArray => !!c && !c[1].startsWith("unique"))
      .filter((c) => /NOT NULL/i.test(c[2]) && !/DEFAULT/i.test(c[2]))
      .map((c) => c[1]);
  };
  const specRequired = requiredColumns("spec_points");
  const topicsRequired = requiredColumns("topics");
  t("DDL parse found the constraint that sank the first apply (title among spec_points' required set)",
    specRequired.includes("title") && specRequired.includes("description") &&
    specRequired.includes("topic_id") && specRequired.includes("code"),
    specRequired.join(","));

  const namesEvery = (insertHeadRe: RegExp, required: string[]) => {
    const heads = [...sql.matchAll(insertHeadRe)];
    return heads.length > 0 && heads.every((h) => {
      const cols = h[1].split(",").map((c) => c.trim());
      return required.every((r) => cols.includes(r));
    });
  };
  t("every spec_points INSERT names every DDL-required column",
    namesEvery(/INSERT INTO spec_points \(([^)]+)\)/g, specRequired));
  t("every topics INSERT names every DDL-required column",
    namesEvery(/INSERT INTO topics \(([^)]+)\)/g, topicsRequired));

  // Naming a column is not supplying it: every required VALUE position must
  // hold a non-empty quoted literal (or the id join), never NULL. The full
  // safe shape is asserted per SELECT — column order topic_id, code, title,
  // description, command_terms, status, sort_order.
  const specSelects = [...sql.matchAll(/INSERT INTO spec_points \([^)]+\)\nSELECT ([\s\S]*?)\nFROM topics t JOIN/g)];
  const SAFE_SHAPE = /^t\.id, '(?:[^']|'')+', '(?:[^']|'')+', '(?:[^']|'')*(?:[^']|'')+', NULL, 'draft', \d+$/;
  const unsafe = specSelects.filter((m) => !SAFE_SHAPE.test(m[1].trim()));
  t("every spec_points SELECT supplies non-NULL code, title and description (the exact defect that reached production)",
    specSelects.length === json.points.length && unsafe.length === 0,
    `${specSelects.length} selects, ${unsafe.length} outside the safe shape: ${unsafe[0]?.[1]?.slice(0, 80) ?? ""}`);
  t("the DO UPDATE arm also carries title, so a re-run repairs titles too",
    (sql.match(/SET title = EXCLUDED\.title/g) ?? []).length === json.points.length);

  // Titles: the 004 convention — a deterministic trim of the official stem.
  const insertTitles = [...sql.matchAll(/\nSELECT t\.id, '(?:[^']|'')+', '((?:[^']|'')+)', /g)]
    .map((m) => m[1].replace(/''/g, "'"));
  t("every title equals pointTitle(official text): non-empty, ≤ TITLE_MAX+1, a true trim of the stem",
    insertTitles.length === json.points.length &&
    json.points.every((p, i) => {
      const title = insertTitles[i];
      const stem = p.text.split("\n")[0].trim();
      const body = title.endsWith("…") ? title.slice(0, -1).trimEnd() : title;
      return title === pointTitle(p.text) && title.length > 0 &&
        title.length <= TITLE_MAX + 1 && stem.startsWith(body);
    }),
    json.points.filter((p, i) => insertTitles[i] !== pointTitle(p.text)).map((p) => p.code).slice(0, 5).join(","));
}

// ============================================================================
console.log("§7 the 007 lifecycle pass touches lifecycle and NOTHING else");
// ============================================================================
// 007 flips 006's 182 rows draft -> live+verified_at (005's exact IAL
// semantics). This section refuses any version of 007 that could write
// academic content, reach another course, or run unguarded.
{
  const v = readFileSync(repo("supabase/seed/007_igcse_official_spec_verification.sql"), "utf8");
  const sets = [...v.matchAll(/\bSET\s+([\s\S]*?)\n\s*FROM\b/g)].map((m) => m[1]);
  t("exactly one UPDATE, setting only status and verified_at",
    sets.length === 1 && /^status = 'live', verified_at = now\(\)\s*$/.test(sets[0] ?? ""),
    JSON.stringify(sets));
  t("no academic column is ever written",
    !/SET[\s\S]{0,200}?(code|title|description|topic_id|sort_order|command_terms)\s*=/.test(v));
  t("no INSERT, DELETE or TRUNCATE anywhere",
    !/\bINSERT\b/i.test(v) && !/\bDELETE\b/i.test(v) && !/\bTRUNCATE\b/i.test(v));
  // ⚠ Anchored to the UPDATE STATEMENT ITSELF — the same scope lines exist
  //   in the pre-guard SELECTs, so a bare regex over the whole file passed
  //   even with the UPDATE's scope stripped (found by sabotage, 2026-09-04;
  //   the runtime guards would NOT catch that today, because no other course
  //   currently holds draft points for a stray UPDATE to touch).
  const updateStmt = /UPDATE spec_points p[\s\S]*?;/.exec(v)?.[0] ?? "";
  t("the UPDATE statement itself is scoped by course slug AND the draft/NULL state",
    updateStmt.includes("c.slug = 'edexcel-igcse-chemistry'") &&
    updateStmt.includes("p.status = 'draft' AND p.verified_at IS NULL"),
    updateStmt.slice(0, 200));
  t("IAL is named only inside the post-guard that asserts it UNCHANGED",
    (v.match(/edexcel-ial-as-chemistry/g) ?? []).length === 1 &&
    /INTO ial_live, ial_verified, ial_archived/.test(v));
  t("guards: eligible=182 pre-check, ROW_COUNT=182, end state 182/0, IAL 157/157/1, idempotent no-op arm",
    v.includes("expected 182 or an exact no-op") &&
    v.includes("GET DIAGNOSTICS updated = ROW_COUNT") &&
    v.includes("expected exactly 182") &&
    v.includes("expected 182 / 0") &&
    v.includes("expected 157/157/1") &&
    v.includes("already applied — 182 rows live+verified"));
  t("transactional with sentinel: BEGIN, one DO block, COMMIT, END-OF-007 last line",
    v.indexOf("BEGIN;") < v.indexOf("DO $$") &&
    v.indexOf("COMMIT;") > v.indexOf("END $$;") &&
    v.trimEnd().endsWith("If this line is missing, the paste was truncated."));
  t("the 182/52 expectations in 007 agree with the extraction (derived, not drifting)",
    v.includes("expected 182") && json.meta.counts.points === 182 &&
    /52[\s\S]{0,8}--?\s*C-suffix/.test(v) && json.meta.counts.cOnly === 52);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
