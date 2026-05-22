import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client. Use in Server Components, Server Actions,
 * and Route Handlers. Wires Supabase to Next's async cookies() store using
 * the non-deprecated getAll/setAll pattern.
 *
 * Note: setAll will throw in pure Server Component render contexts (Next.js
 * forbids cookie writes after streaming starts). We swallow that error — the
 * proxy refreshes the session on the next request anyway.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component context — writes are forbidden here.
            // The proxy (src/proxy.ts) handles session refresh on each request.
          }
        },
      },
    },
  );
}
