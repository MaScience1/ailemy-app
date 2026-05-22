-- ============================================================================
-- 0003_grant_table_privileges.sql
-- ----------------------------------------------------------------------------
-- Grants table privileges to the anon and authenticated roles to match the
-- RLS policies created in 0001_initial_schema.sql.
--
-- Background: Supabase's `anon` and `authenticated` roles only get auto-grants
-- on tables created through the Studio UI. Tables created via raw SQL (like
-- our 0001 migration) need explicit GRANTs — without them, every query fails
-- with `permission denied for table <name>` BEFORE RLS even gets a chance to
-- evaluate. RLS layers on top of grants; it cannot widen them.
--
-- Symptom this fix addresses: the dashboard couldn't read profiles.full_name
-- and silently fell back to displaying the user's email, because the
-- authenticated role had no SELECT privilege on public.profiles.
--
-- All GRANTs are scoped to match the RLS policy intent — never broader than
-- what the policies already allow. RLS is still the source of truth for
-- which ROWS each role can touch; these grants gate which OPERATIONS the
-- role can attempt in the first place.
--
-- Safe to re-run: GRANT is idempotent in Postgres.
-- ============================================================================

-- Schema usage. Usually granted by Supabase already, but harmless to repeat.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catalogue tables — public read for anyone (matches catalogue_public_read_*
-- policies which use `USING (true)`).
-- ---------------------------------------------------------------------------
GRANT SELECT ON
  public.curricula,
  public.subjects,
  public.courses,
  public.units,
  public.topics,
  public.spec_points,
  public.lessons,
  public.lesson_spec_points
TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles — authenticated users read/insert/update their own row. The auth
-- trigger handle_new_user() runs as SECURITY DEFINER (postgres role) so the
-- INSERT grant here is for any future client-side profile creates; row
-- restriction is enforced by profiles_insert_own (auth.uid() = id).
-- No DELETE: profiles cascade from auth.users(id) instead.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- Parent ↔ student links. RLS allows either side to read and insert.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT ON public.parent_students TO authenticated;

-- ---------------------------------------------------------------------------
-- Student enrolments. RLS allows the student to read, insert, and unenrol.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, DELETE ON public.student_courses TO authenticated;

-- ---------------------------------------------------------------------------
-- Activity tables — `progress`, generated questions, answers, AI marks, and
-- chatbox interactions all use `FOR ALL` policies for the owning student in
-- 0001. Grant the full CRUD set to authenticated; RLS restricts to own rows.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_questions   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_answers       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_marks              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbox_interactions  TO authenticated;

-- ---------------------------------------------------------------------------
-- Waitlist — anyone (signed in or not) can submit; nobody but the service
-- role can read. The waitlist_public_insert policy permits INSERT with
-- CHECK (true).
-- ---------------------------------------------------------------------------
GRANT INSERT ON public.waitlist TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Subscriptions — read-only for the owning user. Writes come from Stripe
-- webhooks running under the service role (which bypasses RLS and grants).
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.subscriptions TO authenticated;
