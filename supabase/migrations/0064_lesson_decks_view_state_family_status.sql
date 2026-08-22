-- ============================================================================
-- 0064_PROPOSED_lesson_decks_view_state_family_status.sql
-- ----------------------------------------------------------------------------
-- ⚠ APPLIED 2026-08-22 — the founder ran the WHOLE FILE as one paste.
-- Number issued by planning (2026-08-22 sitting).
--
-- OBSERVED AT APPLY (founder-reported):
--   Paste 4 (d)  the column-scoped UPDATE returned exactly the four columns
--                (deck_version, last_frame_index, slides_completed_at,
--                slides_visited) — user_id and lesson_id absent  ✓
--   Pastes 1-3   applied; Pastes 5-6 completed within the same run.
--   SESSION-RUN SR-1 (student RLS quadrants) and SR-2 (status store
--   round-trip through the table) are PENDING — run and record here before
--   this header may claim full verification.
--
-- THREE TABLES, THREE SECTIONS, ONE PASTE EACH (the SQL Editor drops trailing
-- sections of long pastes — never combine):
--   1. lesson_decks          §9/§10 deck lifecycle + version history
--   2. lesson_view_state     §25/§26 resume + slides-visited record
--   3. lesson_family_status  planning amendment 2 — the family approval store
--                            (loadStatuses/saveStatus already read it, with
--                            content/practice-status.json as DEV FALLBACK ONLY)
-- Then FOUNDER PASTE 4-6 verify, and two SESSION-RUN checks are mine.
--
-- WHAT THE APP DOES TODAY WITHOUT THIS, AND WHAT CHANGES WHEN IT LANDS:
--   deck registry   today: lessons.deck_path (0008) is the only record.
--                   after: lesson_decks holds lifecycle + history; deck_path
--                   REMAINS the serving pointer; the admin publish action
--                   updates both together.
--   view state      today: localStorage only, and the player says so.
--                   after: the §25/§26 record; the player's persist callback
--                   gains a server action (wiring point in LessonPlayer.tsx).
--   family status   today: table-first code path falls back to JSON with a
--                   server log. after: the fallback goes quiet and the table
--                   is the store.
--
-- ⚠ ERASURE: no table here carries a name, an email, or free text about a
-- person. lesson_view_state keys on auth.users ON DELETE CASCADE;
-- lesson_family_status.updated_by is ON DELETE SET NULL (an admin's action
-- record survives the admin's account). 0066 adds the counted view-state
-- delete to erase_user's receipt.
-- ============================================================================

-- ══ FOUNDER PASTE 1 — lesson_decks ═════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_decks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id         uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  version           integer NOT NULL,
  status            text NOT NULL DEFAULT 'uploaded',
  -- lesson-sources/<lesson_id>/v<k>/source.pptx — the §6 protected original.
  source_bucket_path text,
  -- lessons/<lesson_id>/deck/v<k> — the student-servable derivative directory.
  deck_bucket_path  text,
  source_sha256     text,
  deck_label        text,
  slide_count       integer,
  frame_count       integer,
  -- Orphaned animation targets dropped at ingest (see ingest.py) — recorded so
  -- admin review sees the fidelity note, per deck, forever.
  ghost_steps       integer NOT NULL DEFAULT 0,
  error             text,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  published_at      timestamptz,

  CONSTRAINT lesson_decks_version_positive CHECK (version >= 1),
  CONSTRAINT lesson_decks_status_check CHECK (
    status IN ('uploaded','processing','ready','published','failed','superseded')
  ),
  -- A published row must know where its deck lives and how big it is.
  CONSTRAINT lesson_decks_published_complete CHECK (
    status <> 'published'
    OR (deck_bucket_path IS NOT NULL AND slide_count IS NOT NULL AND frame_count IS NOT NULL)
  ),
  CONSTRAINT lesson_decks_sha_shape CHECK (
    source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT lesson_decks_unique_version UNIQUE (lesson_id, version)
);

-- ⚠ ONE PUBLISHED DECK PER LESSON — the invariant §10's lifecycle rests on.
CREATE UNIQUE INDEX IF NOT EXISTS lesson_decks_one_published_per_lesson
  ON public.lesson_decks (lesson_id) WHERE status = 'published';

CREATE INDEX IF NOT EXISTS lesson_decks_lesson_idx
  ON public.lesson_decks (lesson_id, version DESC);

ALTER TABLE public.lesson_decks ENABLE ROW LEVEL SECURITY;

-- ⚠ NO CLIENT POLICIES AND NO CLIENT GRANTS, DELIBERATELY. The deck lifecycle
-- is admin tooling: every reader and writer is a server action holding the
-- service-role client behind assertAdmin(). Students learn about decks only
-- through lessons.deck_path, which is already public-readable. A student
-- SELECT here would only leak unpublished versions' existence.

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_decks FROM anon, authenticated;
-- (No SELECT/INSERT/UPDATE/DELETE were granted either — deny by absence AND
-- by revocation, the 0026-was-never-applied rule.)

COMMIT;

-- ══ FOUNDER PASTE 2 — lesson_view_state ════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_view_state (
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id          uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  -- The player's flat frame index (§25 resume) — deck-version-relative, so a
  -- republished deck may render it stale; the player clamps, never crashes.
  last_frame_index   integer NOT NULL DEFAULT 0,
  deck_version       integer,
  -- Slide numbers visited (§26): "opened slide 1" must never read as 100%.
  slides_visited     integer[] NOT NULL DEFAULT '{}',
  slides_completed_at timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lesson_view_state_pk PRIMARY KEY (user_id, lesson_id),
  CONSTRAINT lesson_view_state_frame_nonneg CHECK (last_frame_index >= 0)
);

-- Reuses 0001's touch_updated_at() — attached to eleven tables already;
-- twelve now, rather than a twelfth copy of the function.
CREATE TRIGGER touch_lesson_view_state
  BEFORE UPDATE ON public.lesson_view_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.lesson_view_state ENABLE ROW LEVEL SECURITY;

-- Own rows only, stated separately per verb so the write predicate is in BOTH
-- USING and WITH CHECK (the 0018/0059 discipline).
CREATE POLICY lesson_view_state_select_own ON public.lesson_view_state
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY lesson_view_state_insert_own ON public.lesson_view_state
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY lesson_view_state_update_own ON public.lesson_view_state
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.lesson_view_state TO authenticated;
GRANT INSERT (user_id, lesson_id, last_frame_index, deck_version, slides_visited, slides_completed_at)
  ON public.lesson_view_state TO authenticated;
-- ⚠ UPDATE deliberately EXCLUDES user_id and lesson_id: a row's identity is
-- not a student-writable field, and PostgREST upsert would otherwise compile
-- ON CONFLICT DO UPDATE SET user_id = EXCLUDED.user_id and 42501 (the 0059
-- lesson). The app's writer does UPDATE-then-INSERT, not upsert.
GRANT UPDATE (last_frame_index, deck_version, slides_visited, slides_completed_at)
  ON public.lesson_view_state TO authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_view_state FROM anon, authenticated;

COMMIT;

-- ══ FOUNDER PASTE 3 — lesson_family_status (planning amendment 2) ══════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_family_status (
  -- The registry's family key, e.g. 'l1-calc-moles-from-mass'. The generator
  -- itself is CODE; this row is only its serving status (§66-§67).
  family_key   text PRIMARY KEY,
  lesson_id    uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'draft',
  -- The admin who last moved it — ON DELETE SET NULL so the action record
  -- survives the account (erase_user does not need to know about this table:
  -- no name, no email, and the FK nulls itself).
  updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lesson_family_status_check CHECK (status IN ('draft','approved','disabled')),
  CONSTRAINT lesson_family_status_key_shape CHECK (family_key ~ '^[a-z0-9-]{3,80}$')
);

CREATE INDEX IF NOT EXISTS lesson_family_status_lesson_idx
  ON public.lesson_family_status (lesson_id);

CREATE TRIGGER touch_lesson_family_status
  BEFORE UPDATE ON public.lesson_family_status
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.lesson_family_status ENABLE ROW LEVEL SECURITY;

-- ⚠ SAME NO-CLIENT-GRANTS PATTERN AS lesson_decks. Approval is admin tooling
-- behind assertAdmin() + the service-role client. A student never needs to
-- know WHY a family is absent from their ten — absence is the whole message.
-- The absence of a student "approved-only read" here is deliberate: the
-- practice engine filters server-side, so granting a client SELECT would only
-- leak the draft/disabled inventory.

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.lesson_family_status FROM anon, authenticated;

COMMIT;

-- ══ FOUNDER PASTE 4 — structure + privilege verification ═══════════════════
-- Expected output of each SELECT is stated in the comment above it.
-- All three tables, RLS enabled — EXPECT exactly 3 rows, relrowsecurity = t:
SELECT relname, relrowsecurity
  FROM pg_class
 WHERE relname IN ('lesson_decks','lesson_view_state','lesson_family_status')
 ORDER BY relname;
-- Dangerous privileges absent — EXPECT ZERO rows:
SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name IN ('lesson_decks','lesson_view_state','lesson_family_status')
   AND grantee IN ('anon','authenticated')
   AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- lesson_decks and lesson_family_status have NO client grants at all —
-- EXPECT ZERO rows:
SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_name IN ('lesson_decks','lesson_family_status')
   AND grantee IN ('anon','authenticated');
-- view-state UPDATE is column-scoped — EXPECT exactly these four rows, in
-- this order, and NEITHER user_id NOR lesson_id among them:
--   deck_version · last_frame_index · slides_completed_at · slides_visited
SELECT column_name
  FROM information_schema.column_privileges
 WHERE table_name = 'lesson_view_state' AND grantee = 'authenticated'
   AND privilege_type = 'UPDATE'
 ORDER BY column_name;

-- ══ FOUNDER PASTE 5 — one-published-per-lesson bites, with its control ══════
-- A DO block: traps the EXPECTED unique-violation and reports it as a PASS
-- NOTICE; any other outcome raises. Probe rows are deleted by captured id
-- inside the block. Uses the live L1 lesson row as the FK target; both probe
-- rows are 'ready'/'published' registry rows, invisible to students, gone by
-- the block's end.
DO $$
DECLARE
  l1 uuid;
  probe1 uuid; probe2 uuid; probe3 uuid;
  hit boolean := false;
BEGIN
  SELECT id INTO l1 FROM public.lessons WHERE slug = 'definitions-formulae-and-the-mole';
  IF l1 IS NULL THEN RAISE EXCEPTION 'preflight: L1 row not found'; END IF;

  INSERT INTO public.lesson_decks (lesson_id, version, status, deck_bucket_path, slide_count, frame_count)
  VALUES (l1, 9001, 'published', 'lessons/probe/deck/v9001', 1, 1)
  RETURNING id INTO probe1;

  BEGIN
    INSERT INTO public.lesson_decks (lesson_id, version, status, deck_bucket_path, slide_count, frame_count)
    VALUES (l1, 9002, 'published', 'lessons/probe/deck/v9002', 1, 1)
    RETURNING id INTO probe2;
  EXCEPTION WHEN unique_violation THEN
    hit := true;
    RAISE NOTICE 'PASS — second published deck refused by the partial unique index (23505, the expected red)';
  END;
  IF NOT hit THEN
    RAISE EXCEPTION 'FAIL — a second published deck was ACCEPTED for one lesson';
  END IF;

  -- CONTROL: the same insert with status=ready SUCCEEDS, proving the refusal
  -- above came from the one-published index and not from something else.
  INSERT INTO public.lesson_decks (lesson_id, version, status)
  VALUES (l1, 9002, 'ready')
  RETURNING id INTO probe3;
  RAISE NOTICE 'PASS — control: a second READY version inserts cleanly';

  DELETE FROM public.lesson_decks WHERE id IN (probe1, probe3);
  RAISE NOTICE 'cleanup: probe decks removed by captured id';
END $$;
-- EXPECT three NOTICEs: PASS (refused) · PASS (control) · cleanup.
-- Post-check — EXPECT ZERO rows:
SELECT id, version, status FROM public.lesson_decks WHERE version IN (9001, 9002);

-- ══ FOUNDER PASTE 6 — family-status CHECK bites, with its control ═══════════
DO $$
DECLARE
  l1 uuid; hit boolean := false;
BEGIN
  SELECT id INTO l1 FROM public.lessons WHERE slug = 'definitions-formulae-and-the-mole';

  BEGIN
    INSERT INTO public.lesson_family_status (family_key, lesson_id, status)
    VALUES ('probe-illegal-status', l1, 'published');  -- not one of the three
  EXCEPTION WHEN check_violation THEN
    hit := true;
    RAISE NOTICE 'PASS — an illegal status is refused by the CHECK (23514, the expected red)';
  END;
  IF NOT hit THEN RAISE EXCEPTION 'FAIL — an illegal family status was ACCEPTED'; END IF;

  -- CONTROL: a legal status inserts, then is removed by its key.
  INSERT INTO public.lesson_family_status (family_key, lesson_id, status)
  VALUES ('probe-legal-status', l1, 'approved');
  RAISE NOTICE 'PASS — control: a legal status inserts cleanly';
  DELETE FROM public.lesson_family_status WHERE family_key IN ('probe-legal-status','probe-illegal-status');
  RAISE NOTICE 'cleanup: probe status rows removed by key';
END $$;
-- EXPECT three NOTICEs. Post-check — EXPECT ZERO rows:
SELECT family_key FROM public.lesson_family_status WHERE family_key LIKE 'probe-%';

-- ══ SESSION-RUN (mine, not founder pastes) ══════════════════════════════════
-- SR-1  As authenticated STUDENT A (probe user on @example.test, admin-API
--       created, cleaned by captured id): INSERT own view-state row → ok;
--       UPDATE own last_frame_index → ok; UPDATE naming user_id → 42501;
--       SELECT student B's row → zero rows; CONTROL: service-role SELECT sees
--       both students' rows, so "zero" meant filtered, not empty.
-- SR-2  loadStatuses()/saveStatus() round-trip through the TABLE (not the
--       JSON fallback): save 'approved' for one family, read it back, confirm
--       the server log shows NO fallback warning; then delete the probe row
--       by family_key.
