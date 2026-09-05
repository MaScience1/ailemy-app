-- ============================================================================
-- AILEMY — PEARSON EDEXCEL INTERNATIONAL GCSE BIOLOGY (4BI1) SPECIFICATION
-- 22 sub-topics, 176 specification points (section 1: 4, section 2: 95, section 3: 39, section 4: 18, section 5: 20)
--
-- ⚠ NOT YET APPLIED — Phase 2 deliverable. Apply is the owner's Phase 3 step:
--   whole-file paste into the Supabase SQL Editor, sentinel confirmed, then
--   read-only verification by scripts/db-checks/igcse-4bi1-spec-verify.ts.
--   Run that script with --baseline BEFORE applying (expected: 0 topics,
--   0 points for 4BI1; 4CH1 and IAL populated and untouched). When applied,
--   this header is updated to record the date and the verification result,
--   the 006/007 way. Until then every point stays out of production.
--   All 176 points seed as status='draft', verified_at NULL —
--   INTENTIONALLY awaiting the Phase 3 official-verification lifecycle pass
--   (the 004/005 and 006/007 convention; that pass will be seed 009).
--
-- PROVENANCE — nothing here is invented:
--   Every sub-topic, code and statement is extracted from the OFFICIAL
--   Pearson Edexcel International GCSE in Biology (4BI1) — Specification,
--   Issue 3, © Pearson Education Limited 2024 (first teaching September 2017,
--   first examination June 2019), downloaded from
--   https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Biology/2017/specification-and-sample-assessments/international-gcse-biology-2017-specification1.pdf
--   pdf sha256 9f474a0ef0e93ef3c3107b568956d163454cdb476bb2017189e8dd12c0d58cef
--   by scripts/spec-extract/extract_4bi1.py. The committed extraction
--   (scripts/spec-extract/4bi1-issue3.json) is the reviewable intermediate;
--   this file is generated from it by generate-4bi1-seed.ts and is not
--   hand-edited. Wording was cross-checked chunk-verbatim against an
--   independent pdftotext extraction of the same PDF (176/176).
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
--   15 rows) are provenance, not points: each is kept as a comment above
--   the statements it scopes and never as a row or inside any wording.
--
-- PAPER 2-ONLY CONTENT — carried by the official codes themselves:
--   "specification statements that are in bold with a 'B' reference relate
--   to content that is only in the International GCSE in Biology and is not
--   found in the International GCSE in Science (Double Award)" (spec p.1);
--   Paper 1 "assesses core content that is not in bold and does not have a
--   'B' reference", Paper 2 "assesses all the content" (spec pp.7-8).
--   So the B SUFFIX in the code (42 of 176 points) IS the official
--   Paper 2-only marker — no schema field is needed, and the extractor
--   asserted bold ⟺ B for every statement. Practical investigations
--   (points in italics, beginning "practical:" — 14 points) keep that
--   prefix in their official wording.
--
-- Idempotent: topics ON CONFLICT (course_id, slug) DO NOTHING;
--             spec points ON CONFLICT (topic_id, code) DO UPDATE.
-- Course-scoped: every statement resolves through courses.slug = 'edexcel-igcse-biology'.
-- Self-verifying: the DO block before COMMIT recounts and RAISEs on drift,
-- so a truncated paste aborts the whole transaction instead of half-applying.
-- No DELETEs, no cross-course writes, no units rows, no schema changes.
-- ============================================================================

BEGIN;

-- ── Topics (22 lettered sub-topics, unit_id NULL) ───────────────────────────

-- 1(a) — Characteristics of living organisms
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1a-characteristics-of-living-organisms', '1(a)', 'Characteristics of living organisms', 'coming_soon', 1
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(b) — Variety of living organisms
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1b-variety-of-living-organisms', '1(b)', 'Variety of living organisms', 'coming_soon', 2
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(a) — Level of organisation
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2a-level-of-organisation', '2(a)', 'Level of organisation', 'coming_soon', 3
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(b) — Cell structure
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2b-cell-structure', '2(b)', 'Cell structure', 'coming_soon', 4
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(c) — Biological molecules
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2c-biological-molecules', '2(c)', 'Biological molecules', 'coming_soon', 5
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(d) — Movement of substances into and out of cells
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2d-movement-of-substances-into-and-out-of-cells', '2(d)', 'Movement of substances into and out of cells', 'coming_soon', 6
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(e) — Nutrition
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2e-nutrition', '2(e)', 'Nutrition', 'coming_soon', 7
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(f) — Respiration
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2f-respiration', '2(f)', 'Respiration', 'coming_soon', 8
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(g) — Gas exchange
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2g-gas-exchange', '2(g)', 'Gas exchange', 'coming_soon', 9
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(h) — Transport
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2h-transport', '2(h)', 'Transport', 'coming_soon', 10
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(i) — Excretion
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2i-excretion', '2(i)', 'Excretion', 'coming_soon', 11
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(j) — Co-ordination and response
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2j-co-ordination-and-response', '2(j)', 'Co-ordination and response', 'coming_soon', 12
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 3(a) — Reproduction
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '3a-reproduction', '3(a)', 'Reproduction', 'coming_soon', 13
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 3(b) — Inheritance
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '3b-inheritance', '3(b)', 'Inheritance', 'coming_soon', 14
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(a) — The organism in the environment
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4a-the-organism-in-the-environment', '4(a)', 'The organism in the environment', 'coming_soon', 15
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(b) — Feeding relationships
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4b-feeding-relationships', '4(b)', 'Feeding relationships', 'coming_soon', 16
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(c) — Cycles within ecosystems
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4c-cycles-within-ecosystems', '4(c)', 'Cycles within ecosystems', 'coming_soon', 17
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(d) — Human influences on the environment
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4d-human-influences-on-the-environment', '4(d)', 'Human influences on the environment', 'coming_soon', 18
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 5(a) — Food production
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '5a-food-production', '5(a)', 'Food production', 'coming_soon', 19
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 5(b) — Selective breeding
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '5b-selective-breeding', '5(b)', 'Selective breeding', 'coming_soon', 20
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 5(c) — Genetic modification (genetic engineering)
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '5c-genetic-modification-genetic-engineering', '5(c)', 'Genetic modification (genetic engineering)', 'coming_soon', 21
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 5(d) — Cloning
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '5d-cloning', '5(d)', 'Cloning', 'coming_soon', 22
FROM courses c WHERE c.slug = 'edexcel-igcse-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- ── Spec points (upsert by (topic_id, code)) ────────────────────────────────

