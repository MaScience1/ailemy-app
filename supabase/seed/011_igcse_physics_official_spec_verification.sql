-- ============================================================================
-- AILEMY — 4PH1 OFFICIAL SPECIFICATION VERIFICATION (lifecycle pass)
--
-- ⚠ NOT YET APPLIED. This file runs ONLY after seed 010 is applied and its
--   read-only post-apply verification has passed (the 008 → 009 procedure):
--   owner-run read-only pre-check first, then a whole-file SQL-Editor paste
--   (byte count clipboard-verified, END-OF-011 sentinel visibly the last
--   line of the paste), then the owner's independent read-only post-apply
--   check, then this header is amended to record APPLIED and VERIFIED.
--   Expected pre-check: 195 eligible draft/unverified Physics points on 30
--   unit-less topics, 48 P-suffix, 0 outside-lifecycle, 0 lesson mappings,
--   0 question mappings, 4CH1 28/182/182/52, 4BI1 22/176/176/42, IAL 157/1,
--   non-Physics total 516.
--
-- WHAT THIS PASS DOES — and the WHOLE of what it does:
--   status 'draft' -> 'live' and verified_at set, on EXACTLY the 195
--   specification points of edexcel-igcse-physics seeded by 010. This is
--   the lifecycle 0001's schema comment prescribes ("set when content
--   matches official spec") and the exact transition 005 applied to IAL,
--   007 applied to 4CH1 and 009 applied to 4BI1. NOTHING ELSE MOVES: no
--   code, title, description, topic_id, sort_order or command_terms is
--   written; no row is created, deleted or touched on any other course;
--   topics stay 'coming_soon' exactly as 4CH1's and 4BI1's did.
--
-- WHY THESE ROWS QUALIFY AS VERIFIED (evidence assembled 2026-09-06):
--   * Source of authority: Pearson Edexcel International GCSE in Physics
--     (4PH1) Specification, Issue 4, © Pearson Education Limited 2024
--     (ISBN 978 1 446 93119 6) —
--     pdf sha256 bac4b8312d4fbfc84672f909100d66b2b3cda0b25e98c0d11bbc7366dae482b2.
--     Pearson serves Issue 4 as the current document; its own change summary
--     lists only administrative deltas against the previous issue — no
--     content-section changes — so Issue 4 is authoritative for the whole
--     2019-2025 paper corpus.
--   * The committed extraction (scripts/spec-extract/4ph1-issue4.json) was
--     produced deterministically by extract_4ph1.py (byte-identical
--     re-runs), which refuses on: wrong cover, image blocks, a fraction bar
--     with an empty side, any scripted glyph without a Unicode form, a
--     bold/P-suffix mismatch, duplicate or non-contiguous codes.
--   * A FRESH independent pdftotext extraction of the same PDF, parsed by
--     its own independent code parser, reproduced the exact 195-code
--     sequence, the 48 P-suffix set, all 13 practical prefixes, and all 223
--     non-equation statement chunks verbatim; every equation and fraction
--     assembly (29 drawn-bar fractions, the diagonal-stroke ½, the ¹⁴₆C
--     nuclide, every super/subscript) was verified span-by-span against the
--     PDF's own glyph geometry.
--   * Production rows are verified read-only after 010 (the pre-check of
--     this very file re-asserts the structural facts before any UPDATE).
--
-- SAFETY SHAPE (all inside one transaction; any RAISE rolls everything back):
--   pre-guard  — refuses to run unless the course holds exactly 195 points
--                on exactly 30 unit-less topics, 48 P-suffix, zero
--                duplicate codes, zero malformed codes, all 195 'draft'
--                with verified_at NULL (a second run after success is a
--                loud no-op, not a silent rewrite);
--   the UPDATE — scoped by course slug AND the draft/NULL state, so even a
--                hand-edited copy cannot reach another course's rows;
--   row-count  — GET DIAGNOSTICS must say exactly 195 (or 0 on the no-op);
--   post-guard — 195 live+verified, 0 draft and 0 verified_at NULL on this
--                course, still 48 P-suffix, and the siblings exactly what
--                they were before this file existed: 4CH1 28 topics with
--                182 live+verified (52 C-suffix), 4BI1 22 topics with 176
--                live+verified (42 B-suffix), IAL 157 live+verified
--                + 1 archived, and 516 non-Physics points in total.
-- A truncated SQL-Editor paste loses COMMIT and rolls back (006's guard
-- doctrine); the END sentinel marks a complete paste.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  course_points integer;
  topic_count   integer;
  p_count       integer;
  dup_codes     integer;
  bad_codes     integer;
  wrong_units   integer;
  eligible      integer;
  already       integer;
  updated       integer;
  now_live      integer;
  now_draft     integer;
  now_unverified integer;
  now_p         integer;
  chem_topics   integer;
  chem_verified integer;
  chem_c        integer;
  bio_topics    integer;
  bio_verified  integer;
  bio_b         integer;
  ial_live      integer;
  ial_verified  integer;
  ial_archived  integer;
  other_total   integer;
