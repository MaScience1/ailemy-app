-- ============================================================================
-- 0012_past_papers_examiner_report.sql
-- ----------------------------------------------------------------------------
-- Adds a third PDF slot to past_papers for the examiner report, alongside the
-- question paper and mark scheme created in 0007.
--
-- NAMING: mirrors 0007's convention exactly — `<document>_pdf_path`, holding a
-- key inside the public "papers" Storage bucket (not a URL). Compare:
--     paper_pdf_path              -- question paper
--     markscheme_pdf_path         -- mark scheme
--     examiner_report_pdf_path    -- this migration
--
-- Nullable with no default, like its two siblings: a paper may have any subset
-- of the three documents, and "no examiner report" is the common case rather
-- than an error state.
--
-- NUMBERING: 0010 and 0011 are already used by the unmerged
-- feat/admin-inline-edit branch (site_copy, pages). This migration is numbered
-- 0012 so the two branches cannot collide on a filename when they meet.
--
-- Additive only — no existing column, index, policy or grant is touched, and
-- the existing RLS policy (past_papers_public_read_live) already governs read
-- access to the whole row. Safe to run any time; no backfill needed.
-- ============================================================================

BEGIN;

ALTER TABLE past_papers
  ADD COLUMN IF NOT EXISTS examiner_report_pdf_path text;

COMMIT;
