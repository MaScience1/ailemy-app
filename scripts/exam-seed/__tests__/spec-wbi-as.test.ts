/**
 * IAL AS Biology specification extraction + seed — the pre-apply verification
 * audit.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/exam-seed/__tests__/spec-wbi-as.test.ts
 *
 * ============================================================================
 * ⚠ THE EXPECTATION IS RE-DERIVED, NEVER TYPED (AGENTS.md)
 * ============================================================================
 * Three artefacts descend from the official Issue 2 PDF:
 *   wbi-as-issue2-content-lines.txt (near-source: every AS content line with
 *   fonts/position)
 *     → wbi-as-issue2.json (the canonical extraction)
 *       → 012_ial_as_biology_specification.sql (the seed)
 * §1 re-parses content-lines.txt with its OWN small parser — different logic
 * from extract_wbi_as.py — and every downstream count, code, order, unit
 * assignment and flag is checked against THAT, so the extractor cannot vouch
 * for itself. The only typed numbers in this file are cross-checks a reader
 * can verify against the printed document (3 AS units, 4 topics, the
 * topic→unit map, §2b's formula renderings and the 3.5(ii) source typo, each
 * checkable against one printed page); the POINT COUNT is never typed
 * anywhere — it is derived from the dump and must merely agree across all
 * three artefacts.
 *
 * IAL AS Biology's special risks over the IGCSE siblings are STRUCTURAL:
 * this is the first GENERATED seed for a unit-ed course (topics must resolve
 * to the correct EXISTING units and never fabricate Unit 3 content), the
 * first with roman-numeral sub-points folded into single canonical points
 * (owner decision 2), and the first carrying a pinned official source typo
 * (owner decision 4). §5 exercises AS/A2 isolation and the four-course
 * textual-code collisions through the real engine.
 *
 * No credentials, no database. The post-apply twin is
 * scripts/db-checks/ial-as-biology-spec-verify.ts. §7 audits the 013
 * lifecycle pass the way 4PH1's §7 audits 011 — anchored to the UPDATE
 * statement itself, with every count cross-checked against the extractions,
 * and the unit-linkage pre-guards INVERTED from the IGCSE seeds' unit-less
 * assertions.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { pointTitle, TITLE_MAX, topicSlug } from "../../spec-extract/generate-wbi-as-seed.ts";
import { compareSpecCodes } from "../../../src/lib/specification/codes.ts";
import { groupTopicsByUnit } from "../../../src/lib/specification/grouping.ts";
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
// Whitespace-normalising comparison; operator spacing is normalised the same
// way the extractor renders formula rows (the built formulae carry geometric,
// not textual, spacing).
const norm = (s: string) =>
  s.replace(/\s*([×÷−=])\s*/g, " $1 ").replace(/\s+/g, " ").trim();

// ── the three artefacts ─────────────────────────────────────────────────────
const rawLines = readFileSync(repo("scripts/spec-extract/wbi-as-issue2-content-lines.txt"), "utf8")
  .split("\n");
type Extraction = {
  meta: {
    pdfSha256: string;
    issue: string;
    sourceTypos: { code: string; subPoint: string; token: string }[];
    counts: {
      points: number; topics: number; units: number; practical: number;
      subPointed: number; subPoints: number; notes: number;
      recommendedPracticals: number; fractions: number;
      byUnit: Record<string, number>; byTopic: Record<string, number>;
    };
  };
  units: { number: number; title: string; level: string }[];
  topics: { number: number; unit: number; name: string; order: number }[];
  points: {
    code: string; topic: number; unit: number; number: number; order: number;
    practical: boolean; corePractical: number | null; subPoints: string[]; text: string;
  }[];
  recommendedPracticals: { unit: number; topic: number | null; afterCode: string | null; text: string }[];
  notes: { code: string; text: string }[];
};
const json: Extraction = JSON.parse(
  readFileSync(repo("scripts/spec-extract/wbi-as-issue2.json"), "utf8"),
);
const sql = readFileSync(repo("supabase/seed/012_ial_as_biology_specification.sql"), "utf8");

