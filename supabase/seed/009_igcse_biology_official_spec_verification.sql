-- ============================================================================
-- AILEMY — 4BI1 OFFICIAL SPECIFICATION VERIFICATION (lifecycle pass)
--
-- ⚠ APPLIED 2026-09-06 by the owner via the Supabase SQL Editor (whole-file
--   paste — 10,337 bytes clipboard-verified byte-identical to this file,
--   END-OF-009 sentinel visibly present as the last line of the paste,
--   "Success. No rows returned"). The owner-run read-only pre-check
--   immediately before the paste matched every expected row: 176 eligible
--   draft/unverified Biology points on 22 unit-less topics, 42 B-suffix,
--   0 outside-lifecycle, 0 lesson mappings, 0 question mappings, 4CH1
--   28/182/182/52, IAL 157/1, non-Biology total 340.
--   What "Success" proves by construction: every guard in the DO block below
--   ran inside the committed transaction — so the end state 176 live+verified
--   / 0 draft / 0 unverified / 42 B-suffix, the 4CH1 28/182/52 and IAL
--   157/157/1 unchanged-guards, and the 340 non-Biology total were all
--   asserted true at commit time, and only status + verified_at moved on
--   exactly 176 rows (ROW_COUNT-checked).
--
--   VERIFIED 2026-09-06, read-only, by the owner's independent post-apply
--   production check, which returned exactly:
--     · Biology: 22 topics · 176 points · 42 B-suffix ·
--       176 live + verified_at set · 0 draft · 0 verified_at NULL
--     · IGCSE Chemistry unchanged: 182 live+verified
--     · IAL AS Chemistry unchanged: 157 live+verified + 1 archived
--     · zero Biology lesson mappings, zero Biology question mappings.
--   With this, the full 004/005 → 006/007 → 008/009 lifecycle convention is
--   complete for 4BI1: every one of the 176 points is live and carries a
--   verified_at earned against the official Issue 3 document.
--
-- WHAT THIS PASS DOES — and the WHOLE of what it does:
--   status 'draft' -> 'live' and verified_at set, on EXACTLY the 176
--   specification points of edexcel-igcse-biology seeded by 008. This is
--   the lifecycle 0001's schema comment prescribes ("set when content
--   matches official spec") and the exact transition 005 applied to IAL and
--   007 applied to 4CH1. NOTHING ELSE MOVES: no code, title, description,
--   topic_id, sort_order or command_terms is written; no row is created,
--   deleted or touched on any other course; topics stay 'coming_soon'
--   exactly as 4CH1's topics did after 007.
--
-- WHY THESE ROWS QUALIFY AS VERIFIED (re-checked 2026-09-05, same day):
--   * Source of authority: Pearson Edexcel International GCSE in Biology
--     (4BI1) Specification, Issue 3, © Pearson Education Limited 2024 —
--     pdf sha256 9f474a0ef0e93ef3c3107b568956d163454cdb476bb2017189e8dd12c0d58cef,
--     re-hashed and unchanged at re-verification time.
--   * Clean-room re-extraction from that PDF reproduced the committed
--     extraction byte-for-byte (sections, sub-topics, codes, wording,
--     B-flags, contexts, ordering) — 5 sections, 22 sub-topics, 176 points,
--     42 B-suffix (Paper 2-only), 14 practicals, 15 context-heading rows.
--   * A FRESH independent pdftotext extraction of the same PDF, parsed by
--     its own independent code parser, reproduced the exact 176-code
--     sequence, the 42 B-suffix count, all 14 practical prefixes verbatim,
--     all 176 statements chunk-verbatim, and all 5 context headings as
--     standalone lines with zero heading-into-statement flattening.
--   * Production rows were verified read-only by the owner on apply day
--     (2026-09-05): 22 topics / 176 points / 42 B-suffix, all draft with
--     verified_at NULL, zero lesson and question mappings, siblings
--     unchanged (4CH1 28/182/52; IAL 157+1; non-Biology total 340).
--
-- SAFETY SHAPE (all inside one transaction; any RAISE rolls everything back):
--   pre-guard  — refuses to run unless the course holds exactly 176 points
--                on exactly 22 unit-less topics, 42 B-suffix, zero
--                duplicate codes, zero malformed codes, all 176 'draft'
--                with verified_at NULL (a second run after success is a
--                loud no-op, not a silent rewrite);
--   the UPDATE — scoped by course slug AND the draft/NULL state, so even a
--                hand-edited copy cannot reach another course's rows;
--   row-count  — GET DIAGNOSTICS must say exactly 176 (or 0 on the no-op);
--   post-guard — 176 live+verified, 0 draft and 0 verified_at NULL on this
--                course, still 42 B-suffix, and the siblings exactly what
--                they were before this file existed: 4CH1 28 topics with
--                182 live+verified (52 C-suffix), IAL 157 live+verified
--                + 1 archived, and 340 non-Biology points in total.
-- A truncated SQL-Editor paste loses COMMIT and rolls back (006's guard
-- doctrine); the END sentinel marks a complete paste.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  course_points integer;
  topic_count   integer;
  b_count       integer;
  dup_codes     integer;
  bad_codes     integer;
  wrong_units   integer;
  eligible      integer;
  already       integer;
  updated       integer;
  now_live      integer;
  now_draft     integer;
  now_unverified integer;
  now_b         integer;
  chem_topics   integer;
  chem_verified integer;
  chem_c        integer;
  ial_live      integer;
  ial_verified  integer;
  ial_archived  integer;
  other_total   integer;
