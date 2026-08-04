-- ============================================================================
-- 0013_fix_cohort_materials_policy.sql
-- ----------------------------------------------------------------------------
-- Fixes a fault introduced by 0009: after that migration was applied, EVERY
-- anonymous request to the non-public Storage endpoints started failing with
--
--     403 {"code":"AccessDenied",
--          "message":"permission denied for table cohort_enrolments"}
--
-- for EVERY bucket -- including the public "papers" bucket, which has nothing
-- to do with cohorts.
--
-- CAUSE: 0009's "enrolled read materials" policy queries public.cohort_enrolments
-- DIRECTLY inside the policy expression, and was created with no TO clause, so
-- it applies to every role including anon. RLS policy expressions are evaluated
-- with the CALLING role's privileges, and anon holds no SELECT on
-- cohort_enrolments (deliberately -- it is enrolment PII). Postgres therefore
-- raises a permission error rather than simply returning false. Because all
-- SELECT policies on storage.objects are OR-evaluated together, that one
-- erroring policy poisons every anon read of the whole table.
--
-- FIX: scope the policy to `authenticated`. This changes no access semantics --
-- both arms of the USING clause already require a session (is_staff() fails
-- closed on a NULL auth.uid(), and an enrolment row is keyed to auth.uid()), so
-- anon could never have satisfied it. It simply stops anon evaluating a policy
-- it can never pass, which is what was raising the error.
--
-- WHY NOT the alternative: the direct subquery could instead be wrapped in a
-- SECURITY DEFINER helper, which is exactly what is_enrolled() at 0009:80 does
-- with the identical query so that callers need no table grant. That also works,
-- but it adds a database object to paper over a policy that should have been
-- role-scoped in the first place. TO authenticated is the smaller, more honest
-- fix. If a helper is added later for other reasons, this policy can adopt it.
--
-- SCOPE: the other three storage policies from 0009 ("student uploads own
-- folder", "student reads own folder", "staff writes materials") are left
-- untouched. They also lack a TO clause, but they only reference is_staff(),
-- which is SECURITY DEFINER and carries Postgres's default PUBLIC EXECUTE
-- grant, so they evaluate harmlessly for anon rather than erroring. They are
-- not currently broken. See the note at the foot of this file for the one
-- scenario in which that would change.
--
-- Drop-and-recreate so the migration is re-runnable, matching 0007/0010/0011.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "enrolled read materials" ON storage.objects;

CREATE POLICY "enrolled read materials"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cohort-materials'
    AND (
      public.is_staff()
      OR EXISTS (
        SELECT 1 FROM public.cohort_enrolments e
        WHERE e.user_id = auth.uid()
          AND e.status IN ('paid', 'active', 'completed')
      )
    )
  );

COMMIT;

-- ============================================================================
-- FOLLOW-UP, NOT DONE HERE
-- ----------------------------------------------------------------------------
-- The three remaining 0009 storage policies survive anon evaluation only
-- because CREATE FUNCTION grants EXECUTE on public.is_staff() to PUBLIC by
-- default. A routine hardening pass --
--
--     REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
--
-- -- would reintroduce exactly the failure this migration fixes, via is_staff()
-- instead of cohort_enrolments, and would again take anon reads of the public
-- "papers" bucket down with it. If that revoke is ever performed, add
-- `TO authenticated` to those three policies in the same migration.
-- ============================================================================