-- 1.1 — official Issue 3 §1(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.1', 'understand how living organisms share the following characteristics:', 'understand how living organisms share the following characteristics:
• they require nutrition
• they respire
• they excrete their waste
• they respond to their surroundings
• they move
• they control their internal conditions
• they reproduce
• they grow and develop.', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '1a-characteristics-of-living-organisms'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.2 — official Issue 3 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.2', 'describe the common features shown by eukaryotic organisms: plants, animals, fungi and…', 'describe the common features shown by eukaryotic organisms: plants, animals, fungi and protoctists Plants: these are multicellular organisms; their cells contain chloroplasts and are able to carry out photosynthesis; their cells have cellulose cell walls; they store carbohydrates as starch or sucrose. Examples include flowering plants, such as a cereal (for example, maize), and a herbaceous legume (for example, peas or beans). Animals: these are multicellular organisms; their cells do not contain chloroplasts and are not able to carry out photosynthesis; they have no cell walls; they usually have nervous co-ordination and are able to move from one place to another; they often store carbohydrate as glycogen. Examples include mammals (for example, humans) and insects (for example, housefly and mosquito). Fungi: these are organisms that are not able to carry out photosynthesis; their body is usually organised into a mycelium made from thread-like structures called hyphae, which contain many nuclei; some examples are single-celled; their cells have walls made of chitin; they feed by extracellular secretion of digestive enzymes onto food material and absorption of the organic products; this is known as saprotrophic nutrition; they may store carbohydrate as glycogen. Examples include Mucor, which has the typical fungal hyphal structure, and yeast, which is single-celled. Protoctists: these are microscopic single-celled organisms. Some, like  Amoeba, that live in pond water, have features like an animal cell, while others, like  Chlorella, have chloroplasts and are more like plants. A pathogenic example is Plasmodium, responsible for causing malaria.', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '1b-variety-of-living-organisms'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.3 — official Issue 3 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.3', 'describe the common features shown by prokaryotic organisms such as bacteria Bacteria:…', 'describe the common features shown by prokaryotic organisms such as bacteria Bacteria: these are microscopic single-celled organisms; they have a cell wall, cell membrane, cytoplasm and plasmids; they lack a nucleus but contain a circular chromosome of DNA; some bacteria can carry out photosynthesis but most feed off other living or dead organisms. Examples include Lactobacillus bulgaricus, a rod-shaped bacterium used in the production of yoghurt from milk, and Pneumococcus, a spherical bacterium that acts as the pathogen causing pneumonia.', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '1b-variety-of-living-organisms'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.4 — official Issue 3 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.4', 'understand the term pathogen and know that pathogens may include fungi, bacteria,…', 'understand the term pathogen and know that pathogens may include fungi, bacteria, protoctists or viruses Viruses: these are not living organisms. They are small particles, smaller than bacteria; they are parasitic and can reproduce only inside living cells; they infect every type of living organism. They have a wide variety of shapes and sizes; they have no cellular structure but have a protein coat and contain one type of nucleic acid, either DNA or RNA. Examples include the tobacco mosaic virus that causes discolouring of the leaves of tobacco plants by preventing the formation of chloroplasts, the influenza virus that causes ‘flu’ and the HIV virus that causes AIDS.', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '1b-variety-of-living-organisms'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.1 — official Issue 3 §2(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.1', 'describe the levels of organisation in organisms: organelles, cells, tissues, organs…', 'describe the levels of organisation in organisms: organelles, cells, tissues, organs and systems', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2a-level-of-organisation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.2 — official Issue 3 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.2', 'describe cell structures, including the nucleus, cytoplasm, cell membrane, cell wall,…', 'describe cell structures, including the nucleus, cytoplasm, cell membrane, cell wall, mitochondria, chloroplasts, ribosomes and vacuole', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2b-cell-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.3 — official Issue 3 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.3', 'describe the functions of the nucleus, cytoplasm, cell membrane, cell wall,…', 'describe the functions of the nucleus, cytoplasm, cell membrane, cell wall, mitochondria, chloroplasts, ribosomes and vacuole', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2b-cell-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.4 — official Issue 3 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.4', 'know the similarities and differences in the structure of plant and animal cells', 'know the similarities and differences in the structure of plant and animal cells', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2b-cell-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.5B — official Issue 3 §2(b) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.5B', 'explain the importance of cell differentiation in the development of specialised cells', 'explain the importance of cell differentiation in the development of specialised cells', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2b-cell-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.6B — official Issue 3 §2(b) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.6B', 'understand the advantages and disadvantages of using stem cells in medicine', 'understand the advantages and disadvantages of using stem cells in medicine', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2b-cell-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.7 — official Issue 3 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.7', 'identify the chemical elements present in carbohydrates, proteins and lipids (fats and…', 'identify the chemical elements present in carbohydrates, proteins and lipids (fats and oils)', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2c-biological-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.8 — official Issue 3 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.8', 'describe the structure of carbohydrates, proteins and lipids as large molecules made up…', 'describe the structure of carbohydrates, proteins and lipids as large molecules made up from smaller basic units: starch and glycogen from simple sugars, protein from amino acids, and lipid from fatty acids and glycerol', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2c-biological-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.9 — official Issue 3 §2(c) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.9', 'practical: investigate food samples for the presence of glucose, starch, protein and fat', 'practical: investigate food samples for the presence of glucose, starch, protein and fat', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2c-biological-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.10 — official Issue 3 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.10', 'understand the role of enzymes as biological catalysts in metabolic reactions', 'understand the role of enzymes as biological catalysts in metabolic reactions', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2c-biological-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.11 — official Issue 3 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.11', 'understand how temperature changes can affect enzyme function, including changes to the…', 'understand how temperature changes can affect enzyme function, including changes to the shape of active site', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2c-biological-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.12 — official Issue 3 §2(c) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.12', 'practical: investigate how enzyme activity can be affected by changes in temperature', 'practical: investigate how enzyme activity can be affected by changes in temperature', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2c-biological-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.13 — official Issue 3 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.13', 'understand how enzyme function can be affected by changes in pH altering the active site', 'understand how enzyme function can be affected by changes in pH altering the active site', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2c-biological-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.14B — official Issue 3 §2(c) (B: Biology-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.14B', 'practical: investigate how enzyme activity can be affected by changes in pH', 'practical: investigate how enzyme activity can be affected by changes in pH', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2c-biological-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.15 — official Issue 3 §2(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.15', 'understand the processes of diffusion, osmosis and active transport by which substances…', 'understand the processes of diffusion, osmosis and active transport by which substances move into and out of cells', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2d-movement-of-substances-into-and-out-of-cells'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.16 — official Issue 3 §2(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.16', 'understand how factors affect the rate of movement of substances into and out of cells,…', 'understand how factors affect the rate of movement of substances into and out of cells, including the effects of surface area to volume ratio, distance, temperature and concentration gradient', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2d-movement-of-substances-into-and-out-of-cells'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.17 — official Issue 3 §2(d) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.17', 'practical: investigate diffusion and osmosis using living and non-living systems', 'practical: investigate diffusion and osmosis using living and non-living systems', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2d-movement-of-substances-into-and-out-of-cells'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Flowering plants
-- 2.18 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.18', 'understand the process of photosynthesis and its importance in the conversion of light…', 'understand the process of photosynthesis and its importance in the conversion of light energy to chemical energy', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.19 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.19', 'know the word equation and the balanced chemical symbol equation for photosynthesis', 'know the word equation and the balanced chemical symbol equation for photosynthesis', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.20 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.20', 'understand how varying carbon dioxide concentration, light intensity and temperature…', 'understand how varying carbon dioxide concentration, light intensity and temperature affect the rate of photosynthesis', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.21 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.21', 'describe the structure of the leaf and explain how it is adapted for photosynthesis', 'describe the structure of the leaf and explain how it is adapted for photosynthesis', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.22 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.22', 'understand that plants require mineral ions for growth, and that magnesium ions are…', 'understand that plants require mineral ions for growth, and that magnesium ions are needed for chlorophyll and nitrate ions are needed for amino acids', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.23 — official Issue 3 §2(e) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.23', 'practical: investigate photosynthesis, showing the evolution of oxygen from a water…', 'practical: investigate photosynthesis, showing the evolution of oxygen from a water plant, the production of starch and the requirements of light, carbon dioxide and chlorophyll', NULL, 'draft', 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Humans
-- 2.24 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.24', 'understand that a balanced diet should include appropriate proportions of carbohydrate,…', 'understand that a balanced diet should include appropriate proportions of carbohydrate, protein, lipid, vitamins, minerals, water and dietary fibre', NULL, 'draft', 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.25 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.25', 'identify the sources and describe the functions of carbohydrate, protein, lipid (fats…', 'identify the sources and describe the functions of carbohydrate, protein, lipid (fats and oils), vitamins A, C and D, the mineral ions calcium and iron, water and dietary fibre as components of the diet', NULL, 'draft', 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.26 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.26', 'understand how energy requirements vary with activity levels, age and pregnancy', 'understand how energy requirements vary with activity levels, age and pregnancy', NULL, 'draft', 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.27 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.27', 'describe the structure and function of the human alimentary canal, including the mouth,…', 'describe the structure and function of the human alimentary canal, including the mouth, oesophagus, stomach, small intestine (duodenum and ileum), large intestine (colon and rectum) and pancreas', NULL, 'draft', 27
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.28 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.28', 'understand how food is moved through the gut by peristalsis', 'understand how food is moved through the gut by peristalsis', NULL, 'draft', 28
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.29 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.29', 'understand the role of digestive enzymes, including the digestion of starch to glucose…', 'understand the role of digestive enzymes, including the digestion of starch to glucose by amylase and maltase, the digestion of proteins to amino acids by proteases and the digestion of lipids to fatty acids and glycerol by lipases', NULL, 'draft', 29
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.30 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.30', 'understand that bile is produced by the liver and stored in the gall bladder', 'understand that bile is produced by the liver and stored in the gall bladder', NULL, 'draft', 30
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.31 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.31', 'understand the role of bile in neutralising stomach acid and emulsifying lipids', 'understand the role of bile in neutralising stomach acid and emulsifying lipids', NULL, 'draft', 31
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.32 — official Issue 3 §2(e)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.32', 'understand how the small intestine is adapted for absorption, including the structure…', 'understand how the small intestine is adapted for absorption, including the structure of a villus', NULL, 'draft', 32
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.33B — official Issue 3 §2(e) (B: Biology-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.33B', 'practical: investigate the energy content in a food sample', 'practical: investigate the energy content in a food sample', NULL, 'draft', 33
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2e-nutrition'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.34 — official Issue 3 §2(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.34', 'understand how the process of respiration produces ATP in living organisms', 'understand how the process of respiration produces ATP in living organisms', NULL, 'draft', 34
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2f-respiration'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.35 — official Issue 3 §2(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.35', 'know that ATP provides energy for cells', 'know that ATP provides energy for cells', NULL, 'draft', 35
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2f-respiration'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.36 — official Issue 3 §2(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.36', 'describe the differences between aerobic and anaerobic respiration', 'describe the differences between aerobic and anaerobic respiration', NULL, 'draft', 36
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2f-respiration'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.37 — official Issue 3 §2(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.37', 'know the word equation and the balanced chemical symbol equation for aerobic…', 'know the word equation and the balanced chemical symbol equation for aerobic respiration in living organisms', NULL, 'draft', 37
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2f-respiration'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.38 — official Issue 3 §2(f)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.38', 'know the word equation for anaerobic respiration in plants and in animals', 'know the word equation for anaerobic respiration in plants and in animals', NULL, 'draft', 38
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2f-respiration'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.39 — official Issue 3 §2(f) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.39', 'practical: investigate the evolution of carbon dioxide and heat from respiring seeds or…', 'practical: investigate the evolution of carbon dioxide and heat from respiring seeds or other suitable living organisms', NULL, 'draft', 39
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2f-respiration'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Flowering plants
-- 2.40B — official Issue 3 §2(g) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.40B', 'understand the role of diffusion in gas exchange', 'understand the role of diffusion in gas exchange', NULL, 'draft', 40
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.41B — official Issue 3 §2(g) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.41B', 'understand gas exchange (of carbon dioxide and oxygen) in relation to respiration and…', 'understand gas exchange (of carbon dioxide and oxygen) in relation to respiration and photosynthesis', NULL, 'draft', 41
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.42B — official Issue 3 §2(g) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.42B', 'understand how the structure of the leaf is adapted for gas exchange', 'understand how the structure of the leaf is adapted for gas exchange', NULL, 'draft', 42
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.43B — official Issue 3 §2(g) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.43B', 'describe the role of stomata in gas exchange', 'describe the role of stomata in gas exchange', NULL, 'draft', 43
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.44B — official Issue 3 §2(g) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.44B', 'understand how respiration continues during the day and night, but that the net…', 'understand how respiration continues during the day and night, but that the net exchange of carbon dioxide and oxygen depends on the intensity of light', NULL, 'draft', 44
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.45B — official Issue 3 §2(g) (B: Biology-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.45B', 'practical: investigate the effect of light on net gas exchange from a leaf, using…', 'practical: investigate the effect of light on net gas exchange from a leaf, using hydrogen-carbonate indicator', NULL, 'draft', 45
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Humans
-- 2.46 — official Issue 3 §2(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.46', 'describe the structure of the thorax, including the ribs, intercostal muscles,…', 'describe the structure of the thorax, including the ribs, intercostal muscles, diaphragm, trachea, bronchi, bronchioles, alveoli and pleural membranes', NULL, 'draft', 46
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.47 — official Issue 3 §2(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.47', 'understand the role of the intercostal muscles and the diaphragm in ventilation', 'understand the role of the intercostal muscles and the diaphragm in ventilation', NULL, 'draft', 47
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.48 — official Issue 3 §2(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.48', 'explain how alveoli are adapted for gas exchange by diffusion between air in the lungs…', 'explain how alveoli are adapted for gas exchange by diffusion between air in the lungs and blood in capillaries', NULL, 'draft', 48
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.49 — official Issue 3 §2(g)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.49', 'understand the biological consequences of smoking in relation to the lungs and the…', 'understand the biological consequences of smoking in relation to the lungs and the circulatory system, including coronary heart disease', NULL, 'draft', 49
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.50 — official Issue 3 §2(g) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.50', 'practical: investigate breathing in humans, including the release of carbon dioxide and…', 'practical: investigate breathing in humans, including the release of carbon dioxide and the effect of exercise', NULL, 'draft', 50
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2g-gas-exchange'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.51 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.51', 'understand why simple, unicellular organisms can rely on diffusion for movement of…', 'understand why simple, unicellular organisms can rely on diffusion for movement of substances in and out of the cell', NULL, 'draft', 51
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.52 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.52', 'understand the need for a transport system in multicellular organisms', 'understand the need for a transport system in multicellular organisms', NULL, 'draft', 52
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Flowering plants
-- 2.53 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.53', 'describe the role of phloem in transporting sucrose and amino acids between the leaves…', 'describe the role of phloem in transporting sucrose and amino acids between the leaves and other parts of the plant', NULL, 'draft', 53
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.54 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.54', 'describe the role of xylem in transporting water and mineral ions from the roots to…', 'describe the role of xylem in transporting water and mineral ions from the roots to other parts of the plant', NULL, 'draft', 54
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.55B — official Issue 3 §2(h) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.55B', 'understand how water is absorbed by root hair cells', 'understand how water is absorbed by root hair cells', NULL, 'draft', 55
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.56B — official Issue 3 §2(h) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.56B', 'understand that transpiration is the evaporation of water from the surface of a plant', 'understand that transpiration is the evaporation of water from the surface of a plant', NULL, 'draft', 56
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.57B — official Issue 3 §2(h) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.57B', 'understand how the rate of transpiration is affected by changes in humidity, wind…', 'understand how the rate of transpiration is affected by changes in humidity, wind speed, temperature and light intensity', NULL, 'draft', 57
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.58B — official Issue 3 §2(h) (B: Biology-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.58B', 'practical: investigate the role of environmental factors in determining the rate of…', 'practical: investigate the role of environmental factors in determining the rate of transpiration from a leafy shoot', NULL, 'draft', 58
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Humans
-- 2.59 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.59', 'describe the composition of the blood: red blood cells, white blood cells, platelets…', 'describe the composition of the blood: red blood cells, white blood cells, platelets and plasma', NULL, 'draft', 59
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.60 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.60', 'understand the role of plasma in the transport of carbon dioxide, digested food, urea,…', 'understand the role of plasma in the transport of carbon dioxide, digested food, urea, hormones and heat energy', NULL, 'draft', 60
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.61 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.61', 'understand how adaptations of red blood cells make them suitable for the transport of…', 'understand how adaptations of red blood cells make them suitable for the transport of oxygen, including shape, the absence of a nucleus and the presence of haemoglobin', NULL, 'draft', 61
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.62 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.62', 'understand how the immune system responds to disease using white blood cells,…', 'understand how the immune system responds to disease using white blood cells, illustrated by phagocytes ingesting pathogens and lymphocytes releasing antibodies specific to the pathogen', NULL, 'draft', 62
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.63B — official Issue 3 §2(h) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.63B', 'understand how vaccination results in the manufacture of memory cells, which enable…', 'understand how vaccination results in the manufacture of memory cells, which enable future antibody production to the pathogen to occur sooner, faster and in greater quantity', NULL, 'draft', 63
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.64B — official Issue 3 §2(h) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.64B', 'understand how platelets are involved in blood clotting, which prevents blood loss and…', 'understand how platelets are involved in blood clotting, which prevents blood loss and the entry of micro-organisms', NULL, 'draft', 64
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.65 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.65', 'describe the structure of the heart and how it functions', 'describe the structure of the heart and how it functions', NULL, 'draft', 65
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.66 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.66', 'explain how the heart rate changes during exercise and under the influence of adrenaline', 'explain how the heart rate changes during exercise and under the influence of adrenaline', NULL, 'draft', 66
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.67 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.67', 'understand how factors may increase the risk of developing coronary heart disease', 'understand how factors may increase the risk of developing coronary heart disease', NULL, 'draft', 67
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.68 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.68', 'understand how the structure of arteries, veins and capillaries relate to their function', 'understand how the structure of arteries, veins and capillaries relate to their function', NULL, 'draft', 68
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.69 — official Issue 3 §2(h)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.69', 'understand the general structure of the circulation system, including the blood vessels…', 'understand the general structure of the circulation system, including the blood vessels to and from the heart and lungs, liver and kidneys', NULL, 'draft', 69
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2h-transport'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Flowering plants
-- 2.70 — official Issue 3 §2(i)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.70', 'understand the origin of carbon dioxide and oxygen as waste products of metabolism and…', 'understand the origin of carbon dioxide and oxygen as waste products of metabolism and their loss from the stomata of a leaf', NULL, 'draft', 70
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2i-excretion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Humans
-- 2.71 — official Issue 3 §2(i)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.71', 'know the excretory products of the lungs, kidneys and skin (organs of excretion)', 'know the excretory products of the lungs, kidneys and skin (organs of excretion)', NULL, 'draft', 71
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2i-excretion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.72B — official Issue 3 §2(i) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.72B', 'understand how the kidney carries out its roles of excretion and osmoregulation', 'understand how the kidney carries out its roles of excretion and osmoregulation', NULL, 'draft', 72
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2i-excretion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.73B — official Issue 3 §2(i) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.73B', 'describe the structure of the urinary system, including the kidneys, ureters, bladder…', 'describe the structure of the urinary system, including the kidneys, ureters, bladder and urethra', NULL, 'draft', 73
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2i-excretion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.74B — official Issue 3 §2(i) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.74B', 'describe the structure of a nephron, including the Bowman’s capsule and glomerulus,…', 'describe the structure of a nephron, including the Bowman’s capsule and glomerulus, convoluted tubules, loop of Henle and collecting duct', NULL, 'draft', 74
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2i-excretion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.75B — official Issue 3 §2(i) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.75B', 'describe ultrafiltration in the Bowman’s capsule and the composition of the glomerular…', 'describe ultrafiltration in the Bowman’s capsule and the composition of the glomerular filtrate', NULL, 'draft', 75
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2i-excretion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.76B — official Issue 3 §2(i) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.76B', 'understand how water is reabsorbed into the blood from the collecting duct', 'understand how water is reabsorbed into the blood from the collecting duct', NULL, 'draft', 76
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2i-excretion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.77B — official Issue 3 §2(i) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.77B', 'understand why selective reabsorption of glucose occurs at the proximal convoluted…', 'understand why selective reabsorption of glucose occurs at the proximal convoluted tubule', NULL, 'draft', 77
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2i-excretion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.78B — official Issue 3 §2(i) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.78B', 'describe the role of ADH in regulating the water content of the blood', 'describe the role of ADH in regulating the water content of the blood', NULL, 'draft', 78
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2i-excretion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.79B — official Issue 3 §2(i) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.79B', 'understand that urine contains water, urea and ions', 'understand that urine contains water, urea and ions', NULL, 'draft', 79
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2i-excretion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.80 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.80', 'understand how organisms are able to respond to changes in their environment', 'understand how organisms are able to respond to changes in their environment', NULL, 'draft', 80
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.81 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.81', 'understand that homeostasis is the maintenance of a constant internal environment, and…', 'understand that homeostasis is the maintenance of a constant internal environment, and that body water content and body temperature are both examples of homeostasis', NULL, 'draft', 81
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.82 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.82', 'understand that a co-ordinated response requires a stimulus, a receptor and an effector', 'understand that a co-ordinated response requires a stimulus, a receptor and an effector', NULL, 'draft', 82
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Flowering plants
-- 2.83 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.83', 'understand that plants respond to stimuli', 'understand that plants respond to stimuli', NULL, 'draft', 83
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.84 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.84', 'describe the geotropic and phototropic responses of roots and stems', 'describe the geotropic and phototropic responses of roots and stems', NULL, 'draft', 84
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.85 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.85', 'understand the role of auxin in the phototropic response of stems', 'understand the role of auxin in the phototropic response of stems', NULL, 'draft', 85
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Humans
-- 2.86 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.86', 'describe how nervous and hormonal communication control responses and understand the…', 'describe how nervous and hormonal communication control responses and understand the differences between the two systems', NULL, 'draft', 86
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.87 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.87', 'understand that the central nervous system consists of the brain and spinal cord and is…', 'understand that the central nervous system consists of the brain and spinal cord and is linked to sense organs by nerves', NULL, 'draft', 87
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.88 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.88', 'understand that stimulation of receptors in the sense organs sends electrical impulses…', 'understand that stimulation of receptors in the sense organs sends electrical impulses along nerves into and out of the central nervous system, resulting in rapid responses', NULL, 'draft', 88
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.89 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.89', 'understand the role of neurotransmitters at synapses', 'understand the role of neurotransmitters at synapses', NULL, 'draft', 89
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.90 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.90', 'describe the structure and functioning of a simple reflex arc illustrated by the…', 'describe the structure and functioning of a simple reflex arc illustrated by the withdrawal of a finger from a hot object', NULL, 'draft', 90
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.91 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.91', 'describe the structure and function of the eye as a receptor', 'describe the structure and function of the eye as a receptor', NULL, 'draft', 91
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.92 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.92', 'understand the function of the eye in focusing on near and distant objects, and in…', 'understand the function of the eye in focusing on near and distant objects, and in responding to changes in light intensity', NULL, 'draft', 92
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.93 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.93', 'describe the role of the skin in temperature regulation, with reference to sweating,…', 'describe the role of the skin in temperature regulation, with reference to sweating, vasoconstriction and vasodilation', NULL, 'draft', 93
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.94 — official Issue 3 §2(j)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.94', 'understand the sources, roles and effects of the following hormones: adrenaline,…', 'understand the sources, roles and effects of the following hormones: adrenaline, insulin, testosterone, progesterone and oestrogen', NULL, 'draft', 94
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.95B — official Issue 3 §2(j) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.95B', 'understand the sources, roles and effects of the following hormones: ADH, FSH and LH', 'understand the sources, roles and effects of the following hormones: ADH, FSH and LH', NULL, 'draft', 95
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '2j-co-ordination-and-response'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.1 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.1', 'understand the differences between sexual and asexual reproduction', 'understand the differences between sexual and asexual reproduction', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.2 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.2', 'understand that fertilisation involves the fusion of a male and female gamete to…', 'understand that fertilisation involves the fusion of a male and female gamete to produce a zygote that undergoes cell division and develops into an embryo', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Flowering plants
-- 3.3 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.3', 'describe the structures of an insect-pollinated and a wind-pollinated flower and…', 'describe the structures of an insect-pollinated and a wind-pollinated flower and explain how each is adapted for pollination', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.4 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.4', 'understand that the growth of the pollen tube followed by fertilisation leads to seed…', 'understand that the growth of the pollen tube followed by fertilisation leads to seed and fruit formation', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.5 — official Issue 3 §3(a) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.5', 'practical: investigate the conditions needed for seed germination', 'practical: investigate the conditions needed for seed germination', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.6 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.6', 'understand how germinating seeds utilise food reserves until the seedling can carry out…', 'understand how germinating seeds utilise food reserves until the seedling can carry out photosynthesis', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.7 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.7', 'understand that plants can reproduce asexually by natural methods (illustrated by…', 'understand that plants can reproduce asexually by natural methods (illustrated by runners) and by artificial methods (illustrated by cuttings)', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Humans
-- 3.8 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.8', 'understand how the structure of the male and female reproductive systems are adapted…', 'understand how the structure of the male and female reproductive systems are adapted for their functions', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.9 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.9', 'understand the roles of oestrogen and progesterone in the menstrual cycle', 'understand the roles of oestrogen and progesterone in the menstrual cycle', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.10B — official Issue 3 §3(a) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.10B', 'understand the roles of FSH and LH in the menstrual cycle', 'understand the roles of FSH and LH in the menstrual cycle', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.11 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.11', 'describe the role of the placenta in the nutrition of the developing embryo', 'describe the role of the placenta in the nutrition of the developing embryo', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.12 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.12', 'understand how the developing embryo is protected by amniotic fluid', 'understand how the developing embryo is protected by amniotic fluid', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.13 — official Issue 3 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.13', 'understand the roles of oestrogen and testosterone in the development of secondary…', 'understand the roles of oestrogen and testosterone in the development of secondary sexual characteristics', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3a-reproduction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.14 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.14', 'understand that the genome is the entire DNA of an organism and that a gene is a…', 'understand that the genome is the entire DNA of an organism and that a gene is a section of a molecule of DNA that codes for a specific protein', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.15 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.15', 'understand that the nucleus of a cell contains chromosomes on which genes are located', 'understand that the nucleus of a cell contains chromosomes on which genes are located', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.16B — official Issue 3 §3(b) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.16B', 'describe a DNA molecule as two strands coiled to form a double helix, the strands being…', 'describe a DNA molecule as two strands coiled to form a double helix, the strands being linked by a series of paired bases: adenine (A) with thymine (T), and cytosine (C) with guanine (G)', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.17B — official Issue 3 §3(b) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.17B', 'understand that an RNA molecule is single stranded and contains uracil (U) instead of…', 'understand that an RNA molecule is single stranded and contains uracil (U) instead of thymine (T)', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.18B — official Issue 3 §3(b) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.18B', 'describe the stages of protein synthesis including transcription and translation,…', 'describe the stages of protein synthesis including transcription and translation, including the role of mRNA, ribosomes, tRNA, codons and anticodons', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.19 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.19', 'understand how genes exist in alternative forms called alleles which give rise to…', 'understand how genes exist in alternative forms called alleles which give rise to differences in inherited characteristics', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.20 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.20', 'understand the meaning of the terms: dominant, recessive, homozygous, heterozygous,…', 'understand the meaning of the terms: dominant, recessive, homozygous, heterozygous, phenotype, and genotype', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.21B — official Issue 3 §3(b) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.21B', 'understand the meaning of the term codominance', 'understand the meaning of the term codominance', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.22 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.22', 'understand that most phenotypic features are the result of polygenic inheritance rather…', 'understand that most phenotypic features are the result of polygenic inheritance rather than single genes', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.23 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.23', 'describe patterns of monohybrid inheritance using a genetic diagram', 'describe patterns of monohybrid inheritance using a genetic diagram', NULL, 'draft', 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.24 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.24', 'understand how to interpret family pedigrees', 'understand how to interpret family pedigrees', NULL, 'draft', 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.25 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.25', 'predict probabilities of outcomes from monohybrid crosses', 'predict probabilities of outcomes from monohybrid crosses', NULL, 'draft', 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.26 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.26', 'understand how the sex of a person is controlled by one pair of chromosomes, XX in a…', 'understand how the sex of a person is controlled by one pair of chromosomes, XX in a female and XY in a male', NULL, 'draft', 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.27 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.27', 'describe the determination of the sex of offspring at fertilisation, using a genetic…', 'describe the determination of the sex of offspring at fertilisation, using a genetic diagram', NULL, 'draft', 27
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.28 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.28', 'understand how division of a diploid cell by mitosis produces two cells that contain…', 'understand how division of a diploid cell by mitosis produces two cells that contain identical sets of chromosomes', NULL, 'draft', 28
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.29 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.29', 'understand that mitosis occurs during growth, repair, cloning and asexual reproduction', 'understand that mitosis occurs during growth, repair, cloning and asexual reproduction', NULL, 'draft', 29
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.30 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.30', 'understand how division of a cell by meiosis produces four cells, each with half the…', 'understand how division of a cell by meiosis produces four cells, each with half the number of chromosomes, and that this results in the formation of genetically different haploid gametes', NULL, 'draft', 30
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.31 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.31', 'understand how random fertilisation produces genetic variation of offspring', 'understand how random fertilisation produces genetic variation of offspring', NULL, 'draft', 31
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.32 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.32', 'know that in human cells the diploid number of chromosomes is 46 and the haploid number…', 'know that in human cells the diploid number of chromosomes is 46 and the haploid number is 23', NULL, 'draft', 32
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.33 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.33', 'understand that variation within a species can be genetic, environmental, or a…', 'understand that variation within a species can be genetic, environmental, or a combination of both', NULL, 'draft', 33
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.34 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.34', 'understand that mutation is a rare, random change in genetic material that can be…', 'understand that mutation is a rare, random change in genetic material that can be inherited', NULL, 'draft', 34
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.35B — official Issue 3 §3(b) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.35B', 'understand how a change in DNA can affect the phenotype by altering the sequence of…', 'understand how a change in DNA can affect the phenotype by altering the sequence of amino acids in a protein', NULL, 'draft', 35
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.36B — official Issue 3 §3(b) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.36B', 'understand how most genetic mutations have no effect on the phenotype, some have a…', 'understand how most genetic mutations have no effect on the phenotype, some have a small effect and rarely do they have a significant effect', NULL, 'draft', 36
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.37B — official Issue 3 §3(b) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.37B', 'understand that the incidence of mutations can be increased by exposure to ionising…', 'understand that the incidence of mutations can be increased by exposure to ionising radiation (for example, gamma rays, x-rays and ultraviolet rays) and some chemical mutagens (for example, chemicals in tobacco)', NULL, 'draft', 37
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.38 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.38', 'explain Darwin’s theory of evolution by natural selection', 'explain Darwin’s theory of evolution by natural selection', NULL, 'draft', 38
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.39 — official Issue 3 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.39', 'understand how resistance to antibiotics can increase in bacterial populations, and…', 'understand how resistance to antibiotics can increase in bacterial populations, and appreciate how such an increase can lead to infections being difficult to control', NULL, 'draft', 39
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '3b-inheritance'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.1 — official Issue 3 §4(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.1', 'understand the terms population, community, habitat and ecosystem', 'understand the terms population, community, habitat and ecosystem', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4a-the-organism-in-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.2 — official Issue 3 §4(a) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.2', 'practical: investigate the population size of an organism in two different areas using…', 'practical: investigate the population size of an organism in two different areas using quadrats', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4a-the-organism-in-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.3B — official Issue 3 §4(a) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.3B', 'understand the term biodiversity', 'understand the term biodiversity', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4a-the-organism-in-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.4B — official Issue 3 §4(a) (B: Biology-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.4B', 'practical: investigate the distribution of organisms in their habitats and measure…', 'practical: investigate the distribution of organisms in their habitats and measure biodiversity using quadrats', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4a-the-organism-in-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.5 — official Issue 3 §4(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.5', 'understand how abiotic and biotic factors affect the population size and distribution…', 'understand how abiotic and biotic factors affect the population size and distribution of organisms', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4a-the-organism-in-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.6 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.6', 'understand the names given to different trophic levels, including producers, primary,…', 'understand the names given to different trophic levels, including producers, primary, secondary and tertiary consumers and decomposers', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4b-feeding-relationships'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.7 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.7', 'understand the concepts of food chains, food webs, pyramids of number, pyramids of…', 'understand the concepts of food chains, food webs, pyramids of number, pyramids of biomass and pyramids of energy transfer', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4b-feeding-relationships'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.8 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.8', 'understand the transfer of substances and energy along a food chain', 'understand the transfer of substances and energy along a food chain', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4b-feeding-relationships'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.9 — official Issue 3 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.9', 'understand why only about 10% of energy is transferred from one trophic level to the…', 'understand why only about 10% of energy is transferred from one trophic level to the next', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4b-feeding-relationships'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.10 — official Issue 3 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.10', 'describe the stages in the carbon cycle, including respiration, photosynthesis,…', 'describe the stages in the carbon cycle, including respiration, photosynthesis, decomposition and combustion', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4c-cycles-within-ecosystems'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.11B — official Issue 3 §4(c) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.11B', 'describe the stages in the nitrogen cycle, including the roles of nitrogen fixing…', 'describe the stages in the nitrogen cycle, including the roles of nitrogen fixing bacteria, decomposers, nitrifying bacteria and denitrifying bacteria (specific names of bacteria are not required)', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4c-cycles-within-ecosystems'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.12 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.12', 'understand the biological consequences of pollution of air by sulfur dioxide and carbon…', 'understand the biological consequences of pollution of air by sulfur dioxide and carbon monoxide', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4d-human-influences-on-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.13 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.13', 'understand that water vapour, carbon dioxide, nitrous oxide, methane and CFCs are…', 'understand that water vapour, carbon dioxide, nitrous oxide, methane and CFCs are greenhouse gases', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4d-human-influences-on-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.14 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.14', 'understand how human activities contribute to greenhouse gases', 'understand how human activities contribute to greenhouse gases', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4d-human-influences-on-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.15 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.15', 'understand how an increase in greenhouse gases results in an enhanced greenhouse effect…', 'understand how an increase in greenhouse gases results in an enhanced greenhouse effect and that this may lead to global warming and its consequences', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4d-human-influences-on-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.16 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.16', 'understand the biological consequences of pollution of water by sewage', 'understand the biological consequences of pollution of water by sewage', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4d-human-influences-on-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.17 — official Issue 3 §4(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.17', 'understand the biological consequences of eutrophication caused by leached minerals…', 'understand the biological consequences of eutrophication caused by leached minerals from fertiliser', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4d-human-influences-on-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.18B — official Issue 3 §4(d) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.18B', 'understand the effects of deforestation, including leaching, soil erosion, disturbance…', 'understand the effects of deforestation, including leaching, soil erosion, disturbance of evapotranspiration and the carbon cycle, and the balance of atmospheric gases', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '4d-human-influences-on-the-environment'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Crop plants
-- 5.1 — official Issue 3 §5(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.1', 'describe how glasshouses and polythene tunnels can be used to increase the yield of…', 'describe how glasshouses and polythene tunnels can be used to increase the yield of certain crops', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5a-food-production'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.2 — official Issue 3 §5(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.2', 'understand the effects on crop yield of increased carbon dioxide and increased…', 'understand the effects on crop yield of increased carbon dioxide and increased temperature in glasshouses', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5a-food-production'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.3 — official Issue 3 §5(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.3', 'understand how the use of fertiliser can increase crop yield', 'understand how the use of fertiliser can increase crop yield', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5a-food-production'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.4 — official Issue 3 §5(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.4', 'understand the reasons for pest control and the advantages and disadvantages of using…', 'understand the reasons for pest control and the advantages and disadvantages of using pesticides and biological control with crop plants', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5a-food-production'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Micro-organisms
-- 5.5 — official Issue 3 §5(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.5', 'understand the role of yeast in the production of food including bread', 'understand the role of yeast in the production of food including bread', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5a-food-production'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.6 — official Issue 3 §5(a) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.6', 'practical: investigate the role of anaerobic respiration by yeast in different…', 'practical: investigate the role of anaerobic respiration by yeast in different conditions', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5a-food-production'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.7 — official Issue 3 §5(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.7', 'understand the role of bacteria (Lactobacillus) in the production of yoghurt', 'understand the role of bacteria (Lactobacillus) in the production of yoghurt', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5a-food-production'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.8 — official Issue 3 §5(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.8', 'understand the use of an industrial fermenter and explain the need to provide suitable…', 'understand the use of an industrial fermenter and explain the need to provide suitable conditions in the fermenter, including aseptic precautions, nutrients, optimum temperature and pH, oxygenation and agitation, for the growth of micro- organisms', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5a-food-production'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- context heading (document typography, not a row): Fish farming
-- 5.9B — official Issue 3 §5(a) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.9B', 'understand the methods used to farm large numbers of fish to provide a source of…', 'understand the methods used to farm large numbers of fish to provide a source of protein, including maintaining water quality, controlling intraspecific and interspecific predation, controlling disease, removing waste products, controlling the quality and frequency of feeding, and selective breeding', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5a-food-production'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.10 — official Issue 3 §5(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.10', 'understand how selective breeding can develop plants with desired characteristics', 'understand how selective breeding can develop plants with desired characteristics', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5b-selective-breeding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.11 — official Issue 3 §5(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.11', 'understand how selective breeding can develop animals with desired characteristics', 'understand how selective breeding can develop animals with desired characteristics', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5b-selective-breeding'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.12 — official Issue 3 §5(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.12', 'understand how restriction enzymes are used to cut DNA at specific sites and ligase…', 'understand how restriction enzymes are used to cut DNA at specific sites and ligase enzymes are used to join pieces of DNA together', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5c-genetic-modification-genetic-engineering'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.13 — official Issue 3 §5(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.13', 'understand how plasmids and viruses can act as vectors, which take up pieces of DNA,…', 'understand how plasmids and viruses can act as vectors, which take up pieces of DNA, and then insert this recombinant DNA into other cells', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5c-genetic-modification-genetic-engineering'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.14 — official Issue 3 §5(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.14', 'understand how large amounts of human insulin can be manufactured from genetically…', 'understand how large amounts of human insulin can be manufactured from genetically modified bacteria that are grown in a fermenter', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5c-genetic-modification-genetic-engineering'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.15 — official Issue 3 §5(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.15', 'understand how genetically modified plants can be used to improve food production', 'understand how genetically modified plants can be used to improve food production', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5c-genetic-modification-genetic-engineering'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.16 — official Issue 3 §5(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.16', 'understand that the term transgenic means the transfer of genetic material from one…', 'understand that the term transgenic means the transfer of genetic material from one species to a different species', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5c-genetic-modification-genetic-engineering'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.17B — official Issue 3 §5(d) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.17B', 'describe the process of micropropagation (tissue culture) in which explants are grown…', 'describe the process of micropropagation (tissue culture) in which explants are grown in vitro', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5d-cloning'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.18B — official Issue 3 §5(d) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.18B', 'understand how micropropagation can be used to produce commercial quantities of…', 'understand how micropropagation can be used to produce commercial quantities of genetically identical plants with desirable characteristics', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5d-cloning'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.19B — official Issue 3 §5(d) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.19B', 'describe the stages in the production of cloned mammals involving the introduction of a…', 'describe the stages in the production of cloned mammals involving the introduction of a diploid nucleus from a mature cell into an enucleated egg cell, illustrated by Dolly the sheep', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5d-cloning'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.20B — official Issue 3 §5(d) (B: Biology-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.20B', 'understand how cloned transgenic animals can be used to produce human proteins', 'understand how cloned transgenic animals can be used to produce human proteins', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-biology'
WHERE t.slug = '5d-cloning'
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
  b_count integer;
BEGIN
  SELECT count(*) INTO topic_count FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology' AND t.unit_id IS NULL;
  SELECT count(*) INTO point_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology';
  SELECT count(*) INTO b_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology' AND p.code LIKE '%B';
  IF topic_count <> 22 THEN
    RAISE EXCEPTION '008 aborted: % unit-less topics, expected 22', topic_count;
  END IF;
  IF point_count <> 176 THEN
    RAISE EXCEPTION '008 aborted: % spec points, expected 176', point_count;
  END IF;
  IF b_count <> 42 THEN
    RAISE EXCEPTION '008 aborted: % B-suffix points, expected 42', b_count;
  END IF;
END $$;

COMMIT;
-- END OF 008 — 22 topics, 176 points. If this line is missing, the paste was truncated.
