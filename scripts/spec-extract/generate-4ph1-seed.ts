/**
 * 4PH1 seed generator — 4ph1-issue4.json → supabase/seed/010_igcse_physics_specification.sql
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/spec-extract/generate-4ph1-seed.ts
 *
 * ============================================================================
 * ⚠ DETERMINISTIC, OR IT IS NOT A SEED
 * ============================================================================
 * The SQL is a pure function of the committed extraction (4ph1-issue4.json).
 * Re-running this script must produce a byte-identical file; anything that
 * varies run-to-run (timestamps, random ids, map iteration order) is a bug.
 * The generated file follows 004/005/006/008's conventions exactly:
 *   - topics:      INSERT … ON CONFLICT (course_id, slug) DO NOTHING
 *   - spec points: INSERT … ON CONFLICT (topic_id, code) DO UPDATE
 *   - everything scoped by courses.slug = 'edexcel-igcse-physics'
 *   - status 'draft', verified_at NULL until the official verification pass
 * with 006's DO block inside the transaction that counts what the seed just
 * wrote and RAISEs on any mismatch — so a truncated paste (the SQL-Editor
 * failure mode this project has already lived through) aborts instead of
 * half-applying.
 *
 * unit_id is NULL THROUGHOUT: 4PH1 has no unit layer (two papers assess the
 * same eight content sections), and the generic unit-less grouping renders
 * such topics as the top level. No units rows are created.
 *
 * Physics's structural notes versus the 4BI1 sibling:
 *   - the Paper 2-only suffix letter is P (Biology's is B, Chemistry's C);
 *   - there are NO context headings in 4PH1 (meta.counts.contexts is 0 and
 *     the extractor would have recorded any it found);
 *   - many statements carry the document's word- and symbol-form equations.
 *     Stacked fractions were re-assembled deterministically from their drawn
 *     bars into inline form and super/subscripts into Unicode (v², λ₀, ¹⁴₆C,
 *     ½) by extract_4ph1.py — see meta.equationRendering. The description
 *     column carries that inline form verbatim; nothing here re-touches it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const COURSE_SLUG = "edexcel-igcse-physics";

type Extraction = {
  meta: {
    document: string;
    issue: string;
    publisher: string;
    firstTeaching: string;
    firstAssessment: string;
    source: string;
    pdfSha256: string;
    counts: {
      points: number;
      topics: number;
      pOnly: number;
      practical: number;
      contexts: number;
      fractions: number;
      bySection: Record<string, number>;
    };
  };
  sections: { number: number; name: string }[];
  topics: { section: number; sectionName: string; letter: string; name: string; order: number }[];
  points: {
    code: string;
    section: number;
    number: number;
    pOnly: boolean;
    practical: boolean;
    context: string | null;
    topicOrder: number;
    order: number;
    text: string;
  }[];
};

/** "1(c) Forces, movement, shape and momentum" →
 *  "1c-forces-movement-shape-and-momentum".
 *  Deterministic and re-derivable: the test suite recomputes it. */
