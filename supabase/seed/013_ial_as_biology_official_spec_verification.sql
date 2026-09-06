-- ============================================================================
-- AILEMY — IAL AS BIOLOGY OFFICIAL SPECIFICATION VERIFICATION (lifecycle pass)
--
-- ⚠ NOT YET APPLIED — and it must run ONLY after seed 012 has been applied
--   and its read-only post-apply verification has passed (the 010 → 011
--   procedure): scripts/db-checks/ial-as-biology-spec-verify.ts with no
--   flags must say ALL CHECKS PASS first, and with --verified only AFTER
--   this file. Phase 3 is the owner's; the runbook is
--   docs/ial-as-biology-mastery-readiness.md §1.
--
-- WHAT THIS PASS DOES — and the WHOLE of what it does:
--   status 'draft' -> 'live' and verified_at set, on EXACTLY the 80
--   specification points of edexcel-ial-as-biology seeded by 012. This is
--   the lifecycle 0001's schema comment prescribes ("set when content
--   matches official spec") and the exact transition 005 applied to IAL
--   Chemistry, 007 to 4CH1, 009 to 4BI1 and 011 to 4PH1. NOTHING ELSE
--   MOVES: no code, title, description, topic_id, unit_id, sort_order or
--   command_terms is written; no row is created, deleted or touched on any
--   other course; topics stay 'coming_soon' exactly as every sibling's did.
--
-- WHY THESE ROWS QUALIFY AS VERIFIED (evidence assembled 2026-09-06):
--   * Source of authority: Pearson Edexcel International Advanced Level
--     Biology Specification, Issue 2, February 2021, © Pearson Education
--     Limited 2021 (IAS XBI11, IAL YBI11; ISBN 978 1 446 94575 9) —
--     pdf sha256 9197bf761e06353b492fa04ee3ac4352a02e7e5baf56f277782f4ca0f53d2703.
--     Issue 2's own change summary lists exactly one delta against Issue 1
--     (a synoptic-questions sentence for Units 4/5) — no AS content changes
--     — so Issue 2 is authoritative for the whole 2019-2025 WBI11-13 corpus.
--   * The committed extraction (scripts/spec-extract/wbi-as-issue2.json) was
--     produced deterministically by extract_wbi_as.py (byte-identical
--     re-runs), which refuses on: wrong cover or ISBN, a non-Issue-2
--     footer, image blocks, an A2-levelled unit, a code row outside a topic
--     (the fabricated-Unit-3 guard), non-contiguous or duplicate codes,
--     broken roman sub-point sequences, an empty fraction side, any
--     scripted glyph without a Unicode form, and a pinned Issue 2 source
--     typo ('knderstand', 3.5(ii)) that is no longer present.
--   * A FRESH independent pdfplumber reparse of the same PDF, by its own
--     parser, reproduced the exact 80-code sequence and all 80 statement
--     chunks verbatim (whitespace-normalised) — the cross-check that caught
--     the running-footer leak during development; both built formulae
--     (4.17 heterozygosity index, 4.18 index of diversity) were verified
--     span-by-span against the PDF's own glyph geometry.
--   * Production rows are verified read-only after 012 (the pre-check of
--     this very file re-asserts the structural facts before any UPDATE).
--
-- SAFETY SHAPE (all inside one transaction; any RAISE rolls everything back):
--   pre-guard  — refuses to run unless the course holds exactly 80 points
--                on exactly 4 topics, every topic unit-linked (2 on unit-1,
--                2 on unit-2, 0 on unit-3 — the structural INVERSE of the
--                IGCSE seeds' unit-less assertion), 38/42 points per unit,
--                9 core-practical statements, zero duplicate codes, zero
--                malformed codes, all 80 'draft' with verified_at NULL
--                (a second run after success is a loud no-op, not a silent
--                rewrite);
--   the UPDATE — scoped by course slug AND the draft/NULL state, so even a
--                hand-edited copy cannot reach another course's rows;
--   row-count  — GET DIAGNOSTICS must say exactly 80 (or 0 on the no-op);
--   post-guard — 80 live+verified, 0 draft and 0 verified_at NULL on this
--                course, still 38/42 per unit and 9 core practicals, and
--                the siblings exactly what they were before this file
--                existed: 4CH1 28 topics with 182 live+verified (52
--                C-suffix), 4BI1 22 topics with 176 live+verified (42
--                B-suffix), 4PH1 30 topics with 195 live+verified (48
--                P-suffix), IAL AS Chemistry 157 live+verified + 1
--                archived, A2 Biology at 0 topics / 0 points, and 711
--                non-AS-Biology specification points in total.
-- A truncated SQL-Editor paste loses COMMIT and rolls back (006's guard
-- doctrine); the END sentinel marks a complete paste.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  course_points integer;
  topic_count   integer;
  orphan_topics integer;
  u1_topics     integer;
  u2_topics     integer;
  u3_topics     integer;
  u1_points     integer;
  u2_points     integer;
  cp_count      integer;
  dup_codes     integer;
  bad_codes     integer;
  eligible      integer;
  already       integer;
  updated       integer;
  now_live      integer;
  now_draft     integer;
  now_unverified integer;
  now_u1        integer;
  now_u2        integer;
  now_cp        integer;
  chem_topics   integer;
  chem_verified integer;
  chem_c        integer;
  bio_topics    integer;
  bio_verified  integer;
  bio_b         integer;
  phys_topics   integer;
  phys_verified integer;
  phys_p        integer;
  ial_live      integer;
  ial_verified  integer;
  ial_archived  integer;
  a2_topics     integer;
  a2_points     integer;
  other_total   integer;
BEGIN
  SELECT count(*) INTO course_points
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology';
  SELECT count(*) INTO topic_count
    FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology';
  SELECT count(*) INTO orphan_topics
    FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology' AND t.unit_id IS NULL;
  SELECT count(*) FILTER (WHERE u.slug = 'unit-1'),
         count(*) FILTER (WHERE u.slug = 'unit-2'),
         count(*) FILTER (WHERE u.slug = 'unit-3')
    INTO u1_topics, u2_topics, u3_topics
    FROM topics t
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology';
  SELECT count(*) FILTER (WHERE u.slug = 'unit-1'),
         count(*) FILTER (WHERE u.slug = 'unit-2')
    INTO u1_points, u2_points
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology';
  SELECT count(*) INTO cp_count
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology'
     AND p.description LIKE 'CORE PRACTICAL %';
  SELECT count(*) INTO dup_codes FROM (
    SELECT p.code
      FROM spec_points p
      JOIN topics t ON t.id = p.topic_id
      JOIN courses c ON c.id = t.course_id
     WHERE c.slug = 'edexcel-ial-as-biology'
     GROUP BY p.code HAVING count(*) > 1
  ) d;
  SELECT count(*) INTO bad_codes
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology'
     AND p.code !~ '^[1-4]\.[0-9]{1,2}$';
  SELECT count(*) INTO eligible
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology'
     AND p.status = 'draft' AND p.verified_at IS NULL;
  SELECT count(*) INTO already
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology'
     AND p.status = 'live' AND p.verified_at IS NOT NULL;

  IF course_points <> 80 THEN
    RAISE EXCEPTION '013 aborted: course holds % points, expected 80', course_points;
  END IF;
  IF topic_count <> 4 OR orphan_topics <> 0 THEN
    RAISE EXCEPTION '013 aborted: % topics (% without unit_id), expected 4 all unit-linked', topic_count, orphan_topics;
  END IF;
  IF u1_topics <> 2 OR u2_topics <> 2 OR u3_topics <> 0 THEN
    RAISE EXCEPTION '013 aborted: topics per unit %/%/% (unit-1/unit-2/unit-3), expected 2/2/0 — Unit 3 defines no syllabus content', u1_topics, u2_topics, u3_topics;
  END IF;
  IF u1_points <> 38 OR u2_points <> 42 THEN
    RAISE EXCEPTION '013 aborted: points per unit %/% (unit-1/unit-2), expected 38/42', u1_points, u2_points;
  END IF;
  IF cp_count <> 9 THEN
    RAISE EXCEPTION '013 aborted: % core-practical statements, expected 9', cp_count;
  END IF;
  IF dup_codes <> 0 OR bad_codes <> 0 THEN
    RAISE EXCEPTION '013 aborted: % duplicate codes, % malformed codes, expected 0/0', dup_codes, bad_codes;
  END IF;

  IF eligible = 0 AND already = 80 THEN
    RAISE NOTICE '013: already applied — 80 rows live+verified; nothing to do';
  ELSIF eligible <> 80 THEN
    RAISE EXCEPTION '013 aborted: % eligible draft rows (% already verified), expected 80 or an exact no-op', eligible, already;
  ELSE
    UPDATE spec_points p
       SET status = 'live', verified_at = now()
      FROM topics t
      JOIN courses c ON c.id = t.course_id
     WHERE t.id = p.topic_id
       AND c.slug = 'edexcel-ial-as-biology'
       AND p.status = 'draft' AND p.verified_at IS NULL;
    GET DIAGNOSTICS updated = ROW_COUNT;
    IF updated <> 80 THEN
      RAISE EXCEPTION '013 aborted: UPDATE touched % rows, expected exactly 80', updated;
    END IF;
  END IF;

  -- Post-guard: the end state, whichever path ran.
  SELECT count(*) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL),
         count(*) FILTER (WHERE p.status = 'draft'),
         count(*) FILTER (WHERE p.verified_at IS NULL)
    INTO now_live, now_draft, now_unverified
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology';
  SELECT count(*) FILTER (WHERE u.slug = 'unit-1'),
         count(*) FILTER (WHERE u.slug = 'unit-2')
    INTO now_u1, now_u2
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN units u ON u.id = t.unit_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology';
  SELECT count(*) INTO now_cp
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-biology'
     AND p.description LIKE 'CORE PRACTICAL %';
  IF now_live <> 80 OR now_draft <> 0 OR now_unverified <> 0 THEN
    RAISE EXCEPTION '013 aborted: end state % live+verified / % draft / % unverified, expected 80 / 0 / 0', now_live, now_draft, now_unverified;
  END IF;
  IF now_u1 <> 38 OR now_u2 <> 42 OR now_cp <> 9 THEN
    RAISE EXCEPTION '013 aborted: end state %/% per unit with % core practicals, expected 38/42 with 9', now_u1, now_u2, now_cp;
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
    RAISE EXCEPTION '013 aborted: 4CH1 state drifted to % topics / % live+verified / % C-suffix, expected 28/182/52', chem_topics, chem_verified, chem_c;
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
    RAISE EXCEPTION '013 aborted: 4BI1 state drifted to % topics / % live+verified / % B-suffix, expected 22/176/42', bio_topics, bio_verified, bio_b;
  END IF;

  -- IGCSE Physics must be exactly what it was before this file existed.
  SELECT count(*) INTO phys_topics
    FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics';
  SELECT count(*) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL),
         count(*) FILTER (WHERE p.code LIKE '%P')
    INTO phys_verified, phys_p
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-igcse-physics';
  IF phys_topics <> 30 OR phys_verified <> 195 OR phys_p <> 48 THEN
    RAISE EXCEPTION '013 aborted: 4PH1 state drifted to % topics / % live+verified / % P-suffix, expected 30/195/48', phys_topics, phys_verified, phys_p;
  END IF;

  -- IAL AS Chemistry must be exactly what it was before this file existed.
  SELECT count(*) FILTER (WHERE p.status = 'live'),
         count(*) FILTER (WHERE p.status = 'live' AND p.verified_at IS NOT NULL),
         count(*) FILTER (WHERE p.status = 'archived')
    INTO ial_live, ial_verified, ial_archived
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-as-chemistry';
  IF ial_live <> 157 OR ial_verified <> 157 OR ial_archived <> 1 THEN
    RAISE EXCEPTION '013 aborted: IAL Chemistry state drifted to %/%/% (live/verified/archived), expected 157/157/1', ial_live, ial_verified, ial_archived;
  END IF;

  -- A2 Biology must remain untouched: no topics, no points (AS/A2 isolation).
  SELECT count(*) INTO a2_topics
    FROM topics t
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-a2-biology';
  SELECT count(*) INTO a2_points
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug = 'edexcel-ial-a2-biology';
  IF a2_topics <> 0 OR a2_points <> 0 THEN
    RAISE EXCEPTION '013 aborted: A2 Biology holds % topics / % points, expected 0/0 — this pass must never touch A2', a2_topics, a2_points;
  END IF;

  -- And no other course's specification population moved at all.
  SELECT count(*) INTO other_total
    FROM spec_points p
    JOIN topics t ON t.id = p.topic_id
    JOIN courses c ON c.id = t.course_id
   WHERE c.slug <> 'edexcel-ial-as-biology';
  IF other_total <> 711 THEN
    RAISE EXCEPTION '013 aborted: non-AS-Biology spec population is %, expected 711 (182 + 176 + 195 + 158)', other_total;
  END IF;
END $$;

COMMIT;
-- END OF 013 — lifecycle only: 80 points draft->live+verified_at. If this line is missing, the paste was truncated.
