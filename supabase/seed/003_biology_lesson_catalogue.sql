-- ============================================================================
-- AILEMY — BIOLOGY LESSON CATALOGUE SEED
-- Edexcel IAL Biology: AS (100 lessons) + A2 (105 lessons) = 205 lessons total
--
-- Run as a single transaction in Supabase SQL Editor.
-- Idempotent via ON CONFLICT (course_id, slug).
--
-- VERIFY each lesson title against your own lesson plan after running.
-- Edit any mismatches directly in Supabase Table Editor.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. SANITY CHECK — confirm Biology courses exist before seeding
-- ============================================================================
DO $$
DECLARE
  as_exists boolean;
  a2_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM courses WHERE slug='edexcel-ial-as-biology') INTO as_exists;
  SELECT EXISTS(SELECT 1 FROM courses WHERE slug='edexcel-ial-a2-biology') INTO a2_exists;

  IF NOT as_exists THEN
    RAISE EXCEPTION 'Course edexcel-ial-as-biology does not exist. Add the course before seeding Biology lessons.';
  END IF;
  IF NOT a2_exists THEN
    RAISE EXCEPTION 'Course edexcel-ial-a2-biology does not exist. Add the course before seeding Biology lessons.';
  END IF;
END $$;

-- ============================================================================
-- 1. BIOLOGY AS UNITS (WBI11, WBI12, WBI13)
-- ============================================================================
INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-1', 'WBI11', 'Unit 1: Molecules, Diet, Transport and Health',
  'AS Year 12 paper. Covers biological molecules, mammalian transport systems, and health.',
  'coming_soon', 1
FROM courses WHERE slug='edexcel-ial-as-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-2', 'WBI12', 'Unit 2: Cells, Development, Biodiversity and Conservation',
  'AS Year 12 paper. Covers cell biology, reproduction, plant biology, biodiversity and conservation.',
  'coming_soon', 2
FROM courses WHERE slug='edexcel-ial-as-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-3', 'WBI13', 'Unit 3: Practical Skills in Biology I',
  'AS practical assessment — investigative skills, methods, and data analysis.',
  'coming_soon', 3
FROM courses WHERE slug='edexcel-ial-as-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- 2. BIOLOGY A2 UNITS (WBI14, WBI15, WBI16)
-- ============================================================================
INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-4', 'WBI14', 'Unit 4: Energy, Environment, Microbiology and Immunity',
  'A2 Year 13 paper. Covers photosynthesis, ecology, microbiology, and immunology.',
  'coming_soon', 1
FROM courses WHERE slug='edexcel-ial-a2-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-5', 'WBI15', 'Unit 5: Respiration, Internal Environment, Coordination and Gene Technology',
  'A2 Year 13 paper. Covers respiration, homeostasis, nervous coordination, and biotechnology.',
  'coming_soon', 2
FROM courses WHERE slug='edexcel-ial-a2-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

INSERT INTO units (course_id, slug, code, name, description, status, sort_order)
SELECT id, 'unit-6', 'WBI16', 'Unit 6: Practical Skills in Biology II',
  'A2 practical assessment — synoptic investigations and scientific articles.',
  'coming_soon', 3
