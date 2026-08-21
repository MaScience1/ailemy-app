import Link from "next/link";

/**
 * The product capability strip (§2).
 *
 * ============================================================================
 * ⚠ ITS JOB IS THE THREE-SECOND READ, SO IT MUST NOT BE CARDS
 * ============================================================================
 * §2 asks for capabilities exposed "directly beneath or visually integrated
 * into the hero" and explicitly says not to create large distracting cards. A
 * card grid competes with the hero it is meant to support and pushes the fold
 * down; a single dense line reads as "this is what the platform does" in one
 * glance.
 *
 * ⚠ EVERY ITEM GOES SOMEWHERE REAL (§50). There are no decorative chips here.
 * An item with no destination is not rendered at all rather than rendered dead
 * — which is why `href` is required rather than optional.
 *
 * ⚠ AND NOTHING HERE CLAIMS A FEATURE THAT DOES NOT WORK. "Online marking"
 * links to the marking demonstration, not to a page saying "coming soon";
 * progress tracking links to the profile, which exists and shows real shapes.
 *
 * ============================================================================
 * ⚠ TWO LINES AT DESKTOP, AND THAT IS ARITHMETIC RATHER THAN TASTE
 * ============================================================================
 * This strip used to be sized to hold one desktop line: seven items at 13px
 * measured 988px of the 1104px content box, with 115px to spare. The ruling
 * asks for a clear step up in size AND a capsule around each item, and those
 * two do not both fit:
 *
 *   text at 13px            868px  +  6 gaps        =  988px   fits
 *   text at 15px           1002px  +  capsules      = ~1250px  does not
 *
 * A capsule costs ~32px of horizontal padding per item — 224px across seven,
 * which is on its own nearly twice the headroom the old layout had. So the
 * ruling's own fallback applies: WRAP, do not shrink the text.
 *
 * ⚠ AND THE TWO LINES ARE BALANCED BY CONSTRAINING THE ROW, NOT BY SPLITTING
 * THE LIST. Left to itself in a 1104px box, flex-wrap fills greedily and
 * breaks 5+2 — a long first line and a stub. Capping the row's width so a
 * fifth capsule cannot fit produces 4+3, which is the balance the ruling asks
 * for, WITHOUT hard-coding which item starts line two. Add an eighth item and
 * it rebalances on its own; a hand-split list would silently keep the old one.
 *
 * ⚠ THE PHONE IS UNCHANGED — one sideways-scrolling row. Seven capsules
 * wrapped at 375px is four ragged lines that read as a paragraph of buttons.
 *
 * ============================================================================
 * ⚠ THE CAPSULE: HAIRLINE AT REST, FOIL ON HOVER — AND THE MEASURED REASONS
 * ============================================================================
 * Outlined-at-rest rather than tinted-at-rest, because seven tinted blobs
 * sitting under the hero read as a filter row on a shop. A hairline reads as
 * something engraved on the page. The tint that IS there is 8% and does the
 * job of making the capsule a shape rather than an outline floating in space.
 *
 * ⚠ THE TEXT COLOUR CHANGED, AND HERE IS THE HONEST VERSION OF WHY. An earlier
 * draft of this comment claimed the capsule pushed ink/60 below AA — 4.46:1.
 * That number came from compositing the translucent ink over the PAGE and then
 * measuring it against the CAPSULE, which is the wrong ground: semi-transparent
 * text composites over whatever sits directly behind it, and behind it is the
 * capsule. Recomputed correctly, ink/60 on the capsule is 4.58:1. It does NOT
 * fail. The capsule costs it 0.05, not 0.12, and it stays over the line.
 *
 * The change is still worth making, for the smaller and truer reason: 4.58:1 is
 * the thinnest text margin on this page, and a strip that just got bigger and
 * gained a tinted ground is the wrong place to keep the page's least headroom.
 * ink/70 on the same capsule measures 6.38:1. What is NOT true is that anything
 * was broken before.
 *
 * ⚠ THE HOVER FILL IS A TWO-STOP RAMP, NOT THE THREE-STOP RIBBON RAMP. The
 * card ribbon runs #D9C08A → #B08D57 → #8C6A3F, and ink on that last stop is
 * 3.75:1 — large-text only, a fail for 15px. Reusing the ribbon gradient here
 * because it is "the established ramp" would have shipped unreadable text on
 * every hover. Stopping at #B08D57 holds ink at 5.99:1 across the whole pill,
 * and two stops still read as foil rather than as a flat brown hex.
 *
 *   rest    #F3EBDF capsule, #B08D57/55 hairline, ink/70 text   6.38:1
 *   hover   #D9C08A → #B08D57 fill,               ink text      5.99:1 worst
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
 * being an indicator the moment somebody restyles the decoration. The offset
 * came down from 6px to 2px: 6px existed to clear an underline that no longer
 * exists, and at 6px the ring now collides with the neighbouring capsule.
 */

type Capability = { label: string; href: string };

