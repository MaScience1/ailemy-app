-- ============================================================================
-- 0065_PROPOSED_lesson_practice.sql
-- ----------------------------------------------------------------------------
-- ⚠ NUMBER ISSUED BY PLANNING (2026-08-22 sitting). _PROPOSED_ until applied —
-- rename and record observed verification results in this header in the SAME
-- step as applying. Requires 0064 applied first (nothing here references its
-- tables, but the numbering order is the apply order).
--
-- Three sections, one paste each, then verification pastes.
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
-- ⚠ ERASURE: no name, email, or free-person-text columns exist here. Student
-- answers are option INDEXES, not prose. Rows die with the auth user via
-- CASCADE; 0066 adds explicit counted deletes so the erasure receipt names
-- them rather than relying on CASCADE silently.
--
-- ⚠ PLANNING AMENDMENT 1 (this sitting): the append-only trigger uses the
-- transaction-local GUC pattern — 0047/0048's app.ledger_purge precedent —
-- NOT session_replication_role. replica mode was the first draft's mechanism
-- and it was the wrong one: it silences EVERY trigger in the session scope it
-- touches (touch_updated_at, FK actions on some paths, future audit hooks),
-- when the erasure needs exactly ONE named door. current_setting/set_config
-- with is_local=true opens that one door for one transaction, and DELETE
-- only: an UPDATE is refused even mid-erasure, because erasure deletes
-- history, it never rewrites it.
-- ============================================================================

-- ══ FOUNDER PASTE 1 — lesson_practice_attempts ══════════════════════════════
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

-- ══ FOUNDER PASTE 2 — lesson_practice_answers ═══════════════════════════════
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

-- ══ FOUNDER PASTE 3 — append-only trigger, GUC-door pattern (amendment 1) ═══
BEGIN;

-- 0047/0048's refuse_ledger_mutation is the template: unconditional refusal
-- with ONE named, transaction-local exception. Differences here, both
-- deliberate: the door opens for DELETE ONLY (erasure removes history; it
-- never rewrites it — an UPDATE is refused even mid-erasure), and the GUC is
-- app.erasure_active, set by erase_user v4 (0066) beside app.ledger_purge.
CREATE OR REPLACE FUNCTION public.refuse_practice_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- ⚠ current_setting(..., true) — the `true` means "missing is NULL, not an
  -- error". Without it every ordinary write would fail with a confusing
  -- unrecognized-configuration-parameter error instead of the intended
  -- message (the 0048 lesson, kept).
  IF TG_OP = 'DELETE'
     AND coalesce(current_setting('app.erasure_active', true), 'off') = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'lesson practice history is append-only: % on % refused. Submitted attempts are the academic record; erasure is the one legitimate delete and it runs with SET LOCAL app.erasure_active = ''on'' (erase_user v4).',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER lpa_refuse_mutation
  BEFORE UPDATE OR DELETE ON public.lesson_practice_attempts
  FOR EACH ROW EXECUTE FUNCTION public.refuse_practice_mutation();
CREATE TRIGGER lpans_refuse_mutation
  BEFORE UPDATE OR DELETE ON public.lesson_practice_answers
  FOR EACH ROW EXECUTE FUNCTION public.refuse_practice_mutation();

COMMIT;

-- ══ FOUNDER PASTE 4 — structure + privilege verification ════════════════════
-- Both tables, RLS enabled — EXPECT exactly 2 rows, relrowsecurity = t:
SELECT relname, relrowsecurity
  FROM pg_class
 WHERE relname IN ('lesson_practice_attempts','lesson_practice_answers')
 ORDER BY relname;
-- Dangerous privileges absent — EXPECT ZERO rows:
SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name IN ('lesson_practice_attempts','lesson_practice_answers')
   AND grantee IN ('anon','authenticated')
   AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- No UPDATE or DELETE grant for any client on either table — EXPECT ZERO rows:
SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_name IN ('lesson_practice_attempts','lesson_practice_answers')
   AND grantee IN ('anon','authenticated')
   AND privilege_type IN ('UPDATE','DELETE');
-- Both triggers attached and enabled ('O') — EXPECT 2 rows:
SELECT tgname, tgenabled
  FROM pg_trigger
 WHERE tgname IN ('lpa_refuse_mutation','lpans_refuse_mutation')
 ORDER BY tgname;

-- ══ FOUNDER PASTE 5 — ⚠ THE GUC DOOR, BOTH HALVES (amendment 1's rewrite) ═══
-- One DO block, four proofs, self-cleaning:
--   1. DELETE without the GUC → REFUSED (that red, trapped, is the pass)
--   2. UPDATE without the GUC → REFUSED
--   3. UPDATE WITH the GUC    → STILL REFUSED (the door is DELETE-only)
--   4. DELETE WITH the GUC    → SUCCEEDS (the erasure path), cleanup by
--      captured id inside the same transaction
DO $$
DECLARE
  student uuid;
  l1 uuid;
  probe uuid;
  refused integer := 0;
BEGIN
  SELECT id INTO student FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO l1 FROM public.lessons WHERE slug = 'definitions-formulae-and-the-mole';
  IF student IS NULL OR l1 IS NULL THEN RAISE EXCEPTION 'preflight: need one user and the L1 row'; END IF;

  INSERT INTO public.lesson_practice_attempts
    (student_id, lesson_id, seed, question_count, score, percent, snapshot)
  VALUES (student, l1, 424242, 10, 7, 70.0, '{"probe": true}'::jsonb)
  RETURNING id INTO probe;

  -- 1. DELETE without the GUC — the expected red, trapped and asserted.
  BEGIN
    DELETE FROM public.lesson_practice_attempts WHERE id = probe;
  EXCEPTION WHEN restrict_violation THEN
    refused := refused + 1;
    RAISE NOTICE 'PASS 1/4 — DELETE without the GUC refused (append-only holds)';
  END;

  -- 2. UPDATE without the GUC.
  BEGIN
    UPDATE public.lesson_practice_attempts SET score = 10 WHERE id = probe;
  EXCEPTION WHEN restrict_violation THEN
    refused := refused + 1;
    RAISE NOTICE 'PASS 2/4 — UPDATE without the GUC refused';
  END;

  -- 3. UPDATE with the GUC — the door must NOT open for rewrites.
  PERFORM set_config('app.erasure_active', 'on', true);
  BEGIN
    UPDATE public.lesson_practice_attempts SET score = 10 WHERE id = probe;
  EXCEPTION WHEN restrict_violation THEN
    refused := refused + 1;
    RAISE NOTICE 'PASS 3/4 — UPDATE refused EVEN WITH the GUC: erasure deletes, it never rewrites';
  END;

  IF refused <> 3 THEN
    RAISE EXCEPTION 'FAIL — only % of 3 refusals fired; the append-only trigger is not biting', refused;
  END IF;

  -- 4. DELETE with the GUC — the one legitimate path. This is also the probe's
  -- cleanup, by captured id.
  DELETE FROM public.lesson_practice_attempts WHERE id = probe;
  RAISE NOTICE 'PASS 4/4 — DELETE with the GUC succeeded (the erasure door, and the cleanup)';
END $$;
-- EXPECT four PASS notices. The GUC was set with is_local=true inside the DO
-- block's transaction, so it is already gone. Post-checks — EXPECT 'off' (or
-- empty) and then ZERO rows:
SELECT coalesce(current_setting('app.erasure_active', true), 'off') AS guc_after;
SELECT id FROM public.lesson_practice_attempts WHERE seed = 424242;

-- ══ FOUNDER PASTE 6 — the data CHECKs bite, with controls ═══════════════════
DO $$
DECLARE
  student uuid; l1 uuid; probe uuid; a1 uuid;
  hit integer := 0;
