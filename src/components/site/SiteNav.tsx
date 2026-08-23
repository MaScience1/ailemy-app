"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, Search as SearchIcon, X } from "lucide-react";

import { navToneVars, type NavToneKey } from "@/lib/design/subject-colours";
import { AccountMenu, AccountPanel } from "@/components/site/AccountMenu";
import type { NavSession } from "@/lib/auth/nav-session";

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
 * menu state and reads usePathname), so it cannot call cookies() itself. Every
 * server component that renders it resolves getNavSession() and passes the
 * result down. `session` is undefined only if a caller forgets to pass it,
 * which renders the signed-out nav — the safe default.
 *
 * ⚠ FIFTEEN RENDER SITES, NOT FIVE. This comment claimed five for a long time,
 * and a prop change made on that belief would have missed ten callers. They are:
 * app/page, app/calendar, app/past-papers, app/tuition, app/tuition/interest,
 * app/tuition/one-to-one, app/intensive, app/resources, app/privacy, app/terms,
 * app/profile, app/welcome, app/learn/layout, app/(site)/[...slug], and
 * components/public/SubjectPage (which serves /chemistry, /biology, /physics).
 *
 * ⚠ WHICH IS WHY THE SESSION GREW A FIELD INSTEAD OF THE COMPONENT GROWING A
 * PROP. `name` and `initials` ride inside the object every one of those callers
 * already forwards, so adding the account menu changed no caller at all. A
 * second prop would have been fifteen edits and a silent signed-out nav
 * anywhere one was forgotten.
 *
 * ⚠ THE HEADER NO LONGER PRINTS AN EMAIL. It showed `session.email` as the
 * student's primary identity — a login credential in the chrome of every
 * marketing page. See AccountMenu.tsx for the full reasoning and for the
 * "My Account" fallback, which labels the control and never the person.
 *
 * Sign-out is a plain <form method="POST">, not a client-side
 * supabase.auth.signOut(). Importing the Supabase browser client here would
 * ship it to every visitor of every marketing page, including logged-out ones
 * who can never use it. The form also works with JavaScript disabled. It lives
 * in AccountMenu.tsx now, alongside the only two places that render it.
 */

type NavLink = {
  label: string;
  href: string;
  tone: NavToneKey;
  /**
   * Which route prefixes count as "inside" this product (§34). A student on
   * /calendar must see Online Tuition lit — the whole point of moving Calendar
   * under Tuition is that it stops feeling like a separate product.
   */
  activePrefixes: string[];
  /** A restrained honesty marker. See EXAM BUILDER below. */
  marker?: string;
  /**
   * ⚠ §39 — EVERY PRIMARY DESTINATION IS INSTRUMENTED, AND EVERY VALUE HERE
   * MUST BE DECLARED IN CTA_SOURCES. Analytics.tsx filters each data-cta
   * against that list and SILENTLY DROPS anything absent, so an undeclared
   * value is a link that looks instrumented and reports nothing — which is
   * how four lesson-practice CTAs emitted no clicks for weeks.
   * cta-integrity.test.ts is what stops it happening a second time.
   */
  cta: string;
};

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
  {
    cta: "nav_resources",
    label: "Resources",
    href: "/resources",
    tone: "gold",
    // Lessons live under /learn and are reached THROUGH Resources — a student
    // reading a lesson is inside "learn and revise", so Resources stays lit.
    activePrefixes: ["/resources", "/learn"],
  },
  { cta: "nav_past_papers", label: "Past Papers", href: "/past-papers", tone: "gold", activePrefixes: ["/past-papers"] },
  {
    /**
     * ⚠ EXAM BUILDER IS HERE AT FULL WEIGHT, WITH A "SOON" MARKER, AND THAT
     * COMBINATION IS A DELIBERATE JUDGEMENT.
     * ========================================================================
     * The engine does not exist. The brief asks for a flagship top-level slot;
     * the standing rule is that Ailemy does not ship dead CTAs. Both are
     * satisfiable: the slot is full-size and never hidden behind a "More"
     * menu, /exam-builder is a real page that explains the idea and hands the
     * student two things that work TODAY, and the marker means nobody clicks
     * it expecting a finished product.
     *
     * The alternative — a disabled item — was rejected: an unclickable entry
     * in a four-item header is clutter in a brief whose entire purpose is
     * removing clutter, and it would deny a student the working alternatives
     * the page offers.
     */
    cta: "nav_exam_builder",
    label: "Exam Builder",
    href: "/exam-builder",
    tone: "gold",
    activePrefixes: ["/exam-builder"],
    marker: "Soon",
  },
  {
    /**
     * ⚠ ONE TUITION ENTRY WHERE THERE WERE THREE (§36). "Live Tuition" and
     * "Calendar" were separate permanent slots alongside three subjects;
     * Calendar is a tuition feature and subjects are a dimension of every
     * product, not products themselves. Nothing was deleted — /calendar,
     * /intensive and every subject page still resolve, and all three light
     * this tab or are reached from the homepage, Resources and the footer.
     */
    cta: "nav_tuition",
    label: "Online Tuition",
    href: "/tuition",
    tone: "gold",
    activePrefixes: ["/tuition", "/calendar", "/intensive", "/my-tuition"],
  },
];

