"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

import { navToneVars, type NavToneKey } from "@/lib/design/subject-colours";

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
 *
 * AUTH IS A PROP, NOT A LOOKUP. This is a Client Component (it owns the mobile
 * menu state and reads usePathname), so it cannot call cookies() itself. Each
 * of the five server components that render it resolves getNavSession() and
 * passes the result down. `session` is undefined only if a caller forgets to
 * pass it, which renders the signed-out nav — the safe default.
 *
 * Sign-out is a plain <form method="POST">, not a client-side
 * supabase.auth.signOut(). Importing the Supabase browser client here would
 * ship it to every visitor of every marketing page, including logged-out ones
 * who can never use it. The form also works with JavaScript disabled.
 */

type NavLink = { label: string; href: string; tone: NavToneKey };

/**
 * ============================================================================
 * ⚠ THE HOVER CAPSULE — ONE CLASS STRING, SEVEN TABS, TWO VARIABLES
 * ============================================================================
 * Every tab renders the identical geometry, timing, scale and focus ring, and
 * differs ONLY in --nav-tint and --nav-border. Seven per-tab class strings
 * would drift the moment one of them is adjusted; this cannot.
 *
 * ⚠ THE CAPSULE'S PADDING AND BORDER EXIST AT REST, TRANSPARENT. If the pill
 * only appeared on hover, the tab would gain 24px of width and a 1px border at
 * the moment the pointer arrived — the row would jump and the item would move
 * out from under the cursor. So the box is always there and only its COLOURS
 * change. Nothing reflows, ever.
 *
 * ⚠ WHICH IS WHY gap-10 BECAME gap-[14px], AND WHY IT IS NOT gap-4. The old row
 * put 40px between the label text of adjacent tabs. Each tab now carries 12px
 * of padding AND a 1px transparent border, so the glyph run sits 13px inside
 * its box, not 12. gap-4 looked like the right answer and measured 42px —
 * 13 + 16 + 13 — quietly loosening every gap in the nav by 2px. 40 − 26 = 14.
 *
 * The border is the easy thing to forget here: it is invisible at rest, so it
 * contributes nothing you can see and 2px you can measure.
 *
 * ⚠ HOVER IS NEVER THE ONLY TRIGGER and the ring is never the capsule. Every
 * hover declaration is repeated on focus-visible, the transform sits behind
 * motion-safe:, and the ink outline is a separate property outside the pill —
 * a decorative fill that doubles as the focus indicator stops being an
 * indicator the moment somebody restyles the decoration.
 *
 * Measured, ink on each tint, against the 6.48:1 the nav has at rest:
 *   chemistry 16.54:1 · biology 16.28:1 · physics 16.09:1
 *   gold      14.78:1 · neutral 14.65:1
 */
const TAB = [
  "group relative inline-flex items-center rounded-full border border-transparent px-3 py-1.5",
  "cursor-pointer transition-[color,background-color,border-color,transform] duration-200 ease-out",
  "hover:border-[var(--nav-border)] hover:bg-[var(--nav-tint)] hover:text-ink",
  "focus-visible:border-[var(--nav-border)] focus-visible:bg-[var(--nav-tint)] focus-visible:text-ink",
  "origin-center motion-safe:hover:scale-[1.06] motion-safe:focus-visible:scale-[1.06]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
].join(" ");

/**
 * ⚠ THE MOBILE EQUIVALENT KEEPS THE COLOUR AND DROPS THE PILL. A capsule that
 * spans a full-width dropdown row is not a capsule, it is a bar; and a 1.06
 * scale on a touch target under a finger is movement the finger did not ask
 * for. So a phone gets the same tint and hairline on a rounded row, no scale.
 * The colour language is identical, the geometry suits the surface.
 *
 * -mx-[13px] cancels the padding AND the transparent border, so the labels stay
 * flush with the panel's own padding and the touched row bleeds out to meet it.
 */
const TAB_MOBILE = [
  "block rounded-lg border border-transparent px-3 py-2",
  "transition-[color,background-color,border-color] duration-200 ease-out",
  "hover:border-[var(--nav-border)] hover:bg-[var(--nav-tint)] hover:text-ink",
  "focus-visible:border-[var(--nav-border)] focus-visible:bg-[var(--nav-tint)] focus-visible:text-ink",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
].join(" ");

/**
 * ⚠ THE PERMANENT ARCHITECTURE, NOT ONE CAMPAIGN.
 *
 * "Intensive" was a top-level destination. It is a PROGRAMME — one campaign
 * with a start date — and giving it a slot alongside three whole sciences said
 * the site was about it. It now lives under Live Tuition.
 *
 * ⚠ THE /intensive ROUTE IS UNTOUCHED AND STILL REACHABLE. It is linked and
 * possibly indexed; renaming or removing it would break every link anyone has
 * already shared. Demoting a nav entry and deleting a route are different acts,
 * and only the first was asked for.
 *
 * Biology and Physics appear because the site is about three sciences. Their
 * pages are honest about having no resources yet — the alternative, hiding them
 * until they are complete, loses every visitor who came looking for them.
 */
