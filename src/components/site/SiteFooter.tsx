import Link from "next/link";

/**
 * Site-wide footer. Used on the marketing landing page and on every /learn/*
 * route (via src/app/learn/layout.tsx).
 *
 * The brief asks for "nav links + copyright". We keep the existing minimal
 * one-line copyright row, and add a thin nav-link row above it so the footer
 * mirrors the top nav. No social icons yet — we don't have accounts set up.
 */

type FooterLink = { label: string; href: string };

const FOOTER_LINKS: FooterLink[] = [
  { label: "Subjects", href: "/learn" },
  { label: "Past Papers", href: "/past-papers" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "For schools", href: "/#for-schools" },
  { label: "About", href: "/#about" },
  { label: "Login", href: "/login" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-parchment text-ink">
      <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-10">
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink/65"
        >
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 flex flex-col gap-2 border-t border-ink/10 pt-5 text-xs text-ink/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Ailemy · Science learning for IB, IGCSE and A-Level students.
          </p>
          <p className="font-mono uppercase tracking-wider">Doha, Qatar</p>
        </div>
      </div>
    </footer>
  );
}
