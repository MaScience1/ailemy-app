import Link from "next/link";

/**
 * The whole-card interaction pattern: clickable, gold ribbon, subtle lift.
 *
 * ============================================================================
 * ⚠ ONE <Link> WRAPPING EVERYTHING, EXACTLY AS SubjectCard DOES
 * ============================================================================
 * A div with an onClick needs role, tabIndex and a keydown handler bolted on,
 * and still gets middle-click, ctrl-click, open-in-new-tab and the status-bar
 * URL preview wrong. An anchor is all of that for free and is what a screen
 * reader already knows how to announce.
 *
 * ⚠ WHICH MEANS THE INNER CTA MUST NOT BE A LINK. Nesting anchors is invalid
 * HTML and makes the inner one unreachable by keyboard — so callers pass their
 * CTA text as `cta` and this renders it as a SPAN that looks like the
 * affordance while the card IS it. That is the one rule a caller can break, so
 * the prop is text rather than a node.
 *
 * ============================================================================
 * ⚠ THE GOLD IS DESATURATED ON PURPOSE, AND THAT IS WHAT KEEPS IT OFF THE
 * SUBJECT PALETTE
 * ============================================================================
 * Chemistry orange is #F97316 — hue 25, saturation 0.91. A vivid gold would sit
 * a few degrees away at a similar saturation and read as a second, slightly
 * wrong orange, which is exactly the clash to avoid.
 *
 * #B08D57 is hue 36 at saturation 0.51. The gap that matters is the SATURATION,
 * not the hue: a muted warm tone reads as metal, a vivid one reads as paint.
 * The three-stop gradient is what makes it read as metal rather than as a flat
 * brown band — a single hex looks like a mistake, a ramp looks like foil.
 *
 *   gold-light  #D9C08A   the sheen             1.55:1 on cream — decorative
 *   gold        #B08D57   the body              2.70:1
 *   gold-deep   #8C6A3F   the shadowed edge     4.32:1
 *
 * ⚠ THE RIBBON CARRIES NO TEXT, DELIBERATELY. Text on a 12px diagonal band
 * cannot meet contrast at any of those values without going so dark it stops
 * looking like gold — and a decorative band owes no contrast at all. Nothing
 * about this element is load-bearing: remove it and the card still says
 * everything it says.
 *
 * ⚠ HOVER IS NEVER THE ONLY TRIGGER. Every hover effect here is duplicated on
 * focus-visible, because a keyboard user gets no hover — and every transform
 * sits behind motion-safe:, so prefers-reduced-motion keeps the colour and
 * border changes without the movement.
 */
export function InteractiveCard({
  href,
  ariaLabel,
  cta,
  children,
  dataCta,
  className = "",
}: {
  href: string;
  /** ⚠ REQUIRED. Without it a screen reader announces the whole card body as
      the link text, which is three paragraphs. */
  ariaLabel: string;
  /** Rendered as a span — see the header. Never a node, never a link. */
  cta: string;
  children: React.ReactNode;
  dataCta?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      data-cta={dataCta}
      aria-label={ariaLabel}
      className={[
        // `relative` + `overflow-hidden` are what let the ribbon sit off-canvas
        // until it slides in; without the clip it would hang outside the card.
        "group relative flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-snow p-6",
        "transition-[transform,box-shadow,border-color] duration-[240ms] ease-out",
        "hover:border-[#B08D57]/45 hover:shadow-[0_10px_30px_-14px_rgba(15,20,25,0.30)]",
        "focus-visible:border-[#B08D57]/45 focus-visible:shadow-[0_10px_30px_-14px_rgba(15,20,25,0.30)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        // ⚠ LIFT AND SCALE TOGETHER, BOTH TINY. 4px and 0.6% — enough to read as
        // a response, small enough that a grid of three does not visibly reflow.
        "motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.006]",
        "motion-safe:focus-visible:-translate-y-1 motion-safe:focus-visible:scale-[1.006]",
        className,
      ].join(" ")}
    >
      {/* ── the gold ribbon ──────────────────────────────────────────────
          A diagonal band pinned to the top-right corner, translated out of the
          clip until hover. `origin` and the 45° rotation put it across the
          corner rather than along an edge, which is what makes it a ribbon
          rather than a stripe. */}
      <span
        aria-hidden
        className={[
          "pointer-events-none absolute -right-[52px] top-[18px] w-[170px] rotate-45",
          "h-[22px]",
          "bg-[linear-gradient(100deg,#D9C08A_0%,#B08D57_42%,#8C6A3F_100%)]",
          "opacity-0 transition-[opacity,transform] duration-[240ms] ease-out",
          "translate-x-[26px] -translate-y-[26px]",
          "group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0",
          "group-focus-visible:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:translate-y-0",
          // ⚠ REDUCED MOTION KEEPS THE GOLD AND DROPS THE SLIDE. The accent is
          // the signal; the movement is the flourish.
          "motion-reduce:transition-none motion-reduce:translate-x-0 motion-reduce:translate-y-0",
        ].join(" ")}
      />

      {children}

      {/* ⚠ A SPAN, NOT A LINK. The card is the anchor. The arrow is aria-hidden
          because the aria-label above already says where this goes. */}
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#6B4F2A]">
        <span className="underline decoration-transparent underline-offset-4 transition-colors duration-200 group-hover:decoration-current group-focus-visible:decoration-current">
          {cta}
        </span>
        <span
          aria-hidden
          className="transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1"
        >
          →
        </span>
      </span>
    </Link>
  );
}