FROM courses WHERE slug='edexcel-ial-a2-biology'
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- 3. AS BIOLOGY LESSONS — UNIT 1 (Lessons 1–46)
-- Molecules, Diet, Transport and Health
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug='edexcel-ial-as-biology' AND u.slug='unit-1'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  -- Topic 1: Molecules, Transport and Health (1–22)
  ('water-as-a-biological-solvent',                        1,  'Water as a biological solvent',                                                'coming_soon',  1, false),
  ('carbohydrates-mono-di-polysaccharides',                2,  'Carbohydrates: monosaccharides, disaccharides and polysaccharides',            'coming_soon',  2, false),
  ('energy-storage-starch-glycogen-amylose-amylopectin',   3,  'Energy-storage roles of starch, glycogen, amylose and amylopectin',            'coming_soon',  3, false),
  ('cp1-benedicts-iodine-tests',                           4,  'Core Practical 1: Benedict''s and iodine semi-quantitative tests',             'coming_soon',  4, true),
  ('condensation-hydrolysis-glycosidic-bonds',             5,  'Condensation, hydrolysis and glycosidic bonds',                                'coming_soon',  5, false),
  ('triglycerides-and-ester-bonds',                        6,  'Triglycerides and ester bonds',                                                'coming_soon',  6, false),
  ('saturated-vs-unsaturated-lipids',                      7,  'Saturated vs unsaturated lipids',                                              'coming_soon',  7, false),
  ('why-animals-need-mass-transport',                      8,  'Why animals need mass transport systems',                                      'coming_soon',  8, false),
  ('arteries-veins-capillaries-structure-function',        9,  'Arteries, veins and capillaries: structure-function relationships',            'coming_soon',  9, false),
  ('mammalian-heart-structure-and-vessels',               10,  'Mammalian heart structure and major blood vessels',                            'coming_soon', 10, false),
  ('cardiac-cycle-systole-diastole',                      11,  'Cardiac cycle: atrial systole, ventricular systole and diastole',              'coming_soon', 11, false),
  ('haemoglobin-and-oxygen-carbon-dioxide-transport',     12,  'Haemoglobin and oxygen/carbon dioxide transport',                              'coming_soon', 12, false),
  ('oxygen-dissociation-bohr-fetal-haemoglobin',          13,  'Oxygen dissociation curves, Bohr effect and fetal haemoglobin',                'coming_soon', 13, false),
  ('atherosclerosis-plaques-blood-pressure',              14,  'Atherosclerosis: endothelial dysfunction, inflammation, plaques and blood pressure', 'coming_soon', 14, false),
  ('blood-clotting-and-cardiovascular-disease',           15,  'Blood clotting and cardiovascular disease',                                    'coming_soon', 15, false),
  ('cvd-risk-factors',                                    16,  'CVD risk factors: genetics, diet, age, gender, hypertension, smoking and inactivity', 'coming_soon', 16, false),
  ('dietary-antioxidants-and-cv-health',                  17,  'Dietary antioxidants and cardiovascular health',                               'coming_soon', 17, false),
  ('cp2-vitamin-c-content',                               18,  'Core Practical 2: vitamin C content of food and drink',                        'coming_soon', 18, true),
  ('health-risk-data-correlation-causation',              19,  'Health-risk data: illness, mortality, correlation and causation',              'coming_soon', 19, false),
  ('evaluating-health-studies',                           20,  'Evaluating health studies: sample selection, sample size, validity and reliability', 'coming_soon', 20, false),
  ('risk-perception-and-lifestyle-choices',               21,  'Risk perception and lifestyle choices',                                        'coming_soon', 21, false),
  ('cholesterol-obesity-cvd-treatments',                  22,  'Cholesterol, obesity indicators and cardiovascular disease treatments',        'coming_soon', 22, false),

  -- Topic 2: Membranes, Proteins, DNA and Gene Expression (23–46)
  ('gas-exchange-surfaces-and-ficks-law',                 23,  'Gas exchange surfaces and Fick''s Law',                                        'coming_soon', 23, false),
  ('mammalian-lung-structure-and-adaptations',            24,  'Mammalian lung structure and adaptations',                                     'coming_soon', 24, false),
  ('membrane-structure-fluid-mosaic-model',               25,  'Membrane structure and the fluid mosaic model',                                'coming_soon', 25, false),
  ('cp3-membrane-permeability',                           26,  'Core Practical 3: membrane permeability, alcohol and temperature',             'coming_soon', 26, true),
  ('osmosis-and-water-potential',                         27,  'Osmosis and water potential',                                                  'coming_soon', 27, false),
  ('passive-facilitated-active-transport',                28,  'Passive transport, facilitated diffusion and active transport',                'coming_soon', 28, false),
  ('endocytosis-exocytosis-and-atp',                      29,  'Endocytosis, exocytosis and ATP in membrane transport',                        'coming_soon', 29, false),
  ('amino-acids-peptide-bonds-protein-formation',         30,  'Amino acids, peptide bonds and protein formation',                             'coming_soon', 30, false),
  ('protein-structure-primary-to-tertiary',               31,  'Protein structure: primary to tertiary; globular and fibrous proteins',        'coming_soon', 31, false),
  ('haemoglobin-and-collagen-comparisons',                32,  'Haemoglobin and collagen: structure-function comparisons',                     'coming_soon', 32, false),
  ('enzyme-specificity-activation-energy',                33,  'Enzyme specificity, activation energy and enzyme types',                       'coming_soon', 33, false),
  ('cp4-enzyme-initial-rate-factors',                     34,  'Core Practical 4: factors affecting enzyme initial rate',                      'coming_soon', 34, true),
  ('mononucleotides-dna-rna-structure',                   35,  'Mononucleotides, DNA and RNA structure',                                       'coming_soon', 35, false),
  ('dna-double-helix-base-pairing',                       36,  'DNA double helix and complementary base pairing',                              'coming_soon', 36, false),
  ('dna-replication-and-polymerase',                      37,  'DNA replication and DNA polymerase',                                           'coming_soon', 37, false),
  ('meselson-stahl-semi-conservative-replication',        38,  'Meselson and Stahl: evidence for semi-conservative replication',               'coming_soon', 38, false),
  ('genetic-code-and-gene-definition',                    39,  'Genetic code and gene definition',                                             'coming_soon', 39, false),
  ('protein-synthesis-transcription',                     40,  'Protein synthesis I: transcription',                                           'coming_soon', 40, false),
  ('protein-synthesis-translation',                       41,  'Protein synthesis II: translation, mRNA, tRNA, ribosomes and codons',          'coming_soon', 41, false),
  ('mutations-substitution-insertion-deletion',           42,  'Mutations: substitution, insertion, deletion and outcomes',                    'coming_soon', 42, false),
  ('monohybrid-inheritance-and-crosses',                  43,  'Monohybrid inheritance terminology and crosses',                               'coming_soon', 43, false),
  ('pedigrees-codominance-sex-linkage',                   44,  'Pedigrees, codominance and sex linkage',                                       'coming_soon', 44, false),
  ('cystic-fibrosis-mutation-and-effects',                45,  'Cystic fibrosis: gene mutation and body-system effects',                       'coming_soon', 45, false),
  ('genetic-screening-and-ethics',                        46,  'Genetic screening and ethical/social issues',                                  'coming_soon', 46, false)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- 4. AS BIOLOGY LESSONS — UNIT 2 (Lessons 47–94)
