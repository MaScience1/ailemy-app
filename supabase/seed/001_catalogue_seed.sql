-- ============================================================================
-- AILEMY CATALOGUE SEED — v1.1
-- Idempotent: safe to re-run. All inserts use ON CONFLICT DO NOTHING.
-- ============================================================================

-- ============================================================================
-- SUBJECTS (3)
-- ============================================================================
INSERT INTO subjects (slug, name, color_as, color_a2, sort_order) VALUES
  ('chemistry', 'Chemistry', '#F97316', '#C2410C', 1),
  ('physics',   'Physics',   '#3B82F6', '#1E40AF', 2),
  ('biology',   'Biology',   '#EF4444', '#B91C1C', 3)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- CURRICULA (11)
-- ============================================================================
INSERT INTO curricula (slug, name, short_name, region, description, sort_order) VALUES
  ('ib',            'International Baccalaureate Diploma', 'IB',           'International',  'IB Diploma Programme — HL and SL', 1),
  ('edexcel-ial',   'Edexcel International A-Level',       'Edexcel IAL',  'International',  'Pearson Edexcel International Advanced Level', 2),
  ('edexcel-igcse', 'Edexcel International GCSE',          'Edexcel IGCSE','International',  'Pearson Edexcel International GCSE', 3),
  ('cie-igcse',     'Cambridge IGCSE',                     'CIE IGCSE',    'International',  'Cambridge Assessment International Education IGCSE', 4),
  ('ap',            'Advanced Placement',                  'AP',           'United States',  'College Board Advanced Placement', 5),
  ('edexcel-alevel','Edexcel A-Level',                     'Edexcel',      'United Kingdom', 'Pearson Edexcel A-Level (UK domestic)', 6),
  ('ocr-alevel',    'OCR A-Level',                         'OCR',          'United Kingdom', 'OCR A-Level (UK domestic)', 7),
  ('aqa-alevel',    'AQA A-Level',                         'AQA',          'United Kingdom', 'AQA A-Level (UK domestic)', 8),
  ('edexcel-gcse',  'Edexcel GCSE',                        'Edexcel GCSE', 'United Kingdom', 'Pearson Edexcel GCSE (UK domestic)', 9),
  ('ocr-gcse',      'OCR GCSE',                            'OCR GCSE',     'United Kingdom', 'OCR GCSE (UK domestic)', 10),
  ('aqa-gcse',      'AQA GCSE',                            'AQA GCSE',     'United Kingdom', 'AQA GCSE (UK domestic)', 11)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- COURSES (42)
-- All coming_soon except edexcel-ial-as-chemistry which is in_progress.
-- ============================================================================

