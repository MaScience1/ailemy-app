/**
 * 4BI1 specification extraction + seed — the pre-apply verification audit.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/spec-4bi1.test.ts
 *
 * ============================================================================
 * ⚠ THE EXPECTATION IS RE-DERIVED, NEVER TYPED (AGENTS.md)
 * ============================================================================
 * Three artefacts descend from the official Issue 3 PDF:
 *   content-lines.txt (near-source: every content line with fonts/position)
 *     → 4bi1-issue3.json (the canonical extraction)
 *       → 008_igcse_biology_specification.sql (the seed)
 * §1 re-parses content-lines.txt with its OWN small parser — different logic
 * from extract_4bi1.py — and every downstream count, code, order and flag is
 * checked against THAT, so the extractor cannot vouch for itself. The only
 * typed numbers in this file are cross-checks a reader can verify against
 * the printed document (5 sections, 22 lettered sub-topics); the POINT COUNT
 * is never typed anywhere — it is derived from the dump and must merely agree
 * across all three artefacts.
 *
 * Biology's one structural addition over 4CH1 — bold-italic CONTEXT HEADINGS
 * inside sub-topic tables ('Flowering plants', 'Humans', …) — is re-derived
 * here too (§1) and checked against the JSON (§2) and the seed (§4): a
 * heading must scope the right points, must never leak into any statement's
 * wording, and must never become a row.
 *
 * No credentials, no database. The post-apply twin is
 * scripts/db-checks/igcse-4bi1-spec-verify.ts. §7 audits the 009 lifecycle
 * pass the way 4CH1's §7 audits 007 — anchored to the UPDATE statement
 * itself, with every count cross-checked against the extraction.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { pointTitle, TITLE_MAX, topicSlug } from "../../spec-extract/generate-4bi1-seed.ts";
import { compareSpecCodes } from "../../../src/lib/specification/codes.ts";
import {
  groupTopicsByUnit,
  UNGROUPED_UNIT_ID,
} from "../../../src/lib/specification/grouping.ts";
import { buildCourseMastery, courseVocabulary } from "../../../src/lib/specification/mastery.ts";
import { buildCourseInsights } from "../../../src/lib/specification/insights.ts";
import { masteryContextFor } from "../../../src/lib/specification/hydrogen-context.ts";
import type { MasteryEvidenceRow, SpecUnitNode } from "../../../src/lib/specification/types.ts";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const repo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// ── the three artefacts ─────────────────────────────────────────────────────
const rawLines = readFileSync(repo("scripts/spec-extract/4bi1-issue3-content-lines.txt"), "utf8")
  .split("\n");
type Extraction = {
  meta: {
    counts: {
      points: number; topics: number; bOnly: number; practical: number;
      contexts: number; bySection: Record<string, number>;
    };
  };
  sections: { number: number; name: string }[];
  topics: { section: number; sectionName: string; letter: string; name: string; order: number }[];
  points: {
    code: string; section: number; number: number; bOnly: boolean; practical: boolean;
    context: string | null; topicOrder: number; order: number; text: string;
  }[];
};
const json: Extraction = JSON.parse(
  readFileSync(repo("scripts/spec-extract/4bi1-issue3.json"), "utf8"),
);
const sql = readFileSync(repo("supabase/seed/008_igcse_biology_specification.sql"), "utf8");

// ============================================================================
console.log("§1 independent re-derivation from the near-source line dump");
// ============================================================================
// A deliberately different parse: statements are found by code-at-line-start,
// their extent by the next code/heading, bold by the code line's fonts, and a
// context heading by the document's own typography — a fully italic row at
// the code column (x ≤ 80) with no code; continuation text always sits at the
// description column, so the two cannot be confused.
type Derived = {
  code: string; section: number; number: number; bold: boolean;
  context: string | null; topicKey: string; order: number; textNorm: string;
};
const derived: Derived[] = [];
const derivedTopics: { key: string; name: string }[] = [];
const derivedContexts: { topicKey: string; name: string }[] = [];
{
  let started = false;
  let preview = false;
  let topicKey = "";
  let context: string | null = null;
  let cur: { code: string; section: number; number: number; bold: boolean; context: string | null; topicKey: string; parts: string[] } | null = null;
  let section = 0;
  const close = () => {
    if (cur) {
      derived.push({
        code: cur.code, section: cur.section, number: cur.number, bold: cur.bold,
        context: cur.context, topicKey: cur.topicKey, order: derived.length + 1,
        textNorm: norm(cur.parts.join(" ")),
      });
      cur = null;
    }
  };
  for (const line of rawLines) {
    const m = /^\[p=\d+ x=([\d.]+) ([^\]]*) \[([^\]]*)\]\] (.*)$/.exec(line);
    if (!m) continue;
    const x = Number(m[1]);
    const fonts = m[2];
    const sizes = m[3];
    const text = m[4].trim();
    if (!text || fonts.includes("TrebuchetMS") || sizes === "8") continue;
    if (sizes.includes("16") && fonts.includes("Bold")) {
      const s = /^([1-5])\s+(.+)$/.exec(text);
      if (s) { close(); started = true; preview = false; section = Number(s[1]); topicKey = ""; context = null; continue; }
    }
    if (!started) continue;
    if (text === "The following sub-topics are covered in this section.") { preview = true; continue; }
    const sub = /^\(([a-z])\)\s+(.+)$/.exec(text);
    if (sub && fonts.includes("Bold") && !fonts.includes("Italic")) {
      close(); preview = false; context = null;
      topicKey = `${section}(${sub[1]})`;
      derivedTopics.push({ key: topicKey, name: sub[2].trim() });
      continue;
    }
    if (preview || text === "Students should:") continue;
    const code = /^([1-5])\.(\d{1,2})(B?)\b\s*(.*)$/.exec(text);
    if (code) {
      close();
      cur = {
        code: `${code[1]}.${code[2]}${code[3]}`, section: Number(code[1]),
        number: Number(code[2]), bold: fonts.includes("Bold"),
        context, topicKey, parts: code[4] ? [code[4]] : [],
      };
      continue;
    }
    if (topicKey !== "" && fonts.includes("Italic") && x <= 80 && text.length <= 48) {
      close();
      context = text;
      derivedContexts.push({ topicKey, name: text });
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
t("22 lettered sub-topics across exactly 5 sections",
  derivedTopics.length === 22 && new Set(derived.map((d) => d.section)).size === 5,
  derivedTopics.length);
t("bold ⟺ B-suffix for every derived statement (the document's own Paper 2 marking)",
  derived.every((d) => d.bold === d.code.endsWith("B")),
  derived.filter((d) => d.bold !== d.code.endsWith("B")).map((d) => d.code).join(","));
t("codes are contiguous 1..N within every section — no missing, no extra",
  [1, 2, 3, 4, 5].every((s) => {
    const nums = derived.filter((d) => d.section === s).map((d) => d.number);
    return nums.join(",") === Array.from({ length: nums.length }, (_, i) => i + 1).join(",");
  }));
t("every derived statement sits inside a lettered sub-topic",
  derived.every((d) => d.topicKey !== ""));
t("context headings were found at all, and every one scopes at least one point",
  derivedContexts.length > 0 &&
  derivedContexts.every((c) =>
    derived.some((d) => d.topicKey === c.topicKey && d.context === c.name)),
  derivedContexts.filter((c) =>
    !derived.some((d) => d.topicKey === c.topicKey && d.context === c.name))
    .map((c) => `${c.topicKey}:${c.name}`).join(","));
t("no context heading leaked into any derived statement's wording",
  derived.every((d) => !derivedContexts.some((c) => d.textNorm === norm(c.name))));

// ============================================================================
console.log("§2 JSON ⟷ derivation: codes, order, topics, flags, contexts, wording");
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
  t("bOnly flag ⟺ official B suffix, for every point",
    json.points.every((p) => p.bOnly === p.code.endsWith("B")));
  t("every point's context heading matches the derivation (including its absence)",
    json.points.every((p) => (dByCode.get(p.code)?.context ?? null) === p.context),
    json.points.filter((p) => (dByCode.get(p.code)?.context ?? null) !== p.context)
      .map((p) => `${p.code}:${p.context}≠${dByCode.get(p.code)?.context}`).slice(0, 5).join(","));
  t("meta counts are sums of the data, not assertions",
    json.meta.counts.bOnly === json.points.filter((p) => p.bOnly).length &&
    json.meta.counts.topics === json.topics.length &&
    json.meta.counts.contexts === derivedContexts.length &&
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
  t("no malformed codes (official shape N.NN with optional B)",
    json.points.every((p) => /^[1-5]\.\d{1,2}B?$/.test(p.code)));
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
  // ⚠ PAIRWISE, NEVER VIA sort() — 4CH1's sabotage lesson: TimSort never asks
  //   a reversed run about the non-adjacent pair the lexical fallback got
  //   wrong, so a sort-based assertion passed with a broken comparator.
  const misordered: string[] = [];
  for (let i = 0; i < docOrder.length; i++) {
    for (let j = i + 1; j < docOrder.length; j++) {
      if (!(compareSpecCodes(docOrder[i], docOrder[j]) < 0 &&
            compareSpecCodes(docOrder[j], docOrder[i]) > 0)) {
        misordered.push(`${docOrder[i]}⋛${docOrder[j]}`);
      }
    }
  }
  t("compareSpecCodes agrees with document order for EVERY pair of the real code set (incl. 2.5B < 2.10)",
    misordered.length === 0, misordered.slice(0, 5).join(", "));
  t("every code equals itself under the comparator",
    docOrder.every((c) => compareSpecCodes(c, c) === 0));
  t("the 4CH1 and IAL shapes still order exactly as before (other courses untouched)",
    compareSpecCodes("1.5C", "1.10") < 0 && compareSpecCodes("1.2", "1.10") < 0 &&
    compareSpecCodes("10.14", "9.1") > 0 && compareSpecCodes("2.1", "2.1") === 0);
}

// ============================================================================
console.log("§4 the seed SQL is exactly the JSON, course-scoped, non-destructive");
// ============================================================================
{
  const pointInserts = [...sql.matchAll(
    /INSERT INTO spec_points \(topic_id, code, title, description, command_terms, status, sort_order\)\nSELECT t\.id, '([^']+)', '((?:[^']|'')+)', '((?:[^']|'')*)', NULL, 'draft', (\d+)\nFROM topics t JOIN courses cs ON cs\.id = t\.course_id AND cs\.slug = 'edexcel-igcse-biology'\nWHERE t\.slug = '([^']+)'/g,
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
    /INSERT INTO topics \(course_id, unit_id, slug, code, name, status, sort_order\)\nSELECT c\.id, (NULL), '([^']+)', '([^']+)', '((?:[^']|'')*)', 'coming_soon', (\d+)\nFROM courses c WHERE c\.slug = 'edexcel-igcse-biology'/g,
  )].map((m) => ({ unitId: m[1], slug: m[2], code: m[3], name: m[4].replace(/''/g, "'") }));
  t("exactly one topic INSERT per sub-topic, every one with unit_id NULL (no fabricated units)",
    topicInserts.length === json.topics.length && topicInserts.every((r) => r.unitId === "NULL"));
  t("topic codes and names are the document's own",
    json.topics.every((x, i) =>
      topicInserts[i]?.code === `${x.section}(${x.letter})` && topicInserts[i]?.name === x.name));

  // Context headings: comments, never rows, never wording. A heading name may
  // legitimately occur inside prose, so equality (not substring) is the guard
  // on descriptions, matching the extractor's own refusal.
  const contextNames = new Set(json.points.map((p) => p.context).filter((c): c is string => c !== null));
  t("context headings survive as comments and never as rows or wording",
    contextNames.size > 0 &&
    [...contextNames].every((c) => sql.includes(`-- context heading (document typography, not a row): ${c}`)) &&
    pointInserts.every((r) => !contextNames.has(r.text)) &&
    [...contextNames].every((c) => !new RegExp(`INSERT INTO (spec_points|topics)[^\\n]*'${c}'`).test(sql)));

  t("idempotent: topics DO NOTHING + points DO UPDATE, one conflict clause per insert",
    (sql.match(/^ON CONFLICT \(course_id, slug\) DO NOTHING;$/gm) ?? []).length === json.topics.length &&
    (sql.match(/^ON CONFLICT \(topic_id, code\) DO UPDATE$/gm) ?? []).length === json.points.length);
  t("non-destructive: no DELETE, no TRUNCATE, no UPDATE outside conflict clauses, no units rows",
    !/\bDELETE\b/i.test(sql) && !/\bTRUNCATE\b/i.test(sql) &&
    !/^\s*UPDATE\b/im.test(sql) && !/INSERT INTO units\b/.test(sql));
  t("course isolation: scoped to edexcel-igcse-biology on EVERY insert; no other course named",
    (sql.match(/edexcel-igcse-biology/g) ?? []).length >= json.topics.length + json.points.length &&
    !sql.includes("edexcel-ial") && !sql.includes("edexcel-igcse-chemistry"));
  t("the self-verifying DO block pins the derived counts and the file ends with its sentinel",
    sql.includes(`expected ${json.meta.counts.topics}'`) &&
    sql.includes(`expected ${json.meta.counts.points}'`) &&
    sql.includes(`expected ${json.meta.counts.bOnly}'`) &&
    sql.trimEnd().endsWith("If this line is missing, the paste was truncated."));
  t("transactional: BEGIN before the first insert, COMMIT after the DO block",
    sql.indexOf("BEGIN;") < sql.indexOf("INSERT INTO topics") &&
    sql.indexOf("COMMIT;") > sql.indexOf("DO $$"));
  t("the header records the 2026-09-05 owner apply, the real course identity, and the intentional draft state",
    sql.includes("APPLIED 2026-09-05") && !sql.includes("NOT YET APPLIED") &&
    sql.includes("35702dec-b1b9-487f-b74e-2b99500af285") &&
    sql.includes("INTENTIONALLY awaiting the Phase 3"));
}

// ============================================================================
console.log("§5 4CH1 and IAL untouched, and the three courses stay isolated");
// ============================================================================
{
  const ial004 = readFileSync(repo("supabase/seed/004_ial_as_chem_specification.sql"), "utf8");
  const ialCodes = new Set([...ial004.matchAll(/SELECT t\.id, '(\d{1,2}\.\d{1,2})', /g)].map((m) => m[1]));
  t("004 still parses to the whole IAL specification (≥ 100 codes — untouched)",
    ialCodes.size >= 100, ialCodes.size);

  type ChemExtraction = { meta: { counts: { points: number } }; points: { code: string }[] };
  const chem: ChemExtraction = JSON.parse(
    readFileSync(repo("scripts/spec-extract/4ch1-issue3.json"), "utf8"),
  );
  t("the 4CH1 extraction still holds its full specification (untouched by this branch)",
    chem.points.length === chem.meta.counts.points && chem.points.length >= 150,
    chem.points.length);
  t("the textual collision is real against BOTH sibling courses (shared codes exist), which is why scoping matters",
    [...ialCodes].some((c) => json.points.some((p) => p.code === c)) &&
    chem.points.some((cp) => json.points.some((p) => p.code === cp.code)));

  // Build the REAL 4BI1 tree the explorer would build post-seed, and minimal
  // sibling-shaped trees sharing code "1.2"; the same evidence rows must
  // bucket into each course's own topics and never leak.
  const topicNodes = json.topics.map((x) => ({
    id: `4bi1-${x.section}${x.letter}`,
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
  const bioUnits: SpecUnitNode[] = groupTopicsByUnit([], topicNodes).map(({ unit, topics }) => ({
    id: unit ?? UNGROUPED_UNIT_ID, code: null, name: "Ungrouped",
    topics: topics.map(({ unitId: _u, ...rest }) => rest),
  })) as SpecUnitNode[];
  const vocab = courseVocabulary(bioUnits);
  t("explorer shape: one synthetic group, every point in vocabulary, real topic ids",
    bioUnits.length === 1 && bioUnits[0].id === UNGROUPED_UNIT_ID &&
    vocab.pointsTotal === json.points.length &&
    vocab.topicOfCode.get("1.1") === "4bi1-1a" && vocab.topicOfCode.get("5.20B") === "4bi1-5d");
  t("zero lesson links — coverage is honestly zero until real IGCSE Biology lessons exist",
    bioUnits[0].topics.every((x) => x.points.every((p) => p.lessons.length === 0)));

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
  const chemUnits: SpecUnitNode[] = [{
    id: UNGROUPED_UNIT_ID, code: null, name: "Ungrouped",
    topics: [{ id: "4ch1-1a", code: "1(a)", name: "States of matter", points: [{
      id: "4ch1-p", code: "1.2", title: null, description: "4CH1 1.2", commandTerms: [], lessons: [],
    }] }],
  }];
  const mBio = buildCourseMastery({ units: bioUnits, evidence });
  const mIal = buildCourseMastery({ units: ialUnits, evidence });
  const mChem = buildCourseMastery({ units: chemUnits, evidence });
  // The Biology bucket for "1.2" is DERIVED from the course's own vocabulary
  // (it is 1(b) Variety of living organisms in the real tree), never typed.
  const bioTopicOf12 = vocab.topicOfCode.get("1.2")!;
  t("code '1.2' buckets to each course's OWN topic — never across (4BI1 ≠ 4CH1 ≠ IAL)",
    bioTopicOf12 !== undefined && mBio.byTopic[bioTopicOf12] !== undefined &&
    mIal.byTopic["ial-t1"] !== undefined && mChem.byTopic["4ch1-1a"] !== undefined &&
    mBio.byTopic["ial-t1"] === undefined && mBio.byTopic["4ch1-1a"] === undefined &&
    mIal.byTopic[bioTopicOf12] === undefined && mChem.byTopic[bioTopicOf12] === undefined);
  t("a B-only Biology code is foreign evidence to 4CH1 and IAL, and set aside there",
    buildCourseMastery({ units: ialUnits, evidence: [{ ...evidence[0], specCode: "2.5B" }] }).ignoredRows === 1 &&
    buildCourseMastery({ units: chemUnits, evidence: [{ ...evidence[0], specCode: "2.5B" }] }).ignoredRows === 1);
  t("a C-only Chemistry code is foreign evidence to Biology, and set aside here",
    buildCourseMastery({ units: bioUnits, evidence: [{ ...evidence[0], specCode: "1.5C" }] }).ignoredRows === 1);
  t("zero-evidence 4BI1 course computes clean over the full real tree",
    buildCourseMastery({ units: bioUnits, evidence: [] }).summary.pointsTotal === json.points.length);

  // ── the aggressive collision set, through the WHOLE derived stack ─────────
  // Seven codes that exist (or could exist) in more than one course. Each
  // must bucket to Biology's own vocabulary-derived topic in mastery AND in
  // the insights/Hydrogen layers; none may fabricate anything on zero
  // evidence.
  const COLLIDERS = ["1.1", "1.2", "2.1", "2.5B", "3.1", "4.1", "5.1"];
  t("all seven collision codes exist in the real 4BI1 vocabulary (the premise of the test)",
    COLLIDERS.every((c) => vocab.topicOfCode.has(c)),
    COLLIDERS.filter((c) => !vocab.topicOfCode.has(c)).join(","));
  const colliderEvidence: MasteryEvidenceRow[] = COLLIDERS.map((code, i) => ({
    attemptId: "ax", qIndex: i, specCode: code, markAwarded: 2, markAvailable: 2,
    attemptedAt: new Date(Date.now() - i * 864e5).toISOString(),
    source: "lesson-practice", examConditions: false,
  }));
  const mColl = buildCourseMastery({ units: bioUnits, evidence: colliderEvidence });
  t("every collision code buckets to its own vocabulary-derived Biology topic; zero ignored",
    mColl.ignoredRows === 0 &&
    COLLIDERS.every((c) => mColl.byTopic[vocab.topicOfCode.get(c)!] !== undefined));
  t("the same seven rows against Chemistry/IAL-shaped courses touch ONLY their own '1.2' (rest set aside)",
    buildCourseMastery({ units: chemUnits, evidence: colliderEvidence }).ignoredRows === 6 &&
    buildCourseMastery({ units: ialUnits, evidence: colliderEvidence }).ignoredRows === 6);

  const nowIso = new Date().toISOString();
  const mZero = buildCourseMastery({ units: bioUnits, evidence: [] });
  const iZero = buildCourseInsights({ units: bioUnits, mastery: mZero, evidence: [], nowIso });
  const ctxZero = masteryContextFor({ courseId: "4bi1", units: bioUnits, mastery: mZero, insights: iZero });
  t("zero evidence fabricates NOTHING: no queue, no strengths, no weaknesses, no trends, no series",
    iZero.queue.length === 0 && iZero.strengths.length === 0 && iZero.weaknesses.length === 0 &&
    Object.keys(iZero.trendByCode).length === 0 && iZero.series.length === 0);
  t("Hydrogen context on zero evidence is honestly empty: no areas, no retrieval due, no position",
    ctxZero.weakestAreas.length === 0 && ctxZero.strongestAreas.length === 0 &&
    ctxZero.retrievalDue.length === 0 && ctxZero.currentSpecificationPosition === null &&
    ctxZero.summary.unstarted === json.points.length && ctxZero.summary.pointsTotal === json.points.length);
  const iColl = buildCourseInsights({ units: bioUnits, mastery: mColl, evidence: colliderEvidence, nowIso });
  t("insights over collision evidence stay inside the Biology vocabulary (no foreign key ever appears)",
    Object.keys(iColl.evidenceByCode).every((c) => vocab.topicOfCode.has(c)) &&
    iColl.queue.every((q2) => vocab.topicOfCode.has(q2.specCode)) &&
    [...iColl.strengths, ...iColl.weaknesses].every((r) => vocab.topicOfCode.has(r.specCode)));
  t("a B-suffix point is an ordinary point academically: same shapes, no special casing in the facts",
    mColl.byCode["2.5B"] !== undefined && mColl.byCode["1.1"] !== undefined &&
    JSON.stringify(Object.keys(mColl.byCode["2.5B"]).sort()) ===
    JSON.stringify(Object.keys(mColl.byCode["1.1"]).sort()));
}

// ============================================================================
console.log("§6 schema-constraint preflight — required columns derived from the DDL");
// ============================================================================
// ⚠ THE 4CH1 PRODUCTION-ROLLBACK LESSON, PRESENT FROM DAY ONE: 006's first
// apply died on spec_points.title NOT NULL because every check compared seed
// ↔ extraction and none compared seed ↔ SCHEMA. This section parses the
// CREATE TABLE statements out of the migration that owns them, derives the
// set of NOT NULL / no-DEFAULT columns, and refuses any INSERT that omits one
// or supplies a literal NULL for one. The expectation comes from the DDL,
// never from a typed list, so a future required column fails here before it
// can fail in production.
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
  t("DDL parse found the constraint that sank 006's first apply (title among spec_points' required set)",
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

  // Titles: the 004/006 convention — a deterministic trim of the official stem.
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
console.log("§7 the 009 lifecycle pass touches lifecycle and NOTHING else");
// ============================================================================
// 009 flips 008's 176 rows draft -> live+verified_at (007's exact semantics).
// This section refuses any version of 009 that could write academic content,
// reach another course, or run unguarded. Every count is cross-checked
// against the extractions so the file cannot drift from the source of truth.
{
  const v = readFileSync(repo("supabase/seed/009_igcse_biology_official_spec_verification.sql"), "utf8");
  type ChemMeta = { meta: { counts: { points: number; topics: number; cOnly: number } } };
  const chemMeta: ChemMeta = JSON.parse(
    readFileSync(repo("scripts/spec-extract/4ch1-issue3.json"), "utf8"),
  );

  const sets = [...v.matchAll(/\bSET\s+([\s\S]*?)\n\s*FROM\b/g)].map((m) => m[1]);
  t("exactly one UPDATE, setting only status and verified_at",
    sets.length === 1 && /^status = 'live', verified_at = now\(\)\s*$/.test(sets[0] ?? ""),
    JSON.stringify(sets));
  t("no academic column is ever written",
    !/SET[\s\S]{0,200}?(code|title|description|topic_id|sort_order|command_terms)\s*=/.test(v));
  t("the UPDATE targets spec_points and never topics",
    /UPDATE spec_points p/.test(v) && !/UPDATE topics\b/.test(v));
  t("no INSERT, DELETE or TRUNCATE anywhere",
    !/\bINSERT\b/i.test(v) && !/\bDELETE\b/i.test(v) && !/\bTRUNCATE\b/i.test(v));
  t("no DDL and no grant/RLS surface (CREATE/ALTER/DROP/GRANT/REVOKE/POLICY)",
    !/\b(CREATE|ALTER|DROP|GRANT|REVOKE|POLICY)\b/i.test(v.replace(/^--.*$/gm, "")));
  // ⚠ Anchored to the UPDATE STATEMENT ITSELF — 4CH1's sabotage lesson: the
  //   same scope lines exist in the pre-guard SELECTs, so a bare regex over
  //   the whole file passed even with the UPDATE's scope stripped.
  const updateStmt = /UPDATE spec_points p[\s\S]*?;/.exec(v)?.[0] ?? "";
  t("the UPDATE statement itself is scoped by course slug AND the draft/NULL state",
    updateStmt.includes("c.slug = 'edexcel-igcse-biology'") &&
    updateStmt.includes("p.status = 'draft' AND p.verified_at IS NULL"),
    updateStmt.slice(0, 200));
  t("sibling courses are named only inside their unchanged-guards",
    (v.match(/edexcel-igcse-chemistry/g) ?? []).length === 2 &&
    (v.match(/edexcel-ial-as-chemistry/g) ?? []).length === 1 &&
    /INTO chem_verified, chem_c/.test(v) &&
    /INTO ial_live, ial_verified, ial_archived/.test(v));
  t("guards: eligible pre-check, structural pre-checks, ROW_COUNT, end state, sibling guards, other-total guard, idempotent no-op arm",
    v.includes(`expected ${json.meta.counts.points} or an exact no-op`) &&
    v.includes("expected 22 unit-less") &&
    v.includes("duplicate codes, % malformed codes") &&
    v.includes("GET DIAGNOSTICS updated = ROW_COUNT") &&
    v.includes(`expected exactly ${json.meta.counts.points}`) &&
    v.includes(`expected ${json.meta.counts.points} / 0 / 0 / ${json.meta.counts.bOnly}`) &&
    v.includes(`expected ${chemMeta.meta.counts.topics}/${chemMeta.meta.counts.points}/${chemMeta.meta.counts.cOnly}`) &&
    v.includes("expected 157/157/1") &&
    v.includes("expected 340 (182 + 158)") &&
    v.includes(`already applied — ${json.meta.counts.points} rows live+verified`));
  t("transactional with sentinel: BEGIN, one DO block, COMMIT, END-OF-009 last line",
    v.indexOf("BEGIN;") < v.indexOf("DO $$") &&
    v.indexOf("COMMIT;") > v.indexOf("END $$;") &&
    v.trimEnd().endsWith("If this line is missing, the paste was truncated."));
  t("the header records the 2026-09-06 owner apply (009 is hand-written; this test is the anti-revert guard)",
    v.includes("APPLIED 2026-09-06") && !v.includes("NOT YET APPLIED"));
  t("009's counts equal the extraction's: points, B-suffix, and the chem guard equals ITS extraction",
    v.includes("expected 176") && json.meta.counts.points === 176 &&
    v.includes("expected 42") && json.meta.counts.bOnly === 42 &&
    v.includes("expected 28/182/52") && chemMeta.meta.counts.points === 182 &&
    chemMeta.meta.counts.cOnly === 52 && chemMeta.meta.counts.topics === 28);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
