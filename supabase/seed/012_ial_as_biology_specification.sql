-- ============================================================================
-- AILEMY — PEARSON EDEXCEL IAL AS BIOLOGY (XBI11 · WBI11/WBI12/WBI13)
-- SPECIFICATION — 4 topics across Units 1-2, 80 specification points
-- (Topic 1: 20, Topic 2: 18, Topic 3: 21, Topic 4: 21; Unit 1: 38, Unit 2: 42, Unit 3: none — it defines no content)
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
--   Pearson Edexcel International Advanced Level Biology — Specification,
--   Issue 2 (February 2021), © Pearson Education Limited 2021
--   (IAS XBI11, IAL YBI11; first teaching September 2018,
--   first examination from January 2019; ISBN 978 1 446 94575 9),
--   downloaded from
--   https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Biology/2018/Specification-and-Sample-Assessment/International-A-Level-Biology-Spec.pdf
--   pdf sha256 9197bf761e06353b492fa04ee3ac4352a02e7e5baf56f277782f4ca0f53d2703
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
--   description as their own lines (26 statements carry 60 sub-points);
--   9 statements ARE core practicals (CP1-CP9), their official codes in
--   the numbered sequence; the document's 5 RECOMMENDED ADDITIONAL
--   PRACTICAL boxes are guidance, not statements, and are NOT seeded.
--   Pearson's own italic guidance notes (4) and the Issue 2 source
--   typo in 3.5(ii) ('knderstand') are preserved verbatim — source fidelity
--   over editorial correction (owner decision 4).
--
-- Idempotent: topics ON CONFLICT (course_id, slug) DO NOTHING;
--             spec points ON CONFLICT (topic_id, code) DO UPDATE.
-- Course-scoped: every statement resolves through courses.slug = 'edexcel-ial-as-biology'.
-- Unit-scoped: every topic resolves its unit through units.slug on THIS course.
-- Self-verifying: the DO block before COMMIT recounts and RAISEs on drift,
-- so a truncated paste aborts the whole transaction instead of half-applying.
-- No DELETEs, no cross-course writes, no units rows, no A2 writes, no schema
-- changes. All 80 points land status 'draft', verified_at NULL —
-- INTENTIONALLY awaiting the Phase 3 official-verification lifecycle pass
-- (the 004/005 … 010/011 convention; that pass is seed 013).
-- ============================================================================

BEGIN;

-- ── Topics (4: two per content unit, unit_id resolved via units.slug) ──────

-- Topic 1 — Molecules, Transport and Health (Unit 1)
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, 'topic-1-molecules-transport-and-health', 'Topic 1', 'Molecules, Transport and Health', 'coming_soon', 1
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-1'
WHERE c.slug = 'edexcel-ial-as-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- Topic 2 — Membranes, Proteins, DNA and Gene Expression (Unit 1)
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, 'topic-2-membranes-proteins-dna-and-gene-expression', 'Topic 2', 'Membranes, Proteins, DNA and Gene Expression', 'coming_soon', 2
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-1'
WHERE c.slug = 'edexcel-ial-as-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- Topic 3 — Cell Structure, Reproduction and Development (Unit 2)
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, 'topic-3-cell-structure-reproduction-and-development', 'Topic 3', 'Cell Structure, Reproduction and Development', 'coming_soon', 3
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-2'
WHERE c.slug = 'edexcel-ial-as-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- Topic 4 — Plant Structure and Function, Biodiversity and Conservation (Unit 2)
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, 'topic-4-plant-structure-and-function-biodiversity-and-conservation', 'Topic 4', 'Plant Structure and Function, Biodiversity and Conservation', 'coming_soon', 4
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-2'
WHERE c.slug = 'edexcel-ial-as-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- ── Spec points (upsert by (topic_id, code)) ────────────────────────────────