/**
 * Subjects, kept one tap away on mobile and in the footer (§2, §19, §53).
 * They are NOT primary navigation: Chemistry is not a product beside Past
 * Papers, it is a dimension of every product Ailemy has.
 */
const SUBJECT_LINKS: { label: string; href: string; tone: NavToneKey; cta: string }[] = [
  { cta: "nav_subject_chemistry", label: "Chemistry", href: "/chemistry", tone: "chemistry" },
  { cta: "nav_subject_biology", label: "Biology", href: "/biology", tone: "biology" },
  { cta: "nav_subject_physics", label: "Physics", href: "/physics", tone: "physics" },
];

/** Is the current path inside this product area? (§34) */
function isActive(pathname: string, link: NavLink): boolean {
  return link.activePrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * ⚠ RE-EXPORTED, NOT RE-DECLARED. This file used to carry its own
 * `{ email: string } | null` copy of the shape that nav-session.ts also
 * declared — two truths about one object, which is exactly how the nav ends up
 * unable to read a field the server is already sending. `import type` is erased
 * before bundling, so nothing from that server-only module reaches the client.
 */
export type { NavSession };

export function SiteNav({ session = null }: { session?: NavSession }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile panel whenever the route changes. Same-route hash
  // navigations (which don't change pathname) are handled by the per-link
  // onClick below. The account dropdown closes itself on the same signal.
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
        {/* ⚠ -mx-[13px] KEEPS THE ROW'S OUTER EDGES WHERE THEY WERE — 13, not
            12, for the same reason gap is 14: padding plus the transparent
            border. Without it the group is 26px wider and the nav's balance
            against the logo shifts. */}
        <ul className="-mx-[13px] hidden items-center gap-[14px] text-sm font-medium text-ink/70 md:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  data-cta={link.cta}
                  style={navToneVars(link.tone)}
                  /* ⚠ aria-current CARRIES THE STATE, not the colour (§42).
                     A student using a screen reader is told which product they
                     are in; the underline reinforces it for everyone else. */
                  aria-current={active ? "page" : undefined}
                  className={`${TAB} ${active ? "text-ink underline decoration-2 underline-offset-[6px]" : ""}`}
                >
                  {link.label}
                  {link.marker && (
                    <span className="font-mono ml-1.5 align-[1px] text-[9px] uppercase tracking-[0.14em] text-ink/40">
                      {link.marker}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Desktop right side: account menu when signed in, Login when not. */}
        <div className="hidden items-center gap-3 md:flex">
          {/* ⚠ SEARCH POINTS AT THE SEARCH THAT EXISTS (§16). Resources owns
              the only real search in the product; a header field that queried
              nothing, or a second search index, would both be worse than a
              short walk to the one that works. */}
          <Link
            href="/resources"
            aria-label="Search resources"
            style={navToneVars("neutral")}
            className={`${TAB} text-ink/70`}
          >
            <SearchIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
          {session ? (
            /* ⚠ TAB IS PASSED IN, NOT IMPORTED BACK OUT. AccountMenu occupies
               the same slot as Login and must wear the same capsule, but this
               file already imports that file — importing TAB the other way would
               make the pair circular, and re-typing the capsule string there is
               the drift TAB's own comment exists to prevent. */
            <AccountMenu session={session} capsuleClassName={TAB} />
          ) : (
            <>
              <Link
                href="/login"
                style={navToneVars("neutral")}
                className={`${TAB} text-sm font-medium text-ink/75`}
              >
                Login
              </Link>
              {/* ⚠ §18 — SHOWN ONLY WHEN SIGNED OUT. Offering "Start free" to
                  somebody who already has an account is the small rudeness
                  that tells them the product is not paying attention. */}
              <Link
                href="/signup"
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment transition-colors hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Start free
              </Link>
            </>
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
              {NAV_LINKS.map((link) => {
                const active = isActive(pathname, link);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      data-cta={link.cta}
                      onClick={closeMenu}
                      style={navToneVars(link.tone)}
                      aria-current={active ? "page" : undefined}
                      className={`${TAB_MOBILE} ${active ? "text-ink underline decoration-2 underline-offset-[6px]" : ""}`}
                    >
                      {link.label}
                      {link.marker && (
                        <span className="font-mono ml-1.5 text-[9px] uppercase tracking-[0.14em] text-ink/40">
                          {link.marker}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* ⚠ SUBJECTS AS A SECONDARY GROUP, NOT A FIFTH PRODUCT (§19, §28).
                They left the primary row because they are a dimension of every
                product; they stay one tap away because "I want Chemistry" is
                still how a lot of students think. */}
            <p className="font-mono mt-5 px-[13px] text-[10px] uppercase tracking-[0.2em] text-ink/45">
              Subjects
            </p>
            <ul className="-mx-[13px] mt-1 space-y-1 text-base font-medium text-ink">
              {SUBJECT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    data-cta={link.cta}
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
                <AccountPanel session={session} onNavigate={closeMenu} />
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="rounded-md border border-ink/15 px-4 py-2.5 text-center text-sm font-medium text-ink hover:bg-ink/[0.04]"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    onClick={closeMenu}
                    className="rounded-md bg-ink px-4 py-2.5 text-center text-sm font-medium text-parchment hover:bg-ink/90"
                  >
                    Start free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
