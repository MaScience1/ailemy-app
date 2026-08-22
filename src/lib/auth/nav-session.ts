import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { initialsFor, profileFromRow } from "@/lib/account/identity";

/**
 * The minimum the site nav needs to know about the viewer.
 *
 * Deliberately NOT the Supabase user object. Only what the nav renders crosses
 * the server/client boundary, so no id, no tokens, no app_metadata end up in
 * the HTML of every marketing page.
 *
 * ⚠ THE NAME IS HERE BECAUSE THE HEADER STOPPED SHOWING THE ADDRESS. The nav
 * used to print `email` as the student's primary identity — a credential on
 * every marketing page. `name` is what the header renders now; `email` stays,
 * because the open account menu still answers "which account am I in?" with it.
 *
 * ⚠ `initials` TRAVELS RATHER THAN BEING DERIVED IN THE COMPONENT. It is
 * redundant with `name` by a few bytes, and that is the price of keeping the
 * "never cut a monogram out of a login address" ruling in ONE place —
 * identity.ts, which is server-only and so cannot be called from the client
 * component that draws the bubble.
 */
export type NavSession = {
  email: string;
  /** The saved profile name, or null when none has ever been written. */
  name: string | null;
  /** Monogram for `name`. null whenever `name` is null — never from the email. */
  initials: string | null;
} | null;

/**
 * Resolve the signed-in user for the site nav.
 *
 * cache() dedupes per request: SiteNav is rendered from fifteen separate server
 * components (fourteen routes plus SubjectPage, which serves /chemistry,
 * /biology and /physics), and without this a page that composes more than one of
 * them would repeat both queries each time. Same reasoning as getEditContext()
 * in src/lib/admin/edit-mode.ts.
 *
 * ⚠ ONE EXTRA QUERY, AND ONLY FOR SIGNED-IN VIEWERS. A logged-out visitor —
 * which is most traffic on a marketing page — still costs exactly one getUser()
 * and never touches profiles.
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

    const name = await navName(supabase, user.id);
    return { email: user.email, name, initials: initialsFor(name) };
  } catch (e) {
    console.error("[nav-session] auth lookup failed; rendering signed-out", e);
    return null;
  }
});

/**
 * The saved name, or null.
 *
 * ⚠ ITS OWN try/catch, AND THAT IS THE WHOLE POINT. If this threw into
 * getNavSession's catch, a profiles read failure would render the header as
 * SIGNED OUT — a student with a live session told they are logged out because a
 * cosmetic lookup failed. A name we cannot read costs the name and nothing else;
 * the menu falls back to "My Account", which is honest.
 *
 * ⚠ SHAPED BY profileFromRow, NOT BY READING full_name DIRECTLY. One ladder,
 * and it is identity.ts's — that function is where a whitespace-only name
 * becomes null, and /dashboard already records what happens when two readers of
 * this column answer the question differently.
 *
 * ⚠ maybeSingle, NOT single. A missing profiles row is a real state: 0001's
 * handle_new_user fires AFTER INSERT and can lag, so a freshly-signed-up student
 * genuinely has a session and no profile yet.
 */
async function navName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("[nav-session] profile name unreadable; nav shows the account label", error);
      return null;
    }
    return profileFromRow((data as Record<string, unknown>) ?? null).profile.fullName;
  } catch (e) {
    console.error("[nav-session] profile name lookup threw; nav shows the account label", e);
    return null;
  }
}
