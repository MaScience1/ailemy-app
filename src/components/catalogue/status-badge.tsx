import { cn } from "@/lib/utils";
import type { ContentStatus } from "@/lib/catalogue/types";

type StatusBadgeProps = {
  status: ContentStatus;
  className?: string;
  /** Override the default label. */
  label?: string;
};

const LABELS: Record<ContentStatus, string> = {
  live: "Available",
  in_progress: "Available",
  coming_soon: "Coming soon",
  draft: "Draft",
  archived: "Archived",
};

const STYLES: Record<ContentStatus, string> = {
  // signal background, ink text for things students can use now
  live: "bg-signal text-ink",
  in_progress: "bg-signal text-ink",
  // muted dark pill for things not yet open
  coming_soon: "bg-ink/15 text-ink/70",
  // flask (orange) for editorial drafts — internal-flavoured
  draft: "bg-flask text-ink",
  archived: "bg-ink/10 text-ink/50",
};

/**
 * Small pill rendering a content status. Used on subject hub cards, course
 * cards, and lesson cards. Colour map is single-source-of-truth — change it
 * here, not in each page.
 */
export function StatusBadge({ status, className, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "font-mono inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]",
        STYLES[status],
        className,
      )}
    >
      {label ?? LABELS[status]}
    </span>
  );
}
