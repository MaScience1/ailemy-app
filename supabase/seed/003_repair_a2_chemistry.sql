-- ============================================================================
-- AILEMY — REPAIR PATCH: A2 Chemistry units + lessons
-- ----------------------------------------------------------------------------
-- Why this exists
-- ---------------
-- 001_catalogue_seed.sql only created three units, all under the AS course:
--   unit-1 (WCH11), unit-2 (WCH12), unit-3 (WCH13)
-- It never created A2 units (WCH14, WCH15, WCH16) under
-- edexcel-ial-a2-chemistry. So when 002_full_lesson_catalogue.sql tried to
-- insert A2 lessons, its CTE
--
--   SELECT c.id, u.id FROM courses c JOIN units u ON u.course_id = c.id
--   WHERE c.slug = 'edexcel-ial-a2-chemistry' AND u.slug = 'unit-4'
--
-- found no matching units row, returned zero rows, and the subsequent
--   FROM course_unit, (VALUES ...)
-- cross-joined against an empty CTE producing an empty INSERT projection.
-- Zero rows inserted, no error raised, transaction committed. Result:
-- WCH11=37, WCH12=42, WCH13=3 present; WCH14-WCH16 silently missing.
--
-- This patch
-- ----------
-- 1. Inserts the three missing A2 units (WCH14, WCH15, WCH16).
-- 2. Re-runs the three A2 lesson INSERT blocks from 002 verbatim. They were
--    already idempotent (ON CONFLICT (course_id, slug) DO NOTHING), but they
--    now have non-empty CTEs to join against.
--
-- Safe to re-run. All inserts use ON CONFLICT … DO NOTHING. After running:
--   SELECT u.code, count(l.id)
--   FROM units u LEFT JOIN lessons l ON l.unit_id = u.id
--   JOIN courses c ON c.id = u.course_id
--   WHERE c.slug IN ('edexcel-ial-as-chemistry','edexcel-ial-a2-chemistry')
--   GROUP BY u.code ORDER BY u.code;
-- should report: WCH11=37, WCH12=42, WCH13=3, WCH14=40, WCH15=44, WCH16=4.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. MISSING A2 UNITS
-- ============================================================================
INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-4', 'WCH14', 'Unit 4: Rates, Equilibria and Further Organic Chemistry',
  'The first A2 paper. Covers kinetics II, entropy, equilibria, acid-base equilibria, carbonyls, carboxylic acids and stereochemistry.',
  'coming_soon'::content_status, 4
FROM courses WHERE slug = 'edexcel-ial-a2-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-5', 'WCH15', 'Unit 5: Transition Metals and Organic Nitrogen Chemistry',
  'The second A2 paper. Covers redox equilibria, transition metals, arenes, organic nitrogen chemistry, polymers, synthesis and spectroscopy.',
  'coming_soon'::content_status, 5
FROM courses WHERE slug = 'edexcel-ial-a2-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-6', 'WCH16', 'Unit 6: Practical Skills in Chemistry II',
  'Practical assessment for A2 — core practicals 4 through 7.',
  'coming_soon'::content_status, 6
