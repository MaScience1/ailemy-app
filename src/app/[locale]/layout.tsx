import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";

/**
 * The locale segment.
 *
 * ⚠ IT RENDERS NO <html>. The root layout above this one owns the document and
 * sets lang/dir from getLocale(); a second <html> here would be invalid and
 * React would drop it silently.
 *
 * ⚠ AN UNKNOWN LOCALE IS A 404, NOT A FALLBACK. Without this check the segment
 * matches any single path fragment — /about would render the HOMEPAGE with
 * locale "about", which is worse than a 404 because it looks like it worked.
 */
/**
 * ⚠ NO generateStaticParams, DELIBERATELY. Every page in this app reads cookies
 * (auth session, currency, timezone) and is already server-rendered on demand,
 * so prerendering the locale set cannot succeed — it only produced a build full
 * of "couldn't be rendered statically" warnings that would train the next
 * reader to ignore build output. Route validity is enforced below instead.
 */

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  /** ⚠ params IS A PROMISE in this version of Next — awaited, never destructured inline. */
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) notFound();

  /**
   * ⚠ NO PROVIDER HERE ANY MORE. It is in the ROOT layout so that the routes
   * OUTSIDE this segment get it too — SiteNav calls useTranslations on every
   * page, and a provider scoped to [locale] left six routes throwing. A second,
   * nested provider here would just shadow the root one for no gain.
   */
  return <>{children}</>;
}
