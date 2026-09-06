/**
 * 4BI1 seed generator — 4bi1-issue3.json → supabase/seed/008_igcse_biology_specification.sql
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/spec-extract/generate-4bi1-seed.ts
 *
 * ============================================================================
 * ⚠ DETERMINISTIC, OR IT IS NOT A SEED
 * ============================================================================
 * The SQL is a pure function of the committed extraction (4bi1-issue3.json).
 * Re-running this script must produce a byte-identical file; anything that
 * varies run-to-run (timestamps, random ids, map iteration order) is a bug.
 * The generated file follows 004/005/006's conventions exactly:
 *   - topics:      INSERT … ON CONFLICT (course_id, slug) DO NOTHING
 *   - spec points: INSERT … ON CONFLICT (topic_id, code) DO UPDATE
 *   - everything scoped by courses.slug = 'edexcel-igcse-biology'
 *   - status 'draft', verified_at NULL until the official verification pass
 * with 006's DO block inside the transaction that counts what the seed just
 * wrote and RAISEs on any mismatch — so a truncated paste (the SQL-Editor
 * failure mode this project has already lived through) aborts instead of
 * half-applying.
 *
 * unit_id is NULL THROUGHOUT: 4BI1 has no unit layer (two papers assess the
 * same five content sections), and the generic unit-less grouping renders
 * such topics as the top level. No units rows are created.
 *
 * Context headings (Biology's structural addition — 'Flowering plants',
 * 'Humans', …) are provenance, not rows: each point's heading is emitted as
 * a SQL comment above its INSERT and nowhere else. The official wording in
 * `description` is exactly the statement, never the heading.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const COURSE_SLUG = "edexcel-igcse-biology";

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
      bOnly: number;
      practical: number;
      contexts: number;
      bySection: Record<string, number>;
    };
  };
  sections: { number: number; name: string }[];
  topics: { section: number; sectionName: string; letter: string; name: string; order: number }[];
  points: {
    code: string;
    section: number;
    number: number;
    bOnly: boolean;
    practical: boolean;
    context: string | null;
    topicOrder: number;
    order: number;
    text: string;
  }[];
};

/** "2(d) Movement of substances into and out of cells" →
 *  "2d-movement-of-substances-into-and-out-of-cells".
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
 * apply attempt on 2026-09-04. The 004/006 convention ("Titles are trims of
 * the same extracted text") is followed deterministically: the title is the
 * statement's own first line (its stem, before any bullets), whole when it
 * fits the observed length band, else cut at the last word boundary with an
 * honest ellipsis. Every word is Pearson's, in Pearson's order — a trim,
 * never a paraphrase.
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
    readFileSync(join(HERE, "4bi1-issue3.json"), "utf8"),
  );
  const { meta, topics, points } = data;

  const bySection = Object.entries(meta.counts.bySection)
    .map(([s, n]) => `section ${s}: ${n}`)
    .join(", ");

  const lines: string[] = [];
  lines.push(`-- ============================================================================
-- AILEMY — PEARSON EDEXCEL INTERNATIONAL GCSE BIOLOGY (4BI1) SPECIFICATION
-- ${meta.counts.topics} sub-topics, ${meta.counts.points} specification points (${bySection})
--
-- ⚠ APPLIED 2026-09-05 by the owner via the Supabase SQL Editor (whole-file
--   paste — 137,323 bytes clipboard-verified byte-identical to this file,
--   sentinel confirmed as the last line, "Success. No rows returned").
--   Owner-run read-only baseline BEFORE the apply: 4BI1 at exactly
--   0 units / 0 topics / 0 points / 0 lessons / 0 lesson or question
--   mappings; the live course row is slug edexcel-igcse-biology,
--   uuid 35702dec-b1b9-487f-b74e-2b99500af285, status 'live', 44 past
--   papers. Owner-run read-only verification AFTER the apply returned
--   exactly:
--     · ${meta.counts.topics} topics, all unit_id NULL
--     · ${meta.counts.points} specification points, ${meta.counts.bOnly} B-suffix (Paper 2-only)
--     · all ${meta.counts.points} points status='draft', verified_at NULL —
--       INTENTIONALLY awaiting the Phase 3 official-verification lifecycle
--       pass (the 004/005 and 006/007 convention; that pass is seed 009)
--     · zero lesson mappings and zero question mappings on 4BI1
--     · IGCSE Chemistry unchanged: 28 topics, 182 live+verified, 52 C-suffix
--     · IAL AS Chemistry unchanged: 157 live+verified + 1 archived
--     · non-Biology specification population unchanged (340 points).
--   The in-repo live gate (scripts/db-checks/igcse-4bi1-spec-verify.ts)
--   could not run from this credential-less worktree (SKIPPED, exit 2) —
--   the owner-run SQL above is the post-apply record; the script gate runs
--   with --verified after 009.
--
-- PROVENANCE — nothing here is invented:
--   Every sub-topic, code and statement is extracted from the OFFICIAL
--   ${meta.document},
--   ${meta.issue}, ${meta.publisher} (first teaching ${meta.firstTeaching},
--   first examination ${meta.firstAssessment}), downloaded from
--   ${meta.source}
--   pdf sha256 ${meta.pdfSha256}
--   by scripts/spec-extract/extract_4bi1.py. The committed extraction
--   (scripts/spec-extract/4bi1-issue3.json) is the reviewable intermediate;
--   this file is generated from it by generate-4bi1-seed.ts and is not
--   hand-edited. Wording was cross-checked chunk-verbatim against an
--   independent pdftotext extraction of the same PDF (${meta.counts.points}/${meta.counts.points}).
--
-- STRUCTURE — the document's own, nothing imposed:
--   Five content sections (1 The nature and variety of living organisms,
--   2 Structure and functions in living organisms, 3 Reproduction and
--   inheritance, 4 Ecology and the environment, 5 Use of biological
--   resources) with lettered sub-topics. Sub-topics become topics rows with
--   unit_id NULL — 4BI1 HAS NO UNITS and none are fabricated (the generic
--   unit-less grouping renders them as the top level). The topic code "1(a)"
--   carries the section, so the section layer loses nothing. The document's
--   bold-italic CONTEXT HEADINGS inside sub-topic tables ('Flowering
--   plants', 'Humans', 'Crop plants', 'Micro-organisms', 'Fish farming' —
--   ${meta.counts.contexts} rows) are provenance, not points: each is kept as a comment above
--   the statements it scopes and never as a row or inside any wording.
--
-- PAPER 2-ONLY CONTENT — carried by the official codes themselves:
--   "specification statements that are in bold with a 'B' reference relate
--   to content that is only in the International GCSE in Biology and is not
--   found in the International GCSE in Science (Double Award)" (spec p.1);
--   Paper 1 "assesses core content that is not in bold and does not have a
--   'B' reference", Paper 2 "assesses all the content" (spec pp.7-8).
--   So the B SUFFIX in the code (${meta.counts.bOnly} of ${meta.counts.points} points) IS the official
--   Paper 2-only marker — no schema field is needed, and the extractor
--   asserted bold ⟺ B for every statement. Practical investigations
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
  let lastContextKey = "";
  for (const p of points) {
    const t = topicByOrder.get(p.topicOrder);
    if (!t) throw new Error(`point ${p.code}: no topic with order ${p.topicOrder}`);
    const slug = topicSlug(t.section, t.letter, t.name);
    const contextKey = `${p.topicOrder}|${p.context ?? ""}`;
    if (p.context !== null && contextKey !== lastContextKey) {
      lines.push(`-- context heading (document typography, not a row): ${p.context}`);
    }
    lastContextKey = contextKey;
    const marks = [
      p.bOnly ? "B: Biology-only, Paper 2 only" : null,
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
  b_count integer;
BEGIN
  SELECT count(*) INTO topic_count FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND t.unit_id IS NULL;
  SELECT count(*) INTO point_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}';
  SELECT count(*) INTO b_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = '${COURSE_SLUG}' AND p.code LIKE '%B';
  IF topic_count <> ${meta.counts.topics} THEN
    RAISE EXCEPTION '008 aborted: % unit-less topics, expected ${meta.counts.topics}', topic_count;
  END IF;
  IF point_count <> ${meta.counts.points} THEN
    RAISE EXCEPTION '008 aborted: % spec points, expected ${meta.counts.points}', point_count;
  END IF;
  IF b_count <> ${meta.counts.bOnly} THEN
    RAISE EXCEPTION '008 aborted: % B-suffix points, expected ${meta.counts.bOnly}', b_count;
  END IF;
END $$;

COMMIT;
-- END OF 008 — ${meta.counts.topics} topics, ${meta.counts.points} points. If this line is missing, the paste was truncated.
`);

  const out = join(HERE, "../../supabase/seed/008_igcse_biology_specification.sql");
  writeFileSync(out, lines.join("\n"));
  console.log(`wrote ${out}: ${topics.length} topics, ${points.length} points`);
}

// Import-safe: the test suite imports topicSlug without regenerating the seed.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
