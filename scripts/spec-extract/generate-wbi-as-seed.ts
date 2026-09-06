/**
 * IAL AS Biology seed generator — wbi-as-issue2.json →
 * supabase/seed/012_ial_as_biology_specification.sql
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/spec-extract/generate-wbi-as-seed.ts
 *
 * ============================================================================
 * ⚠ DETERMINISTIC, OR IT IS NOT A SEED
 * ============================================================================
 * The SQL is a pure function of the committed extraction (wbi-as-issue2.json).
 * Re-running this script must produce a byte-identical file. The generated
 * file follows 010's hardened conventions (self-verifying DO block, truncation
 * sentinel, draft lifecycle) with ONE structural difference — this is the
 * repository's first GENERATED seed for a unit-ed course:
 *
 *   - topics carry unit_id, resolved the 004 way:
 *       FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-N'
 *     The units themselves ALREADY EXIST in production (unit-1/WBI11,
 *     unit-2/WBI12, unit-3/WBI13, seeded by 003_biology_lesson_catalogue.sql);
 *     this seed creates NO units rows and refuses to run if they are absent
 *     (the join produces zero rows → the DO block counts 0 topics → RAISE).
 *   - topics.code is the human label 'Topic N' (the IAL Chemistry convention,
 *     001/004), not the IGCSE document-code style.
 *   - Unit 3 (Practical Skills in Biology I) gets NO topics and NO points —
 *     the official document defines none, and the DO block asserts the zero
 *     (owner decision 3: nothing fabricated).
 *
 * Everything else is 010's shape exactly:
 *   - topics:      INSERT … ON CONFLICT (course_id, slug) DO NOTHING
 *   - spec points: INSERT … ON CONFLICT (topic_id, code) DO UPDATE
 *   - everything scoped by courses.slug = 'edexcel-ial-as-biology'
 *   - status 'draft', verified_at NULL until the official verification pass
 *     (seed 013)
 *
 * Owner decisions carried by this file (Phase 2 approval, 2026-09-06):
 *   - ONE spec point per officially numbered Pearson statement (80 at AS);
 *     roman-numeral sub-points stay INSIDE the description as their own
 *     lines, never exploded into rows.
 *   - RECOMMENDED ADDITIONAL PRACTICAL boxes are not points and are not here.
 *   - The Issue 2 source typo in 3.5(ii) ('knderstand') is preserved
 *     verbatim — source fidelity over editorial correction.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const COURSE_SLUG = "edexcel-ial-as-biology";

type Extraction = {
  meta: {
    document: string;
    qualification: { ias: string; ial: string };
    issue: string;
    published: string;
    publisher: string;
    isbn: string;
    firstTeaching: string;
    firstAssessment: string;
    source: string;
    pdfSha256: string;
    counts: {
      points: number;
      topics: number;
      units: number;
      practical: number;
      subPointed: number;
      subPoints: number;
      notes: number;
      recommendedPracticals: number;
      fractions: number;
      byUnit: Record<string, number>;
      byTopic: Record<string, number>;
    };
  };
  units: { number: number; title: string; level: string }[];
  topics: { number: number; unit: number; name: string; order: number }[];
  points: {
    code: string;
    topic: number;
    unit: number;
    number: number;
    order: number;
    practical: boolean;
    corePractical: number | null;
    subPoints: string[];
    text: string;
  }[];
};

/** "Molecules, Transport and Health" (Topic 1) →
 *  "topic-1-molecules-transport-and-health".
 *  Deterministic and re-derivable: the test suite recomputes it. The number
 *  prefix keeps slugs collision-proof under any future topic rename. */
export function topicSlug(number: number, name: string): string {
  const tail = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `topic-${number}-${tail}`;
}