// ============================================================================
console.log("§1 independent re-derivation from the near-source line dump");
// ============================================================================
// A deliberately different parse: statements are found by code-at-code-column,
// their extent by the next code/heading, units by the 16pt openers, topics by
// the 14pt "Topic N –" headings (wrapped headings joined), RAP boxes skipped
// at the code column, sub-points by their roman markers, notes by fully-italic
// fonts (symbol fonts ignored).
type Derived = {
  code: string; topic: number; unit: number; number: number;
  cp: number | null; subs: string[]; order: number; textNorm: string;
};
const derived: Derived[] = [];
const derivedUnits: { number: number; title: string; level: string | null }[] = [];
const derivedTopics: { number: number; unit: number; name: string }[] = [];
const derivedNotes: { code: string; text: string }[] = [];
let derivedRaps = 0;
{
  let curUnit: (typeof derivedUnits)[number] | null = null;
  let curTopic: (typeof derivedTopics)[number] | null = null;
  let pending: "unit" | "topic" | null = null;
  let inRap = false;
  let cur: {
    code: string; topic: number; unit: number; number: number;
    cp: number | null; subs: string[]; parts: string[]; lastKind: string;
  } | null = null;
  const close = () => {
    if (cur) {
      derived.push({
        code: cur.code, topic: cur.topic, unit: cur.unit, number: cur.number,
        cp: cur.cp, subs: cur.subs, order: derived.length + 1,
        textNorm: norm(cur.parts.join(" ")),
      });
      cur = null;
    }
  };
  const fullyItalic = (fonts: string) => {
    const real = fonts.split("|").filter((f) => f !== "(assembled-fraction)" && f !== "SymbolMT");
    return real.length > 0 && real.every((f) => f.includes("Italic"));
  };
  for (const line of rawLines) {
    const m = /^\[p=\d+ x=([\d.]+) ([^\]]*) \[([^\]]*)\]\] (.*)$/.exec(line);
    if (!m) continue;
    const x = Number(m[1]);
    const fonts = m[2];
    const sizes = m[3].split(",").map((s) => Number(s.trim()));
    const text = m[4].trim();
    if (!text || sizes.join() === "8") continue;
    const bold = fonts.includes("Bold");
    if (sizes.includes(16) && bold) {
      const u = /^Unit ([1-6]):\s*(.*)$/.exec(text);
      if (u) {
        close();
        curUnit = { number: Number(u[1]), title: text, level: null };
        derivedUnits.push(curUnit);
        curTopic = null;
        pending = "unit";
        inRap = false;
        continue;
      }
      if (pending === "unit" && curUnit) { curUnit.title += " " + text; continue; }
    }
    if (pending === "unit") pending = null;
    if (sizes.includes(14) && bold) {
      const tp = /^Topic ([1-9]) – (.+)$/.exec(text);
      if (tp && curUnit) {
        close();
        curTopic = { number: Number(tp[1]), unit: curUnit.number, name: tp[2].trim() };
        derivedTopics.push(curTopic);
        pending = "topic";
        inRap = false;
        continue;
      }
      if (pending === "topic" && curTopic) { curTopic.name += " " + text; continue; }
      if ((text === "IAS compulsory unit" || text === "IA2 compulsory unit") && curUnit) {
        curUnit.level = text;
      }
      close();
      curTopic = null;
      inRap = false;
      continue;
    }
    pending = null;
    if (text === "Candidates will be assessed on their ability to:") continue;
    if (text === "RECOMMENDED ADDITIONAL PRACTICAL" && bold && x <= 80) {
      close();
      inRap = true;
      derivedRaps += 1;
      continue;
    }
    const code = x <= 80 ? /^([1-4])\.(\d{1,2})\b\s*(.*)$/.exec(text) : null;
    if (code && curTopic) {
      close();
      inRap = false;
      const rest = code[3];
      const cpm = rest ? /^CORE PRACTICAL (\d+)$/.exec(rest) : null;
      cur = {
        code: `${code[1]}.${code[2]}`, topic: curTopic.number, unit: curTopic.unit,
        number: Number(code[2]), cp: cpm ? Number(cpm[1]) : null,
        subs: rest && /^\((i|ii|iii|iv|v|vi)\)\s/.test(rest)
          ? [/^\((i|ii|iii|iv|v|vi)\)/.exec(rest)![1]] : [],
        parts: rest ? [rest] : [],
        lastKind: cpm ? "cp" : "text",
      };
      continue;
    }
    if (inRap && bold && x <= 80) continue; // RAP task rows
    if (cur) {
      const sub = /^\((i|ii|iii|iv|v|vi)\)\s/.exec(text);
      if (sub) {
        cur.subs.push(sub[1]);
        cur.parts.push(text);
        cur.lastKind = "text";
      } else if (fullyItalic(fonts)) {
        cur.parts.push(text);
        derivedNotes.push({ code: cur.code, text });
        cur.lastKind = "note";
      } else {
        cur.parts.push(text);
        cur.lastKind = "text";
      }
    }
  }
  close();
}

t("the dump yields the same point count as the JSON (derived, not typed)",
  derived.length === json.points.length && derived.length === json.meta.counts.points,
  `${derived.length} vs ${json.points.length}`);
t("re-derivation is plausibly the whole AS specification (≥ 70 points — parser-rot guard)",
  derived.length >= 70, derived.length);
t("3 AS units (the IAS set), every one declaring 'IAS compulsory unit' — nothing A2 in range",
  derivedUnits.map((u) => u.number).join(",") === "1,2,3" &&
  derivedUnits.every((u) => u.level === "IAS compulsory unit"),
  JSON.stringify(derivedUnits.map((u) => [u.number, u.level])));
t("4 topics: 1-2 under Unit 1, 3-4 under Unit 2 (the document's own placement)",
  derivedTopics.map((x) => `${x.number}:${x.unit}`).join(",") === "1:1,2:1,3:2,4:2",
  derivedTopics.map((x) => `${x.number}:${x.unit}`).join(","));
t("Unit 3 opens zero topics and zero statements (nothing fabricated for the practical unit)",
  derivedTopics.every((x) => x.unit !== 3) && derived.every((d) => d.unit !== 3));
t("codes are contiguous 1..N within every topic — no missing, no extra",
  [1, 2, 3, 4].every((s) => {
    const nums = derived.filter((d) => d.topic === s).map((d) => d.number);
    return nums.join(",") === Array.from({ length: nums.length }, (_, i) => i + 1).join(",");
  }));
t("every derived statement sits inside a topic of Units 1-2",
  derived.every((d) => d.unit === 1 || d.unit === 2));
t("core practicals derived as a contiguous run CP1..CPn",
  derived.filter((d) => d.cp !== null).map((d) => d.cp).join(",") ===
  Array.from({ length: derived.filter((d) => d.cp !== null).length }, (_, i) => i + 1).join(","));
t("roman sub-points are contiguous from (i) on every derived statement",
  derived.every((d) => {
    const ROMAN = ["i", "ii", "iii", "iv", "v", "vi"];
    return d.subs.length === 0 || d.subs.join(",") === ROMAN.slice(0, d.subs.length).join(",");
  }));
t("the five RECOMMENDED ADDITIONAL PRACTICAL boxes are seen and skipped (derived count matches meta)",
  derivedRaps === json.meta.counts.recommendedPracticals && derivedRaps === json.recommendedPracticals.length,
  derivedRaps);

