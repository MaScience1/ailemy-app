import "server-only";

import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Admin email is read from a server-only env var. Kept out of NEXT_PUBLIC_*
 * so it never ships in the client bundle; the browser never needs to know
 * who the admin is.
 */
function getAdminEmail(): string {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    throw new Error(
      "ADMIN_EMAIL is not set. Add it to .env.local (server-only, do NOT prefix NEXT_PUBLIC_)",
    );
  }
  return email.trim().toLowerCase();
}

/**
 * Compare current session's email to ADMIN_EMAIL. Returns { ok, email }.
 * Case-insensitive on the local part (Supabase normalises for uniqueness
 * anyway; we normalise both sides to be safe).
 */
export async function getAdminStatus(): Promise<{
  ok: boolean;
  email: string | null;
}> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  if (!email) return { ok: false, email: null };
  return {
    ok: email.trim().toLowerCase() === getAdminEmail(),
    email,
  };
}

/**
 * MUST be the first line of every admin server action. Middleware gates
 * /admin/* pages, but server actions are directly invocable from any client
 * that guesses the endpoint — middleware is NOT sufficient. This helper is
 * the sole authority on who may write.
 *
 * Throws on failure so the action returns an error, does NOT return silently.
 */
export async function assertAdmin(): Promise<void> {
  const { ok, email } = await getAdminStatus();
  if (!ok) {
    // Deliberately vague message — don't leak whether the caller was signed
    // in as the wrong user vs. not signed in at all.
    throw new Error(
      `Not authorised${email ? "" : " (no session)"}`,
    );
  }
}
