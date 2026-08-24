import { defineRouting } from "next-intl/routing";

/**
 * The locale contract for phase 1.
 *
 * ============================================================================
 * ⚠ ENGLISH HAS NO PREFIX, AND THAT IS A HARD REQUIREMENT, NOT A PREFERENCE.
 * ============================================================================
 * There are live links in the wild to /tuition and to the homepage. `as-needed`
 * means the default locale is served at its existing unprefixed URL and only
 * Arabic carries /ar. If this ever flips to `always`, every one of those links
 * becomes a redirect at best and a 404 at worst.
 */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  /**
   * ⚠ NO AUTOMATIC LOCALE DETECTION IN PHASE 1.
   *
   * next-intl's default is to read Accept-Language and redirect. A Qatari
   * parent's iPhone very often reports ar-QA, so detection would silently move
   * visitors off the English URLs that are linked from WhatsApp, the existing
   * marketing and Stripe receipts — and the Arabic strings are UNREVIEWED.
   * Language is an explicit choice via the toggle until the founder has signed
   * off the translations; the cookie then remembers it.
   */
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

/** ⚠ Arabic is the only RTL locale here; derived, never hardcoded per-page. */
export function directionOf(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
