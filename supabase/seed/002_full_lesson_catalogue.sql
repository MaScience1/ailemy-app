-- ============================================================================
-- AILEMY — FULL LESSON CATALOGUE SEED
-- Edexcel IAL Chemistry: AS (82 lessons) + A2 (88 lessons) = 170 lessons total
--
-- Run as a single transaction in Supabase SQL Editor.
-- Idempotent via ON CONFLICT (course_id, slug).
--
-- VERIFY each lesson title against your own lesson plan after running.
-- Edit any mismatches directly in Supabase Table Editor.
-- ============================================================================

BEGIN;

-- ============================================================================
-- AS LESSONS — UNIT 1 (Lessons 1–37)
-- Structure, Bonding and Introduction to Organic Chemistry
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug = 'edexcel-ial-as-chemistry' AND u.slug = 'unit-1'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  ('definitions-formulae-and-the-mole',                  1, 'Definitions, formulae and the mole',                       'coming_soon',  1, false),
  ('relative-atomic-mass-and-isotopic-mass',             2, 'Relative atomic mass and isotopic mass',                   'coming_soon',  2, false),
  ('the-mole-and-avogadro-constant',                     3, 'The mole and Avogadro constant',                           'coming_soon',  3, false),
  ('solution-concentration',                             4, 'Solution concentration',                                   'coming_soon',  4, false),
  ('molar-mass-and-mole-conversions',                    5, 'Molar mass and mass–mole conversions',                     'coming_soon',  5, false),
  ('reacting-masses',                                    6, 'Reacting masses and stoichiometry',                        'coming_soon',  6, false),
  ('gases-molar-volume-and-ideal-gas-equation',          7, 'Gases — molar volume and the ideal gas equation',          'coming_soon',  7, false),
  ('percentage-yield-and-atom-economy',                  8, 'Percentage yield and atom economy',                        'coming_soon',  8, false),
  ('empirical-and-molecular-formulae',                   9, 'Empirical and molecular formulae',                         'coming_soon',  9, false),
  ('experimental-formula-equation-work-out',            10, 'Experimental formula determination',                       'coming_soon', 10, false),
  ('atoms-subatomic-particles-and-isotopes',            11, 'Atoms, subatomic particles and isotopes',                  'coming_soon', 11, false),
  ('mass-spectrometry-principles-and-isotopic-composition', 12, 'Mass spectrometry — principles and isotopic composition', 'coming_soon', 12, false),
  ('molecular-ion-peaks-and-diatomic-mass-spectra',     13, 'Molecular ion peaks and diatomic mass spectra',            'coming_soon', 13, false),
  ('ionisation-energies-and-shell-evidence',            14, 'Ionisation energies and evidence for shells',              'coming_soon', 14, false),
  ('orbital-and-subshell-filling',                      15, 'Orbital and subshell filling rules',                       'coming_soon', 15, false),
  ('electronic-configurations-s-p-d-block',             16, 'Electronic configurations across s, p, d block',           'coming_soon', 16, false),
  ('periodicity-and-ionisation-energy-trends',          17, 'Periodicity and ionisation energy trends',                 'coming_soon', 17, false),
  ('melting-and-boiling-trends-in-period-2-and-3',      18, 'Melting and boiling trends in Periods 2 and 3',            'coming_soon', 18, false),
  ('ionic-bonding-and-lattices',                        19, 'Ionic bonding and lattices',                               'coming_soon', 19, false),
  ('ionic-radius-charge-and-polarisation',              20, 'Ionic radius, charge and polarisation',                    'coming_soon', 20, false),
  ('covalent-bonding-and-dot-and-cross-diagrams',       21, 'Covalent bonding and dot-and-cross diagrams',              'coming_soon', 21, false),
  ('carbon-giant-covalent-structures',                  22, 'Carbon giant covalent structures (diamond, graphite, silicon dioxide)', 'coming_soon', 22, false),
  ('metallic-bonding-and-properties',                   23, 'Metallic bonding and properties of metals',                'coming_soon', 23, false),
  ('shapes-of-molecules-vsepr',                         24, 'Shapes of molecules (VSEPR theory)',                       'coming_soon', 24, false),
  ('electronegativity-and-bond-polarity',               25, 'Electronegativity and bond polarity',                      'coming_soon', 25, false),
  ('intermolecular-forces-london-and-dipole',           26, 'Intermolecular forces — London and permanent dipole',      'coming_soon', 26, false),
  ('hydrogen-bonding-and-anomalous-properties',         27, 'Hydrogen bonding and anomalous properties of water',       'coming_soon', 27, false),
  ('linking-structure-to-physical-properties',          28, 'Linking structure to physical properties',                 'coming_soon', 28, false),
  ('introduction-to-organic-chemistry-nomenclature',    29, 'Introduction to organic chemistry and IUPAC nomenclature', 'coming_soon', 29, false),
  ('structural-isomerism-and-formulae-types',           30, 'Structural isomerism and types of formulae',               'coming_soon', 30, false),
  ('alkanes-properties-and-combustion',                 31, 'Alkanes — properties and combustion',                      'coming_soon', 31, false),
  ('free-radical-substitution-of-alkanes',              32, 'Free radical substitution of alkanes',                     'coming_soon', 32, false),
  ('crude-oil-fractional-distillation-cracking',        33, 'Crude oil, fractional distillation and cracking',          'coming_soon', 33, false),
  ('alkenes-structure-and-bonding',                     34, 'Alkenes — structure and bonding',                          'coming_soon', 34, false),
  ('electrophilic-addition-of-alkenes',                 35, 'Electrophilic addition reactions of alkenes',              'coming_soon', 35, false),
  ('addition-polymerisation-and-polymer-uses',          36, 'Addition polymerisation and uses of polymers',             'coming_soon', 36, false),
  ('polymer-disposal-and-unit-1-consolidation',         37, 'Polymer disposal and Unit 1 consolidation',                'coming_soon', 37, false)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- AS LESSONS — UNIT 2 (Lessons 38–79)
