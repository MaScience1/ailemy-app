import { cn } from "@/lib/utils";
import {
  CAPABILITY_LABEL,
  type Capability,
  type SupportStatus,
} from "@/lib/qualifications/support.ts";

/**
 * Support status and capability chips (§21, §27, §39).
 *
 * ============================================================================
 * ⚠ THE LABEL CARRIES THE MEANING; COLOUR ONLY REINFORCES IT (§39)
 * ============================================================================
 * Every status is legible in greyscale and to a screen reader because the
 * word is the signal — "Expanding" and "Coming soon" differ as text before
 * they differ as tone. The palette is the existing catalogue one (ink,
 * parchment, signal); no new colour token is introduced, and nothing here is
 * a bright childish pill.
 *
 * ⚠ THE GEOMETRY STRING IS THE ONE ALREADY USED FOR CATALOGUE BADGES, copied
 * deliberately: /learn/page.tsx, /learn/[subject]/page.tsx and
 * /learn/[subject]/[pathway]/page.tsx all inline the same pill dimensions.
 * Matching it exactly is what keeps a new tier from looking like a different
 * product; a shared primitive for all four is worth doing, and is a wider
 * refactor than this brief's §5 scope allows.
 */

const PILL =
  "font-mono inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]";

const STATUS: Record<SupportStatus, { label: string; className: string }> = {
  // Premium dark — reserved for the deepest route, and earned by content.
  full_support: { label: "Full support", className: "bg-ink text-parchment" },
  supported: { label: "Supported", className: "bg-signal text-ink" },
  expanding: {
    label: "Expanding",
    className: "bg-parchment text-ink/75 border border-ink/15",
  },
  coming_soon: { label: "Coming soon", className: "bg-ink/10 text-ink/55" },
};

export function SupportBadge({
  status,
  className,
}: {
  status: SupportStatus;
  className?: string;
}) {
  const s = STATUS[status];
  return <span className={cn(PILL, s.className, className)}>{s.label}</span>;
}

/**
 * The capability row (§27).
 *
 * ⚠ AN EMPTY ROW IS A REAL ANSWER AND RENDERS AS NOTHING. Chips are passed in
 * already derived from content that exists; a route with no lessons shows no
 * "Lessons" chip rather than a greyed-out one, because a greyed-out chip
 * still tells a student the feature is nearly there.
 */
export function CapabilityChips({
  capabilities,
  className,
}: {
  capabilities: readonly Capability[];
  className?: string;
}) {
  if (capabilities.length === 0) return null;
  return (
    <p className={cn("font-mono text-[10px] uppercase tracking-[0.16em] text-ink/50", className)}>
      {capabilities.map((c) => CAPABILITY_LABEL[c]).join(" · ")}
    </p>
  );
}

/**
 * The flagship mark (§22).
 *
 * ⚠ UNDERSTATED ON PURPOSE. "Most complete pathway" is a comparative claim
 * this codebase can defend from counts; anything louder would be selling.
 */
export function FlagshipMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45",
        className,
      )}
    >
      Most complete pathway
    </span>
  );
}
