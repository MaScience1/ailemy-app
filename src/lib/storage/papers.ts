/**
 * Public Supabase Storage URL construction for the "papers" bucket.
 *
 * Bucket is created manually in Supabase Studio (public). Files are uploaded
 * by hand for now — the admin upload UI ships in a later session.
 *
 * URL pattern: `${SUPABASE_URL}/storage/v1/object/public/papers/${path}`.
 * Safe to call from server OR client code (uses NEXT_PUBLIC_ env var).
 */

const BUCKET = "papers";

export function getPaperPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    // Should never happen in any environment that boots — Supabase URL is
    // required by the existing auth + catalogue layer. Logged for surfaces
    // where the env is misconfigured.
    console.error(
      "[storage/papers] NEXT_PUBLIC_SUPABASE_URL missing; cannot build paper URL",
    );
    return null;
  }

  // Strip any accidental leading slash so we don't get a double-slash in the URL.
  const clean = path.startsWith("/") ? path.slice(1) : path;
  const baseTrimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${baseTrimmed}/storage/v1/object/public/${BUCKET}/${clean}`;
}