-- Cells, Development, Biodiversity and Conservation
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug='edexcel-ial-as-biology' AND u.slug='unit-2'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  -- Topic 3: Cell Structure, Reproduction and Development (47–70)
  ('cells-tissues-organs-and-systems',                    47,  'Cells as units; tissues, organs and organ systems',                            'coming_soon', 47, false),
  ('eukaryotic-ultrastructure-organelles',                48,  'Eukaryotic ultrastructure and organelle functions',                            'coming_soon', 48, false),
  ('rough-er-golgi-protein-transport',                    49,  'Rough ER, Golgi apparatus and protein transport',                              'coming_soon', 49, false),
  ('prokaryotic-ultrastructure-functions',                50,  'Prokaryotic ultrastructure and functions',                                     'coming_soon', 50, false),
  ('recognising-organelles-electron-micrographs',         51,  'Recognising organelles in electron micrographs',                               'coming_soon', 51, false),
  ('microscopy-magnification-resolution-staining',        52,  'Microscopy: magnification, resolution and staining',                           'coming_soon', 52, false),
  ('cp5-observing-and-drawing-animal-cells',              53,  'Core Practical 5: observing and drawing animal cells',                         'coming_soon', 53, true),
  ('cp5-graticules-measurement-scale',                    54,  'Core Practical 5: graticules, measurement and scale',                          'coming_soon', 54, true),
  ('loci-and-gene-linkage',                               55,  'Loci and gene linkage',                                                        'coming_soon', 55, false),
  ('meiosis-assortment-and-crossing-over',                56,  'Meiosis: independent assortment and crossing over',                            'coming_soon', 56, false),
  ('specialisation-of-mammalian-gametes',                 57,  'Specialisation of mammalian gametes',                                          'coming_soon', 57, false),
  ('fertilisation-in-mammals',                            58,  'Fertilisation in mammals',                                                     'coming_soon', 58, false),
  ('fertilisation-in-flowering-plants',                   59,  'Fertilisation in flowering plants',                                            'coming_soon', 59, false),
  ('mitosis-and-the-cell-cycle',                          60,  'Mitosis and the cell cycle',                                                   'coming_soon', 60, false),
  ('cp6-root-tip-squash-mitosis',                         61,  'Core Practical 6: root tip squash and mitosis stages',                         'coming_soon', 61, true),
  ('mitotic-index-calculations',                          62,  'Mitotic index calculations',                                                   'coming_soon', 62, false),
  ('stem-cells-potency-morula-blastocyst',                63,  'Stem cells, potency, morula and blastocyst',                                   'coming_soon', 63, false),
  ('stem-cells-medical-uses-and-ethics',                  64,  'Medical uses and ethical decisions around stem cells',                         'coming_soon', 64, false),
  ('differential-gene-expression-specialisation',         65,  'Differential gene expression and cell specialisation',                         'coming_soon', 65, false),
  ('post-transcriptional-mrna-changes',                   66,  'Post-transcriptional changes to mRNA',                                         'coming_soon', 66, false),
  ('genotype-environment-and-phenotype',                  67,  'Genotype, environment and phenotype',                                          'coming_soon', 67, false),
  ('epigenetics-methylation-histone-modification',        68,  'Epigenetics: DNA methylation and histone modification',                        'coming_soon', 68, false),
  ('multiple-alleles-polygenic-continuous-variation',     69,  'Multiple alleles, polygenic inheritance and continuous variation',             'coming_soon', 69, false),
  ('topic-3-consolidation',                               70,  'Topic 3 consolidation: microscopy, cell division and gene expression',         'coming_soon', 70, false),

  -- Topic 4: Plant Structure and Function, Biodiversity and Conservation (71–94)
  ('plant-cell-ultrastructure-vs-animal',                 71,  'Plant cell ultrastructure and comparison with animal cells',                   'coming_soon', 71, false),
  ('recognising-plant-organelles-em',                     72,  'Recognising plant organelles in electron micrographs',                         'coming_soon', 72, false),
  ('starch-and-cellulose-structure-function',             73,  'Starch and cellulose: structure-function relationships',                       'coming_soon', 73, false),
  ('cellulose-microfibrils-secondary-thickening',         74,  'Cellulose microfibrils, secondary thickening and support tissues',             'coming_soon', 74, false),
  ('sclerenchyma-xylem-phloem',                           75,  'Sclerenchyma, xylem and phloem: structure, position and function',             'coming_soon', 75, false),
  ('cp7-plan-diagrams-roots-stems-leaves',                76,  'Core Practical 7: plan diagrams of roots, stems and leaves',                   'coming_soon', 76, true),
  ('cp7-plant-tissues-vascular-identification',           77,  'Core Practical 7: plant tissues and vascular tissue identification',           'coming_soon', 77, true),
  ('sustainable-uses-of-plant-fibres-and-starch',         78,  'Sustainable uses of plant fibres and starch',                                  'coming_soon', 78, false),
  ('water-and-mineral-ions-in-plant-growth',              79,  'Water and mineral ions in plant growth',                                       'coming_soon', 79, false),
  ('cp8-tensile-strength-plant-fibres',                   80,  'Core Practical 8: tensile strength of plant fibres',                           'coming_soon', 80, true),
  ('conditions-for-bacterial-growth',                     81,  'Conditions required for bacterial growth',                                     'coming_soon', 81, false),
  ('plant-antimicrobials-therapeutic-properties',         82,  'Plant antimicrobials and therapeutic properties',                              'coming_soon', 82, false),
  ('cp9-antimicrobial-aseptic-technique',                 83,  'Core Practical 9: antimicrobial properties and aseptic technique',             'coming_soon', 83, true),
  ('drug-testing-withering-placebo-trials',               84,  'Drug testing: Withering, placebo, double-blind and three-phase trials',        'coming_soon', 84, false),
  ('classification-species-molecular-evidence',           85,  'Classification, species concept and molecular evidence',                       'coming_soon', 85, false),
  ('biodiversity-endemism-human-threats',                 86,  'Biodiversity, endemism and human threats',                                     'coming_soon', 86, false),
  ('species-richness-and-heterozygosity-index',           87,  'Species richness and heterozygosity index',                                    'coming_soon', 87, false),
  ('index-of-diversity-calculations',                     88,  'Index of diversity calculations',                                              'coming_soon', 88, false),
  ('niches-and-adaptations',                              89,  'Niches and adaptations',                                                       'coming_soon', 89, false),
  ('hardy-weinberg-and-allele-frequency',                 90,  'Hardy-Weinberg equation and allele-frequency change',                          'coming_soon', 90, false),
  ('mutation-natural-selection-speciation-as',            91,  'Mutation, natural selection and speciation',                                   'coming_soon', 91, false),
  ('conservation-zoos-seed-banks',                        92,  'Conservation: zoos and seed banks',                                            'coming_soon', 92, false),
  ('unit-2-practical-and-data-skills-review',             93,  'Unit 2 practical and data-skills review',                                      'coming_soon', 93, false),
  ('as-biology-synoptic-consolidation',                   94,  'AS Biology synoptic consolidation and exam practice',                          'coming_soon', 94, false)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- 5. AS BIOLOGY LESSONS — UNIT 3 (Lessons 95–100, Practical Skills I)
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug='edexcel-ial-as-biology' AND u.slug='unit-3'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  ('planning-investigations-hypotheses-variables',        95,  'Planning investigations: hypotheses, variables and apparatus',                 'coming_soon', 95, false),
  ('implementation-measurements-safety-uncertainty',      96,  'Implementation: measurements, safety, uncertainty and error',                  'coming_soon', 96, false),
  ('processing-results-tables-graphs-conclusions',        97,  'Processing results: tables, graphs, calculations and conclusions',             'coming_soon', 97, false),
  ('unit-3-practical-paper-practice',                     98,  'Unit 3 practical-paper practice using unfamiliar contexts',                    'coming_soon', 98, false),
  ('as-command-words-extended-response',                  99,  'AS command words and extended-response technique',                             'coming_soon', 99, false),
  ('as-mock-review-and-improvement',                     100,  'AS mock review and improvement cycle',                                         'coming_soon', 100, false)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- 6. A2 BIOLOGY LESSONS — UNIT 4 (Lessons 1–51)
