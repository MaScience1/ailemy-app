import Link from "next/link";

import { subjectColour, subjectVars } from "@/lib/design/subject-colours";

/**
 * A whole-card-clickable subject card with a subject accent (§4, §3).
 *
 * ============================================================================
 * ⚠ ONE <Link> WRAPPING THE CARD, NOT A DIV WITH AN onClick
 * ============================================================================
 * §4 wants the entire card clickable, keyboard-focusable, and Enter/Space
 * operable. A div with an onClick needs role, tabIndex and a keydown handler
 * bolted on, and gets middle-click, ctrl-click, "open in new tab" and the
 * status-bar URL preview wrong anyway. An anchor is all of that for free, and
 * it is what a screen reader already knows how to announce.
 *
 * ⚠ SO THERE IS EXACTLY ONE INTERACTIVE ELEMENT. The old card had a text link
 * inside it; wrapping that in another link would nest anchors, which is invalid
 * HTML and makes the inner one unreachable by keyboard. The "Explore →" line is
 * now a span that LOOKS like the affordance while the card IS it.
 *
 * ⚠ HOVER IS NOT THE ONLY SIGNAL. Every hover effect is duplicated on
 * focus-visible, because §4 says do not rely on hover alone and a keyboard user
 * gets no hover at all. group-hover and group-focus-visible are always paired.
 *
 * ⚠ AND THE MOTION IS OPT-OUT. motion-safe: prefixes every transform, so a
 * student with prefers-reduced-motion set gets the colour and border changes
 * and none of the movement (§34).
 */

export type SubjectCardData = {
  slug: string;
  name: string;
  qualifications: string[];
  blurb: string;
  status: "available" | "expanding" | "interest";
  exploreHref: string | null;
};

const LABEL: Record<SubjectCardData["status"], string> = {
  available: "Available",
  expanding: "Expanding",
  interest: "Register interest",
};

export function SubjectCard({
  subject,
  href: hrefOverride,
  ctaLabel,
}: {
  subject: SubjectCardData;
  /**
   * ⚠ THE OVERRIDES EXIST SO /resources REUSES THIS CARD RATHER THAN FORKING IT.
   *
   * /resources sends all three subjects to `/{slug}` and says "Open Chemistry"
   * on every one of them — including Biology and Physics, whose `exploreHref` is
   * null, because from a resources index the destination is the subject page and
   * not an interest form. That is a DIFFERENT DESTINATION FOR THE SAME CARD, not
   * a different card.
   *
   * The alternative was a second component with the same accent rule, the same
   * lift, the same span-not-link discipline and the same paired
   * hover/focus-visible states — four invariants duplicated, drifting on the
   * first change to any of them. Two optional props are cheaper than that.
   *
   * ⚠ BOTH DEFAULT TO TODAY'S BEHAVIOUR, so the homepage is untouched by this.
   */
  href?: string;
  ctaLabel?: string;
}) {
  const colour = subjectColour(subject.slug);
  const href = hrefOverride ?? subject.exploreHref ?? `/tuition/interest?subject=${subject.slug}`;
  const cta =
    ctaLabel ?? (subject.exploreHref ? `Explore ${subject.name}` : "Register interest");

  return (
    <Link
      href={href}
      style={subjectVars(colour)}
      /**
       * ⚠ THE ACCESSIBLE NAME SAYS WHERE IT GOES. Without this a screen reader
       * announces the whole card body as the link text, which is a paragraph.
       */
      aria-label={`${cta} — ${subject.name}, ${subject.qualifications.join(", ")}`}
      className={[
        "group relative flex w-full flex-col overflow-hidden rounded-lg border border-ink/10 bg-snow p-7",
        "transition duration-200 ease-out",
        "hover:border-ink/25 hover:shadow-[0_6px_24px_-12px_rgba(15,20,25,0.28)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        "focus-visible:border-ink/25 focus-visible:shadow-[0_6px_24px_-12px_rgba(15,20,25,0.28)]",
        "motion-safe:hover:-translate-y-[3px] motion-safe:focus-visible:-translate-y-[3px]",
      ].join(" ")}
    >
      {/* ⚠ THE SUBJECT ACCENT, AS A RULE ALONG THE TOP EDGE. A tinted card
          background would be the "bright coloured block" §3 forbids; a 2px rule
          identifies the subject without touching the cream ground. It grows
          from a hairline on hover rather than appearing from nothing. */}
      {colour && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] origin-left bg-[var(--subject-accent)] opacity-70 transition-all duration-200 ease-out group-hover:h-[3px] group-hover:opacity-100 group-focus-visible:h-[3px] group-focus-visible:opacity-100"
        />
      )}

      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
        {LABEL[subject.status]}
      </span>

      <h3 className="font-display mt-3 text-2xl font-medium tracking-tight">
        {subject.name}
      </h3>

      {/* ⚠ THE SUBJECT CODE IS A SECOND, NON-COLOUR IDENTIFIER (§34). Colour
          alone must not carry which subject this is. */}
      <p className="mt-1 flex items-center gap-2 font-mono text-[11px] text-ink/50">
        {colour && (
          <span
            className="rounded-sm px-1 py-px text-[9px] font-medium tracking-[0.12em]"
            style={{ background: "var(--subject-tint)", color: "var(--subject-text)" }}
          >
            {colour.code}
          </span>
        )}
        {subject.qualifications.join(" · ")}
      </p>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-ink/70">{subject.blurb}</p>

      {/* ⚠ A SPAN, NOT A LINK. The card is the anchor; a nested one would be
          invalid and keyboard-unreachable. aria-hidden on the arrow keeps the
          announcement clean — the aria-label above already says where it goes. */}
      <span
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium"
        style={colour ? { color: "var(--subject-text)" } : undefined}
      >
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
