-- ============================================================================
-- 0020_physics_units.sql
-- ----------------------------------------------------------------------------
-- Add the six Edexcel IAL Physics unit rows, three under
-- edexcel-ial-as-physics and three under edexcel-ial-a2-physics.
--
-- WHY. public.units currently holds twelve rows — six WCH, six WBI — and no
-- Physics at all, while both Physics courses already exist. The past-paper
-- importer resolves a paper to its unit through units.code ('WPH11'..'WPH16'),
-- so a Physics import aborts at catalogue resolution with "no unit row with
-- that code" and cannot proceed. These six rows are the only thing missing;
-- nothing else about Physics needs changing.
--
-- SCOPE. INSERTs into public.units only. No table, column, constraint, index,
-- policy, grant or type is created or altered. No existing row is modified.
-- courses, past_papers and every other table are untouched.
--
-- ---------------------------------------------------------------------------
-- WHERE THE VALUES COME FROM
-- ---------------------------------------------------------------------------
-- code   The paper code Edexcel prints on the cover, matching the WCH/WBI
--        convention exactly — units.code is a PAPER code, not a unit number.
--
-- name   Read verbatim off the question-paper covers in the archive, not from
--        memory:
--          WPH11  'Unit 1: Mechanics and Materials'
--          WPH12  'Unit 2: Waves and Electricity'
--          WPH14  'Unit 4: Further Mechanics, Fields and Particles'
--          WPH15  'Unit 5: Thermodynamics, Radiation, Oscillations and Cosmology'
--
--        ⚠ WPH13 and WPH16 have NO papers in the archive, so their names could
--        not be read off anything. They follow the naming pattern both other
--        subjects use for their practical units without exception —
--        'Unit 3: Practical Skills in <Subject> I' and
--        'Unit 6: Practical Skills in <Subject> II' — which is structural
--        evidence, not a citation. CHECK THESE TWO against the specification
--        before relying on them; they are the only unverified strings here.
--
-- slug   'unit-1'..'unit-6', identical to WCH/WBI. UNIQUE (course_id, slug)
--        means AS and A2 may each hold their own, which is why WBI/WCH can
--        both use 'unit-1' style slugs across two courses.
--
-- status 'coming_soon' — the table default, and what eleven of the twelve
--        existing rows carry. (WCH11 is 'in_progress' because that course is
--        being authored; no Physics course is.)
--
-- description  LEFT NULL, and this is the ONE place these rows do not mirror
--        the existing twelve. Every WCH/WBI row carries a sentence of editorial
--        prose ('The first AS paper. Covers atomic structure, ...'). That copy
--        is authored, not derivable from anything I can read, and inventing
--        twelve plausible sentences about Physics content is exactly the kind
--        of fabrication the rest of this work has been avoiding. The column is
--        nullable; fill it through the admin panel.
--
-- ---------------------------------------------------------------------------
-- SORT_ORDER — the two existing subjects disagree, so a choice was required
-- ---------------------------------------------------------------------------
--   Chemistry  WCH11..WCH16 -> 1,2,3,4,5,6   (continuous across both courses)
--   Biology    WBI11..WBI13 -> 1,2,3
--              WBI14..WBI16 -> 1,2,3         (restarts within each course)
--
-- Both order correctly WITHIN a course, which is the only place sort_order is
-- ever consulted — units are always listed for one course at a time — so the
-- choice is about legibility, not behaviour.
--
-- THIS FILE FOLLOWS CHEMISTRY: 1,2,3 for AS and 4,5,6 for A2, per the author's
-- instruction. The value then matches the unit number it belongs to, which is
-- the property that makes a row readable on its own: WPH15 is unit 5 and sorts
-- 5. Biology's restart makes WBI15 sort 2, which is correct but tells you
-- nothing without knowing which course you are looking at.
--
-- Biology remains on the other convention. That inconsistency is pre-existing
-- and not worth a data migration to unify, since nothing reads across courses.
--
-- ---------------------------------------------------------------------------
-- SAFETY
-- ---------------------------------------------------------------------------
-- Re-runnable. Each INSERT ... SELECT is guarded by NOT EXISTS on
-- (course_id, slug), the table's own unique key, so running this twice inserts
-- nothing the second time and raises no error. Course ids are looked up by
-- slug rather than hardcoded, and the whole thing aborts if either course is
-- missing rather than inserting orphans.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Pre-flight: both courses must exist, or there is nothing to attach units to.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(s, ', ')
    INTO missing
    FROM unnest(ARRAY['edexcel-ial-as-physics', 'edexcel-ial-a2-physics']) AS s
   WHERE NOT EXISTS (SELECT 1 FROM public.courses c WHERE c.slug = s);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'ABORTING: course(s) not found: %. Units cannot be attached. No changes made.',
      missing;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- AS Physics — units 1, 2, 3
