"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The persistent conversion CTA (§19, §20).
 *
 * ============================================================================
 * ⚠ IT DOES NOT APPEAR UNTIL THE HERO HAS BEEN READ
 * ============================================================================
 * §19 says "it should not be obnoxious". A floating button present at t=0
 * competes with the hero's own primary CTA — two different invitations to start,
 * eight hundred pixels apart, and the visitor has read neither. So it fades in
 * once the hero is behind them, which is also the moment it stops being a
 * duplicate and starts being a recovery.
 *
 * ⚠ AND IT KNOWS WHO IT IS TALKING TO (§53). "Start learning free" to a
 * stranger. A signed-in student already has an account; inviting them to make
 * one reads as the site not recognising them, so they get "Continue studying".
 *
 * ⚠ MOBILE IS A SLIM BAR, NOT A FLOATING PILL. §19 asks for the bar, and a
 * floating circle at phone width lands on top of whatever is bottom-right —
 * which on this site is page content, not chrome. env(safe-area-inset-bottom)
 * keeps it clear of the home indicator.
 *
 * ⚠ THE ONE CLIENT COMPONENT ON THE HOMEPAGE, AND DELIBERATELY SMALL. page.tsx
 * is server-rendered throughout; this needs scroll position, which the server
 * cannot know. It ships no data — everything it renders is a prop or a literal.
 */
export function StickyCta({
  signedIn,
  /** Pixels of scroll before it appears. Roughly one hero. */
  revealAfter = 620,
}: {
  signedIn: boolean;
  revealAfter?: number;
}) {
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    /**
     * ⚠ passive: true. A non-passive scroll listener blocks the compositor and
     * makes the whole page feel heavy on a phone — which is the one thing §35
     * says not to trade away for an animation.
     */
    const onScroll = () => setShown(window.scrollY > revealAfter);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [revealAfter]);

  if (dismissed) return null;

  const label = signedIn ? "Continue studying" : "Start learning free";
  const href = signedIn ? "/profile" : "/signup";
  const cta = signedIn ? "floating_continue_studying" : "floating_start_learning";

  return (
    <div
      /**
       * ⚠ aria-hidden WHILE HIDDEN, so a screen-reader user does not meet a
       * button that is visually absent. It is not removed from the DOM, because
       * that would make it announce itself as new content on every scroll.
       */
      aria-hidden={!shown}
      className={[
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 transition-opacity duration-300",
        shown ? "opacity-100" : "opacity-0",
        "sm:inset-x-auto sm:bottom-6 sm:right-6",
      ].join(" ")}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={[
          "pointer-events-auto flex items-center gap-3 border-t border-ink/10 bg-parchment/95 px-4 py-3 backdrop-blur",
          "sm:rounded-full sm:border sm:px-2 sm:py-2 sm:pl-5 sm:shadow-[0_8px_28px_-12px_rgba(15,20,25,0.28)]",
          "motion-safe:transition-transform motion-safe:duration-300",
          shown ? "translate-y-0" : "translate-y-2",
        ].join(" ")}
      >
        <div className="min-w-0 flex-1 sm:flex-none">
          <p className="truncate text-sm font-medium sm:hidden">{label}</p>
          {/* ⚠ THE REASSURANCE IS THE POINT OF §19's MICROCOPY. "Free account ·
              no card" removes the objection the button itself creates. */}
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50">
            {signedIn ? "Your progress is saved" : "Free account · no card"}
          </p>
        </div>

        <Link
          href={href}
          data-cta={cta}
          tabIndex={shown ? undefined : -1}
          className="group shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition-colors duration-200 hover:bg-ink/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="hidden sm:inline">{label} </span>
          <span className="sm:hidden">Start free </span>
          <span aria-hidden className="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">→</span>
        </Link>

        {/* ⚠ DISMISSIBLE, BECAUSE A BAR THAT CANNOT BE CLOSED IS THE
            "obnoxious" §19 rules out. It only hides for this page view — no
            cookie, no localStorage, nothing to consent to. */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          tabIndex={shown ? undefined : -1}
          aria-label="Hide this"
          className="shrink-0 rounded-full p-2 text-ink/45 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span aria-hidden className="block h-3 w-3 leading-3">×</span>
        </button>
      </div>
    </div>
  );
}
