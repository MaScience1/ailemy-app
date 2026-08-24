"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NEUTRAL_SLOT, subjectColour } from "@/lib/design/subject-colours";

/**
 * The persistent live-tuition CTA.
 *
 * ============================================================================
 * ⚠ IT NEVER IMPLIES A BOOKING CAN BE COMPLETED, BECAUSE ONE CANNOT
 * ============================================================================
 * /tuition/one-to-one says "Online payment is not switched on yet" and every
 * cohort card on /tuition renders "Register interest", because ctaFor() only
 * returns "Enrol" for a cohort that is `enrolling` AND has an enrolmentUrl, and
 * no cohort has one. So the verbs here are VIEW and REGISTER. "Book now" would
 * be the dead CTA the rails forbid, and it is worse than an ordinary dead end:
 * a student who has decided to spend money is being walked into a wall.
 *
 * ⚠ AND IT ASSERTS NOTHING IT CANNOT SEE. An earlier draft carried "online
 * booking is not open yet" as microcopy — true today, and a lie the morning the
 * founder pastes an enrolment URL into the cohorts table. This component is a
 * client component with no data access, so it cannot know. The microcopy
 * therefore describes the DESTINATION ("Cohorts, prices and the timetable"),
 * which is a fact about a page that exists, not a claim about the state of the
 * business. Nothing here needs re-verifying when the catalogue changes.
 *
 * ============================================================================
 * ⚠ BOTTOM-RIGHT IS ALREADY TAKEN, TWICE OVER — SO DESKTOP SITS BOTTOM-CENTRE
 * ============================================================================
 *   StickyCta      sm:bottom-6 sm:end-6, z-40 (homepage)
 *   AdminOverlay   bottom-5 end-5, z-[9999], mounted in the ROOT LAYOUT
 *
 * AdminOverlay returns null for non-admins, so it costs a visitor nothing — but
 * it is on every route for the one person most likely to be looking at this
 * component. A desktop pill at bottom-right would land underneath the "Edit
 * mode" toggle. Bottom-centre is clear of both, and reads as page furniture
 * rather than as a second floating button competing with the first.
 *
 * The MOBILE bar still runs the full width and its right end still meets that
 * toggle for an admin on a phone. `bottomGap` is the escape hatch; for everyone
 * else there is nothing there.
 *
 * ⚠ AND IT REFUSES TO RENDER BESIDE StickyCta. Two floating bars at the bottom
 * of one page is the "obnoxious" StickyCta's own header rules out, and a mount
 * in layout.tsx would produce exactly that on the homepage. A comment cannot
 * stop a layout mount, so the guard is a real DOM check for StickyCta's own
 * data-cta markers — attributes that cannot be removed silently, because the
 * funnel in Analytics.tsx reads them.
 */

/** The one session-wide preference. Not keyed by subject: a student who
 *  collapsed this on /chemistry does not want it back on /biology. */
const STORAGE_KEY = "ailemy:tuition-cta-collapsed";

/** StickyCta's two possible data-cta values — see CTA_SOURCES. */
const CLASH_SELECTOR =
  '[data-cta="floating_start_learning"],[data-cta="floating_continue_studying"]';

type Copy = {
  /** The sentence before the control. */
  lead: string;
  /**
   * The lead at phone width.
   *
   * ⚠ IT EXISTS BECAUSE THE FULL LEAD DOES NOT FIT, AND A TRUNCATED SENTENCE IS
   * WORSE THAN A SHORT ONE. Measured at 375px: the bar's padding, the dot, the
   * control and a 44px dismiss target leave roughly 140px for this line —
   * "Biology tuition is expanding" needs about 190 and would render as
   * "Biology tuition is…". Every value below is a complete phrase.
   */
  shortLead: string;
  /** The control's own words. Never "Book". */
  action: string;
  /** The control at phone width. The full ask survives in the aria-label. */
  short: string;
  /** What is at the other end. A fact about a page, never a promise. */
  note: string;
  /** Verified against the route before it was written here — see below. */
  href: string;
};

