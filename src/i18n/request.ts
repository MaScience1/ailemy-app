import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * Which catalogue to load for this request.
 *
 * ⚠ THE CATALOGUE IS A BUILD-TIME FILE. There is no runtime machine
 * translation anywhere in this system and there must never be: a live
 * translation service would put text on a paid checkout page that nobody in
 * this business has read, in a language most of the team cannot check.
 *
 * ⚠ AN UNKNOWN LOCALE FALLS BACK TO THE DEFAULT rather than throwing. A bad
 * cookie or a crafted URL should show English, not a 500 on the homepage.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as never)
    ? (requested as string)
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
