
import { SmartLink as Link } from "@/components/i18n/SmartLink";

/**
 * The product capability strip (§2).
 *
 * ============================================================================
 * ⚠ IT IS A TITLED BAND NOW, NOT A HERO APPENDAGE. THIS SUPERSEDES §2's
 * "DIRECTLY BENEATH OR VISUALLY INTEGRATED INTO THE HERO".
 * ============================================================================
 * §2 asked for the capabilities to sit immediately under the hero and told us
 * not to build large distracting cards. This component honoured that literally
 * and two things went wrong with it.
 *
 * The first is that an unlabelled row of 15px mono chips reads as METADATA —
 * the tag line under a blog post — rather than as the seven things the product
 * does. Nothing on the page said what the row was, so it was scanned past.
 *
 * The second is that it sat ABOVE the three sciences, which meant the first
 * structural question a visitor asks ("do you even teach my subject?") was
 * answered after a feature list for a course they had not yet found. Founder
 * direction on 2026-08-23 reversed both: the sciences come first, and this
 * strip gets its own band with an h2 over it.
 *
 * ⚠ THE ANTI-CARD HALF OF §2 STILL STANDS AND IS STILL HONOURED. These are
 * capsules on one wrapped row — no borders around body copy, no seven-card
 * grid competing with the subject cards directly above. What changed is their
 * SIZE and their PLACE. Their form did not.
 *
 * ============================================================================
 * ⚠ EVERY ITEM GOES SOMEWHERE REAL (§50) — AND NOTHING AUTOMATED CHECKS THAT
 * ============================================================================
 * There are no decorative chips here; an item with no destination is not
 * rendered at all rather than rendered dead, which is why `href` is required
 * rather than optional.
 *
 * But route-integrity.test.ts CANNOT SEE THESE HREFS. It scans src/ for the
 * literal token `href=`, and these live in a data array as `href:`. Every path
 * below was therefore resolved BY HAND against the src/app router tree on
 * 2026-08-23 — /learn, /resources, /past-papers, /profile, /login and /tuition
 * all have a real page.tsx; /#try is a section that exists on this same page.
 * If you add an item here, resolve it yourself. Nothing downstream will.
 *
 * ⚠ AND NOTHING HERE CLAIMS A FEATURE THAT DOES NOT WORK. "Online marking"
 * links to the marking demonstration further down this page — the real marker,
 * not a page saying "coming soon".
 *
 * ============================================================================
 * ⚠ TWO LINES AT DESKTOP, AND THAT IS ARITHMETIC RATHER THAN TASTE
 * ============================================================================
 * The font is JetBrains Mono, whose advance is exactly 0.6em, and the tracking
 * is 0.14em — so a character costs 0.74em, or 12.58px at 17px. The chrome
 * around the word costs 24px of left padding, ~21.6px of right (see the
 * optical note below), 2px of border, a 6px dot and a 10px gap: ~63.6px.
 *
 *   LESSONS            152      EXAM QUESTIONS      240
 *   REVISION           164      ONLINE MARKING      240
 *   PAST PAPERS        202      PROGRESS TRACKING   277
 *                              LIVE TUITION         215
 *
 * With a 20px gap that is 818px for the first four, 1078px if a fifth joins
 * them, and 772px for the remaining three. The content box is 1104px — so left
 * to itself flex-wrap fills greedily and breaks 5+2: a long first line and a
 * stub. Capping the ROW at 940px sits above 818 and below 1078, which forces
 * the break after four and produces 4+3.
 *
 * ⚠ THE CAP IS NOT A HAND-SPLIT LIST, AND THAT IS THE POINT. Add an eighth
 * capability and the layout rebalances on its own; a list split in two by hand
 * would silently keep today's arrangement forever.
 *
 * ⚠ THE MARGIN EITHER SIDE OF 940 IS ~13%, WHICH IS WHY THE CAP IS TRUSTWORTHY.
 * The figures above are computed, not measured, and a font-metric surprise of a
 * few percent must not flip the break. At 18px the five-item line would measure
 * 1117px against a 1104px box — a 1% margin, i.e. a layout that only looks
 * correct until something rounds the other way. That is the reason the type
 * stops at 17px rather than going further.
 *
 * ⚠ THE PHONE IS UNCHANGED — one sideways-scrolling row. Seven capsules this
 * size wrapped at 375px is five ragged lines that read as a paragraph of
 * buttons.
 *
 * ⚠ THE BLOCK IS LEFT-ALIGNED NOW, NOT CENTRED. It used to be `mx-auto`,
 * because two ragged lines floating under the hero with no heading read as an
 * overflow rather than as a layout. There is an h2 above it now, so the pills
 * align to the same left edge as every other band on the page and the heading
 * does the anchoring the centring used to do.
 *
 * ============================================================================
 * ⚠ THE SIZE WENT UP; THE CONTRAST THRESHOLD DID NOT
 * ============================================================================
 * Type moved 15px → 17px. WCAG "large text" begins at 24px regular (or 18.66px
 * bold), so 17px is still NORMAL text and the requirement is still 4.5:1 —
 * exactly as it was. Contrast ratios are a property of the colour pair and not
 * of the size, so every figure below is unchanged and still applies. Growing
 * the strip bought no headroom and cost none.
 *
 *   rest    #F3EBDF capsule, #B08D57/55 hairline, ink/70 text   6.38:1
 *   hover   #D9C08A → #B08D57 fill,               ink text      5.99:1 worst
 *
 * ⚠ THE TEXT COLOUR IS ink/70, AND HERE IS THE HONEST VERSION OF WHY. An
 * earlier draft of this comment claimed the capsule pushed ink/60 below AA —
 * 4.46:1. That number came from compositing the translucent ink over the PAGE
 * and then measuring it against the CAPSULE, which is the wrong ground:
 * semi-transparent text composites over whatever sits directly behind it, and
 * behind it is the capsule. Recomputed correctly, ink/60 on the capsule is
 * 4.58:1. It does NOT fail. The capsule costs it 0.05, not 0.12.
 *
 * The change was still worth making, for the smaller and truer reason: 4.58:1
 * is the thinnest text margin on this page, and the strip that just got bigger
 * again is the wrong place to keep the page's least headroom. What is NOT true
 * is that anything was broken before.
 *
 * ⚠ THE HOVER FILL IS A TWO-STOP RAMP, NOT THE THREE-STOP RIBBON RAMP. The
 * card ribbon runs #D9C08A → #B08D57 → #8C6A3F, and ink on that last stop is
 * 3.75:1 — large-text only, which 17px is not. Reusing the ribbon gradient here
 * because it is "the established ramp" would have shipped unreadable text on
 * every hover. Stopping at #B08D57 holds ink at 5.99:1 across the whole pill,
 * and two stops still read as foil rather than as a flat brown hex.
 *
 * ⚠ THE HOVER FIGURE NEEDS NO COMPOSITING AND THAT IS WHY IT IS TRUSTWORTHY.
 * Both gradient stops are opaque, so ink sits on a known flat colour at every
 * point of the sweep and 5.99:1 is the floor by construction — no ground to get
 * wrong. The rest figure is the one that had to be derived carefully, and was
 * derived wrongly the first time.
 *
 * ⚠ KNOWN LIMIT — WINDOWS HIGH CONTRAST. In forced-colors mode a gradient is
 * not painted, so the hover FILL disappears. Nothing becomes illegible: the
 * capsule is a real `border` rather than a box-shadow, so it is re-coloured to
 * a system colour and survives, the text takes the system foreground, and the
 * focus `outline` is re-coloured too — so the state that MUST be perceivable
 * still is. What is lost is hover emphasis for a pointer user who already has a
 * cursor. This is stated rather than patched because a forced-colors rule
 * cannot be verified from this browser, and an unverified accessibility fix is
 * worth less than an accurate note about a known gap.
 *
 * ⚠ THE FOCUS RING IS STILL A SEPARATE THING. The capsule changes on
 * focus-visible exactly as it does on hover, and an ink outline sits outside
 * it — because a decorative fill that doubles as the focus indicator stops
 * being an indicator the moment somebody restyles the decoration.
 *
 * ⚠ THE TAP TARGET CLEARS BOTH TARGET-SIZE CRITERIA WITH ROOM. 12px of vertical
 * padding either side of a 1.35 line box on 17px type, plus the border, is a
 * ~49px capsule — over WCAG 2.2's 24px minimum (2.5.8, AA) and over the 44px
 * enhanced figure (2.5.5, AAA). The narrowest pill is ~152px wide. The old
 * strip was ~38px tall and cleared only the first of those.
 */

