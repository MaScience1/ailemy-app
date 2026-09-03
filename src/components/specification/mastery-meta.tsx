import type { SpecMasteryFacts, SpecMasteryState } from "@/lib/specification/types";

/**
 * One vocabulary for mastery states — glyph, label, tone — used by every
 * surface of the explorer, so a summary chip and a spec-point row cannot
 * drift apart about what "developing" looks like.
 *
 * ⚠ COLOUR IS NEVER THE ONLY SIGNAL (§34 doctrine, subject-colours.ts). Each
 * state has a distinct glyph SHAPE and a text label; the colour is an accent
 * on top. Labels are rendered as text, and the glyph is aria-hidden beside
 * them — a screen reader gets the label, never a description of a circle.
 *
 * Tones are existing tokens only: pending/gold/marked from globals.css. No
 * new palette.
 */

export const STATE_META: Record<
  SpecMasteryState,
  { label: string; tone: string; blurb: string }
> = {
  unstarted: {
    label: "Not started",
    tone: "var(--color-ink-40)",
    blurb: "No practice recorded for this point yet.",
  },
  insufficient: {
    label: "Not rated yet",
    tone: "var(--color-ink-60)",
    blurb: "Some practice recorded, but not yet enough marks to rate fairly.",
  },
  emerging: {
    label: "Emerging",
    tone: "var(--color-pending)",
    blurb: "Below half marks so far — worth revising first.",
  },
  developing: {
    label: "Developing",
    tone: "var(--color-gold)",
    blurb: "Half marks or more — partly there.",
  },
  secure: {
    label: "Secure",
    tone: "var(--color-marked)",
    blurb: "Three quarters of marks or more, on enough evidence.",
  },
};

export const STATE_ORDER: SpecMasteryState[] = [
  "emerging",
  "developing",
  "insufficient",
  "unstarted",
  "secure",
];

/**
 * The state glyph — five distinct SHAPES, one per state, drawn inline so the
 * set cannot depend on an icon library carrying a half-filled circle.
 * Decorative by contract: always rendered with aria-hidden next to the label.
 */
export function MasteryGlyph({
  state,
  className,
}: {
  state: SpecMasteryState;
  className?: string;
}) {
  const tone = STATE_META[state].tone;
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 14 14",
    className,
    "aria-hidden": true as const,
    style: { color: tone, flexShrink: 0 },
  };
  switch (state) {
    case "unstarted":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "insufficient":
      return (
        <svg {...common}>
          <circle
            cx="7" cy="7" r="5.5" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeDasharray="2.6 2.6"
          />
        </svg>
      );
    case "emerging":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="7" r="2.2" fill="currentColor" />
        </svg>
      );
    case "developing":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {/* the filled half — the lower half, so it reads the same in RTL */}
          <path d="M 1.5 7 A 5.5 5.5 0 0 0 12.5 7 Z" fill="currentColor" />
        </svg>
      );
    case "secure":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="6" fill="currentColor" />
          <path
            d="M 4.2 7.2 L 6.2 9.2 L 9.8 5.2"
            fill="none" stroke="var(--color-snow)" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      );
  }
}

/**
 * Evidence-confidence copy — the label that must ride beside any percentage
 * (§22 as amended). One vocabulary, so "High confidence" cannot drift into
 * "Strong evidence" on another surface.
 */
export const CONFIDENCE_META: Record<"limited" | "high", string> = {
  limited: "Limited evidence",
  high: "High confidence",
};

/**
 * The one way a mastery percentage is rendered (§22 as amended): the figure,
 * with its confidence label, only when the domain layer produced one —
 * facts.percent is null below the evidence floor and this component renders
 * NOTHING rather than a premature number. It never divides marks itself.
 */
export function MasteryFigure({
  facts,
  className,
}: {
  facts: SpecMasteryFacts;
  className?: string;
}) {
  if (facts.percent === null || facts.evidenceConfidence === "none") return null;
  return (
    <span className={`whitespace-nowrap font-mono text-[11px] ${className ?? ""}`}>
      <span className="font-medium text-ink/80">{facts.percent}%</span>
      <span className="text-ink/45"> · {CONFIDENCE_META[facts.evidenceConfidence]}</span>
    </span>
  );
}

/** Glyph + label, the pairing every row uses. */
export function StateLabel({
  state,
  className,
}: {
  state: SpecMasteryState;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <MasteryGlyph state={state} />
      <span>{STATE_META[state].label}</span>
    </span>
  );
}
