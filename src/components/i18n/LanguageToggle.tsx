"use client";

import { useLocale, useTranslations } from "next-intl";

import { usePathname } from "@/i18n/navigation";
import { localeCookieString } from "@/i18n/locale-cookie";
import { localeSwitchHref } from "@/i18n/locale-switch";
import { routing } from "@/i18n/routing";

/**
 * The language toggle.
 *
 * ============================================================================
 * ⚠ IT SWITCHES THE PAGE YOU ARE ON, NEVER THE HOMEPAGE.
 * ============================================================================
 * usePathname() here is next-intl's, which returns the path WITHOUT the locale
 * prefix — so /ar/tuition reads as /tuition and the opposite-locale href is
 * built from it. next/navigation's usePathname would return /ar/tuition and the
 * Arabic link would become /ar/ar/tuition. A toggle that dumps a parent back on
 * the homepage after they have found the price they were looking for is worse
 * than no toggle.
 *
 * ⚠ AND IT CARRIES THE QUERY STRING. /tuition?mode=one-to-one is a real,
 * shared, linked state; dropping ?mode on a language switch would silently
 * change which tab they are reading.
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const t = useTranslations("language");
  const active = useLocale();
  const pathname = usePathname();

  return (
    <div role="group" aria-label={t("label")} className={`inline-flex items-center gap-1 ${className}`}>
      {routing.locales.map((locale) => {
        const on = locale === active;
        const label = locale === "ar" ? t("arabic") : t("english");
        return (
          /**
           * ⚠ A PLAIN <a>, DELIBERATELY — THIS ONE NAVIGATION MUST NOT BE
           * CLIENT-SIDE.
           * ============================================================
           * `lang` and `dir` are set on <html> by the ROOT layout, from the
           * locale resolved on the server. The App Router does not re-render
           * the root layout on a client-side navigation, so switching locale
           * with next-intl's Link changed the URL to /ar and left the document
           * reporting lang="en" dir="ltr" until a manual reload. Measured on
           * production: after pressing العربية from /calendar the page was at
           * /ar with 7 Arabic characters on it and an LTR document.
           *
           * A full page load re-runs the root layout, so the document, the
           * font and the direction all change together with the URL. That
           * costs the smooth transition and buys correctness, which is the
           * right trade for the one control whose entire job is changing how
           * the document reads.
           *
           * localeSwitchHref computes the final path itself — including the
           * "as-needed" rule that the default locale carries no prefix — so
           * nothing here depends on Link's prefixing behaviour any more.
           */
          <a
            key={locale}
            href={localeSwitchHref(pathname, locale)}
            hrefLang={locale}
            aria-current={on ? "true" : undefined}
            /**
             * ⚠ THE CHOICE IS WRITTEN BEFORE THE NAVIGATION, NOT AFTER IT.
             * The proxy reads NEXT_LOCALE on the very next request — the one
             * this click is about to make — so setting it in an effect after
             * arrival would be a request too late, and the first load would
             * still be un-remembered.
             *
             * ⚠ AND ENGLISH WRITES IT TOO. It is not "clear the cookie for
             * English": an absent cookie means "never chose", while
             * NEXT_LOCALE=en means "chose English", and only the second one
             * stops the proxy sending an Arabic-remembering visitor straight
             * back to /ar. Without this the English link is a one-way door.
             *
             * This runs on the click of a plain anchor, so the write lands and
             * then the browser does a full document load — no race with a
             * client-side router.
             */
            onClick={() => { document.cookie = localeCookieString(locale); }}
            /**
             * ⚠ tap-44 AND LOGICAL PADDING. This sits in the top bar on a phone;
             * ps-/pe- keep the padding on the correct side when the document
             * flips to RTL, where pl-/pr- would put the gap on the wrong edge.
             */
            className={`tap-44 inline-flex items-center rounded-full ps-3 pe-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink
              ${on ? "bg-ink text-parchment" : "text-ink/60 hover:bg-ink/[0.06]"}`}
          >
            {/* ⚠ THE ARABIC OPTION IS ALWAYS WRITTEN IN ARABIC, and the English
                one in English — a reader who cannot read the current language
                must still be able to find their own. */}
            <span lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>{label}</span>
            {on && <span className="sr-only"> ({t("label")})</span>}
          </a>
        );
      })}
    </div>
  );
}
