/**
 * Where to send someone after they sign in.
 *
 * ONE definition, shared by every sign-in path. There were previously two
 * hand-rolled copies of this check and one path with none at all, which is
 * exactly how an open redirect survives: the rule has to live in a single place
 * or the copies drift.
 *
 * CLIENT-SAFE — no `server-only` import. The password form is a Client
 * Component and imports this as a VALUE, so a server-only import here would
 * break the build (the trap documented in past-paper-filter-types.ts).
 */

/**
 * Default landing page after a successful sign-in.
 *
 * Deliberately "/" and not "/dashboard". /dashboard is still reachable at its
 * own URL and still linked to; it just is not where everyone belongs — the
 * cohort has /intensive/dashboard, and most visitors want the site itself.
 */
export const POST_SIGN_IN_DEFAULT = "/";

/**
 * Accept only same-origin relative paths.
 *
 * Rejects "//evil.com" (protocol-relative — a browser reads it as a host) and
 * anything with a scheme, so a crafted ?next= cannot bounce a freshly
 * authenticated user off-site.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

/**
 * The redirect target for a sign-in: an explicit, validated `next` if there is
 * one, otherwise the default. An existing `next` always wins, so a student who
 * clicked into a gated page still lands where they intended.
 */
export function postSignInTarget(raw: string | null | undefined): string {
  return safeNext(raw) ?? POST_SIGN_IN_DEFAULT;
}