const NAV_LINKS: NavLink[] = [
  { label: "Chemistry", href: "/chemistry", tone: "chemistry" },
  { label: "Biology", href: "/biology", tone: "biology" },
  { label: "Physics", href: "/physics", tone: "physics" },
  // ⚠ GOLD, NOT A FOURTH SUBJECT HUE. These are cross-subject platform
  // features, and the homepage capability strip already renders the words
  // "Past papers" and "Live tuition" as gold capsules — the same label gets
  // the same treatment in both places. See NAV_TONES for the full reasoning.
  { label: "Past Papers", href: "/past-papers", tone: "gold" },
  { label: "Live Tuition", href: "/tuition", tone: "gold" },
  // ⚠ §3 — Calendar is a permanent top-level entry, not a link buried in the
  // tuition page. It is where a student checks when a class actually is.
  { label: "Calendar", href: "/calendar", tone: "gold" },
  // ⚠ "Resources" IS NOT HERE ON PURPOSE. Resources are discovered THROUGH a
  // subject — that is the canonical path, and a parallel top-level entry
  // offered a second, flatter route to the same material, which is how two
  // navigation models end up half-maintained. /resources still exists and is
  // still linked from the footer; it is a chooser that sends you back into a
  // subject.
];

export type NavSession = { email: string } | null;

export function SiteNav({ session = null }: { session?: NavSession }) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const pathname = usePathname();
  const accountRef = useRef<HTMLDivElement | null>(null);

  // Close both menus whenever the route changes. Same-route hash navigations
  // (which don't change pathname) are handled by the per-link onClick below.
  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // Escape and click-outside for the account dropdown. Bound only while it is
  // open, so a closed nav adds no global listeners.
  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [accountOpen]);

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
        {/* ⚠ -mx-[13px] KEEPS THE ROW'S OUTER EDGES WHERE THEY WERE — 13, not
            12, for the same reason gap is 14: padding plus the transparent
            border. Without it the group is 26px wider and the nav's balance
            against the logo shifts. */}
        <ul className="-mx-[13px] hidden items-center gap-[14px] text-sm font-medium text-ink/70 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} style={navToneVars(link.tone)} className={TAB}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop right side: account menu when signed in, Login when not. */}
        <div className="hidden items-center gap-5 md:flex">
          {session ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-controls="site-nav-account"
                // The full address is in `title` because the visible label is
                // truncated — a long email must not push the nav around.
                title={session.email}
                style={navToneVars("neutral")}
                /**
                 * ⚠ THE SAME CAPSULE AS Login, BECAUSE IT IS THE SAME SLOT.
                 * Signed out this position holds a Login link; signed in it
                 * holds this control. If only one of them grew a capsule, the
                 * nav would change shape on sign-in for no reason the user can
                 * see. Its own hover:bg-ink/[0.04] is what the neutral tone was
                 * derived from, so this is that behaviour formalised, not
                 * replaced. max-w and truncate stay: a long address must never
                 * push the nav around, capsule or not.
                 */
                className={`${TAB} max-w-[16rem] gap-1.5 text-sm font-medium text-ink/75`}
              >
                <span className="min-w-0 truncate">{session.email}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
                    accountOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {accountOpen && (
                <div
                  id="site-nav-account"
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 min-w-[13rem] rounded-md border border-ink/10 bg-parchment p-1 shadow-[0_8px_24px_-12px_rgba(15,20,25,0.18)]"
                >
                  <p className="truncate px-3 py-2 text-xs text-ink/50" title={session.email}>
                    {session.email}
                  </p>
                  <div className="my-1 border-t border-ink/10" />
                  <SignOutForm next={pathname} role="menuitem" />
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              style={navToneVars("neutral")}
              className={`${TAB} text-sm font-medium text-ink/75`}
            >
              Login
            </Link>
          )}
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
            <ul className="-mx-[13px] space-y-1 text-base font-medium text-ink">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    style={navToneVars(link.tone)}
                    className={TAB_MOBILE}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-5">
              {session ? (
                <>
                  {/* No dropdown on mobile — the panel IS the disclosure, so
                      nesting a second one would be a pointless extra tap. */}
                  <p className="truncate text-sm text-ink/55" title={session.email}>
                    {session.email}
                  </p>
                  <SignOutForm next={pathname} full />
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="rounded-md border border-ink/15 px-4 py-2.5 text-center text-sm font-medium text-ink hover:bg-ink/[0.04]"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * Sign out via a form POST. `next` returns the visitor to the page they were
 * on; the route validates it as a same-origin relative path before redirecting.
 */
function SignOutForm({
  next,
  full = false,
  role,
}: {
  next: string;
  full?: boolean;
  role?: string;
}) {
  return (
    <form method="POST" action="/api/auth/sign-out">
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        role={role}
        className={
          full
            ? "w-full cursor-pointer rounded-md border border-ink/15 px-4 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:bg-ink/[0.04]"
            : "w-full cursor-pointer rounded px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-ink/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        }
      >
        Sign out
      </button>
    </form>
  );
}