// ============================================================================
console.log("§2 JSON ⟷ derivation: codes, order, topics, units, flags, wording");
// ============================================================================
{
  const dCodes = derived.map((d) => d.code).join("|");
  const jCodes = json.points.map((p) => p.code).join("|");
  t("identical code sequence in document order", dCodes === jCodes);

  const dByCode = new Map(derived.map((d) => [d.code, d]));
  t("every point's topic AND unit match where the document put it",
    json.points.every((p) => {
      const d = dByCode.get(p.code);
      return d?.topic === p.topic && d?.unit === p.unit;
    }),
    json.points.filter((p) => {
      const d = dByCode.get(p.code);
      return d?.topic !== p.topic || d?.unit !== p.unit;
    }).map((p) => p.code).join(","));
  t("practical ⟺ the document's own CORE PRACTICAL heading, numbers agreeing",
    json.points.every((p) => {
      const d = dByCode.get(p.code);
      return p.practical === (d?.cp !== null) && (p.corePractical ?? null) === (d?.cp ?? null);
    }));
  t("subPoints metadata equals the derived roman markers, point by point",
    json.points.every((p) => dByCode.get(p.code)?.subs.join(",") === p.subPoints.join(",")),
    json.points.filter((p) => dByCode.get(p.code)?.subs.join(",") !== p.subPoints.join(","))
      .map((p) => p.code).join(","));
  t("meta counts are sums of the data, not assertions",
    json.meta.counts.points === json.points.length &&
    json.meta.counts.topics === json.topics.length &&
    json.meta.counts.units === json.units.length &&
    json.meta.counts.practical === json.points.filter((p) => p.practical).length &&
    json.meta.counts.subPointed === json.points.filter((p) => p.subPoints.length > 0).length &&
    json.meta.counts.subPoints === json.points.reduce((n, p) => n + p.subPoints.length, 0) &&
    json.meta.counts.notes === json.notes.length &&
    Object.entries(json.meta.counts.byUnit).every(
      ([u, n]) => json.points.filter((p) => p.unit === Number(u)).length === n,
    ) &&
    Object.entries(json.meta.counts.byTopic).every(
      ([tp, n]) => json.points.filter((p) => p.topic === Number(tp)).length === n,
    ));
  t("the per-unit split matches the derivation (derived, not typed)",
    json.meta.counts.byUnit["1"] === derived.filter((d) => d.unit === 1).length &&
    json.meta.counts.byUnit["2"] === derived.filter((d) => d.unit === 2).length &&
    (json.meta.counts.byUnit["3"] ?? 0) === 0);

  const wordingMismatches = json.points.filter(
    (p) => norm(p.text) !== dByCode.get(p.code)?.textNorm,
  );
  t("wording: every statement matches the near-source dump verbatim (whitespace-normalised)",
    wordingMismatches.length === 0,
    wordingMismatches.map((p) => p.code).join(","));
  t("no malformed codes (official shape T.N, topics 1-4, no letter suffixes at IAL)",
    json.points.every((p) => /^[1-4]\.\d{1,2}$/.test(p.code)));
  t("no duplicate codes — course-wide, not merely per topic (the vocabulary-collapse guard)",
    new Set(json.points.map((p) => p.code)).size === json.points.length);
  t("topic names match the document's wrapped headings, units included",
    json.topics.every((x, i) => derivedTopics[i]?.number === x.number &&
      derivedTopics[i]?.name === x.name && derivedTopics[i]?.unit === x.unit),
    JSON.stringify(json.topics.map((x, i) => [derivedTopics[i]?.name, x.name])
      .filter(([a, b]) => a !== b)));
  t("unit titles match the document's wrapped 16pt openers",
    json.units.every((u, i) => derivedUnits[i]?.title === u.title &&
      derivedUnits[i]?.number === u.number),
    JSON.stringify(json.units.map((u, i) => [derivedUnits[i]?.title, u.title])
      .filter(([a, b]) => a !== b)));
  t("every italic guidance note reached its point's text and the notes index",
    json.notes.length === derivedNotes.length &&
    json.notes.every((n2, i) => derivedNotes[i]?.code === n2.code &&
      norm(derivedNotes[i]?.text ?? "") === norm(n2.text)) &&
    json.notes.every((n2) => json.points.find((p) => p.code === n2.code)?.text.includes(n2.text)),
    JSON.stringify(json.notes.map((n2, i) => [derivedNotes[i]?.code, n2.code]).filter(([a, b]) => a !== b)));
}

// ============================================================================
console.log("§2b notation, formula and source-fidelity — the Biology-specific risks");
// ============================================================================
// Each expectation is reader-verifiable against ONE printed page of the
// Issue 2 document (doc page numbers ≈ physical − 6).
{
  const text = (code: string) => json.points.find((p) => p.code === code)?.text ?? "";
  t("4.17: the heterozygosity index renders inline with deterministic parenthesisation (doc p.24)",
    text("4.17").includes(
      "heterozygosity index = (number of heterozygotes)/(number of individuals in the population)",
    ));
  t("4.18: D = (N(N-1))/(Σn(n-1)) — Σ survives, parentheses tight as printed (doc p.24)",
    text("4.18").includes("D = (N(N-1))/(Σn(n-1))"));
  t("β survives as Unicode in 1.2's note and 4.3 (doc pp.15, 23)",
    text("1.2").includes("β-glucose and cellulose are not required in this topic.") &&
    text("4.3").includes("β-glucose"));
  t("the pinned Issue 2 source typo is preserved verbatim: 'knderstand' in 3.5(ii) (doc p.21; owner decision 4)",
    text("3.5").includes("(ii) knderstand the function of the structures listed in (i)") &&
    json.meta.sourceTypos.some((x) => x.code === "3.5" && x.token === "knderstand"));
  t("defined-term statements keep their official wording inline (2.15, 3.17, 4.16)",
    text("2.15").includes("gene, allele, genotype, phenotype") &&
    text("3.17").includes("stem cell, pluripotent and totipotent") &&
    text("4.16") === "understand what is meant by the terms biodiversity and endemism");
  t("a CORE PRACTICAL statement keeps the document's heading + task as separate lines (1.3)",
    text("1.3").startsWith("CORE PRACTICAL 1\nUse a semi-quantitative method with Benedict’s reagent"));
  t("a sub-pointed CORE PRACTICAL keeps heading, then its roman parts (3.8 = CP5)",
    text("3.8").startsWith("CORE PRACTICAL 5\n(i) use a light microscope") &&
    json.points.find((p) => p.code === "3.8")?.subPoints.join(",") === "i,ii");
  t("2.6 carries the maximal (i)-(iv) run with its note after (i) (doc p.17)",
    json.points.find((p) => p.code === "2.6")?.subPoints.join(",") === "i,ii,iii,iv" &&
    text("2.6").includes("(i) know the basic structure of an amino acid\nStructures of specific amino acids are not required."));

  // Refuse the mangled forms a naive extraction produces.
  const all = json.points.map((p) => p.text).join("\n");
  t("no running footer leaked into any statement (the defect the independent reparse caught)",
    !all.includes("Pearson Edexcel International Advanced") && !all.includes("Issue 2 – February 2021"));
  t("no non-breaking space survives in any statement (U+00A0 normalised)",
    !all.includes(" "));
  t("no digit-only or empty lines inside any statement (a swallowed page number would land here)",
    json.points.every((p) => p.text.split("\n").every(
      (l) => l.trim().length > 0 && !/^[\d\s.]+$/.test(l))));
  t("no statement carries a RECOMMENDED ADDITIONAL PRACTICAL box (guidance, never a point)",
    !all.includes("RECOMMENDED ADDITIONAL PRACTICAL"));
  t("no A2 code shape anywhere (topics 5-8 are IA2 and out of scope)",
    json.points.every((p) => !/^[5-8]\./.test(p.code)) && !/\b[5-8]\.\d/.test(json.points.map((p) => p.code).join(" ")));
  t("both assembled fractions landed inside statements and meta counts them",
    json.meta.counts.fractions === 2);
}