const q = (s: string) => s.replace(/'/g, "''");

/**
 * spec_points.title is NOT NULL (0001) — the constraint that sank 006's first
 * apply attempt. The convention ("Titles are trims of the same extracted
 * text") is followed deterministically: the title is the statement's own
 * first line, whole when it fits, else cut at the last word boundary with an
 * honest ellipsis. ONE Biology-specific rule: a core-practical statement's
 * first line is the bare heading "CORE PRACTICAL n", which names nothing, so
 * the title joins the document's own heading and its task stem with an em
 * dash — every word still Pearson's, in Pearson's order.
 */
export const TITLE_MAX = 88;
export function pointTitle(text: string): string {
  const lines = text.split("\n");
  let stem = lines[0].trim();
  if (/^CORE PRACTICAL \d+$/.test(stem) && lines.length > 1) {
    stem = `${stem} — ${lines[1].trim()}`;
  }
  if (stem.length <= TITLE_MAX) return stem;
  const cut = stem.lastIndexOf(" ", TITLE_MAX - 1);
  return `${stem.slice(0, cut > 0 ? cut : TITLE_MAX - 1).trimEnd()}…`;
}

function main() {
  const data: Extraction = JSON.parse(
    readFileSync(join(HERE, "wbi-as-issue2.json"), "utf8"),
  );
  const { meta, units, topics, points } = data;

  const byTopic = Object.entries(meta.counts.byTopic)
    .map(([t, n]) => `Topic ${t}: ${n}`)
    .join(", ");
  const u1 = meta.counts.byUnit["1"];
  const u2 = meta.counts.byUnit["2"];

  const lines: string[] = [];
  lines.push(`-- ============================================================================
-- AILEMY — PEARSON EDEXCEL IAL AS BIOLOGY (XBI11 · WBI11/WBI12/WBI13)
-- SPECIFICATION — ${meta.counts.topics} topics across Units 1-2, ${meta.counts.points} specification points
-- (${byTopic}; Unit 1: ${u1}, Unit 2: ${u2}, Unit 3: none — it defines no content)
--
-- ⚠ APPLIED 2026-09-06 by the owner via the Supabase SQL Editor (whole-file
--   paste — 76,751 bytes clipboard-verified byte-identical to this file
--   (sha256 9110b365…4ee9 on both sides), END-OF-012 sentinel visibly the
--   last line of the paste, "Success. No rows returned", no errors).
--   Owner-run read-only PRECHECK BEFORE the apply (15-row table, sentinel
--   present) matched every expected row exactly: course
--   edexcel-ial-as-biology (uuid cef65cb4-29d6-452c-99d6-95f9921583c5,
--   live) at exactly 3 units (unit-1=WBI11, unit-2=WBI12, unit-3=WBI13),
--   0 topics, 0 spec points, 100 lessons, 0 lesson mappings (checked from
--   BOTH directions), 0 question mappings, 48 past papers (20/19/9 by
--   unit); A2 Biology 0 topics / 0 points; IGCSE Chemistry 28/182/182/52;
--   IGCSE Biology 22/176/176/42; IGCSE Physics 30/195/195/48; IAL AS
--   Chemistry 157/157/1; non-target specification total 711. Owner-run
--   read-only POST-012 check AFTER the apply (19-row table, sentinel
--   present) returned exactly:
--     · 4 topics, all unit-linked (2/2/0 on unit-1/unit-2/unit-3)
--     · 80 specification points, 38 on unit-1 and 42 on unit-2, 0 on
--       unit-3; 9 core-practical statements
--     · all 80 points status='draft', verified_at NULL — INTENTIONALLY
--       awaiting the Phase 3 official-verification lifecycle pass (seed
--       013, applied later the same day)
--     · 0 duplicate codes, 0 malformed codes, 0 rows missing
--       title/description, 0 lesson and 0 question mappings
--     · A2 Biology and all four sibling courses unchanged; non-target
--       total 711.
--
-- PROVENANCE — nothing here is invented:
--   Every topic, code and statement is extracted from the OFFICIAL
--   ${meta.document},
--   ${meta.issue} (${meta.published}), ${meta.publisher}
--   (IAS ${meta.qualification.ias}, IAL ${meta.qualification.ial}; first teaching ${meta.firstTeaching},
--   first examination from ${meta.firstAssessment}; ISBN ${meta.isbn}),
--   downloaded from
--   ${meta.source}
--   pdf sha256 ${meta.pdfSha256}
--   by scripts/spec-extract/extract_wbi_as.py. The committed extraction
--   (scripts/spec-extract/wbi-as-issue2.json) is the reviewable
--   intermediate; this file is generated from it by generate-wbi-as-seed.ts
--   and is not hand-edited. Issue 2's own change summary lists exactly one
--   delta against Issue 1 (a synoptic-questions sentence for Units 4/5) —
--   no AS content changes — so Issue 2 is authoritative for the whole
--   2019-2025 WBI11-13 paper corpus. The extraction STOPS at the Unit 4
--   opener, so no A2 row was ever read. Wording was cross-checked verbatim
--   against an independent pdfplumber reparse of the same PDF by its own
--   parser (80/80 codes in identical sequence, 80/80 statement chunks
--   verbatim, whitespace-normalised — this cross-check is what caught the
--   running-footer leak during development); both built formulae (4.17,
--   4.18) were verified span-by-span against the PDF's own glyph geometry.
--
-- STRUCTURE — the document's own, nothing imposed (owner decisions 2 & 3):
--   Topics 1-2 belong to Unit 1 (WBI11), Topics 3-4 to Unit 2 (WBI12) —
--   derived from the unit openers, and carried by topics.unit_id resolving
--   through the EXISTING units rows (this seed creates no units). Unit 3
--   (WBI13, Practical Skills in Biology I) defines no numbered statements
--   and gets NO topics and NO points; its papers assess the practicals of
--   Units 1-2 through THIS vocabulary. One spec point per officially
--   numbered statement: roman-numeral sub-points (i)/(ii)/… stay inside the
--   description as their own lines (${meta.counts.subPointed} statements carry ${meta.counts.subPoints} sub-points);
--   ${meta.counts.practical} statements ARE core practicals (CP1-CP${meta.counts.practical}), their official codes in
--   the numbered sequence; the document's ${meta.counts.recommendedPracticals} RECOMMENDED ADDITIONAL
--   PRACTICAL boxes are guidance, not statements, and are NOT seeded.
--   Pearson's own italic guidance notes (${meta.counts.notes}) and the Issue 2 source
--   typo in 3.5(ii) ('knderstand') are preserved verbatim — source fidelity
--   over editorial correction (owner decision 4).
--
-- Idempotent: topics ON CONFLICT (course_id, slug) DO NOTHING;
--             spec points ON CONFLICT (topic_id, code) DO UPDATE.
-- Course-scoped: every statement resolves through courses.slug = '${COURSE_SLUG}'.
-- Unit-scoped: every topic resolves its unit through units.slug on THIS course.
-- Self-verifying: the DO block before COMMIT recounts and RAISEs on drift,
-- so a truncated paste aborts the whole transaction instead of half-applying.
-- No DELETEs, no cross-course writes, no units rows, no A2 writes, no schema
-- changes. All ${meta.counts.points} points land status 'draft', verified_at NULL —
-- INTENTIONALLY awaiting the Phase 3 official-verification lifecycle pass
-- (the 004/005 … 010/011 convention; that pass is seed 013).
-- ============================================================================

BEGIN;
`);

  lines.push(`-- ── Topics (${meta.counts.topics}: two per content unit, unit_id resolved via units.slug) ──────\n`);
  for (const t of topics) {
    const slug = topicSlug(t.number, t.name);
    lines.push(`-- Topic ${t.number} — ${t.name} (Unit ${t.unit})
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, '${q(slug)}', 'Topic ${t.number}', '${q(t.name)}', 'coming_soon', ${t.order}
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-${t.unit}'
WHERE c.slug = '${COURSE_SLUG}'
ON CONFLICT (course_id, slug) DO NOTHING;
`);
  }

  lines.push(`-- ── Spec points (upsert by (topic_id, code)) ────────────────────────────────\n`);
  const topicByNumber = new Map(topics.map((t) => [t.number, t]));
  for (const p of points) {
    const t = topicByNumber.get(p.topic);
    if (!t) throw new Error(`point ${p.code}: no topic ${p.topic}`);
    const slug = topicSlug(t.number, t.name);
    const marks = [
      p.practical ? `CORE PRACTICAL ${p.corePractical}` : null,
      p.subPoints.length ? `sub-points ${p.subPoints.map((s) => `(${s})`).join("")}` : null,
    ].filter(Boolean);
    lines.push(`-- ${p.code} — official ${meta.issue} Topic ${t.number}, Unit ${t.unit}${marks.length ? ` (${marks.join("; ")})` : ""}
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '${p.code}', '${q(pointTitle(p.text))}', '${q(p.text)}', NULL, 'draft', ${p.number}
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = '${COURSE_SLUG}'
WHERE t.slug = '${q(slug)}'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;
`);
  }

  lines.push(`-- ── Self-verification: abort the transaction on ANY drift ───────────────────
-- (Guards the SQL-Editor truncated-paste failure mode: a missing tail means a
--  missing COMMIT, and a mismatch here means a RAISE — either way, nothing
--  half-applies. The unit joins above also make this the missing-units guard:
--  absent units rows insert zero topics, and the first count RAISEs.)
DO $$
DECLARE
  topic_count integer;
  orphan_topics integer;
  u1_topics integer;
  u2_topics integer;
  u3_rows integer;
  point_count integer;
  u1_points integer;
  u2_points integer;
  cp_count integer;
  a2_rows integer;
BEGIN
  SELECT count(*) INTO topic_count FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}';
  SELECT count(*) INTO orphan_topics FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND t.unit_id IS NULL;
  SELECT count(*) INTO u1_topics FROM topics t
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND u.slug = 'unit-1';
  SELECT count(*) INTO u2_topics FROM topics t
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND u.slug = 'unit-2';
  SELECT count(*) INTO u3_rows FROM topics t
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND u.slug = 'unit-3';
  SELECT count(*) INTO point_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}';
  SELECT count(*) INTO u1_points FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND u.slug = 'unit-1';
  SELECT count(*) INTO u2_points FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND u.slug = 'unit-2';
  SELECT count(*) INTO cp_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND p.description LIKE 'CORE PRACTICAL %';
  SELECT count(*) INTO a2_rows FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-a2-biology';
  IF topic_count <> ${meta.counts.topics} OR orphan_topics <> 0 THEN
    RAISE EXCEPTION '012 aborted: % topics (% without unit_id), expected ${meta.counts.topics} all unit-linked — are units unit-1/unit-2 present on ${COURSE_SLUG}?', topic_count, orphan_topics;
  END IF;
  IF u1_topics <> 2 OR u2_topics <> 2 OR u3_rows <> 0 THEN
    RAISE EXCEPTION '012 aborted: topics per unit %/%/% (unit-1/unit-2/unit-3), expected 2/2/0 — Unit 3 defines no syllabus content', u1_topics, u2_topics, u3_rows;
  END IF;
  IF point_count <> ${meta.counts.points} THEN
    RAISE EXCEPTION '012 aborted: % spec points, expected ${meta.counts.points}', point_count;
  END IF;
  IF u1_points <> ${u1} OR u2_points <> ${u2} THEN
    RAISE EXCEPTION '012 aborted: points per unit %/% (unit-1/unit-2), expected ${u1}/${u2}', u1_points, u2_points;
  END IF;
  IF cp_count <> ${meta.counts.practical} THEN
    RAISE EXCEPTION '012 aborted: % core-practical statements, expected ${meta.counts.practical}', cp_count;
  END IF;
  IF a2_rows <> 0 THEN
    RAISE EXCEPTION '012 aborted: A2 Biology holds % topics — this AS seed must not run against a drifted A2 course', a2_rows;
  END IF;
END $$;

COMMIT;
-- END OF 012 — ${meta.counts.topics} topics (Units 1-2), ${meta.counts.points} points, Unit 3 intentionally empty. If this line is missing, the paste was truncated.
`);

  const out = join(HERE, "../../supabase/seed/012_ial_as_biology_specification.sql");
  writeFileSync(out, lines.join("\n"));
  console.log(`wrote ${out}: ${topics.length} topics, ${points.length} points`);
}

// Import-safe: the test suite imports topicSlug/pointTitle without regenerating.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
