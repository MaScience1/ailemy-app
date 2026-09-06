-- ============================================================================
-- AILEMY — PEARSON EDEXCEL INTERNATIONAL GCSE PHYSICS (4PH1) SPECIFICATION
-- 30 sub-topics, 195 specification points (section 1: 33, section 2: 28, section 3: 29, section 4: 19, section 5: 22, section 6: 20, section 7: 26, section 8: 18)
--
-- ⚠ NOT YET APPLIED. Phase 3 is owner-run: read-only baseline first, then a
--   whole-file SQL-Editor paste (byte count clipboard-verified, END-OF-010
--   sentinel confirmed as the last line), then the read-only post-apply
--   verification, then this header is amended to record the apply — the
--   exact 008 procedure. Expected baseline BEFORE the apply (recorded by a
--   read-only anon-key probe on 2026-09-06): the live course row is slug
--   edexcel-igcse-physics, uuid e63ebefd-1936-4344-9947-2fbc49bfdc66,
--   status 'live', with 0 units / 0 topics / 0 spec points / 0 lessons and
--   50 past papers; IGCSE Chemistry at 28 topics / 182 live+verified points
--   (52 C-suffix); IGCSE Biology at 22 topics / 176 live+verified points
--   (42 B-suffix); IAL AS Chemistry at 157 live+verified + 1 archived;
--   516 specification points in total across the three sibling courses.
--
-- PROVENANCE — nothing here is invented:
--   Every sub-topic, code and statement is extracted from the OFFICIAL
--   Pearson Edexcel International GCSE in Physics (4PH1) — Specification,
--   Issue 4, © Pearson Education Limited 2024 (first teaching September 2017,
--   first examination June 2019; ISBN 978 1 446 93119 6),
--   downloaded from
--   https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Physics/2017/specification-and-sample-assessments/international-gcse-physics-2017-specification.pdf
--   pdf sha256 bac4b8312d4fbfc84672f909100d66b2b3cda0b25e98c0d11bbc7366dae482b2
--   by scripts/spec-extract/extract_4ph1.py. The committed extraction
--   (scripts/spec-extract/4ph1-issue4.json) is the reviewable intermediate;
--   this file is generated from it by generate-4ph1-seed.ts and is not
--   hand-edited. Pearson serves Issue 4 as the current document; its own
--   change summary against the previous issue lists administrative deltas
--   only (series availability, forbidden combinations, one command word) —
--   no content-section changes, so Issue 4 is authoritative for the whole
--   2019-2025 paper corpus. Non-equation wording was cross-checked
--   chunk-verbatim against an independent pdftotext extraction of the same
--   PDF (223 chunks); every equation and fraction assembly was verified
--   span-by-span against the PDF's own glyph geometry (29 drawn-bar
--   fractions, the ¹⁴₆C nuclide, every super/subscript).
--
-- STRUCTURE — the document's own, nothing imposed:
--   Eight content sections (1 Forces and motion, 2 Electricity, 3 Waves,
--   4 Energy resources and energy transfers, 5 Solids, liquids and gases,
--   6 Magnetism and electromagnetism, 7 Radioactivity and particles,
--   8 Astrophysics) with lettered sub-topics. Sub-topics become topics rows
--   with unit_id NULL — 4PH1 HAS NO UNITS and none are fabricated (the
--   generic unit-less grouping renders them as the top level). The topic
--   code "1(a)" carries the section, so the section layer loses nothing.
--   4PH1 has no context headings (unlike 4BI1); the extractor asserted so.
--
-- PAPER 2-ONLY CONTENT — carried by the official codes themselves:
--   "specification statements that are in bold with a 'P' reference relate
--   to content that is in the International GCSE in Physics only and is not
--   found in the International GCSE in Science (Double Award)" (spec p.1);
--   Paper 1 "assesses core content that is not in bold and does not have a
--   'P' reference", Paper 2 "assesses all the content" (spec pp.8-9).
--   So the P SUFFIX in the code (48 of 195 points) IS the official
--   Paper 2-only marker — no schema field is needed, and the extractor
--   asserted bold ⟺ P for every statement. Practical investigations
--   (points in italics, beginning "practical:" — 13 points) keep that
--   prefix in their official wording.
--
-- EQUATIONS — deterministic inline rendering, never a paraphrase:
--   Stacked fractions are re-assembled from their drawn bars (numerator
--   above, denominator below) into inline form, each side parenthesised iff
--   it contains a space or operator; the document's built ½ renders as ½;
--   raised/lowered glyphs become Unicode super/subscripts (v², λ₀, Vₚ, β⁻,
--   ¹⁴₆C) with a hard extractor refusal on any unmappable character. Word
--   and symbol equation forms stay separate lines, exactly as printed. The
--   document's own quirks are kept verbatim (the letter x in
--   'E = I × V x t'; 'total energy output' in the efficiency denominator).
--
-- Idempotent: topics ON CONFLICT (course_id, slug) DO NOTHING;
--             spec points ON CONFLICT (topic_id, code) DO UPDATE.
-- Course-scoped: every statement resolves through courses.slug = 'edexcel-igcse-physics'.
-- Self-verifying: the DO block before COMMIT recounts and RAISEs on drift,
-- so a truncated paste aborts the whole transaction instead of half-applying.
-- No DELETEs, no cross-course writes, no units rows, no schema changes.
-- All 195 points land status 'draft', verified_at NULL —
-- INTENTIONALLY awaiting the Phase 3 official-verification lifecycle pass
-- (the 004/005, 006/007 and 008/009 convention; that pass is seed 011).
-- ============================================================================

BEGIN;

-- ── Topics (30 lettered sub-topics, unit_id NULL) ───────────────────────────

