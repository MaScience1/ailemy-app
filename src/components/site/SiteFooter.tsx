import Link from "next/link";

import { DISCLOSURE } from "@/lib/legal/company";

/**
 * Site-wide footer. Used on the marketing landing page and on every /learn/*
 * route (via src/app/learn/layout.tsx).
 *
 * The brief asks for "nav links + copyright". We keep the existing minimal
 * one-line copyright row, and add a thin nav-link row above it so the footer
 * mirrors the top nav. No social icons yet — we don't have accounts set up.
 */

type FooterLink = { label: string; href: string };

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
const FOOTER_GROUPS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Subjects",
    links: [
      { label: "Chemistry", href: "/chemistry" },
      { label: "Biology", href: "/biology" },
      { label: "Physics", href: "/physics" },
    ],
  },
  {
    heading: "Study",
    links: [
      { label: "Resources", href: "/resources" },
      { label: "Past Papers", href: "/past-papers" },
      { label: "Live Tuition", href: "/tuition" },
      { label: "Calendar", href: "/calendar" },
      { label: "1-to-1 Tuition", href: "/tuition/one-to-one" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Login", href: "/login" },
      { label: "My tuition", href: "/my-tuition" },
      { label: "Create an account", href: "/signup" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-parchment text-ink">
      <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-10">
        <nav aria-label="Footer" className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.heading}>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                {group.heading}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-ink/65">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-6 border-t border-ink/10 pt-5 text-xs text-ink/50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Ailemy · Pearson Edexcel GCSE, International GCSE and IAL science.
            </p>
            <p className="font-mono uppercase tracking-wider">Doha, Qatar</p>
          </div>
          {/* Company disclosure. Assembled in one place so the footer and both
              legal pages cannot drift apart — see src/lib/legal/company.ts. */}
          <p className="mt-3 leading-relaxed">{DISCLOSURE}</p>
        </div>
      </div>
    </footer>
  );
}