-- IB (6)
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ib-chemistry-hl', 'IB Chemistry HL', 'HL', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ib' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ib-chemistry-sl', 'IB Chemistry SL', 'SL', 'coming_soon', 2
FROM curricula c, subjects s WHERE c.slug='ib' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ib-physics-hl', 'IB Physics HL', 'HL', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ib' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ib-physics-sl', 'IB Physics SL', 'SL', 'coming_soon', 2
FROM curricula c, subjects s WHERE c.slug='ib' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ib-biology-hl', 'IB Biology HL', 'HL', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ib' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ib-biology-sl', 'IB Biology SL', 'SL', 'coming_soon', 2
FROM curricula c, subjects s WHERE c.slug='ib' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- Edexcel IAL (6) — AS Chemistry is in_progress
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-ial-as-chemistry', 'Edexcel IAL AS Chemistry', 'AS', 'in_progress', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-ial' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-ial-a2-chemistry', 'Edexcel IAL A2 Chemistry', 'A2', 'coming_soon', 2
FROM curricula c, subjects s WHERE c.slug='edexcel-ial' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-ial-as-physics', 'Edexcel IAL AS Physics', 'AS', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-ial' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-ial-a2-physics', 'Edexcel IAL A2 Physics', 'A2', 'coming_soon', 2
FROM curricula c, subjects s WHERE c.slug='edexcel-ial' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-ial-as-biology', 'Edexcel IAL AS Biology', 'AS', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-ial' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-ial-a2-biology', 'Edexcel IAL A2 Biology', 'A2', 'coming_soon', 2
FROM curricula c, subjects s WHERE c.slug='edexcel-ial' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- Edexcel IGCSE (3)
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-igcse-chemistry', 'Edexcel IGCSE Chemistry', 'IGCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-igcse' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-igcse-physics', 'Edexcel IGCSE Physics', 'IGCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-igcse' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-igcse-biology', 'Edexcel IGCSE Biology', 'IGCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-igcse' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- Cambridge IGCSE (3)
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'cie-igcse-chemistry', 'Cambridge IGCSE Chemistry', 'IGCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='cie-igcse' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'cie-igcse-physics', 'Cambridge IGCSE Physics', 'IGCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='cie-igcse' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'cie-igcse-biology', 'Cambridge IGCSE Biology', 'IGCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='cie-igcse' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- AP (3)
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ap-chemistry', 'AP Chemistry', 'AP', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ap' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ap-physics', 'AP Physics', 'AP', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ap' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ap-biology', 'AP Biology', 'AP', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ap' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- Edexcel A-Level UK (6)
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-alevel-as-chemistry', 'Edexcel AS Chemistry', 'AS', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-alevel' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-alevel-a2-chemistry', 'Edexcel A2 Chemistry', 'A2', 'coming_soon', 2
FROM curricula c, subjects s WHERE c.slug='edexcel-alevel' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-alevel-as-physics', 'Edexcel AS Physics', 'AS', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-alevel' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-alevel-a2-physics', 'Edexcel A2 Physics', 'A2', 'coming_soon', 2
FROM curricula c, subjects s WHERE c.slug='edexcel-alevel' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-alevel-as-biology', 'Edexcel AS Biology', 'AS', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-alevel' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-alevel-a2-biology', 'Edexcel A2 Biology', 'A2', 'coming_soon', 2
FROM curricula c, subjects s WHERE c.slug='edexcel-alevel' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- OCR A-Level (3)
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ocr-alevel-chemistry', 'OCR A-Level Chemistry', 'A-Level', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ocr-alevel' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ocr-alevel-physics', 'OCR A-Level Physics', 'A-Level', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ocr-alevel' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ocr-alevel-biology', 'OCR A-Level Biology', 'A-Level', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ocr-alevel' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- AQA A-Level (3)
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'aqa-alevel-chemistry', 'AQA A-Level Chemistry', 'A-Level', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='aqa-alevel' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'aqa-alevel-physics', 'AQA A-Level Physics', 'A-Level', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='aqa-alevel' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'aqa-alevel-biology', 'AQA A-Level Biology', 'A-Level', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='aqa-alevel' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- Edexcel GCSE (3)
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-gcse-chemistry', 'Edexcel GCSE Chemistry', 'GCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-gcse' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-gcse-physics', 'Edexcel GCSE Physics', 'GCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-gcse' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'edexcel-gcse-biology', 'Edexcel GCSE Biology', 'GCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='edexcel-gcse' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- OCR GCSE (3)
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ocr-gcse-chemistry', 'OCR GCSE Chemistry', 'GCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ocr-gcse' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ocr-gcse-physics', 'OCR GCSE Physics', 'GCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ocr-gcse' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'ocr-gcse-biology', 'OCR GCSE Biology', 'GCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='ocr-gcse' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- AQA GCSE (3)
INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'aqa-gcse-chemistry', 'AQA GCSE Chemistry', 'GCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='aqa-gcse' AND s.slug='chemistry'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'aqa-gcse-physics', 'AQA GCSE Physics', 'GCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='aqa-gcse' AND s.slug='physics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO courses (curriculum_id, subject_id, slug, name, level, status, sort_order)
SELECT c.id, s.id, 'aqa-gcse-biology', 'AQA GCSE Biology', 'GCSE', 'coming_soon', 1
FROM curricula c, subjects s WHERE c.slug='aqa-gcse' AND s.slug='biology'
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- UNITS — Edexcel IAL AS Chemistry (3)
-- ============================================================================
INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-1', 'WCH11', 'Unit 1: Structure, Bonding and Introduction to Organic Chemistry',
  'The first AS paper. Covers atomic structure, formulae, equations, bonding, and introductory organic chemistry.',
  'in_progress', 1
FROM courses WHERE slug='edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-2', 'WCH12', 'Unit 2: Energetics, Group Chemistry, Halogenoalkanes and Alcohols',
  'The second AS paper. Covers energetics, kinetics, equilibria, group chemistry, and organic chemistry.',
  'coming_soon', 2
FROM courses WHERE slug='edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-3', 'WCH13', 'Unit 3: Practical Skills in Chemistry I',
  'Practical assessment for AS — apparatus, procedures, and analysis.',
  'coming_soon', 3
