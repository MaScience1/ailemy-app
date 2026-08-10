-- ============================================================================
-- 0034 — mark_scheme_items: drop accepted_alternatives, add point_kind
-- ============================================================================
--
-- ⚠ PROPOSED. NOT APPLIED. NOT TO BE APPLIED WITHOUT READING THE CHECK BELOW.
--
-- The _PROPOSED_ prefix is load-bearing: a rebuild replays this folder in
-- order, so a file sitting under its plain number that has not been run
-- manufactures the exact drift that naming rule exists to prevent. Rename to
-- 0034_drop_accepted_alternatives_and_add_point_kind.sql only once it is live,
-- and write the verification result into this header at the same time.
--
-- ----------------------------------------------------------------------------
-- PART 1 — DROP accepted_alternatives
-- ----------------------------------------------------------------------------
-- 0029 split one array called `accepted_alternatives` into three columns that
-- say what they mean: `accept` (still earns the mark), `reject` (must NOT earn
-- it) and `guidance` (neither — examiner prose). The old column held all three
-- kinds at once, which is how "Do not award ions move" came to sit in a list
-- named "accepted alternatives" on 23(c)(ii), looking exactly like a
-- concession. That is the whole reason 0029 exists.
--
-- Since then the column has been deliberately left empty: the seeder never
-- writes it, and validateQuestionSet() REJECTS a fixture that populates the
-- corresponding field, so no transcribed content can have been stranded there.
-- The guard below proves that rather than trusting it.
--
-- ----------------------------------------------------------------------------
-- PART 2 — ADD point_kind
-- ----------------------------------------------------------------------------
-- `mark_scheme_items` says what a point is FOR in prose and nowhere in data.
-- That was harmless while every marked type had exactly one point per question:
-- mcq and numeric never had to ask which point was which.
--
-- The chemical-equation marker does. 20(b)(ii) is two marks —
--
--     M1  correctly balanced equation
--     M2  state symbols correct
--
-- — and awarding them separately is the difference between 1/2 and 0/2 for the
-- many candidates the examiner's report describes ("able to balance but several
-- lost the state symbol mark"). With no column to read, classifyPoint() in
-- src/lib/exam/chemistry/equation.ts READS THE CRITERION PROSE, the way
-- extractMcqKey() reads "the only correct answer is B".
--
-- That works and it fails closed — a point it cannot classify makes the whole
-- question unmarkable and names the point. But it is inference over editorial
-- text, and the fixture's own header warns that the wording is editorial.
--
-- ⚠ NULLABLE, AND NOTHING DEPENDS ON IT BEING POPULATED. classifyPoint() stays
-- exactly as it is and remains the behaviour for every existing row. The column
-- is an override for the cases prose cannot state cleanly — a combined
-- "balanced equation with state symbols" point, or a scheme whose wording this
-- app has not seen. A NOT NULL default would have been a lie about 25 rows
-- nobody has classified by hand.
--
-- The CHECK list is deliberately short. It covers what the marker can act on
-- today; adding a value later is a one-line migration, whereas removing one
-- that turned out to mean two different things is not.
--
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Refuse to drop a column that still holds something
-- ----------------------------------------------------------------------------
-- ⚠ THIS IS THE POINT OF THE MIGRATION, NOT A FORMALITY. The claim justifying
-- the DROP is "the column is empty". A migration that asserts that claim is
-- evidence; one that assumes it is a data loss waiting for the one row nobody
-- checked. An empty array and a NULL both count as empty; anything else aborts
-- the whole transaction with the count.
DO $$
DECLARE
  populated integer;
BEGIN
  SELECT count(*) INTO populated
    FROM public.mark_scheme_items
   WHERE accepted_alternatives IS NOT NULL
     AND cardinality(accepted_alternatives) > 0;

  IF populated > 0 THEN
    RAISE EXCEPTION
      'REFUSING TO DROP: % mark_scheme_items row(s) still hold accepted_alternatives. '
      'Move each into accept[] / reject[] / guidance per 0029 before running this.',
      populated;
  END IF;
END $$;

ALTER TABLE public.mark_scheme_items
  DROP COLUMN IF EXISTS accepted_alternatives;

-- ----------------------------------------------------------------------------
-- 2. point_kind — what this point assesses, when prose cannot say it
-- ----------------------------------------------------------------------------
ALTER TABLE public.mark_scheme_items
  ADD COLUMN IF NOT EXISTS point_kind text;

ALTER TABLE public.mark_scheme_items
  DROP CONSTRAINT IF EXISTS mark_scheme_items_point_kind_check;

ALTER TABLE public.mark_scheme_items
  ADD CONSTRAINT mark_scheme_items_point_kind_check
  CHECK (point_kind IS NULL OR point_kind IN (
    -- the equation itself: species, coefficients, arrow
    'equation',
    -- state symbols only
    'state_symbols',
    -- one mark for both of the above together
    'equation_with_state_symbols',
    -- a step in a calculation (working capture, Tier 2)
    'method',
    -- the final answer of a calculation
    'final_answer'
  ));

COMMENT ON COLUMN public.mark_scheme_items.point_kind IS
  'What this point assesses, for markers that award points separately. NULLABLE and unpopulated by default: src/lib/exam/chemistry/equation.ts classifyPoint() infers it from the criterion prose and remains the behaviour wherever this is NULL. Set it only where the prose cannot state the kind cleanly.';

-- ----------------------------------------------------------------------------
-- 3. Privileges
-- ----------------------------------------------------------------------------
-- Not a CREATE TABLE, so the standing REVOKE rule does not apply — no new table
-- means no fresh default grants. Restated rather than assumed, because the rule
-- exists precisely because that assumption was wrong once. A new COLUMN
-- inherits the table's existing grants, and mark_scheme_items already holds
-- SELECT-only for authenticated (0028), which is correct for this column: it is
-- marking metadata and no client writes it.

COMMIT;

-- ============================================================================
-- VERIFICATION — run AFTER, in the same session. Both must hold.
-- ============================================================================
--
-- 1. accepted_alternatives is gone, point_kind exists and is nullable.
--    Expect exactly one row: point_kind | YES | text
--
-- SELECT column_name, is_nullable, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'mark_scheme_items'
--    AND column_name IN ('accepted_alternatives', 'point_kind');
--
-- 2. The CHECK rejects a value outside the list. Expect ERROR 23514, and the
--    ROLLBACK leaves nothing behind.
--
-- BEGIN;
--   UPDATE public.mark_scheme_items SET point_kind = 'nonsense'
--    WHERE id = (SELECT id FROM public.mark_scheme_items LIMIT 1);
-- ROLLBACK;
--
-- 3. And that a legitimate value is accepted, then undone.
--
-- BEGIN;
--   UPDATE public.mark_scheme_items SET point_kind = 'state_symbols'
--    WHERE id = (SELECT id FROM public.mark_scheme_items LIMIT 1);
--   SELECT point_kind FROM public.mark_scheme_items WHERE point_kind IS NOT NULL;
-- ROLLBACK;
--
-- ⚠ Nothing in the application reads point_kind yet. Applying this changes no
-- behaviour: it removes a column that has been empty since 0029 and adds one
-- that is NULL everywhere. classifyPoint() keeps marking 20(b)(ii) exactly as
-- it does today.
-- ============================================================================