BEGIN
  SELECT id INTO student FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO l1 FROM public.lessons WHERE slug = 'definitions-formulae-and-the-mole';
  INSERT INTO public.lesson_practice_attempts
    (student_id, lesson_id, seed, question_count, score, percent, snapshot)
  VALUES (student, l1, 434343, 10, 0, 0.0, '{"probe": true}'::jsonb)
  RETURNING id INTO probe;

  -- correct=true with mark_awarded=0 must violate lpans_mark_matches_verdict.
  BEGIN
    INSERT INTO public.lesson_practice_answers
      (attempt_id, q_index, family_key, spec_code, kind, selected_index,
       correct_index, correct, mark_awarded, mark_available)
    VALUES (probe, 0, 'probe-family', '1.1', 'definition', 1, 1, true, 0, 1);
  EXCEPTION WHEN check_violation THEN
    hit := hit + 1;
    RAISE NOTICE 'PASS — correct=true with 0 marks refused (23514, the expected red)';
  END;

  -- CONTROL: the coherent row inserts.
  INSERT INTO public.lesson_practice_answers
    (attempt_id, q_index, family_key, spec_code, kind, selected_index,
     correct_index, correct, mark_awarded, mark_available)
  VALUES (probe, 0, 'probe-family', '1.1', 'definition', 1, 1, true, 1, 1)
  RETURNING id INTO a1;
  RAISE NOTICE 'PASS — control: the coherent answer row inserts';

  -- Duplicate q_index must violate lpans_unique_per_attempt.
  BEGIN
    INSERT INTO public.lesson_practice_answers
      (attempt_id, q_index, family_key, spec_code, kind, selected_index,
       correct_index, correct, mark_awarded, mark_available)
    VALUES (probe, 0, 'probe-family-2', '1.1', 'definition', 2, 1, false, 0, 1);
  EXCEPTION WHEN unique_violation THEN
    hit := hit + 1;
    RAISE NOTICE 'PASS — duplicate q_index refused (23505, the expected red)';
  END;
  IF hit <> 2 THEN RAISE EXCEPTION 'FAIL — only % of 2 expected refusals fired', hit; END IF;

  -- Cleanup through the erasure door, by captured id, inside this transaction.
  PERFORM set_config('app.erasure_active', 'on', true);
  DELETE FROM public.lesson_practice_answers WHERE id = a1;
  DELETE FROM public.lesson_practice_attempts WHERE id = probe;
  RAISE NOTICE 'cleanup: probe answer and attempt removed via the GUC door';
END $$;
-- EXPECT four notices. Post-check — EXPECT ZERO rows:
SELECT id FROM public.lesson_practice_attempts WHERE seed = 434343;

-- ══ FOUNDER PASTE 7 — PostgREST cache + anon posture ════════════════════════
NOTIFY pgrst, 'reload schema';
-- Then, AFTER a few seconds, SESSION-RUN SR-3 below checks the anon result
-- over PostgREST. (An SQL-editor SELECT here runs as postgres and proves
-- nothing about anon — the is_staff() lesson, applied to grants.)

-- ══ SESSION-RUN (mine, not founder pastes) ══════════════════════════════════
-- SR-3  anon SELECT on lesson_practice_attempts over PostgREST → 42501
--       (permission denied, NOT PGRST205 and NOT an empty array — the
--       0059-style probe shape that cannot swallow the distinction).
-- SR-4  As STUDENT A (probe user): INSERT own attempt → ok; INSERT with
--       student B's id → 42501; SELECT student B's attempts → zero rows;
--       CONTROL: service-role sees both. Cleanup via the GUC door by
--       captured id.
-- SR-5  recordPracticeEvidence() wired: one submitted attempt writes 1
--       attempt row + 10 answer rows; the same submission REPLAYED (same
--       seed, same fingerprint) does not duplicate them.