-- Energy, Environment, Microbiology and Immunity
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug='edexcel-ial-a2-biology' AND u.slug='unit-4'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  -- Topic 5: Energy Flow, Ecosystems and the Environment (1–29)
  ('photosynthesis-overview-and-reaction',                 1,  'Photosynthesis overview and overall reaction',                                 'coming_soon',  1, false),
  ('atp-adp-phosphorylation-hydrolysis',                   2,  'ATP, ADP, phosphorylation and hydrolysis',                                     'coming_soon',  2, false),
  ('light-dependent-reactions-chlorophyll',                3,  'Light-dependent reactions: chlorophyll excitation and photolysis',             'coming_soon',  3, false),
  ('cyclic-and-non-cyclic-photophosphorylation',           4,  'Cyclic and non-cyclic photophosphorylation',                                   'coming_soon',  4, false),
  ('light-independent-reactions-calvin-cycle',             5,  'Light-independent reactions and the Calvin cycle',                             'coming_soon',  5, false),
  ('galp-and-biological-molecule-synthesis',               6,  'GALP products and biological molecule synthesis',                              'coming_soon',  6, false),
  ('chloroplast-structure-function',                       7,  'Chloroplast structure-function relationships',                                 'coming_soon',  7, false),
  ('absorption-and-action-spectra',                        8,  'Absorption spectra and action spectra',                                        'coming_soon',  8, false),
  ('chromatography-chloroplast-pigments-rf',               9,  'Chromatography of chloroplast pigments and Rf values',                         'coming_soon',  9, false),
  ('cp10-light-intensity-wavelength-photosynthesis',      10,  'Core Practical 10: light intensity/wavelength and photosynthesis rate',        'coming_soon', 10, true),
  ('cp10-temperature-co2-data-evaluation',                11,  'Core Practical 10: temperature, carbon dioxide and data evaluation',           'coming_soon', 11, true),
  ('gpp-npp-and-plant-respiration',                       12,  'GPP, NPP and plant respiration calculations',                                  'coming_soon', 12, false),
  ('biomass-and-energy-transfer-efficiency',              13,  'Biomass and energy transfer efficiency',                                       'coming_soon', 13, false),
  ('populations-communities-habitats-ecosystems',         14,  'Populations, communities, habitats and ecosystems',                            'coming_soon', 14, false),
  ('biotic-and-abiotic-factors',                          15,  'Biotic and abiotic factors controlling distribution',                          'coming_soon', 15, false),
  ('niche-distribution-abundance',                        16,  'Niche, distribution and abundance',                                            'coming_soon', 16, false),
  ('cp11-quadrats-transects-abiotic-factors',             17,  'Core Practical 11: quadrats, transects and abiotic factors',                   'coming_soon', 17, true),
  ('succession-and-climax-communities',                   18,  'Succession and climax communities',                                            'coming_soon', 18, false),
  ('evidence-for-climate-change-causation',               19,  'Evidence for climate change and correlation/causation',                        'coming_soon', 19, false),
  ('greenhouse-effect-anthropogenic',                     20,  'Greenhouse effect and anthropogenic climate change',                           'coming_soon', 20, false),
  ('carbon-cycle-and-reducing-co2',                       21,  'Carbon cycle and reducing atmospheric carbon dioxide',                         'coming_soon', 21, false),
  ('climate-models-extrapolation-limitations',            22,  'Climate models, extrapolation and limitations',                                'coming_soon', 22, false),
  ('climate-change-effects-on-organisms',                 23,  'Climate change effects on organisms',                                          'coming_soon', 23, false),
  ('temperature-enzyme-activity-q10',                     24,  'Temperature, enzyme activity and Q10',                                         'coming_soon', 24, false),
  ('cp12-temperature-and-organism-development',           25,  'Core Practical 12: temperature and organism development',                      'coming_soon', 25, true),
  ('evolution-mutation-natural-selection',                26,  'Evolution through mutation and natural selection',                             'coming_soon', 26, false),
  ('isolation-gene-flow-and-speciation',                  27,  'Isolation, gene flow and speciation',                                          'coming_soon', 27, false),
  ('bias-evidence-and-climate-controversy',               28,  'Bias, evidence and controversial climate conclusions',                         'coming_soon', 28, false),
  ('reforestation-biofuels-sustainable-resources',        29,  'Reforestation, biofuels and sustainable resource use',                         'coming_soon', 29, false),

  -- Topic 6: Microbiology, Immunity and Forensics (30–51)
  ('culturing-microorganisms-aseptic-technique',          30,  'Culturing microorganisms and aseptic technique',                               'coming_soon', 30, false),
  ('microbial-growth-cell-counts-dilution',               31,  'Measuring microbial growth: cell counts and dilution plating',                 'coming_soon', 31, false),
  ('microbial-growth-mass-and-turbidity',                 32,  'Measuring microbial growth: mass and turbidity methods',                       'coming_soon', 32, false),
  ('bacterial-growth-curves-exponential',                 33,  'Bacterial growth curves and exponential growth constants',                     'coming_soon', 33, false),
  ('cp13-microorganism-growth-liquid-culture',            34,  'Core Practical 13: microorganism growth in liquid culture',                    'coming_soon', 34, true),
  ('bacterial-vs-viral-structure',                        35,  'Bacterial and viral structure comparison',                                     'coming_soon', 35, false),
  ('ebola-tmv-hiv-lambda-lytic-latency',                  36,  'Ebola, TMV, HIV and lambda phage; lytic and latency',                          'coming_soon', 36, false),
  ('tb-and-hiv-infection-of-human-cells',                 37,  'Tuberculosis and HIV infection of human cells',                                'coming_soon', 37, false),
  ('pathogen-entry-routes-body-barriers',                 38,  'Pathogen entry routes and body barriers',                                      'coming_soon', 38, false),
  ('non-specific-immune-responses',                       39,  'Non-specific immune responses',                                                'coming_soon', 39, false),
  ('antigens-antibodies-macrophages-apcs',                40,  'Antigens, antibodies, macrophages and antigen-presenting cells',               'coming_soon', 40, false),
  ('b-cells-and-t-cells-immune-response',                 41,  'B cells and T cells in the immune response',                                   'coming_soon', 41, false),
  ('natural-artificial-active-passive-immunity',          42,  'Natural/artificial and active/passive immunity',                               'coming_soon', 42, false),
  ('evolutionary-race-and-pathogen-evasion',              43,  'Evolutionary race and pathogen evasion',                                       'coming_soon', 43, false),
  ('bacteriostatic-bactericidal-antibiotics',             44,  'Bacteriostatic and bactericidal antibiotics',                                  'coming_soon', 44, false),
  ('cp14-effect-of-antibiotics-on-bacteria',              45,  'Core Practical 14: effect of antibiotics on bacteria',                         'coming_soon', 45, true),
  ('antibiotic-prescribing-hai-infection-control',        46,  'Antibiotic prescribing, HAI and infection-control practice',                   'coming_soon', 46, false),
  ('decomposition-and-carbon-recycling',                  47,  'Decomposition and carbon recycling',                                           'coming_soon', 47, false),
  ('pcr-amplification-of-dna',                            48,  'PCR amplification of DNA',                                                     'coming_soon', 48, false),
  ('gel-electrophoresis-dna-fragments',                   49,  'Gel electrophoresis of DNA fragments',                                         'coming_soon', 49, false),
  ('dna-profiling-and-genetic-relationships',             50,  'DNA profiling and genetic relationships',                                      'coming_soon', 50, false),
  ('time-of-death-decomposition-entomology-rigor',        51,  'Time of death: decomposition, succession, entomology and rigor',               'coming_soon', 51, false)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- 7. A2 BIOLOGY LESSONS — UNIT 5 (Lessons 52–100)