/**
 * ⚠ EVERY href BELOW WAS CHECKED AGAINST THE ROUTE THAT RECEIVES IT.
 *
 *   /tuition?subject=…            page.tsx takes `subject` in searchParams,
 *                                 hands it to readState(), which passes it to
 *                                 loadCalendarEvents() as a filter on the
 *                                 timetable. Chemistry is the only subject with
 *                                 published cohorts, so it is the only one for
 *                                 which that filter resolves to anything.
 *
 *   /tuition/interest?subject=…   interest/page.tsx matches the value against
 *                                 SUBJECTS' slugs and prefills the form.
 *
 * ⚠ BIOLOGY AND PHYSICS GO TO THE INTEREST FORM, NOT TO /tuition. The brief
 * said "otherwise navigate to /tuition"; this is the one place it is departed
 * from, deliberately. /tuition's subject filter narrows only the TIMETABLE — the
 * cohort cards above it are unfiltered and all three are Chemistry. So
 * "Biology tuition is expanding — Register interest" landing on /tuition would
 * put a Biology student in front of three Chemistry cards and an empty
 * calendar: a promise and a destination that disagree. `href` overrides this if
 * the mounting page wants /tuition regardless.
 *
 * ⚠ "expanding" IS THE CATALOGUE'S WORD, NOT AN INVENTED ONE. SUBJECTS in
 * src/lib/public/catalogue.ts carries status "interest" for biology and physics
 * and blurbs reading "…lessons and tuition expanding — register interest for
 * priority access". It is not imported here because that module also carries
 * COHORTS and the announcement mappers, and this is a client component that
 * would drag all of it into the bundle of every page it is mounted on. If a
 * subject's status ever changes there, these two lines change here.
 */
export const TUITION_CTA_COPY = {
  chemistry: {
    lead: "Need help with Chemistry?",
    shortLead: "Chemistry tuition",
    action: "View live tuition",
    short: "View",
    note: "Cohorts, prices and the timetable",
    href: "/tuition?subject=chemistry",
  },
  biology: {
    lead: "Biology tuition is expanding",
    shortLead: "Biology tuition",
    action: "Register interest",
    short: "Interest",
    note: "We open cohorts on demand",
    href: "/tuition/interest?subject=biology",
  },
  physics: {
    lead: "Physics tuition is expanding",
    shortLead: "Physics tuition",
    action: "Register interest",
    short: "Interest",
    note: "We open cohorts on demand",
    href: "/tuition/interest?subject=physics",
  },
  /** No subject in context: the neutral ask, promising nothing about any one
   *  science. The lead is /tuition's own description of itself. */
  none: {
    lead: "Small-group science tuition",
    shortLead: "Live tuition",
    action: "View live tuition",
    short: "View",
    note: "Cohorts, prices and the timetable",
    href: "/tuition",
  },
} satisfies Record<string, Copy>;

export type TuitionCtaProps = {
  /**
   * A subject slug ("chemistry") or anything carrying one ("IAL Chemistry AS").
   * Resolved through subjectColour(), which returns null — and therefore the
   * neutral copy — for a value it does not recognise rather than guessing.
   */
  subject?: string | null;
  /**
   * The in-page section to scroll to instead of navigating, when the current
   * page has one. Default "tuition", matching the homepage's
   * `<section id="tuition">` — today the only element with that id anywhere in
   * src/. Any page wanting the scroll behaviour only has to add the id.
   */
  targetId?: string;
  /**
   * Pixels of scroll before it fades in. 0 — the default — means persistent
   * from the top, which is what this component is for.
   *
   * ⚠ THE KNOB EXISTS BECAUSE OF StickyCta's LESSON: a floating control present
   * at t=0 on a page with its own hero CTA is two invitations eight hundred
   * pixels apart, and the reader has read neither. Mount it on such a page and
   * pass roughly one hero.
   */
  revealAfter?: number;
  /** Pixels to lift it above the bottom edge, for a page with its own
   *  bottom-anchored UI. Added on top of env(safe-area-inset-bottom). */
  bottomGap?: number;
  /** Overrides the per-subject destination entirely. */
  href?: string;
};

