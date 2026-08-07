-- ============================================================================
-- 0023_confirm_parent_links.sql
-- Ailemy — close the self-declared parent link.
--
-- ⚠ APPLIED BY HAND TO PRODUCTION 2026-08-07 19:57. DO NOT RE-RUN AGAINST
-- PRODUCTION — this file exists so a rebuild from migrations matches what is
-- already live. It is written to be re-runnable (IF NOT EXISTS throughout, and
-- every policy dropped before it is created), so re-running is harmless, but
-- there is nothing here left to apply.
--
-- Verified live after application: the three columns are present, five policies
-- exist on the affected tables, and UPDATE is granted on exactly
-- (status, confirmed_at).
--
-- Section 0's pre-flight and section 3's backfill guidance are retained as
-- written. They are now a record of the decision taken at apply time, not
-- instructions to follow again.
--
-- THE HOLE. public.parent_students is a bare link table:
--
--   parent_students_insert_own  FOR INSERT
--     WITH CHECK (auth.uid() = parent_id OR auth.uid() = student_id)   0001:255
--   GRANT SELECT, INSERT ON public.parent_students TO authenticated     0003:55
--
-- The OR means any signed-in user satisfies the check by inserting
-- (parent_id = their own uid, student_id = ANYONE). There is no confirmation
-- step, no acceptance, and nothing the victim can do. Two policies then read
-- straight off that unverified row:
--
--   profiles_parent_read_student   0001:249  -> the student's whole profile row
--   progress_parent_read_linked    0001:266  -> the student's lesson progress
--
-- So the attack is: insert one row, then read a stranger's name, age band,
-- city, school, timezone, curriculum and every lesson they have watched. One
-- INSERT, no rate limit, no audit trail. Adding progress data to what hangs off
-- this link is what makes it worth fixing FIRST.
--
-- THE FIX. A link becomes readable only once the OTHER party confirms it.
-- Either side may propose; only the counterparty may accept. Until then the
-- row exists but grants nothing.
--
-- SCOPE. Two columns, three policies replaced, one column-scoped grant. No
-- table is created or dropped. No existing row is deleted.
-- ============================================================================

SET lock_timeout = '5s';

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. PRE-FLIGHT — read this before choosing the backfill in section 3.
-- ---------------------------------------------------------------------------
-- Neither codebase writes to this table: `grep -rn parent_students src/` finds
-- nothing in ailemy-app or ailemy-mobile, and no UI creates a link. The table
-- is therefore expected to be EMPTY, and section 3 assumes that.
--
-- CONFIRM IT BEFORE APPLYING (anon cannot read this table, so it needs the SQL
-- editor):
--
--   SELECT count(*) AS total,
--          count(*) FILTER (WHERE created_at < now() - interval '1 day') AS older_than_a_day
--   FROM public.parent_students;
--
-- If that returns 0, section 3 is a no-op and there is nothing to decide.
-- If it returns rows, STOP and read section 3 — the safe default there denies
-- access to every existing link, which is correct for security and will cut off
-- any legitimate parent who already had access.

-- ---------------------------------------------------------------------------
-- 1. STATE COLUMNS
-- ---------------------------------------------------------------------------
-- requested_by records WHO proposed the link. It is the whole mechanism: the
-- confirm policy checks that the confirmer is NOT the proposer, which is what
-- makes self-approval impossible. Without it, an attacker could insert and
-- immediately confirm their own row.
ALTER TABLE public.parent_students
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.parent_students
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'parent_students_status_check'
      AND conrelid = 'public.parent_students'::regclass
  ) THEN
    ALTER TABLE public.parent_students
      ADD CONSTRAINT parent_students_status_check
      CHECK (status IN ('pending', 'confirmed', 'rejected'));
  END IF;
END $$;

ALTER TABLE public.parent_students
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

COMMENT ON COLUMN public.parent_students.requested_by IS
  'Who proposed the link. The confirm policy requires the confirmer to be someone else — this column is what prevents self-approval.';
COMMENT ON COLUMN public.parent_students.status IS
  'pending until the counterparty confirms. Only confirmed links grant any read access; see profiles_parent_read_student and progress_parent_read_linked.';

