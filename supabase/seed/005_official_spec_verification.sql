-- ============================================================================
-- AILEMY — OFFICIAL SPECIFICATION VERIFICATION (157 spec points)
-- ⚠ APPLIED 2026-09-01 via service-role PostgREST (this file is the same-day
--   record of that hand-application).
--
-- SOURCE: Pearson Edexcel International Advanced Subsidiary in Chemistry
-- (XCH11) / International Advanced Level in Chemistry (YCH11),
-- "International-A-Level-Chemistry-Spec.pdf" — Specification ISSUE 1,
-- September 2017, first teaching September 2018 (the owner's own archived
-- copy of the official document; md5 45951727...61a4c).
--
-- WHAT THIS PASS DID, on top of 004 (deck-derived drafts):
--   * every description replaced with the OFFICIAL statement wording,
--     verbatim from the PDF text layer, with notation restored per the
--     explicit token table in the verification script (superscripts/
--     subscripts that pdftotext flattens: 10²³, mol⁻¹, dm⁻³, ¹²C, H₂O …);
--     sub-part romans (i, ii, …) and official guidance notes kept inline
--   * ~30 titles re-labelled where the deck-derived label had drifted onto a
--     neighbouring code (e.g. 3.2 carried 3.3's dot-and-cross label)
--   * 10.14 (CORE PRACTICAL 6) and 10.23 (CORE PRACTICAL 8) added — the two
--     codes the deck library never stated
--   * Topic 10 renamed to the official "Organic Chemistry: Halogenoalkanes,
--     Alcohols and Spectra"
--   * every verified row: status 'draft' -> 'live', verified_at set — the
--     lifecycle 0001's schema comment prescribes ("set when content matches
--     official spec"). 1.13 stays archived: it does not exist in Issue 1
--     (Topic 1 ends at 1.12), which confirms the archive decision.
--   * command_terms rebuilt from the official statement stems
--
-- Verified against the official document code by code; row ids unchanged, so
-- lesson_spec_points links and practice evidence keep resolving.
-- Idempotent: upsert ON CONFLICT (topic_id, code) DO UPDATE.
-- ============================================================================

BEGIN;

UPDATE topics SET name = 'Organic Chemistry: Halogenoalkanes, Alcohols and Spectra'
 WHERE slug = 'halogenoalkanes-alcohols-spectra'
   AND course_id = (SELECT id FROM courses WHERE slug = 'edexcel-ial-as-chemistry');

-- 1.1 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.1', '1.1', 'know the terms ‘atom'', ''element'', ''ion'', ''molecule'', ''compound'', ''empirical formula'' and ''molecular formula’', ARRAY['know'], 'live', now(), 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.2 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.2', '1.2', 'know that the mole (mol) is the unit for the amount of a substance and be able to perform calculations using the Avogadro constant L (6.02 × 10²³ mol⁻¹)', ARRAY['know','perform'], 'live', now(), 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.3 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.3', '1.3', 'write balanced full and ionic equations, including state symbols, for chemical reactions', ARRAY['write'], 'live', now(), 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.4 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.4', '1.4', 'understand the terms: i ‘relative atomic mass’ based on the ¹²C scale ii ‘relative molecular mass’ and ‘relative formula mass’, including calculating these values from relative atomic masses The term ‘relative formula mass’ should be used for compounds with giant structures. iii ‘molar mass’ as the mass per mole of a substance in g mol⁻¹ iv parts per million (ppm), including gases in the atmosphere', ARRAY['understand'], 'live', now(), 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.5 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.5', '1.5', 'calculate the concentration of a solution in mol dm⁻³ and g dm⁻³ Titration calculations are not required at this stage.', ARRAY['calculate'], 'live', now(), 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.6 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.6', '1.6', 'be able to use experimental data to calculate empirical and molecular formulae', ARRAY['use'], 'live', now(), 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.7 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.7', '1.7', 'be able to use chemical equations to calculate reacting masses and vice versa, using the concepts of amount of substance and molar mass', ARRAY['use'], 'live', now(), 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.8 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.8', '1.8', 'be able to use chemical equations to calculate volumes of gases and vice versa, using: i the concepts of amount of substance ii the molar volume of gases iii the expression pV = nRT for gases and volatile liquids', ARRAY['use'], 'live', now(), 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.9 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.9', '1.9', 'be able to calculate percentage yields and percentage atom economies (by mass) in laboratory and industrial processes, using chemical equations and experimental results Atom economy = molar mass of the desired product × 100% sum of the molar masses of all products', ARRAY['calculate'], 'live', now(), 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.10 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.10', '1.10', 'be able to determine a formula or confirm an equation by experiment, including evaluation of the data', ARRAY['determine'], 'live', now(), 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.11 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.11', '1.11', 'CORE PRACTICAL 1 Measurement of the molar volume of a gas.', NULL, 'live', now(), 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 1.12 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '1.12', '1.12', 'be able to relate ionic and full equations, with state symbols, to observations from simple test-tube experiments, to include: i displacement reactions ii typical reactions of acids iii precipitation reactions', ARRAY['relate'], 'live', now(), 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.1 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.1', '2.1', 'know the structure of an atom in terms of electrons, protons and neutrons', ARRAY['know'], 'live', now(), 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.2 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.2', '2.2', 'know the relative mass and charge of protons, neutrons and electrons', ARRAY['know'], 'live', now(), 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.3 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.3', '2.3', 'know what is meant by the terms ‘atomic (proton) number’ and ‘mass number’', ARRAY['know'], 'live', now(), 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.4 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.4', '2.4', 'be able to use the atomic number and the mass number to determine the number of each type of subatomic particle in an atom or ion', ARRAY['use'], 'live', now(), 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.5 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.5', '2.5', 'understand the term ‘isotope’', ARRAY['understand'], 'live', now(), 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.6 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.6', '2.6', 'understand the basic principles of a mass spectrometer and be able to analyse and interpret mass spectra to: i deduce the isotopic composition of a sample of an element ii calculate the relative atomic mass of an element from relative abundances of isotopes and vice versa iii determine the relative molecular mass of a molecule, and hence identify molecules in a sample iv understand that ions in a mass spectrometer may have a 2+ charge', ARRAY['understand','analyse'], 'live', now(), 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.7 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.7', '2.7', 'be able to predict mass spectra, including relative peak heights, for diatomic molecules, including chlorine, given the isotopic abundances', ARRAY['predict'], 'live', now(), 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.8 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.8', 'First, second and third ionisation energies', 'be able to define first, second and third ionisation energies and understand that all ionisation energies are endothermic', NULL, 'live', now(), 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'First, second and third ionisation energies';

-- 2.9 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.9', 'Orbitals: regions holding up to two electrons', 'know that an orbital is a region within an atom that can hold up to two electrons with opposite spins', ARRAY['know'], 'live', now(), 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Orbitals: regions holding up to two electrons';

-- 2.10 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.10', '2.10', 'understand how ionisation energies are influenced by the number of protons in the nucleus, the electron shielding and the sub-shell from which the electron is removed', ARRAY['understand'], 'live', now(), 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.11 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.11', '2.11', 'know that ideas about electronic structure developed from: i an understanding that successive ionisation energies provide evidence for the existence of quantum shells and the group to which the element belongs ii an understanding that the first ionisation energy of successive elements provides evidence for electron sub-shells', ARRAY['know'], 'live', now(), 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.12 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.12', 'Shapes of s and p orbitals', 'be able to describe the shapes of s and p orbitals', NULL, 'live', now(), 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Shapes of s and p orbitals';

-- 2.13 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.13', '2.13', 'know that orbitals in sub-shells: i each take a single electron before pairing up ii pair up with two electrons of opposite spin', ARRAY['know'], 'live', now(), 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.14 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.14', '2.14', 'be able to predict the electronic configuration of atoms of the elements from hydrogen to krypton inclusive and their ions, using s, p, d notation and electron-in- boxes notation', ARRAY['predict'], 'live', now(), 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.15 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.15', '2.15', 'understand that electronic configuration determines the chemical properties of an element', ARRAY['understand'], 'live', now(), 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.16 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.16', 'Blocks of the Periodic Table and sub-shell capacities', 'know that the Periodic Table is divided into blocks, such as s, p and d, and know the number of electrons that can occupy s, p and d sub-shells in the first four quantum shells', ARRAY['know'], 'live', now(), 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Blocks of the Periodic Table and sub-shell capacities';

-- 2.17 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.17', '2.17', 'be able to represent data, in a graphical form (including the use of logarithms of first ionisation energies on a graph) for elements 1 to 36 and hence explain the meaning of the term ‘periodic property’', NULL, 'live', now(), 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 2.18 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '2.18', '2.18', 'be able to explain: i the trends in melting and boiling temperatures of the elements of Periods 2 and 3 of the Periodic Table in terms of the structure of the element and the bonding between its atoms or molecules ii the general increase and the specific trends in ionisation energy of the elements across Periods 2 and 3 of the Periodic Table iii the decrease in first ionisation energy down a group', ARRAY['explain'], 'live', now(), 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'atomic-structure-periodic-table'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.1 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.1', 'Evidence for the existence of ions', 'know and be able to interpret evidence for the existence of ions, limited to physical properties of ionic compounds, electron density maps and the migration of ions', ARRAY['know','interpret'], 'live', now(), 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Evidence for the existence of ions';

-- 3.2 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.2', 'Formation of ions by loss or gain of electrons', 'be able to describe the formation of ions in terms of loss or gain of electrons', NULL, 'live', now(), 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Formation of ions by loss or gain of electrons';

-- 3.3 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.3', '3.3', 'be able to draw dot-and-cross diagrams to show electrons in cations and anions', ARRAY['draw'], 'live', now(), 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.4 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.4', 'Ionic crystals as giant lattices of ions', 'be able to describe ionic crystals as giant lattices of ions', NULL, 'live', now(), 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Ionic crystals as giant lattices of ions';

-- 3.5 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.5', 'Ionic bonding: strong net electrostatic attraction', 'know that ionic bonding is the result of strong net electrostatic attraction between ions', ARRAY['know'], 'live', now(), 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Ionic bonding: strong net electrostatic attraction';

-- 3.6 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.6', '3.6', 'understand the effects of ionic radius and ionic charge on the strength of ionic bonding', ARRAY['understand'], 'live', now(), 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.7 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.7', 'Trends in ionic radii; isoelectronic ions', 'understand reasons for the trends in ionic radii down a group in the Periodic Table, and for a set of isoelectronic ions, including N³⁻ to Al³⁺', ARRAY['understand'], 'live', now(), 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Trends in ionic radii; isoelectronic ions';

-- 3.8 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.8', '3.8', 'understand the meaning of the term ‘polarisation’ as applied to ions', ARRAY['understand'], 'live', now(), 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.9 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.9', '3.9', 'understand that the polarising power of a cation depends on its radius and charge, and the polarisability of an anion also depends on its radius and charge', ARRAY['understand'], 'live', now(), 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.10 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.10', '3.10', 'understand that covalent bonding is the strong electrostatic attraction between two nuclei and the shared pair of electrons between them, based on the evidence: i the physical properties of giant atomic structures ii electron density maps for simple molecules', ARRAY['understand'], 'live', now(), 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.11 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.11', '3.11', 'be able to draw dot-and-cross diagrams to show electrons in covalent substances, including: i molecules with single, double and triple bonds ii species with dative covalent (coordinate) bonds, including Al₂Cl₆ and the ammonium ion', ARRAY['draw'], 'live', now(), 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.12 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.12', '3.12', 'be able to describe the different structures formed by giant lattices of carbon atoms, including graphite, diamond and graphene, and discuss the applications of each', NULL, 'live', now(), 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.13 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.13', '3.13', 'understand the meaning of the term ‘electronegativity’ as applied to atoms in a covalent bond', ARRAY['understand'], 'live', now(), 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.14 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.14', '3.14', 'know that ionic and covalent bonding are the extremes of a continuum of bonding type and be able to explain this in terms of electronegativity differences, leading to bond polarity in bonds and molecules, and to ionic bonding if the electronegativity is large enough', ARRAY['know','explain'], 'live', now(), 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.15 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.15', 'Polar bonds and polar molecules', 'be able to distinguish between polar bonds and polar molecules and predict whether or not a given molecule is likely to be polar', NULL, 'live', now(), 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Polar bonds and polar molecules';

-- 3.16 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.16', '3.16', 'understand the principles of the electron-pair repulsion theory, used to interpret and predict the shapes of simple molecules and ions', ARRAY['understand'], 'live', now(), 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.17 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.17', '3.17', 'understand the terms ‘bond length’ and ‘bond angle’', ARRAY['understand'], 'live', now(), 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.18 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.18', '3.18', 'know and be able to explain the shapes of, and bond angles in, BeCl₂, BCl₃, CH₄, NH₃, NH₄⁺, H₂O, CO₂, gaseous PCl₅ , SF₆ and C₂H₄', ARRAY['know','explain'], 'live', now(), 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.19 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.19', '3.19', 'be able to apply the electron-pair repulsion theory to predict the shapes of, and bond angles in, molecules and ions analogous to those in 3.18', NULL, 'live', now(), 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.20 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.20', '3.20', 'understand that metals consist of giant lattices of metal ions in a sea of delocalised electrons', ARRAY['understand'], 'live', now(), 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 3.21 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.21', 'Metallic bonding: strong electrostatic attraction', 'know that metallic bonding is the strong electrostatic attraction between metal ions and the delocalised electrons', ARRAY['know'], 'live', now(), 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Metallic bonding: strong electrostatic attraction';

-- 3.22 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '3.22', 'Using the metallic bonding models to interpret properties', 'be able to use the models in 3.20 and 3.21 to interpret simple properties of metals, including electrical conductivity and high melting temperature', ARRAY['use'], 'live', now(), 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'bonding-structure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Using the metallic bonding models to interpret properties';

-- 4.1 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.1', '4.1', 'understand the difference between hazard and risk', ARRAY['understand'], 'live', now(), 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.2 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.2', 'Hazards of organic compounds and risk assessment', 'understand the hazards associated with organic compounds and why it is necessary to carry out risk assessments when dealing with potentially hazardous materials', ARRAY['understand'], 'live', now(), 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Hazards of organic compounds and risk assessment';

-- 4.3 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.3', '4.3', 'be able to suggest ways in which risks can be reduced and reactions carried out safely, for example: i working on a smaller scale ii taking precautions specific to the hazard iii using an alternative method that involves less hazardous substances', NULL, 'live', now(), 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.4 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.4', '4.4', 'understand the concepts of homologous series and functional group', ARRAY['understand'], 'live', now(), 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.5 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.5', '4.5', 'be able to apply the rules of International Union of Pure and Applied Chemistry (IUPAC) nomenclature to: i name compounds relevant to this specification ii draw these compounds, as they are encountered in the specification, using structural, displayed and skeletal formulae Students will be expected to know prefixes for compounds up to C₁₀', NULL, 'live', now(), 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.6 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.6', '4.6', 'be able to classify reactions as addition, substitution, oxidation, reduction or polymerisation', NULL, 'live', now(), 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.7 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.7', '4.7', 'understand that bond breaking can be: i homolytic, to produce free radicals ii heterolytic, to produce ions', ARRAY['understand'], 'live', now(), 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.8 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.8', '4.8', 'know definitions of the terms ‘free radical’ and ‘electrophile’', ARRAY['know'], 'live', now(), 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.9 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.9', '4.9', 'know the general formula of alkanes and cycloalkanes, and understand that they are hydrocarbons (compounds of carbon and hydrogen only) which are saturated (contain single bonds only)', ARRAY['know'], 'live', now(), 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.10 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.10', 'Structural isomerism', 'understand the term ‘structural isomerism’ and be able to draw the structural isomers of organic molecules, given their molecular formula', ARRAY['understand','draw'], 'live', now(), 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Structural isomerism';

-- 4.11 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.11', 'Structural isomers of alkanes and cycloalkanes up to C₆', 'be able to draw and name the structural isomers of alkanes and cycloalkanes with up to six carbon atoms', ARRAY['draw'], 'live', now(), 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Structural isomers of alkanes and cycloalkanes up to C₆';

-- 4.12 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.12', '4.12', 'know that alkanes are used as fuels and obtained from the fractional distillation, cracking and reforming of crude oil, and be able to write equations for these reactions', ARRAY['know','write'], 'live', now(), 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.13 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.13', '4.13', 'know that pollutants, including carbon monoxide, oxides of nitrogen and sulfur, carbon particulates and unburned hydrocarbons, are emitted during the combustion of alkane fuels', ARRAY['know'], 'live', now(), 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.14 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.14', 'Problems caused by combustion pollutants', 'understand the problems arising from pollutants from the combustion of alkane fuels, limited to the toxicity of carbon monoxide and why it is toxic, and the acidity of oxides of nitrogen and sulfur', ARRAY['understand'], 'live', now(), 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Problems caused by combustion pollutants';

-- 4.15 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.15', '4.15', 'be able to discuss the reasons for developing alternative fuels in terms of sustainability and reducing emissions, including the emission of CO₂ and its relationship to climate change', NULL, 'live', now(), 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.16 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.16', 'Carbon neutrality of different fuels', 'be able to apply the concept of carbon neutrality to different fuels, such as petrol, bioethanol and hydrogen', NULL, 'live', now(), 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Carbon neutrality of different fuels';

-- 4.17 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.17', '4.17', 'understand the reactions of alkanes with: i oxygen in the air (combustion) ii halogens', ARRAY['understand'], 'live', now(), 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 4.18 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '4.18', '4.18', 'understand the mechanism of the free radical substitution reaction between an alkane and a halogen: i using free radicals, which are species with an unpaired electron, represented by a single dot ii showing the initiation step of the mechanism, with curly half-arrows for free radical formation iii showing the propagation and termination steps of the mechanism iv having limited use in synthesis because of further substitution reactions', ARRAY['understand'], 'live', now(), 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intro-organic-hydrocarbons'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 5.1 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '5.1', '5.1', 'know the general formula of alkenes and understand that alkenes and cycloalkenes are hydrocarbons which are unsaturated (have a carbon-carbon double bond which consists of a σ bond and a π bond)', ARRAY['know'], 'live', now(), 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 5.2 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '5.2', 'Geometric isomerism and restricted rotation about C=C', 'be able to explain geometric isomerism in terms of restricted rotation around a C=C double bond and the nature of the substituents on the carbon atoms', ARRAY['explain'], 'live', now(), 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Geometric isomerism and restricted rotation about C=C';

-- 5.3 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '5.3', 'The E–Z naming system for geometric isomers', 'understand the E–Z naming system for geometric isomers and why it is necessary to use this when the cis- and trans- naming system breaks down', ARRAY['understand'], 'live', now(), 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'The E–Z naming system for geometric isomers';

-- 5.4 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '5.4', '5.4', 'be able to describe the reactions of alkenes, limited to: i the addition of hydrogen, using a nickel catalyst, to form an alkane ii the addition of halogens to produce a di-substituted halogenoalkane iii the addition of hydrogen halides to produce mono-substituted halogenoalkanes iv the addition of steam, in the presence of an acid catalyst, to produce alcohols v oxidation of the double bond by acidified potassium manganate(VII) to produce a diol', NULL, 'live', now(), 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 5.5 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '5.5', 'Bromine water test for the C=C bond', 'know the qualitative test for a C=C double bond using bromine or bromine water', ARRAY['know'], 'live', now(), 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Bromine water test for the C=C bond';

-- 5.6 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '5.6', 'Mechanisms of electrophilic addition to alkenes', 'be able to describe the mechanism (including diagrams), giving evidence where possible, of: i the electrophilic addition of bromine and hydrogen bromide to ethene ii the electrophilic addition of hydrogen bromide to propene Use of the curly arrow notation is expected – the curly arrows should start from either a bond or from a lone pair of electrons. Knowledge of the relative stability of primary, secondary and tertiary carbocation intermediates is expected.', NULL, 'live', now(), 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Mechanisms of electrophilic addition to alkenes';

-- 5.7 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '5.7', '5.7', 'be able to describe the addition polymerisation of alkenes and draw the repeat unit given the monomer, and vice versa', NULL, 'live', now(), 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 5.8 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '5.8', '5.8', 'understand how chemists limit the problems caused by polymer disposal by: i developing biodegradable polymers ii removing toxic waste gases produced by the incineration of polymers', ARRAY['understand'], 'live', now(), 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'alkenes'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 6.1 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.1', '6.1', 'know that the enthalpy change, ∆H, is the heat energy change measured at constant pressure and that standard conditions are 100 kPa and a specified temperature, usually 298 K', ARRAY['know'], 'live', now(), 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 6.2 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.2', 'Sign convention: exothermic and endothermic reactions', 'know that, by convention, exothermic reactions have a negative enthalpy change and endothermic reactions have a positive enthalpy change', ARRAY['know'], 'live', now(), 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Sign convention: exothermic and endothermic reactions';

-- 6.3 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.3', 'Enthalpy level diagrams', 'be able to construct and interpret enthalpy level diagrams, showing exothermic and endothermic enthalpy changes', NULL, 'live', now(), 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Enthalpy level diagrams';

-- 6.4 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.4', 'Standard enthalpy change definitions: ΔrH, ΔfH, ΔcH, ΔneutH, ΔatH', 'know the definition of standard enthalpy change of: i reaction, ∆rH ii formation, ∆fH iii combustion, ∆cH iv neutralisation, ∆neutH v atomisation, ∆atH', ARRAY['know'], 'live', now(), 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Standard enthalpy change definitions: ΔrH, ΔfH, ΔcH, ΔneutH, ΔatH';

-- 6.5 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.5', '6.5', 'be able to use experimental data to calculate: i energy transferred in a reaction recalling and using the expression: energy transferred (J) = mass (g) × specific heat capacity (J g⁻¹ °C⁻¹) × temperature change (°C) ii enthalpy change of the reaction in kJ mol⁻¹ This will be limited to experiments where substances are mixed in an insulated container and combustion experiments using a suitable calorimeter.', ARRAY['use'], 'live', now(), 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 6.6 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.6', '6.6', 'know Hess’s Law and be able to apply it to: i constructing enthalpy cycles ii calculating enthalpy changes of reaction using data provided, or data selected from a table or obtained from experiments', ARRAY['know'], 'live', now(), 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 6.7 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.7', '6.7', 'CORE PRACTICAL 2 Determination of the enthalpy change of a reaction using Hess’s Law.', NULL, 'live', now(), 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 6.8 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.8', '6.8', 'be able to evaluate the results obtained from experiments and comment on sources of error and uncertainty and any assumptions made in the experiments Students will need to consider experiments where substances are mixed in an insulated container and combustion experiments using, for example, a spirit burner and be able to draw suitable graphs and use cooling curve corrections.', ARRAY['evaluate'], 'live', now(), 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 6.9 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.9', '6.9', 'understand the terms ‘bond enthalpy’ and ‘mean bond enthalpy’, and be able to use bond enthalpies to calculate enthalpy changes, understanding the limitations of this method', ARRAY['understand','use'], 'live', now(), 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 6.10 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.10', '6.10', 'be able to calculate mean bond enthalpies from enthalpy changes of reaction', ARRAY['calculate'], 'live', now(), 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 6.11 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '6.11', '6.11', 'understand that bond enthalpy data gives some indication about which bond will break first in a reaction, how easy or difficult it is and therefore how rapidly a reaction will take place at room temperature', ARRAY['understand'], 'live', now(), 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'energetics'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 7.1 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '7.1', '7.1', 'understand the nature of the following intermolecular forces: i London forces (instantaneous dipole-induced dipole) ii permanent dipole-permanent dipole interactions iii hydrogen bonds', ARRAY['understand'], 'live', now(), 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 7.2 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '7.2', '7.2', 'understand the interactions in molecules, such as H₂O, liquid NH₃ and liquid HF, which give rise to hydrogen bonding', ARRAY['understand'], 'live', now(), 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 7.3 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '7.3', '7.3', 'understand the following anomalous properties of water resulting from hydrogen bonding: i its high melting and boiling temperature when compared with similar molecules ii the density of ice compared to that of water', ARRAY['understand'], 'live', now(), 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 7.4 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '7.4', '7.4', 'be able to predict the presence of hydrogen bonding in molecules analogous to those mentioned in 7.2', ARRAY['predict'], 'live', now(), 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 7.5 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '7.5', '7.5', 'understand, in terms of intermolecular forces, physical properties shown by substances, including: i the trends in boiling temperatures of alkanes with increasing chain length ii the effect of branching in the carbon chain on the boiling temperatures of alkanes iii the relatively low volatility (higher boiling temperatures) of alcohols compared to alkanes with a similar number of electrons iv the trends in boiling temperatures of the hydrogen halides HF to HI', ARRAY['understand'], 'live', now(), 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 7.6 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '7.6', '7.6', 'understand factors that influence the choice of solvents, including: i water, to dissolve some ionic compounds, in terms of the hydration of the ions ii water, to dissolve simple alcohols, in terms of hydrogen bonding iii water, as a poor solvent for compounds (to include polar molecules such as halogenoalkane), in terms of inability to form hydrogen bonds iv non-aqueous solvents, for compounds that have similar intermolecular forces to those in the solvent', ARRAY['understand'], 'live', now(), 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'intermolecular-forces'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.1 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.1', '8.1', 'know what is meant by the term ‘oxidation number’ and understand the rules for assigning oxidation numbers', ARRAY['know'], 'live', now(), 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.2 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.2', '8.2', 'be able to calculate the oxidation number of elements in compounds and ions, including in peroxides and metal hydrides', ARRAY['calculate'], 'live', now(), 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.3 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.3', '8.3', 'be able to indicate the oxidation number of an element in a compound or an ion, using a Roman numeral', NULL, 'live', now(), 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.4 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.4', '8.4', 'be able to write formulae given oxidation numbers', ARRAY['write'], 'live', now(), 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.5 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.5', '8.5', 'understand oxidation and reduction in terms of electron transfer and changes in oxidation number, and the application of these ideas to reactions of s-block and p-block elements', ARRAY['understand'], 'live', now(), 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.6 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.6', '8.6', 'know that oxidising agents gain electrons and reducing agents lose electrons', ARRAY['know'], 'live', now(), 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.7 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.7', '8.7', 'understand that a disproportionation reaction involves an element in a single species being simultaneously oxidised and reduced', ARRAY['understand'], 'live', now(), 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.8 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.8', '8.8', 'know that oxidation number is a useful concept in terms of the classification of reactions as redox and as disproportionation', ARRAY['know'], 'live', now(), 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.9 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.9', 'Metals and non-metals: electron loss and gain in redox', 'understand that metals, in general, form positive ions by loss of electrons with an increase in oxidation number whereas non-metals, in general, form negative ions by gain of electrons with a decrease in oxidation number', ARRAY['understand'], 'live', now(), 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Metals and non-metals: electron loss and gain in redox';

-- 8.10 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.10', '8.10', 'be able to write ionic half-equations and use them to construct full ionic equations', ARRAY['write'], 'live', now(), 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.11 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.11', '8.11', 'understand reasons for the trend in ionisation energy down Groups 1 and 2', ARRAY['understand'], 'live', now(), 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.12 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.12', '8.12', 'understand reasons for the trend in reactivity of the elements down Group 1 (Li to K) and Group 2 (Mg to Ba)', ARRAY['understand'], 'live', now(), 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.13 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.13', '8.13', 'know the reactions of the elements of Group 1 (Li to K) and Group 2 (Mg to Ba) with oxygen, chlorine and water', ARRAY['know'], 'live', now(), 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.14 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.14', '8.14', 'know the reactions of: i oxides of Group 1 and 2 elements with water and dilute acid ii hydroxides of Group 1 and 2 elements with dilute acid', ARRAY['know'], 'live', now(), 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.15 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.15', '8.15', 'know the trends in solubility of the hydroxides and sulfates of Group 2 elements', ARRAY['know'], 'live', now(), 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.16 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.16', '8.16', 'understand the reasons for the trends in thermal stability of the nitrates and the carbonates of the elements in Groups 1 and 2 in terms of the size and charge of the cations involved', ARRAY['understand'], 'live', now(), 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.17 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.17', '8.17', 'understand the formation of characteristic flame colours by Group 1 and 2 compounds in terms of electron transitions Students will be expected to know the flame colours for Group 1 and 2 compounds.', ARRAY['understand'], 'live', now(), 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.18 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.18', 'Experimental procedures: thermal decomposition and flame colours', 'know experimental procedures to show: i patterns in the thermal decomposition of Group 1 and 2 nitrates and carbonates Students will be expected to know tests for carbon dioxide and oxygen; and to recognise nitrogen dioxide by its colour and acidic pH. ii flame colours in compounds of Group 1 and 2 elements', ARRAY['know'], 'live', now(), 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Experimental procedures: thermal decomposition and flame colours';

-- 8.19 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.19', '8.19', 'know reactions, including ionic equations where appropriate, for identifying: i carbonate ions, CO₃²⁻, and hydrogencarbonate ions, HCO₃⁻ , using an aqueous acid to form carbon dioxide (and testing the gas with limewater) ii sulfate ions, SO₂- 4 , using acidified barium chloride solution iii ammonium ions, NH+ 4 , using sodium hydroxide solution and warming to form ammonia (and testing with litmus and HCl fumes)', ARRAY['know'], 'live', now(), 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.20 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.20', '8.20', 'be able to calculate solution concentrations, in mol dm⁻³ and g dm⁻³, including simple acid-base titrations using the indicators methyl orange and phenolphthalein', ARRAY['calculate'], 'live', now(), 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.21 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.21', '8.21', 'CORE PRACTICAL 3 Finding the concentration of a solution of hydrochloric acid.', NULL, 'live', now(), 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.22 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.22', '8.22', 'understand how to minimise the sources of measurement uncertainty in volumetric analysis and estimate the overall uncertainty in the calculated result', ARRAY['understand'], 'live', now(), 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.23 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.23', '8.23', 'CORE PRACTICAL 4 Preparation of a standard solution from a solid acid and use it to find the concentration of a solution of sodium hydroxide.', NULL, 'live', now(), 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.24 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.24', '8.24', 'understand reasons for the trends for Group 7 elements in: i melting and boiling temperatures and physical state at room temperature ii electronegativity iii reactivity down the group', ARRAY['understand'], 'live', now(), 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.25 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.25', '8.25', 'understand the trend in reactivity of Group 7 elements in terms of the redox reactions of Cl₂, Br₂ and I₂ with halide ions in aqueous solution Students are expected to know the colours of the elements in standard conditions, in aqueous solution and in a non-polar organic solvent.', ARRAY['understand'], 'live', now(), 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.26 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.26', '8.26', 'understand, in terms of changes in oxidation number, the following reactions of the halogens: i oxidation reactions with Group 1 and 2 metals ii the disproportionation reaction of chlorine with water and the use of chlorine in water treatment iii the disproportionation reaction of chlorine with cold, dilute aqueous sodium hydroxide to form bleach iv the disproportionation reaction of chlorine with hot alkali v reactions analogous to those specified above', ARRAY['understand'], 'live', now(), 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.27 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.27', '8.27', 'understand the following reactions: i solid Group 1 halides with concentrated sulfuric acid, to illustrate the trend in reducing ability of the hydrogen halides ii precipitation reactions of the aqueous anions Cl-, Br- and I- with aqueous silver nitrate solution and nitric acid, and the solubility of the precipitates in aqueous ammonia solution iii hydrogen halides with ammonia gas (to produce ammonium halides) and with water (to produce acids)', ARRAY['understand'], 'live', now(), 27
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 8.28 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '8.28', '8.28', 'be able to make predictions about fluorine and astatine and their compounds, in terms of knowledge of trends in halogen chemistry', ARRAY['make'], 'live', now(), 28
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'redox-groups-1-2-7'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.1 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.1', '9.1', 'understand, in terms of the collision theory, the effect of changes in concentration, temperature, pressure and surface area on the rate of a chemical reaction', ARRAY['understand'], 'live', now(), 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.2 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.2', '9.2', 'understand that reactions take place only when collisions have sufficient energy, known as the activation energy', ARRAY['understand'], 'live', now(), 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.3 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.3', '9.3', 'be able to calculate the rate of a reaction from: i the time taken for a reaction, using rate = 1/time ii the gradient of suitable graph, by drawing a tangent, either for initial rate, or at a time, t', ARRAY['calculate'], 'live', now(), 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.4 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.4', '9.4', 'understand qualitatively, in terms of the Maxwell-Boltzmann distribution of molecular energies, how changes in temperature affect the rate of a reaction', ARRAY['understand'], 'live', now(), 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.5 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.5', '9.5', 'understand the role of catalysts in providing alternative reaction routes of lower activation energy', ARRAY['understand'], 'live', now(), 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.6 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.6', '9.6', 'be able to draw the reaction profiles for uncatalysed and catalysed reactions, including the energy level of the intermediate formed with the catalyst', ARRAY['draw'], 'live', now(), 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.7 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.7', '9.7', 'understand the use of catalysts in industry to make processes more sustainable by using less energy and/or higher atom economy', ARRAY['understand'], 'live', now(), 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.8 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.8', '9.8', 'be able to interpret the action of a catalyst in terms of a qualitative understanding of the Maxwell-Boltzmann distribution of molecular energies', ARRAY['interpret'], 'live', now(), 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.9 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.9', '9.9', 'know that many reactions are readily reversible and that they can reach a state of dynamic equilibrium in which: i the rate of the forward reaction is equal to the rate of the backward reaction ii the concentrations of the reactants and the products remain constant', ARRAY['know'], 'live', now(), 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.10 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.10', '9.10', 'be able to predict and justify the qualitative effects of changes of temperature, pressure and concentration on the position of equilibrium in a homogeneous system', ARRAY['predict'], 'live', now(), 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 9.11 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '9.11', '9.11', 'evaluate data to explain the necessity, for many industrial processes, to reach a compromise between the yield and the rate of reaction', ARRAY['evaluate'], 'live', now(), 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'kinetics-equilibria-intro'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.1 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.1', '10.1', 'be able to classify reactions (including those in Unit 1) as addition, elimination, substitution, oxidation, reduction, hydrolysis or polymerisation', NULL, 'live', now(), 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.2 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.2', '10.2', 'understand the concept of a reaction mechanism', ARRAY['understand'], 'live', now(), 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.3 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.3', '10.3', 'understand that heterolytic bond breaking results in species that are electrophiles or nucleophiles', ARRAY['understand'], 'live', now(), 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.4 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.4', '10.4', 'know the definition of the term ‘nucleophile’', ARRAY['know'], 'live', now(), 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.5 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.5', 'Bond polarity and reaction mechanism type', 'understand the link between bond polarity and the type of reaction mechanism a compound will undergo', ARRAY['understand'], 'live', now(), 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Bond polarity and reaction mechanism type';

-- 10.6 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.6', '10.6', 'understand the nomenclature of halogenoalkanes and be able to draw their structural, displayed and skeletal formulae', ARRAY['understand','draw'], 'live', now(), 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.7 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.7', '10.7', 'understand the distinction between primary, secondary and tertiary halogenoalkanes', ARRAY['understand'], 'live', now(), 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.8 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.8', '10.8', 'understand the reactions of halogenoalkanes with: i aqueous alkali, including KOH(aq) to produce alcohols (where the hydroxide ion acts as a nucleophile) ii ethanolic potassium hydroxide to produce alkenes by an elimination reaction (where the hydroxide ion acts as a base) iii aqueous silver nitrate in ethanol (where water acts as a nucleophile) iv alcoholic ammonia under pressure to produce amines (where the ammonia acts as a nucleophile) v alcoholic potassium cyanide to produce nitriles (where the cyanide ion acts as a nucleophile) Students should know this is an example of increasing the length of the carbon chain.', ARRAY['understand'], 'live', now(), 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.9 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.9', '10.9', 'understand the mechanisms of the nucleophilic substitution reactions between primary halogenoalkanes and: i aqueous potassium hydroxide ii ammonia SN1 and SN2 substitution mechanisms will be tested in Unit 4.', ARRAY['understand'], 'live', now(), 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.10 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.10', '10.10', 'understand that experimental observations and data can be used to compare the relative rates of hydrolysis of: i primary, secondary and tertiary structural isomers of a halogenoalkane ii primary chloro-, bromo- and iodoalkanes using aqueous silver nitrate in ethanol', ARRAY['understand'], 'live', now(), 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.11 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.11', '10.11', 'CORE PRACTICAL 5 Investigation of the rates of hydrolysis of some halogenoalkanes.', NULL, 'live', now(), 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.12 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.12', '10.12', 'know the trend in reactivity of primary, secondary and tertiary halogenoalkanes', ARRAY['know'], 'live', now(), 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.13 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.13', '10.13', 'understand, in terms of bond enthalpy, the trend in reactivity of chloro-, bromo- and iodoalkanes', ARRAY['understand'], 'live', now(), 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.14 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.14', 'Core Practical 6: chlorination of 2-methylpropan-2-ol', 'CORE PRACTICAL 6 Chlorination of 2-methylpropan-2-ol with concentrated hydrochloric acid.', NULL, 'live', now(), 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Core Practical 6: chlorination of 2-methylpropan-2-ol';

-- 10.15 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.15', '10.15', 'understand the nomenclature of alcohols and be able to draw their structural, displayed and skeletal formulae', ARRAY['understand','draw'], 'live', now(), 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.16 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.16', 'Primary, secondary and tertiary alcohols', 'understand the distinction between primary, secondary and tertiary alcohols', ARRAY['understand'], 'live', now(), 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Primary, secondary and tertiary alcohols';

-- 10.17 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.17', 'Reactions of alcohols', 'understand the reactions of alcohols with: i oxygen in air (combustion) ii halogenating agents • PCl₅ to produce chloroalkanes (including its use as a qualitative test for the presence of the –OH group) • 50% concentrated sulfuric acid and potassium bromide to produce bromoalkanes • red phosphorus and iodine to produce iodoalkanes iii concentrated phosphoric acid to form alkenes by elimination Descriptions of the mechanisms of these reactions are not required.', ARRAY['understand'], 'live', now(), 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Reactions of alcohols';

-- 10.18 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.18', '10.18', 'understand that potassium dichromate(VI) in dilute sulfuric acid can oxidise: i primary alcohols to produce aldehydes (which give a positive result with Benedict’s or Fehling’s solution) if the product is distilled as it forms ii primary alcohols to produce carboxylic acids (which give a positive result with sodium carbonate or sodium hydrogencarbonate) if the reagents are heated under reflux iii secondary alcohols to produce ketones In equations, the oxidising agent can be represented by [O].', ARRAY['understand'], 'live', now(), 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.19 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.19', '10.19', 'understand, the following techniques in the preparation and purification of a liquid organic compound: i heating under reflux ii extraction with a solvent using a separating funnel iii distillation iv drying with an anhydrous salt v boiling temperature determination', ARRAY['understand'], 'live', now(), 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.20 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.20', 'Core Practical 7: oxidation of propan-1-ol', 'CORE PRACTICAL 7 The oxidation of propan-1-ol to produce propanal and propanoic acid.', NULL, 'live', now(), 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Core Practical 7: oxidation of propan-1-ol';

-- 10.21 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.21', '10.21', 'be able to interpret data from mass spectra to suggest possible structures of simple organic compounds using the m/z of the molecular ion and fragmentation patterns', ARRAY['interpret'], 'live', now(), 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.22 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.22', '10.22', 'be able to use infrared spectra, or data from infrared spectra, to deduce functional groups present in organic compounds, and predict infrared absorptions, given wavenumber data, due to familiar functional groups including: i C–H stretching absorptions in alkanes, alkenes and aldehydes ii C=C stretching absorption in alkenes iii O–H stretching absorptions in alcohols and carboxylic acids iv C=O stretching absorptions in aldehydes, ketones and carboxylic acids v C–X stretching absorption in halogenoalkanes vi N-H stretching absorption in amines', ARRAY['use'], 'live', now(), 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order;

-- 10.23 — official (Issue 1)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, verified_at, sort_order)
SELECT t.id, '10.23', 'Core Practical 8: analysis of inorganic and organic unknowns', 'CORE PRACTICAL 8 Analysis of some inorganic and organic unknowns.', NULL, 'live', now(), 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-ial-as-chemistry'
WHERE t.slug = 'halogenoalkanes-alcohols-spectra'
ON CONFLICT (topic_id, code) DO UPDATE
  SET description = EXCLUDED.description, command_terms = EXCLUDED.command_terms,
      status = 'live', verified_at = now(), sort_order = EXCLUDED.sort_order,
      title = 'Core Practical 8: analysis of inorganic and organic unknowns';

COMMIT;
