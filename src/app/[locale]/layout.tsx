import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";

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

  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
