-- ============================================================================
-- 0006_subject_colours.sql
-- ----------------------------------------------------------------------------
-- Sets the canonical accent colours on each subject row. These drive
-- subject-level theming inside /learn/* via the --subject-accent and
-- --subject-accent-dark CSS custom properties.
--
-- Colours chosen to be:
--   * Distinct on parchment (#F5EFE6) and ink (#0F1419) backgrounds.
--   * AA-contrast-safe for the "Start lesson" CTA at body text size.
--   * Compatible with the existing brand palette — Chemistry stays in the
--     flask-orange family it's worn since v1.
--
-- Idempotent — UPDATEs always set the same value, safe to re-run.
-- ============================================================================

UPDATE subjects SET color_as = '#F97316', color_a2 = '#E0610C' WHERE slug = 'chemistry';
UPDATE subjects SET color_as = '#4A9D5C', color_a2 = '#3D8249' WHERE slug = 'biology';
UPDATE subjects SET color_as = '#3B7CB8', color_a2 = '#2C6699' WHERE slug = 'physics';