-- Energetics, Group Chemistry, Halogenoalkanes and Alcohols
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug = 'edexcel-ial-as-chemistry' AND u.slug = 'unit-2'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  -- Energetics (38–44)
  ('enthalpy-changes-and-conventions',                  38, 'Enthalpy changes and sign conventions',                    'coming_soon', 38, false),
  ('standard-enthalpy-changes-definitions',             39, 'Standard enthalpy changes — definitions',                  'coming_soon', 39, false),
  ('calorimetry-and-q-mc-delta-t',                      40, 'Calorimetry and q = mcΔT calculations',                    'coming_soon', 40, false),
  ('hess-law-and-energy-cycles',                        41, 'Hess''s Law and energy cycles',                            'coming_soon', 41, false),
  ('enthalpy-of-combustion-and-formation-calculations', 42, 'Enthalpy of combustion and formation calculations',        'coming_soon', 42, false),
  ('mean-bond-enthalpies',                              43, 'Mean bond enthalpies and limitations',                     'coming_soon', 43, false),
  ('energetics-problem-solving',                        44, 'Energetics — exam-style problem solving',                  'coming_soon', 44, false),
  -- Redox + Groups 1, 2 (45–53)
  ('oxidation-numbers-and-redox-definitions',           45, 'Oxidation numbers and redox definitions',                  'coming_soon', 45, false),
  ('writing-redox-half-equations',                      46, 'Writing redox half-equations',                             'coming_soon', 46, false),
  ('disproportionation-reactions',                      47, 'Disproportionation reactions',                             'coming_soon', 47, false),
  ('group-2-physical-properties',                       48, 'Group 2 — physical properties and trends',                 'coming_soon', 48, false),
  ('group-2-reactions-with-water-oxygen',               49, 'Group 2 reactions with water and oxygen',                  'coming_soon', 49, false),
  ('group-2-thermal-stability-of-carbonates-nitrates',  50, 'Thermal stability of Group 2 carbonates and nitrates',     'coming_soon', 50, false),
  ('group-2-flame-tests-and-solubility',                51, 'Group 2 flame tests and hydroxide solubility',             'coming_soon', 51, false),
  ('qualitative-tests-for-anions',                      52, 'Qualitative tests for anions (sulfate, carbonate, halide)','coming_soon', 52, false),
  ('group-2-summary-and-practice',                      53, 'Group 2 summary and practice',                             'coming_soon', 53, false),
  -- Group 7 Halogens (54–59)
  ('group-7-physical-properties-and-trends',            54, 'Group 7 — physical properties and trends',                 'coming_soon', 54, false),
  ('halogen-displacement-reactions',                    55, 'Halogen displacement reactions and oxidising power',       'coming_soon', 55, false),
  ('halogens-with-alkali-disproportionation',           56, 'Halogens with alkali — disproportionation',                'coming_soon', 56, false),
  ('reactions-of-halide-ions-with-h2so4',               57, 'Reactions of halide ions with concentrated H₂SO₄',         'coming_soon', 57, false),
  ('chlorine-in-water-treatment-ethics',                58, 'Chlorine in water treatment — benefits and ethics',        'coming_soon', 58, false),
  ('group-7-summary-and-practice',                      59, 'Group 7 summary and practice',                             'coming_soon', 59, false),
  -- Kinetics (60–64)
  ('collision-theory-and-rate-factors',                 60, 'Collision theory and factors affecting rate',              'coming_soon', 60, false),
  ('maxwell-boltzmann-distribution',                    61, 'The Maxwell–Boltzmann distribution',                       'coming_soon', 61, false),
  ('activation-energy-and-temperature-effect',          62, 'Activation energy and effect of temperature',              'coming_soon', 62, false),
  ('catalysts-and-reaction-profiles',                   63, 'Catalysts and reaction profiles',                          'coming_soon', 63, false),
  ('kinetics-experiments-and-rate-graphs',              64, 'Kinetics experiments and interpreting rate graphs',        'coming_soon', 64, false),
  -- Equilibria (65–69)
  ('dynamic-equilibrium-and-reversible-reactions',      65, 'Dynamic equilibrium and reversible reactions',             'coming_soon', 65, false),
  ('le-chatelier-concentration-and-pressure',           66, 'Le Chatelier — concentration and pressure',                'coming_soon', 66, false),
  ('le-chatelier-temperature-and-catalysts',            67, 'Le Chatelier — temperature and the role of catalysts',     'coming_soon', 67, false),
  ('haber-and-contact-process-industrial',              68, 'Industrial applications — Haber and Contact processes',    'coming_soon', 68, false),
  ('equilibria-exam-questions-practice',                69, 'Equilibria exam questions and practice',                   'coming_soon', 69, false),
  -- Halogenoalkanes (70–73)
  ('halogenoalkanes-naming-and-classification',         70, 'Halogenoalkanes — naming and classification',              'coming_soon', 70, false),
  ('nucleophilic-substitution-mechanisms',              71, 'Nucleophilic substitution — Sn1 and Sn2 introduction',     'coming_soon', 71, false),
  ('elimination-reactions-of-halogenoalkanes',          72, 'Elimination reactions of halogenoalkanes',                 'coming_soon', 72, false),
  ('cfcs-ozone-and-environmental-impact',               73, 'CFCs, ozone depletion and environmental impact',           'coming_soon', 73, false),
  -- Alcohols (74–77)
  ('alcohols-classification-and-properties',            74, 'Alcohols — classification and physical properties',        'coming_soon', 74, false),
  ('oxidation-of-alcohols-with-conditions',             75, 'Oxidation of alcohols — products and conditions',          'coming_soon', 75, false),
  ('dehydration-and-substitution-of-alcohols',          76, 'Dehydration and halogen substitution of alcohols',         'coming_soon', 76, false),
  ('uses-of-alcohols-and-biofuels',                     77, 'Industrial uses of alcohols and biofuels',                 'coming_soon', 77, false),
  -- Mass spec / IR (78–79)
  ('mass-spectrometry-of-organic-compounds',            78, 'Mass spectrometry of organic compounds — fragmentation',   'coming_soon', 78, false),
  ('infrared-spectroscopy-and-functional-groups',       79, 'Infrared spectroscopy and identifying functional groups',  'coming_soon', 79, false)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- AS LESSONS — UNIT 3 (Lessons 80–82, Core Practicals)
