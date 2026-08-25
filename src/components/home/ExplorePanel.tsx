"use client";

import { useState } from "react";
import Link from "next/link";

import { capabilitiesFor } from "./CapabilityStrip";

/**
 * The seven capabilities, beside the calendar (§1–§9 of the relocation brief).
 *
 * ============================================================================
 * ⚠ RELOCATED, NOT DUPLICATED — AND THE SEVEN HREFS ARE NOT RETYPED HERE
 * ============================================================================
 * capabilitiesFor() is the single source; §3 forbids a second copy and the
 * reason is concrete. "Progress tracking" points at /profile for a student and
 * at /login?next=/profile for a stranger, so a hand-copied list would either
 * lose that distinction or drift from it. The band lower down the page is
 * removed in the same commit, so there is one presentation, not two.
 *
 * ⚠ THE PANEL SITS UNDER THE HERO COPY, NOT TO THE RIGHT OF THE CALENDAR.
 * The brief describes filling space to the calendar's right; measured, there
 * is none — the calendar already ends 24px from the container edge at 1920px.
 * The dead space is on the LEFT: the copy column runs 419px against the
 * calendar's 735px, leaving ~316px empty beside the lower half of the card.
 * That is the gap this fills, which is the objective the brief actually
 * states, and it leaves the calendar exactly where §11 requires.
 *
 * ⚠ THE DESCRIPTION AREA IS A FIXED HEIGHT (§9). A line that appears on hover
 * and pushes the pills down is worse than no line at all — the thing under the
 * cursor moves out from under it. The slot is always there; only its text
 * changes, so nothing below it ever moves.
 *
 * ⚠ AND IT ANSWERS FOCUS, NOT ONLY HOVER (§17). A keyboard user tabbing the
 * pills gets the same description a mouse user does. Hover-only would make the
 * feature invisible to them and to every touch device.
 */

const DEFAULT_BLURB = "Choose a feature to explore Ailemy.";

export function ExplorePanel({ signedIn }: { signedIn: boolean }) {
  const items = capabilitiesFor(signedIn);
  const [active, setActive] = useState<string | null>(null);
  const blurb = items.find((c) => c.label === active)?.blurb ?? DEFAULT_BLURB;

  return (
    <section aria-labelledby="explore-title" className="mt-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/45">
        Explore Ailemy
      </p>
      <h2 id="explore-title" className="font-display mt-2 text-xl font-medium tracking-tight">
        Everything you need to learn, practise and improve.
      </h2>

      {/*
        ⚠ min-h RESERVES THE TALLEST LINE, MEASURED AT THE NARROWEST COLUMN.
        Two lines at this type size is 2 × 1.45em ≈ 2.9em; 3rem covers it with
        room, so the longest blurb wrapping to two lines still moves nothing.
        aria-live is polite so a screen reader is told what changed without the
        announcement interrupting the link it is reading.
      */}
      <p
        aria-live="polite"
        className="mt-2 min-h-[3rem] max-w-md text-sm leading-relaxed text-ink/65"
      >
        {blurb}
      </p>

      {/*
        ⚠ THE COLUMN COUNT IS SET FROM MEASURED WIDTH, NOT FROM A GUESS.
        The longest label, "Progress tracking", needs 151px of text plus the
        dot, arrow and padding — about 230px of pill, so a two-column grid
        needs ~470px of panel. Measured panel widths:

          viewport 375   panel 327  → 1 column
          viewport 768   panel 672  → 2 columns (stacked layout, full width)
          viewport 1024  panel 441  → 1 column  ← two would truncate, and did
          viewport 1280+ panel 584  → 2 columns

        Hence the lg:grid-cols-1 in the middle: between 1024 and 1279 the
        panel is beside the calendar and too narrow for two, so it drops to
        one rather than clipping a word. Widen the hero and this rebalances.
      */}
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {items.map((c, i) => {
          // §5 — the odd seventh spans the row rather than leaving a gap.
          const spans = i === items.length - 1 && items.length % 2 === 1;
          return (
            <li key={c.label} className={spans ? "sm:col-span-2 lg:col-span-1 xl:col-span-2" : undefined}>
              <Link
                href={c.href}
                data-cta="home_explore_capability"
                onMouseEnter={() => setActive(c.label)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(c.label)}
                onBlur={() => setActive(null)}
                className={[
                  "group/c flex min-h-[44px] w-full items-center justify-between gap-3 rounded-full",
                  "py-2.5 pl-4 pr-[calc(1rem_-_0.14em)]",
                  // ⚠ THE PILL'S EXISTING DNA (§4, §20): gold hairline, faint
                  // foil ground, mono uppercase with the strip's own tracking.
                  // Smaller than the band's 17px because this column is 584px
                  // wide, not 940 — the language is kept, the scale is not.
                  "font-mono text-[12px] uppercase leading-[1.35] tracking-[0.14em]",
                  "border border-[#B08D57]/55 bg-[#D9C08A]/[0.08] text-ink/70",
                  "transition-[color,background-color,border-color,transform,box-shadow] duration-200 ease-out",
                  "hover:border-[#B08D57]/85 hover:bg-[#D9C08A]/[0.16] hover:text-ink",
                  "focus-visible:border-[#B08D57]/85 focus-visible:bg-[#D9C08A]/[0.16] focus-visible:text-ink",
                  // §7 — a 1px lift, guarded. Not a scale, not a glow.
                  "motion-safe:hover:-translate-y-px motion-safe:focus-visible:-translate-y-px",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {/* §10 — colour is a detail, never the whole pill, and never
                      the only signal: the label and arrow carry the meaning. */}
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#B08D57] transition-colors duration-200 group-hover/c:bg-[#8C6A3F]" />
                  <span className="truncate">{c.label}</span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 transition-transform duration-200 motion-safe:group-hover/c:translate-x-0.5 motion-safe:group-focus-visible/c:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