FROM courses WHERE slug = 'edexcel-ial-a2-chemistry'
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- 2. A2 LESSONS — UNIT 4 (40 lessons)
-- Rates, Equilibria and Further Organic Chemistry
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug = 'edexcel-ial-a2-chemistry' AND u.slug = 'unit-4'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  -- Kinetics II (1–6)
  ('rate-equations-and-order-of-reaction',              1, 'Rate equations and order of reaction',                     'coming_soon',  1, false),
  ('determining-orders-from-experimental-data',         2, 'Determining orders from experimental data',                'coming_soon',  2, false),
  ('rate-constants-units-and-temperature-dependence',   3, 'Rate constants — units and temperature dependence',        'coming_soon',  3, false),
  ('arrhenius-equation-and-activation-energy',          4, 'The Arrhenius equation and activation energy',             'coming_soon',  4, false),
  ('rate-determining-step-and-mechanisms',              5, 'The rate-determining step and reaction mechanisms',        'coming_soon',  5, false),
  ('kinetics-ii-problem-solving',                       6, 'Kinetics II — exam-style problem solving',                 'coming_soon',  6, false),
  -- Entropy & Equilibria II (7–13)
  ('entropy-and-second-law',                            7, 'Entropy and the second law of thermodynamics',             'coming_soon',  7, false),
  ('predicting-feasibility-with-delta-g',               8, 'Predicting feasibility with ΔG = ΔH − TΔS',                'coming_soon',  8, false),
  ('temperature-effect-on-feasibility',                 9, 'Effect of temperature on reaction feasibility',            'coming_soon',  9, false),
  ('equilibrium-constant-kc-and-expressions',          10, 'The equilibrium constant Kc and expressions',              'coming_soon', 10, false),
  ('calculating-kc-from-equilibrium-mixtures',         11, 'Calculating Kc from equilibrium concentrations',           'coming_soon', 11, false),
  ('kp-for-gaseous-equilibria',                        12, 'Kp for gaseous equilibria — partial pressures',            'coming_soon', 12, false),
  ('effect-of-conditions-on-kc-kp',                    13, 'Effect of temperature, pressure and catalysts on Kc/Kp',   'coming_soon', 13, false),
  -- Acid–Base Equilibria (14–22)
  ('bronsted-lowry-acids-and-bases',                   14, 'Brønsted–Lowry acids and bases and conjugate pairs',       'coming_soon', 14, false),
  ('ph-and-the-hydrogen-ion-concentration',            15, 'pH and the hydrogen ion concentration',                    'coming_soon', 15, false),
  ('ph-of-strong-acids-and-strong-bases',              16, 'pH of strong acids and strong bases',                      'coming_soon', 16, false),
  ('weak-acids-and-ka',                                17, 'Weak acids and the acid dissociation constant Ka',         'coming_soon', 17, false),
  ('pka-and-its-relationship-to-ka',                   18, 'pKa and its relationship to Ka',                           'coming_soon', 18, false),
  ('buffer-solutions-composition-and-action',          19, 'Buffer solutions — composition and mode of action',        'coming_soon', 19, false),
  ('buffer-calculations-henderson-hasselbalch',        20, 'Buffer calculations using Henderson–Hasselbalch',          'coming_soon', 20, false),
  ('titration-curves-and-indicator-choice',            21, 'Titration curves and choice of indicator',                 'coming_soon', 21, false),
  ('kw-temperature-and-ph-of-water',                   22, 'Kw, temperature and pH of pure water',                     'coming_soon', 22, false),
  -- Carbonyl chemistry (23–28)
  ('aldehydes-and-ketones-structure-naming',           23, 'Aldehydes and ketones — structure and naming',             'coming_soon', 23, false),
  ('oxidation-of-aldehydes-and-tests',                 24, 'Oxidation of aldehydes and identification tests',          'coming_soon', 24, false),
  ('reduction-of-carbonyls-with-nabh4',                25, 'Reduction of carbonyls with NaBH₄',                        'coming_soon', 25, false),
  ('nucleophilic-addition-of-hcn',                     26, 'Nucleophilic addition of HCN to carbonyls',                'coming_soon', 26, false),
  ('iodoform-reaction-and-methyl-ketone-test',         27, 'The iodoform reaction and methyl ketone test',             'coming_soon', 27, false),
  ('2-4-dnph-and-melting-point-identification',        28, '2,4-DNPH derivatives and melting point identification',    'coming_soon', 28, false),
  -- Carboxylic acids & derivatives (29–34)
  ('carboxylic-acids-properties-and-acidity',          29, 'Carboxylic acids — properties and acidity',                'coming_soon', 29, false),
  ('esterification-and-acid-anhydrides',               30, 'Esterification and reactions with acid anhydrides',        'coming_soon', 30, false),
  ('hydrolysis-of-esters-acid-and-base',               31, 'Hydrolysis of esters — acid and base catalysed',           'coming_soon', 31, false),
  ('acyl-chlorides-formation-and-reactions',           32, 'Acyl chlorides — formation and reactions',                 'coming_soon', 32, false),
  ('amides-formation-from-acyl-chlorides',             33, 'Amides — formation from acyl chlorides',                   'coming_soon', 33, false),
  ('triglycerides-soaps-and-biodiesel',                34, 'Triglycerides, soaps and biodiesel',                       'coming_soon', 34, false),
  -- Chirality & stereoisomerism (35–37)
  ('optical-isomerism-and-chirality',                  35, 'Optical isomerism and chirality',                          'coming_soon', 35, false),
  ('e-z-isomerism-and-cip-rules',                      36, 'E/Z isomerism and CIP priority rules',                     'coming_soon', 36, false),
  ('stereochemistry-in-organic-mechanisms',            37, 'Stereochemistry in organic mechanisms',                    'coming_soon', 37, false),
  -- Unit 4 consolidation (38–40)
  ('organic-synthesis-pathways-unit-4',                38, 'Organic synthesis pathways covered in Unit 4',             'coming_soon', 38, false),
  ('unit-4-equilibria-synoptic-review',                39, 'Unit 4 equilibria — synoptic review',                      'coming_soon', 39, false),
  ('unit-4-mechanisms-synoptic-review',                40, 'Unit 4 mechanisms — synoptic review',                      'coming_soon', 40, false)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- 3. A2 LESSONS — UNIT 5 (44 lessons, Lessons 41–84)
