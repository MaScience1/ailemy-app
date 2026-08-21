-- ============================================================================
-- _PROPOSED_lesson_practice.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED, NOT NUMBERED. Numbers come from the planning chat
-- only. Written 2026-08-22 during the feat/lesson-player overnight build.
-- Three sections — apply as SEPARATE pastes (the SQL Editor drops trailing
-- sections of long pastes).
--
-- ============================================================================
-- ⚠ WHY THESE ARE NEW TABLES AND NOT ROWS IN question_attempts — THE §2 CASE
-- ============================================================================
-- The governance rule for this build: the attempt schema proposed here IS the
-- shared academic record Progress v2 consumes — one attempt architecture, no
-- parallel quiz silo. The existing 0028 spine was examined first and does not
-- fit, for two structural reasons:
--
--   1. question_attempts.question_id is NOT NULL REFERENCES paper_questions.
--      Practice questions are GENERATED variants of code-defined families —
--      they have no paper_questions row, and manufacturing fake paper rows to
--      satisfy the FK would pollute the protected paper/seeder domain with
--      non-paper content (the untouchables rule).
--   2. question_attempts is UNIQUE(exam_attempt_id, question_id) — one row per
--      question per sitting, updated in place. Practice needs one row per
--      SERVED VARIANT per attempt, immutably (§53: a new ten never overwrites
--      the last ten; §88: history stays reconstructable).
--
-- What "one academic record" actually requires is that Progress can read BOTH
-- arms through one join surface: (student_id, spec_code, marks awarded, marks
-- available, attempted_at). exam_attempts→question_attempts carries those for
-- past papers; lesson_practice_answers carries exactly the same five for
-- lesson practice. The parked Progress v2 build reads the union. Same record,
-- two evidence sources, zero duplication of either.
--
-- ⚠ ERASURE (§E below extends erase_user in the SAME set): no name, email, or
-- free-person-text columns exist here. student answers are option INDEXES, not
-- prose. Rows die with the auth user via CASCADE; §E adds explicit counted
-- deletes so the erasure receipt names them rather than relying on CASCADE
-- silently.
-- ============================================================================

-- ══ SECTION 1 — lesson_practice_attempts ═══════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_practice_attempts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id      uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  -- The uint32 that reproduces the attempt (§45). With the engine version it
  -- is the full generation record.
  seed           bigint NOT NULL,
  question_count integer NOT NULL,
  score          integer NOT NULL,
  -- Exact where it divides (7/10 → 70.0), one decimal otherwise (§102).
  percent        numeric(4,1) NOT NULL,
  -- §88: the marked questions as served — stems, options, selections,
  -- explanations — so history is reconstructable after families change.
  snapshot       jsonb NOT NULL,
  started_at     timestamptz,
  submitted_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lpa_seed_uint32 CHECK (seed >= 0 AND seed <= 4294967295),
  CONSTRAINT lpa_counts CHECK (
    question_count > 0 AND score >= 0 AND score <= question_count
  ),
  CONSTRAINT lpa_percent_range CHECK (percent >= 0 AND percent <= 100)
);

CREATE INDEX IF NOT EXISTS lpa_student_lesson_idx
  ON public.lesson_practice_attempts (student_id, lesson_id, submitted_at DESC);

ALTER TABLE public.lesson_practice_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY lpa_select_own ON public.lesson_practice_attempts
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY lpa_insert_own ON public.lesson_practice_attempts
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY lpa_staff_read ON public.lesson_practice_attempts
  FOR SELECT TO authenticated USING (public.is_staff());

GRANT SELECT ON public.lesson_practice_attempts TO authenticated;
GRANT INSERT (student_id, lesson_id, seed, question_count, score, percent, snapshot, started_at)
  ON public.lesson_practice_attempts TO authenticated;
-- ⚠ NO UPDATE, NO DELETE — for anyone, including a future admin policy.
-- Submitted attempts are the academic record (§53, §104).

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_practice_attempts FROM anon, authenticated;

COMMIT;

-- ══ SECTION 2 — lesson_practice_answers ════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_practice_answers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id     uuid NOT NULL REFERENCES public.lesson_practice_attempts(id) ON DELETE CASCADE,
  q_index        integer NOT NULL,
  family_key     text NOT NULL,
  spec_code      text NOT NULL,
  kind           text NOT NULL,
  selected_index integer,           -- NULL = left blank; never invented
  correct_index  integer NOT NULL,
  correct        boolean NOT NULL,
  -- ⚠ THE PROGRESS JOIN SURFACE: marks awarded / available, per question,
  -- 1-mark MCQs today, wider tariffs possible later without a schema change.
  mark_awarded   integer NOT NULL,
  mark_available integer NOT NULL,
  attempted_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lpans_qindex_range CHECK (q_index >= 0 AND q_index < 50),
  CONSTRAINT lpans_selected_range CHECK (selected_index IS NULL OR (selected_index >= 0 AND selected_index <= 3)),
  CONSTRAINT lpans_correct_range CHECK (correct_index >= 0 AND correct_index <= 3),
  CONSTRAINT lpans_marks CHECK (
    mark_available > 0 AND mark_awarded >= 0 AND mark_awarded <= mark_available
  ),
  -- The mark must agree with the verdict — a row cannot say "correct" and 0.
  CONSTRAINT lpans_mark_matches_verdict CHECK (
    (correct AND mark_awarded = mark_available) OR ((NOT correct) AND mark_awarded = 0)
  ),
  CONSTRAINT lpans_unique_per_attempt UNIQUE (attempt_id, q_index)
);

