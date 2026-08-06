-- ============================================================================
-- 0018_profiles_column_level_update.sql
-- ----------------------------------------------------------------------------
-- Narrow profiles' UPDATE privilege from the whole table to the columns a user
-- should legitimately edit.
--
-- THE HOLE. 0003:50 granted `SELECT, INSERT, UPDATE ON public.profiles TO
-- authenticated`, and 0017:403 restated it. Table-wide UPDATE means every
-- column of the row is writable. The profiles_update_own policy (0001:247)
-- restricts WHICH ROW — `auth.uid() = id` — and nothing else, because RLS
-- filters rows and never columns. A signed-in user can therefore write their
-- own:
--
--     role              → 'school_admin' / 'teacher'
--     founding_member   → true
--     plan              → any tier
--
-- with a single PostgREST PATCH against their own row. Both policy and grant
-- are satisfied; there is nothing left to stop it.
--
-- Latent rather than live TODAY: no policy or route consults profiles.role for
-- authorisation — staff identity is public.is_staff() from 0009, keyed on email
-- — so escalating role currently buys nothing. But dashboard/page.tsx already
-- SELECTs role, and this becomes a real privilege-escalation path the moment
-- any check starts trusting that column. 0017 flagged it and deliberately left
-- it out of scope as a behaviour change deserving its own migration. This is
-- that migration.
--
-- MECHANISM. Column-level GRANT, the same pattern 0017:377 used to keep
-- current_working_grade / predicted_grade / final_grade out of student hands.
-- Postgres checks the grant before RLS, so a column that is not granted cannot
-- be written by any policy.
--
-- SAFETY. Nothing in the application writes profiles — the only reference is a
-- SELECT of (full_name, role) in src/app/dashboard/page.tsx. Server-side
-- writes use service_role, whose ALL PRIVILEGES from 0014 this file does not
-- touch. updated_at stays correct because the touch_profiles trigger
-- (0001:314) maintains it BEFORE UPDATE, rather than the client sending it.
--
-- Additive and re-runnable: REVOKE of an already-absent privilege and GRANT of
-- an already-present one are both no-ops.
--
-- ⚠ ONE DELIBERATE OMISSION — `country`.
-- The column list below is exactly the one requested. It does NOT include
-- `country`, which the draft block in 0017:414 did include. country is
-- ordinary user-supplied profile data of the same kind as `city`, so leaving
-- it out means a user can no longer edit their own country. That is the safe
-- direction to err in and is easily reversed — add `country,` to the GRANT
-- below — but it is a decision, not an oversight, and is recorded here as one.
--
-- NOT ADDRESSED HERE. INSERT is still table-wide, so in principle a user could
-- create a row with role already set. That path is closed in practice: the row
-- is created at signup by handle_new_user (0002), a SECURITY DEFINER trigger
-- that whitelists the four enum values; `id` is the primary key referencing
-- auth.users, so a second insert collides; and authenticated holds no DELETE
-- on profiles, so the existing row cannot be removed to make room. Tightening
-- INSERT per column belongs in its own change if wanted.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VERIFICATION — RUN THIS BEFORE APPLYING
-- ----------------------------------------------------------------------------
-- Expect ONE row: authenticated / UPDATE. That is the table-wide grant being
-- removed. If it returns nothing, the hole is already closed and this migration
-- is a no-op.
--
--   SELECT grantee, privilege_type
--     FROM information_schema.table_privileges
--    WHERE table_schema = 'public'
--      AND table_name   = 'profiles'
--      AND grantee      = 'authenticated'
--      AND privilege_type = 'UPDATE';
--
-- And expect ZERO rows here — no column-level UPDATE grants exist yet:
--
--   SELECT column_name
--     FROM information_schema.column_privileges
--    WHERE table_schema = 'public'
--      AND table_name   = 'profiles'
--      AND grantee      = 'authenticated'
--      AND privilege_type = 'UPDATE'
--    ORDER BY column_name;
-- ----------------------------------------------------------------------------

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Remove the table-wide privilege
-- ----------------------------------------------------------------------------
-- Revoking at table level does NOT touch column-level grants — they are held
-- separately — so this is safe to run before the GRANT below and safe to
-- re-run afterwards without stripping what section 2 established.
REVOKE UPDATE ON public.profiles FROM authenticated;