// ============================================================================
console.log("§3 the comparator orders the REAL code set as the document does");
// ============================================================================
{
  const docOrder = json.points.map((p) => p.code);
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
  t("compareSpecCodes agrees with document order for EVERY pair of the real code set (incl. 1.2 < 1.10)",
    misordered.length === 0, misordered.slice(0, 5).join(", "));
  t("every code equals itself under the comparator",
    docOrder.every((c) => compareSpecCodes(c, c) === 0));
  t("the 4CH1, 4BI1, 4PH1 and IAL shapes still order exactly as before (other courses untouched)",
    compareSpecCodes("1.5C", "1.10") < 0 && compareSpecCodes("2.5B", "2.10") < 0 &&
    compareSpecCodes("1.2P", "1.10") < 0 && compareSpecCodes("10.14", "9.1") > 0 &&
    compareSpecCodes("2.1", "2.1") === 0);
}

// ============================================================================
console.log("§4 the seed SQL is exactly the JSON, course- AND unit-scoped, non-destructive");
// ============================================================================
{
  const topicInserts = [...sql.matchAll(
    /INSERT INTO topics \(course_id, unit_id, slug, code, name, status, sort_order\)\nSELECT c\.id, u\.id, '([^']+)', '([^']+)', '((?:[^']|'')*)', 'coming_soon', (\d+)\nFROM courses c JOIN units u ON u\.course_id = c\.id AND u\.slug = 'unit-(\d)'\nWHERE c\.slug = 'edexcel-ial-as-biology'/g,
  )].map((m) => ({
    slug: m[1], code: m[2], name: m[3].replace(/''/g, "'"),
    sortOrder: Number(m[4]), unit: Number(m[5]),
  }));
  t("exactly one topic INSERT per JSON topic, each resolving u.id through the EXISTING unit rows",
    topicInserts.length === json.topics.length,
    `${topicInserts.length} inserts`);
  t("every topic INSERT targets its own document unit — only unit-1/unit-2, never unit-3, never a literal NULL",
    json.topics.every((x, i) => topicInserts[i]?.unit === x.unit) &&
    topicInserts.every((r) => r.unit === 1 || r.unit === 2) &&
    !/INSERT INTO topics[\s\S]{0,200}SELECT c\.id, NULL/.test(sql));
  t("topic slugs, codes ('Topic N', the IAL convention), names and order are derived",
    json.topics.every((x, i) =>
      topicInserts[i]?.slug === topicSlug(x.number, x.name) &&
      topicInserts[i]?.code === `Topic ${x.number}` &&
      topicInserts[i]?.name === x.name &&
      topicInserts[i]?.sortOrder === x.order));

  const pointInserts = [...sql.matchAll(
    /INSERT INTO spec_points \(topic_id, code, title, description, command_terms, status, sort_order\)\nSELECT t\.id, '([^']+)', '((?:[^']|'')+)', '((?:[^']|'')*)', NULL, 'draft', (\d+)\nFROM topics t JOIN courses cs ON cs\.id = t\.course_id AND cs\.slug = 'edexcel-ial-as-biology'\nWHERE t\.slug = '([^']+)'/g,
  )].map((m) => ({
    code: m[1], title: m[2].replace(/''/g, "'"), text: m[3].replace(/''/g, "'"),
    sortOrder: Number(m[4]), slug: m[5],
  }));
  t("exactly one spec-point INSERT per JSON point, in document order",
    pointInserts.map((r) => r.code).join("|") === json.points.map((p) => p.code).join("|"),
    `${pointInserts.length} inserts`);
  const topicByNumber = new Map(json.topics.map((x) => [x.number, x]));
  t("every point INSERT targets its own topic's derived slug (unit assignment rides the topic)",
    json.points.every((p, i) => {
      const x = topicByNumber.get(p.topic)!;
      return pointInserts[i]?.slug === topicSlug(x.number, x.name);
    }));
  t("every point INSERT carries the exact official wording (formulae, notes, sub-points, typo included)",
    json.points.every((p, i) => pointInserts[i]?.text === p.text),
    json.points.filter((p, i) => pointInserts[i]?.text !== p.text).map((p) => p.code).slice(0, 5).join(","));
  t("sort_order is the official number within the topic",
    json.points.every((p, i) => pointInserts[i]?.sortOrder === p.number));

  t("idempotent: topics DO NOTHING + points DO UPDATE, one conflict clause per insert",
    (sql.match(/^ON CONFLICT \(course_id, slug\) DO NOTHING;$/gm) ?? []).length === json.topics.length &&
    (sql.match(/^ON CONFLICT \(topic_id, code\) DO UPDATE$/gm) ?? []).length === json.points.length);
  // ⚠ The DDL probe keys on STATEMENT STARTS, not bare words — official
  // Biology wording legitimately contains "alter" ("epigenetic changes …
  // can alter the activation of certain genes", 2.14), which a naive
  // \bALTER\b scan flags. SQL DDL always opens its own statement.
  t("non-destructive: no DELETE, no TRUNCATE, no UPDATE outside conflict clauses, no units rows, no DDL",
    !/\bDELETE\b/i.test(sql) && !/\bTRUNCATE\b/i.test(sql) &&
    !/^\s*UPDATE\b/im.test(sql) && !/INSERT INTO units\b/.test(sql) &&
    !/^\s*(CREATE|ALTER|DROP|GRANT|REVOKE)\b/im.test(sql.replace(/^--.*$/gm, "")));
  const executable = sql.replace(/^--.*$/gm, "");
  t("course isolation: scoped to edexcel-ial-as-biology on EVERY insert; siblings never named; A2 named exactly once in executable SQL, inside its untouched-guard",
    (executable.match(/edexcel-ial-as-biology/g) ?? []).length >= json.topics.length + json.points.length &&
    !sql.includes("edexcel-ial-as-chemistry") && !sql.includes("edexcel-igcse-chemistry") &&
    !sql.includes("edexcel-igcse-biology") && !sql.includes("edexcel-igcse-physics") &&
    (executable.match(/edexcel-ial-a2-biology/g) ?? []).length === 1 &&
    /a2_rows[\s\S]{0,200}edexcel-ial-a2-biology/.test(executable));
  t("the self-verifying DO block pins the derived counts (topics, per-unit split, total, core practicals) and the file ends with its sentinel",
    sql.includes(`expected ${json.meta.counts.topics} all unit-linked`) &&
    sql.includes("expected 2/2/0") &&
    sql.includes(`expected ${json.meta.counts.points}'`) &&
    sql.includes(`expected ${json.meta.counts.byUnit["1"]}/${json.meta.counts.byUnit["2"]}'`) &&
    sql.includes(`expected ${json.meta.counts.practical}'`) &&
    sql.trimEnd().endsWith("If this line is missing, the paste was truncated."));
  t("transactional: BEGIN before the first insert, COMMIT after the DO block",
    sql.indexOf("BEGIN;") < sql.indexOf("INSERT INTO topics") &&
    sql.indexOf("COMMIT;") > sql.indexOf("DO $$"));
  t("the header records the 2026-09-06 owner apply, the real course uuid, the intentional draft state, and the pinned source (anti-revert: a regenerated seed must keep the applied record)",
    sql.includes("⚠ APPLIED 2026-09-06") && !sql.includes("NOT YET APPLIED") &&
    sql.includes("cef65cb4-29d6-452c-99d6-95f9921583c5") &&
    sql.includes("INTENTIONALLY") && sql.includes(json.meta.pdfSha256));
  t("one edition, everywhere: Issue 2 pinned; Issue 1 appears only as the change-summary reference",
    json.meta.issue === "Issue 2" &&
    (sql.match(/Issue 2/g) ?? []).length >= 2 &&
    (sql.match(/Issue 1/g) ?? []).length === 1 && sql.includes("delta against Issue 1"));
}

