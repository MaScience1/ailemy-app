/**
 * 4CH1 seed generator — 4ch1-issue3.json → supabase/seed/006_igcse_chemistry_specification.sql
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/spec-extract/generate-4ch1-seed.ts
 *
 * ============================================================================
 * ⚠ DETERMINISTIC, OR IT IS NOT A SEED
 * ============================================================================
 * The SQL is a pure function of the committed extraction (4ch1-issue3.json).
 * Re-running this script must produce a byte-identical file; anything that
 * varies run-to-run (timestamps, random ids, map iteration order) is a bug.
 * The generated file follows 004/005's conventions exactly:
 *   - topics:      INSERT … ON CONFLICT (course_id, slug) DO NOTHING
 *   - spec points: INSERT … ON CONFLICT (topic_id, code) DO UPDATE
 *   - everything scoped by courses.slug = 'edexcel-igcse-chemistry'
 *   - status 'draft', verified_at NULL until the official verification pass
 * and adds one thing 004 lacked: a DO block inside the transaction that
 * counts what the seed just wrote and RAISEs on any mismatch — so a
 * truncated paste (the SQL-Editor failure mode this project has already
 * lived through) aborts instead of half-applying.
 *
 * unit_id is NULL THROUGHOUT: 4CH1 has no unit layer (two papers assess the
 * same four content sections), and Phase 1's grouping renders unit-less
 * topics as the top level. No units rows are created.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const COURSE_SLUG = "edexcel-igcse-chemistry";

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
      cOnly: number;
      practical: number;
      bySection: Record<string, number>;
    };
  };
  sections: { number: number; name: string }[];
  topics: { section: number; sectionName: string; letter: string; name: string; order: number }[];
  points: {
    code: string;
    section: number;
    number: number;
    cOnly: boolean;
    practical: boolean;
    topicOrder: number;
    order: number;
    text: string;
  }[];
};

/** "2(a) Group 1 (alkali metals) – lithium…" → "2a-group-1-alkali-metals-lithium…".
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
 * spec_points.title is NOT NULL (0001) — the 2026-09-04 apply attempt failed
 * on exactly this and rolled back, because the generator sent NULL. The 004
 * convention ("Titles are trims of the same extracted text") is followed
 * deterministically: the title is the statement's own first line (its stem,
 * before any bullets), whole when it fits 004's observed length band, else
 * cut at the last word boundary with an honest ellipsis. Every word is
 * Pearson's, in Pearson's order — a trim, never a paraphrase.
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
    readFileSync(join(HERE, "4ch1-issue3.json"), "utf8"),
  );
  const { meta, topics, points } = data;

  const bySection = Object.entries(meta.counts.bySection)
    .map(([s, n]) => `section ${s}: ${n}`)
    .join(", ");

  const lines: string[] = [];
  lines.push(`-- ============================================================================
-- AILEMY — PEARSON EDEXCEL INTERNATIONAL GCSE CHEMISTRY (4CH1) SPECIFICATION
-- ${meta.counts.topics} sub-topics, ${meta.counts.points} specification points (${bySection})
--
-- ⚠ NOT YET APPLIED. Prepared 2026-09-04 for owner review. On application,
--   rewrite this header the same day with the date and verification result
--   (the 004 rule: the seed folder is the record of what is live).
--
-- PROVENANCE — nothing here is invented:
--   Every sub-topic, code and statement is extracted from the OFFICIAL
--   ${meta.document},
--   ${meta.issue}, ${meta.publisher} (first teaching ${meta.firstTeaching},
--   first examination ${meta.firstAssessment}), downloaded from
--   ${meta.source}
--   pdf sha256 ${meta.pdfSha256}
--   by scripts/spec-extract/extract_4ch1.py. The committed extraction
--   (scripts/spec-extract/4ch1-issue3.json) is the reviewable intermediate;
--   this file is generated from it by generate-4ch1-seed.ts and is not
--   hand-edited. Wording was cross-checked chunk-verbatim against an
--   independent pdftotext extraction of the same PDF (182/182).
--
-- STRUCTURE — the document's own, nothing imposed:
--   Four content sections (1 Principles of chemistry, 2 Inorganic chemistry,
--   3 Physical chemistry, 4 Organic chemistry) with lettered sub-topics.
--   Sub-topics become topics rows with unit_id NULL — 4CH1 HAS NO UNITS and
--   none are fabricated (Phase 1 grouping renders unit-less topics as the
--   top level). The topic code "1(a)" carries the section, so the section
--   layer loses nothing.
--
-- PAPER 2-ONLY CONTENT — carried by the official codes themselves:
--   "specification statements that are in bold with a 'C' reference relate
--   to content that is only in the International GCSE in Chemistry and is
--   not found in the International GCSE in Science (Double Award)" (spec
--   p.4); Paper 1 "assesses core content that is not in bold and does not
--   have a 'C' reference", Paper 2 "assesses all the content" (spec pp.7-9).
--   So the C SUFFIX in the code (${meta.counts.cOnly} of ${meta.counts.points} points) IS the official
--   Paper 2-only marker — no schema field is needed, and the extractor
--   asserted bold ⟺ C for every statement. Practical investigations
--   (points in italics, beginning "practical:" — ${meta.counts.practical} points) keep that
--   prefix in their official wording.
--
-- Idempotent: topics ON CONFLICT (course_id, slug) DO NOTHING;
--             spec points ON CONFLICT (topic_id, code) DO UPDATE.
-- Course-scoped: every statement resolves through courses.slug = '${COURSE_SLUG}'.
-- Self-verifying: the DO block before COMMIT recounts and RAISEs on drift,
-- so a truncated paste aborts the whole transaction instead of half-applying.
-- No DELETEs, no cross-course writes, no units rows, no schema changes.
-- ============================================================================

BEGIN;
`);

  lines.push(`-- ── Topics (28 lettered sub-topics, unit_id NULL) ───────────────────────────\n`);
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
      p.cOnly ? "C: Chemistry-only, Paper 2 only" : null,
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
  c_count integer;
BEGIN
  SELECT count(*) INTO topic_count FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND t.unit_id IS NULL;
  SELECT count(*) INTO point_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}';
  SELECT count(*) INTO c_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND p.code LIKE '%C';
  IF topic_count <> ${meta.counts.topics} THEN
    RAISE EXCEPTION '006 aborted: % unit-less topics, expected ${meta.counts.topics}', topic_count;
  END IF;
  IF point_count <> ${meta.counts.points} THEN
    RAISE EXCEPTION '006 aborted: % spec points, expected ${meta.counts.points}', point_count;
  END IF;
  IF c_count <> ${meta.counts.cOnly} THEN
    RAISE EXCEPTION '006 aborted: % C-suffix points, expected ${meta.counts.cOnly}', c_count;
  END IF;
END $$;

COMMIT;
-- END OF 006 — ${meta.counts.topics} topics, ${meta.counts.points} points. If this line is missing, the paste was truncated.
`);

  const out = join(HERE, "../../supabase/seed/006_igcse_chemistry_specification.sql");
  writeFileSync(out, lines.join("\n"));
  console.log(`wrote ${out}: ${topics.length} topics, ${points.length} points`);
}

// Import-safe: the test suite imports topicSlug without regenerating the seed.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
