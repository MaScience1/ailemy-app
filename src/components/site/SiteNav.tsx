"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";

/**
 * Site-wide top navigation. Used on the marketing landing page and on every
 * /learn/* route (via src/app/learn/layout.tsx).
 *
 * Every entry points at a real route. The earlier `/#how-it-works`,
 * `/#for-schools` and `/#about` anchor placeholders were removed — they
 * targeted sections that were never built, so they scrolled nowhere.
 *
 * Mobile: a hamburger toggles an absolute-positioned dropdown beneath the
 * nav. State closes automatically on pathname changes so the menu doesn't
 * stay open across navigations.
 */

type NavLink = { label: string; href: string };

const NAV_LINKS: NavLink[] = [
  { label: "Chemistry", href: "/learn" },
  { label: "Past Papers", href: "/past-papers" },
  { label: "Intensive", href: "/intensive" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the menu whenever the route changes. Same-route hash navigations
  // (which don't change pathname) are handled by the per-link onClick below.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const closeMenu = () => setOpen(false);

  return (
    <header className="relative border-b border-ink/10 bg-parchment text-ink">
      <nav
        aria-label="Primary"
        className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 sm:px-10"
      >
        <Link
          href="/"
          className="font-display text-xl font-medium tracking-tight text-ink"
        >
          Ailemy<span className="text-flask">.</span>
        </Link>

        {/* Desktop primary links */}
        <ul className="hidden items-center gap-10 text-sm font-medium text-ink/70 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="transition-colors duration-200 hover:text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop right-side CTAs */}
        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-ink/75 transition-colors hover:text-ink"
          >
            Login
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-controls="site-nav-mobile"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-md p-2 text-ink transition-colors hover:bg-ink/[0.05] md:hidden"
        >
          {open ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* Mobile dropdown panel */}
      {open && (
        <div
          id="site-nav-mobile"
          className="absolute inset-x-0 top-full z-50 border-b border-ink/10 bg-parchment shadow-[0_8px_24px_-12px_rgba(15,20,25,0.10)] md:hidden"
        >
          <div className="mx-auto w-full max-w-7xl px-6 py-6">
            <ul className="space-y-1 text-base font-medium text-ink">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className="block py-2 transition-colors hover:text-ink/70"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-5">
              <Link
                href="/login"
                onClick={closeMenu}
                className="rounded-md border border-ink/15 px-4 py-2.5 text-center text-sm font-medium text-ink hover:bg-ink/[0.04]"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