CREATE INDEX IF NOT EXISTS lpans_spec_idx
  ON public.lesson_practice_answers (spec_code, family_key);

ALTER TABLE public.lesson_practice_answers ENABLE ROW LEVEL SECURITY;

-- Ownership derives from the parent attempt — scoped TO authenticated so the
-- subquery never evaluates for anon (the 0013 lesson).
CREATE POLICY lpans_select_own ON public.lesson_practice_answers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.lesson_practice_attempts a
       WHERE a.id = attempt_id AND a.student_id = auth.uid()
    )
  );
CREATE POLICY lpans_insert_own ON public.lesson_practice_answers
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lesson_practice_attempts a
       WHERE a.id = attempt_id AND a.student_id = auth.uid()
    )
  );
CREATE POLICY lpans_staff_read ON public.lesson_practice_answers
  FOR SELECT TO authenticated USING (public.is_staff());

GRANT SELECT ON public.lesson_practice_answers TO authenticated;
GRANT INSERT (attempt_id, q_index, family_key, spec_code, kind, selected_index,
              correct_index, correct, mark_awarded, mark_available, attempted_at)
  ON public.lesson_practice_answers TO authenticated;
-- No UPDATE, no DELETE — same immutability as the parent.

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_practice_answers FROM anon, authenticated;

COMMIT;

-- ══ SECTION 3 — immutability enforced structurally, not by grant absence ════
BEGIN;

-- The credit ledger's refuse-mutation pattern (0047): a grant added later by
-- accident must still bounce off the trigger. Service role bypasses RLS but
-- NOT triggers, so even admin tooling cannot quietly rewrite history.
CREATE OR REPLACE FUNCTION public.refuse_practice_mutation()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'lesson practice history is append-only — % on % refused',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'raise_exception';
END;
$$;

CREATE TRIGGER lpa_refuse_mutation
  BEFORE UPDATE OR DELETE ON public.lesson_practice_attempts
  FOR EACH ROW EXECUTE FUNCTION public.refuse_practice_mutation();
CREATE TRIGGER lpans_refuse_mutation
  BEFORE UPDATE OR DELETE ON public.lesson_practice_answers
  FOR EACH ROW EXECUTE FUNCTION public.refuse_practice_mutation();

-- ⚠ ERASURE IS THE ONE LEGITIMATE DELETE, and it must stay possible: the
-- triggers above would also block erase_user. The erase path disables them
-- for its own transaction via session_replication_role = replica — which
-- erase_user v3 already sets. §E RECORDS THE REQUIRED erase_user EXTENSION:
--   In the same planning sitting that numbers this file, erase_user gains,
--   in its counted-deletes section:
--     DELETE FROM public.lesson_practice_answers a
--       USING public.lesson_practice_attempts t
--      WHERE a.attempt_id = t.id AND t.student_id = target;   -- count into receipt
--     DELETE FROM public.lesson_practice_attempts WHERE student_id = target;
--     DELETE FROM public.lesson_view_state        WHERE user_id  = target;
--   plus the three counts in the receipt jsonb. No name/email columns exist
--   in any of the four new tables, so the generic email sweep has nothing to
--   miss — these deletes exist so the receipt is COMPLETE, not because
--   CASCADE would fail.

COMMIT;

-- ══ VERIFICATION (run after applying) ══════════════════════════════════════
-- (a) RLS on, both tables; (b) zero TRUNCATE/TRIGGER/REFERENCES for
--     anon/authenticated — same queries as the decks file, table names swapped.
-- (c) as STUDENT A: insert an attempt (own student_id) → ok; insert with
--     student B's id → 42501; SELECT student B's attempts → zero rows; then
--     the CONTROL: service role sees both.
-- (d) ⚠ IMMUTABILITY, WITH CONTROL: as service role, UPDATE a probe attempt's
--     score → must RAISE 'append-only'; DELETE it → same. Then SET
--     session_replication_role = replica; DELETE → succeeds (this is the
--     erase path); RESET session_replication_role. Cleanup by captured id.
-- (e) mark-verdict CHECK bites: insert an answer with correct=true,
--     mark_awarded=0 → 23514; CONTROL: same row with mark_awarded=1 → ok
--     (then delete via replica mode).
-- (f) the UNIQUE(attempt_id, q_index) bites on a duplicate q_index → 23505.
-- (g) PGRST cache: NOTIFY pgrst, 'reload schema'; then an anon SELECT on
--     lesson_practice_attempts → 42501 (not PGRST205 and not zero rows).