-- ---------------------------------------------------------------------------
-- 2. POLICIES
-- ---------------------------------------------------------------------------
-- Postgres has no CREATE POLICY IF NOT EXISTS, so each is dropped first and
-- this file stays re-runnable.
--
-- All are scoped TO authenticated. An unscoped policy applies to PUBLIC, and an
-- anon caller evaluating a subquery against a table it has no SELECT on raises
-- a permission error rather than returning false — the fault 0013 had to repair
-- on storage.objects, where one such policy poisoned every anon read.

-- --- 2a. Propose ------------------------------------------------------------
-- Either party may propose, but only as pending, and only in their own name.
-- requested_by = auth.uid() is enforced here so it cannot be forged to make the
-- row look like the counterparty proposed it (which would let the attacker
-- confirm it themselves under 2b).
DROP POLICY IF EXISTS parent_students_insert_own ON public.parent_students;
CREATE POLICY parent_students_propose
  ON public.parent_students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = parent_id OR auth.uid() = student_id)
    AND requested_by = auth.uid()
    AND status = 'pending'
  );

-- --- 2b. Confirm or reject --------------------------------------------------
-- Only the party who did NOT propose it may move it out of pending. This is the
-- sentence that closes the hole.
--
-- IS DISTINCT FROM, not <>: requested_by is nullable, and `NULL <> uuid` is
-- NULL, which a policy treats as false — that would make legacy rows with a
-- null requested_by unconfirmable by anyone. It also means such rows can never
-- be confirmed, which is the correct default for links of unknown provenance.
DROP POLICY IF EXISTS parent_students_confirm ON public.parent_students;
CREATE POLICY parent_students_confirm
  ON public.parent_students
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND (auth.uid() = parent_id OR auth.uid() = student_id)
    AND requested_by IS DISTINCT FROM auth.uid()
  )
  WITH CHECK (
    status IN ('confirmed', 'rejected')
    AND (auth.uid() = parent_id OR auth.uid() = student_id)
    AND requested_by IS DISTINCT FROM auth.uid()
  );

-- --- 2c. Read ---------------------------------------------------------------
-- Both parties can still see a PENDING link — the student has to be able to see
-- a request in order to accept or reject it. Seeing the link reveals only that
-- someone claims a relationship; it grants no access to profile or progress
-- rows, which is what section 4 enforces.
DROP POLICY IF EXISTS parent_students_read_own ON public.parent_students;
CREATE POLICY parent_students_read_own
  ON public.parent_students
  FOR SELECT
  TO authenticated
  USING (auth.uid() = parent_id OR auth.uid() = student_id);

-- --- 2d. Grant --------------------------------------------------------------
-- COLUMN-SCOPED. A table-wide UPDATE would let a confirmer rewrite parent_id or
-- student_id and repoint the link at a third party — RLS filters rows, never
-- columns, so the policy above cannot prevent that on its own.
GRANT UPDATE (status, confirmed_at) ON public.parent_students TO authenticated;

-- No DELETE grant, matching the rest of this schema: a rejected link stays as
-- an auditable record rather than vanishing.

-- ---------------------------------------------------------------------------
-- 3. EXISTING ROWS
-- ---------------------------------------------------------------------------
-- Every pre-existing row keeps status='pending' from the column default, so it
-- grants nothing from the moment this migration lands. That is deliberate: no
-- application code has ever written this table, so any row in it is either test
-- data or forged, and there is no way to tell which from the data alone.
--
-- If the pre-flight count in section 0 shows legitimate links that must keep
-- working, confirm them EXPLICITLY and individually rather than in bulk:
--
--   UPDATE public.parent_students
--      SET status = 'confirmed', confirmed_at = now()
--    WHERE parent_id = '<uuid>' AND student_id = '<uuid>';
--
-- There is deliberately no blanket `UPDATE ... SET status='confirmed'` here.
-- That statement would confirm any forged row along with the real ones and
-- silently re-open the hole this migration exists to close.

-- ---------------------------------------------------------------------------
-- 4. THE CONSUMING POLICIES
-- ---------------------------------------------------------------------------
-- Without this section the migration achieves nothing: the two policies below
-- are what actually read off the link, and until they require 'confirmed' a
-- pending row still grants full access.

DROP POLICY IF EXISTS profiles_parent_read_student ON public.profiles;
CREATE POLICY profiles_parent_read_student
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT ps.student_id FROM public.parent_students ps
      WHERE ps.parent_id = auth.uid() AND ps.status = 'confirmed'
    )
  );