// ============================================================================
console.log("§5 siblings untouched, and the five course shapes stay isolated");
// ============================================================================
{
  const ial004 = readFileSync(repo("supabase/seed/004_ial_as_chem_specification.sql"), "utf8");
  const ialChemCodes = new Set([...ial004.matchAll(/SELECT t\.id, '(\d{1,2}\.\d{1,2})', /g)].map((m) => m[1]));
  t("004 still parses to the whole IAL Chemistry specification (≥ 100 codes — untouched)",
    ialChemCodes.size >= 100, ialChemCodes.size);

  type SiblingExtraction = {
    meta: { counts: { points: number; topics: number } };
    topics: { section: number; letter: string; name: string; order: number }[];
    points: { code: string; topicOrder: number }[];
  };
  const chem: SiblingExtraction = JSON.parse(
    readFileSync(repo("scripts/spec-extract/4ch1-issue3.json"), "utf8"));
  const bio: SiblingExtraction = JSON.parse(
    readFileSync(repo("scripts/spec-extract/4bi1-issue3.json"), "utf8"));
  const phys: SiblingExtraction = JSON.parse(
    readFileSync(repo("scripts/spec-extract/4ph1-issue4.json"), "utf8"));
  t("the 4CH1, 4BI1 and 4PH1 extractions still hold their full specifications (untouched by this branch)",
    chem.points.length === chem.meta.counts.points && chem.points.length >= 150 &&
    bio.points.length === bio.meta.counts.points && bio.points.length >= 150 &&
    phys.points.length === phys.meta.counts.points && phys.points.length >= 150,
    `${chem.points.length}, ${bio.points.length}, ${phys.points.length}`);
  t("the textual collision is real against ALL FOUR sibling shapes (shared codes exist), which is why scoping matters",
    [...ialChemCodes].some((c) => json.points.some((p) => p.code === c)) &&
    chem.points.some((cp) => json.points.some((p) => p.code === cp.code)) &&
    bio.points.some((bp) => json.points.some((p) => p.code === bp.code)) &&
    phys.points.some((pp) => json.points.some((p) => p.code === pp.code)));

  // Build the REAL unit-ed tree the explorer would build post-seed: three
  // existing units, topics hanging off units 1-2, Unit 3 honestly empty.
  const topicNode = (x: Extraction["topics"][number]) => ({
    id: `wbi-t${x.number}`,
    code: `Topic ${x.number}`,
    name: x.name,
    unitId: `wbi-u${x.unit}`,
    points: json.points
      .filter((p) => p.topic === x.number)
      .map((p) => ({
        id: `wbi-pt-${p.code}`, code: p.code, title: pointTitle(p.text),
        description: p.text, commandTerms: [], lessons: [],
      })),
  });
  const unitRows = [
    { id: "wbi-u1", code: "WBI11", name: json.units[0].title },
    { id: "wbi-u2", code: "WBI12", name: json.units[1].title },
    { id: "wbi-u3", code: "WBI13", name: json.units[2].title },
  ];
  const grouped = groupTopicsByUnit(unitRows, json.topics.map(topicNode));
  t("grouping: three real unit groups, no synthetic ungrouped group (every topic unit-linked), Unit 3 honestly empty",
    grouped.length === 3 && grouped.every((g) => g.unit !== null) &&
    grouped[0].topics.length === 2 && grouped[1].topics.length === 2 &&
    grouped[2].topics.length === 0);
  const bioAsUnits: SpecUnitNode[] = grouped.map(({ unit, topics: ts }) => ({
    id: unit!.id, code: unit!.code, name: unit!.name,
    topics: ts.map(({ unitId: _u, ...rest }) => rest),
  }));
  const vocab = courseVocabulary(bioAsUnits);
  t("vocabulary: all points present, each code mapped to its own topic in its own unit",
    vocab.pointsTotal === json.points.length &&
    json.points.every((p) => vocab.topicOfCode.get(p.code) === `wbi-t${p.topic}`),
    vocab.pointsTotal);
  t("unit isolation inside the course: Unit 1 codes bucket to Topic 1/2 nodes only, Unit 2 codes to Topic 3/4 only",
    json.points.filter((p) => p.unit === 1).every((p) =>
      ["wbi-t1", "wbi-t2"].includes(vocab.topicOfCode.get(p.code)!)) &&
    json.points.filter((p) => p.unit === 2).every((p) =>
      ["wbi-t3", "wbi-t4"].includes(vocab.topicOfCode.get(p.code)!)));
  t("zero lesson links — coverage is honestly zero until the 100 AS lessons are actually mapped",
    bioAsUnits.every((u) => u.topics.every((x) => x.points.every((p) => p.lessons.length === 0))));

  // The sibling trees, from their own committed extractions (unit-less).
  const treeOf = (prefix: string, ext: SiblingExtraction): SpecUnitNode[] => [{
    id: `${prefix}-ungrouped`, code: null, name: "Ungrouped",
    topics: ext.topics.map((x) => ({
      id: `${prefix}-${x.section}${x.letter}`, code: `${x.section}(${x.letter})`, name: x.name,
      points: ext.points.filter((p) => p.topicOrder === x.order).map((p) => ({
        id: `${prefix}-pt-${p.code}`, code: p.code, title: null,
        description: "", commandTerms: [], lessons: [],
      })),
    })),
  }];
  const chemUnits = treeOf("4ch1", chem);
  const bioIgUnits = treeOf("4bi1", bio);
  const physUnits = treeOf("4ph1", phys);
  const ialChemUnits: SpecUnitNode[] = [{
    id: "ialc-u1", code: "WCH11", name: "Unit 1",
    topics: [{ id: "ialc-t1", code: "Topic 1", name: "Formulae", points: [{
      id: "ialc-p", code: "1.1", title: null, description: "IAL Chem 1.1", commandTerms: [], lessons: [],
    }] }],
  }];

  const evidence: MasteryEvidenceRow[] = Array.from({ length: 3 }, (_, i) => ({
    attemptId: "a1", qIndex: i, specCode: "1.1", markAwarded: 1, markAvailable: 1,
    attemptedAt: null, source: "lesson-practice", examConditions: false,
  }));
  const mBio = buildCourseMastery({ units: bioAsUnits, evidence });
  const mChem = buildCourseMastery({ units: chemUnits, evidence });
  const mIgBio = buildCourseMastery({ units: bioIgUnits, evidence });
  const mPhys = buildCourseMastery({ units: physUnits, evidence });
  const mIalChem = buildCourseMastery({ units: ialChemUnits, evidence });
  const chemVocab = courseVocabulary(chemUnits);
  const igBioVocab = courseVocabulary(bioIgUnits);
  const physVocab = courseVocabulary(physUnits);
  t("code '1.1' buckets to each course's OWN topic — never across (IAL Bio ≠ 4CH1 ≠ 4BI1 ≠ 4PH1 ≠ IAL Chem)",
    mBio.byTopic["wbi-t1"] !== undefined &&
    mChem.byTopic[chemVocab.topicOfCode.get("1.1")!] !== undefined &&
    mIgBio.byTopic[igBioVocab.topicOfCode.get("1.1")!] !== undefined &&
    mPhys.byTopic[physVocab.topicOfCode.get("1.1")!] !== undefined &&
    mIalChem.byTopic["ialc-t1"] !== undefined &&
    mBio.byTopic[chemVocab.topicOfCode.get("1.1")!] === undefined &&
    mBio.byTopic["ialc-t1"] === undefined &&
    mChem.byTopic["wbi-t1"] === undefined &&
    mPhys.byTopic["wbi-t1"] === undefined);
  t("suffixed sibling codes are foreign evidence to IAL AS Biology, and set aside",
    buildCourseMastery({ units: bioAsUnits, evidence: [{ ...evidence[0], specCode: "1.5C" }] }).ignoredRows === 1 &&
    buildCourseMastery({ units: bioAsUnits, evidence: [{ ...evidence[0], specCode: "2.5B" }] }).ignoredRows === 1 &&
    buildCourseMastery({ units: bioAsUnits, evidence: [{ ...evidence[0], specCode: "1.2P" }] }).ignoredRows === 1);
  t("A2 code shapes (Topics 5-8) are foreign evidence to the AS course, and set aside — AS/A2 isolation",
    buildCourseMastery({ units: bioAsUnits, evidence: [{ ...evidence[0], specCode: "5.1" }] }).ignoredRows === 1 &&
    buildCourseMastery({ units: bioAsUnits, evidence: [{ ...evidence[0], specCode: "8.12" }] }).ignoredRows === 1 &&
    !vocab.topicOfCode.has("5.1") && !vocab.topicOfCode.has("8.12"));

  // The aggressive collision set, through the whole derived stack: codes that
  // exist in MULTIPLE course shapes simultaneously.
  const COLLIDERS = ["1.1", "1.20", "2.6", "3.5", "4.17"];
  t("all five collision codes exist in the real IAL AS Biology vocabulary (the premise of the test)",
    COLLIDERS.every((c) => vocab.topicOfCode.has(c)),
    COLLIDERS.filter((c) => !vocab.topicOfCode.has(c)).join(","));
  const colliderEvidence: MasteryEvidenceRow[] = COLLIDERS.map((code, i) => ({
    attemptId: "ax", qIndex: i, specCode: code, markAwarded: 2, markAvailable: 2,
    attemptedAt: new Date(1757116800000 - i * 864e5).toISOString(),
    source: "lesson-practice", examConditions: false,
  }));
  const mColl = buildCourseMastery({ units: bioAsUnits, evidence: colliderEvidence });
  t("every collision code buckets to its own vocabulary-derived Biology topic; zero ignored",
    mColl.ignoredRows === 0 &&
    COLLIDERS.every((c) => mColl.byTopic[vocab.topicOfCode.get(c)!] !== undefined));

  const nowIso = new Date(1757116800000).toISOString();
  const mZero = buildCourseMastery({ units: bioAsUnits, evidence: [] });
  const iZero = buildCourseInsights({ units: bioAsUnits, mastery: mZero, evidence: [], nowIso });
  const ctxZero = masteryContextFor({ courseId: "wbi-as", units: bioAsUnits, mastery: mZero, insights: iZero });
  t("zero evidence fabricates NOTHING: no queue, no strengths, no weaknesses, no trends, no series",
    iZero.queue.length === 0 && iZero.strengths.length === 0 && iZero.weaknesses.length === 0 &&
    Object.keys(iZero.trendByCode).length === 0 && iZero.series.length === 0);
  t("Hydrogen context on zero evidence is honestly empty: no areas, no retrieval due, no position",
    ctxZero.weakestAreas.length === 0 && ctxZero.strongestAreas.length === 0 &&
    ctxZero.retrievalDue.length === 0 && ctxZero.currentSpecificationPosition === null &&
    ctxZero.summary.unstarted === json.points.length && ctxZero.summary.pointsTotal === json.points.length);
  const iColl = buildCourseInsights({ units: bioAsUnits, mastery: mColl, evidence: colliderEvidence, nowIso });
  t("insights over collision evidence stay inside the Biology vocabulary (no foreign key ever appears)",
    Object.keys(iColl.evidenceByCode).every((c) => vocab.topicOfCode.has(c)) &&
    iColl.queue.every((q2) => vocab.topicOfCode.has(q2.specCode)) &&
    [...iColl.strengths, ...iColl.weaknesses].every((r) => vocab.topicOfCode.has(r.specCode)));
  t("a core-practical point is an ordinary point academically: same fact shapes, no special casing",
    mColl.byCode["4.17"] !== undefined && mColl.byCode["1.1"] !== undefined &&
    JSON.stringify(Object.keys(mColl.byCode["4.17"]).sort()) ===
    JSON.stringify(Object.keys(mColl.byCode["1.1"]).sort()));
}