-- Respiration, Internal Environment, Coordination and Gene Technology
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug='edexcel-ial-a2-biology' AND u.slug='unit-5'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  -- Topic 7: Respiration, Muscles and the Internal Environment (52–77)
  ('aerobic-respiration-overview',                        52,  'Aerobic respiration overview and enzyme-controlled steps',                     'coming_soon', 52, false),
  ('glycolysis-aerobic-anaerobic',                        53,  'Glycolysis in aerobic and anaerobic respiration',                              'coming_soon', 53, false),
  ('link-reaction-and-krebs-cycle',                       54,  'Link reaction and Krebs cycle',                                                'coming_soon', 54, false),
  ('oxidative-phosphorylation-electron-transport',        55,  'Oxidative phosphorylation, electron transport and chemiosmosis',               'coming_soon', 55, false),
  ('lactate-after-anaerobic-respiration',                 56,  'Lactate after anaerobic respiration',                                          'coming_soon', 56, false),
  ('respiratory-quotient',                                57,  'Respiratory quotient',                                                         'coming_soon', 57, false),
  ('cp15-redox-indicator-yeast-respiration',              58,  'Core Practical 15: redox indicator and yeast respiration',                     'coming_soon', 58, true),
  ('cp16-respirometer-respiration-rate-rq',               59,  'Core Practical 16: respirometer, respiration rate and RQ',                     'coming_soon', 59, true),
  ('movement-muscles-tendons-skeleton-ligaments',         60,  'Movement: muscles, tendons, skeleton and ligaments',                           'coming_soon', 60, false),
  ('skeletal-muscle-fast-slow-twitch',                    61,  'Skeletal muscle fibres and fast/slow twitch fibres',                           'coming_soon', 61, false),
  ('sliding-filament-theory',                             62,  'Sliding filament theory',                                                      'coming_soon', 62, false),
  ('cardiac-muscle-and-electrical-coordination',          63,  'Cardiac muscle and electrical coordination of the heartbeat',                  'coming_soon', 63, false),
  ('ecgs-and-abnormal-rhythm-diagnosis',                  64,  'ECGs and abnormal heart rhythm diagnosis',                                     'coming_soon', 64, false),
  ('cardiac-output-calculations',                         65,  'Cardiac output calculations',                                                  'coming_soon', 65, false),
  ('ventilation-cardiac-output-medulla',                  66,  'Ventilation, cardiac output and medulla control centres',                      'coming_soon', 66, false),
  ('adrenaline-and-fight-or-flight',                      67,  'Adrenaline and the fight-or-flight response',                                  'coming_soon', 67, false),
  ('cp17-spirometer-traces-exercise-data',                68,  'Core Practical 17: spirometer traces and exercise data',                       'coming_soon', 68, true),
  ('negative-and-positive-feedback-control',              69,  'Negative and positive feedback control',                                       'coming_soon', 69, false),
  ('homeostasis-exercise-thermoregulation',               70,  'Homeostasis, exercise and thermoregulation',                                   'coming_soon', 70, false),
  ('mammalian-kidney-gross-and-microscopic',              71,  'Mammalian kidney gross and microscopic structure',                             'coming_soon', 71, false),
  ('urea-production-and-ultrafiltration',                 72,  'Urea production and ultrafiltration',                                          'coming_soon', 72, false),
  ('selective-reabsorption-proximal-tubule',              73,  'Selective reabsorption in the proximal tubule',                                'coming_soon', 73, false),
  ('loop-of-henle-countercurrent-multiplier',             74,  'Loop of Henle and countercurrent multiplier',                                  'coming_soon', 74, false),
  ('osmoregulation-adh-hypothalamus-pituitary',           75,  'Osmoregulation: ADH, hypothalamus, pituitary and negative feedback',           'coming_soon', 75, false),
  ('gene-switching-transcription-factors-hormones',       76,  'Gene switching, transcription factors and hormone action',                     'coming_soon', 76, false),
  ('topic-7-synoptic-exam-practice',                      77,  'Topic 7 synoptic exam practice',                                               'coming_soon', 77, false),

  -- Topic 8: Coordination, Response and Gene Technology (78–100)
  ('sensory-relay-motor-neurones',                        78,  'Sensory, relay and motor neurones',                                            'coming_soon', 78, false),
  ('nervous-system-responses-stimuli-effectors',          79,  'Nervous-system responses to stimuli and effectors',                            'coming_soon', 79, false),
  ('spinal-reflex-arc-grey-white-matter',                 80,  'Spinal reflex arc, grey matter and white matter',                              'coming_soon', 80, false),
  ('action-potentials-sodium-potassium',                  81,  'Action potentials and sodium/potassium permeability',                          'coming_soon', 81, false),
  ('myelination-and-saltatory-conduction',                82,  'Myelination and saltatory conduction',                                         'coming_soon', 82, false),
  ('synapses-neurotransmitters-acetylcholine',            83,  'Synapses, neurotransmitters and acetylcholine',                                'coming_soon', 83, false),
  ('pupil-reflex-dilation-constriction',                  84,  'Pupil reflex: dilation and constriction',                                      'coming_soon', 84, false),
  ('drugs-and-nerve-transmission',                        85,  'Drugs and nerve transmission: nicotine, lidocaine, cobra toxin, L-DOPA and MDMA', 'coming_soon', 85, false),
  ('rod-cells-rhodopsin-retinal-response',                86,  'Rod cells, rhodopsin and retinal response',                                    'coming_soon', 86, false),
  ('habituation',                                         87,  'Habituation',                                                                  'coming_soon', 87, false),
  ('central-peripheral-nervous-systems-brain-regions',    88,  'Central and peripheral nervous systems; main brain regions',                   'coming_soon', 88, false),
  ('plant-responses-phytochrome-auxin-gibberellins',      89,  'Plant responses: phytochrome, auxin and gibberellins',                         'coming_soon', 89, false),
  ('cp18-amylase-germinating-cereal-grains',              90,  'Core Practical 18: amylase in germinating cereal grains',                      'coming_soon', 90, true),
  ('coordination-nervous-and-hormonal',                   91,  'Coordination through nervous and hormonal control',                            'coming_soon', 91, false),
  ('brain-imaging-mri-fmri-pet-ct',                       92,  'Brain imaging: MRI, fMRI, PET and CT',                                         'coming_soon', 92, false),
  ('brain-chemicals-parkinsons-depression',               93,  'Brain chemicals, Parkinson''s disease and depression',                         'coming_soon', 93, false),
  ('drug-production-using-gm-organisms',                  94,  'Drug production using genetically modified organisms',                         'coming_soon', 94, false),
  ('recombinant-dna-restriction-ligase',                  95,  'Recombinant DNA: restriction endonucleases and ligase',                        'coming_soon', 95, false),
  ('inserting-recombinant-dna-into-cells',                96,  'Inserting recombinant DNA into cells',                                         'coming_soon', 96, false),
  ('microarrays-and-active-genes',                        97,  'Microarrays and active genes',                                                 'coming_soon', 97, false),
  ('bioinformatics',                                      98,  'Bioinformatics',                                                               'coming_soon', 98, false),
  ('risks-and-benefits-gmos',                             99,  'Risks and benefits of genetically modified organisms',                         'coming_soon', 99, false),
  ('topic-8-gene-technology-exam-practice',              100,  'Topic 8 gene technology and coordination exam practice',                       'coming_soon', 100, false)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