BEGIN
  SELECT count(*) INTO course_points
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics';
  SELECT count(*) INTO topic_count
    FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics';
  SELECT count(*) INTO wrong_units
    FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics' AND t.unit_id IS NOT NULL;
  SELECT count(*) INTO p_count
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics' AND p.code LIKE '%P';
  SELECT count(*) INTO dup_codes FROM (
    SELECT p.code
      FROM spec_points p
      JOIN topics t ON t.id = p.topic_id
      JOIN courses c ON c.id = t.course_id
     WHERE c.slug = 'edexcel-igcse-physics'
     GROUP BY p.code HAVING count(*) > 1
  ) d;
  SELECT count(*) INTO bad_codes
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics'
     AND p.code !~ '^[1-8]\.[0-9]{1,2}P?$';
  SELECT count(*) INTO eligible
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics'
     AND p.status = 'draft' AND p.verified_at IS NULL;
  SELECT count(*) INTO already
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics'
     AND p.status = 'live' AND p.verified_at IS NOT NULL;

  IF course_points <> 195 THEN
    RAISE EXCEPTION '011 aborted: course holds % points, expected 195', course_points;
  END IF;
  IF topic_count <> 30 OR wrong_units <> 0 THEN
    RAISE EXCEPTION '011 aborted: % topics (% with unit_id set), expected 30 unit-less', topic_count, wrong_units;
  END IF;
  IF p_count <> 48 THEN
    RAISE EXCEPTION '011 aborted: % P-suffix points, expected 48', p_count;
  END IF;
  IF dup_codes <> 0 OR bad_codes <> 0 THEN
    RAISE EXCEPTION '011 aborted: % duplicate codes, % malformed codes, expected 0/0', dup_codes, bad_codes;
  END IF;

  IF eligible = 0 AND already = 195 THEN
    RAISE NOTICE '011: already applied — 195 rows live+verified; nothing to do';
  ELSIF eligible <> 195 THEN
    RAISE EXCEPTION '011 aborted: % eligible draft rows (% already verified), expected 195 or an exact no-op', eligible, already;
  ELSE
    UPDATE spec_points p
       SET status = 'live', verified_at = now()
      FROM topics t
      JOIN courses c ON c.id = t.course_id
     WHERE t.id = p.topic_id
       AND c.slug = 'edexcel-igcse-physics'
       AND p.status = 'draft' AND p.verified_at IS NULL;
    GET DIAGNOSTICS updated = ROW_COUNT;
    IF updated <> 195 THEN
      RAISE EXCEPTION '011 aborted: UPDATE touched % rows, expected exactly 195', updated;
    END IF;
  END IF;

  -- Post-guard: the end state, whichever path ran.
  SELECT count(*) INTO now_live
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics'
     AND p.status = 'live' AND p.verified_at IS NOT NULL;
  SELECT count(*) INTO now_draft
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics' AND p.status = 'draft';
  SELECT count(*) INTO now_unverified
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics' AND p.verified_at IS NULL;
  SELECT count(*) INTO now_p
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics' AND p.code LIKE '%P';
  IF now_live <> 195 OR now_draft <> 0 OR now_unverified <> 0 OR now_p <> 48 THEN
    RAISE EXCEPTION '011 aborted: end state % live+verified / % draft / % unverified / % P-suffix, expected 195 / 0 / 0 / 48', now_live, now_draft, now_unverified, now_p;
  END IF;

  -- IGCSE Chemistry must be exactly what it was before this file existed.
  SELECT count(*) INTO chem_topics
    FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-chemistry';
  SELECT count(*) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL),
         count(*) FILTER (WHERE p.code LIKE '%C')
    INTO chem_verified, chem_c
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-chemistry';
  IF chem_topics <> 28 OR chem_verified <> 182 OR chem_c <> 52 THEN
    RAISE EXCEPTION '011 aborted: 4CH1 state drifted to % topics / % live+verified / % C-suffix, expected 28/182/52', chem_topics, chem_verified, chem_c;
  END IF;

  -- IGCSE Biology must be exactly what it was before this file existed.
  SELECT count(*) INTO bio_topics
    FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology';
  SELECT count(*) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL),
         count(*) FILTER (WHERE p.code LIKE '%B')
    INTO bio_verified, bio_b
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology';
  IF bio_topics <> 22 OR bio_verified <> 176 OR bio_b <> 42 THEN
    RAISE EXCEPTION '011 aborted: 4BI1 state drifted to % topics / % live+verified / % B-suffix, expected 22/176/42', bio_topics, bio_verified, bio_b;
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
    RAISE EXCEPTION '011 aborted: IAL state drifted to %/%/% (live/verified/archived), expected 157/157/1', ial_live, ial_verified, ial_archived;
  END IF;

  -- And no other course's specification population moved at all.
  SELECT count(*) INTO other_total
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug <> 'edexcel-igcse-physics';
  IF other_total <> 516 THEN
    RAISE EXCEPTION '011 aborted: non-Physics spec population is %, expected 516 (182 + 158 + 176)', other_total;
  END IF;
END $$;

COMMIT;
-- END OF 011 — lifecycle only: 195 points draft->live+verified_at. If this line is missing, the paste was truncated.
