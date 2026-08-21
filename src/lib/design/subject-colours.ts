/**
 * The Ailemy subject colour system — one source, used everywhere (§3).
 *
 * ============================================================================
 * ⚠ THIS SUPERSEDES A RECORDED BRAND DECISION, DELIBERATELY
 * ============================================================================
 * src/lib/catalogue/subject-theme.ts says: "Used inside /learn/* routes only.
 * The marketing landing page does not theme by subject (per brand spec —
 * signal-green CTAs everywhere there)."
 *
 * §3 reverses that: subject identity now appears on homepage cards, calendar
 * events, timetable events, filters, badges and navigation. The hues are
 * unchanged — chemistry orange, biology green, physics blue, the same three
 * already in subject-theme.ts and in 0006_subject_colours.sql — so nothing
 * relearns a colour. What changes is where they are allowed to appear.
 *
 * ⚠ AND THEY STAY ACCENTS. §3 is explicit: "do not turn the entire site into
 * bright coloured blocks." Cream stays the ground, ink stays the type, and the
 * signal-green CTA remains the primary action colour. A subject colour marks
 * WHICH subject a thing is; it never becomes the thing's background.
 *
 * ============================================================================
 * ⚠ FOUR ROLES, BECAUSE ONE HEX CANNOT DO FOUR JOBS
 * ============================================================================
 * #F97316 is a fine dot on cream and unreadable as body text on it. Shipping
 * one value per subject is how a colour system quietly fails accessibility:
 * somebody uses the accent for a label, it passes review by eye, and it sits at
 * roughly 2.3:1 forever.
 *
 *   accent   the dot, the stripe, the left border. Decorative — never carries
 *            meaning on its own, and never used for text.
 *   text     a label or a link on parchment. Dark enough for AA body text.
 *   tint     a wash behind a chip or a calendar event. Type on it is `ink`.
 *   border   a hairline that reads as "this is Chemistry" without shouting.
 *
 * ⚠ COLOUR IS NEVER THE ONLY SIGNAL (§34). Every consumer must also carry the
 * subject NAME or its short code — `code` exists so a calendar chip too small
 * for a word still says CHM rather than relying on orange. A colour-blind
 * student and a screen reader get the same information as everyone else.
 */

export type SubjectKey = "chemistry" | "biology" | "physics";

export type SubjectColour = {
  key: SubjectKey;
  /** "Chemistry" — for labels and aria text. */
  name: string;
  /** "CHM" — the non-colour identifier for space-constrained chips (§34). */
  code: string;
  /** Decorative only: dots, stripes, borders. Never text. */
  accent: string;
  /** AA-contrast on parchment. Labels, links, small text. */
  text: string;
  /** A pale wash for chips and calendar events. Type on it is ink. */
  tint: string;
  /** Hairline border. */
  border: string;
};

/**
 * ⚠ THE ACCENTS ARE THE EXISTING VALUES, UNCHANGED. chemistry #F97316,
 * biology #4A9D5C, physics #3B7CB8 already live in subject-theme.ts and in
 * 0006_subject_colours.sql. Changing them here would put the marketing site
 * and /learn/* a shade apart, which is worse than either shade alone.
 *
 * The `text` values are new: darkened until they clear 4.5:1 on parchment
 * (#F5EFE6). They are not eyeballed — see the contrast test.
 */
export const SUBJECT_COLOURS: Record<SubjectKey, SubjectColour> = {
  chemistry: {
    key: "chemistry",
    name: "Chemistry",
    code: "CHM",
    accent: "#F97316",
    text: "#9A3D09",
    tint: "#FDF0E4",
    border: "#E9C6A6",
  },
  biology: {
    key: "biology",
    name: "Biology",
    code: "BIO",
    accent: "#4A9D5C",
    text: "#255730",
    tint: "#E9F3EA",
    border: "#B4D4B9",
  },
  physics: {
    key: "physics",
    name: "Physics",
    code: "PHY",
    accent: "#3B7CB8",
    text: "#1B4771",
    tint: "#E8F0F8",
    border: "#B0C9E0",
  },
};

/** The parchment ground every `text` value is measured against. */
export const PARCHMENT = "#F5EFE6";

export const SUBJECT_ORDER: SubjectKey[] = ["chemistry", "biology", "physics"];

/**
 * ⚠ RETURNS null FOR AN UNKNOWN SUBJECT, NOT A FALLBACK COLOUR.
 * subject-theme.ts falls back to flask-orange "so callers never crash on
 * missing data" — reasonable inside /learn/* where the subject is known and the
 * fallback is cosmetic. Here it would be a lie: painting an unrecognised
 * subject orange tells a student it is Chemistry. A caller that gets null
 * renders the neutral treatment, which is honest.
 */
export function subjectColour(slugOrName: string | null | undefined): SubjectColour | null {
  if (!slugOrName) return null;
  const k = slugOrName.trim().toLowerCase();
  if (k in SUBJECT_COLOURS) return SUBJECT_COLOURS[k as SubjectKey];
  // Course names carry the subject: "IAL Chemistry AS", "Chemistry AS Group A".
  for (const key of SUBJECT_ORDER) {
    if (k.includes(key)) return SUBJECT_COLOURS[key];
  }
  return null;
}

/**
 * CSS custom properties for a subtree.
 *
 * ⚠ CUSTOM PROPERTIES RATHER THAN TAILWIND CLASSES, because the subject is a
 * RUNTIME value — a calendar event knows its subject only when the row arrives.
 * Tailwind cannot generate `text-[#9A3D09]` for a value it never sees at build
 * time, and the alternative is a lookup object of class strings that drifts
 * from this file the first time somebody adds a subject.
 */
export function subjectVars(c: SubjectColour | null): React.CSSProperties {
  if (!c) return {};
  return {
    "--subject-accent": c.accent,
    "--subject-text": c.text,
    "--subject-tint": c.tint,
    "--subject-border": c.border,
  } as React.CSSProperties;
}

/**
 * The neutral treatment, for 1-to-1 availability and anything without a
 * subject. §6 asks for "a neutral outlined treatment" for bookable slots so
 * they read as a different KIND of thing, not as a fourth subject.
 */
export const NEUTRAL_SLOT = {
  accent: "#8A867D",
  text: "#3A382F",
  tint: "#FFFFFF",
  border: "#D8D2C6",
} as const;
