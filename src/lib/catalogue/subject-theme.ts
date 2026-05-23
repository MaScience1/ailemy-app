/**
 * Subject accent theme helper.
 *
 * Returns the two-colour accent palette (primary + dark/hover) for a given
 * subject. Reads from the subjects row first, falling back to a hard-coded
 * palette per slug, and finally to a flask-orange fallback for unknown
 * subjects so callers never crash on missing data.
 *
 * Used inside /learn/* routes only. The marketing landing page does not
 * theme by subject (per brand spec — signal-green CTAs everywhere there).
 */

export type SubjectTheme = {
  /** Primary accent — used for filled CTAs, eyebrows, stripes. */
  primary: string;
  /** Darker variant — used for hover states and dense accents. */
  secondary: string;
};

/** Last-resort default. Matches the flask brand token. */
const FALLBACK: SubjectTheme = {
  primary: "#F97316",
  secondary: "#C2410C",
};

/**
 * Hard-coded fallback per known subject slug. These mirror the values
 * loaded into the DB by 0006_subject_colours.sql, so the UI looks right
 * even before that migration has been run.
 */
const HARDCODED: Record<string, SubjectTheme> = {
  chemistry: { primary: "#F97316", secondary: "#E0610C" },
  biology: { primary: "#4A9D5C", secondary: "#3D8249" },
  physics: { primary: "#3B7CB8", secondary: "#2C6699" },
};

type SubjectLike = {
  slug: string;
  color_as?: string | null;
  color_a2?: string | null;
};

export function getSubjectTheme(
  subject: SubjectLike | null | undefined,
): SubjectTheme {
  if (!subject) return FALLBACK;
  const fallback = HARDCODED[subject.slug] ?? FALLBACK;
  return {
    primary: subject.color_as ?? fallback.primary,
    secondary: subject.color_a2 ?? fallback.secondary,
  };
}

/**
 * Inline-style helper. Spread into a `style` prop on the wrapper div of
 * any /learn/* page so descendants can reference `var(--subject-accent)`
 * and `var(--subject-accent-dark)`.
 *
 *   <div style={getSubjectThemeStyle(subject)}>…</div>
 */
export function getSubjectThemeStyle(
  subject: SubjectLike | null | undefined,
): React.CSSProperties {
  const theme = getSubjectTheme(subject);
  return {
    "--subject-accent": theme.primary,
    "--subject-accent-dark": theme.secondary,
  } as React.CSSProperties;
}