// ============================================================================
console.log("§6 schema-constraint preflight — required columns derived from the DDL");
// ============================================================================
// ⚠ THE 4CH1 PRODUCTION-ROLLBACK LESSON: 006's first apply died on
// spec_points.title NOT NULL because every check compared seed ↔ extraction
// and none compared seed ↔ SCHEMA. The expectation comes from the DDL, never
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
  t("every topics INSERT names every DDL-required column (and unit_id besides)",
    namesEvery(/INSERT INTO topics \(([^)]+)\)/g, topicsRequired) &&
    [...sql.matchAll(/INSERT INTO topics \(([^)]+)\)/g)].every((h) =>
      h[1].split(",").map((c) => c.trim()).includes("unit_id")));

  const specSelects = [...sql.matchAll(/INSERT INTO spec_points \([^)]+\)\nSELECT ([\s\S]*?)\nFROM topics t JOIN/g)];
  const SAFE_SHAPE = /^t\.id, '(?:[^']|'')+', '(?:[^']|'')+', '(?:[^']|'')*(?:[^']|'')+', NULL, 'draft', \d+$/;
  const unsafe = specSelects.filter((m) => !SAFE_SHAPE.test(m[1].trim()));
  t("every spec_points SELECT supplies non-NULL code, title and description (the exact defect that reached production)",
    specSelects.length === json.points.length && unsafe.length === 0,
    `${specSelects.length} selects, ${unsafe.length} outside the safe shape: ${unsafe[0]?.[1]?.slice(0, 80) ?? ""}`);
  const topicSelects = [...sql.matchAll(/INSERT INTO topics \([^)]+\)\nSELECT ([\s\S]*?)\nFROM courses c JOIN/g)];
  const TOPIC_SAFE_SHAPE = /^c\.id, u\.id, '(?:[^']|'')+', '(?:[^']|'')+', '(?:[^']|'')+', 'coming_soon', \d+$/;
  t("every topics SELECT supplies c.id and u.id (unit_id from the join, never NULL, never fabricated)",
    topicSelects.length === json.topics.length &&
    topicSelects.every((m) => TOPIC_SAFE_SHAPE.test(m[1].trim())));
  t("the DO UPDATE arm also carries title, so a re-run repairs titles too",
    (sql.match(/SET title = EXCLUDED\.title/g) ?? []).length === json.points.length);

  const insertTitles = [...sql.matchAll(/\nSELECT t\.id, '(?:[^']|'')+', '((?:[^']|'')+)', /g)]
    .map((m) => m[1].replace(/''/g, "'"));
  t("every title equals pointTitle(official text): non-empty, ≤ TITLE_MAX+1, Pearson's own words",
    insertTitles.length === json.points.length &&
    json.points.every((p, i) => {
      const title = insertTitles[i];
      return title === pointTitle(p.text) && title.length > 0 && title.length <= TITLE_MAX + 1;
    }),
    json.points.filter((p, i) => insertTitles[i] !== pointTitle(p.text)).map((p) => p.code).slice(0, 5).join(","));
  t("a core practical's title joins the document's heading and task stem (never the bare heading)",
    json.points.filter((p) => p.practical).every((p) => {
      const title = pointTitle(p.text);
      return title.startsWith(`CORE PRACTICAL ${p.corePractical} — `) && title.length > 20;
    }));
  t("a sub-pointed statement's title is its own first (i) line — faithful, deterministic",
    json.points.filter((p) => p.subPoints.length > 0 && !p.practical).every(
      (p) => pointTitle(p.text).startsWith("(i)")));
}

