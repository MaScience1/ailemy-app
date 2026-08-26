-- ============================================================================
-- 0070_drop_courses_curriculum_subject_level_unique.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED 2026-08-27. Number issued by the project owner. Author holds no
--    database credentials; the owner ran it and reported the results.
--
--    Sections A-C and E: VERIFIED as written.
--        triple_constraint_remaining 0
--        slug_unique_remaining       1
--        courses_row_count          42
--        control_rows_left_behind    0
--
-- ⚠ SECTION D DID NOT RUN. It failed with 23502 — its control INSERT omitted
--    `pathway`, which 0005:95 tightened to NOT NULL. The omission is fixed
--    below FOR THE RECORD ONLY. DO NOT RE-RUN IT: both facts it was written to
--    prove were then established behaviourally by the real workload, which is
--    better evidence than a synthetic control:
--
--      the triple constraint is gone — edexcel-gce-as-biology-a and
--        edexcel-gce-as-biology-b BOTH landed on (edexcel-alevel, biology, AS).
--        Two live rows in one slot the constraint used to permit one of.
--
--      slug's UNIQUE survives — COURSE_INSERT_PASTE Section 3 ran ON CONFLICT
--        (slug) without raising 42P10. Postgres throws that when no unique or
--        exclusion constraint matches the ON CONFLICT target, so a clean run IS
--        the proof the index exists. It also correctly no-op'd six pre-existing
--        slugs, which is that index doing its job on real data.
--
-- ⚠ RUN ORDER: THIS FILE FIRST, THEN COURSE_INSERT_PASTE.sql.
--    The course paste inserts fourteen rows, four of which violate the
--    constraint dropped here. Running the paste first fails two of them with
--    23505 and leaves the batch half-applied.
--
-- ============================================================================
-- WHY
-- ============================================================================
-- courses has carried, since 0001:
--
--     UNIQUE (curriculum_id, subject_id, level)
--
-- which asserts: one specification per subject per level. That is a claim about
-- how exam boards work, and for Edexcel it is false.
--
-- Edexcel UK GCE Biology is TWO specifications, sat at the SAME level:
--
--     Spec A    8BN0 (AS)    9BN0 (A level)
--     Spec B    8BI0 (AS)    9BI0 (A level)
--
-- Both are (curriculum edexcel-alevel, subject biology, level AS), and again at
-- A2. The constraint permits one, so the second of each pair cannot exist. 132
-- real past-paper PDFs are blocked behind it.
--
-- ⚠ THE TWO ALTERNATIVES WERE REJECTED, AND FOR THE SAME REASON.
--   Encoding the spec in `level` ('AS (Spec B)') puts a specification in a
--   column named level, and that string then renders everywhere level renders.
--   Inventing a second curriculum (edexcel-alevel-b) manufactures a Pearson
--   qualification that does not exist to satisfy a unique index. Both are lies
--   the schema would carry forward; this drops the false claim instead.
--
-- ⚠ NOTHING IS LEFT UNPROTECTED. courses.slug carries its own UNIQUE from 0001
--   ("slug text UNIQUE NOT NULL") and that is the key every reader actually
--   uses — bulk-import-papers.ts resolves courses by slug, not by triple.
--   Section C proves the slug index survives; Section D proves it still bites.
--
-- ⚠ SABOTAGE NOTE — READ THIS BEFORE TRUSTING SECTION D.
--   Section D does two things: it inserts two courses sharing a
--   (curriculum, subject, level) triple, which MUST now succeed, and it then
--   attempts a duplicate SLUG, which MUST still fail with 23505.
--   If the duplicate-slug insert SUCCEEDS, slug's UNIQUE has gone too — this
--   migration has removed more than it was meant to, or the index was already
--   missing. The DO block raises loudly in that case. STOP THERE. Do not run
--   COURSE_INSERT_PASTE.sql: without slug's UNIQUE its ON CONFLICT (slug)
--   DO NOTHING has nothing to conflict on and it stops being idempotent.
--
-- ⚠ NO REVOKE BLOCK: this file creates no table. If a later revision adds one,
--   it must end with REVOKE TRUNCATE, TRIGGER, REFERENCES … FROM anon,
--   authenticated — 0019 only swept a snapshot.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION A — PREFLIGHT. Read the constraint's real name before dropping it.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: two rows.
--   courses_curriculum_id_subject_id_level_key   u   (curriculum_id, subject_id, level)
--   courses_slug_key                             u   (slug)
--
-- If the first name differs from the one Section B drops, STOP and tell me —
-- Section B names it explicitly and will silently drop nothing otherwise.

SELECT con.conname,
       con.contype,
       pg_get_constraintdef(con.oid) AS definition
  FROM pg_constraint con
 WHERE con.conrelid = 'public.courses'::regclass
   AND con.contype IN ('u', 'p')
 ORDER BY con.conname;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION B — THE DROP. One constraint, named. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════
-- IF EXISTS makes this safe to re-run; a second run is a no-op, not an error.