-- 1(a) — Units
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1a-units', '1(a)', 'Units', 'coming_soon', 1
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(b) — Movement and position
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1b-movement-and-position', '1(b)', 'Movement and position', 'coming_soon', 2
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 1(c) — Forces, movement, shape and momentum
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '1c-forces-movement-shape-and-momentum', '1(c)', 'Forces, movement, shape and momentum', 'coming_soon', 3
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(a) — Units
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2a-units', '2(a)', 'Units', 'coming_soon', 4
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(b) — Mains electricity
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2b-mains-electricity', '2(b)', 'Mains electricity', 'coming_soon', 5
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(c) — Energy and voltage in circuits
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2c-energy-and-voltage-in-circuits', '2(c)', 'Energy and voltage in circuits', 'coming_soon', 6
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 2(d) — Electric charge
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '2d-electric-charge', '2(d)', 'Electric charge', 'coming_soon', 7
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 3(a) — Units
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '3a-units', '3(a)', 'Units', 'coming_soon', 8
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 3(b) — Properties of waves
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '3b-properties-of-waves', '3(b)', 'Properties of waves', 'coming_soon', 9
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 3(c) — The electromagnetic spectrum
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '3c-the-electromagnetic-spectrum', '3(c)', 'The electromagnetic spectrum', 'coming_soon', 10
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 3(d) — Light and sound
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '3d-light-and-sound', '3(d)', 'Light and sound', 'coming_soon', 11
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(a) — Units
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4a-units', '4(a)', 'Units', 'coming_soon', 12
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(b) — Energy transfers
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4b-energy-transfers', '4(b)', 'Energy transfers', 'coming_soon', 13
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(c) — Work and power
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4c-work-and-power', '4(c)', 'Work and power', 'coming_soon', 14
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 4(d) — Energy resources and electricity generation
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '4d-energy-resources-and-electricity-generation', '4(d)', 'Energy resources and electricity generation', 'coming_soon', 15
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 5(a) — Units
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '5a-units', '5(a)', 'Units', 'coming_soon', 16
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 5(b) — Density and pressure
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '5b-density-and-pressure', '5(b)', 'Density and pressure', 'coming_soon', 17
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 5(c) — Change of state
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '5c-change-of-state', '5(c)', 'Change of state', 'coming_soon', 18
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 5(d) — Ideal gas molecules
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '5d-ideal-gas-molecules', '5(d)', 'Ideal gas molecules', 'coming_soon', 19
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 6(a) — Units
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '6a-units', '6(a)', 'Units', 'coming_soon', 20
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 6(b) — Magnetism
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '6b-magnetism', '6(b)', 'Magnetism', 'coming_soon', 21
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 6(c) — Electromagnetism
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '6c-electromagnetism', '6(c)', 'Electromagnetism', 'coming_soon', 22
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 6(d) — Electromagnetic induction
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '6d-electromagnetic-induction', '6(d)', 'Electromagnetic induction', 'coming_soon', 23
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 7(a) — Units
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '7a-units', '7(a)', 'Units', 'coming_soon', 24
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 7(b) — Radioactivity
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '7b-radioactivity', '7(b)', 'Radioactivity', 'coming_soon', 25
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 7(c) — Fission and fusion
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '7c-fission-and-fusion', '7(c)', 'Fission and fusion', 'coming_soon', 26
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 8(a) — Units
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '8a-units', '8(a)', 'Units', 'coming_soon', 27
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 8(b) — Motion in the universe
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '8b-motion-in-the-universe', '8(b)', 'Motion in the universe', 'coming_soon', 28
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 8(c) — Stellar evolution
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '8c-stellar-evolution', '8(c)', 'Stellar evolution', 'coming_soon', 29
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- 8(d) — Cosmology
INSERT INTO topics (course_id, unit_id, slug, code, name, status, sort_order)
SELECT c.id, NULL, '8d-cosmology', '8(d)', 'Cosmology', 'coming_soon', 30
FROM courses c WHERE c.slug = 'edexcel-igcse-physics'
ON CONFLICT (course_id, slug) DO NOTHING;

-- ── Spec points (upsert by (topic_id, code)) ────────────────────────────────

