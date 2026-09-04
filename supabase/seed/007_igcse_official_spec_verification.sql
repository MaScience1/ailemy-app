-- ============================================================================
-- AILEMY — 4CH1 OFFICIAL SPECIFICATION VERIFICATION (lifecycle pass)
--
-- ⚠ NOT YET APPLIED. Prepared 2026-09-04 for owner review. On application,
--   rewrite this header the same day with the date and verification result
--   (the 004 rule: the seed folder is the record of what is live).
--
-- WHAT THIS PASS DOES — and the WHOLE of what it does:
--   status 'draft' -> 'live' and verified_at set, on EXACTLY the 182
--   specification points of edexcel-igcse-chemistry seeded by 006. This is
--   the lifecycle 0001's schema comment prescribes ("set when content
--   matches official spec") and the exact transition 005 applied to the
--   verified IAL rows. NOTHING ELSE MOVES: no code, title, description,
--   topic_id, sort_order or command_terms is written; no row is created,
--   deleted or touched on any other course; topics stay 'coming_soon'
--   exactly as IAL's topics did after 005.
--
-- WHY THESE ROWS QUALIFY AS VERIFIED (re-checked 2026-09-04, same day):
--   * Source of authority: Pearson Edexcel International GCSE in Chemistry
--     (4CH1) Specification, Issue 3, © Pearson Education Limited 2024 —
--     pdf sha256 36e2080d2e99f060bcc18f2a9d0bbd8b29498b45e007fa232e3befcd89b73362,
--     re-hashed and unchanged at re-verification time.
--   * Clean-room re-extraction from that PDF reproduced the committed
--     extraction byte-for-byte (sections, sub-topics, codes, wording,
--     C-flags, ordering) — 4 sections, 28 sub-topics, 182 points, 52
--     C-suffix (Paper 2-only), 12 practicals.
--   * All 182 statements re-verified chunk-verbatim against a FRESH
--     independent pdftotext extraction of the same PDF: 182/182 clean.
--   * Live production rows re-verified read-only against the extraction
--     the same day (scripts/db-checks/igcse-4ch1-spec-verify.ts, ALL
--     CHECKS PASS): codes, wording, titles, topics, ordering, C-count,
--     zero duplicates/malformed/orphans, zero cross-course contamination,
--     IAL untouched at 157 live+verified + 1 archived (1.13).
--
-- SAFETY SHAPE (all inside one transaction; any RAISE rolls everything back):
--   pre-guard  — refuses to run unless the course holds exactly 182 points,
--                all 'draft' with verified_at NULL (a second run after
--                success is a loud no-op, not a silent rewrite);
--   the UPDATE — scoped by course slug AND the draft/NULL state, so even a
--                hand-edited copy cannot reach another course's rows;
--   row-count  — GET DIAGNOSTICS must say exactly 182 (or 0 on the no-op);
--   post-guard — 182 live+verified and 0 draft on this course, and IAL
--                still exactly 157 live+verified + 1 archived.
-- A truncated SQL-Editor paste loses COMMIT and rolls back (006's guard
-- doctrine); the END sentinel marks a complete paste.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  course_points integer;
  eligible      integer;
  already       integer;
  updated       integer;
  now_live      integer;
  now_draft     integer;
  ial_live      integer;
  ial_verified  integer;
  ial_archived  integer;
BEGIN
  SELECT count(*) INTO course_points
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-chemistry';
  SELECT count(*) INTO eligible
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-chemistry'
     AND p.status = 'draft' AND p.verified_at IS NULL;
  SELECT count(*) INTO already
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-chemistry'
     AND p.status = 'live' AND p.verified_at IS NOT NULL;

  IF course_points <> 182 THEN
    RAISE EXCEPTION '007 aborted: course holds % points, expected 182', course_points;
  END IF;

  IF eligible = 0 AND already = 182 THEN
    RAISE NOTICE '007: already applied — 182 rows live+verified; nothing to do';
  ELSIF eligible <> 182 THEN
    RAISE EXCEPTION '007 aborted: % eligible draft rows (% already verified), expected 182 or an exact no-op', eligible, already;
  ELSE
    UPDATE spec_points p
       SET status = 'live', verified_at = now()
      FROM topics t
      JOIN courses c ON c.id = t.course_id
     WHERE t.id = p.topic_id
       AND c.slug = 'edexcel-igcse-chemistry'
       AND p.status = 'draft' AND p.verified_at IS NULL;
    GET DIAGNOSTICS updated = ROW_COUNT;
    IF updated <> 182 THEN
      RAISE EXCEPTION '007 aborted: UPDATE touched % rows, expected exactly 182', updated;
    END IF;
  END IF;

  -- Post-guard: the end state, whichever path ran.
  SELECT count(*) INTO now_live
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-chemistry'
     AND p.status = 'live' AND p.verified_at IS NOT NULL;
  SELECT count(*) INTO now_draft
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-chemistry' AND p.status = 'draft';
  IF now_live <> 182 OR now_draft <> 0 THEN
    RAISE EXCEPTION '007 aborted: end state % live+verified / % draft, expected 182 / 0', now_live, now_draft;
  END IF;

  -- IAL must be exactly what it was before this file existed.
  SELECT count(*) FILTER (WHERE p.status = 'live'),
         count(*) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL),
         count(*) FILTER (WHERE p.status = 'archived')
    INTO ial_live, ial_verified, ial_archived
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-chemistry';
  IF ial_live <> 157 OR ial_verified <> 157 OR ial_archived <> 1 THEN
    RAISE EXCEPTION '007 aborted: IAL state drifted to %/%/% (live/verified/archived), expected 157/157/1', ial_live, ial_verified, ial_archived;
  END IF;
END $$;

COMMIT;
-- END OF 007 — lifecycle only: 182 points draft->live+verified_at. If this line is missing, the paste was truncated.