BEGIN;

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_curriculum_id_subject_id_level_key;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION C — VERIFICATION. One SELECT, both facts, as counts.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: triple_constraint_remaining = 0
--         slug_unique_remaining       = 1     ⚠ if this is 0, STOP
--         courses_row_count           unchanged from before Section B

SELECT
  (SELECT count(*) FROM pg_constraint
    WHERE conrelid = 'public.courses'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (curriculum_id, subject_id, level)')  AS triple_constraint_remaining,
  (SELECT count(*) FROM pg_constraint
    WHERE conrelid = 'public.courses'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (slug)')                              AS slug_unique_remaining,
  (SELECT count(*) FROM public.courses)                                             AS courses_row_count;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION D — NEGATIVE CONTROL. ⚠ DO NOT RUN. Kept for the record only.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ THIS BLOCK FAILED WITH 23502 ON THE REAL RUN and proved nothing. The
--    omitted `pathway` is fixed below so the file is correct as a record, but
--    both facts it targets are already established by the live workload — see
--    the header. Re-running it would add nothing and touch a table that now
--    holds forty-two real rows.
-- ⚠ NOTHING HERE PERSISTS. The block ends in ROLLBACK, and DDL and DML are both
--    transactional in Postgres. Run it, read the NOTICEs, move on.
--
-- EXPECT two NOTICEs:
--    ✓ two courses sharing (curriculum, subject, level) were ACCEPTED
--    ✓ duplicate slug correctly rejected (23505) — slug UNIQUE intact
--
-- Anything else is a stop. In particular a raised EXCEPTION from the second
-- half means the duplicate slug was accepted, i.e. slug's UNIQUE is gone.

BEGIN;

DO $$
DECLARE
  v_curriculum uuid;
  v_subject    uuid;
  n            integer;
BEGIN
  SELECT id INTO v_curriculum FROM public.curricula WHERE slug = 'edexcel-alevel';
  SELECT id INTO v_subject    FROM public.subjects  WHERE slug = 'biology';

  IF v_curriculum IS NULL OR v_subject IS NULL THEN
    RAISE EXCEPTION
      'ABORTING: cannot run the control — curricula.edexcel-alevel present: %, subjects.biology present: %. '
      'This proves nothing about the constraint; fix the prerequisite rows first.',
      v_curriculum IS NOT NULL, v_subject IS NOT NULL;
  END IF;

  -- ── HALF ONE: the same triple twice, different slugs. MUST now succeed. ──
  -- ⚠ pathway IS SUPPLIED. 0005 adds it "nullable for backfill" at line 47 and
  --    tightens it to NOT NULL at line 95. Reading only the first of those is
  --    what made the original of this block fail with 23502.
  INSERT INTO public.courses (id, curriculum_id, subject_id, slug, name, level, pathway, status)
  VALUES ('0070aaaa-0000-4000-8000-000000000001', v_curriculum, v_subject,
          'zz-0070-control-spec-a', '0070 control Spec A', 'AS', 'uk-a-level'::pathway_type, 'coming_soon'),
         ('0070aaaa-0000-4000-8000-000000000002', v_curriculum, v_subject,
          'zz-0070-control-spec-b', '0070 control Spec B', 'AS', 'uk-a-level'::pathway_type, 'coming_soon');

  SELECT count(*) INTO n FROM public.courses WHERE slug LIKE 'zz-0070-control-%';
  IF n <> 2 THEN
    RAISE EXCEPTION 'ABORTING: expected 2 control rows, found %. The drop did not take effect.', n;
  END IF;
  RAISE NOTICE '✓ two courses sharing (curriculum, subject, level) were ACCEPTED — the drop worked';

  -- ── HALF TWO: a duplicate SLUG. MUST still fail with 23505. ──
  BEGIN
    INSERT INTO public.courses (id, curriculum_id, subject_id, slug, name, level, pathway, status)
    VALUES ('0070aaaa-0000-4000-8000-000000000003', v_curriculum, v_subject,
            'zz-0070-control-spec-a', '0070 control duplicate slug', 'AS', 'uk-a-level'::pathway_type, 'coming_soon');
    RAISE EXCEPTION
      '⚠ SABOTAGE FAILED: a DUPLICATE SLUG was ACCEPTED. courses.slug has no UNIQUE index. '
      'STOP — do NOT run COURSE_INSERT_PASTE.sql; its ON CONFLICT (slug) DO NOTHING is not idempotent without it.';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE '✓ duplicate slug correctly rejected (23505) — slug UNIQUE intact';
  END;
END $$;

ROLLBACK;   -- ⚠ THE RESTORE. Nothing above this line persists.


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION E — CONFIRM THE ROLLBACK. Must return 0.
-- ════════════════════════════════════════════════════════════════════════════
-- If this returns anything but 0, Section D's ROLLBACK did not run and there are
-- two junk courses to remove by slug.

SELECT count(*) AS control_rows_left_behind
  FROM public.courses
 WHERE slug LIKE 'zz-0070-control-%';
