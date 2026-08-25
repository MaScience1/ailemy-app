/**
 * WHERE A DELIBERATE LANGUAGE CHOICE IS REMEMBERED.
 *
 * ⚠ ONE NAME, TWO SIDES. The toggle writes this cookie in the browser before it
 * navigates; the proxy reads it to decide whether an unprefixed path should be
 * redirected into the remembered locale. Two spellings of the string would mean
 * the write and the read never meet, and the failure would be silent — the
 * toggle appears to work and the choice is simply forgotten every visit.
 *
 * ⚠ NEXT_LOCALE is next-intl's own conventional name. Reusing it means that if
 * `localeDetection` is ever turned on, it reads the cookie this app already
 * writes rather than starting from nothing.
 */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** A year: the choice should outlive a browser session, not a single visit. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The exact cookie string the toggle writes.
 *
 * ⚠ path=/ IS LOAD-BEARING. Without it the cookie is scoped to the page it was
 * set on, so choosing Arabic on /ar/tuition would not be remembered on the
 * homepage — which is the one place a returning parent actually lands.
 *
 * ⚠ SameSite=Lax IS WHAT SURVIVES THE WHATSAPP LINK. These parents arrive by
 * tapping a link in a chat, which is a cross-site top-level navigation; Strict
 * would withhold the cookie on exactly that arrival and forget the choice at
 * the only moment it matters.
 */
export function localeCookieString(locale: string): string {
  return `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}
