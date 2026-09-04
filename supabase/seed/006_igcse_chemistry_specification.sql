-- ============================================================================
-- AILEMY — PEARSON EDEXCEL INTERNATIONAL GCSE CHEMISTRY (4CH1) SPECIFICATION
-- 28 sub-topics, 182 specification points (section 1: 60, section 2: 50, section 3: 22, section 4: 50)
--
-- ⚠ NOT YET APPLIED. Prepared 2026-09-04 for owner review. On application,
--   rewrite this header the same day with the date and verification result
--   (the 004 rule: the seed folder is the record of what is live).
--
-- PROVENANCE — nothing here is invented:
--   Every sub-topic, code and statement is extracted from the OFFICIAL
--   Pearson Edexcel International GCSE in Chemistry (4CH1) — Specification,
--   Issue 3, © Pearson Education Limited 2024 (first teaching September 2017,
--   first examination June 2019), downloaded from
--   https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Chemistry/2017/specification-and-sample-assessments/international-gcse-chemistry-2017-specification.pdf
--   pdf sha256 36e2080d2e99f060bcc18f2a9d0bbd8b29498b45e007fa232e3befcd89b73362
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
--   So the C SUFFIX in the code (52 of 182 points) IS the official
--   Paper 2-only marker — no schema field is needed, and the extractor
--   asserted bold ⟺ C for every statement. Practical investigations
--   (points in italics, beginning "practical:" — 12 points) keep that
--   prefix in their official wording.
--
-- Idempotent: topics ON CONFLICT (course_id, slug) DO NOTHING;
--             spec points ON CONFLICT (topic_id, code) DO UPDATE.
-- Course-scoped: every statement resolves through courses.slug = 'edexcel-igcse-chemistry'.
-- Self-verifying: the DO block before COMMIT recounts and RAISEs on drift,
-- so a truncated paste aborts the whole transaction instead of half-applying.
-- No DELETEs, no cross-course writes, no units rows, no schema changes.
-- ============================================================================

BEGIN;

-- ── Topics (28 lettered sub-topics, unit_id NULL) ───────────────────────────

-- 1(a) — States of matter
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1a-states-of-matter', '1(a)', 'States of matter', 'coming_soon', 1
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(b) — Elements, compounds and mixtures
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1b-elements-compounds-and-mixtures', '1(b)', 'Elements, compounds and mixtures', 'coming_soon', 2
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(c) — Atomic structure
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1c-atomic-structure', '1(c)', 'Atomic structure', 'coming_soon', 3
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(d) — The Periodic Table
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1d-the-periodic-table', '1(d)', 'The Periodic Table', 'coming_soon', 4
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(e) — Chemical formulae, equations and calculations
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1e-chemical-formulae-equations-and-calculations', '1(e)', 'Chemical formulae, equations and calculations', 'coming_soon', 5
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(f) — Ionic bonding
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1f-ionic-bonding', '1(f)', 'Ionic bonding', 'coming_soon', 6
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(g) — Covalent bonding
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1g-covalent-bonding', '1(g)', 'Covalent bonding', 'coming_soon', 7
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(h) — Metallic bonding
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1h-metallic-bonding', '1(h)', 'Metallic bonding', 'coming_soon', 8
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(i) — Electrolysis
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1i-electrolysis', '1(i)', 'Electrolysis', 'coming_soon', 9
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(a) — Group 1 (alkali metals) – lithium, sodium and potassium
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2a-group-1-alkali-metals-lithium-sodium-and-potassium', '2(a)', 'Group 1 (alkali metals) – lithium, sodium and potassium', 'coming_soon', 10
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(b) — Group 7 (halogens) – chlorine, bromine and iodine
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2b-group-7-halogens-chlorine-bromine-and-iodine', '2(b)', 'Group 7 (halogens) – chlorine, bromine and iodine', 'coming_soon', 11
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(c) — Gases in the atmosphere
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2c-gases-in-the-atmosphere', '2(c)', 'Gases in the atmosphere', 'coming_soon', 12
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(d) — Reactivity series
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2d-reactivity-series', '2(d)', 'Reactivity series', 'coming_soon', 13
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(e) — Extraction and uses of metals
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2e-extraction-and-uses-of-metals', '2(e)', 'Extraction and uses of metals', 'coming_soon', 14
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(f) — Acids, alkalis and titrations
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2f-acids-alkalis-and-titrations', '2(f)', 'Acids, alkalis and titrations', 'coming_soon', 15
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(g) — Acids, bases and salt preparations
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2g-acids-bases-and-salt-preparations', '2(g)', 'Acids, bases and salt preparations', 'coming_soon', 16
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(h) — Chemical tests
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2h-chemical-tests', '2(h)', 'Chemical tests', 'coming_soon', 17
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 3(a) — Energetics
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '3a-energetics', '3(a)', 'Energetics', 'coming_soon', 18
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 3(b) — Rates of reaction
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '3b-rates-of-reaction', '3(b)', 'Rates of reaction', 'coming_soon', 19
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 3(c) — Reversible reactions and equilibria
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '3c-reversible-reactions-and-equilibria', '3(c)', 'Reversible reactions and equilibria', 'coming_soon', 20
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(a) — Introduction
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4a-introduction', '4(a)', 'Introduction', 'coming_soon', 21
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(b) — Crude oil
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4b-crude-oil', '4(b)', 'Crude oil', 'coming_soon', 22
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(c) — Alkanes
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4c-alkanes', '4(c)', 'Alkanes', 'coming_soon', 23
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(d) — Alkenes
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4d-alkenes', '4(d)', 'Alkenes', 'coming_soon', 24
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(e) — Alcohols
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4e-alcohols', '4(e)', 'Alcohols', 'coming_soon', 25
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(f) — Carboxylic acids
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4f-carboxylic-acids', '4(f)', 'Carboxylic acids', 'coming_soon', 26
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(g) — Esters
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4g-esters', '4(g)', 'Esters', 'coming_soon', 27
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(h) — Synthetic polymers
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4h-synthetic-polymers', '4(h)', 'Synthetic polymers', 'coming_soon', 28
FROM courses c WHERE c.slug = 'edexcel-igcse-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- ── Spec points (upsert by (topic_id, code)) ────────────────────────────────