-- ----------------------------------------------------------------------------
-- 2. Re-grant, per column
-- ----------------------------------------------------------------------------
-- Everything a user owns about their own presentation and study context.
GRANT UPDATE (
  full_name,
  age_band,
  gender,
  city,
  timezone,
  curriculum_id,
  school_name,
  language,
  region,
  theme_preference,
  notification_preferences
) ON public.profiles TO authenticated;

-- WITHHELD, and why each one:
--   id               primary key; writable = repointing the row at another user
--   role             authorisation-bearing
--   founding_member  entitlement-bearing
--   plan             billing-bearing
--   country          see the omission note in the header — decision, not slip
--   created_at       history
--   updated_at       maintained by the touch_profiles trigger (0001:314)
--
-- Staff and server-side writes are unaffected: service_role keeps ALL
-- PRIVILEGES from 0014 and bypasses RLS entirely.

COMMENT ON COLUMN public.profiles.role IS
  'Authorisation-bearing. NOT writable by authenticated (0018) — service_role only. Staff identity is public.is_staff(), not this column.';

COMMENT ON COLUMN public.profiles.founding_member IS
  'Entitlement-bearing. NOT writable by authenticated (0018) — service_role only.';

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICATION — RUN THIS AFTER APPLYING
-- ----------------------------------------------------------------------------
-- (a) The table-wide grant is gone. Expect ZERO rows.
--
--   SELECT grantee, privilege_type
--     FROM information_schema.table_privileges
--    WHERE table_schema = 'public'
--      AND table_name   = 'profiles'
--      AND grantee      = 'authenticated'
--      AND privilege_type = 'UPDATE';
--
-- (b) Exactly the eleven columns are updatable. Expect these and no others:
--     age_band, city, curriculum_id, full_name, gender, language,
--     notification_preferences, region, school_name, theme_preference, timezone
--
--   SELECT column_name
--     FROM information_schema.column_privileges
--    WHERE table_schema = 'public'
--      AND table_name   = 'profiles'
--      AND grantee      = 'authenticated'
--      AND privilege_type = 'UPDATE'
--    ORDER BY column_name;
--
-- (c) The sensitive columns are absent from that list. Expect ZERO rows.
--
--   SELECT column_name
--     FROM information_schema.column_privileges
--    WHERE table_schema = 'public'
--      AND table_name   = 'profiles'
--      AND grantee      = 'authenticated'
--      AND privilege_type = 'UPDATE'
--      AND column_name IN ('id','role','founding_member','plan','created_at','updated_at');
--
-- (d) SELECT and INSERT are untouched. Expect INSERT and SELECT, no UPDATE.
--
--   SELECT privilege_type
--     FROM information_schema.table_privileges
--    WHERE table_schema = 'public'
--      AND table_name   = 'profiles'
--      AND grantee      = 'authenticated'
--    ORDER BY privilege_type;
--
-- (e) End-to-end, as a signed-in user in the app (NOT the SQL editor, which
--     runs as postgres and bypasses all of this):
--       PATCH /rest/v1/profiles?id=eq.<own uuid>  {"role":"school_admin"}
--     -> expect 42501 permission denied for column role
--       PATCH /rest/v1/profiles?id=eq.<own uuid>  {"full_name":"Test"}
--     -> expect 204
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- ROLLBACK — restores the previous, wider privilege
-- ----------------------------------------------------------------------------
--   BEGIN;
--   REVOKE UPDATE ON public.profiles FROM authenticated;   -- clears the 11
--   GRANT  UPDATE ON public.profiles TO authenticated;     -- back to table-wide
--   COMMIT;
--
-- NOTE: the REVOKE above does not clear column-level grants; revoke those
-- explicitly if a true restoration matters:
--   REVOKE UPDATE (full_name, age_band, gender, city, timezone, curriculum_id,
--                  school_name, language, region, theme_preference,
--                  notification_preferences)
--     ON public.profiles FROM authenticated;
-- ----------------------------------------------------------------------------
