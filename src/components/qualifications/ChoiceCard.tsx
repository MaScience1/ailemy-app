import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One choice in the qualification flow — a level, a UK/international scope, or
 * an exam board. Same card for all three tiers (§23, §38).
 *
 * ============================================================================
 * ⚠ IT COPIES THE EXISTING PATHWAY CARD DELIBERATELY, THEN FIXES TWO GAPS
 * ============================================================================
 * Geometry, radius, ground, hover lift and the arrow-on-accent CTA are the
 * pathway card's, so a student cannot tell a new tier from an old one. Two
 * things are NOT copied, because they are defects rather than style:
 *
 *   focus-visible — every /learn card today has hover styling and no focus
 *     ring at all, so a keyboard user gets the browser default over a
 *     borderless card. The marketing cards pair every hover with a
 *     focus-visible twin; this follows the marketing side (§39).
 *   motion-safe   — /learn cards translate unconditionally. A student who has
 *     asked their OS for reduced motion should not be argued with (§39).
 *
 * ⚠ A DISABLED CHOICE IS NOT A LINK, AND SAYS WHY IN TEXT. `aria-disabled` on
 * a plain div is inert — no assistive technology reports it — so the reason
 * is carried by the visible status word, which a screen reader reads (§39).
 */

export function ChoiceCard({
  href,
  eyebrow,
  title,
  subtitle,
  description,
  badge,
  meta,
  footnote,
  ctaLabel,
  disabled = false,
  disabledLabel = "Not yet open",
  headingLevel = "h2",
  trackAs,
}: {
  href: string | null;
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: string;
  description?: string;
  /** The support badge — rendered top-right, opposite the eyebrow. */
  badge?: React.ReactNode;
  /** Capability chips or counts, under the description. */
  meta?: React.ReactNode;
  /** A quiet line under meta — real counts, never a claim. */
  footnote?: React.ReactNode;
  ctaLabel: string;
  disabled?: boolean;
  disabledLabel?: string;
  headingLevel?: "h2" | "h3";
  /** Marks the link for the delegated analytics listener (§40). Public
   *  taxonomy values only — a board or scope slug, never anything personal. */
  trackAs?: string;
}) {
  const Heading = headingLevel;
  const clickable = !disabled && href !== null;

  const cardClass = cn(
    "group/choice flex h-full flex-col justify-between gap-8 rounded-xl border border-ink/10 bg-snow p-6 transition-all duration-300 ease-out sm:p-7",
    clickable && [
      "hover:border-[var(--subject-accent)]",
      "motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
      "focus-visible:border-[var(--subject-accent)]",
    ],
    disabled && "cursor-not-allowed opacity-70",
  );

  const body = (
    <>
      <div>
        {(eyebrow || badge) && (
          <div className="flex items-start justify-between gap-3">
            {eyebrow ? (
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">{eyebrow}</p>
            ) : (
              <span />
            )}
            {badge}
          </div>
        )}

        <Heading className="font-display mt-6 text-2xl font-medium tracking-tight md:text-3xl">
          {title}
        </Heading>
        {subtitle && (
          <p className="font-mono mt-2 text-[11px] uppercase tracking-[0.16em] text-ink/50">
            {subtitle}
          </p>
        )}
        {description && (
          <p className="mt-3 text-sm leading-relaxed text-ink/65">{description}</p>
        )}
        {meta && <div className="mt-3">{meta}</div>}
        {footnote && <div className="mt-2">{footnote}</div>}
      </div>

      <div className="text-sm font-medium">
        {clickable ? (
          <span className="inline-flex items-center gap-2 text-ink transition-transform duration-300 motion-safe:group-hover/choice:translate-x-1">
            {ctaLabel.replace(/\s?→$/, "")}
            <ArrowRight className="h-4 w-4 text-[var(--subject-accent)]" aria-hidden="true" />
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
            {disabledLabel}
          </span>
        )}
      </div>
    </>
  );

  if (!clickable) {
    return (
      <div className={cardClass} aria-disabled="true">
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className={cardClass} data-qualification-choice={trackAs}>
      {body}
    </Link>
  );
}
