-- ============================================================================
-- BATCH 1 COURSE ROWS — GCE, GCSE and International GCSE
-- ============================================================================
-- Written 2026-08-27 for the folders 2 / 4 / 8 paper import.
-- Author holds no database credentials. NOTHING HERE HAS BEEN RUN.
-- Every number below is an EXPECTATION and is labelled as one.
--
-- ⚠ RUN ONE SECTION AT A TIME and read the result before the next. A long
--    paste into the Supabase SQL Editor has silently half-applied on this
--    project before (0029-0035).
--
-- ⚠ THIS INSERTS 12 COURSES, NOT 14. Two are BLOCKED — see the header block
--    "THE BIOLOGY A/B COLLISION" below. Do not add them by hand.
--
-- ⚠ NOTHING BECOMES VISIBLE TO A VISITOR. Every row is written with
--    status = 'coming_soon', which is not 'live', and the lesson page refuses
--    everything but 'live'. Check /learn yourself before flipping any of them.
--
-- ============================================================================
-- WHAT A RIGHT-REASON RED LOOKS LIKE  (stop and read)
-- ============================================================================
--   Section 1 shows a curriculum slug missing
--       edexcel-alevel / edexcel-gcse / edexcel-igcse must all exist.
--       courses.curriculum_id is NOT NULL, so Section 3 cannot invent one.
--   Section 1 shows a subject slug missing
--       chemistry / biology / physics must all exist. Same reason.
--   Section 1 shows a slug already present
--       Expected for at least edexcel-gcse-chemistry, which ENROLMENT_PASTE.sql
--       names as already seeded. Section 3 skips whatever exists.
--   Section 3 returns fewer rows than 12
--       Some already existed. Compare with Section 1, not with 12.
--   Section 4 total is not Section 2 total + Section 3 rows
--       Something else wrote to courses while you were running this.
--
-- ============================================================================
-- WHAT A WRONG-REASON RED LOOKS LIKE  (the run proved nothing)
-- ============================================================================
--   42501  permission denied              — not running as owner.
--   23502  null value in curriculum_id    — Section 1 was not read. A slug in
--                                           curricula or subjects is missing.
--   23505  duplicate key … courses_slug   — re-run after a partial apply. Safe:
--                                           Section 3 is ON CONFLICT DO NOTHING.
--   23505  courses_curriculum_id_subject_id_level_key
--                                         — the Biology A/B collision. You added
--                                           a blocked row by hand. Stop.
--   22P02  invalid input syntax for uuid  — a literal below was edited.
--
-- ============================================================================
-- THE BIOLOGY A/B COLLISION — WHY THIS IS 12 AND NOT 14
-- ============================================================================
-- courses carries, from 0001:
--
--     UNIQUE (curriculum_id, subject_id, level)
--
-- verified still live: no migration alters or drops it.
--
-- Edexcel UK GCE Biology is TWO specifications sat at the SAME level:
--     Spec A  8BN0 (AS) / 9BN0 (A2)
--     Spec B  8BI0 (AS) / 9BI0 (A2)
--
-- Both are (curriculum edexcel-alevel, subject biology, level AS), and again at
-- A2. The constraint permits one row per triple, so the second of each pair
-- cannot be inserted. This is not a naming problem — the schema has no slot for
-- "two specifications of one subject at one level".
--
-- The 12 below are Spec A plus everything else. Spec B is held:
--     edexcel-gce-as-biology-b   8BI0    58 files
--     edexcel-gce-a2-biology-b   9BI0    74 files
--
-- Three ways out, none of which I have taken:
--   (a) distinct level text — 'AS (Spec B)' / 'A2 (Spec B)'. Data-only, no
--       migration, works today. Puts a specification in a column named level,
--       and that string renders wherever level renders.
--   (b) distinct curricula — edexcel-alevel-b. Data-only. Invents a curriculum
--       that does not exist in Pearson's world to satisfy a unique index.
--   (c) drop the constraint and rely on the slug's own UNIQUE. Correct
--       modelling, needs a migration, and you issue the number.
--
-- 132 files wait on this. It is a schema decision, so it is yours.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — PREFLIGHT. Read all three result sets before going on.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: curricula 3 of 3 found, subjects 3 of 3 found, and a list showing
--         which of the 14 slugs already exist (at least edexcel-gcse-chemistry
--         may). Anything missing in the first two is a hard stop.

-- 1a. The three curricula this batch needs.
SELECT 'curriculum' AS kind, s.slug,
       (SELECT count(*) FROM public.curricula c WHERE c.slug = s.slug) AS found
  FROM (VALUES ('edexcel-alevel'), ('edexcel-gcse'), ('edexcel-igcse')) AS s(slug)
 ORDER BY s.slug;

