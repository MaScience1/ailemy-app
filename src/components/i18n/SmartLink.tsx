import NextLink from "next/link";
import type { ComponentProps } from "react";

import { isLocalisedPath } from "@/i18n/localised-paths";
import { Link as IntlLink } from "@/i18n/navigation";

/**
 * ONE INTERNAL LINK COMPONENT THAT KNOWS WHICH HALF OF THE APP IT IS POINTING AT.
 *
 * ============================================================================
 * ⚠ WHY NOT JUST IMPORT next-intl's Link EVERYWHERE.
 * ============================================================================
 * `createNavigation(routing)` has no `pathnames` map, so its Link prefixes
 * EVERY href with the active locale. On /ar that turns `/login` into
 * `/ar/login` — and `login` is one of the twenty-four roots that deliberately
 * live outside the locale segment, so the page 404s. A blanket swap across the
 * in-scope trees would have broken fourteen static links in Arabic, plus an
 * unknown number of the twenty-eight hrefs that are computed at runtime and
 * cannot be classified by reading the JSX at all.
 *
 * ⚠ AND WHY NOT CLASSIFY EACH CALL SITE BY HAND. Most hrefs here are variables
 * — `link.href`, `c.href`, `hrefFor(m)`, `canReserve ? cohort.enrolmentUrl :
 * ...`. Whether they are localised is a RUNTIME fact. Deciding it at runtime,
 * in one place, is the only version that is right for all of them.
 *
 * The decision comes from `isLocalisedPath`, the same function the proxy uses
 * to decide what to rewrite, so the two can never disagree.
 *
 * ⚠ EXTERNAL AND NON-PATH HREFS FALL THROUGH TO next/link UNTOUCHED. A Stripe
 * Payment Link in `cohort.enrolmentUrl` is an absolute URL and must never be
 * prefixed, rewritten, or otherwise interfered with — that CTA is live and
 * payable.
 */
/**
 * ⚠ `locale` IS DELIBERATELY NOT FORWARDED. next/link types it as
 * `string | false` (false opts out of locale handling); next-intl types it as
 * `string`. Nothing in this codebase passes it, and accepting it would mean
 * choosing which library's meaning wins — so it is excluded rather than cast.
 */
type Props = Omit<ComponentProps<typeof NextLink>, "locale">;

export function SmartLink({ href, ...rest }: Props) {
  if (typeof href === "string" && href.startsWith("/") && isLocalisedPath(href)) {
    return <IntlLink href={href} {...rest} />;
  }
  return <NextLink href={href} {...rest} />;
}