export type Capability = {
  label: string;
  href: string;
  /**
   * One line saying what the capability actually does (§8).
   *
   * ⚠ IT LIVES ON THE CAPABILITY, NOT IN A MAP KEYED BY LABEL. A parallel
   * `Record<label, string>` beside this list is a second representation that
   * drifts the moment a label is reworded — the same shape this codebase has
   * removed twice, and the strip's own count is already exported rather than
   * typed for exactly that reason. Adding an eighth capability now forces its
   * description to be written at the same moment, in the same place.
   */
  blurb: string;
};

/**
 * ⚠ ORDER IS THE STUDENT'S JOURNEY, NOT ALPHABETICAL AND NOT BY IMPORTANCE.
 * Learn → practise → get marked → track → live help. Scanning left to right
 * reads the product's shape, which is the shape §26's learning loop spells out
 * further down the page.
 *
 * ⚠ "PAST PAPERS" AND "EXAM QUESTIONS" SHARE A DESTINATION, DELIBERATELY.
 * There is no standalone exam-questions index: the only such route is
 * /learn/[subject]/[pathway]/[course]/exam-questions, which cannot be linked
 * without a course, and every question a student can attempt today reaches them
 * through a paper. Sending both to /past-papers is the honest answer. Inventing
 * a separate URL so the two chips could differ would be a dead link with a
 * tidier-looking list.
 *
 * ⚠ PROGRESS TRACKING IS THE ONE THAT DEPENDS ON WHO IS ASKING. /profile
 * redirects a stranger to `/login?next=/profile` anyway, so linking it
 * unconditionally would work — but the href would be a small lie, and a signed-
 * out visitor would take a bounce to arrive at a sign-in wall the link never
 * mentioned. Naming the login route when there is nobody to show progress FOR
 * is the honest version of the same journey, and `next=` still lands them on
 * their own progress the moment they are in.
 */