-- 1b. The three subjects this batch needs.
SELECT 'subject' AS kind, s.slug,
       (SELECT count(*) FROM public.subjects x WHERE x.slug = s.slug) AS found
  FROM (VALUES ('chemistry'), ('biology'), ('physics')) AS s(slug)
 ORDER BY s.slug;

-- 1c. Which of the FOURTEEN slugs already exist. The two Spec B rows are listed
--     so you can see them, but Section 3 does not insert them.
SELECT s.slug,
       (SELECT count(*) FROM public.courses c WHERE c.slug = s.slug) AS already_exists,
       CASE WHEN s.slug LIKE '%biology-b' THEN 'HELD — unique constraint' ELSE 'in batch' END AS status
  FROM (VALUES
    ('edexcel-gce-as-chemistry'), ('edexcel-gce-a2-chemistry'),
    ('edexcel-gce-as-physics'),   ('edexcel-gce-a2-physics'),
    ('edexcel-gce-as-biology-a'), ('edexcel-gce-a2-biology-a'),
    ('edexcel-gce-as-biology-b'), ('edexcel-gce-a2-biology-b'),
    ('edexcel-gcse-chemistry'),   ('edexcel-gcse-biology'), ('edexcel-gcse-physics'),
    ('edexcel-igcse-chemistry'),  ('edexcel-igcse-biology'), ('edexcel-igcse-physics')
  ) AS s(slug)
 ORDER BY s.slug;

-- 1d. ⚠ THE COLLISION, SHOWN RATHER THAN DESCRIBED. Any triple already at 1
--     means that (curriculum, subject, level) slot is taken.
SELECT cu.slug AS curriculum, su.slug AS subject, c.level, count(*) AS rows_in_slot
  FROM public.courses c
  JOIN public.curricula cu ON cu.id = c.curriculum_id
  JOIN public.subjects  su ON su.id = c.subject_id
 WHERE cu.slug IN ('edexcel-alevel','edexcel-gcse','edexcel-igcse')
 GROUP BY cu.slug, su.slug, c.level
 ORDER BY 1,2,3;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — COUNT BEFORE. Write the number down.
-- ════════════════════════════════════════════════════════════════════════════
SELECT count(*) AS courses_before FROM public.courses;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — THE INSERT. Idempotent. Expect UP TO 12 rows back.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: 12 rows, minus any Section 1c already showed as existing.
-- ZERO rows = all twelve already exist. That is a valid outcome, not a failure.
--
-- ⚠ IDS ARE FIXED LITERALS, so Section 5 deletes by id with nothing to copy
--    across and no "newest row" heuristic. This project erased the wrong account
--    once by letting a destructive block default its target.
--
-- ⚠ curriculum_id AND subject_id ARE RESOLVED BY SLUG, NOT TYPED. Both columns
--    are NOT NULL, so a missing curriculum or subject makes the row vanish from
--    the SELECT rather than inserting against a wrong id. Section 3 returning
--    fewer rows than expected with Section 1 all-green means exactly that.
--
-- ⚠ status = 'coming_soon' ON EVERY ROW. Not 'live'. Nothing here changes what
--    a visitor sees until you say so.

INSERT INTO public.courses (id, curriculum_id, subject_id, slug, name, level, pathway, status, sort_order)
SELECT v.id::uuid, cu.id, su.id, v.slug, v.name, v.level, v.pathway::pathway_type, 'coming_soon'::content_status, v.sort_order
  FROM (VALUES
    -- GCE (folder 2) — curriculum edexcel-alevel, pathway uk-a-level
    ('c0025e00-0000-4000-8000-000000000001','edexcel-alevel','chemistry','edexcel-gce-as-chemistry','Edexcel GCE Chemistry (AS)','AS','uk-a-level',10),
    ('c0025e00-0000-4000-8000-000000000002','edexcel-alevel','chemistry','edexcel-gce-a2-chemistry','Edexcel GCE Chemistry (A level)','A2','uk-a-level',11),
    ('c0025e00-0000-4000-8000-000000000003','edexcel-alevel','physics','edexcel-gce-as-physics','Edexcel GCE Physics (AS)','AS','uk-a-level',12),
    ('c0025e00-0000-4000-8000-000000000004','edexcel-alevel','physics','edexcel-gce-a2-physics','Edexcel GCE Physics (A level)','A2','uk-a-level',13),
    ('c0025e00-0000-4000-8000-000000000005','edexcel-alevel','biology','edexcel-gce-as-biology-a','Edexcel GCE Biology A (AS)','AS','uk-a-level',14),
    ('c0025e00-0000-4000-8000-000000000006','edexcel-alevel','biology','edexcel-gce-a2-biology-a','Edexcel GCE Biology A (A level)','A2','uk-a-level',15),
    -- GCSE (folder 4) — curriculum edexcel-gcse, pathway uk-gcse
    ('c0025e00-0000-4000-8000-000000000009','edexcel-gcse','chemistry','edexcel-gcse-chemistry','Edexcel GCSE (9-1) Chemistry','GCSE','uk-gcse',20),
    ('c0025e00-0000-4000-8000-000000000010','edexcel-gcse','biology','edexcel-gcse-biology','Edexcel GCSE (9-1) Biology','GCSE','uk-gcse',21),
    ('c0025e00-0000-4000-8000-000000000011','edexcel-gcse','physics','edexcel-gcse-physics','Edexcel GCSE (9-1) Physics','GCSE','uk-gcse',22),
    -- International GCSE (folder 8) — curriculum edexcel-igcse, pathway igcse
    ('c0025e00-0000-4000-8000-000000000012','edexcel-igcse','chemistry','edexcel-igcse-chemistry','Edexcel International GCSE (9-1) Chemistry','IGCSE','igcse',30),
    ('c0025e00-0000-4000-8000-000000000013','edexcel-igcse','biology','edexcel-igcse-biology','Edexcel International GCSE (9-1) Biology','IGCSE','igcse',31),
    ('c0025e00-0000-4000-8000-000000000014','edexcel-igcse','physics','edexcel-igcse-physics','Edexcel International GCSE (9-1) Physics','IGCSE','igcse',32)
  ) AS v(id, curriculum_slug, subject_slug, slug, name, level, pathway, sort_order)
  JOIN public.curricula cu ON cu.slug = v.curriculum_slug
  JOIN public.subjects  su ON su.slug = v.subject_slug