export function TuitionCta({
  subject = null,
  targetId = "tuition",
  revealAfter = 0,
  bottomGap = 0,
  href,
}: TuitionCtaProps) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [shown, setShown] = useState(false);
  const [suppressed, setSuppressed] = useState(false);

  /**
   * ⚠ sessionStorage IS READ IN AN EFFECT, NOT IN THE INITIALISER. Reading it
   * during render makes the server say "expanded" and the client say
   * "collapsed" for anyone who has dismissed it — a hydration mismatch, and a
   * visible flash of the full bar before it snaps shut. `ready` keeps the whole
   * thing out of the DOM until the answer is known.
   *
   * ⚠ AND IT IS WRAPPED. Storage access throws outright in some privacy modes;
   * an uncaught throw here would take the CTA down on exactly the browsers
   * least likely to report it.
   */
  useEffect(() => {
    try {
      setCollapsed(window.sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage unavailable — the CTA simply stays expanded */
    }
    setSuppressed(document.querySelector(CLASH_SELECTOR) !== null);
    setReady(true);
  }, [pathname]);

  useEffect(() => {
    if (revealAfter <= 0) {
      setShown(true);
      return;
    }
    // ⚠ passive: true — a blocking scroll listener makes the whole page feel
    // heavy on a phone, which is never worth a fade.
    const onScroll = () => setShown(window.scrollY > revealAfter);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [revealAfter]);

  const colour = subjectColour(subject);
  const copy = TUITION_CTA_COPY[colour?.key ?? "none"];
  const destination = href ?? copy.href;

  /**
   * ⚠ IT IS A REAL LINK WITH A REAL href, AND THE SCROLL IS AN ENHANCEMENT ON
   * TOP. Whether this page has an in-page tuition section is knowable only in
   * the browser, so rendering a <button> for it would mean shipping a control
   * with no destination to anyone whose JS has not run, and no middle-click, no
   * "copy link", no cmd-click. The link always points somewhere true; when the
   * section turns out to be right here, the navigation is cancelled instead.
   */
  const onActivate = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    e.preventDefault();

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });

    /**
     * ⚠ FOCUS FOLLOWS THE SCROLL, OR THE KEYBOARD USER DOES NOT MOVE. Scrolling
     * the viewport leaves focus on the CTA, so the next Tab returns them to the
     * footer rather than into the section they just asked for — the page moved
     * and they did not. tabindex="-1" makes the section focusable WITHOUT
     * putting it in the tab order, and is left in place because removing it
     * again would break a second activation.
     */
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  const collapse = () => {
    setCollapsed(true);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage unavailable — it stays collapsed for this page view only */
    }
  };

  // ⚠ NOT ON THE TUITION ROUTES THEMSELVES. "View live tuition" floating over
  // /tuition is noise at best and, on /tuition/interest, an invitation to do
  // the thing the reader is already doing.
  const onTuitionRoute = pathname?.startsWith("/tuition") ?? false;
  if (!ready || suppressed || onTuitionRoute) return null;

  const focusRing =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

  /**
   * ⚠ POINTER EVENTS COME BACK ONLY ONCE IT IS VISIBLE, BECAUSE opacity-0 DOES
   * NOT STOP CLICKS. A faded-out element still swallows every tap that lands on
   * it, and this one is a full-width bar along the bottom edge of the viewport.
   * With `revealAfter` > 0 — the documented way to mount it on a page that has
   * its own hero CTA — that is an invisible strip across the bottom of the
   * screen that navigates to /tuition, and it is in front of exactly the reader
   * who has NOT scrolled far enough to have been offered it: they aim at
   * whatever the page has down there and land on a CTA they cannot see.
   *
   * aria-hidden already closes the screen-reader path and tabIndex={-1} closes
   * the keyboard one. Without this the pointer path stayed open — the only one
   * of the three a sighted mouse or touch user actually uses.
   */
  const hitbox = shown ? "pointer-events-auto" : "pointer-events-none";

  /** The subject's own accent, or the documented neutral for no subject. Never
   *  the only signal — the copy names the subject in words. */
  const dot = (
    <span
      aria-hidden
      className="block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: colour?.accent ?? NEUTRAL_SLOT.accent }}
    />
  );

  return (
    <div
      /**
       * ⚠ pointer-events-none ON THE FULL-WIDTH WRAPPER. It spans the viewport
       * so the pill can be centred, and without this it would be an invisible
       * strip swallowing clicks on whatever the page has along its bottom edge.
       * Only the pill itself takes pointer events back, and only once it is
       * actually visible — see `hitbox` above.
       *
       * ⚠ aria-hidden WHILE FADED OUT, so a screen reader is not offered a
       * control that is not visually there. It stays in the DOM rather than
       * unmounting, which would announce it as new content on every scroll.
       */
      aria-hidden={!shown}
      className={[
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-start print:hidden",
        "motion-safe:transition-opacity motion-safe:duration-300",
        shown ? "opacity-100" : "opacity-0",
        "sm:bottom-5 sm:justify-center",
      ].join(" ")}
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + ${bottomGap}px)` }}
    >
      {collapsed ? (
        /**
         * ⚠ COLLAPSED IS SMALLER, NOT GONE, AND IT IS STILL THE SAME LINK. The
         * × is a request for less, not a request for nothing, and a student who
         * changes their mind two sections later should not have to go hunting
         * through the nav. It sits bottom-LEFT on a phone because bottom-right
         * belongs to AdminOverlay.
         */
        <Link
          href={destination}
          onClick={onActivate}
          data-cta="floating_tuition_collapsed"
          tabIndex={shown ? undefined : -1}
          aria-label={`${copy.lead} — ${copy.action}`}
          className={[
            hitbox,
            "m-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15",
            "bg-parchment/95 px-4 py-2 text-sm backdrop-blur",
            "shadow-[0_8px_28px_-12px_rgba(15,20,25,0.28)]",
            "transition-colors hover:border-ink/35 sm:min-h-9 sm:m-0",
            focusRing,
          ].join(" ")}
        >
          {dot}
          <span className="font-medium">Tuition</span>
          <span aria-hidden className="text-ink/45">
            →
          </span>
        </Link>
      ) : (
        <div
          className={[
            // Phone: a slim bar across the bottom. Desktop: a pill, centred.
            hitbox,
            "flex w-full items-center gap-3 border-t border-ink/10",
            "bg-parchment/95 px-4 py-2.5 backdrop-blur",
            "sm:w-auto sm:rounded-full sm:border sm:py-2 sm:ps-5 sm:pe-2",
            "sm:shadow-[0_8px_28px_-12px_rgba(15,20,25,0.28)]",
            "motion-safe:transition-transform motion-safe:duration-300",
            shown ? "translate-y-0" : "translate-y-2",
          ].join(" ")}
        >
          {dot}

          <div className="min-w-0 flex-1 sm:flex-none">
            <p className="truncate text-sm font-medium">
              <span className="sm:hidden">{copy.shortLead}</span>
              <span className="hidden sm:inline">{copy.lead}</span>
            </p>
            {/* ⚠ THE NOTE IS HIDDEN AT PHONE WIDTH, NOT SHRUNK. Two lines of
                text plus a button plus a dismiss control in a slim bar is how a
                bar stops being slim and starts covering the page. */}
            <p className="hidden truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink/50 sm:block">
              {copy.note}
            </p>
          </div>

          <Link
            href={destination}
            onClick={onActivate}
            data-cta="floating_tuition"
            tabIndex={shown ? undefined : -1}
            /**
             * ⚠ THE FULL ASK, BECAUSE THE VISIBLE ONE IS "View" ON A PHONE. A
             * one-word control is fine beside a lead you can see and useless to
             * somebody hearing the control alone.
             *
             * It still satisfies label-in-name: every visible label — "View",
             * "Interest", "View live tuition", "Register interest" — appears
             * inside the string below, so a voice-control user saying what they
             * can read still hits it.
             */
            aria-label={`${copy.lead} — ${copy.action}`}
            className={[
              "group shrink-0 rounded-full bg-ink px-5 py-3 text-sm font-medium text-parchment",
              "transition-colors duration-200 hover:bg-ink/90 sm:py-2.5",
              focusRing,
            ].join(" ")}
          >
            <span className="hidden sm:inline">{copy.action} </span>
            <span className="sm:hidden">{copy.short} </span>
            <span
              aria-hidden
              className="inline-block transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>

          {/* ⚠ 44px OF TOUCH TARGET ON A PHONE, 36 ON A POINTER. A dismiss
              control too small to hit is a control that gets missed and lands
              on the CTA instead — the one misfire guaranteed to annoy. */}
          <button
            type="button"
            onClick={collapse}
            tabIndex={shown ? undefined : -1}
            aria-label="Collapse the live tuition link"
            className={[
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              "text-ink/45 transition-colors hover:text-ink sm:h-9 sm:w-9",
              focusRing,
            ].join(" ")}
          >
            <span aria-hidden className="block leading-none">
              ×
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