export function topicSlug(section: number, letter: string, name: string): string {
  const tail = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${section}${letter}-${tail}`;
}

const q = (s: string) => s.replace(/'/g, "''");

/**
 * spec_points.title is NOT NULL (0001) — the constraint that sank 006's first
 * apply attempt on 2026-09-04. The 004/006/008 convention ("Titles are trims
 * of the same extracted text") is followed deterministically: the title is
 * the statement's own first line (its stem, before any bullets or displayed
 * equations), whole when it fits the observed length band, else cut at the
 * last word boundary with an honest ellipsis. Every word is Pearson's, in
 * Pearson's order — a trim, never a paraphrase.
 */
export const TITLE_MAX = 88;
export function pointTitle(text: string): string {
  const stem = text.split("\n")[0].trim();
  if (stem.length <= TITLE_MAX) return stem;
  const cut = stem.lastIndexOf(" ", TITLE_MAX - 1);
  return `${stem.slice(0, cut > 0 ? cut : TITLE_MAX - 1).trimEnd()}…`;
}

function main() {
  const data: Extraction = JSON.parse(
    readFileSync(join(HERE, "4ph1-issue4.json"), "utf8"),
  );
  const { meta, topics, points } = data;

  const bySection = Object.entries(meta.counts.bySection)
    .map(([s, n]) => `section ${s}: ${n}`)
    .join(", ");

  const lines: string[] = [];
  lines.push(`-- ============================================================================
-- AILEMY — PEARSON EDEXCEL INTERNATIONAL GCSE PHYSICS (4PH1) SPECIFICATION
-- ${meta.counts.topics} sub-topics, ${meta.counts.points} specification points (${bySection})
--
-- ⚠ APPLIED 2026-09-06 by the owner via the Supabase SQL Editor (whole-file
--   paste — 150,915 bytes clipboard-verified byte-identical to this file
--   (sha256 86c5d894…e9b9 on both sides), END-OF-010 sentinel visibly the
--   last line of the paste, "Success. No rows returned", no errors).
--   Owner-run read-only baseline BEFORE the apply: the live course row is
--   slug edexcel-igcse-physics, uuid e63ebefd-1936-4344-9947-2fbc49bfdc66,
--   status 'live', at exactly 0 units / 0 topics / 0 spec points /
--   0 lessons / 0 lesson or question mappings, 50 past papers; IGCSE
--   Chemistry at 28 topics / 182 live+verified points (52 C-suffix); IGCSE
--   Biology at 22 topics / 176 live+verified points (42 B-suffix); IAL AS
--   Chemistry at 157 live+verified + 1 archived; 516 specification points
--   across the three sibling courses. Owner-run read-only verification
--   AFTER the apply (the 17-row post-010 check, sentinel row present)
--   returned exactly:
--     · 30 topics, all unit_id NULL, none empty
--     · 195 specification points, 48 P-suffix (Paper 2-only)
--     · all 195 points status='draft', verified_at NULL — INTENTIONALLY
--       awaiting the Phase 3 official-verification lifecycle pass
--       (the 004/005, 006/007 and 008/009 convention; that pass is seed
--       011, applied later the same day)
--     · 0 duplicate codes, 0 malformed codes, 0 rows missing
--       title/description, zero lesson and question mappings on 4PH1
--     · siblings unchanged (Chemistry 28/182/182/52, Biology 22/176/176/42,
--       IAL 157/157/1; non-Physics total 516).
--
-- PROVENANCE — nothing here is invented:
--   Every sub-topic, code and statement is extracted from the OFFICIAL
--   ${meta.document},
--   ${meta.issue}, ${meta.publisher} (first teaching ${meta.firstTeaching},
--   first examination ${meta.firstAssessment}; ISBN 978 1 446 93119 6),
--   downloaded from
--   ${meta.source}
--   pdf sha256 ${meta.pdfSha256}
--   by scripts/spec-extract/extract_4ph1.py. The committed extraction
--   (scripts/spec-extract/4ph1-issue4.json) is the reviewable intermediate;
--   this file is generated from it by generate-4ph1-seed.ts and is not
--   hand-edited. Pearson serves Issue 4 as the current document; its own
--   change summary against the previous issue lists administrative deltas
--   only (series availability, forbidden combinations, one command word) —
--   no content-section changes, so Issue 4 is authoritative for the whole
--   2019-2025 paper corpus. Non-equation wording was cross-checked
--   chunk-verbatim against an independent pdftotext extraction of the same
--   PDF (223 chunks); every equation and fraction assembly was verified
--   span-by-span against the PDF's own glyph geometry (${meta.counts.fractions} drawn-bar
--   fractions, the ¹⁴₆C nuclide, every super/subscript).
--
-- STRUCTURE — the document's own, nothing imposed:
--   Eight content sections (1 Forces and motion, 2 Electricity, 3 Waves,
--   4 Energy resources and energy transfers, 5 Solids, liquids and gases,
--   6 Magnetism and electromagnetism, 7 Radioactivity and particles,
--   8 Astrophysics) with lettered sub-topics. Sub-topics become topics rows
--   with unit_id NULL — 4PH1 HAS NO UNITS and none are fabricated (the
--   generic unit-less grouping renders them as the top level). The topic
--   code "1(a)" carries the section, so the section layer loses nothing.
--   4PH1 has no context headings (unlike 4BI1); the extractor asserted so.
--
-- PAPER 2-ONLY CONTENT — carried by the official codes themselves:
--   "specification statements that are in bold with a 'P' reference relate
--   to content that is in the International GCSE in Physics only and is not
--   found in the International GCSE in Science (Double Award)" (spec p.1);
--   Paper 1 "assesses core content that is not in bold and does not have a
--   'P' reference", Paper 2 "assesses all the content" (spec pp.8-9).
--   So the P SUFFIX in the code (${meta.counts.pOnly} of ${meta.counts.points} points) IS the official
--   Paper 2-only marker — no schema field is needed, and the extractor
--   asserted bold ⟺ P for every statement. Practical investigations
--   (points in italics, beginning "practical:" — ${meta.counts.practical} points) keep that
--   prefix in their official wording.
--
-- EQUATIONS — deterministic inline rendering, never a paraphrase:
--   Stacked fractions are re-assembled from their drawn bars (numerator
--   above, denominator below) into inline form, each side parenthesised iff
--   it contains a space or operator; the document's built ½ renders as ½;
--   raised/lowered glyphs become Unicode super/subscripts (v², λ₀, Vₚ, β⁻,
--   ¹⁴₆C) with a hard extractor refusal on any unmappable character. Word
--   and symbol equation forms stay separate lines, exactly as printed. The
--   document's own quirks are kept verbatim (the letter x in
--   'E = I × V x t'; 'total energy output' in the efficiency denominator).
--
-- Idempotent: topics ON CONFLICT (course_id, slug) DO NOTHING;
--             spec points ON CONFLICT (topic_id, code) DO UPDATE.
-- Course-scoped: every statement resolves through courses.slug = '${COURSE_SLUG}'.
-- Self-verifying: the DO block before COMMIT recounts and RAISEs on drift,
-- so a truncated paste aborts the whole transaction instead of half-applying.
-- No DELETEs, no cross-course writes, no units rows, no schema changes.
-- All ${meta.counts.points} points land status 'draft', verified_at NULL —
-- INTENTIONALLY awaiting the Phase 3 official-verification lifecycle pass
-- (the 004/005, 006/007 and 008/009 convention; that pass is seed 011).
-- ============================================================================