ON CONFLICT (slug) DO NOTHING
RETURNING id, slug, name, level, pathway, status;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — COUNT AFTER, AND PROVE ALL TWELVE RESOLVE.
-- ════════════════════════════════════════════════════════════════════════════
-- EXPECT: courses_after = Section 2's number + the rows Section 3 returned.
--         batch1_present = 12.

SELECT (SELECT count(*) FROM public.courses) AS courses_after,
       (SELECT count(*) FROM public.courses WHERE slug IN (
          'edexcel-gce-as-chemistry','edexcel-gce-a2-chemistry',
          'edexcel-gce-as-physics','edexcel-gce-a2-physics',
          'edexcel-gce-as-biology-a','edexcel-gce-a2-biology-a',
          'edexcel-gcse-chemistry','edexcel-gcse-biology','edexcel-gcse-physics',
          'edexcel-igcse-chemistry','edexcel-igcse-biology','edexcel-igcse-physics'
       )) AS batch1_present,
       (SELECT count(*) FROM public.courses WHERE status = 'live') AS live_courses_unchanged;

-- The twelve, as the importer will see them.
SELECT c.slug, c.level, c.pathway, c.status, cu.slug AS curriculum, su.slug AS subject
  FROM public.courses c
  JOIN public.curricula cu ON cu.id = c.curriculum_id
  JOIN public.subjects  su ON su.id = c.subject_id
 WHERE c.id::text LIKE 'c0025e00-%'
 ORDER BY c.sort_order;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — TEARDOWN. Deletes BY ID and by nothing else.
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ RUN THIS ONLY IF YOU ARE ABANDONING THE BATCH. If papers have already been
--    imported against these courses, past_papers.course_id is ON DELETE CASCADE
--    (0007) and those rows go with them. Check first:
--
--        SELECT count(*) FROM public.past_papers
--         WHERE course_id::text LIKE 'c0025e00-%';
--
--    It must be 0 before you run the delete below.
--
-- ⚠ NO SLUG, NO NAME, NO DATE WINDOW. Only the twelve literals this file minted.
--    Safe to run twice; deleting nothing returns zero rows.

DELETE FROM public.courses
 WHERE id IN (
   'c0025e00-0000-4000-8000-000000000001'::uuid,
   'c0025e00-0000-4000-8000-000000000002'::uuid,
   'c0025e00-0000-4000-8000-000000000003'::uuid,
   'c0025e00-0000-4000-8000-000000000004'::uuid,
   'c0025e00-0000-4000-8000-000000000005'::uuid,
   'c0025e00-0000-4000-8000-000000000006'::uuid,
   'c0025e00-0000-4000-8000-000000000009'::uuid,
   'c0025e00-0000-4000-8000-000000000010'::uuid,
   'c0025e00-0000-4000-8000-000000000011'::uuid,
   'c0025e00-0000-4000-8000-000000000012'::uuid,
   'c0025e00-0000-4000-8000-000000000013'::uuid,
   'c0025e00-0000-4000-8000-000000000014'::uuid
 )
RETURNING id, slug;

-- ⚠ IDS 07 AND 08 ARE DELIBERATELY ABSENT from every list in this file. They are
--    reserved for edexcel-gce-as-biology-b and edexcel-gce-a2-biology-b, which
--    are blocked on the unique constraint. Leaving the gap means the teardown
--    stays correct whichever way you rule.