-- Practical Skills in Chemistry I
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug = 'edexcel-ial-as-chemistry' AND u.slug = 'unit-3'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  ('cp1-acid-base-titration-and-mr-determination',  80, 'Core Practical 1: Acid–base titration and Mr determination', 'coming_soon', 80, true),
  ('cp2-preparation-of-an-organic-liquid-or-solid', 81, 'Core Practical 2: Preparation of an organic liquid or solid','coming_soon', 81, true),
  ('cp3-rates-of-reaction-by-various-methods',      82, 'Core Practical 3: Investigating rates of reaction',          'coming_soon', 82, true)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- A2 LESSONS — UNIT 4 (40 lessons)
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
-- A2 LESSONS — UNIT 5 (44 lessons, Lesson 41–84 of A2)
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
-- A2 LESSONS — UNIT 6 (4 lessons, 85–88, Core Practicals)
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

-- ============================================================================
-- LESSON ↔ SPEC POINTS — Lesson 1 only (your validation lesson)
-- Lesson 1 covers spec points 1.1 and 1.2 (per your lesson plan)
-- ============================================================================
INSERT INTO lesson_spec_points (lesson_id, spec_point_id)
SELECT l.id, sp.id
FROM lessons l
JOIN courses c    ON c.id = l.course_id
JOIN spec_points sp ON sp.topic_id IN (SELECT id FROM topics WHERE slug = 'formulae-equations-amounts')
WHERE c.slug = 'edexcel-ial-as-chemistry'
  AND l.slug = 'definitions-formulae-and-the-mole'
  AND sp.code IN ('1.1', '1.2')