-- 1.1 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.1', 'understand the importance of water as a solvent in transport, including its dipole…', 'understand the importance of water as a solvent in transport, including its dipole nature', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.2 — official Issue 2 Topic 1, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.2', '(i) know the difference between monosaccharides, disaccharides and polysaccharides,…', '(i) know the difference between monosaccharides, disaccharides and polysaccharides, including glycogen and starch (amylose and amylopectin)
(ii) be able to relate the structures of monosaccharides, disaccharides and polysaccharides to their roles in providing and storing energy
β-glucose and cellulose are not required in this topic.', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.3 — official Issue 2 Topic 1, Unit 1 (CORE PRACTICAL 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.3', 'CORE PRACTICAL 1 — Use a semi-quantitative method with Benedict’s reagent to estimate…', 'CORE PRACTICAL 1
Use a semi-quantitative method with Benedict’s reagent to estimate the concentrations of reducing sugars and with iodine solution to estimate the concentrations of starch, using colour standards.', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.4 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.4', 'know how monosaccharides (glucose, fructose and galactose) join together to form…', 'know how monosaccharides (glucose, fructose and galactose) join together to form disaccharides (maltose, sucrose and lactose) and polysaccharides (glycogen, amylose and amylopectin) through condensation reactions forming glycosidic bonds, and how these can be split through hydrolysis reactions', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.5 — official Issue 2 Topic 1, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.5', '(i) know how a triglyceride is synthesised by the formation of ester bonds during…', '(i) know how a triglyceride is synthesised by the formation of ester bonds during condensation reactions between glycerol and three fatty acids
(ii) know the differences between saturated and unsaturated lipids', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.6 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.6', 'understand why many animals have a heart and circulation (mass transport to overcome…', 'understand why many animals have a heart and circulation (mass transport to overcome the limitations of diffusion in meeting the requirements of organisms)', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.7 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.7', 'understand how the structures of blood vessels (capillaries, arteries and veins) relate…', 'understand how the structures of blood vessels (capillaries, arteries and veins) relate to their functions', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.8 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.8', 'know the cardiac cycle (atrial systole, ventricular systole and cardiac diastole) and…', 'know the cardiac cycle (atrial systole, ventricular systole and cardiac diastole) and relate the structure and operation of the mammalian heart, including the major blood vessels, to its function
Details of myogenic stimulation are not needed at IAS.', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.9 — official Issue 2 Topic 1, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.9', '(i) understand the role of haemoglobin in the transport of oxygen and carbon dioxide', '(i) understand the role of haemoglobin in the transport of oxygen and carbon dioxide
(ii) understand the oxygen dissociation curve of haemoglobin, the Bohr effect and the significance of the oxygen affinity of fetal haemoglobin compared with adult haemoglobin', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.10 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.10', 'understand the course of events that leads to atherosclerosis (endothelial dysfunction,…', 'understand the course of events that leads to atherosclerosis (endothelial dysfunction, inflammatory response, plaque formation, raised blood pressure)', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.11 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.11', 'understand the blood clotting process (thromboplastin release, conversion of…', 'understand the blood clotting process (thromboplastin release, conversion of prothrombin to thrombin and fibrinogen to fibrin) and its role in cardiovascular disease (CVD)', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.12 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.12', 'know how factors such as genetics, diet, age, gender, high blood pressure, smoking and…', 'know how factors such as genetics, diet, age, gender, high blood pressure, smoking and inactivity increase the risk of cardiovascular disease (CVD)', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.13 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.13', 'understand the link between dietary antioxidants and the risk of cardiovascular disease…', 'understand the link between dietary antioxidants and the risk of cardiovascular disease (CVD)', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.14 — official Issue 2 Topic 1, Unit 1 (CORE PRACTICAL 2)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.14', 'CORE PRACTICAL 2 — Investigate the vitamin C content of food and drink.', 'CORE PRACTICAL 2
Investigate the vitamin C content of food and drink.', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.15 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.15', 'be able to analyse and interpret quantitative data on illness and mortality rates to…', 'be able to analyse and interpret quantitative data on illness and mortality rates to determine health risks, including distinguishing between correlation and causation and recognising conflicting evidence', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.16 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.16', 'be able to evaluate the design of studies used to determine health risk factors,…', 'be able to evaluate the design of studies used to determine health risk factors, including sample selection and sample size used to collect data that is both valid and reliable', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.17 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.17', 'understand why people’s perception of risks are often different from the actual risks,…', 'understand why people’s perception of risks are often different from the actual risks, including underestimating and overestimating the risks due to diet and other lifestyle factors in the development of heart disease', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.18 — official Issue 2 Topic 1, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.18', '(i) be able to analyse data on the possible significance for health of blood…', '(i) be able to analyse data on the possible significance for health of blood cholesterol levels and levels of high-density lipoproteins (HDLs) and low-density lipoproteins (LDLs)
(ii) know the evidence for a causal relationship between blood cholesterol levels (total cholesterol and LDL cholesterol) and cardiovascular disease (CVD)', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.19 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.19', 'understand how people use scientific knowledge about the effect of diet, including…', 'understand how people use scientific knowledge about the effect of diet, including obesity indicators, such as body mass index and waist-to-hip ratio, exercise and smoking to reduce their risk of coronary heart disease', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.20 — official Issue 2 Topic 1, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.20', 'know the benefits and risks of treatments for cardiovascular disease (CVD)…', 'know the benefits and risks of treatments for cardiovascular disease (CVD) (antihypertensives, statins, anticoagulants and platelet inhibitors)', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-1-molecules-transport-and-health'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.1 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii)(iii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.1', '(i) know the properties of gas exchange surfaces in living organisms (large surface…', '(i) know the properties of gas exchange surfaces in living organisms (large surface area to volume ratio, thickness of surface and difference in concentration)
(ii) understand how the rate of diffusion is dependent on these properties and can be calculated using Fick’s Law of Diffusion
(iii) understand how the structure of the mammalian lung is adapted for rapid gaseous exchange', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.2 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.2', '(i) know the structure and properties of cell membranes', '(i) know the structure and properties of cell membranes
(ii) understand how models such as the fluid mosaic model of membrane structure are interpretations of data used to develop scientific explanations of the structure and properties of cell membranes', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.3 — official Issue 2 Topic 2, Unit 1 (CORE PRACTICAL 3)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.3', 'CORE PRACTICAL 3 — Investigate membrane properties including the effect of alcohol and…', 'CORE PRACTICAL 3
Investigate membrane properties including the effect of alcohol and temperature on membrane permeability.', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.4 — official Issue 2 Topic 2, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.4', 'understand what is meant by osmosis in terms of the movement of free water molecules…', 'understand what is meant by osmosis in terms of the movement of free water molecules through a partially permeable membrane, down a water potential gradient', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.5 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.5', '(i) understand what is meant by passive transport (diffusion, facilitated diffusion),…', '(i) understand what is meant by passive transport (diffusion, facilitated diffusion), active transport (including the role of ATP as an immediate source of energy), endocytosis and exocytosis
(ii) understand the involvement of carrier and channel proteins in membrane transport', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.6 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii)(iii)(iv))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.6', '(i) know the basic structure of an amino acid', '(i) know the basic structure of an amino acid
Structures of specific amino acids are not required.
(ii) understand the formation of polypeptides and proteins (amino acid monomers linked by condensation reactions to form peptide bonds)
(iii) understand the significance of a protein’s primary structure in determining its secondary structure, three-dimensional structure and properties (globular and fibrous proteins and the types of bonds involved in its three-dimensional structure)
(iv) know the molecular structure of a globular protein and a fibrous protein and understand how their structures relate to their functions (including haemoglobin and collagen)', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.7 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii)(iii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.7', '(i) understand the mechanism of action and the specificity of enzymes in terms of their…', '(i) understand the mechanism of action and the specificity of enzymes in terms of their three-dimensional structure
(ii) understand that enzymes are biological catalysts that reduce activation energy
(iii) know that there are intracellular enzymes catalysing reactions inside cells and extracellular enzymes catalysing reactions outside cells', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.8 — official Issue 2 Topic 2, Unit 1 (CORE PRACTICAL 4)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.8', 'CORE PRACTICAL 4 — Investigate the effect of temperature, pH, enzyme concentration and…', 'CORE PRACTICAL 4
Investigate the effect of temperature, pH, enzyme concentration and substrate concentration on the initial rate of enzyme-catalysed reactions.', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.9 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.9', '(i)  know the basic structure of mononucleotides (deoxyribose or ribose linked to a…', '(i)  know the basic structure of mononucleotides (deoxyribose or ribose linked to a phosphate and a base, including thymine, uracil, adenine, cytosine or guanine) and the structures of DNA and RNA (polynucleotides composed of mononucleotides linked by condensation reactions to form phosphodiester bonds)
(ii) know how complementary base pairing and the hydrogen bonding between two complementary strands are involved in the formation of the DNA double helix', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.10 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.10', '(i)  understand the process of DNA replication, including the role of DNA polymerase', '(i)  understand the process of DNA replication, including the role of DNA polymerase
(ii) understand how Meselson and Stahl’s classic experiment provided new data that supported the accepted theory of replication of DNA and refuted competing theories', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.11 — official Issue 2 Topic 2, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.11', 'understand the nature of the genetic code (triplet code, non-overlapping and degenerate)', 'understand the nature of the genetic code (triplet code, non-overlapping and degenerate)', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.12 — official Issue 2 Topic 2, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.12', 'know that a gene is a sequence of bases on a DNA molecule that codes for a sequence of…', 'know that a gene is a sequence of bases on a DNA molecule that codes for a sequence of amino acids in a polypeptide chain', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.13 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.13', '(i)  understand the process of protein synthesis (transcription and translation),…', '(i)  understand the process of protein synthesis (transcription and translation), including the role of RNA polymerase, translation, messenger RNA, transfer RNA, ribosomes and the role of start and stop codons
(ii)  understand the roles of the DNA template (antisense) strand in transcription, codons on messenger RNA and anticodons on transfer RNA', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.14 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.14', '(i)  understand how errors in DNA replication can give rise to mutations (substitution,…', '(i)  understand how errors in DNA replication can give rise to mutations (substitution, insertion and deletion of bases)
(ii)  know that some mutations will give rise to cancer or genetic disorders, but that many mutations will have no observable effect', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.15 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii)(iii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.15', '(i)  understand what is meant by the terms gene, allele, genotype, phenotype,…', '(i)  understand what is meant by the terms gene, allele, genotype, phenotype, recessive, dominant, codominance, homozygote and heterozygote
(ii)  understand patterns of inheritance, including the interpretation of genetic pedigree diagrams, in the context of monohybrid inheritance
(iii)  understand sex linkage on the X chromosome, including red-green colour blindness in humans', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.16 — official Issue 2 Topic 2, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.16', 'understand how the expression of a gene mutation in people with cystic fibrosis impairs…', 'understand how the expression of a gene mutation in people with cystic fibrosis impairs the functioning of the gaseous exchange, digestive and reproductive systems', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.17 — official Issue 2 Topic 2, Unit 1 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.17', '(i) understand the uses of genetic screening, including the identification of carriers,…', '(i) understand the uses of genetic screening, including the identification of carriers, pre-implantation genetic diagnosis (PGD) and prenatal testing, including amniocentesis and chorionic villus sampling
(ii)  understand the implications of prenatal genetic screening', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.18 — official Issue 2 Topic 2, Unit 1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.18', 'be able to identify and discuss the ethical and social issues relating to genetic…', 'be able to identify and discuss the ethical and social issues relating to genetic screening from a range of ethical viewpoints, including religious, moral and social implications', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-2-membranes-proteins-dna-and-gene-expression'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.1 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.1', 'know that all living organisms are made of cells, sharing some common features', 'know that all living organisms are made of cells, sharing some common features', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.2 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.2', 'understand how the cells of multicellular organisms are organised into tissues, tissues…', 'understand how the cells of multicellular organisms are organised into tissues, tissues into organs, and organs into organ systems', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.3 — official Issue 2 Topic 3, Unit 2 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.3', '(i) know the ultrastructure of eukaryotic cells, including nucleus, nucleolus,…', '(i) know the ultrastructure of eukaryotic cells, including nucleus, nucleolus, ribosomes, rough and smooth endoplasmic reticulum, mitochondria, centrioles, lysosomes and Golgi apparatus
(ii) understand the function of the organelles listed in (i)', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.4 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.4', 'understand the role of the rough endoplasmic reticulum (rER) and the Golgi apparatus in…', 'understand the role of the rough endoplasmic reticulum (rER) and the Golgi apparatus in protein transport within cells, including their role in the formation of extracellular enzymes', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.5 — official Issue 2 Topic 3, Unit 2 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.5', '(i) know the ultrastructure of prokaryotic cells, including cell wall, capsule,…', '(i) know the ultrastructure of prokaryotic cells, including cell wall, capsule, plasmid, flagellum, pili, ribosomes and circular DNA
(ii) knderstand the function of the structures listed in (i)', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.6 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.6', 'be able to recognise the organelles in 3.3 from electron microscope (EM) images', 'be able to recognise the organelles in 3.3 from electron microscope (EM) images', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.7 — official Issue 2 Topic 3, Unit 2 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.7', '(i) know how magnification and resolution can be achieved using light and electron…', '(i) know how magnification and resolution can be achieved using light and electron microscopy
(ii) understand the importance of staining specimens in microscopy', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.8 — official Issue 2 Topic 3, Unit 2 (CORE PRACTICAL 5; sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.8', 'CORE PRACTICAL 5 — (i) use a light microscope to make observations and labelled…', 'CORE PRACTICAL 5
(i) use a light microscope to make observations and labelled drawings of suitable animal cells
(ii) use a graticule with a microscope to make measurements and understand the concept of scale', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.9 — official Issue 2 Topic 3, Unit 2 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.9', '(i) know that a locus is the location of genes on a chromosome', '(i) know that a locus is the location of genes on a chromosome
(ii) understand the linkage of genes on a chromosome', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.10 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.10', 'understand the role of meiosis in ensuring genetic variation through the production of…', 'understand the role of meiosis in ensuring genetic variation through the production of non-identical gametes as a consequence of independent assortment of chromosomes in metaphase I and crossing over of alleles between chromatids in prophase I
Names of the stages of prophase are not required.', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.11 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.11', 'understand how mammalian gametes are specialised for their functions (including the…', 'understand how mammalian gametes are specialised for their functions (including the acrosome in sperm and the zona pellucida in the egg cell)', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.12 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.12', 'know the process of fertilisation in mammals, including the acrosome reaction, the…', 'know the process of fertilisation in mammals, including the acrosome reaction, the cortical reaction and the fusion of nuclei', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.13 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.13', 'know the process of fertilisation in flowering plants, starting with the growth of a…', 'know the process of fertilisation in flowering plants, starting with the growth of a pollen tube and ending with the fusion of nuclei', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.14 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.14', 'understand the role of mitosis and the cell cycle in producing genetically identical…', 'understand the role of mitosis and the cell cycle in producing genetically identical daughter cells for growth and asexual reproduction', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.15 — official Issue 2 Topic 3, Unit 2 (CORE PRACTICAL 6)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.15', 'CORE PRACTICAL 6 — Prepare and stain a root tip squash to observe the stages of mitosis.', 'CORE PRACTICAL 6
Prepare and stain a root tip squash to observe the stages of mitosis.', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.16 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.16', 'be able to calculate mitotic indices', 'be able to calculate mitotic indices', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.17 — official Issue 2 Topic 3, Unit 2 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.17', '(i) understand what is meant by the terms stem cell, pluripotent and totipotent, morula…', '(i) understand what is meant by the terms stem cell, pluripotent and totipotent, morula and blastocyst
(ii) be able to discuss the ways in which society uses scientific knowledge to make decisions about the use of stem cells in medical therapies', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.18 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.18', 'understand how cells become specialised through differential gene expression, producing…', 'understand how cells become specialised through differential gene expression, producing active mRNA, leading to the synthesis of proteins which, in turn, control cell processes or determine cell structure in animals and plants', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.19 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.19', 'understand how one gene can give rise to more than one protein through…', 'understand how one gene can give rise to more than one protein through post-transcriptional changes to messenger RNA (mRNA)', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.20 — official Issue 2 Topic 3, Unit 2 (sub-points (i)(ii)(iii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.20', '(i) understand how phenotype is the result of an interaction between genotype and the…', '(i) understand how phenotype is the result of an interaction between genotype and the environment
(ii) know how epigenetic modification, including DNA methylation and histone modification, can alter the activation of certain genes
(iii) understand how epigenetic modifications can be passed on following cell division', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.21 — official Issue 2 Topic 3, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.21', 'understand how some phenotypes are affected by multiple alleles for the same gene, or…', 'understand how some phenotypes are affected by multiple alleles for the same gene, or by polygenic inheritance, as well as the environment, and how polygenic inheritance can give rise to phenotypes that show continuous variation', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-3-cell-structure-reproduction-and-development'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.1 — official Issue 2 Topic 4, Unit 2 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.1', '(i) know the structure and ultrastructure of plant cells including cell wall,…', '(i) know the structure and ultrastructure of plant cells including cell wall, chloroplast, amyloplast, vacuole, tonoplast, plasmodesmata, pits and middle lamella and be able to compare it with animal cells
(ii) understand the function of the structures listed in (i)', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.2 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.2', 'be able to recognise the organelles in 4.1 from electron microscope (EM) images', 'be able to recognise the organelles in 4.1 from electron microscope (EM) images', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.3 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.3', 'understand the structure and function of the polysaccharides starch and cellulose,…', 'understand the structure and function of the polysaccharides starch and cellulose, including the role of hydrogen bonds between the β-glucose molecules in the formation of cellulose microfibrils', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.4 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.4', 'understand how the arrangement of cellulose microfibrils and secondary thickening in…', 'understand how the arrangement of cellulose microfibrils and secondary thickening in plant cell walls contributes to the physical properties of xylem vessels and sclerenchyma fibres in plant fibres that can be exploited by humans', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.5 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.5', 'know the similarities and differences between the structures of, the position in the…', 'know the similarities and differences between the structures of, the position in the stem, and the function of sclerenchyma fibres (support), xylem vessels (support and transport of water and mineral ions) and phloem (translocation of organic solutes)', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.6 — official Issue 2 Topic 4, Unit 2 (CORE PRACTICAL 7; sub-points (i)(ii)(iii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.6', 'CORE PRACTICAL 7 — Use a light microscope to:', 'CORE PRACTICAL 7
Use a light microscope to:
(i) make observations, draw and label plan diagrams of transverse sections of roots, stems and leaves
(ii) make observations, draw and label cells of plant tissues
(iii) identify sclerenchyma fibres, phloem, sieve tubes and xylem vessels and their location.', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.7 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.7', 'understand how the uses of plant fibres and starch may contribute to sustainability,…', 'understand how the uses of plant fibres and starch may contribute to sustainability, including plant-based products to replace oil-based plastics', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.8 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.8', 'understand the importance of water and inorganic ions (nitrate, calcium ions and…', 'understand the importance of water and inorganic ions (nitrate, calcium ions and magnesium ions) to plants', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.9 — official Issue 2 Topic 4, Unit 2 (CORE PRACTICAL 8)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.9', 'CORE PRACTICAL 8 — Determine the tensile strength of plant fibres.', 'CORE PRACTICAL 8
Determine the tensile strength of plant fibres.', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.10 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.10', 'understand the conditions required for bacterial growth', 'understand the conditions required for bacterial growth', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.11 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.11', 'know that substances derived from plants can have antimicrobial and other therapeutic…', 'know that substances derived from plants can have antimicrobial and other therapeutic properties', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.12 — official Issue 2 Topic 4, Unit 2 (CORE PRACTICAL 9)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.12', 'CORE PRACTICAL 9 — Investigate the antimicrobial properties of plants, including…', 'CORE PRACTICAL 9
Investigate the antimicrobial properties of plants, including aseptic techniques for the safe handling of bacteria.', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.13 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.13', 'understand the development of drug testing from historic to contemporary protocols,…', 'understand the development of drug testing from historic to contemporary protocols, including William Withering’s digitalis soup, double blind trials, placebo and three-phased testing', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.14 — official Issue 2 Topic 4, Unit 2 (sub-points (i)(ii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.14', '(i) understand that classification is a means of organising the variety of life based…', '(i) understand that classification is a means of organising the variety of life based on relationships between organisms using differences and similarities in phenotypes and in genotypes, and is built around the species concept
(ii) understand the process and importance of critical evaluation of new data by the scientific community leading to new taxonomic groupings, based on molecular evidence, including the three-domain system (Archaea, Bacteria and Eukarya)', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.15 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.15', 'know that, over time, the variety of life has become extensive but is now being…', 'know that, over time, the variety of life has become extensive but is now being threatened by human activity', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.16 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.16', 'understand what is meant by the terms biodiversity and endemism', 'understand what is meant by the terms biodiversity and endemism', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.17 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.17', 'know how biodiversity can be measured within a habitat using species richness, and…', 'know how biodiversity can be measured within a habitat using species richness, and within a species using genetic diversity by calculating the heterozygosity index:
heterozygosity index = (number of heterozygotes)/(number of individuals in the population)', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.18 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.18', 'understand how biodiversity can be compared in different habitats using the formula to…', 'understand how biodiversity can be compared in different habitats using the formula to calculate an index of diversity (D):
D = (N(N-1))/(Σn(n-1))', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.19 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.19', 'understand the concept of niche and be able to discuss examples of adaptations of…', 'understand the concept of niche and be able to discuss examples of adaptations of organisms to their environment (behavioural, anatomical and physiological)', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.20 — official Issue 2 Topic 4, Unit 2 (sub-points (i)(ii)(iii))
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.20', '(i) understand how the Hardy-Weinberg equation can be used to see whether a change in…', '(i) understand how the Hardy-Weinberg equation can be used to see whether a change in allele frequency is occurring in a population over time
(ii) understand that changes in allele frequency can come about as a result of mutation and natural selection
(iii) understand that reproductive isolation can lead to accumulation of different genetic information in populations, potentially leading to the formation of new species', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.21 — official Issue 2 Topic 4, Unit 2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.21', 'be able to evaluate the methods used by zoos and seed banks in the conservation of…', 'be able to evaluate the methods used by zoos and seed banks in the conservation of endangered species and their genetic diversity, including scientific research, captive breeding programmes, reintroduction programmes and education', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-biology'
WHERE t.slug = 'topic-4-plant-structure-and-function-biodiversity-and-conservation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- ── Self-verification: abort the transaction on ANY drift ───────────────────
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
   WHERE c.slug = 'edexcel-ial-as-biology';
  SELECT count(*) INTO orphan_topics FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology' AND t.unit_id IS NULL;
  SELECT count(*) INTO u1_topics FROM topics t
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology' AND u.slug = 'unit-1';
  SELECT count(*) INTO u2_topics FROM topics t
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology' AND u.slug = 'unit-2';
  SELECT count(*) INTO u3_rows FROM topics t
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology' AND u.slug = 'unit-3';
  SELECT count(*) INTO point_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology';
  SELECT count(*) INTO u1_points FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology' AND u.slug = 'unit-1';
  SELECT count(*) INTO u2_points FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology' AND u.slug = 'unit-2';
  SELECT count(*) INTO cp_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology' AND p.description LIKE 'CORE PRACTICAL %';
  SELECT count(*) INTO a2_rows FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-a2-biology';
  IF topic_count <> 4 OR orphan_topics <> 0 THEN
    RAISE EXCEPTION '012 aborted: % topics (% without unit_id), expected 4 all unit-linked — are units unit-1/unit-2 present on edexcel-ial-as-biology?', topic_count, orphan_topics;
  END IF;
  IF u1_topics <> 2 OR u2_topics <> 2 OR u3_rows <> 0 THEN
    RAISE EXCEPTION '012 aborted: topics per unit %/%/% (unit-1/unit-2/unit-3), expected 2/2/0 — Unit 3 defines no syllabus content', u1_topics, u2_topics, u3_rows;
  END IF;
  IF point_count <> 80 THEN
    RAISE EXCEPTION '012 aborted: % spec points, expected 80', point_count;
  END IF;
  IF u1_points <> 38 OR u2_points <> 42 THEN
    RAISE EXCEPTION '012 aborted: points per unit %/% (unit-1/unit-2), expected 38/42', u1_points, u2_points;
  END IF;
  IF cp_count <> 9 THEN
    RAISE EXCEPTION '012 aborted: % core-practical statements, expected 9', cp_count;
  END IF;
  IF a2_rows <> 0 THEN
    RAISE EXCEPTION '012 aborted: A2 Biology holds % topics — this AS seed must not run against a drifted A2 course', a2_rows;
  END IF;
END $$;

COMMIT;
-- END OF 012 — 4 topics (Units 1-2), 80 points, Unit 3 intentionally empty. If this line is missing, the paste was truncated.