-- Transition Metals and Organic Nitrogen Chemistry
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug = 'edexcel-ial-a2-chemistry' AND u.slug = 'unit-5'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  -- Redox Equilibria (41–48)
  ('standard-electrode-potentials-introduction',       41, 'Standard electrode potentials — introduction',             'coming_soon', 41, false),
  ('measuring-electrode-potentials-and-she',           42, 'Measuring electrode potentials and the SHE',               'coming_soon', 42, false),
  ('electrochemical-cells-and-emf',                    43, 'Electrochemical cells and EMF calculations',               'coming_soon', 43, false),
  ('predicting-feasibility-from-e-cell',               44, 'Predicting feasibility from E°cell',                       'coming_soon', 44, false),
  ('limitations-of-electrode-potential-predictions',   45, 'Limitations of electrode potential predictions',           'coming_soon', 45, false),
  ('storage-cells-fuel-cells-applications',            46, 'Storage cells, fuel cells and applications',               'coming_soon', 46, false),
  ('redox-titrations-with-mno4-cr2o7',                 47, 'Redox titrations using MnO₄⁻ and Cr₂O₇²⁻',                'coming_soon', 47, false),
  ('iodine-thiosulfate-titrations',                    48, 'Iodine–thiosulfate titrations',                            'coming_soon', 48, false),
  -- Transition metals (49–58)
  ('transition-metals-definition-and-properties',      49, 'Transition metals — definition and properties',            'coming_soon', 49, false),
  ('electron-configuration-of-transition-metals',      50, 'Electron configurations of transition metals and ions',    'coming_soon', 50, false),
  ('variable-oxidation-states',                        51, 'Variable oxidation states and stability',                  'coming_soon', 51, false),
  ('coloured-ions-and-d-d-transitions',                52, 'Coloured ions and d–d transitions',                        'coming_soon', 52, false),
  ('uv-vis-spectroscopy-and-concentration',            53, 'UV–vis spectroscopy and determining concentration',        'coming_soon', 53, false),
  ('ligands-and-complex-ions',                         54, 'Ligands, complex ions and coordination number',            'coming_soon', 54, false),
  ('shapes-of-complexes-and-isomerism',                55, 'Shapes of complexes and complex-ion isomerism',            'coming_soon', 55, false),
  ('ligand-exchange-reactions-and-stability',          56, 'Ligand exchange reactions and stability constants',        'coming_soon', 56, false),
  ('catalysis-by-transition-metals',                   57, 'Catalysis by transition metals — heterogeneous and homogeneous','coming_soon', 57, false),
  ('qualitative-tests-for-transition-metal-ions',      58, 'Qualitative tests for transition metal ions',              'coming_soon', 58, false),
  -- Arenes (59–66)
  ('benzene-structure-and-bonding',                    59, 'Benzene — structure, bonding and delocalisation evidence', 'coming_soon', 59, false),
  ('naming-arenes-and-substituents',                   60, 'Naming arenes and arene substituents',                     'coming_soon', 60, false),
  ('electrophilic-substitution-mechanism-general',     61, 'Electrophilic substitution — general mechanism',           'coming_soon', 61, false),
  ('nitration-of-benzene',                             62, 'Nitration of benzene',                                     'coming_soon', 62, false),
  ('halogenation-of-benzene',                          63, 'Halogenation of benzene with halogen carriers',            'coming_soon', 63, false),
  ('friedel-crafts-acylation-and-alkylation',          64, 'Friedel–Crafts acylation and alkylation',                  'coming_soon', 64, false),
  ('phenol-acidity-and-reactions',                     65, 'Phenol — acidity and reactions with electrophiles',        'coming_soon', 65, false),
  ('directing-effects-of-substituents',                66, 'Directing effects of substituents on arenes',              'coming_soon', 66, false),
  -- Organic nitrogen (67–73)
  ('amines-classification-and-basicity',               67, 'Amines — classification and basicity',                     'coming_soon', 67, false),
  ('preparation-of-amines-from-halogenoalkanes',       68, 'Preparation of amines from halogenoalkanes',               'coming_soon', 68, false),
  ('preparation-of-aromatic-amines-by-reduction',      69, 'Preparation of aromatic amines by reduction',              'coming_soon', 69, false),
  ('diazonium-salts-and-azo-dyes',                     70, 'Diazonium salts and azo coupling for dyes',                'coming_soon', 70, false),
  ('amino-acids-structure-and-zwitterions',            71, 'Amino acids — structure and zwitterions',                  'coming_soon', 71, false),
  ('peptides-and-proteins-introduction',               72, 'Peptides and proteins — primary to quaternary structure',  'coming_soon', 72, false),
  ('condensation-polymers-polyamides-polyesters',      73, 'Condensation polymers — polyamides and polyesters',        'coming_soon', 73, false),
  -- Synthesis & analysis (74–84)
  ('organic-synthesis-route-planning',                 74, 'Organic synthesis — planning multi-step routes',           'coming_soon', 74, false),
  ('chromatography-tlc-and-paper',                     75, 'Chromatography — TLC and paper chromatography',            'coming_soon', 75, false),
  ('gas-chromatography-and-retention-times',           76, 'Gas chromatography and retention times',                   'coming_soon', 76, false),
  ('high-resolution-mass-spectrometry',                77, 'High-resolution mass spectrometry',                        'coming_soon', 77, false),
  ('infrared-spectroscopy-revisited',                  78, 'Infrared spectroscopy revisited — fingerprint region',     'coming_soon', 78, false),
  ('proton-nmr-introduction-and-tms',                  79, 'Proton NMR — introduction and the role of TMS',            'coming_soon', 79, false),
  ('proton-nmr-chemical-shift-and-integration',        80, 'Proton NMR — chemical shift and integration',              'coming_soon', 80, false),
  ('proton-nmr-spin-spin-coupling',                    81, 'Proton NMR — spin–spin coupling and splitting patterns',   'coming_soon', 81, false),
  ('carbon-13-nmr-and-interpretation',                 82, 'Carbon-13 NMR and interpretation',                         'coming_soon', 82, false),
  ('combined-spectra-problem-solving',                 83, 'Combined spectra problem solving',                         'coming_soon', 83, false),
  ('unit-5-synoptic-review',                           84, 'Unit 5 synoptic review',                                   'coming_soon', 84, false)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- 4. A2 LESSONS — UNIT 6 (4 lessons, 85–88, Core Practicals)
-- Practical Skills in Chemistry II
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug = 'edexcel-ial-a2-chemistry' AND u.slug = 'unit-6'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  ('cp4-preparation-of-an-organic-solid',              85, 'Core Practical 4: Preparation of an organic solid',        'coming_soon', 85, true),
  ('cp5-redox-titration-using-indicator',              86, 'Core Practical 5: Redox titration using an indicator',     'coming_soon', 86, true),
  ('cp6-kinetics-by-initial-rates-or-clock',           87, 'Core Practical 6: Kinetics by initial rates / clock reaction','coming_soon', 87, true),
  ('cp7-identifying-an-unknown-compound',              88, 'Core Practical 7: Identifying an unknown compound',        'coming_soon', 88, true)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

COMMIT;