/**
 * ⚠ ORDER IS THE STUDENT'S JOURNEY, NOT ALPHABETICAL AND NOT BY IMPORTANCE.
 * Learn → practise → get marked → track → live help. Scanning left to right
 * reads the product's shape, which is the shape §26's learning loop spells out
 * further down the page.
 */
const CAPABILITIES: Capability[] = [
  { label: "Lessons", href: "/learn" },
  { label: "Revision", href: "/resources" },
  { label: "Past papers", href: "/past-papers" },
  { label: "Exam questions", href: "/past-papers" },
  { label: "Online marking", href: "/#try" },
  { label: "Progress tracking", href: "/profile" },
  { label: "Live tuition", href: "/tuition" },
];

export function CapabilityStrip() {
  return (
    <nav
      aria-label="What Ailemy includes"
      className="mx-auto max-w-6xl px-6 pb-10 sm:pb-14"
    >
      {/**
       * ⚠ A LIST, SO A SCREEN READER ANNOUNCES "7 ITEMS". Loose spans would read
       * as one run-on sentence, and the whole point of the strip is that it is a
       * countable inventory of what you get.
       *
       * ⚠ THE max-w IS THE LINE-BALANCER. It is deliberately narrower than the
       * 1104px container: four capsules measure ~654px and a fifth would take it
       * past 860px, so a cap in between forces the break after four and leaves
       * three on line two. Widen it and the layout silently goes back to 5+2.
       * `mx-auto` then centres the block, which is what stops two ragged lines
       * from reading as a left-aligned overflow.
       *
       * ⚠ py-1.5 ON THE ROW EXISTS FOR THE SCALE. Without vertical room the
       * enlarged capsule is clipped by the scroll container on a phone.
       */}
      <ul
        className={[
          // phone: one sideways-scrolling row, scrollbar hidden
          // ⚠ gap-4 RATHER THAN gap-3 IS THE FOCUS RING'S CLEARANCE. A focused
          // capsule scales 1.06, which eats ~5px of the gap on that side, and
          // the ink ring then reaches 4px further out. At 12px that left 2px of
          // daylight between a focused pill and its neighbour; at 16px it is 7.
          "-mx-6 flex snap-x gap-x-4 gap-y-3 overflow-x-auto px-6 py-1.5",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // desktop: wrap, centred, capped so the break lands 4+3
          "sm:mx-auto sm:max-w-[720px] sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0",
        ].join(" ")}
      >
        {CAPABILITIES.map((c) => (
          <li key={c.label} className="shrink-0 snap-start">
            <Link
              href={c.href}
              className={[
                "group relative inline-flex items-center gap-2 whitespace-nowrap rounded-full",
                // ⚠ ASYMMETRIC PADDING IS AN OPTICAL FIX, NOT A TYPO. Letter
                // spacing is applied AFTER the last character too, so 0.14em of
                // air rides along inside the capsule on the right only. Taking
                // it back off the right padding re-centres the word in the pill.
                "py-2 pl-4 pr-[calc(1rem_-_0.14em)]",
                "font-mono text-[15px] uppercase tracking-[0.14em]",
                "border border-[#B08D57]/55 bg-[#D9C08A]/[0.08] text-ink/70",
                "transition-[color,background-color,border-color,transform,box-shadow] duration-200 ease-out",

                // ── hover / focus-visible: the capsule fills with foil ───────
                // Two stops, not the ribbon's three — ink on #8C6A3F is 3.75:1
                // and fails at this size. See the header.
                "hover:border-[#B08D57] hover:bg-[linear-gradient(100deg,#D9C08A_0%,#B08D57_100%)] hover:text-ink",
                "focus-visible:border-[#B08D57] focus-visible:bg-[linear-gradient(100deg,#D9C08A_0%,#B08D57_100%)] focus-visible:text-ink",
                "hover:shadow-[0_2px_10px_-4px_rgba(140,106,63,0.55)]",
                "focus-visible:shadow-[0_2px_10px_-4px_rgba(140,106,63,0.55)]",

                // ⚠ THE GROW IS UNCHANGED FROM THE PREVIOUS RULING — 1.06, 200ms,
                // motion-safe. The origin moved from bottom to centre: it sat at
                // the bottom so the item grew up out of its underline, and with
                // the underline gone a pill should swell about its own middle.
                "origin-center motion-safe:hover:scale-[1.06] motion-safe:focus-visible:scale-[1.06]",

                // ⚠ THE RING IS NOT THE BUBBLE. Separate indicator, outside the
                // capsule, 2px offset — 6px was sized to clear the old underline
                // and now runs into the neighbouring pill.
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              ].join(" ")}
            >
              {/* The lime dot is the existing brand mark, reused rather than
                  invented — decorative, so hidden from the accessibility tree.
                  It darkens to ink on hover: #B8FF3D on gold foil is the one
                  pairing in this palette that genuinely clashes, and the dot is
                  4px, so it reads as a bullet either way. */}
              <span
                aria-hidden
                className="h-1 w-1 shrink-0 rounded-full bg-lime opacity-70 transition-colors duration-200 group-hover:bg-ink group-hover:opacity-100 group-focus-visible:bg-ink group-focus-visible:opacity-100"
              />
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
