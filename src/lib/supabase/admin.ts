import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely — used only by admin
 * server actions and the admin catalogue queries in src/lib/admin/*.
 *
 * NEVER import this from a Client Component, a shared component, or any file
 * that is transitively imported by the browser bundle. The `server-only`
 * import at the top will make Next.js throw at build time if that happens.
 *
 * The env var (SUPABASE_SERVICE_ROLE_KEY) is intentionally NOT prefixed
 * NEXT_PUBLIC_ so it never ships to the client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for admin client");
  }
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin client — set it in .env.local (server-only, do NOT prefix NEXT_PUBLIC_)",
    );
  }
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