/**
 * ⚠ EXPORTED SO THE EXPLORE PANEL REUSES IT RATHER THAN RETYPING SEVEN HREFS.
 * §3 of the relocation brief is explicit: destinations come from the existing
 * source, unchanged. Two copies of this list would mean two answers to "where
 * does Progress tracking go for a signed-out visitor", and only one of them
 * would keep the `next=` behaviour the note above argues for.
 */
export function capabilitiesFor(signedIn: boolean): Capability[] {
  return [
    { label: "Lessons", href: "/learn",
      blurb: "Learn each specification point, step by step." },
    { label: "Revision", href: "/resources",
      blurb: "Review the key ideas with notes, flashcards and worked examples." },
    { label: "Past papers", href: "/past-papers",
      blurb: "Sit complete exam papers and have them marked." },
    { label: "Exam questions", href: "/past-papers",
      blurb: "Practise the question styles the exam actually uses." },
    { label: "Online marking", href: "/#try",
      blurb: "Write an answer and see it marked against the real scheme." },
    { label: "Progress tracking", href: signedIn ? "/profile" : "/login?next=/profile",
      blurb: "See what you have covered and where the marks are going." },
    { label: "Live tuition", href: "/tuition",
      blurb: "Small-group teaching and 1-to-1 time with a specialist." },
  ];
}

/**
 * ⚠ THE BAND'S LEDE COUNTS THESE OUT LOUD, SO THE COUNT IS EXPORTED RATHER
 * THAN TYPED IN page.tsx. The header above explicitly invites an eighth
 * capability — "add an eighth and the layout rebalances on its own" — and a
 * number written by hand in the other file would go stale the moment somebody
 * accepted that invitation, with nothing failing to say so. A count that
 * models a list has to be derived from the list; see AGENTS.md.
 *
 * `signedIn` swaps ONE href and never the length, so `false` is a safe
 * argument to count with.
 */
export const CAPABILITY_COUNT = capabilitiesFor(false).length;

/**
 * @param labelledBy id of the visible heading that names this nav. Required
 *   rather than optional: the strip has a heading over it now, and a second
 *   hand-written aria-label in this file is a copy of that heading waiting to
 *   disagree with it.
 */