ON CONFLICT (lesson_id, spec_point_id) DO NOTHING;

-- ============================================================================
-- Promote Lesson 1 to 'live'
-- ============================================================================
UPDATE lessons
SET status = 'live'::content_status
WHERE slug = 'definitions-formulae-and-the-mole'
  AND course_id IN (SELECT id FROM courses WHERE slug = 'edexcel-ial-as-chemistry');

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES — run these AFTER the seed, separately
-- Expected results in comments
-- ============================================================================

-- 170 total lessons
SELECT 'total lessons' AS metric, count(*) AS value FROM lessons;

-- 82 AS lessons
SELECT 'AS lessons' AS metric, count(*) AS value
FROM lessons l JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'edexcel-ial-as-chemistry';

-- 88 A2 lessons
SELECT 'A2 lessons' AS metric, count(*) AS value
FROM lessons l JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'edexcel-ial-a2-chemistry';

-- 7 Core Practicals across both years (3 AS + 4 A2)
SELECT 'core practicals' AS metric, count(*) AS value
FROM lessons WHERE is_core_practical = true;

-- 1 lesson currently 'live' (Lesson 1)
SELECT 'live lessons' AS metric, count(*) AS value
FROM lessons WHERE status = 'live';

-- 2 spec point links for Lesson 1 (1.1 and 1.2)
SELECT 'lesson 1 spec point links' AS metric, count(*) AS value
FROM lesson_spec_points lsp
JOIN lessons l ON l.id = lsp.lesson_id
WHERE l.slug = 'definitions-formulae-and-the-mole';

-- Per-unit counts
SELECT u.code AS unit, count(l.id) AS lesson_count
FROM units u LEFT JOIN lessons l ON l.unit_id = u.id
JOIN courses c ON c.id = u.course_id
WHERE c.slug IN ('edexcel-ial-as-chemistry', 'edexcel-ial-a2-chemistry')
GROUP BY u.code, u.sort_order
ORDER BY u.code;
-- Expected: WCH11=37, WCH12=42, WCH13=3, WCH14=40, WCH15=44, WCH16=4
