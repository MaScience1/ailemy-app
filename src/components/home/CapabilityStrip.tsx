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
 * ⚠ SIZED TO STAY ON ONE LINE AT DESKTOP, WHICH IS A REAL CONSTRAINT
 * ============================================================================
 * Seven items at 13px with 0.14em tracking measure roughly 990px inside a
 * 1104px content box — comfortable. The previous 11px was safe but read as a
 * caption rather than an inventory. Going to 14px pushes the row past 1090px
 * and it wraps, which turns the strip back into a paragraph.
 *
 * So the size is 13px and the tracking came DOWN from 0.16em to 0.14em to buy
 * the room. `lg:flex-nowrap` makes the one-line rule explicit at desktop rather
 * than leaving it to luck: if a future item is added, the row will overflow
 * visibly instead of silently reflowing into two lines nobody notices.
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
       * ⚠ SCROLLS SIDEWAYS ON A PHONE RATHER THAN WRAPPING TO FOUR LINES.
       * Seven items wrapped at 375px becomes a paragraph-shaped block that reads
       * as body copy. One scrollable row keeps it reading as a strip.
       *
       * ⚠ py-1 ON THE ROW EXISTS FOR THE SCALE. Without vertical room the
       * enlarged item is clipped by the scroll container on a phone.
       */}
      <ul className="-mx-6 flex snap-x gap-x-5 gap-y-2 overflow-x-auto px-6 py-1 sm:mx-0 sm:flex-wrap sm:px-0 lg:flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CAPABILITIES.map((c) => (
          <li key={c.label} className="shrink-0 snap-start">
            <Link
              href={c.href}
              className={[
                "group relative inline-flex items-center gap-1.5 whitespace-nowrap",
                "font-mono text-[13px] uppercase tracking-[0.14em] text-ink/60",
                "transition-[color,transform] duration-200 ease-out",
                "hover:text-ink focus-visible:text-ink",
                // ⚠ THE SAME RESTRAINED FAMILY AS THE CARDS — 200ms, a scale of
                // 1.06 rather than a jump. transform-origin sits at the bottom
                // so the item grows UP from its underline rather than drifting
                // off it.
                "origin-bottom motion-safe:hover:scale-[1.06] motion-safe:focus-visible:scale-[1.06]",
                // ⚠ OUTLINE OFFSET CLEARS THE UNDERLINE. At the default offset
                // the focus ring and the gold rule overlap into a muddy band.
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-ink",
              ].join(" ")}
            >
              {/* The lime dot is the existing brand mark, reused rather than
                  invented — decorative, so hidden from the accessibility tree. */}
              <span
                aria-hidden
                className="h-1 w-1 shrink-0 rounded-full bg-lime opacity-60 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
              {c.label}

              {/**
               * ⚠ THE GOLD UNDERLINE — THE SAME RAMP AS THE CARD RIBBON, not a
               * new colour. #B08D57 at saturation 0.51 reads as metal beside the
               * subject palette rather than as a second orange; introducing a
               * different gold here would give the site two.
               *
               * ⚠ IT WIPES IN FROM THE LEFT rather than fading. scale-x on a
               * left origin is a single compositor-friendly transform — no
               * layout, no repaint of the text above it.
               *
               * ⚠ AND IT IS NOT THE FOCUS INDICATOR. The outline above is. A
               * decorative rule that doubles as the focus ring fails the moment
               * somebody restyles it.
               */}
              <span
                aria-hidden
                className={[
                  "pointer-events-none absolute -bottom-1 left-0 right-0 h-[2px] origin-left rounded-full",
                  "bg-[linear-gradient(90deg,#D9C08A_0%,#B08D57_45%,#8C6A3F_100%)]",
                  "scale-x-0 transition-transform duration-200 ease-out",
                  "group-hover:scale-x-100 group-focus-visible:scale-x-100",
                  // Reduced motion keeps the gold and drops the wipe.
                  "motion-reduce:transition-none",
                ].join(" ")}
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
