-- ============================================================================
-- 0002_fix_handle_new_user.sql
-- ----------------------------------------------------------------------------
-- Hardens the auth.users -> public.profiles trigger so signup never fails on
-- bad or missing metadata.
--
-- Background: the original trigger cast `raw_user_meta_data->>'role'` to the
-- user_role enum BEFORE the COALESCE check ran. Any non-NULL value that
-- wasn't a valid enum member (empty string, wrong case, stray whitespace,
-- legacy value) blew up the INSERT, the trigger, and the whole auth signup —
-- surfacing as "Database error saving new user" in the client.
--
-- This patch:
--   * Reads role as text, validates against the enum's allowed values, and
--     falls back to 'student' for anything unrecognised (including NULL and
--     empty string).
--   * Trims and nullifies the full_name so empty input lands as NULL instead
--     of a blank string.
--   * Adds ON CONFLICT (id) DO NOTHING for idempotency on retry paths.
--   * Sets an explicit search_path on the SECURITY DEFINER function.
--   * Wraps the body in EXCEPTION ... RAISE WARNING so a future bug here
--     never blocks signup again — the user account is created, the profile
--     row is logged for manual backfill via Supabase Dashboard -> Logs.
--
-- The trigger itself (on_auth_user_created) is unchanged; only the function
-- body is replaced.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  meta_role text;
  safe_role user_role;
  safe_name text;
BEGIN
  -- Pull role from raw_user_meta_data as text. NULLIF collapses empty string
  -- to NULL so the membership check below treats "" the same as missing.
  meta_role := NULLIF(NEW.raw_user_meta_data->>'role', '');

  -- Only accept the four known enum values. Anything else — typos, casing,
  -- legacy roles, NULL — falls back to 'student'. NULL IN (...) evaluates
  -- to NULL which is not TRUE, so missing role naturally hits the ELSE.
  IF meta_role IN ('student', 'parent', 'teacher', 'school_admin') THEN
    safe_role := meta_role::user_role;
  ELSE
    safe_role := 'student'::user_role;
  END IF;

  -- Full name: trim whitespace, treat empty as NULL rather than ''.
  safe_name := NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), '');

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, safe_name, safe_role)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Last-resort safety net: never block auth signup on a profiles-insert
    -- failure. The user.id will exist in auth.users without a profile row;
    -- it can be backfilled manually after inspecting the warning in
    -- Supabase Dashboard -> Logs -> Postgres.
    RAISE WARNING 'handle_new_user failed for user %: % (SQLSTATE: %)',
      NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;