-- 1.1 — official Issue 4 §1(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.1', 'use the following units: kilogram (kg), metre (m), metre/second (m/s), metre/second²…', 'use the following units: kilogram (kg), metre (m), metre/second (m/s), metre/second² (m/s²), newton (N), second (s) and newton/kilogram (N/kg)', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1a-units'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.2P — official Issue 4 §1(a) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.2P', 'use the following units: newton metre (Nm), kilogram metre/second (kg m/s)', 'use the following units: newton metre (Nm), kilogram metre/second (kg m/s)', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1a-units'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.3 — official Issue 4 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.3', 'plot and explain distance−time graphs', 'plot and explain distance−time graphs', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1b-movement-and-position'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.4 — official Issue 4 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.4', 'know and use the relationship between average speed, distance moved and time taken:', 'know and use the relationship between average speed, distance moved and time taken:
average speed = (distance moved)/(time taken)', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1b-movement-and-position'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.5 — official Issue 4 §1(b) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.5', 'practical: investigate the motion of everyday objects such as toy cars or tennis balls', 'practical: investigate the motion of everyday objects such as toy cars or tennis balls', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1b-movement-and-position'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.6 — official Issue 4 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.6', 'know and use the relationship between acceleration, change in velocity and time taken:', 'know and use the relationship between acceleration, change in velocity and time taken:
acceleration = (change in velocity)/(time taken)
a = (v − u)/t', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1b-movement-and-position'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.7 — official Issue 4 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.7', 'plot and explain velocity−time graphs', 'plot and explain velocity−time graphs', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1b-movement-and-position'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.8 — official Issue 4 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.8', 'determine acceleration from the gradient of a velocity−time graph', 'determine acceleration from the gradient of a velocity−time graph', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1b-movement-and-position'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.9 — official Issue 4 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.9', 'determine the distance travelled from the area between a velocity−time graph and the…', 'determine the distance travelled from the area between a velocity−time graph and the time axis', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1b-movement-and-position'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.10 — official Issue 4 §1(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.10', 'use the relationship between final speed, initial speed, acceleration and distance…', 'use the relationship between final speed, initial speed, acceleration and distance moved:
(final speed)² = (initial speed)² + (2 × acceleration × distance moved)
v² = u² + (2 × a × s)', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1b-movement-and-position'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.11 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.11', 'describe the effects of forces between bodies such as changes in speed, shape or…', 'describe the effects of forces between bodies such as changes in speed, shape or direction', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.12 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.12', 'identify different types of force such as gravitational or electrostatic', 'identify different types of force such as gravitational or electrostatic', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.13 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.13', 'understand how vector quantities differ from scalar quantities', 'understand how vector quantities differ from scalar quantities', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.14 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.14', 'understand that force is a vector quantity', 'understand that force is a vector quantity', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.15 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.15', 'calculate the resultant force of forces that act along a line', 'calculate the resultant force of forces that act along a line', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.16 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.16', 'know that friction is a force that opposes motion', 'know that friction is a force that opposes motion', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.17 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.17', 'know and use the relationship between unbalanced force, mass and acceleration:', 'know and use the relationship between unbalanced force, mass and acceleration:
force = mass × acceleration
F = m × a', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.18 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.18', 'know and use the relationship between weight, mass and gravitational field strength:', 'know and use the relationship between weight, mass and gravitational field strength:
weight = mass × gravitational field strength
W = m × g', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.19 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.19', 'know that the stopping distance of a vehicle is made up of the sum of the thinking…', 'know that the stopping distance of a vehicle is made up of the sum of the thinking distance and the braking distance', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.20 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.20', 'describe the factors affecting vehicle stopping distance, including speed, mass, road…', 'describe the factors affecting vehicle stopping distance, including speed, mass, road condition and reaction time', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.21 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.21', 'describe the forces acting on falling objects (and explain why falling objects reach a…', 'describe the forces acting on falling objects (and explain why falling objects reach a terminal velocity)', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.22 — official Issue 4 §1(c) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.22', 'practical: investigate how extension varies with applied force for helical springs,…', 'practical: investigate how extension varies with applied force for helical springs, metal wires and rubber bands', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.23 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.23', 'know that the initial linear region of a force-extension graph is associated with…', 'know that the initial linear region of a force-extension graph is associated with Hooke’s law', NULL, 'draft', 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.24 — official Issue 4 §1(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.24', 'describe elastic behaviour as the ability of a material to recover its original shape…', 'describe elastic behaviour as the ability of a material to recover its original shape after the forces causing deformation have been removed', NULL, 'draft', 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.25P — official Issue 4 §1(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.25P', 'know and use the relationship between momentum, mass and velocity:', 'know and use the relationship between momentum, mass and velocity:
momentum = mass × velocity
p = m × v', NULL, 'draft', 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.26P — official Issue 4 §1(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.26P', 'use the idea of momentum to explain safety features', 'use the idea of momentum to explain safety features', NULL, 'draft', 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.27P — official Issue 4 §1(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.27P', 'use the conservation of momentum to calculate the mass, velocity or momentum of objects', 'use the conservation of momentum to calculate the mass, velocity or momentum of objects', NULL, 'draft', 27
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.28P — official Issue 4 §1(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.28P', 'use the relationship between force, change in momentum and time taken:', 'use the relationship between force, change in momentum and time taken:
force = (change in momentum)/(time taken)
F = (mv − mu)/t', NULL, 'draft', 28
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.29P — official Issue 4 §1(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.29P', 'demonstrate an understanding of Newton’s third law', 'demonstrate an understanding of Newton’s third law', NULL, 'draft', 29
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.30P — official Issue 4 §1(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.30P', 'know and use the relationship between the moment of a force and its perpendicular…', 'know and use the relationship between the moment of a force and its perpendicular distance from the pivot:
moment = force × perpendicular distance from the pivot', NULL, 'draft', 30
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.31P — official Issue 4 §1(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.31P', 'know that the weight of a body acts through its centre of gravity', 'know that the weight of a body acts through its centre of gravity', NULL, 'draft', 31
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.32P — official Issue 4 §1(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.32P', 'use the principle of moments for a simple system of parallel forces acting in one plane', 'use the principle of moments for a simple system of parallel forces acting in one plane', NULL, 'draft', 32
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 1.33P — official Issue 4 §1(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '1.33P', 'understand how the upward forces on a light beam, supported at its ends, vary with the…', 'understand how the upward forces on a light beam, supported at its ends, vary with the position of a heavy object placed on the beam', NULL, 'draft', 33
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '1c-forces-movement-shape-and-momentum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.1 — official Issue 4 §2(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.1', 'use the following units: ampere (A), coulomb (C), joule (J), ohm (Ω), second (s), volt…', 'use the following units: ampere (A), coulomb (C), joule (J), ohm (Ω), second (s), volt (V) and watt (W)', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2a-units'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.2 — official Issue 4 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.2', 'understand how the use of insulation, double insulation, earthing, fuses and circuit…', 'understand how the use of insulation, double insulation, earthing, fuses and circuit breakers protects the device or user in a range of domestic appliances', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2b-mains-electricity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.3 — official Issue 4 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.3', 'understand why a current in a resistor results in the electrical transfer of energy and…', 'understand why a current in a resistor results in the electrical transfer of energy and an increase in temperature, and how this can be used in a variety of domestic contexts', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2b-mains-electricity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.4 — official Issue 4 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.4', 'know and use the relationship between power, current and voltage:', 'know and use the relationship between power, current and voltage:
power = current × voltage
P = I × V
and apply the relationship to the selection of appropriate fuses', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2b-mains-electricity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.5 — official Issue 4 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.5', 'use the relationship between energy transferred, current, voltage and time:', 'use the relationship between energy transferred, current, voltage and time:
energy transferred = current × voltage × time
E = I × V x t', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2b-mains-electricity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.6 — official Issue 4 §2(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.6', 'know the difference between mains electricity being alternating current (a.c.) and…', 'know the difference between mains electricity being alternating current (a.c.) and direct current (d.c.) being supplied by a cell or battery', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2b-mains-electricity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.7 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.7', 'explain why a series or parallel circuit is more appropriate for particular…', 'explain why a series or parallel circuit is more appropriate for particular applications, including domestic lighting', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.8 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.8', 'understand how the current in a series circuit depends on the applied voltage and the…', 'understand how the current in a series circuit depends on the applied voltage and the number and nature of other components', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.9 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.9', 'describe how current varies with voltage in wires, resistors, metal filament lamps and…', 'describe how current varies with voltage in wires, resistors, metal filament lamps and diodes, and how to investigate this experimentally', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.10 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.10', 'describe the qualitative effect of changing resistance on the current in a circuit', 'describe the qualitative effect of changing resistance on the current in a circuit', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.11 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.11', 'describe the qualitative variation of resistance of light-dependent resistors (LDRs)…', 'describe the qualitative variation of resistance of light-dependent resistors (LDRs) with illumination and thermistors with temperature', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.12 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.12', 'know that lamps and LEDs can be used to indicate the presence of a current in a circuit', 'know that lamps and LEDs can be used to indicate the presence of a current in a circuit', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.13 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.13', 'know and use the relationship between voltage, current and resistance:', 'know and use the relationship between voltage, current and resistance:
voltage = current × resistance
V = I × R', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.14 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.14', 'know that current is the rate of flow of charge', 'know that current is the rate of flow of charge', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.15 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.15', 'know and use the relationship between charge, current and time:', 'know and use the relationship between charge, current and time:
charge = current × time
Q = I × t', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.16 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.16', 'know that electric current in solid metallic conductors is a flow of negatively charged…', 'know that electric current in solid metallic conductors is a flow of negatively charged electrons', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.17 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.17', 'understand why current is conserved at a junction in a circuit', 'understand why current is conserved at a junction in a circuit', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.18 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.18', 'know that the voltage across two components connected in parallel is the same', 'know that the voltage across two components connected in parallel is the same', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.19 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.19', 'calculate the currents, voltages and resistances of two resistive components connected…', 'calculate the currents, voltages and resistances of two resistive components connected in a series circuit', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.20 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.20', 'know that:', 'know that:
• voltage is the energy transferred per unit charge passed
• the volt is a joule per coulomb', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.21 — official Issue 4 §2(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.21', 'know and use the relationship between energy transferred, charge and voltage:', 'know and use the relationship between energy transferred, charge and voltage:
energy transferred = charge × voltage
E = Q × V', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2c-energy-and-voltage-in-circuits'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.22P — official Issue 4 §2(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.22P', 'identify common materials that are electrical conductors or insulators, including…', 'identify common materials that are electrical conductors or insulators, including metals and plastics', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2d-electric-charge'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.23P — official Issue 4 §2(d) (P: Physics-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.23P', 'practical: investigate how insulating materials can be charged by friction', 'practical: investigate how insulating materials can be charged by friction', NULL, 'draft', 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2d-electric-charge'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.24P — official Issue 4 §2(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.24P', 'explain how positive and negative electrostatic charges are produced on materials by…', 'explain how positive and negative electrostatic charges are produced on materials by the loss and gain of electrons', NULL, 'draft', 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2d-electric-charge'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.25P — official Issue 4 §2(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.25P', 'know that there are forces of attraction between unlike charges and forces of repulsion…', 'know that there are forces of attraction between unlike charges and forces of repulsion between like charges', NULL, 'draft', 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2d-electric-charge'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.26P — official Issue 4 §2(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.26P', 'explain electrostatic phenomena in terms of the movement of electrons', 'explain electrostatic phenomena in terms of the movement of electrons', NULL, 'draft', 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2d-electric-charge'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.27P — official Issue 4 §2(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.27P', 'explain the potential dangers of electrostatic charges, e.g. when fuelling aircraft and…', 'explain the potential dangers of electrostatic charges, e.g. when fuelling aircraft and tankers', NULL, 'draft', 27
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2d-electric-charge'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 2.28P — official Issue 4 §2(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '2.28P', 'explain some uses of electrostatic charges, e.g. in photocopiers and inkjet printers', 'explain some uses of electrostatic charges, e.g. in photocopiers and inkjet printers', NULL, 'draft', 28
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '2d-electric-charge'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.1 — official Issue 4 §3(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.1', 'use the following units: degree (°), hertz (Hz), metre (m), metre/second (m/s) and…', 'use the following units: degree (°), hertz (Hz), metre (m), metre/second (m/s) and second (s)', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3a-units'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.2 — official Issue 4 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.2', 'explain the difference between longitudinal and transverse waves', 'explain the difference between longitudinal and transverse waves', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3b-properties-of-waves'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.3 — official Issue 4 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.3', 'know the definitions of amplitude, wavefront, frequency, wavelength and period of a wave', 'know the definitions of amplitude, wavefront, frequency, wavelength and period of a wave', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3b-properties-of-waves'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.4 — official Issue 4 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.4', 'know that waves transfer energy and information without transferring matter', 'know that waves transfer energy and information without transferring matter', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3b-properties-of-waves'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.5 — official Issue 4 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.5', 'know and use the relationship between the speed, frequency and wavelength of a wave:', 'know and use the relationship between the speed, frequency and wavelength of a wave:
wave speed = frequency × wavelength
v = f × λ', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3b-properties-of-waves'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.6 — official Issue 4 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.6', 'use the relationship between frequency and time period:', 'use the relationship between frequency and time period:
frequency = 1/(time period)
f = 1/T', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3b-properties-of-waves'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.7 — official Issue 4 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.7', 'use the above relationships in different contexts, including sound waves and…', 'use the above relationships in different contexts, including sound waves and electromagnetic waves', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3b-properties-of-waves'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.8 — official Issue 4 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.8', 'explain why there is a change in the observed frequency and wavelength of a wave when…', 'explain why there is a change in the observed frequency and wavelength of a wave when its source is moving relative to an observer and that this is known as the Doppler effect', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3b-properties-of-waves'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.9 — official Issue 4 §3(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.9', 'explain that all waves can be reflected and refracted', 'explain that all waves can be reflected and refracted', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3b-properties-of-waves'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.10 — official Issue 4 §3(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.10', 'know that light is part of a continuous electromagnetic spectrum that includes radio,…', 'know that light is part of a continuous electromagnetic spectrum that includes radio, microwave, infrared, visible, ultraviolet, x-ray and gamma ray radiations, and that all these waves travel at the same speed in free space', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3c-the-electromagnetic-spectrum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.11 — official Issue 4 §3(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.11', 'know the order of the electromagnetic spectrum in terms of decreasing wavelength and…', 'know the order of the electromagnetic spectrum in terms of decreasing wavelength and increasing frequency, including the colours of the visible spectrum', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3c-the-electromagnetic-spectrum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.12 — official Issue 4 §3(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.12', 'explain some of the uses of electromagnetic radiations, including:', 'explain some of the uses of electromagnetic radiations, including:
• radio waves: broadcasting and communications
• microwaves: cooking and satellite transmissions
• infrared: heaters and night vision equipment
• visible light: optical fibres and photography
• ultraviolet: fluorescent lamps
• x-rays: observing the internal structure of objects and materials, including for medical applications
• gamma rays: sterilising food and medical equipment', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3c-the-electromagnetic-spectrum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.13 — official Issue 4 §3(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.13', 'explain the detrimental effects of excessive exposure of the human body to…', 'explain the detrimental effects of excessive exposure of the human body to electromagnetic waves, including:
• microwaves: internal heating of body tissue
• infrared: skin burns
• ultraviolet: damage to surface cells and blindness
• gamma rays: cancer, mutation and describe simple protective measures against  the risks', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3c-the-electromagnetic-spectrum'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.14 — official Issue 4 §3(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.14', 'know that light waves are transverse waves and that they can be reflected and refracted', 'know that light waves are transverse waves and that they can be reflected and refracted', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.15 — official Issue 4 §3(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.15', 'use the law of reflection (the angle of incidence equals the angle of reflection)', 'use the law of reflection (the angle of incidence equals the angle of reflection)', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.16 — official Issue 4 §3(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.16', 'draw ray diagrams to illustrate reflection and refraction', 'draw ray diagrams to illustrate reflection and refraction', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.17 — official Issue 4 §3(d) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.17', 'practical: investigate the refraction of light, using rectangular blocks, semi-circular…', 'practical: investigate the refraction of light, using rectangular blocks, semi-circular blocks and triangular prisms', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.18 — official Issue 4 §3(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.18', 'know and use the relationship between refractive index, angle of incidence and angle of…', 'know and use the relationship between refractive index, angle of incidence and angle of refraction:
n = (sin i)/(sin r)', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.19 — official Issue 4 §3(d) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.19', 'practical: investigate the refractive index of glass, using a glass block', 'practical: investigate the refractive index of glass, using a glass block', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.20 — official Issue 4 §3(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.20', 'describe the role of total internal reflection in transmitting information along…', 'describe the role of total internal reflection in transmitting information along optical fibres and in prisms', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.21 — official Issue 4 §3(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.21', 'explain the meaning of critical angle c', 'explain the meaning of critical angle c', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.22 — official Issue 4 §3(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.22', 'know and use the relationship between critical angle and refractive index:', 'know and use the relationship between critical angle and refractive index:
sin c = 1/n', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.23 — official Issue 4 §3(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.23', 'know that sound waves are longitudinal waves that can be reflected and refracted', 'know that sound waves are longitudinal waves that can be reflected and refracted', NULL, 'draft', 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.24P — official Issue 4 §3(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.24P', 'know that the frequency range for human hearing is 20–20 000 Hz', 'know that the frequency range for human hearing is 20–20 000 Hz', NULL, 'draft', 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.25P — official Issue 4 §3(d) (P: Physics-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.25P', 'practical: investigate the speed of sound in air', 'practical: investigate the speed of sound in air', NULL, 'draft', 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.26P — official Issue 4 §3(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.26P', 'understand how an oscilloscope and microphone can be used to display a sound wave', 'understand how an oscilloscope and microphone can be used to display a sound wave', NULL, 'draft', 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.27P — official Issue 4 §3(d) (P: Physics-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.27P', 'practical: investigate the frequency of a sound wave using an oscilloscope', 'practical: investigate the frequency of a sound wave using an oscilloscope', NULL, 'draft', 27
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.28P — official Issue 4 §3(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.28P', 'understand how the pitch of a sound relates to the frequency of vibration of the source', 'understand how the pitch of a sound relates to the frequency of vibration of the source', NULL, 'draft', 28
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 3.29P — official Issue 4 §3(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '3.29P', 'understand how the loudness of a sound relates to the amplitude of vibration of the…', 'understand how the loudness of a sound relates to the amplitude of vibration of the source', NULL, 'draft', 29
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '3d-light-and-sound'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.1 — official Issue 4 §4(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.1', 'use the following units: kilogram (kg), joule (J), metre (m), metre/second (m/s),…', 'use the following units: kilogram (kg), joule (J), metre (m), metre/second (m/s), metre/second² (m/s²), newton (N), second (s) and watt (W)', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4a-units'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.2 — official Issue 4 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.2', 'describe energy transfers involving energy stores:', 'describe energy transfers involving energy stores:
• energy stores: chemical, kinetic, gravitational, elastic, thermal, magnetic, electrostatic, nuclear
• energy transfers: mechanically, electrically, by heating, by radiation (light and sound)', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4b-energy-transfers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.3 — official Issue 4 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.3', 'use the principle of conservation of energy', 'use the principle of conservation of energy', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4b-energy-transfers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.4 — official Issue 4 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.4', 'know and use the relationship between efficiency, useful energy output and total energy…', 'know and use the relationship between efficiency, useful energy output and total energy output:
efficiency = (useful energy output)/(total energy output) × 100%', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4b-energy-transfers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.5 — official Issue 4 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.5', 'describe a variety of everyday and scientific devices and situations, explaining the…', 'describe a variety of everyday and scientific devices and situations, explaining the transfer of the input energy in terms of the above relationship, including their representation by Sankey diagrams', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4b-energy-transfers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.6 — official Issue 4 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.6', 'describe how thermal energy transfer may take place by conduction, convection and…', 'describe how thermal energy transfer may take place by conduction, convection and radiation', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4b-energy-transfers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.7 — official Issue 4 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.7', 'explain the role of convection in everyday phenomena', 'explain the role of convection in everyday phenomena', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4b-energy-transfers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.8 — official Issue 4 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.8', 'explain how emission and absorption of radiation are related to surface and temperature', 'explain how emission and absorption of radiation are related to surface and temperature', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4b-energy-transfers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.9 — official Issue 4 §4(b) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.9', 'practical: investigate thermal energy transfer by conduction, convection and radiation', 'practical: investigate thermal energy transfer by conduction, convection and radiation', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4b-energy-transfers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.10 — official Issue 4 §4(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.10', 'explain ways of reducing unwanted energy transfer, such as insulation', 'explain ways of reducing unwanted energy transfer, such as insulation', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4b-energy-transfers'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.11 — official Issue 4 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.11', 'know and use the relationship between work done, force and distance moved in the…', 'know and use the relationship between work done, force and distance moved in the direction of the force:
work done = force × distance moved
W = F × d', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4c-work-and-power'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.12 — official Issue 4 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.12', 'know that work done is equal to energy transferred', 'know that work done is equal to energy transferred', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4c-work-and-power'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.13 — official Issue 4 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.13', 'know and use the relationship between gravitational potential energy, mass,…', 'know and use the relationship between gravitational potential energy, mass, gravitational field strength and height:
gravitational potential energy = mass × gravitational field strength × height
GPE = m × g × h', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4c-work-and-power'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.14 — official Issue 4 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.14', 'know and use the relationship:', 'know and use the relationship:
kinetic energy = ½ × mass × speed²
KE = ½ × m × v²', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4c-work-and-power'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.15 — official Issue 4 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.15', 'understand how conservation of energy produces a link between gravitational potential…', 'understand how conservation of energy produces a link between gravitational potential energy, kinetic energy and work', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4c-work-and-power'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.16 — official Issue 4 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.16', 'describe power as the rate of transfer of energy or the rate of doing work', 'describe power as the rate of transfer of energy or the rate of doing work', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4c-work-and-power'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.17 — official Issue 4 §4(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.17', 'use the relationship between power, work done (energy transferred) and time taken:', 'use the relationship between power, work done (energy transferred) and time taken:
power = (work done)/(time taken)
P = W/t', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4c-work-and-power'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.18P — official Issue 4 §4(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.18P', 'describe the energy transfers involved in generating electricity using:', 'describe the energy transfers involved in generating electricity using:
• wind
• water
• geothermal resources
• solar heating systems
• solar cells
• fossil fuels
• nuclear power', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4d-energy-resources-and-electricity-generation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 4.19P — official Issue 4 §4(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '4.19P', 'describe the advantages and disadvantages of methods of large-scale electricity…', 'describe the advantages and disadvantages of methods of large-scale electricity production from various renewable and non-renewable resources', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '4d-energy-resources-and-electricity-generation'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.1 — official Issue 4 §5(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.1', 'use the following units: degree Celsius (°C), Kelvin (K), joule (J), kilogram (kg),…', 'use the following units: degree Celsius (°C), Kelvin (K), joule (J), kilogram (kg), kilogram/metre³ (kg/m³), metre (m), metre² (m²), metre³ (m³), metre/second (m/s), metre/second² (m/s²), newton (N) and pascal (Pa)', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5a-units'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.2P — official Issue 4 §5(a) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.2P', 'use the following unit: joules/kilogram degree Celsius (J/kg °C)', 'use the following unit: joules/kilogram degree Celsius (J/kg °C)', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5a-units'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.3 — official Issue 4 §5(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.3', 'know and use the relationship between density, mass and volume:', 'know and use the relationship between density, mass and volume:
density = mass/volume
ρ = m/V', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5b-density-and-pressure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.4 — official Issue 4 §5(b) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.4', 'practical: investigate density using direct measurements of mass and volume', 'practical: investigate density using direct measurements of mass and volume', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5b-density-and-pressure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.5 — official Issue 4 §5(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.5', 'know and use the relationship between pressure, force and area:', 'know and use the relationship between pressure, force and area:
pressure = force/area
p = F/A', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5b-density-and-pressure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.6 — official Issue 4 §5(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.6', 'understand how the pressure at a point in a gas or liquid at rest acts equally in all…', 'understand how the pressure at a point in a gas or liquid at rest acts equally in all directions', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5b-density-and-pressure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.7 — official Issue 4 §5(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.7', 'know and use the relationship for pressure difference:', 'know and use the relationship for pressure difference:
pressure difference = height × density × gravitational field strength
p = h × ρ × g', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5b-density-and-pressure'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.8P — official Issue 4 §5(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.8P', 'explain why heating a system will change the energy stored within the system and raise…', 'explain why heating a system will change the energy stored within the system and raise its temperature or produce changes of state', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5c-change-of-state'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.9P — official Issue 4 §5(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.9P', 'describe the changes that occur when a solid melts to form a liquid, and when a liquid…', 'describe the changes that occur when a solid melts to form a liquid, and when a liquid evaporates or boils to form a gas', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5c-change-of-state'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.10P — official Issue 4 §5(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.10P', 'describe the arrangement and motion of particles in solids, liquids and gases', 'describe the arrangement and motion of particles in solids, liquids and gases', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5c-change-of-state'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.11P — official Issue 4 §5(c) (P: Physics-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.11P', 'practical: obtain a temperature–time graph to show the constant temperature during a…', 'practical: obtain a temperature–time graph to show the constant temperature during a change of state', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5c-change-of-state'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.12P — official Issue 4 §5(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.12P', 'know that specific heat capacity is the energy required to change the temperature of an…', 'know that specific heat capacity is the energy required to change the temperature of an object by one degree Celsius per kilogram of mass (J/kg °C)', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5c-change-of-state'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.13P — official Issue 4 §5(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.13P', 'use the equation:', 'use the equation:
change in thermal energy = mass × specific heat capacity × change in temperature
ΔQ = m × c × ΔT', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5c-change-of-state'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.14P — official Issue 4 §5(c) (P: Physics-only, Paper 2 only; practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.14P', 'practical: investigate the specific heat capacity of materials including water and some…', 'practical: investigate the specific heat capacity of materials including water and some solids', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5c-change-of-state'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.15 — official Issue 4 §5(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.15', 'explain how molecules in a gas have random motion and that they exert a force, and…', 'explain how molecules in a gas have random motion and that they exert a force, and hence a pressure, on the walls of a container', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5d-ideal-gas-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.16 — official Issue 4 §5(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.16', 'understand why there is an absolute zero of temperature, which is –273 °C', 'understand why there is an absolute zero of temperature, which is –273 °C', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5d-ideal-gas-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.17 — official Issue 4 §5(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.17', 'describe the Kelvin scale of temperature and be able to convert between the Kelvin and…', 'describe the Kelvin scale of temperature and be able to convert between the Kelvin and Celsius scales', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5d-ideal-gas-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.18 — official Issue 4 §5(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.18', 'understand why an increase in temperature results in an increase in the average speed…', 'understand why an increase in temperature results in an increase in the average speed of gas molecules', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5d-ideal-gas-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.19 — official Issue 4 §5(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.19', 'know that the Kelvin temperature of a gas is proportional to the average kinetic energy…', 'know that the Kelvin temperature of a gas is proportional to the average kinetic energy of its molecules', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5d-ideal-gas-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.20 — official Issue 4 §5(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.20', 'explain, for a fixed amount of gas, the qualitative relationship between:', 'explain, for a fixed amount of gas, the qualitative relationship between:
• pressure and volume at constant temperature
• pressure and Kelvin temperature at constant volume', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5d-ideal-gas-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.21 — official Issue 4 §5(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.21', 'use the relationship between the pressure and Kelvin temperature of a fixed mass of gas…', 'use the relationship between the pressure and Kelvin temperature of a fixed mass of gas at constant volume:
p₁/T₁ = p₂/T₂', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5d-ideal-gas-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 5.22 — official Issue 4 §5(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '5.22', 'use the relationship between the pressure and volume of a fixed mass of gas at constant…', 'use the relationship between the pressure and volume of a fixed mass of gas at constant temperature:
p₁V₁ = p₂V₂', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '5d-ideal-gas-molecules'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.1 — official Issue 4 §6(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.1', 'use the following units: ampere (A), volt (V) and watt (W)', 'use the following units: ampere (A), volt (V) and watt (W)', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6a-units'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.2 — official Issue 4 §6(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.2', 'know that magnets repel and attract other magnets and attract magnetic  substances', 'know that magnets repel and attract other magnets and attract magnetic  substances', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6b-magnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.3 — official Issue 4 §6(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.3', 'describe the properties of magnetically hard and soft materials', 'describe the properties of magnetically hard and soft materials', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6b-magnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.4 — official Issue 4 §6(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.4', 'understand the term ''magnetic field line''', 'understand the term ''magnetic field line''', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6b-magnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.5 — official Issue 4 §6(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.5', 'know that magnetism is induced in some materials when they are placed in a magnetic…', 'know that magnetism is induced in some materials when they are placed in a magnetic field', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6b-magnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.6 — official Issue 4 §6(b) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.6', 'practical: investigate the magnetic field pattern for a permanent bar magnet and…', 'practical: investigate the magnetic field pattern for a permanent bar magnet and between two bar magnets', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6b-magnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.7 — official Issue 4 §6(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.7', 'describe how to use two permanent magnets to produce a uniform magnetic field pattern', 'describe how to use two permanent magnets to produce a uniform magnetic field pattern', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6b-magnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.8 — official Issue 4 §6(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.8', 'know that an electric current in a conductor produces a magnetic field around it', 'know that an electric current in a conductor produces a magnetic field around it', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6c-electromagnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.9P — official Issue 4 §6(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.9P', 'describe the construction of electromagnets', 'describe the construction of electromagnets', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6c-electromagnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.10P — official Issue 4 §6(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.10P', 'draw magnetic field patterns for a straight wire, a flat circular coil and a solenoid…', 'draw magnetic field patterns for a straight wire, a flat circular coil and a solenoid when each is carrying a current', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6c-electromagnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.11P — official Issue 4 §6(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.11P', 'know that there is a force on a charged particle when it moves in a magnetic field as…', 'know that there is a force on a charged particle when it moves in a magnetic field as long as its motion is not parallel to the field', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6c-electromagnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.12 — official Issue 4 §6(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.12', 'understand why a force is exerted on a current-carrying wire in a magnetic field and…', 'understand why a force is exerted on a current-carrying wire in a magnetic field and how this effect is applied in simple d.c. electric motors and loudspeakers', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6c-electromagnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.13 — official Issue 4 §6(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.13', 'use the left-hand rule to predict the direction of the resulting force when a wire…', 'use the left-hand rule to predict the direction of the resulting force when a wire carries a current perpendicular to a magnetic field', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6c-electromagnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.14 — official Issue 4 §6(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.14', 'describe how the force on a current-carrying conductor in a magnetic field changes with…', 'describe how the force on a current-carrying conductor in a magnetic field changes with the magnitude and direction of the field and current', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6c-electromagnetism'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.15 — official Issue 4 §6(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.15', 'know that a voltage is induced in a conductor or a coil when it moves through a…', 'know that a voltage is induced in a conductor or a coil when it moves through a magnetic field or when a magnetic field changes through it and describe the factors that affect the size of the induced voltage', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6d-electromagnetic-induction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.16 — official Issue 4 §6(d)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.16', 'describe the generation of electricity by the rotation of a magnet within a coil of…', 'describe the generation of electricity by the rotation of a magnet within a coil of wire and of a coil of wire within a magnetic field, and describe the factors that affect the size of the induced voltage', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6d-electromagnetic-induction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.17P — official Issue 4 §6(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.17P', 'describe the structure of a transformer and understand that a transformer changes the…', 'describe the structure of a transformer and understand that a transformer changes the size of an alternating voltage by having different numbers of turns on the input and output sides', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6d-electromagnetic-induction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.18P — official Issue 4 §6(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.18P', 'explain the use of step-up and step-down transformers in the large-scale generation and…', 'explain the use of step-up and step-down transformers in the large-scale generation and transmission of electrical energy', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6d-electromagnetic-induction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.19P — official Issue 4 §6(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.19P', 'know and use the relationship between input (primary) and output (secondary) voltages…', 'know and use the relationship between input (primary) and output (secondary) voltages and the turns ratio for a transformer:
(input (primary) voltage)/(output (secondary) voltage) = (primary turns)/(secondary turns)', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6d-electromagnetic-induction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 6.20P — official Issue 4 §6(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '6.20P', 'know and use the relationship:', 'know and use the relationship:
input power = output power
Vₚ Iₚ = Vₛ Iₛ
for 100% efficiency', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '6d-electromagnetic-induction'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.1 — official Issue 4 §7(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.1', 'use the following units: becquerel (Bq), centimetre (cm), hour (h), minute (min) and…', 'use the following units: becquerel (Bq), centimetre (cm), hour (h), minute (min) and second (s)', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7a-units'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.2 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.2', 'describe the structure of an atom in terms of protons, neutrons and electrons and use…', 'describe the structure of an atom in terms of protons, neutrons and electrons and use symbols such as ¹⁴₆C to describe particular nuclei', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.3 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.3', 'know the terms atomic (proton) number, mass (nucleon) number and isotope', 'know the terms atomic (proton) number, mass (nucleon) number and isotope', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.4 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.4', 'know that alpha (α) particles, beta (β⁻) particles, and gamma (γ) rays are ionising…', 'know that alpha (α) particles, beta (β⁻) particles, and gamma (γ) rays are ionising radiations emitted from unstable nuclei in a random process', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.5 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.5', 'describe the nature of alpha (α) particles, beta (β⁻) particles and gamma (γ) rays, and…', 'describe the nature of alpha (α) particles, beta (β⁻) particles and gamma (γ) rays, and recall that they may be distinguished in terms of penetrating power and ability to ionise', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.6 — official Issue 4 §7(b) (practical)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.6', 'practical: investigate the penetration powers of different types of radiation using…', 'practical: investigate the penetration powers of different types of radiation using either radioactive sources or simulations', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.7 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.7', 'describe the effects on the atomic and mass numbers of a nucleus of the emission of…', 'describe the effects on the atomic and mass numbers of a nucleus of the emission of each of the four main types of radiation (alpha, beta, gamma and neutron radiation)', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.8 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.8', 'understand how to balance nuclear equations in terms of mass and charge', 'understand how to balance nuclear equations in terms of mass and charge', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.9 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.9', 'know that photographic film or a Geiger−Müller detector can detect ionising radiations', 'know that photographic film or a Geiger−Müller detector can detect ionising radiations', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.10 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.10', 'explain the sources of background (ionising) radiation from Earth and space', 'explain the sources of background (ionising) radiation from Earth and space', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.11 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.11', 'know that the activity of a radioactive source decreases over a  period of time and is…', 'know that the activity of a radioactive source decreases over a  period of time and is measured in becquerels', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.12 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.12', 'know the definition of the term ''half-life'' and understand that it is different for…', 'know the definition of the term ''half-life'' and understand that it is different for different radioactive isotopes', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.13 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.13', 'use the concept of the half-life to carry out simple calculations on activity,…', 'use the concept of the half-life to carry out simple calculations on activity, including graphical methods', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.14 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.14', 'describe uses of radioactivity in industry and medicine', 'describe uses of radioactivity in industry and medicine', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.15 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.15', 'describe the difference between contamination and irradiation', 'describe the difference between contamination and irradiation', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.16 — official Issue 4 §7(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.16', 'describe the dangers of ionising radiations, including:', 'describe the dangers of ionising radiations, including:
• that radiation can cause mutations in living organisms
• that radiation can damage cells and tissue
• the problems arising from the disposal of radioactive waste and how the associated risks can be reduced', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7b-radioactivity'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.17 — official Issue 4 §7(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.17', 'know that nuclear reactions, including fission, fusion and radioactive decay, can be a…', 'know that nuclear reactions, including fission, fusion and radioactive decay, can be a source of energy', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7c-fission-and-fusion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.18 — official Issue 4 §7(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.18', 'understand how a nucleus of U-235 can be split (the process of fission) by collision…', 'understand how a nucleus of U-235 can be split (the process of fission) by collision with a neutron and that this process releases energy as kinetic energy of the fission products', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7c-fission-and-fusion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.19 — official Issue 4 §7(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.19', 'know that the fission of U-235 produces two radioactive daughter nuclei and a small…', 'know that the fission of U-235 produces two radioactive daughter nuclei and a small number of neutrons', NULL, 'draft', 19
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7c-fission-and-fusion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.20 — official Issue 4 §7(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.20', 'describe how a chain reaction can be set up if the neutrons produced by one fission…', 'describe how a chain reaction can be set up if the neutrons produced by one fission strike other U-235 nuclei', NULL, 'draft', 20
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7c-fission-and-fusion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.21 — official Issue 4 §7(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.21', 'describe the role played by the control rods and moderator in the fission process', 'describe the role played by the control rods and moderator in the fission process', NULL, 'draft', 21
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7c-fission-and-fusion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.22 — official Issue 4 §7(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.22', 'understand the role of shielding around a nuclear reactor', 'understand the role of shielding around a nuclear reactor', NULL, 'draft', 22
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7c-fission-and-fusion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.23 — official Issue 4 §7(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.23', 'explain the difference between nuclear fusion and nuclear fission', 'explain the difference between nuclear fusion and nuclear fission', NULL, 'draft', 23
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7c-fission-and-fusion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.24 — official Issue 4 §7(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.24', 'describe nuclear fusion as the creation of larger nuclei resulting in a loss of mass…', 'describe nuclear fusion as the creation of larger nuclei resulting in a loss of mass from smaller nuclei, accompanied by a release of energy', NULL, 'draft', 24
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7c-fission-and-fusion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.25 — official Issue 4 §7(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.25', 'know that fusion is the energy source for stars', 'know that fusion is the energy source for stars', NULL, 'draft', 25
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7c-fission-and-fusion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 7.26 — official Issue 4 §7(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '7.26', 'explain why nuclear fusion does not happen at low temperatures and pressures, due to…', 'explain why nuclear fusion does not happen at low temperatures and pressures, due to electrostatic repulsion of protons', NULL, 'draft', 26
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '7c-fission-and-fusion'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.1 — official Issue 4 §8(a)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.1', 'use the following units: kilogram (kg), metre (m), metre/second (m/s), metre/second²…', 'use the following units: kilogram (kg), metre (m), metre/second (m/s), metre/second² (m/s²), newton (N), second (s), newton/kilogram (N/kg)', NULL, 'draft', 1
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8a-units'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.2 — official Issue 4 §8(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.2', 'know that:', 'know that:
• the universe is a large collection of billions of galaxies
• a galaxy is a large collection of billions of stars
• our solar system is in the Milky Way galaxy', NULL, 'draft', 2
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8b-motion-in-the-universe'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.3 — official Issue 4 §8(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.3', 'understand why gravitational field strength, g, varies and know that it is different on…', 'understand why gravitational field strength, g, varies and know that it is different on other planets and the Moon from that on the Earth', NULL, 'draft', 3
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8b-motion-in-the-universe'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.4 — official Issue 4 §8(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.4', 'explain that gravitational force:', 'explain that gravitational force:
• causes moons to orbit planets
• causes the planets to orbit the Sun
• causes artificial satellites to orbit the Earth
• causes comets to orbit the Sun', NULL, 'draft', 4
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8b-motion-in-the-universe'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.5 — official Issue 4 §8(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.5', 'describe the differences in the orbits of comets, moons and planets', 'describe the differences in the orbits of comets, moons and planets', NULL, 'draft', 5
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8b-motion-in-the-universe'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.6 — official Issue 4 §8(b)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.6', 'use the relationship between orbital speed, orbital radius and time period:', 'use the relationship between orbital speed, orbital radius and time period:
orbital speed = (2 × π × orbital radius)/(time period)
v = (2 × π × r)/T', NULL, 'draft', 6
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8b-motion-in-the-universe'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.7 — official Issue 4 §8(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.7', 'understand how stars can be classified according to their colour', 'understand how stars can be classified according to their colour', NULL, 'draft', 7
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8c-stellar-evolution'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.8 — official Issue 4 §8(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.8', 'know that a star’s colour is related to its surface temperature', 'know that a star’s colour is related to its surface temperature', NULL, 'draft', 8
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8c-stellar-evolution'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.9 — official Issue 4 §8(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.9', 'describe the evolution of stars of similar mass to the Sun through the following stages:', 'describe the evolution of stars of similar mass to the Sun through the following stages:
• nebula
• star (main sequence)
• red giant
• white dwarf', NULL, 'draft', 9
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8c-stellar-evolution'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.10 — official Issue 4 §8(c)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.10', 'describe the evolution of stars with a mass larger than the Sun', 'describe the evolution of stars with a mass larger than the Sun', NULL, 'draft', 10
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8c-stellar-evolution'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.11P — official Issue 4 §8(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.11P', 'understand how the brightness of a star at a standard distance can be represented using…', 'understand how the brightness of a star at a standard distance can be represented using absolute magnitude', NULL, 'draft', 11
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8c-stellar-evolution'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.12P — official Issue 4 §8(c) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.12P', 'draw the main components of the Hertzsprung–Russell diagram (HR diagram)', 'draw the main components of the Hertzsprung–Russell diagram (HR diagram)', NULL, 'draft', 12
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8c-stellar-evolution'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.13P — official Issue 4 §8(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.13P', 'describe the past evolution of the universe and the main arguments in favour of the Big…', 'describe the past evolution of the universe and the main arguments in favour of the Big Bang theory', NULL, 'draft', 13
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8d-cosmology'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.14P — official Issue 4 §8(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.14P', 'describe evidence that supports the Big Bang theory (red-shift and cosmic microwave…', 'describe evidence that supports the Big Bang theory (red-shift and cosmic microwave background - CMB - radiation)', NULL, 'draft', 14
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8d-cosmology'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.15P — official Issue 4 §8(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.15P', 'describe that if a wave source is moving relative to an observer, there will be a…', 'describe that if a wave source is moving relative to an observer, there will be a change in the observed frequency and wavelength', NULL, 'draft', 15
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8d-cosmology'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.16P — official Issue 4 §8(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.16P', 'use the equation relating to change in wavelength, reference wavelength, velocity of a…', 'use the equation relating to change in wavelength, reference wavelength, velocity of a galaxy and the speed of light:
(change in wavelength)/(reference wavelength) = (velocity of a galaxy)/(speed of light)
(λ − λ₀)/λ₀ = Δλ/λ₀ = v/c', NULL, 'draft', 16
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8d-cosmology'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.17P — official Issue 4 §8(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.17P', 'describe the red-shift in light received from galaxies at different distances away from…', 'describe the red-shift in light received from galaxies at different distances away from the Earth', NULL, 'draft', 17
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8d-cosmology'
ON CONFLICT (topic_id, code) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      command_terms = EXCLUDED.command_terms, sort_order = EXCLUDED.sort_order;

-- 8.18P — official Issue 4 §8(d) (P: Physics-only, Paper 2 only)
INSERT INTO spec_points (topic_id, code, title, description, command_terms, status, sort_order)
SELECT t.id, '8.18P', 'explain why the red-shift of galaxies provides evidence for the expansion of the…', 'explain why the red-shift of galaxies provides evidence for the expansion of the universe', NULL, 'draft', 18
FROM topics t JOIN courses cs ON cs.id = t.course_id AND cs.slug = 'edexcel-igcse-physics'
WHERE t.slug = '8d-cosmology'
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
  p_count integer;
BEGIN
  SELECT count(*) INTO topic_count FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics' AND t.unit_id IS NULL;
  SELECT count(*) INTO point_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics';
  SELECT count(*) INTO p_count FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics' AND p.code LIKE '%P';
  IF topic_count <> 30 THEN
    RAISE EXCEPTION '010 aborted: % unit-less topics, expected 30', topic_count;
  END IF;
  IF point_count <> 195 THEN
    RAISE EXCEPTION '010 aborted: % spec points, expected 195', point_count;
  END IF;
  IF p_count <> 48 THEN
    RAISE EXCEPTION '010 aborted: % P-suffix points, expected 48', p_count;
  END IF;
END $$;

COMMIT;
-- END OF 010 — 30 topics, 195 points. If this line is missing, the paste was truncated.