BEGIN
  SELECT count(*) INTO course_points
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology';
  SELECT count(*) INTO topic_count
    FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology';
  SELECT count(*) INTO wrong_units
    FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology' AND t.unit_id IS NOT NULL;
  SELECT count(*) INTO b_count
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology' AND p.code LIKE '%B';
  SELECT count(*) INTO dup_codes FROM (
    SELECT p.code
      FROM spec_points p
      JOIN topics t ON t.id = p.topic_id
      JOIN courses c ON c.id = t.course_id
     WHERE c.slug = 'edexcel-igcse-biology'
     GROUP BY p.code HAVING count(*) > 1
  ) d;
  SELECT count(*) INTO bad_codes
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology'
     AND p.code !~ '^[1-5]\.[0-9]{1,2}B?$';
  SELECT count(*) INTO eligible
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology'
     AND p.status = 'draft' AND p.verified_at IS NULL;
  SELECT count(*) INTO already
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology'
     AND p.status = 'live' AND p.verified_at IS NOT NULL;

  IF course_points <> 176 THEN
    RAISE EXCEPTION '009 aborted: course holds % points, expected 176', course_points;
  END IF;
  IF topic_count <> 22 OR wrong_units <> 0 THEN
    RAISE EXCEPTION '009 aborted: % topics (% with unit_id set), expected 22 unit-less', topic_count, wrong_units;
  END IF;
  IF b_count <> 42 THEN
    RAISE EXCEPTION '009 aborted: % B-suffix points, expected 42', b_count;
  END IF;
  IF dup_codes <> 0 OR bad_codes <> 0 THEN
    RAISE EXCEPTION '009 aborted: % duplicate codes, % malformed codes, expected 0/0', dup_codes, bad_codes;
  END IF;

  IF eligible = 0 AND already = 176 THEN
    RAISE NOTICE '009: already applied — 176 rows live+verified; nothing to do';
  ELSIF eligible <> 176 THEN
    RAISE EXCEPTION '009 aborted: % eligible draft rows (% already verified), expected 176 or an exact no-op', eligible, already;
  ELSE
    UPDATE spec_points p
       SET status = 'live', verified_at = now()
      FROM topics t
      JOIN courses c ON c.id = t.course_id
     WHERE t.id = p.topic_id
       AND c.slug = 'edexcel-igcse-biology'
       AND p.status = 'draft' AND p.verified_at IS NULL;
    GET DIAGNOSTICS updated = ROW_COUNT;
    IF updated <> 176 THEN
      RAISE EXCEPTION '009 aborted: UPDATE touched % rows, expected exactly 176', updated;
    END IF;
  END IF;

  -- Post-guard: the end state, whichever path ran.
  SELECT count(*) INTO now_live
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology'
     AND p.status = 'live' AND p.verified_at IS NOT NULL;
  SELECT count(*) INTO now_draft
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology' AND p.status = 'draft';
  SELECT count(*) INTO now_unverified
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology' AND p.verified_at IS NULL;
  SELECT count(*) INTO now_b
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-biology' AND p.code LIKE '%B';
  IF now_live <> 176 OR now_draft <> 0 OR now_unverified <> 0 OR now_b <> 42 THEN
    RAISE EXCEPTION '009 aborted: end state % live+verified / % draft / % unverified / % B-suffix, expected 176 / 0 / 0 / 42', now_live, now_draft, now_unverified, now_b;
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
    RAISE EXCEPTION '009 aborted: 4CH1 state drifted to % topics / % live+verified / % C-suffix, expected 28/182/52', chem_topics, chem_verified, chem_c;
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
    RAISE EXCEPTION '009 aborted: IAL state drifted to %/%/% (live/verified/archived), expected 157/157/1', ial_live, ial_verified, ial_archived;
  END IF;

  -- And no other course's specification population moved at all.
  SELECT count(*) INTO other_total
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug <> 'edexcel-igcse-biology';
  IF other_total <> 340 THEN
    RAISE EXCEPTION '009 aborted: non-Biology spec population is %, expected 340 (182 + 158)', other_total;
  END IF;
END $$;

COMMIT;
-- END OF 009 — lifecycle only: 176 points draft->live+verified_at. If this line is missing, the paste was truncated.
