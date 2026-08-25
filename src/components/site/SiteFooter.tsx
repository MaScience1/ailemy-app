"use client";

import { useTranslations } from "next-intl";

import { SmartLink as Link } from "@/components/i18n/SmartLink";
import { DISCLOSURE } from "@/lib/legal/company";

/**
 * Site-wide footer. Used on the marketing landing page and on every /learn/*
 * route (via src/app/learn/layout.tsx).
 *
 * The brief asks for "nav links + copyright". We keep the existing minimal
 * one-line copyright row, and add a thin nav-link row above it so the footer
 * mirrors the top nav. No social icons yet — we don't have accounts set up.
 */

type FooterLink = { labelKey: string; href: string };

/**
 * ⚠ EVERY LINK HERE RESOLVES. §19 lists About, Contact, Terms and Privacy as
 * sensible destinations; a footer full of 404s is worse than a short footer —
 * it is the same dead-CTA failure, in the place people go when they want to
 * check a site is real.
 *
 * The original note here said Terms and Privacy "belong here the day the pages
 * do". That day is today: /privacy and /terms are real routes, so they are
 * listed. About and Contact still are not, so they still are not.
 */
const FOOTER_GROUPS: { headingKey: string; links: FooterLink[] }[] = [
  {
    headingKey: "nav.subjects",
    links: [
      { labelKey: "subjects.chemistry", href: "/chemistry" },
      { labelKey: "subjects.biology", href: "/biology" },
      { labelKey: "subjects.physics", href: "/physics" },
    ],
  },
  /**
   * ⚠ SPLIT ALONG THE FOUR PRODUCTS THE HEADER NOW USES (§33, §50). The footer
   * carries the detail the header sheds — Calendar and 1-to-1 left the primary
   * row and land here, under the product they belong to. "Live Tuition"
   * becomes "Online Tuition" so the product has ONE name everywhere; the page
   * it points at keeps its own marketing voice.
   *
   * ⚠ EVERY LINK HERE RESOLVES TO A PAGE THAT EXISTS. route-integrity.test.ts
   * fails the build on any that does not, which is why nothing aspirational
   * is listed.
   */
  {
    headingKey: "footer.headingStudy",
    links: [
      { labelKey: "nav.resources", href: "/resources" },
      { labelKey: "nav.pastPapers", href: "/past-papers" },
      { labelKey: "nav.examBuilder", href: "/exam-builder" },
    ],
  },
  {
    headingKey: "nav.onlineTuition",
    links: [
      { labelKey: "nav.overview", href: "/tuition" },
      { labelKey: "nav.oneToOneTuition", href: "/tuition/one-to-one" },
      { labelKey: "nav.timetableAndCalendar", href: "/calendar" },
      { labelKey: "nav.intensiveCourses", href: "/intensive" },
    ],
  },
  {
    headingKey: "footer.headingAccount",
    links: [
      { labelKey: "nav.login", href: "/login" },
      // ⚠ /profile, NOT /my-tuition. The latter now redirects here, and a
      // footer link that bounces through a redirect is a link with a stale
      // destination — it works, so nothing ever fixes it.
      { labelKey: "nav.myTuition", href: "/profile" },
      { labelKey: "nav.createAnAccount", href: "/signup" },
    ],
  },
  {
    headingKey: "footer.headingLegal",
    links: [
      { labelKey: "nav.privacyPolicy", href: "/privacy" },
      { labelKey: "nav.termsOfService", href: "/terms" },
    ],
  },
];

export function SiteFooter() {
  /**
   * ⚠ FLAT ACCESSOR, NO NAMESPACE. FOOTER_GROUPS carries fully-qualified keys
   * across three namespaces — footer.headingStudy, nav.resources,
   * subjects.chemistry — so useTranslations("footer") could not reach the nav
   * keys the header shares with this footer, which is the whole point of
   * sharing them.
   *
   * ⚠ useTranslations, NOT getTranslations, AND THAT IS WHY THIS FILE IS
   * "use client". SiteFooter renders on /learn/*, /calendar, /privacy and
   * /resources — all UNLOCALISED_ROOTS, where the proxy runs no next-intl and
   * a server-side translation call throws. See src/app/layout.tsx:100-124 for
   * the production 500 that lesson came from. The provider is at the ROOT with
   * an English fallback, so the client hook resolves on every route.
   */
  const t = useTranslations();
  return (
    <footer className="border-t border-ink/10 bg-parchment text-ink">
      <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-10">
        <nav aria-label={t("footer.navLabel")} className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.headingKey}>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                {t(group.headingKey)}
              </h2>
              {/*
                ⚠ space-y IS GONE, REPLACED BY PADDING ON THE LINK ITSELF.
                Margin between list items separates them visually but leaves
                each anchor 17px tall — under the 24px minimum, and the gap is
                dead space that swallows a mistimed tap. Padding grows the
                TARGET, so the same visual rhythm becomes a hittable one.
                Measured at 375px: 13 footer links were 17px; they are now 32px.
              */}
              <ul className="mt-2 text-sm text-ink/65">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="-mx-1 block rounded px-1 py-1.5 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-6 border-t border-ink/10 pt-5 text-xs text-ink/50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{t("footer.tagline")}</p>
            <p className="font-mono uppercase tracking-wider">{t("footer.location")}</p>
          </div>
          {/* Company disclosure. Assembled in one place so the footer and both
              legal pages cannot drift apart — see src/lib/legal/company.ts. */}
          <p className="mt-3 leading-relaxed">{DISCLOSURE}</p>
        </div>
      </div>
    </footer>
  );
}