-- ----------------------------------------------------------------------------
INSERT INTO public.units (course_id, slug, code, name, status, sort_order)
SELECT c.id, v.slug, v.code, v.name, 'coming_soon'::content_status, v.sort_order
  FROM public.courses c
  CROSS JOIN (VALUES
    ('unit-1', 'WPH11', 'Unit 1: Mechanics and Materials',            1),
    ('unit-2', 'WPH12', 'Unit 2: Waves and Electricity',              2),
    ('unit-3', 'WPH13', 'Unit 3: Practical Skills in Physics I',      3)
  ) AS v(slug, code, name, sort_order)
 WHERE c.slug = 'edexcel-ial-as-physics'
   AND NOT EXISTS (
     SELECT 1 FROM public.units u
      WHERE u.course_id = c.id AND u.slug = v.slug
   );

-- ----------------------------------------------------------------------------
-- A2 Physics — units 4, 5, 6
-- ----------------------------------------------------------------------------
INSERT INTO public.units (course_id, slug, code, name, status, sort_order)
SELECT c.id, v.slug, v.code, v.name, 'coming_soon'::content_status, v.sort_order
  FROM public.courses c
  CROSS JOIN (VALUES
    ('unit-4', 'WPH14', 'Unit 4: Further Mechanics, Fields and Particles',                4),
    ('unit-5', 'WPH15', 'Unit 5: Thermodynamics, Radiation, Oscillations and Cosmology',  5),
    ('unit-6', 'WPH16', 'Unit 6: Practical Skills in Physics II',                         6)
  ) AS v(slug, code, name, sort_order)
 WHERE c.slug = 'edexcel-ial-a2-physics'
   AND NOT EXISTS (
     SELECT 1 FROM public.units u
      WHERE u.course_id = c.id AND u.slug = v.slug
   );

COMMIT;


-- ============================================================================
-- VERIFICATION — run after applying
-- ============================================================================
-- (a) The six rows, attached to the right courses. Expect exactly 6.
--
--   SELECT u.code, u.slug, u.sort_order, u.status, c.slug AS course, c.level, u.name
--     FROM public.units u
--     JOIN public.courses c ON c.id = u.course_id
--    WHERE u.code LIKE 'WPH%'
--    ORDER BY c.level DESC, u.sort_order;
--
--   -- expect AS: WPH11/unit-1/1, WPH12/unit-2/2, WPH13/unit-3/3
--   --        A2: WPH14/unit-4/4, WPH15/unit-5/5, WPH16/unit-6/6
--   -- i.e. sort_order == unit number throughout, matching WCH11..WCH16
--
-- (b) Every subject now has six units. Expect three rows, each count = 6.
--
--   SELECT left(code, 3) AS subject, count(*) AS units
--     FROM public.units
--    GROUP BY 1 ORDER BY 1;
--
-- (c) Nothing else moved — the twelve pre-existing rows are untouched.
--     Expect 12.
--
--   SELECT count(*) FROM public.units WHERE code LIKE 'WCH%' OR code LIKE 'WBI%';
--
-- (d) The importer can now resolve Physics. Expect 6 rows, each with a course.
--
--   SELECT u.code, c.slug FROM public.units u
--     JOIN public.courses c ON c.id = u.course_id
--    WHERE u.code IN ('WPH11','WPH12','WPH13','WPH14','WPH15','WPH16')
--    ORDER BY u.code;
-- ============================================================================


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Safe while no past_papers row references these units. units.id is referenced
-- by past_papers.unit_id ON DELETE SET NULL, so deleting after a Physics import
-- would orphan those papers from their unit rather than error — check first:
--
--   SELECT count(*) FROM public.past_papers p
--     JOIN public.units u ON u.id = p.unit_id
--    WHERE u.code LIKE 'WPH%';
--   -- expect 0 before rolling back
--
--   BEGIN;
--   DELETE FROM public.units WHERE code IN
--     ('WPH11','WPH12','WPH13','WPH14','WPH15','WPH16');
--   COMMIT;
-- ============================================================================