BEGIN;
`);

  lines.push(`-- ── Topics (${meta.counts.topics} lettered sub-topics, unit_id NULL) ───────────────────────────\n`);
  for (const t of topics) {
    const slug = topicSlug(t.section, t.letter, t.name);
    lines.push(`-- ${t.section}(${t.letter}) — ${t.name}
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '${q(slug)}', '${t.section}(${t.letter})', '${q(t.name)}', 'coming_soon', ${t.order}
FROM courses c WHERE c.slug = '${COURSE_SLUG}'
ON CONFLICT (course_id, slug) DO NOTHING;
`);
  }

  lines.push(`-- ── Spec points (upsert by (topic_id, code)) ────────────────────────────────\n`);
  const topicByOrder = new Map(topics.map((t) => [t.order, t]));
  for (const p of points) {
    const t = topicByOrder.get(p.topicOrder);
    if (!t) throw new Error(`point ${p.code}: no topic with order ${p.topicOrder}`);
    const slug = topicSlug(t.section, t.letter, t.name);
    const marks = [
      p.pOnly ? "P: Physics-only, Paper 2 only" : null,
      p.practical ? "practical" : null,
    ].filter(Boolean);
    lines.push(`-- ${p.code} — official ${meta.issue} §${t.section}(${t.letter})${marks.length ? ` (${marks.join("; ")})` : ""}
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
--  half-applies.)
DO $$
DECLARE
  topic_count integer;
  point_count integer;
  p_count integer;
BEGIN
  SELECT count(*) INTO topic_count FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND t.unit_id IS NULL;
  SELECT count(*) INTO point_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}';
  SELECT count(*) INTO p_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND p.code LIKE '%P';
  IF topic_count <> ${meta.counts.topics} THEN
    RAISE EXCEPTION '010 aborted: % unit-less topics, expected ${meta.counts.topics}', topic_count;
  END IF;
  IF point_count <> ${meta.counts.points} THEN
    RAISE EXCEPTION '010 aborted: % spec points, expected ${meta.counts.points}', point_count;
  END IF;
  IF p_count <> ${meta.counts.pOnly} THEN
    RAISE EXCEPTION '010 aborted: % P-suffix points, expected ${meta.counts.pOnly}', p_count;
  END IF;
END $$;

COMMIT;
-- END OF 010 — ${meta.counts.topics} topics, ${meta.counts.points} points. If this line is missing, the paste was truncated.
`);

  const out = join(HERE, "../../supabase/seed/010_igcse_physics_specification.sql");
  writeFileSync(out, lines.join("\n"));
  console.log(`wrote ${out}: ${topics.length} topics, ${points.length} points`);
}

// Import-safe: the test suite imports topicSlug without regenerating the seed.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
