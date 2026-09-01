-- ============================================================================
-- AILEMY — EDEXCEL IAL AS CHEMISTRY SPECIFICATION (topics 1-10, 155 spec points)
-- ⚠ APPLIED 2026-09-01 via service-role PostgREST upserts (this file is the
--   same-day record of that hand-application, per the migrations-folder rule).
--
-- PROVENANCE — nothing here is invented:
--   Every topic number, topic name, spec code, statement and command word is
--   EXTRACTED from Ailemy's own AS lesson deck library
--   (~/Desktop/Ailemy/Updated lessons/International Edexcel/Chemistry/AS,
--   82 decks, L1-L82): the per-lesson OUTCOMES slides (several of which state
--   "Quoted verbatim from the Pearson Edexcel International Advanced
--   Subsidiary Chemistry specification"), SPEC MAP slides, and CAN-DO
--   checklist slides. Titles are trims of the same extracted text. Rows stay
--   status='draft' with verified_at NULL until checked against the official
--   Pearson specification document, which is NOT in the repository.
--
-- ⚠ THIS FILE ALSO CORRECTS TOPIC 1. 001_catalogue_seed.sql's 13 draft points
--   (1.1-1.13) used an authored numbering that DISAGREES with the deck
--   library, the practice families (src/lib/practice/families/*.ts) and the
--   lesson_spec_points links, which all follow the deck numbering — e.g. the
--   seed had 1.5 "Empirical formulae" where every evidence row for 1.5 is
--   solution-concentration practice. Points are keyed by (topic_id, code), so
--   the UPSERT below rewrites the 12 real codes' text in place (links and
--   practice evidence keep pointing at the right rows) and 1.13 — which
--   exists in NO deck, family, link or evidence row — is archived, not
--   deleted.
--
-- KNOWN GAPS (deck present but slide text not machine-extractable, or code
-- referenced only as a pointer): 10.14 (Core Practical 6, deck L73). See the
-- data-quality audit in scripts/db-checks/.
--
-- Idempotent: topics ON CONFLICT (course_id, slug) DO NOTHING (+ 2 renames);
-- spec points ON CONFLICT (topic_id, code) DO UPDATE.
-- ============================================================================

BEGIN;

-- Topic renames to the deck library's own labels (slug and code unchanged)
UPDATE topics SET name = 'Formulae, Equations and Amount of Substance'
 WHERE slug = 'formulae-equations-amounts'
   AND course_id = (SELECT id FROM courses WHERE slug = 'edexcel-ial-as-chemistry');
UPDATE topics SET name = 'Introductory Organic Chemistry and Alkanes'
 WHERE slug = 'intro-organic-hydrocarbons'
   AND course_id = (SELECT id FROM courses WHERE slug = 'edexcel-ial-as-chemistry');

INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, 'alkenes', 'Topic 5', 'Alkenes', 'coming_soon', 5
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-1'
WHERE c.slug = 'edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, 'energetics', 'Topic 6', 'Energetics', 'coming_soon', 6
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-2'
WHERE c.slug = 'edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, 'intermolecular-forces', 'Topic 7', 'Intermolecular Forces', 'coming_soon', 7
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-2'
WHERE c.slug = 'edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, 'redox-groups-1-2-7', 'Topic 8', 'Redox Chemistry and Groups 1, 2 and 7', 'coming_soon', 8
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-2'
WHERE c.slug = 'edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, 'kinetics-equilibria-intro', 'Topic 9', 'Introduction to Kinetics and Equilibria', 'coming_soon', 9
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-2'
WHERE c.slug = 'edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, u.id, 'halogenoalkanes-alcohols-spectra', 'Topic 10', 'Halogenoalkanes, Alcohols and Spectra', 'coming_soon', 10
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-2'
WHERE c.slug = 'edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- ── Spec points (upsert by (topic_id, code)) ────────────────────────────────

-- 1.1 — from deck(s) L1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.1', '‘Atom’, ‘element’, ‘ion’, ‘molecule’, ‘compound’, formulae', '‘atom’, ‘element’, ‘ion’, ‘molecule’, ‘compound’, ‘empirical formula’ ‘molecular formula’', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.2 — from deck(s) L1
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.2', 'The mole and the Avogadro constant', 'the mole (mol) is the unit for the amount of a substance perform calculations using the Avogadro constant L', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.3 — from deck(s) L2
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.3', 'Full and ionic equations', 'full and ionic equations, including state symbols, for chemical reactions', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.4 — from deck(s) L3
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.4', 'Relative atomic mass and relative isotopic mass', 'relative atomic mass and relative isotopic mass, based on the ¹²C scale relative molecular mass and relative formula mass calculate molar mass M (g mol⁻¹) and express small concentrations using parts per million (ppm).', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.5 — from deck(s) L4
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.5', 'Concentration of a solution in mol dm⁻³ and g dm⁻³', 'concentration of a solution in mol dm⁻³ and g dm⁻³ — calculate concentration in mol dm⁻³ and g dm⁻³, prepare standard solutions, and apply c₁V₁ = c₂V₂ for dilutions. Note: titration calculations are not required at this stage.', ARRAY['apply'], 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.6 — from deck(s) L5
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.6', 'Empirical formula and molecular formula', 'I can define empirical formula (simplest whole-number ratio) and molecular formula (actual count per molecule).', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.7 — from deck(s) L6
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.7', 'Reacting-mass calculations from equations', 'calculate reacting masses and vice versa, using the concepts of amount of substance and molar mass read mole ratios from balanced equations, apply the four-step bridge (m → n → ratio → n → m) to forward AND reverse problems, and use these calculations on industrial-scale reactions such as combustion, decomposition and metal extraction.', ARRAY['apply'], 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.8 — from deck(s) L7
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.8', 'Gas volumes, molar volume and pV = nRT', 'use chemical equations to calculate volumes of gases and vice versa the molar volume of gases and the expression pV = nRT for gases and volatile liquids amount of substance · molar volume Vₘ at RTP · ideal gas equation pV = nRT', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.9 — from deck(s) L8
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.9', 'Percentage yield and atom economy', 'percentage yields and atom economies Percentage yield = how much of the predicted product was actually obtained, expressed as a %. Atom economy = the proportion of starting atoms that end up in the desired product (by mass). Two definitions — keep them distinct. % yield = (actual mass ÷ theoretical mass) × 100 Atom economy = (Mᵣ of useful products ÷ sum of Mᵣ of all products) × 100. Both formulas multiply by 100 — both are percentages. Compare two industrial routes that give the same product. The greener route is the one with higher atom economy — less waste at source. Apply this to industrial processes.', ARRAY['define','calculate','apply'], 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.10 — from deck(s) L9
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.10', 'Determine a formula or confirm an equation by experiment', 'determine a formula or confirm an equation by experiment, including evaluation of the data', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.11 — from deck(s) L9
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.11', 'Core Practical 1: measurement of the molar volume of a gas', 'CORE PRACTICAL 1 measurement of the molar volume of a gas', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.12 — from deck(s) L2,9
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.12', 'Relate ionic and full equations to test-tube observations', 'relate ionic and full equations, with state symbols, to observations from simple test-tube experiments displacement reactions · typical reactions of acids · precipitation reactions', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.1 — from deck(s) L10
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.1', 'The structure of an atom', 'the structure of an atom in terms of electrons, protons and neutrons; the relative mass and charge of each; what is meant by atomic (proton) number and mass number; and how to use these to determine the number of each subatomic particle in any atom or ion', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.2 — from deck(s) L10
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.2', 'The structure of an atom', 'the structure of an atom in terms of electrons, protons and neutrons; the relative mass and charge of each; what is meant by atomic (proton) number and mass number; and how to use these to determine the number of each subatomic particle in any atom or ion', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.3 — from deck(s) L10
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.3', 'The structure of an atom', 'the structure of an atom in terms of electrons, protons and neutrons; the relative mass and charge of each; what is meant by atomic (proton) number and mass number; and how to use these to determine the number of each subatomic particle in any atom or ion', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.4 — from deck(s) L10
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.4', 'The structure of an atom', 'the structure of an atom in terms of electrons, protons and neutrons; the relative mass and charge of each; what is meant by atomic (proton) number and mass number; and how to use these to determine the number of each subatomic particle in any atom or ion', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.5 — from deck(s) L10
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.5', 'The term isotope', 'the term isotope: atoms of the same element with the same number of protons but different numbers of neutrons chlorine isotopes · ions (cations and anions) · the ²⁴₁₂Mg notation', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.6 — from deck(s) L11,12
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.6', 'Mass spectrometry and isotopic composition', 'mass spectrometer and analyse mass spectra to deduce the isotopic composition of a sample ions in a mass spectrometer may carry a 2+ charge an extra peak at half the expected m/z value analyse and interpret mass spectra to: determine the relative molecular mass of a molecule and identify molecules; understand that ions in a mass spectrometer may have a 2+ charge', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.7 — from deck(s) L12
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.7', 'Predict mass spectra of diatomic molecules', 'predict mass spectra, including relative peak heights, for diatomic molecules, including chlorine, given the isotopic abundances identifying molecules from M⁺ · 2+ ion m/z · Cl₂ and Br₂ peak ratios', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.8 — from deck(s) L13
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.8', 'Ionisation energies: nuclear charge, shielding, sub-shell', 'that all ionisation energies are endothermic. Understand how IEs are influenced by nuclear charge, electron shielding, and the sub-shell the electron is removed from.', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.9 — from deck(s) L14
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.9', 'Orbitals and sub-shell filling', 'can hold up to two electrons with opposite spins', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.10 — from deck(s) L13
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.10', 'Ionisation energies are endothermic; influencing factors', 'that all ionisation energies are endothermic. Understand how IEs are influenced by nuclear charge, electron shielding, and the sub-shell the electron is removed from.', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.11 — from deck(s) L13
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.11', 'Successive ionisation energies as evidence for quantum shells', 'successive ionisation energies as evidence for quantum shells and the group of an element 1st ionisation energies across a period as evidence for sub-shells', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.12 — from deck(s) L14
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.12', 'Orbitals in sub-shells: filling and pairing', 'know that orbitals in sub-shells i each take a single electron before pairing up; ii pair up with two electrons of opposite spin', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.13 — from deck(s) L14
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.13', 'Orbitals in sub-shells: filling and pairing', 'know that orbitals in sub-shells i each take a single electron before pairing up; ii pair up with two electrons of opposite spin', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.14 — from deck(s) L15
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.14', 'Electronic configurations, H to Kr, in s p d and electron-in-boxes notation', 'predict the electronic configuration of atoms of the elements from hydrogen to krypton inclusive and their ions, using s, p, d notation and electron-in-boxes notation', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.15 — from deck(s) L15
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.15', 'Electronic configuration and chemical properties', 'electronic configuration determines the chemical properties of an element know the electron capacities of s, p and d sub-shells in the first four quantum shells', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.16 — from deck(s) L15
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.16', 'Electronic configuration and chemical properties', 'electronic configuration determines the chemical properties of an element know the electron capacities of s, p and d sub-shells in the first four quantum shells', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.17 — from deck(s) L16
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.17', 'Graphical data for elements 1–36; the terms periodicity and period', 'represent data, in a graphical form (including the use of logarithms of first ionisation energies on a graph) for elements 1 to 36 and hence explain the meaning of the term periodic property', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.18 — from deck(s) L16,17
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.18', 'Trends in melting/boiling temperatures and ionisation energy, Periods 2 and 3', 'explain (i) the trends in melting and boiling temperatures of Periods 2 and 3 in terms of structure and bonding the general increase and specific trends in IE across Periods 2 and 3 · (iii) the decrease in 1st IE down a group the trends in melting and boiling temperatures of the elements of Periods 2 and 3 of the Periodic Table in terms of the structure of the element and the bonding between its atoms or molecules any Period 2 or 3 element by its structure type and explain its melting temperature metallic structures · giant covalent networks · simple molecular substances', ARRAY['apply'], 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.1 — from deck(s) L18
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.1', 'Formation of ions by loss or gain of electrons', 'describe the formation of ions in terms of loss or gain of electrons', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.2 — from deck(s) L18
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.2', 'Dot-and-cross diagrams for cations and anions', 'loss or gain of electrons; draw dot-and-cross diagrams to show electrons in cations and anions', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.3 — from deck(s) L18
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.3', 'Dot-and-cross diagrams for cations and anions', 'loss or gain of electrons; draw dot-and-cross diagrams to show electrons in cations and anions', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.4 — from deck(s) L18
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.4', 'Giant lattices of ions', 'giant lattices of ions; know that ionic bonding is the result of strong net electrostatic attraction physical properties · electron density maps · migration of ions (3.1)', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.5 — from deck(s) L18
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.5', 'Giant lattices of ions', 'giant lattices of ions; know that ionic bonding is the result of strong net electrostatic attraction physical properties · electron density maps · migration of ions (3.1)', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.6 — from deck(s) L19
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.6', 'The effects of ionic radius and ionic charge on the strength of ionic bonding', 'the effects of ionic radius and ionic charge on the strength of ionic bonding', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.7 — from deck(s) L19
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.7', 'The effects of ionic radius and ionic charge on the strength of ionic bonding', 'the effects of ionic radius and ionic charge on the strength of ionic bonding', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.8 — from deck(s) L19
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.8', 'Polarisation of ions', 'the meaning of the term ''polarisation'' as applied to ions polarising power of a cation depends on its radius and charge, and the polarisability of an anion also depends on its radius and charge', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.9 — from deck(s) L19
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.9', 'Polarisation of ions', 'the meaning of the term ''polarisation'' as applied to ions polarising power of a cation depends on its radius and charge, and the polarisability of an anion also depends on its radius and charge', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.10 — from deck(s) L20
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.10', 'Covalent bonding: nuclei and a shared pair of electrons', 'covalent bonding is the strong electrostatic attraction between two nuclei and the shared pair of electrons between them', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.11 — from deck(s) L20
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.11', 'Dot-and-cross diagrams for covalent substances', 'draw dot-and-cross diagrams to show electrons in covalent substances molecules with single, double and triple bonds · species with dative covalent (coordinate) bonds, including Al₂Cl₆ and the ammonium ion NH₄⁺', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.12 — from deck(s) L21
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.12', 'Giant lattices of carbon: diamond, graphite, graphene', 'describe the different structures formed by giant lattices of carbon atoms, including graphite, diamond and graphene discuss the applications of each diamond · graphite · graphene', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.13 — from deck(s) L22
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.13', 'Electronegativity in a covalent bond', '‘electronegativity’ as applied to atoms in a covalent bond', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.14 — from deck(s) L22
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.14', 'Ionic and covalent bonding are the extremes of a continuum of bonding type', 'know that ionic and covalent bonding are the extremes of a continuum of bonding type distinguish polar bonds from polar molecules · predict whether a molecule is polar', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.15 — from deck(s) L22
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.15', 'Ionic and covalent bonding are the extremes of a continuum of bonding type', 'know that ionic and covalent bonding are the extremes of a continuum of bonding type distinguish polar bonds from polar molecules · predict whether a molecule is polar', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.16 — from deck(s) L23
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.16', 'Electron-pair repulsion theory', 'understand the principles of the electron-pair repulsion theory, used to interpret and predict the shapes of simple molecules and ions', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.17 — from deck(s) L23,24
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.17', 'Bond length and bond angle', 'understand the terms ''bond length'' and ''bond angle''; know and explain the shapes of, and bond angles in, BeCl₂, BCl₃, CH₄, NH₃, NH₄⁺, H₂O, CO₂, gaseous PCl₅, SF₆ and C₂H₄', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.18 — from deck(s) L23,24
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.18', 'Shapes and bond angles: BeCl₂, BCl₃, CH₄, NH₃, NH₄⁺, H₂O, CO₂, PCl₅, SF₆, C₂H₄', 'know and be able to explain the shapes of, and bond angles in, BeCl₂, BCl₃, CH₄, NH₃, NH₄⁺, H₂O, CO₂, gaseous PCl₅, SF₆ and C₂H₄ understand the terms ‘bond length’ and ‘bond angle’ understand the terms ''bond length'' and ''bond angle''; know and explain the shapes of, and bond angles in, BeCl₂, BCl₃, CH₄, NH₃, NH₄⁺, H₂O, CO₂, gaseous PCl₅, SF₆ and C₂H₄', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.19 — from deck(s) L24
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.19', 'Shapes of molecules and ions analogous to those in 3.18', 'molecules and ions analogous to those in 3.18 count pairs first · spread for repulsion · apply lone-pair squeeze', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.20 — from deck(s) L25
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.20', 'Metallic bonding: lattice of ions in a sea of delocalised electrons', 'giant lattices of metal ions in a sea of delocalised electrons strong electrostatic attraction between metal ions and the delocalised electrons electrical conductivity · high melting temperature', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.21 — from deck(s) L25
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.21', 'Metallic bonding model: conductivity and melting temperature', 'use the model to interpret electrical conductivity and high melting temperature conductivity, MP, malleability, lustre', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.22 — from deck(s) L25
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.22', 'Metallic bonding model: conductivity and melting temperature', 'use the model to interpret electrical conductivity and high melting temperature conductivity, MP, malleability, lustre', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.1 — from deck(s) L26
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.1', 'The terms hazard and risk', 'I can define the terms hazard and risk in one sentence each.', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.2 — from deck(s) L26
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.2', 'GHS hazard pictograms of common organic compounds', 'I can read GHS pictograms and identify the main hazards of common organic compounds.', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.3 — from deck(s) L26
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.3', 'How risks are reduced', 'I can describe how risks are reduced (smaller scale / specific precautions / alternative method).', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.4 — from deck(s) L26
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.4', 'Homologous series and functional groups', 'I can define a homologous series and a functional group, and explain why members react similarly. I can apply the alkane general formula CₙH₂ₙ₊₂ and predict trends in physical properties.', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.5 — from deck(s) L27
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.5', 'IUPAC naming; structural, displayed and skeletal formulae', 'name compounds and draw them as structural, displayed and skeletal formulae (up to C₁₀)', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.6 — from deck(s) L27
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.6', 'Classify reactions: addition, substitution, oxidation, reduction, polymerisation', 'classify reactions as addition, substitution, oxidation, reduction or polymerisation homolytic vs heterolytic bond breaking · define free radical and electrophile', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.7 — from deck(s) L27
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.7', 'Homolytic and heterolytic bond breaking', 'I can identify the bond breaking type as homolytic or heterolytic and justify it.', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.8 — from deck(s) L27
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.8', 'Free radicals and electrophiles', 'I can define a free radical and an electrophile and recognise examples.', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.9 — from deck(s) L28,29
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.9', 'Alkanes and cycloalkanes: saturated hydrocarbons', 'alkanes and cycloalkanes, and understand that they are hydrocarbons (compounds of carbon and hydrogen only) which are saturated (contain single bonds only) draw the structural isomers of organic molecules, given their molecular formula be able to draw and name the structural isomers of alkanes and cycloalkanes with up to six carbon atoms alkanes (CₙH₂ₙ₊₂) and cycloalkanes (CₙH₂ₙ); draw and name structural isomers up to six carbons', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.10 — from deck(s) L28,29
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.10', 'Alkanes (CₙH₂ₙ₊₂) and cycloalkanes (CₙH₂ₙ)', 'alkanes (CₙH₂ₙ₊₂) and cycloalkanes (CₙH₂ₙ); draw and name structural isomers up to six carbons', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.11 — from deck(s) L28,29
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.11', 'Alkanes (CₙH₂ₙ₊₂) and cycloalkanes (CₙH₂ₙ)', 'alkanes (CₙH₂ₙ₊₂) and cycloalkanes (CₙH₂ₙ); draw and name structural isomers up to six carbons', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.12 — from deck(s) L29
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.12', 'Fuels from fractional distillation, cracking and reforming of crude oil', 'used as fuels and obtained from the fractional distillation, cracking and reforming of crude oil write equations for these reactions', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.13 — from deck(s) L30
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.13', 'Pollutants from combustion of alkane fuels', 'pollutants — CO, oxides of N and S, particulates and unburned hydrocarbons — are emitted during combustion of alkane fuels, and the problems they cause: CO toxicity and the acidity of NOₓ and SOₓ', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.14 — from deck(s) L30
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.14', 'Pollutants from combustion of alkane fuels', 'pollutants — CO, oxides of N and S, particulates and unburned hydrocarbons — are emitted during combustion of alkane fuels, and the problems they cause: CO toxicity and the acidity of NOₓ and SOₓ', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.15 — from deck(s) L30
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.15', 'Reasons for developing alternative fuels', 'discuss reasons for developing alternative fuels in terms of sustainability and reducing emissions, including the emission of CO₂ and its relationship to climate change petrol · bioethanol · hydrogen', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.16 — from deck(s) L30
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.16', 'Reasons for developing alternative fuels', 'discuss reasons for developing alternative fuels in terms of sustainability and reducing emissions, including the emission of CO₂ and its relationship to climate change petrol · bioethanol · hydrogen', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.17 — from deck(s) L31
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.17', 'Reactions of alkanes with oxygen and halogens', 'reactions of alkanes with: i. oxygen in the air (combustion) ii. halogens', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.18 — from deck(s) L31
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.18', 'Mechanism of free radical substitution', 'mechanism of the free radical substitution reaction between an alkane and a halogen free radicals (unpaired electron, single dot) · initiation with curly half-arrows · propagation and termination steps · limited use in synthesis', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.1 — from deck(s) L32
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.1', 'General formulae of alkenes and cycloalkenes; σ and π bonds in C=C', 'general formula of alkenes hydrocarbons which are unsaturated CₙH₂ₙ to alkenes and CₙH₂ₙ₋₂ to cycloalkenes σ bond and π bond in a C=C from a structural diagram', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.2 — from deck(s) L33
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.2', 'Structural isomerism and stereoisomerism', 'Understand the terms structural isomerism (chain, position, functional group) and stereoisomerism.', ARRAY['describe'], 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.3 — from deck(s) L33
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.3', 'E/Z (cis/trans) isomerism in alkenes and CIP priority rules', 'Understand E/Z (cis/trans) isomerism in alkenes due to restricted rotation about C=C, and the rules for assigning E and Z using Cahn–Ingold–Prelog (CIP) priorities. Decide whether a molecule can show E/Z isomerism, assign CIP priorities to substituents, and correctly name the isomer E or Z.', ARRAY['explain','apply'], 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.4 — from deck(s) L34
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.4', 'Reactions of alkenes', 'hydrogen, halogens, hydrogen halides, steam (in the presence of an acid catalyst), and potassium manganate(VII) — KMnO₄', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.5 — from deck(s) L34
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.5', 'Bromine water and KMnO₄ tests for the C=C bond', 'bromine water and KMnO₄ to distinguish between alkanes and alkenes orange → colourless (Br₂) · purple → colourless (KMnO₄)', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.6 — from deck(s) L35
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.6', 'Electrophilic addition of bromine and hydrogen bromide to ethene', 'bromine and hydrogen bromide to ethene electrophilic addition of hydrogen bromide to propene curly arrow notation · primary, secondary, tertiary carbocation stability', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.7 — from deck(s) L36
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.7', 'Addition polymerisation of alkenes', 'the addition polymerisation of alkenes — n monomers join end-to-end as the C=C π-bond opens draw the repeat unit given the monomer, and vice versa — work in both directions ethene · propene · chloroethene · phenylethene', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.8 — from deck(s) L37
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.8', 'Polymer disposal: biodegradable polymers and waste-gas scrubbing', 'developing biodegradable polymers removing toxic waste gases produced by the incineration of polymers limestone/lime scrubbers · alkaline scrubbers · catalytic conversion', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.1 — from deck(s) L38
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.1', 'Enthalpy change ΔH and standard conditions', 'the enthalpy change, ∆H, is the heat energy change measured at constant pressure, and that standard conditions are 100 kPa and a specified temperature, usually 298 K; and that exothermic reactions have a negative ∆H and endothermic reactions have a positive ∆H', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.2 — from deck(s) L38
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.2', 'Enthalpy change ΔH and standard conditions', 'the enthalpy change, ∆H, is the heat energy change measured at constant pressure, and that standard conditions are 100 kPa and a specified temperature, usually 298 K; and that exothermic reactions have a negative ∆H and endothermic reactions have a positive ∆H', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.3 — from deck(s) L38
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.3', 'Enthalpy level diagrams and standard enthalpy changes', 'construct and interpret enthalpy level diagrams standard enthalpy of reaction (∆rH⦵), formation (∆fH⦵), combustion (∆cH⦵), neutralisation (∆neutH⦵), atomisation (∆atH⦵)', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.4 — from deck(s) L38
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.4', 'Enthalpy level diagrams and standard enthalpy changes', 'construct and interpret enthalpy level diagrams standard enthalpy of reaction (∆rH⦵), formation (∆fH⦵), combustion (∆cH⦵), neutralisation (∆neutH⦵), atomisation (∆atH⦵)', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.5 — from deck(s) L39
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.5', 'Calculate the enthalpy change of a reaction from experimental data', 'be able to calculate the enthalpy change of a reaction from experimental data, including use of the relationship q = m c ΔT', ARRAY['describe','apply'], 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.6 — from deck(s) L40
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.6', 'Hess''s Law and energy cycles', 'the principle and its conditions ΔrH using ΔfH or ΔcH data the right cycle to a given question', ARRAY['describe','calculate','apply'], 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.7 — from deck(s) L41,42
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.7', 'Core Practical 2: enthalpy change of a reaction using Hess''s Law', 'Determination of the enthalpy change of a reaction using Hess''s Law Core Practical 2 — determination of the enthalpy change of a reaction using Hess’s Law', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.8 — from deck(s) L41,42
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.8', 'Evaluate experimental results: error, uncertainty, assumptions', 'evaluate the results obtained from experiments and comment on sources of error and uncertainty and any assumptions made in the experiments insulated-container experiments · cooling-curve corrections be able to evaluate the results obtained from experiments and comment on sources of error and uncertainty and any assumptions made in the experiments · mixed-substance experiments in an insulated container · combustion experiments using a spirit burner · drawing suitable graphs and using cooling-curve corrections WORDING Quoted verbatim from the Pearson Edexcel International Advanced Subsidiary Chemistry specification.', ARRAY['evaluate'], 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.9 — from deck(s) L43
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.9', 'Bond enthalpy and mean bond enthalpy', 'bond enthalpy and mean bond enthalpy, and use bond enthalpies to calculate enthalpy changes', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.10 — from deck(s) L43
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.10', 'Calculate mean bond enthalpies from enthalpy changes of reaction', 'calculate mean bond enthalpies from enthalpy changes of reaction using ΔH of reaction and the other known bond enthalpies, then rearrange to solve', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.11 — from deck(s) L44
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.11', 'Bond enthalpy data and which bond breaks first', 'bond enthalpy data gives some indication about which bond will break first in a reaction easy or difficult it is and therefore how rapidly a reaction will take place at room temperature describe · predict · explain', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.1 — from deck(s) L45
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.1', 'London forces, permanent dipole–dipole interactions and hydrogen bonds', 'i. London forces (instantaneous dipole-induced dipole) · ii. permanent dipole-permanent dipole interactions · iii. hydrogen bonds', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.2 — from deck(s) L45
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.2', 'Hydrogen bonding in H₂O, liquid NH₃ and liquid HF', 'interactions in molecules, such as H₂O, liquid NH₃ and liquid HF hydrogen bonding', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.3 — from deck(s) L46
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.3', 'Anomalous properties of water', 'Explain why H₂O''s boiling temperature is anomalously high compared with other Group 6 hydrides. Describe the structure of ice and how hydrogen bonding creates an open tetrahedral lattice. Justify why ice is less dense than liquid water.', ARRAY['explain','describe','justify'], 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.4 — from deck(s) L46
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.4', 'Predicting hydrogen bonding', 'Apply the two-condition rule to predict whether a new molecule forms hydrogen bonds. Identify the H-bond donors (H–N, H–O, H–F) and acceptors (lone pair on N/O/F) in a molecule.', ARRAY['apply','identify'], 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.5 — from deck(s) L47
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.5', 'Boiling temperatures: chain length, branching and alcohols vs alkanes', 'boiling temperatures of alkanes with increasing chain length and the effect of branching in the carbon chain the relatively low volatility (higher boiling temperatures) of alcohols compared to alkanes with a similar number of electrons the trends in boiling temperatures of the hydrogen halides HF to HI', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.6 — from deck(s) L48
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.6', 'Solvents and dissolving: hydration and hydrogen bonding', '(i) water, to dissolve some ionic compounds, in terms of the hydration of the ions; (ii) water, to dissolve simple alcohols, in terms of hydrogen bonding (iv) non-aqueous solvents, for compounds that have similar intermolecular forces to those in the solvent', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.1 — from deck(s) L49
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.1', 'Rules for assigning oxidation numbers', 'understand the rules for assigning oxidation numbers; calculate ON in compounds and ions, including peroxides and metal hydrides', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.2 — from deck(s) L49
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.2', 'Rules for assigning oxidation numbers', 'understand the rules for assigning oxidation numbers; calculate ON in compounds and ions, including peroxides and metal hydrides', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.3 — from deck(s) L49
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.3', 'Indicate the oxidation number of an element in a compound or an ion', 'indicate the oxidation number of an element in a compound or an ion, using a Roman numeral; write formulae given oxidation numbers iron(III) chloride · manganate(VII) · dichromate(VI) · chromium(III) sulfate', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.4 — from deck(s) L49
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.4', 'Indicate the oxidation number of an element in a compound or an ion', 'indicate the oxidation number of an element in a compound or an ion, using a Roman numeral; write formulae given oxidation numbers iron(III) chloride · manganate(VII) · dichromate(VI) · chromium(III) sulfate', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.5 — from deck(s) L50
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.5', 'Oxidation and reduction as electron transfer', 'oxidation and reduction in terms of electron transfer and changes in oxidation number, and the application of these ideas to reactions of s-block and p-block elements', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.6 — from deck(s) L50
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.6', 'Oxidising and reducing agents', 'I can name oxidising and reducing agents in an equation.', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.7 — from deck(s) L50
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.7', 'Disproportionation', 'that a disproportionation reaction involves an element in a single species being simultaneously oxidised and reduced oxidising and reducing agents (8.6) · classification of reactions (8.8) · metal/non-metal redox trends (8.9)', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.8 — from deck(s) L50
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.8', 'Identifying redox from oxidation-number changes', 'I can use oxidation-number changes to identify redox.', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.9 — from deck(s) L50
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.9', 'Redox trends of s-block and p-block elements', 'I can describe metal/non-metal redox trends (s-block + p-block).', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.10 — from deck(s) L51
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.10', 'Ionic half-equations and full ionic equations', 'write ionic half-equations use them to construct full ionic equations balance atoms and charge using electrons · add H⁺ and H₂O in acidic half-equations · scale to match electrons before combining', ARRAY['apply'], 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.11 — from deck(s) L52
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.11', 'Trend in ionisation energy down Groups 1 and 2', 'trend in ionisation energy down Groups 1 and 2', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.12 — from deck(s) L52
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.12', 'Trend in reactivity down Group 1 and Group 2', 'trend in reactivity of the elements down Group 1 (Li to K) and Group 2 (Mg to Ba) use ionisation-energy data to explain reactivity differences within and between Group 1 and Group 2', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.13 — from deck(s) L53
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.13', 'Reactions of Group 1 and 2 elements with oxygen, chlorine and water', 'the elements of Group 1 (Li to K) and Group 2 (Mg to Ba) with oxygen these elements with chlorine and with water (incl. steam where required) oxides (& peroxides/superoxides for G1) · ionic chlorides · hydroxides + hydrogen', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.14 — from deck(s) L54
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.14', 'Reactions of Group 1 and 2 oxides and hydroxides', 'Know the reactions of: (i) oxides of Group 1 and 2 elements with water and dilute acid (ii) hydroxides of Group 1 and 2 elements with dilute acid', ARRAY['describe'], 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.15 — from deck(s) L54
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.15', 'Trends in solubility of Group 2 hydroxides and sulfates', 'Know the trends in solubility of: the hydroxides and sulfates of Group 2 elements. Predict products of reactions of Group 1/2 oxides and hydroxides with water and acids, write full and ionic equations with state symbols, and use solubility trends to identify Group 2 ions. composite — teacher-derived application Two related reaction families + one solubility trend. Each outcome maps to specific slides in this lesson.', ARRAY['describe','apply'], 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.16 — from deck(s) L55
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.16', 'Thermal stability of nitrates and carbonates', 'Thermal stability trend of Group 1/2 nitrates and carbonates; polarising power of small cations; gas tests: CO₂ + limewater, NO₂ by colour.', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.17 — from deck(s) L56
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.17', 'Formation of characteristic flame colours by Group 1 and 2 compounds', 'understand the formation of characteristic flame colours by Group 1 and 2 compounds in terms of electron transitions. Students will be expected to know the flame colours for Group 1 and 2 compounds.', ARRAY['explain'], 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.18 — from deck(s) L56
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.18', 'Experimental procedures for flame colours of Group 1 and 2 compounds', 'know experimental procedures to show flame colours in compounds of Group 1 and 2 elements.', ARRAY['know'], 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.19 — from deck(s) L57
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.19', 'Tests for carbonate, hydrogencarbonate and sulfate ions', 'carbonate ions (CO₃²⁻) and hydrogencarbonate ions (HCO₃⁻), using an aqueous acid to form carbon dioxide (and testing the gas with limewater) sulfate ions (SO₄²⁻) using acidified barium chloride solution ammonium ions (NH₄⁺) using sodium hydroxide solution and warming to form ammonia (testing with litmus and HCl fumes)', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.20 — from deck(s) L58
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.20', 'Solution concentrations and simple acid–base titrations', 'solution concentrations, in mol dm⁻³ and g dm⁻³ simple acid-base titrations using the indicators methyl orange and phenolphthalein apply n = c × V; choose the right indicator', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.21 — from deck(s) L59
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.21', 'Core Practical 3: finding the concentration of hydrochloric acid', 'Core Practical 3 · Finding the concentration of a solution of hydrochloric acid', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.22 — from deck(s) L59,60
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.22', 'How to minimise the sources of measurement uncertainty in volumetric analysis', 'understand how to minimise the sources of measurement uncertainty in volumetric analysis and estimate the overall uncertainty in the calculated result minimise the sources of measurement uncertainty in volumetric analysis and estimate the overall uncertainty in the calculated result', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.23 — from deck(s) L60
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.23', 'Core Practical 4: preparing a standard solution to find NaOH concentration', 'preparation of a standard solution from a solid acid and use it to find the concentration of a solution of sodium hydroxide Apparatus: balance, volumetric flask, pipette, burette, indicator (phenolphthalein)', NULL, 'draft', 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.24 — from deck(s) L61
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.24', 'Group 7 trends: melting/boiling temperatures, state, electronegativity, reactivity', 'trends for Group 7 elements in melting and boiling temperatures, physical state, electronegativity, and reactivity down the group', NULL, 'draft', 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.25 — from deck(s) L61
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.25', 'Reactivity of Group 7: redox with halide ions', 'reactivity of Group 7 elements in terms of the redox reactions of Cl₂, Br₂ and I₂ with halide ions in aqueous solution colours of the elements in standard conditions, in aqueous solution, and in a non-polar organic solvent', NULL, 'draft', 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.26 — from deck(s) L62
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.26', 'Halogens with metals; disproportionation of chlorine', 'the oxidation reactions of the halogens with Group 1 and Group 2 metals the disproportionation reactions of chlorine with water (for drinking water treatment) · with cold dilute NaOH (to form bleach) · with hot concentrated NaOH', NULL, 'draft', 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.27 — from deck(s) L63
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.27', 'Group 1 halides with concentrated sulfuric acid; halide tests', 'solid Group 1 halides with concentrated sulfuric acid, to illustrate the trend in reducing ability of the hydrogen halides; precipitation reactions of the aqueous anions Cl⁻, Br⁻ and I⁻ with aqueous silver nitrate solution and nitric acid, and the solubility of the precipitates in aqueous ammonia solution; hydrogen halides with ammonia gas (to produce ammonium halides) and with water (to produce acids)', NULL, 'draft', 27
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.28 — from deck(s) L63
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.28', 'Predictions about fluorine and astatine', 'make predictions about fluorine and astatine and their compounds, in terms of knowledge of trends in halogen chemistry F is too reactive and too poor a reducer to follow the HX → H₂SO₄ pattern · AgF is soluble · HAt would be a very strong reducer; AgAt darkest of all', NULL, 'draft', 28
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.1 — from deck(s) L64
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.1', 'Collision theory: concentration, temperature, pressure, surface area', 'understand, in terms of the collision theory, the effect of changes in concentration, temperature, pressure and surface area on the rate of a chemical reaction', ARRAY['describe'], 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.2 — from deck(s) L64
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.2', 'Activation energy', 'understand that reactions take place only when collisions have sufficient energy, known as the activation energy', ARRAY['explain'], 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.3 — from deck(s) L64
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.3', 'Calculate the rate of a reaction', 'be able to calculate the rate of a reaction from: (i) the time taken for a reaction, using rate = 1/time (ii) the gradient of suitable graph, by drawing a tangent, either for initial rate, or at a time, t Quoted verbatim from the Pearson Edexcel International AS Chemistry specification.', ARRAY['calculate'], 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.4 — from deck(s) L65
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.4', 'Maxwell–Boltzmann distribution and the effect of temperature on rate', 'understand qualitatively, in terms of the Maxwell–Boltzmann distribution of molecular energies, how changes in temperature affect the rate of a reaction.', ARRAY['describe'], 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.5 — from deck(s) L65
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.5', 'Catalysts: alternative routes of lower activation energy', 'understand the role of catalysts in providing alternative reaction routes of lower activation energy.', ARRAY['explain'], 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.6 — from deck(s) L65
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.6', 'Reaction profiles for uncatalysed and catalysed reactions', 'draw the reaction profiles for uncatalysed and catalysed reactions, including the energy level of the intermediate formed with the catalyst.', ARRAY['draw'], 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.7 — from deck(s) L65
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.7', 'Catalysts in industry and sustainability', 'understand the use of catalysts in industry to make processes more sustainable by using less energy and/or higher atom economy.', ARRAY['apply'], 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.8 — from deck(s) L65
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.8', 'Catalyst action and the Maxwell–Boltzmann distribution', 'interpret the action of a catalyst in terms of a qualitative understanding of the Maxwell–Boltzmann distribution of molecular energies.', ARRAY['interpret'], 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.9 — from deck(s) L66
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.9', 'Dynamic equilibrium', 'I can define dynamic equilibrium using BOTH conditions: equal rates and constant concentrations. I can explain why equilibrium requires a closed system. I can read a concentration–time or rate–time graph and identify when equilibrium has been reached.', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.10 — from deck(s) L66
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.10', 'Apply Le Chatelier’s principle to gas-phase and aqueous equilibria', 'apply Le Chatelier’s principle to gas-phase and aqueous equilibria, recognise the limits of qualitative prediction, and explain why catalysts speed up the approach to equilibrium without shifting its position. By the end of this lesson, you can state, predict and justify — using the language Pearson examiners expect.', ARRAY['apply'], 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 9.11 — from deck(s) L67
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '9.11', 'Compromise between yield and rate in industrial processes', 'Evaluate data to explain the necessity, for many industrial processes, to reach a compromise between the yield and the rate of reaction. given a yield-vs-condition data set, explain why the chosen industrial conditions sit where they do. State and justify the conditions used in the Haber process, Contact process and the catalytic hydration of ethene. for each: temperature, pressure, catalyst — why each was chosen, and the trade-off it makes. For an unfamiliar exothermic gas-phase equilibrium, predict the optimum industrial conditions and justify them. use ΔH sign and Δn(gas) to argue from first principles, even for an equilibrium you''ve never seen.', ARRAY['evaluate','describe','apply'], 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.1 — from deck(s) L68
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.1', 'Classify organic reactions into the seven families', '(including those in Unit 1) as addition, elimination, substitution, oxidation, reduction, hydrolysis or polymerisation', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.2 — from deck(s) L68
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.2', 'What a reaction mechanism is', 'I can explain what a reaction mechanism is and why we draw one.', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.3 — from deck(s) L68
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.3', 'Heterolytic bond breaking: electrophiles and nucleophiles', 'heterolytic bond breaking results in species that are electrophiles or nucleophiles 10.2 mechanism concept · 10.4 definition of nucleophile · 10.5 bond polarity → mechanism type', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.4 — from deck(s) L68
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.4', 'Definition of a nucleophile', 'I can state and apply the spec definition of a nucleophile (an electron pair donor that forms a bond with an electron-deficient atom).', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.5 — from deck(s) L68
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.5', 'Predicting heterolytic vs homolytic bond breaking', 'I can predict whether a bond will break heterolytically or homolytically from bond polarity and the conditions.', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.6 — from deck(s) L69
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.6', 'Nomenclature and formulae of halogenoalkanes', 'nomenclature of halogenoalkanes and be able to draw their structural, displayed and skeletal formulae', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.7 — from deck(s) L69
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.7', 'Primary, secondary and tertiary halogenoalkanes', 'distinction between primary, secondary and tertiary halogenoalkanes the number of carbons bonded to the halogen-bearing carbon: 1°, 2°, 3°', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.8 — from deck(s) L70
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.8', 'Products of halogenoalkane + nucleophile; substitution vs elimination', 'I can predict the organic product of a halogenoalkane + nucleophile, given reagent + solvent. I can explain why aqueous KOH gives substitution but ethanolic KOH gives elimination. I can use the AgNO₃ halide test to identify Cl, Br, or I in a halogenoalkane.', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.9 — from deck(s) L70
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.9', 'Curly arrows for electron movement', 'using curly arrows for electron movement', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.10 — from deck(s) L71
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.10', 'Relative rates of hydrolysis of halogenoalkanes', 'compare the relative rates of hydrolysis of: i) primary, secondary and tertiary structural isomers of a halogenoalkane; ii) primary chloro-, bromo- and iodoalkanes using aqueous silver nitrate in ethanol', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.11 — from deck(s) L72
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.11', 'Core Practical 5: rates of hydrolysis of halogenoalkanes', 'the procedure of Core Practical 5 for measuring relative hydrolysis rates the practical accurately and read time-to-first-precipitate data to compare rates 1-chlorobutane · 1-bromobutane · 1-iodobutane', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.12 — from deck(s) L71
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.12', 'Trends in reactivity of halogenoalkanes', 'know the trend in reactivity of primary, secondary and tertiary halogenoalkanes understand, in terms of bond enthalpy, the trend in reactivity of chloro-, bromo- and iodoalkanes', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.13 — from deck(s) L71
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.13', 'Trends in reactivity of halogenoalkanes', 'know the trend in reactivity of primary, secondary and tertiary halogenoalkanes understand, in terms of bond enthalpy, the trend in reactivity of chloro-, bromo- and iodoalkanes', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.15 — from deck(s) L74
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.15', 'Nomenclature and formulae of alcohols', 'nomenclature of alcohols and be able to draw their structural, displayed and skeletal formulae', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.16 — from deck(s) L74
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.16', 'Primary, secondary and tertiary alcohols and their reactions', 'distinction between primary, secondary and tertiary alcohols, and their reactions with oxygen (combustion) · halogenating agents (PCl₅, KBr/H₂SO₄, red P/I₂) · conc. H₃PO₄ (dehydration)', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.17 — from deck(s) L74
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.17', 'Primary, secondary and tertiary alcohols and their reactions', 'distinction between primary, secondary and tertiary alcohols, and their reactions with oxygen (combustion) · halogenating agents (PCl₅, KBr/H₂SO₄, red P/I₂) · conc. H₃PO₄ (dehydration)', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.18 — from deck(s) L75
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.18', 'Oxidation of alcohols: aldehydes, ketones and carboxylic acids', 'primary alcohols to produce aldehydes (which give a positive result with Benedict’s or Fehling’s solution) if the product is distilled as it forms primary alcohols to produce carboxylic acids (which give a positive result with sodium carbonate or sodium hydrogencarbonate) if the reagents are heated under reflux secondary alcohols to produce ketones. In equations, the oxidising agent can be represented by [O].', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.19 — from deck(s) L76
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.19', 'Preparation and purification techniques for a liquid organic compound', 'the following techniques in the preparation and purification of a liquid organic compound: heating under reflux, extraction with a solvent using a separating funnel, distillation, drying with an anhydrous salt, boiling temperature determination', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.20 — from deck(s) L76
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.20', 'Oxidation of propan-1-ol to propanal and propanoic acid', 'the oxidation of propan-1-ol to produce propanal and propanoic acid distillation collects the aldehyde · reflux gives the carboxylic acid', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.21 — from deck(s) L77
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.21', 'The m/z of the molecular ion; fragmentation patterns', 'the m/z of the molecular ion fragmentation patterns', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 10.22 — from deck(s) L78
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '10.22', 'Infrared spectra: deducing functional groups', 'be able to use infrared spectra of organic compounds to deduce functional groups present and predict infrared absorptions, given wavenumber data, due to familiar functional groups: C–H, C=C, O–H, C=O, C–X, N–H.', ARRAY['use','predict'], 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.13 exists in no deck, family, link or evidence row — archived, not deleted.
UPDATE spec_points SET status = 'archived'
 WHERE code = '1.13'
   AND topic_id = (SELECT t.id FROM topics t
                   JOIN courses c ON c.id = t.course_id AND c.slug = 'edexcel-ial-as-chemistry'
                   WHERE t.slug = 'formulae-equations-amounts');

COMMIT;
