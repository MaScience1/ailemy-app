/**
 * Three-tier catalogue entity status.
 *
 * Derived from lesson counts under any entity (subject, pathway, or course) —
 * NOT from a column on the entity itself. The course/subject/pathway rows
 * exist long before they have content; this state model lets the catalogue
 * reflect that without us having to manually flip a flag every time we seed
 * lessons.
 *
 * | Status      | Trigger                                  |
 * |-------------|------------------------------------------|
 * | available   | At least one lesson has status='live'    |
 * | preview     | Lessons exist, but none are live yet     |
 * | coming_soon | No lessons exist under this entity       |
 *
 * Note: this is the ENTITY-level state. The per-lesson `ContentStatus` enum
 * (live/coming_soon/draft/etc, see types.ts) is a separate concept used on
 * the lesson cards inside a course page — that remains unchanged.
 */

export type EntityStatus = "available" | "preview" | "coming_soon";

export type LessonCounts = {
  totalLessons: number;
  liveLessons: number;
};

/**
 * Single source of truth for status derivation. Used by every catalogue card.
 */
export function deriveStatus({
  totalLessons,
  liveLessons,
}: LessonCounts): EntityStatus {
  if (liveLessons > 0) return "available";
  if (totalLessons > 0) return "preview";
  return "coming_soon";
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export type StatusBadge = {
  label: string;
  /** Tailwind classes to colour the pill. */
  className: string;
};

/**
 * Pill styling per status. Defaults are tuned for snow/light card backgrounds.
 * Subject cards on /learn (which use bg-ink) override coming_soon to a
 * snow-on-dark variant — see the subject card itself.
 */
export function getStatusBadge(status: EntityStatus): StatusBadge {
  switch (status) {
    case "available":
      return { label: "Available", className: "bg-signal text-ink" };
    case "preview":
      // Thin border on parchment so the pill stays legible on both snow
      // (very close shade) and ink (no border needed but doesn't hurt) cards.
      return {
        label: "Preview",
        className: "bg-parchment text-ink border border-ink/10",
      };
    case "coming_soon":
      return {
        label: "Coming soon",
        className: "bg-ink/10 text-ink/55",
      };
  }
}

// ---------------------------------------------------------------------------
// CTA
// ---------------------------------------------------------------------------

export type StatusCta = {
  /** Display text for the CTA element. */
  label: string;
  /** True if the card should be non-clickable (cursor-not-allowed). */
  isDisabled: boolean;
};

/**
 * CTA copy per status. The available-state label varies by card type
 * (subject card says "Explore courses →", pathway says "Explore IAL →",
 * course says "Start course →"), so the caller passes its own contextual
 * label as `availableLabel`. Preview and coming_soon labels are universal.
 */
export function getStatusCta(
  status: EntityStatus,
  availableLabel: string,
): StatusCta {
  switch (status) {
    case "available":
      return { label: availableLabel, isDisabled: false };
    case "preview":
      return { label: "Browse curriculum →", isDisabled: false };
    case "coming_soon":
      return { label: "NOT YET OPEN", isDisabled: true };
  }
}
