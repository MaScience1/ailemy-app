"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";

import { Link, usePathname } from "@/i18n/navigation";
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
  /** Dynamic segments must be re-supplied or the typed href cannot be built. */
  const params = useParams();

  return (
    <div role="group" aria-label={t("label")} className={`inline-flex items-center gap-1 ${className}`}>
      {routing.locales.map((locale) => {
        const on = locale === active;
        const label = locale === "ar" ? t("arabic") : t("english");
        return (
          <Link
            key={locale}
            href={{ pathname, params } as never}
            locale={locale}
            hrefLang={locale}
            aria-current={on ? "true" : undefined}
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
          </Link>
        );
      })}
    </div>
  );
}