// ============================================================================
console.log("§7 the 013 lifecycle pass touches lifecycle and NOTHING else");
// ============================================================================
// 013 flips 012's rows draft -> live+verified_at (005/007/009/011's exact
// semantics). This section refuses any version of 013 that could write
// academic content, reach another course, touch A2, or run unguarded. Every
// count is cross-checked against the extractions so the file cannot drift
// from the source of truth. The unit-linkage pre-guards are the structural
// INVERSE of 011's unit-less assertions.
{
  const v = readFileSync(repo("supabase/seed/013_ial_as_biology_official_spec_verification.sql"), "utf8");
  type ChemMeta = { meta: { counts: { points: number; topics: number; cOnly: number } } };
  type BioMeta = { meta: { counts: { points: number; topics: number; bOnly: number } } };
  type PhysMeta = { meta: { counts: { points: number; topics: number; pOnly: number } } };
  const chemMeta: ChemMeta = JSON.parse(
    readFileSync(repo("scripts/spec-extract/4ch1-issue3.json"), "utf8"));
  const bioMeta: BioMeta = JSON.parse(
    readFileSync(repo("scripts/spec-extract/4bi1-issue3.json"), "utf8"));
  const physMeta: PhysMeta = JSON.parse(
    readFileSync(repo("scripts/spec-extract/4ph1-issue4.json"), "utf8"));

  const sets = [...v.matchAll(/\bSET\s+([\s\S]*?)\n\s*FROM\b/g)].map((m) => m[1]);
  t("exactly one UPDATE, setting only status and verified_at",
    sets.length === 1 && /^status = 'live', verified_at = now\(\)\s*$/.test(sets[0] ?? ""),
    JSON.stringify(sets));
  t("no academic column is ever written (unit_id included — the unit-ed course's extra surface)",
    !/SET[\s\S]{0,200}?(code|title|description|topic_id|unit_id|sort_order|command_terms)\s*=/.test(v));
  t("the UPDATE targets spec_points and never topics or units",
    /UPDATE spec_points p/.test(v) && !/UPDATE topics\b/.test(v) && !/UPDATE units\b/.test(v));
  t("no INSERT, DELETE or TRUNCATE anywhere",
    !/\bINSERT\b/i.test(v) && !/\bDELETE\b/i.test(v) && !/\bTRUNCATE\b/i.test(v));
  t("no DDL and no grant/RLS surface (CREATE/ALTER/DROP/GRANT/REVOKE/POLICY)",
    !/\b(CREATE|ALTER|DROP|GRANT|REVOKE|POLICY)\b/i.test(v.replace(/^--.*$/gm, "")));
  // ⚠ Anchored to the UPDATE STATEMENT ITSELF — 4CH1's sabotage lesson: the
  //   same scope lines exist in the pre-guard SELECTs, so a bare regex over
  //   the whole file passed even with the UPDATE's scope stripped.
  const updateStmt = /UPDATE spec_points p[\s\S]*?;/.exec(v)?.[0] ?? "";
  t("the UPDATE statement itself is scoped by course slug AND the draft/NULL state",
    updateStmt.includes("c.slug = 'edexcel-ial-as-biology'") &&
    updateStmt.includes("p.status = 'draft' AND p.verified_at IS NULL"),
    updateStmt.slice(0, 200));
  t("sibling courses and A2 are named only inside their unchanged-guards",
    (v.match(/edexcel-igcse-chemistry/g) ?? []).length === 2 &&
    (v.match(/edexcel-igcse-biology/g) ?? []).length === 2 &&
    (v.match(/edexcel-igcse-physics/g) ?? []).length === 2 &&
    (v.match(/edexcel-ial-as-chemistry/g) ?? []).length === 1 &&
    (v.match(/edexcel-ial-a2-biology/g) ?? []).length === 2 &&
    /INTO chem_verified, chem_c/.test(v) &&
    /INTO bio_verified, bio_b/.test(v) &&
    /INTO phys_verified, phys_p/.test(v) &&
    /INTO ial_live, ial_verified, ial_archived/.test(v) &&
    /INTO a2_topics\b/.test(v));
  const P = json.meta.counts.points;
  t("guards: eligible pre-check, INVERTED unit-linkage pre-checks (all topics unit-linked, 2/2/0, per-unit points), ROW_COUNT, end state, four sibling guards, A2 guard, other-total guard, idempotent no-op arm",
    v.includes(`expected ${P} or an exact no-op`) &&
    v.includes("expected 4 all unit-linked") &&
    v.includes("expected 2/2/0") &&
    v.includes(`expected ${json.meta.counts.byUnit["1"]}/${json.meta.counts.byUnit["2"]}'`) &&
    v.includes(`expected ${json.meta.counts.practical}'`) &&
    v.includes("duplicate codes, % malformed codes") &&
    v.includes("GET DIAGNOSTICS updated = ROW_COUNT") &&
    v.includes(`expected exactly ${P}`) &&
    v.includes(`expected ${P} / 0 / 0`) &&
    v.includes(`expected ${chemMeta.meta.counts.topics}/${chemMeta.meta.counts.points}/${chemMeta.meta.counts.cOnly}`) &&
    v.includes(`expected ${bioMeta.meta.counts.topics}/${bioMeta.meta.counts.points}/${bioMeta.meta.counts.bOnly}`) &&
    v.includes(`expected ${physMeta.meta.counts.topics}/${physMeta.meta.counts.points}/${physMeta.meta.counts.pOnly}`) &&
    v.includes("expected 157/157/1") &&
    v.includes("expected 0/0 — this pass must never touch A2") &&
    v.includes(`already applied — ${P} rows live+verified`));
  t("the malformed-code guard uses the official IAL AS Biology shape (no letter suffix)",
    v.includes("p.code !~ '^[1-4]\\.[0-9]{1,2}$'"));
  const otherTotal = chemMeta.meta.counts.points + bioMeta.meta.counts.points +
    physMeta.meta.counts.points + 158; // IAL Chemistry: 157 live + 1 archived (011's own pinned baseline)
  t("the other-total guard equals the sum of the sibling extractions plus IAL Chemistry's 158",
    v.includes(`expected ${otherTotal} (${chemMeta.meta.counts.points} + ${bioMeta.meta.counts.points} + ${physMeta.meta.counts.points} + 158)`) &&
    otherTotal === 711);
  t("transactional with sentinel: BEGIN, one DO block, COMMIT, END-OF-013 last line",
    v.indexOf("BEGIN;") < v.indexOf("DO $$") &&
    v.indexOf("COMMIT;") > v.indexOf("END $$;") &&
    v.trimEnd().endsWith("If this line is missing, the paste was truncated."));
  t("the header records the 2026-09-06 owner apply AND the owner's post-apply verification (anti-revert; 013 is hand-written)",
    v.includes("⚠ APPLIED 2026-09-06") && !v.includes("NOT YET APPLIED") &&
    v.includes("VERIFIED 2026-09-06") &&
    v.includes("ONLY after seed 012 was applied") &&
    v.includes("80 live + verified_at set · 0 draft · 0 verified_at NULL") &&
    v.includes(json.meta.pdfSha256));
  t("013's derived counts agree with the extraction (the reader's cross-check: 80 points, 38/42, 9 CPs)",
    P === 80 && json.meta.counts.byUnit["1"] === 38 && json.meta.counts.byUnit["2"] === 42 &&
    json.meta.counts.practical === 9 &&
    v.includes("expected 80") && v.includes("expected 38/42") && v.includes("expected 9"));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