-- ============================================================================
-- 8. A2 BIOLOGY LESSONS — UNIT 6 (Lessons 101–105, Practical Skills II)
-- ============================================================================
WITH course_unit AS (
  SELECT c.id AS course_id, u.id AS unit_id
  FROM courses c JOIN units u ON u.course_id = c.id
  WHERE c.slug='edexcel-ial-a2-biology' AND u.slug='unit-6'
)
INSERT INTO lessons (course_id, unit_id, slug, lesson_number, title, status, sort_order, is_core_practical)
SELECT course_id, unit_id, slug, lesson_number, title, status::content_status, sort_order, is_core_practical
FROM course_unit, (VALUES
  ('planning-investigations-null-hypotheses',            101,  'Planning investigations and formulating null hypotheses',                      'coming_soon', 101, false),
  ('measurement-variables-calibration-safety-ethics',    102,  'Measurement, variables, calibration, safety and ethics',                       'coming_soon', 102, false),
  ('statistical-tests-graphs-logarithmic-data',          103,  'Statistical tests, graphs and logarithmic data',                               'coming_soon', 103, false),
  ('scientific-article-strategy-synoptic-links',         104,  'Scientific-article strategy and synoptic links',                               'coming_soon', 104, false),
  ('ia2-practical-paper-synoptic-mock',                  105,  'IA2 practical-paper and synoptic mock practice',                               'coming_soon', 105, false)
) AS l(slug, lesson_number, title, status, sort_order, is_core_practical)
ON CONFLICT (course_id, slug) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES — run these AFTER the seed completes
-- ============================================================================

