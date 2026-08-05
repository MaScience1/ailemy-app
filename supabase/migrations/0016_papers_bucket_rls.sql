-- ============================================================================
-- 0016_papers_bucket_rls.sql
-- ----------------------------------------------------------------------------
-- Explicit Row Level Security for the public "papers" Storage bucket.
--
-- The bucket was created by hand in Supabase Studio and has never had a policy
-- of its own. Reads work because the bucket is public; writes are blocked only
-- because no permissive INSERT policy happens to exist, and RLS denies by
-- default. That is the right OUTCOME reached by accident — one careless
-- permissive policy added later for some other bucket, without a bucket_id
-- clause, would silently open this one to anonymous writes.
--
-- This migration denies anonymous writes explicitly, using RESTRICTIVE policies
-- rather than relying on the absence of a permissive one.
--
-- NO SELECT POLICY IS CREATED, deliberately. Past papers stay free and ungated
-- without one: the bucket is public, and public CDN reads
-- (/storage/v1/object/public/papers/...) do not consult RLS at all. Adding a
-- permissive SELECT would buy nothing for reading and would additionally grant
-- anon the ability to LIST the bucket — enumerating keys for draft, coming_soon
-- and archived papers whose ROWS past_papers RLS deliberately hides. Reads work;
-- enumeration should not.
--
-- WHY RESTRICTIVE AND NOT JUST "no policy": Postgres has no "deny" policy.
-- Permissive policies are OR-ed, so any future permissive policy that forgets a
-- bucket_id clause grants access to every bucket including this one. RESTRICTIVE
-- policies are AND-ed with the result, so they hold regardless of what is added
-- later. They are scoped to `anon` and to bucket_id = 'papers', so no other
-- role and no other bucket is affected — the cohort-materials policies from
-- 0009/0013 are untouched.
--
-- THE NEW UPLOAD FLOW IS UNAFFECTED. Admin uploads go browser -> Storage using
-- a signed upload URL minted server-side by the service role. Signed uploads are
-- authorised by the token, not by the caller's RLS. Verified against this
-- database before writing this migration: minting with the service role and then
-- PUTting with ONLY the anon key + token returned HTTP 200. The service role
-- bypasses RLS entirely in any case.
--
-- Safe to re-run: every policy is dropped before being created.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. No SELECT policy — see the header. Public reads are served by the public
--    CDN path, which bypasses RLS; a permissive SELECT would only add bucket
--    LISTING for anon. The DROP is here so that an earlier draft of this file,
--    if it was ever applied, is undone rather than left behind.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "papers_public_read" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 2. No anonymous writes. RESTRICTIVE, so these hold even if a permissive
--    policy is added later without a bucket_id clause.
--
--    Read each as: "for an anon write, the row must NOT be in the papers
--    bucket." Every other bucket passes unaffected.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "papers_no_anon_insert" ON storage.objects;
CREATE POLICY "papers_no_anon_insert"
  ON storage.objects AS RESTRICTIVE FOR INSERT
  TO anon
  WITH CHECK (bucket_id <> 'papers');

DROP POLICY IF EXISTS "papers_no_anon_update" ON storage.objects;
CREATE POLICY "papers_no_anon_update"
  ON storage.objects AS RESTRICTIVE FOR UPDATE
  TO anon
  USING (bucket_id <> 'papers')
  WITH CHECK (bucket_id <> 'papers');

DROP POLICY IF EXISTS "papers_no_anon_delete" ON storage.objects;
CREATE POLICY "papers_no_anon_delete"
  ON storage.objects AS RESTRICTIVE FOR DELETE
  TO anon
  USING (bucket_id <> 'papers');

COMMIT;


-- ============================================================================
-- VERIFICATION — read-only. Run AFTER applying.
-- ============================================================================

-- (a) Exactly THREE papers_* policies exist, all restrictive, all on writes.
--     There must be no papers_public_read row here.
SELECT policyname, cmd, permissive, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'papers_%'
ORDER BY policyname;

-- (b) Nothing else on storage.objects changed. Compare this list against the
--     same query run BEFORE applying — the three rows above should be the only
--     additions, and the 0009/0013 cohort policies must all remain.
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- (c) The bucket itself is untouched and still public.
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'papers';


-- ============================================================================
-- ORPHANED OBJECTS — manual sweep
-- ----------------------------------------------------------------------------
-- The new upload flow writes the PDF to Storage BEFORE the form is submitted,
-- so abandoning the form after a successful upload strands the object. No
-- cleanup job exists yet; this is the query to find them by hand.
--
-- STORAGE PATH PATTERN:
--     papers/<uuid>/<kind>-<epoch_ms>.pdf
--   where <uuid>  is the past_papers row id on edit, or a freshly minted v4
--                 UUID on create (which then becomes the row id), and
--         <kind>  is one of: paper | markscheme | examiner-report
--   e.g. papers/8f3a1c22-0000-4444-9999-abcdefabcdef/markscheme-1785959828840.pdf
--
-- Objects are stored with the leading "papers/" segment INSIDE the key as well
-- as being in the papers bucket, so name LIKE 'papers/%' is correct.
-- ============================================================================

-- Every object in the bucket that no past_papers row references.
-- Check the age before deleting: a row uploaded seconds ago may belong to a
-- form the admin has not submitted yet.
--
-- SELECT o.name,
--        o.created_at,
--        pg_size_pretty(COALESCE((o.metadata->>'size')::bigint, 0)) AS size
-- FROM storage.objects o
-- WHERE o.bucket_id = 'papers'
--   AND NOT EXISTS (
--     SELECT 1 FROM public.past_papers p
--     WHERE o.name IN (p.paper_pdf_path,
--                      p.markscheme_pdf_path,
--                      p.examiner_report_pdf_path)
--   )
--   AND o.created_at < now() - interval '1 day'
-- ORDER BY o.created_at;
