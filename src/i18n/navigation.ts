import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * ⚠ USE THESE, NOT next/link, ON LOCALISED PAGES.
 *
 * These wrappers know the locale prefix rule, so an internal link written once
 * resolves to /tuition in English and /ar/tuition in Arabic. A bare next/link
 * to "/tuition" inside the Arabic tree silently drops the reader back into
 * English mid-journey, which is the failure mode a language toggle is supposed
 * to prevent.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