-- Should be 205 total Biology lessons
SELECT 'total Biology lessons' AS metric, count(*) AS value
FROM lessons l JOIN courses c ON c.id = l.course_id
WHERE c.slug IN ('edexcel-ial-as-biology', 'edexcel-ial-a2-biology');

-- Should be 100 AS Biology lessons
SELECT 'AS Biology lessons' AS metric, count(*) AS value
FROM lessons l JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'edexcel-ial-as-biology';

-- Should be 105 A2 Biology lessons
SELECT 'A2 Biology lessons' AS metric, count(*) AS value
FROM lessons l JOIN courses c ON c.id = l.course_id
WHERE c.slug = 'edexcel-ial-a2-biology';

-- Should be 18 Core Practicals (CP1-CP9 in AS + CP10-CP18 in A2)
-- Note: CP5, CP7 and CP10 each span 2 lessons, so actual core_practical=true rows = 21
SELECT 'Biology core practical lessons' AS metric, count(*) AS value
FROM lessons l JOIN courses c ON c.id = l.course_id
WHERE c.slug IN ('edexcel-ial-as-biology', 'edexcel-ial-a2-biology')
  AND l.is_core_practical = true;

-- Per-unit Biology lesson counts
-- Expected: WBI11=46, WBI12=48, WBI13=6, WBI14=51, WBI15=49, WBI16=5
SELECT u.code AS unit, count(l.id) AS lesson_count
FROM units u LEFT JOIN lessons l ON l.unit_id = u.id
JOIN courses c ON c.id = u.course_id
WHERE c.slug IN ('edexcel-ial-as-biology', 'edexcel-ial-a2-biology')
GROUP BY u.code, u.sort_order
ORDER BY u.code;