-- 1.1 — official Issue 3 §1(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.1', NULL, 'understand the three states of matter in terms of the arrangement, movement and energy of the particles', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1a-states-of-matter'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.2 — official Issue 3 §1(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.2', NULL, 'understand the interconversions between the three states of matter in terms of:
• the names of the interconversions
• how they are achieved
• the changes in arrangement, movement and energy of the particles.', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1a-states-of-matter'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.3 — official Issue 3 §1(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.3', NULL, 'understand how the results of experiments involving the dilution of coloured solutions and diffusion of gases can be explained', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1a-states-of-matter'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.4 — official Issue 3 §1(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.4', NULL, 'know what is meant by the terms:
• solvent
• solute
• solution
• saturated solution.', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1a-states-of-matter'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.5C — official Issue 3 §1(a) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.5C', NULL, 'know what is meant by the term solubility in the units g per 100 g of solvent', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1a-states-of-matter'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.6C — official Issue 3 §1(a) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.6C', NULL, 'understand how to plot and interpret solubility curves', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1a-states-of-matter'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.7C — official Issue 3 §1(a) (C: Chemistry-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.7C', NULL, 'practical: investigate the solubility of a solid in water at a specific temperature', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1a-states-of-matter'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.8 — official Issue 3 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.8', NULL, 'understand how to classify a substance as an element, compound or mixture', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1b-elements-compounds-and-mixtures'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.9 — official Issue 3 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.9', NULL, 'understand that a pure substance has a fixed melting and boiling point, but that a mixture may melt or boil over a range of temperatures', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1b-elements-compounds-and-mixtures'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.10 — official Issue 3 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.10', NULL, 'describe these experimental techniques for the separation of mixtures:
• simple distillation
• fractional distillation
• filtration
• crystallisation
• paper chromatography.', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1b-elements-compounds-and-mixtures'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.11 — official Issue 3 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.11', NULL, 'understand how a chromatogram provides information about the composition of a mixture', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1b-elements-compounds-and-mixtures'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.12 — official Issue 3 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.12', NULL, 'understand how to use the calculation of Rf values to identify the components of a mixture', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1b-elements-compounds-and-mixtures'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.13 — official Issue 3 §1(b) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.13', NULL, 'practical: investigate paper chromatography using inks/food colourings', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1b-elements-compounds-and-mixtures'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.14 — official Issue 3 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.14', NULL, 'know what is meant by the terms atom and molecule', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1c-atomic-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.15 — official Issue 3 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.15', NULL, 'know the structure of an atom in terms of the positions, relative masses and relative charges of sub-atomic particles', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1c-atomic-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.16 — official Issue 3 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.16', NULL, 'know what is meant by the terms atomic number, mass number, isotopes and relative atomic mass (Ar)', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1c-atomic-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.17 — official Issue 3 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.17', NULL, 'be able to calculate the relative atomic mass of an element (Ar) from isotopic abundances', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1c-atomic-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.18 — official Issue 3 §1(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.18', NULL, 'understand how elements are arranged in the Periodic Table:
• in order of atomic number
• in groups and periods.', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1d-the-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.19 — official Issue 3 §1(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.19', NULL, 'understand how to deduce the electronic configurations of the first 20 elements from their positions in the Periodic Table', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1d-the-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.20 — official Issue 3 §1(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.20', NULL, 'understand how to use electrical conductivity and the acid-base character of oxides to classify elements as metals or non-metals', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1d-the-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.21 — official Issue 3 §1(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.21', NULL, 'identify an element as a metal or a non-metal according to its position in the Periodic Table', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1d-the-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.22 — official Issue 3 §1(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.22', NULL, 'understand how the electronic configuration of a main group element is related to its position in the Periodic Table', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1d-the-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.23 — official Issue 3 §1(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.23', NULL, 'understand why elements in the same group of the Periodic Table have similar chemical properties', NULL, 'draft', 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1d-the-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.24 — official Issue 3 §1(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.24', NULL, 'understand why the noble gases (Group 0) do not readily react', NULL, 'draft', 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1d-the-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.25 — official Issue 3 §1(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.25', NULL, 'write word equations and balanced chemical equations (including state symbols):
• for reactions studied in this specification
• for unfamiliar reactions where suitable information is provided.', NULL, 'draft', 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.26 — official Issue 3 §1(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.26', NULL, 'calculate relative formula masses (including relative molecular masses) (Mr) from relative atomic masses (Ar)', NULL, 'draft', 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.27 — official Issue 3 §1(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.27', NULL, 'know that the mole (mol) is the unit for the amount of a substance', NULL, 'draft', 27
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.28 — official Issue 3 §1(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.28', NULL, 'understand how to carry out calculations involving amount of substance, relative atomic mass (Ar) and relative formula mass (Mr)', NULL, 'draft', 28
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.29 — official Issue 3 §1(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.29', NULL, 'calculate reacting masses using experimental data and chemical equations', NULL, 'draft', 29
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.30 — official Issue 3 §1(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.30', NULL, 'calculate percentage yield', NULL, 'draft', 30
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.31 — official Issue 3 §1(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.31', NULL, 'understand how the formulae of simple compounds can be obtained experimentally, including metal oxides, water and salts containing water of crystallisation', NULL, 'draft', 31
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.32 — official Issue 3 §1(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.32', NULL, 'know what is meant by the terms empirical formula and molecular formula', NULL, 'draft', 32
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.33 — official Issue 3 §1(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.33', NULL, 'calculate empirical and molecular formulae from experimental data', NULL, 'draft', 33
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.34C — official Issue 3 §1(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.34C', NULL, 'understand how to carry out calculations involving amount of substance, volume and concentration (in mol/dm³) of solution', NULL, 'draft', 34
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.35C — official Issue 3 §1(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.35C', NULL, 'understand how to carry out calculations involving gas volumes and the molar volume of a gas (24 dm³ and 24 000 cm³ at room temperature and pressure (rtp))', NULL, 'draft', 35
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.36 — official Issue 3 §1(e) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.36', NULL, 'practical: know how to determine the formula of a metal oxide by combustion (e.g. magnesium oxide) or by reduction (e.g. copper(II) oxide)', NULL, 'draft', 36
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1e-chemical-formulae-equations-and-calculations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.37 — official Issue 3 §1(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.37', NULL, 'understand how ions are formed by electron loss or gain', NULL, 'draft', 37
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1f-ionic-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.38 — official Issue 3 §1(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.38', NULL, 'know the charges of these ions:
• metals in Groups 1, 2 and 3
• non-metals in Groups 5, 6 and 7
• Ag⁺, Cu²⁺, Fe²⁺, Fe³⁺, Pb²⁺, Zn²⁺
• hydrogen (H⁺), hydroxide (OH⁻), ammonium (NH₄⁺), carbonate (CO₃²⁻), nitrate (NO₃⁻), sulfate (SO₄²⁻).', NULL, 'draft', 38
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1f-ionic-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.39 — official Issue 3 §1(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.39', NULL, 'write formulae for compounds formed between the ions listed above', NULL, 'draft', 39
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1f-ionic-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.40 — official Issue 3 §1(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.40', NULL, 'draw dot-and-cross diagrams to show the formation of ionic compounds by electron transfer, limited to combinations of elements from Groups 1, 2, 3 and 5, 6, 7 only outer electrons need be shown', NULL, 'draft', 40
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1f-ionic-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.41 — official Issue 3 §1(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.41', NULL, 'understand ionic bonding in terms of electrostatic attractions', NULL, 'draft', 41
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1f-ionic-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.42 — official Issue 3 §1(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.42', NULL, 'understand why compounds with giant ionic lattices have high melting and boiling points', NULL, 'draft', 42
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1f-ionic-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.43 — official Issue 3 §1(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.43', NULL, 'know that ionic compounds do not conduct electricity when solid, but do conduct electricity when molten and in aqueous solution', NULL, 'draft', 43
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1f-ionic-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.44 — official Issue 3 §1(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.44', NULL, 'know that a covalent bond is formed between atoms by the sharing of a pair of electrons', NULL, 'draft', 44
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1g-covalent-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.45 — official Issue 3 §1(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.45', NULL, 'understand covalent bonds in terms of electrostatic attractions', NULL, 'draft', 45
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1g-covalent-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.46 — official Issue 3 §1(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.46', NULL, 'understand how to use dot-and-cross diagrams to represent covalent bonds in:
• diatomic molecules, including hydrogen, oxygen, nitrogen, halogens and hydrogen halides
• inorganic molecules including water, ammonia and carbon dioxide
• organic molecules containing up to two carbon atoms, including methane, ethane, ethene and those containing halogen atoms.', NULL, 'draft', 46
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1g-covalent-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.47 — official Issue 3 §1(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.47', NULL, 'explain why substances with a simple molecular structures are gases or liquids, or solids with low melting and boiling points the term intermolecular forces of attraction can be used to represent all forces between molecules', NULL, 'draft', 47
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1g-covalent-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.48 — official Issue 3 §1(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.48', NULL, 'explain why the melting and boiling points of substances with simple molecular structures increase, in general, with increasing relative molecular mass', NULL, 'draft', 48
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1g-covalent-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.49 — official Issue 3 §1(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.49', NULL, 'explain why substances with giant covalent structures are solids with high melting and boiling points', NULL, 'draft', 49
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1g-covalent-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.50 — official Issue 3 §1(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.50', NULL, 'explain how the structures of diamond, graphite and C₆₀ fullerene influence their physical properties, including electrical conductivity and hardness', NULL, 'draft', 50
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1g-covalent-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.51 — official Issue 3 §1(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.51', NULL, 'know that covalent compounds do not usually conduct electricity', NULL, 'draft', 51
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1g-covalent-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.52C — official Issue 3 §1(h) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.52C', NULL, 'know how to represent a metallic lattice by a 2-D diagram', NULL, 'draft', 52
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1h-metallic-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.53C — official Issue 3 §1(h) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.53C', NULL, 'understand metallic bonding in terms of electrostatic attractions', NULL, 'draft', 53
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1h-metallic-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.54C — official Issue 3 §1(h) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.54C', NULL, 'explain typical physical properties of metals, including electrical conductivity and malleability', NULL, 'draft', 54
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1h-metallic-bonding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.55C — official Issue 3 §1(i) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.55C', NULL, 'understand why covalent compounds do not conduct electricity', NULL, 'draft', 55
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1i-electrolysis'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.56C — official Issue 3 §1(i) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.56C', NULL, 'understand why ionic compounds conduct electricity only when molten or in aqueous solution', NULL, 'draft', 56
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1i-electrolysis'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.57C — official Issue 3 §1(i) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.57C', NULL, 'know that anion and cation are terms used to refer to negative and positive ions respectively', NULL, 'draft', 57
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1i-electrolysis'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.58C — official Issue 3 §1(i) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.58C', NULL, 'describe experiments to investigate electrolysis, using inert electrodes, of molten compounds (including lead(II) bromide) and aqueous solutions (including sodium chloride, dilute sulfuric acid and copper(II) sulfate) and to predict the products', NULL, 'draft', 58
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1i-electrolysis'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.59C — official Issue 3 §1(i) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.59C', NULL, 'write ionic half-equations representing the reactions at the electrodes during electrolysis and understand why these reactions are classified as oxidation or reduction', NULL, 'draft', 59
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1i-electrolysis'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.60C — official Issue 3 §1(i) (C: Chemistry-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.60C', NULL, 'practical: investigate the electrolysis of aqueous solutions', NULL, 'draft', 60
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '1i-electrolysis'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.1 — official Issue 3 §2(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.1', NULL, 'understand how the similarities in the reactions of these elements with water provide evidence for their recognition as a family of elements', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2a-group-1-alkali-metals-lithium-sodium-and-potassium'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.2 — official Issue 3 §2(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.2', NULL, 'understand how the differences between the reactions of these elements with air and water provide evidence for the trend in reactivity in Group 1', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2a-group-1-alkali-metals-lithium-sodium-and-potassium'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.3 — official Issue 3 §2(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.3', NULL, 'use knowledge of trends in Group 1 to predict the properties of other alkali metals', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2a-group-1-alkali-metals-lithium-sodium-and-potassium'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.4C — official Issue 3 §2(a) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.4C', NULL, 'explain the trend in reactivity in Group 1 in terms of electronic configurations', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2a-group-1-alkali-metals-lithium-sodium-and-potassium'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.5 — official Issue 3 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.5', NULL, 'know the colours, physical states (at room temperature) and trends in physical properties of these elements', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2b-group-7-halogens-chlorine-bromine-and-iodine'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.6 — official Issue 3 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.6', NULL, 'use knowledge of trends in Group 7 to predict the properties of other halogens', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2b-group-7-halogens-chlorine-bromine-and-iodine'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.7 — official Issue 3 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.7', NULL, 'understand how displacement reactions involving halogens and halides provide evidence for the trend in reactivity in Group 7', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2b-group-7-halogens-chlorine-bromine-and-iodine'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.8C — official Issue 3 §2(b) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.8C', NULL, 'explain the trend in reactivity in Group 7 in terms of electronic configurations', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2b-group-7-halogens-chlorine-bromine-and-iodine'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.9 — official Issue 3 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.9', NULL, 'know the approximate percentages by volume of the four most abundant gases in dry air', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2c-gases-in-the-atmosphere'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.10 — official Issue 3 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.10', NULL, 'understand how to determine the percentage by volume of oxygen in air using experiments involving the reactions of metals (e.g. iron) and non-metals (e.g. phosphorus) with air', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2c-gases-in-the-atmosphere'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.11 — official Issue 3 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.11', NULL, 'describe the combustion of elements in oxygen, including magnesium, hydrogen and sulfur', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2c-gases-in-the-atmosphere'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.12 — official Issue 3 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.12', NULL, 'describe the formation of carbon dioxide from the thermal decomposition of metal carbonates, including copper(II) carbonate', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2c-gases-in-the-atmosphere'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.13 — official Issue 3 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.13', NULL, 'know that carbon dioxide is a greenhouse gas and that increasing amounts in the atmosphere may contribute to climate change', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2c-gases-in-the-atmosphere'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.14 — official Issue 3 §2(c) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.14', NULL, 'practical: determine the approximate percentage by volume of oxygen in air using a metal or a non-metal', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2c-gases-in-the-atmosphere'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.15 — official Issue 3 §2(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.15', NULL, 'understand how metals can be arranged in a reactivity series based on their reactions with:
• water
• dilute hydrochloric or sulfuric acid.', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2d-reactivity-series'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.16 — official Issue 3 §2(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.16', NULL, 'understand how metals can be arranged in a reactivity series based on their displacement reactions between:
• metals and metal oxides
• metals and aqueous solutions of metal salts.', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2d-reactivity-series'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.17 — official Issue 3 §2(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.17', NULL, 'know the order of reactivity of these metals: potassium, sodium, lithium, calcium, magnesium, aluminium, zinc, iron, copper, silver, gold', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2d-reactivity-series'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.18 — official Issue 3 §2(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.18', NULL, 'know the conditions under which iron rusts', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2d-reactivity-series'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.19 — official Issue 3 §2(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.19', NULL, 'understand how the rusting of iron may be prevented by:
• barrier methods
• galvanising
• sacrificial protection.', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2d-reactivity-series'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.20 — official Issue 3 §2(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.20', NULL, 'understand the terms:
• oxidation
• reduction
• redox
• oxidising agent
• reducing agent in terms of gain or loss of oxygen and loss or gain of electrons.', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2d-reactivity-series'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.21 — official Issue 3 §2(d) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.21', NULL, 'practical: investigate reactions between dilute hydrochloric and sulfuric acids and metals (e.g. magnesium, zinc and iron)', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2d-reactivity-series'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.22C — official Issue 3 §2(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.22C', NULL, 'know that most metals are extracted from ores found in the Earth’s crust and that unreactive metals are often found as the uncombined element', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2e-extraction-and-uses-of-metals'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.23C — official Issue 3 §2(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.23C', NULL, 'explain how the method of extraction of a metal is related to its position in the reactivity series, illustrated by carbon extraction for iron and electrolysis for aluminium', NULL, 'draft', 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2e-extraction-and-uses-of-metals'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.24C — official Issue 3 §2(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.24C', NULL, 'be able to comment on a metal extraction process, given appropriate information detailed knowledge of the processes used in the extraction of a specific metal is not required', NULL, 'draft', 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2e-extraction-and-uses-of-metals'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.25C — official Issue 3 §2(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.25C', NULL, 'explain the uses of aluminium, copper, iron and steel in terms of their properties the types of steel will be limited to low-carbon (mild), high-carbon and stainless', NULL, 'draft', 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2e-extraction-and-uses-of-metals'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.26C — official Issue 3 §2(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.26C', NULL, 'know that an alloy is a mixture of a metal and one or more elements, usually other metals or carbon', NULL, 'draft', 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2e-extraction-and-uses-of-metals'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.27C — official Issue 3 §2(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.27C', NULL, 'explain why alloys are harder than pure metals', NULL, 'draft', 27
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2e-extraction-and-uses-of-metals'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.28 — official Issue 3 §2(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.28', NULL, 'describe the use of litmus, phenolphthalein and methyl orange to distinguish between acidic and alkaline solutions', NULL, 'draft', 28
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2f-acids-alkalis-and-titrations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.29 — official Issue 3 §2(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.29', NULL, 'understand how to use the pH scale, from 0–14, can be used to classify solutions as strongly acidic (0–3), weakly acidic (4–6), neutral (7), weakly alkaline (8–10) and strongly alkaline (11–14)', NULL, 'draft', 29
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2f-acids-alkalis-and-titrations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.30 — official Issue 3 §2(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.30', NULL, 'describe the use of universal indicator to measure the approximate pH value of an aqueous solution', NULL, 'draft', 30
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2f-acids-alkalis-and-titrations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.31 — official Issue 3 §2(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.31', NULL, 'know that acids in aqueous solution are a source of hydrogen ions and alkalis in a aqueous solution are a source of hydroxide ions', NULL, 'draft', 31
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2f-acids-alkalis-and-titrations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.32 — official Issue 3 §2(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.32', NULL, 'know that alkalis can neutralise acids', NULL, 'draft', 32
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2f-acids-alkalis-and-titrations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.33C — official Issue 3 §2(f) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.33C', NULL, 'describe how to carry out an acid-alkali titration', NULL, 'draft', 33
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2f-acids-alkalis-and-titrations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.34 — official Issue 3 §2(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.34', NULL, 'know the general rules for predicting the solubility of ionic compounds in water:
• common sodium, potassium and ammonium compounds are soluble
• all nitrates are soluble
• common chlorides are soluble, except those of silver and lead(II)
• common sulfates are soluble, except for those of barium, calcium and lead(II)
• common carbonates are insoluble, except for those of sodium, potassium and ammonium
• common hydroxides are insoluble except for those of sodium, potassium and calcium (calcium hydroxide is slightly soluble).', NULL, 'draft', 34
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2g-acids-bases-and-salt-preparations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.35 — official Issue 3 §2(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.35', NULL, 'understand acids and bases in terms of proton transfer', NULL, 'draft', 35
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2g-acids-bases-and-salt-preparations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.36 — official Issue 3 §2(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.36', NULL, 'understand that an acid is a proton donor and a base is a proton acceptor', NULL, 'draft', 36
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2g-acids-bases-and-salt-preparations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.37 — official Issue 3 §2(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.37', NULL, 'describe the reactions of hydrochloric acid, sulfuric acid and nitric acid with metals, bases and metal carbonates (excluding the reactions between nitric acid and metals) to form salts', NULL, 'draft', 37
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2g-acids-bases-and-salt-preparations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.38 — official Issue 3 §2(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.38', NULL, 'know that metal oxides, metal hydroxides and ammonia can act as bases, and that alkalis are bases that are soluble in water', NULL, 'draft', 38
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2g-acids-bases-and-salt-preparations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.39 — official Issue 3 §2(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.39', NULL, 'describe an experiment to prepare a pure, dry sample of a soluble salt, starting from an insoluble reactant', NULL, 'draft', 39
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2g-acids-bases-and-salt-preparations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.40C — official Issue 3 §2(g) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.40C', NULL, 'describe an experiment to prepare a pure, dry sample of a soluble salt, starting from an acid and alkali', NULL, 'draft', 40
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2g-acids-bases-and-salt-preparations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.41C — official Issue 3 §2(g) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.41C', NULL, 'describe an experiment to prepare a pure, dry sample of an insoluble salt, starting from two soluble reactants', NULL, 'draft', 41
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2g-acids-bases-and-salt-preparations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.42 — official Issue 3 §2(g) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.42', NULL, 'practical: prepare a sample of pure, dry hydrated copper(II) sulfate crystals starting from copper(II) oxide', NULL, 'draft', 42
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2g-acids-bases-and-salt-preparations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.43C — official Issue 3 §2(g) (C: Chemistry-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.43C', NULL, 'practical: prepare a sample of pure, dry lead(II) sulfate', NULL, 'draft', 43
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2g-acids-bases-and-salt-preparations'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.44 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.44', NULL, 'describe tests for these gases:
• hydrogen
• oxygen
• carbon dioxide
• ammonia
• chlorine.', NULL, 'draft', 44
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2h-chemical-tests'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.45 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.45', NULL, 'describe how to carry out a flame test', NULL, 'draft', 45
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2h-chemical-tests'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.46 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.46', NULL, 'know the colours formed in flame tests for these cations:
• Li⁺ is red
• Na⁺ is yellow
• K⁺ is lilac
• Ca²⁺ is orange-red
• Cu²⁺ is blue-green.', NULL, 'draft', 46
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2h-chemical-tests'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.47 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.47', NULL, 'describe tests for these cations:
• NH₄⁺ using sodium hydroxide solution and identifying the gas evolved
• Cu²⁺, Fe²⁺ and Fe³⁺ using sodium hydroxide solution.', NULL, 'draft', 47
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2h-chemical-tests'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.48 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.48', NULL, 'describe tests for these anions:
• Cl⁻, Br⁻ and I⁻ using acidified silver nitrate solution
• SO₄²⁻ using acidified barium chloride solution
• CO₃²⁻ using hydrochloric acid and identifying the gas evolved.', NULL, 'draft', 48
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2h-chemical-tests'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.49 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.49', NULL, 'describe a test for the presence of water using anhydrous copper(II) sulfate', NULL, 'draft', 49
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2h-chemical-tests'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.50 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.50', NULL, 'describe a physical test to show whether a sample of water is pure', NULL, 'draft', 50
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '2h-chemical-tests'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.1 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.1', NULL, 'know that chemical reactions in which heat energy is given out are described as exothermic, and those in which heat energy is taken in are described as endothermic', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3a-energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.2 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.2', NULL, 'describe simple calorimetry experiments for reactions such as combustion, displacement, dissolving and neutralisation', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3a-energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.3 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.3', NULL, 'calculate the heat energy change from a measured temperature change using the expression Q = mcΔT', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3a-energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.4 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.4', NULL, 'calculate the molar enthalpy change (ΔH) from the heat energy change, Q', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3a-energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.5C — official Issue 3 §3(a) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.5C', NULL, 'draw and explain energy level diagrams to represent exothermic and endothermic reactions', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3a-energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.6C — official Issue 3 §3(a) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.6C', NULL, 'know that bond-breaking is an endothermic process and that bond-making is an exothermic process', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3a-energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.7C — official Issue 3 §3(a) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.7C', NULL, 'use bond energies to calculate the enthalpy change during a chemical reaction', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3a-energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.8 — official Issue 3 §3(a) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.8', NULL, 'practical: investigate temperature changes accompanying some of the following types of change:
• salts dissolving in water
• neutralisation reactions
• displacement reactions
• combustion reactions.', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3a-energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.9 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.9', NULL, 'describe experiments to investigate the effects of changes in surface area of a solid, concentration of a solution, temperature and the use of a catalyst on the rate of a reaction', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3b-rates-of-reaction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.10 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.10', NULL, 'describe the effects of changes in surface area of a solid, concentration of a solution, pressure of a gas, temperature and the use of a catalyst on the rate of a reaction', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3b-rates-of-reaction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.11 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.11', NULL, 'explain the effects of changes in surface area of a solid, concentration of a solution, pressure of a gas and temperature on the rate of a reaction in terms of particle collision theory', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3b-rates-of-reaction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.12 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.12', NULL, 'know that a catalyst is a substance that increases the rate of a reaction, but is chemically unchanged at the end of the reaction', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3b-rates-of-reaction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.13 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.13', NULL, 'know that a catalyst works by providing an alternative pathway with lower activation energy', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3b-rates-of-reaction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.14C — official Issue 3 §3(b) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.14C', NULL, 'draw and explain reaction profile diagrams showing ΔH and activation energy', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3b-rates-of-reaction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.15 — official Issue 3 §3(b) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.15', NULL, 'practical: investigate the effect of changing the surface area of marble chips and of changing the concentration of hydrochloric acid on the rate of reaction between marble chips and dilute hydrochloric acid', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3b-rates-of-reaction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.16 — official Issue 3 §3(b) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.16', NULL, 'practical: investigate the effect of different solids on the catalytic decomposition of hydrogen peroxide solution', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3b-rates-of-reaction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.17 — official Issue 3 §3(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.17', NULL, 'know that some reactions are reversible and this is indicated by the symbol ⇌ in equations', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3c-reversible-reactions-and-equilibria'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.18 — official Issue 3 §3(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.18', NULL, 'describe reversible reactions such as the dehydration of hydrated copper(II) sulfate and the effect of heat on ammonium chloride', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3c-reversible-reactions-and-equilibria'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.19C — official Issue 3 §3(c) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.19C', NULL, 'know that a reversible reaction can reach dynamic equilibrium in a sealed container', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3c-reversible-reactions-and-equilibria'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.20C — official Issue 3 §3(c) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.20C', NULL, 'know that the characteristics of a reaction at dynamic equilibrium are:
• the forward and reverse reactions occur at the same rate
• the concentrations of reactants and products remain constant.', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3c-reversible-reactions-and-equilibria'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.21C — official Issue 3 §3(c) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.21C', NULL, 'understand why a catalyst does not affect the position of equilibrium in a reversible reaction', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3c-reversible-reactions-and-equilibria'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.22C — official Issue 3 §3(c) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.22C', NULL, 'know the effect of changing either temperature or pressure on the position of equilibrium in a reversible reaction:
• an increase (or decrease) in temperature shifts the position of equilibrium in the direction of the endothermic (or exothermic) reaction
• an increase (or decrease) in pressure shifts the position of equilibrium in the direction that produces fewer (or more) moles of gas References to Le Chatelier''s principle are not required', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '3c-reversible-reactions-and-equilibria'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.1 — official Issue 3 §4(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.1', NULL, 'know that a hydrocarbon is a compound of hydrogen and carbon only', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4a-introduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.2 — official Issue 3 §4(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.2', NULL, 'understand how to represent organic molecules using empirical formulae, molecular formulae, general formulae, structural formulae and displayed formulae', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4a-introduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.3 — official Issue 3 §4(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.3', NULL, 'know what is meant by the terms homologous series, functional group and isomerism', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4a-introduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.4 — official Issue 3 §4(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.4', NULL, 'understand how to name compounds relevant to this specification using the rules of International Union of Pure and Applied Chemistry (IUPAC) nomenclature students will be expected to name compounds containing up to six carbon atoms', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4a-introduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.5 — official Issue 3 §4(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.5', NULL, 'understand how to write the possible structural and displayed formulae of an organic molecule given its molecular formula', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4a-introduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.6 — official Issue 3 §4(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.6', NULL, 'understand how to classify reactions of organic compounds as substitution, addition and combustion knowledge of reaction mechanisms is not required', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4a-introduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.7 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.7', NULL, 'know that crude oil is a mixture of hydrocarbons', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.8 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.8', NULL, 'describe how the industrial process of fractional distillation separates crude oil into fractions', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.9 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.9', NULL, 'know the names and uses of the main fractions obtained from crude oil: refinery gases, gasoline, kerosene, diesel, fuel oil and bitumen', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.10 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.10', NULL, 'know the trend in colour, boiling point and viscosity of the main fractions', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.11 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.11', NULL, 'know that a fuel is a substance that, when burned, releases heat energy', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.12 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.12', NULL, 'know the possible products of complete and incomplete combustion of hydrocarbons with oxygen in the air', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.13 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.13', NULL, 'understand why carbon monoxide is poisonous, in terms of its effect on the capacity of blood to transport oxygen references to haemoglobin are not required', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.14 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.14', NULL, 'know that, in car engines, the temperature reached is high enough to allow nitrogen and oxygen from air to react, forming oxides of nitrogen', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.15 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.15', NULL, 'explain how the combustion of some impurities in hydrocarbon fuels results in the formation of sulfur dioxide', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.16 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.16', NULL, 'understand how sulfur dioxide and oxides of nitrogen contribute to acid rain', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.17 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.17', NULL, 'describe how long-chain alkanes are converted to alkenes and shorter-chain alkanes by catalytic cracking (using silica or alumina as the catalyst and a temperature in the range of 600–700 ºC)', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.18 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.18', NULL, 'explain why cracking is necessary, in terms of the balance between supply and demand for different fractions', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4b-crude-oil'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.19 — official Issue 3 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.19', NULL, 'know the general formula for alkanes', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4c-alkanes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.20 — official Issue 3 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.20', NULL, 'explain why alkanes are classified as saturated hydrocarbons', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4c-alkanes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.21 — official Issue 3 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.21', NULL, 'understand how to draw the structural and displayed formulae for alkanes with up to five carbon atoms in the molecule, and to name the unbranched-chain isomers', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4c-alkanes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.22 — official Issue 3 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.22', NULL, 'describe the reactions of alkanes with halogens in the presence of ultraviolet radiation, limited to mono-substitution knowledge of reaction mechanisms is not required', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4c-alkanes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.23 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.23', NULL, 'know that alkenes contain the functional group >C=C<', NULL, 'draft', 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4d-alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.24 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.24', NULL, 'know the general formula for alkenes', NULL, 'draft', 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4d-alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.25 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.25', NULL, 'explain why alkenes are classified as unsaturated hydrocarbons', NULL, 'draft', 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4d-alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.26 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.26', NULL, 'understand how to draw the structural and displayed formulae for alkenes with up to four carbon atoms in the molecule, and name the unbranched-chain isomers knowledge of cis/trans or E/Z notation is not required', NULL, 'draft', 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4d-alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.27 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.27', NULL, 'describe the reactions of alkenes with bromine to produce dibromoalkanes', NULL, 'draft', 27
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4d-alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.28 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.28', NULL, 'describe how bromine water can be used to distinguish between an alkane and an alkene', NULL, 'draft', 28
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4d-alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.29C — official Issue 3 §4(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.29C', NULL, 'know that alcohols contain the functional group −OH', NULL, 'draft', 29
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4e-alcohols'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.30C — official Issue 3 §4(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.30C', NULL, 'understand how to draw structural and displayed formulae for methanol, ethanol, propanol (propan-1-ol only) and butanol (butan-1-ol only), and name each compound the names propanol and butanol are acceptable', NULL, 'draft', 30
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4e-alcohols'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.31C — official Issue 3 §4(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.31C', NULL, 'know that ethanol can be oxidised by:
• burning in air or oxygen (complete combustion)
• reaction with oxygen in the air to form ethanoic acid (microbial oxidation)
• heating with potassium dichromate(VI) in dilute sulfuric acid to form ethanoic acid', NULL, 'draft', 31
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4e-alcohols'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.32C — official Issue 3 §4(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.32C', NULL, 'know that ethanol can be manufactured by:
•  reacting ethene with steam in the presence of a phosphoric acid catalyst at a temperature of about 300 ºC and a pressure of about 60–70 atm
•  the fermentation of glucose, in the absence of air, at an optimum temperature of about 30 ºC and using the enzymes in yeast', NULL, 'draft', 32
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4e-alcohols'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.33C — official Issue 3 §4(e) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.33C', NULL, 'understand the reasons for fermentation, in the absence of air, and at an optimum temperature', NULL, 'draft', 33
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4e-alcohols'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.34C — official Issue 3 §4(f) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.34C', NULL, 'know that carboxylic acids contain the functional group', NULL, 'draft', 34
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4f-carboxylic-acids'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.35C — official Issue 3 §4(f) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.35C', NULL, 'understand how to draw structural and displayed formulae for unbranched-chain carboxylic acids with up to four carbon atoms in the molecule, and name each compound', NULL, 'draft', 35
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4f-carboxylic-acids'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.36C — official Issue 3 §4(f) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.36C', NULL, 'describe the reactions of aqueous solutions of carboxylic acids with metals and metal carbonates', NULL, 'draft', 36
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4f-carboxylic-acids'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.37C — official Issue 3 §4(f) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.37C', NULL, 'know that vinegar is an aqueous solution containing ethanoic acid', NULL, 'draft', 37
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4f-carboxylic-acids'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.38C — official Issue 3 §4(g) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.38C', NULL, 'know that esters contain the functional group', NULL, 'draft', 38
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4g-esters'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.39C — official Issue 3 §4(g) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.39C', NULL, 'know that ethyl ethanoate is the ester produced when ethanol and ethanoic acid react in the presence of an acid catalyst', NULL, 'draft', 39
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4g-esters'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.40C — official Issue 3 §4(g) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.40C', NULL, 'understand how to write the structural and displayed formulae of ethyl ethanoate', NULL, 'draft', 40
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4g-esters'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.41C — official Issue 3 §4(g) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.41C', NULL, 'understand how to write the structural and displayed formulae of an ester, given the name or formula of the alcohol and carboxylic acid from which it is formed and vice versa', NULL, 'draft', 41
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4g-esters'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.42C — official Issue 3 §4(g) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.42C', NULL, 'know that esters are volatile compounds with distinctive smells and are used as food flavourings and in perfumes', NULL, 'draft', 42
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4g-esters'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.43C — official Issue 3 §4(g) (C: Chemistry-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.43C', NULL, 'practical: prepare a sample of an ester such as ethyl ethanoate', NULL, 'draft', 43
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4g-esters'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.44 — official Issue 3 §4(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.44', NULL, 'know that an addition polymer is formed by joining up many small molecules called monomers', NULL, 'draft', 44
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4h-synthetic-polymers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.45 — official Issue 3 §4(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.45', NULL, 'understand how to draw the repeat unit of an addition polymer, including poly(ethene), poly(propene), poly(chloroethene) and (poly)tetrafluoroethene', NULL, 'draft', 45
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4h-synthetic-polymers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.46 — official Issue 3 §4(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.46', NULL, 'understand how to deduce the structure of a monomer from the repeat unit of an addition polymer and vice versa', NULL, 'draft', 46
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4h-synthetic-polymers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.47 — official Issue 3 §4(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.47', NULL, 'explain problems in the disposal of addition polymers, including:
• their inertness and inability to biodegrade
• the production of toxic gases when they are burned.', NULL, 'draft', 47
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4h-synthetic-polymers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.48C — official Issue 3 §4(h) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.48C', NULL, 'know that condensation polymerisation, in which a dicarboxylic acid reacts with a diol, produces a polyester and water', NULL, 'draft', 48
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4h-synthetic-polymers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.49C — official Issue 3 §4(h) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.49C', NULL, 'understand how to write the structural and displayed formula of a polyester, showing the repeat unit, given the formulae of the monomers from which it is formed including the reaction of ethanedioic acid and ethanediol:', NULL, 'draft', 49
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4h-synthetic-polymers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.50C — official Issue 3 §4(h) (C: Chemistry-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.50C', NULL, 'know that some polyesters, known as biopolyesters, are biodegradable', NULL, 'draft', 50
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-chemistry'
WHERE t.slug = '4h-synthetic-polymers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- ── Self-verification: abort the transaction on ANY drift ───────────────────
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
   WHERE c.slug = 'edexcel-igcse-chemistry' AND t.unit_id IS NULL;
  SELECT count(*) INTO point_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-chemistry';
  SELECT count(*) INTO c_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-chemistry' AND p.code LIKE '%C';
  IF topic_count <> 28 THEN
    RAISE EXCEPTION '006 aborted: % unit-less topics, expected 28', topic_count;
  END IF;
  IF point_count <> 182 THEN
    RAISE EXCEPTION '006 aborted: % spec points, expected 182', point_count;
  END IF;
  IF c_count <> 52 THEN
    RAISE EXCEPTION '006 aborted: % C-suffix points, expected 52', c_count;
  END IF;
END $$;

COMMIT;
-- END OF 006 — 28 topics, 182 points. If this line is missing, the paste was truncated.