export function CapabilityStrip({
  signedIn, labelledBy,
}: { signedIn: boolean; labelledBy: string }) {
  return (
    <nav aria-labelledby={labelledBy}>
      {/**
        * ⚠ A LIST, SO A SCREEN READER ANNOUNCES "7 ITEMS". Loose spans would
        * read as one run-on sentence, and the whole point of the strip is that
        * it is a countable inventory of what you get.
        *
        * ⚠ THE sm:max-w IS THE LINE-BALANCER, NOT A CONTAINER. 940px sits
        * between the 818px four-capsule line and the 1078px five-capsule one,
        * so the break lands 4+3 without hard-coding which item starts line two.
        * Widen it and the layout silently goes back to 5+2. See the header.
        *
        * ⚠ py-2 ON THE ROW EXISTS FOR THE SCALE. A hovered capsule grows 6% and
        * the focus ring sits 4px outside that; without vertical room the phone's
        * scroll container clips both.
        */}
      <ul
        className={[
          // phone: one sideways-scrolling row, scrollbar hidden
          // ⚠ THE GAP IS THE FOCUS RING'S CLEARANCE, AND IT IS COMPUTED PER
          // BREAKPOINT, BECAUSE BOTH THE GAP AND THE PILL CHANGE SIZE AT sm.
          // A focused capsule scales 1.06, so each edge moves out by 3% of the
          // capsule's own width, and the ink ring reaches 4px past that:
          //
          //   phone  16px type, widest pill 265px  →  7.9 + 4 = 11.9px used
          //          of the 16px `gap-x-4` below   →  ~4px of daylight left
          //   sm+    17px type, widest pill 277px  →  8.3 + 4 = 12.3px used
          //          of the 20px `sm:gap-x-5`      →  ~8px of daylight left
          //
          // ⚠ THE PHONE IS THE TIGHTER OF THE TWO, so it is the figure to
          // recheck if the type or the horizontal padding grows again. Reading
          // the desktop number and assuming it covers both is how a focus ring
          // ends up overlapping its neighbour on the only device that scrolls.
          "-mx-6 flex snap-x gap-x-4 gap-y-4 overflow-x-auto px-6 py-2",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // desktop: wrap, left-aligned to the heading, capped so the break is 4+3
          "sm:mx-0 sm:max-w-[940px] sm:flex-wrap sm:gap-x-5 sm:overflow-visible sm:px-0",
        ].join(" ")}
      >
        {capabilitiesFor(signedIn).map((c) => (
          <li key={c.label} className="shrink-0 snap-start">
            <Link
              href={c.href}
              className={[
                "group relative inline-flex items-center gap-2.5 whitespace-nowrap rounded-full",
                // ⚠ ASYMMETRIC PADDING IS AN OPTICAL FIX, NOT A TYPO. Letter
                // spacing is applied AFTER the last character too, so 0.14em of
                // air rides along inside the capsule on the right only. Taking
                // it back off the right padding re-centres the word in the pill.
                // In `em` rather than px so it tracks the phone's smaller type.
                "py-3 ps-6 pe-[calc(1.5rem_-_0.14em)]",
                // ⚠ leading IS EXPLICIT BECAUSE THE TAP TARGET DEPENDS ON IT. An
                // inherited line-height would make the capsule's height a
                // property of whatever this component is dropped inside.
                "font-mono text-[16px] uppercase leading-[1.35] tracking-[0.14em] sm:text-[17px]",
                "border border-[#B08D57]/55 bg-[#D9C08A]/[0.08] text-ink/70",
                "transition-[color,background-color,border-color,transform,box-shadow] duration-200 ease-out",

                // ── hover / focus-visible: the capsule fills with foil ───────
                // Two stops, not the ribbon's three — ink on #8C6A3F is 3.75:1
                // and fails at this size. See the header.
                "hover:border-[#B08D57] hover:bg-[linear-gradient(100deg,#D9C08A_0%,#B08D57_100%)] hover:text-ink",
                "focus-visible:border-[#B08D57] focus-visible:bg-[linear-gradient(100deg,#D9C08A_0%,#B08D57_100%)] focus-visible:text-ink",
                "hover:shadow-[0_3px_14px_-5px_rgba(140,106,63,0.6)]",
                "focus-visible:shadow-[0_3px_14px_-5px_rgba(140,106,63,0.6)]",

                // ⚠ THE GROW IS UNCHANGED — 1.06, 200ms, motion-safe. It is not
                // scaled back for the bigger pill: 6% of a large capsule is a
                // larger absolute movement, which is exactly the point, and the
                // gap above was recomputed to carry it.
                "origin-center motion-safe:hover:scale-[1.06] motion-safe:focus-visible:scale-[1.06]",

                // ⚠ THE RING IS NOT THE BUBBLE. Separate indicator, outside the
                // capsule, 2px offset — the state that must be perceivable does
                // not depend on the decoration staying decorative.
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              ].join(" ")}
            >
              {/* The lime dot is the existing brand mark, reused rather than
                  invented — decorative, so hidden from the accessibility tree.
                  It darkens to ink on hover: #B8FF3D on gold foil is the one
                  pairing in this palette that genuinely clashes, and at 6px it
                  reads as a bullet either way. */}
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime opacity-70 transition-colors duration-200 group-hover:bg-ink group-hover:opacity-100 group-focus-visible:bg-ink group-focus-visible:opacity-100"
              />
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