DROP POLICY IF EXISTS progress_parent_read_linked ON public.progress;
CREATE POLICY progress_parent_read_linked
  ON public.progress
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      WHERE ps.parent_id = auth.uid() AND ps.status = 'confirmed'
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 5. POST-APPLY VERIFICATION (read-only)
-- ============================================================================
-- The three policies exist and are scoped to authenticated:
--   SELECT polname, polroles::regrole[], pg_get_expr(polqual, polrelid) AS using_expr
--     FROM pg_policy WHERE polrelid = 'public.parent_students'::regclass;
--
-- Both consuming policies now require confirmed:
--   SELECT polrelid::regclass, polname, pg_get_expr(polqual, polrelid)
--     FROM pg_policy
--    WHERE polname IN ('profiles_parent_read_student','progress_parent_read_linked');
--
-- UPDATE is granted on exactly two columns and nothing else:
--   SELECT column_name FROM information_schema.column_privileges
--    WHERE table_name = 'parent_students' AND grantee = 'authenticated'
--      AND privilege_type = 'UPDATE' ORDER BY column_name;      -- expect: confirmed_at, status
--
-- No link grants access yet:
--   SELECT status, count(*) FROM public.parent_students GROUP BY status;
--
-- THE ATTACK, RE-RUN. As any signed-in user, against a student who is not
-- yours: insert a link, then try to read them. The insert should succeed as
-- pending; both reads should return zero rows.
--   INSERT INTO public.parent_students (parent_id, student_id, requested_by, status)
--   VALUES (auth.uid(), '<victim uuid>', auth.uid(), 'pending');
--   SELECT count(*) FROM public.profiles WHERE id = '<victim uuid>';  -- expect 0
--   SELECT count(*) FROM public.progress WHERE student_id = '<victim uuid>'; -- expect 0
--   UPDATE public.parent_students SET status='confirmed'
--    WHERE student_id='<victim uuid>';                                -- expect 0 rows

-- ============================================================================
-- 6. ROLLBACK
-- ============================================================================
--   BEGIN;
--   DROP POLICY IF EXISTS parent_students_propose ON public.parent_students;
--   DROP POLICY IF EXISTS parent_students_confirm ON public.parent_students;
--   REVOKE UPDATE (status, confirmed_at) ON public.parent_students FROM authenticated;
--   CREATE POLICY parent_students_insert_own ON public.parent_students
--     FOR INSERT WITH CHECK (auth.uid() = parent_id OR auth.uid() = student_id);
--   DROP POLICY IF EXISTS profiles_parent_read_student ON public.profiles;
--   CREATE POLICY profiles_parent_read_student ON public.profiles FOR SELECT
--     USING (id IN (SELECT student_id FROM public.parent_students WHERE parent_id = auth.uid()));
--   DROP POLICY IF EXISTS progress_parent_read_linked ON public.progress;
--   CREATE POLICY progress_parent_read_linked ON public.progress FOR SELECT
--     USING (student_id IN (SELECT student_id FROM public.parent_students WHERE parent_id = auth.uid()));
--   ALTER TABLE public.parent_students
--     DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS confirmed_at,
--     DROP COLUMN IF EXISTS requested_by;
--   COMMIT;
--   NOTIFY pgrst, 'reload schema';
--
-- Rolling back RE-OPENS the disclosure path. Locking is trivial either way:
-- both ADD COLUMNs use non-volatile defaults and are catalogue-only, and policy
-- swaps take a brief ACCESS EXCLUSIVE without touching the heap.

-- ============================================================================
-- 7. ASSUMPTIONS
--
-- 1. NO PARENT UI EXISTS, so nothing breaks by making links pending. Verified:
--    zero references to parent_students in either codebase's src/. When a
--    parent-facing flow is built it needs a request screen and an accept
--    screen; this migration defines the states those screens drive.
--
-- 2. THE STUDENT IS THE PARTY WORTH PROTECTING. Either side may propose, but
--    the common real flow is a parent requesting access and a student granting
--    it. If parents should instead be invited by the student only, drop the
--    `auth.uid() = parent_id` arm from 2a.
--
-- 3. REJECTED IS TERMINAL. Nothing here lets a rejected link return to pending;
--    re-requesting would need a delete-and-reinsert, and there is no DELETE
--    grant. If re-requesting matters, add an explicit policy for
--    rejected -> pending rather than granting DELETE.
-- ============================================================================
