-- ============================================================================
-- _PROPOSED_lesson_decks_and_view_state.sql
-- ----------------------------------------------------------------------------
-- ⚠ PROPOSED — NOT APPLIED, NOT NUMBERED. Numbers come from the planning chat
-- only. Written 2026-08-22 during the feat/lesson-player overnight build;
-- parked per the overnight ruling. Two sections, one paste each (the SQL
-- Editor drops trailing sections of long pastes — split when applying).
--
-- WHAT THE APP DOES TODAY WITHOUT THIS, AND WHAT CHANGES WHEN IT LANDS:
--   deck registry   today: lessons.deck_path (0008) is the only record — the
--                   published pointer with no version history or status.
--                   after: lesson_decks holds the §9 lifecycle
--                   (uploaded → processing → ready → published → superseded /
--                   failed) and version history; deck_path REMAINS the serving
--                   pointer the student page reads. One write path (the admin
--                   publish action) updates both in one transaction.
--   view state      today: resume + slides-visited live in localStorage only,
--                   and the player says so. after: lesson_view_state is the
--                   §25/§26 record; the player's existing persist callback
--                   posts a server action instead of only writing
--                   localStorage. Wiring point marked in LessonPlayer.tsx.
--
-- ⚠ ERASURE: neither table carries a name, an email, or free text about a
-- person. Both key on auth.users(id) ON DELETE CASCADE. erase_user v3's
-- receipt should still COUNT them — the companion practice file's §E extends
-- the function for all four new tables in one edit.
-- ============================================================================

-- ══ SECTION 1 — lesson_decks ═══════════════════════════════════════════════
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

-- ══ SECTION 2 — lesson_view_state ══════════════════════════════════════════
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

-- ══ VERIFICATION (run after applying; every letter must be run) ════════════
-- (a) both tables exist with RLS enabled — expect rowsecurity = true twice:
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE relname IN ('lesson_decks','lesson_view_state');
-- (b) the three dangerous privileges are absent — expect ZERO rows:
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema='public'
--      AND table_name IN ('lesson_decks','lesson_view_state')
--      AND grantee IN ('anon','authenticated')
--      AND privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES');
-- (c) lesson_decks has NO client grants at all — expect ZERO rows:
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--    WHERE table_name='lesson_decks' AND grantee IN ('anon','authenticated');
-- (d) view-state UPDATE is column-scoped — expect exactly the four columns,
--     WITHOUT user_id or lesson_id:
--   SELECT column_name FROM information_schema.column_privileges
--    WHERE table_name='lesson_view_state' AND grantee='authenticated'
--      AND privilege_type='UPDATE' ORDER BY column_name;
-- (e) one-published-per-lesson bites — as service role, insert two 'published'
--     rows for one lesson id; the second must fail with 23505; DELETE the
--     probe rows by captured id afterwards and re-count.
-- (f) CONTROL for (e): the same second insert with status='ready' SUCCEEDS
--     (then delete it) — proving (e) failed on the partial index, not on
--     something else.
-- (g) as an authenticated student: INSERT own view-state row → ok; UPDATE own
--     last_frame_index → ok; UPDATE naming user_id → 42501; SELECT another
--     student's row → zero rows; and the (l)-style control that a service-role
--     SELECT sees both students' rows, so "zero" meant "filtered", not
--     "empty table".
