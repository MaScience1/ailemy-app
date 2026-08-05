import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * The minimum the site nav needs to know about the viewer.
 *
 * Deliberately NOT the Supabase user object. Only what the nav renders crosses
 * the server/client boundary, so no id, no tokens, no app_metadata end up in
 * the HTML of every marketing page.
 */
export type NavSession = { email: string } | null;

/**
 * Resolve the signed-in user for the site nav.
 *
 * cache() dedupes per request: SiteNav is rendered from five separate server
 * components, and without this a page that composes more than one of them
 * would make a separate getUser() call each time. Same reasoning as
 * getEditContext() in src/lib/admin/edit-mode.ts.
 *
 * FAILS OPEN TO SIGNED-OUT. A thrown auth error must render "Login", never a
 * 500 — the nav appears on every public marketing page, so an auth outage
 * should degrade the nav, not take the site down. getUser() also returns
 * { user: null } rather than throwing for an absent or expired session, which
 * is the ordinary logged-out path.
 *
 * Uses the ANON client (createClient), not the service-role one: this reads the
 * caller's own session from their cookies and must never be able to see more.
 */
export const getNavSession = cache(async (): Promise<NavSession> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;
    return { email: user.email };
  } catch (e) {
    console.error("[nav-session] auth lookup failed; rendering signed-out", e);
    return null;
  }
});