FROM courses WHERE slug='edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- TOPICS — Edexcel IAL AS Chemistry Unit 1 (4)
-- ============================================================================
INSERT INTO topics (course_id, unit_id, slug, code, name, description, status, sort_order)
SELECT c.id, u.id, 'formulae-equations-amounts', 'Topic 1',
  'Formulae, Equations and Amounts of Substance',
  'Atoms, moles, equations, and quantitative chemistry foundations',
  'in_progress', 1
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-1'
WHERE c.slug='edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO topics (course_id, unit_id, slug, code, name, description, status, sort_order)
SELECT c.id, u.id, 'atomic-structure-periodic-table', 'Topic 2',
  'Atomic Structure and the Periodic Table',
  'Subatomic particles, electron configuration, periodic trends',
  'coming_soon', 2
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-1'
WHERE c.slug='edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO topics (course_id, unit_id, slug, code, name, description, status, sort_order)
SELECT c.id, u.id, 'bonding-structure', 'Topic 3',
  'Bonding and Structure',
  'Ionic, covalent and metallic bonding; structures and properties',
  'coming_soon', 3
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-1'
WHERE c.slug='edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO topics (course_id, unit_id, slug, code, name, description, status, sort_order)
SELECT c.id, u.id, 'intro-organic-hydrocarbons', 'Topic 4',
  'Introduction to Organic Chemistry — Hydrocarbons',
  'Alkanes, alkenes, isomerism, and combustion',
  'coming_soon', 4
FROM courses c JOIN units u ON u.course_id = c.id AND u.slug = 'unit-1'
WHERE c.slug='edexcel-ial-as-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- SPEC POINTS — Topic 1 (13 spec points, all DRAFT until verified)
-- ============================================================================
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.1', 'Atoms and isotopes',
  'Recall that atoms consist of a nucleus containing protons and neutrons surrounded by electrons; recognise isotopes as atoms with the same number of protons but different numbers of neutrons.',
  ARRAY['recall','recognise'], 'draft', 1
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.2', 'Relative atomic, isotopic and molecular masses',
  'Define relative atomic mass (Ar), relative isotopic mass, and relative molecular mass (Mr); calculate Ar from isotopic abundances.',
  ARRAY['define','calculate'], 'draft', 2
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.3', 'The mole and Avogadro constant',
  'Understand the mole as a unit of amount of substance; relate moles to the Avogadro constant (6.022 × 10²³); calculate the number of particles in a given amount.',
  ARRAY['understand','calculate'], 'draft', 3
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.4', 'Molar mass and mass-mole conversions',
  'Calculate molar mass from Mr; convert between mass, moles, and number of particles using n = m/M.',
  ARRAY['calculate','convert'], 'draft', 4
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.5', 'Empirical and molecular formulae',
  'Determine empirical formulae from percentage composition or combustion data; calculate molecular formulae from empirical formula and Mr.',
  ARRAY['determine','calculate'], 'draft', 5
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.6', 'Concentration of solutions',
  'Calculate concentration in mol dm⁻³ and g dm⁻³; use c = n/V to find moles, concentration, or volume.',
  ARRAY['calculate'], 'draft', 6
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.7', 'Volumes of gases — molar volume',
  'Use molar volume at standard conditions (24 dm³ mol⁻¹ at RTP) to calculate volumes of gases or moles from volumes.',
  ARRAY['calculate','apply'], 'draft', 7
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.8', 'Stoichiometry in balanced equations',
  'Use stoichiometric ratios from balanced equations to calculate masses, moles, volumes, and concentrations of reactants or products.',
  ARRAY['calculate','apply'], 'draft', 8
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.9', 'Percentage yield',
  'Define and calculate percentage yield using actual yield and theoretical yield; explain reasons for yields below 100%.',
  ARRAY['define','calculate','explain'], 'draft', 9
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.10', 'Atom economy',
  'Define atom economy; calculate atom economy from balanced equations; evaluate sustainability of reactions using atom economy.',
  ARRAY['define','calculate','evaluate'], 'draft', 10
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.11', 'Acids, bases and salts',
  'Recall definitions of acids and bases; recognise common acid-base reactions; write balanced equations for neutralisation.',
  ARRAY['recall','recognise','write'], 'draft', 11
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.12', 'Titration calculations',
  'Carry out titration calculations to determine unknown concentrations using c₁V₁/n₁ = c₂V₂/n₂.',
  ARRAY['calculate','apply'], 'draft', 12
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;

INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT id, '1.13', 'Ionic equations',
  'Write ionic equations for precipitation and neutralisation reactions; identify spectator ions.',
  ARRAY['write','identify'], 'draft', 13
FROM topics WHERE slug='formulae-equations-amounts'
ON CONFLICT (topic_id, code) DO NOTHING;
