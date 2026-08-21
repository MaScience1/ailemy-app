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
 * glance and costs about 40px.
 *
 * ⚠ EVERY ITEM GOES SOMEWHERE REAL (§50). There are no decorative chips here.
 * An item with no destination is not rendered at all rather than rendered dead
 * — which is why `href` is required rather than optional.
 *
 * ⚠ AND NOTHING HERE CLAIMS A FEATURE THAT DOES NOT WORK. "AI marking" links to
 * the marking demonstration, not to a page that says "coming soon"; progress
 * tracking links to the profile, which exists and shows real progress shapes.
 */

type Capability = { label: string; href: string; note?: string };

/**
 * ⚠ ORDER IS THE STUDENT'S JOURNEY, NOT ALPHABETICAL AND NOT BY IMPORTANCE.
 * Learn → practise → get marked → track → live help. A student scanning left to
 * right reads the product's shape, which is the same shape §26's learning loop
 * spells out further down the page.
 */
const CAPABILITIES: Capability[] = [
  { label: "Lessons", href: "/learn" },
  { label: "Revision", href: "/resources" },
  { label: "Past papers", href: "/past-papers" },
  { label: "Exam questions", href: "/past-papers" },
  { label: "Marking", href: "/#marking" },
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
       * ⚠ A LIST, SO A SCREEN READER ANNOUNCES "7 ITEMS". Rendering these as
       * loose spans would read as one run-on sentence, and the whole point of
       * the strip is that it is a countable inventory of what you get.
       *
       * ⚠ SCROLLS SIDEWAYS ON A PHONE RATHER THAN WRAPPING TO FOUR LINES.
       * Seven items wrapped at 375px becomes a paragraph-shaped block that
       * looks like body copy; one scrollable row keeps it reading as a strip.
       * The fade at the right edge signals there is more.
       */}
      <ul className="-mx-6 flex snap-x gap-x-6 gap-y-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CAPABILITIES.map((c) => (
          <li key={c.label} className="shrink-0 snap-start">
            <Link
              href={c.href}
              className="group inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] text-ink/55 transition-colors duration-200 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              {/* The lime dot is the existing brand mark, reused rather than
                  invented — and it is decorative, so it is hidden. */}
              <span aria-hidden className="h-1 w-1 rounded-full bg-lime opacity-60 transition-opacity duration-200 group-hover:opacity-100" />
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
