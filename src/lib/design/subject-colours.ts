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

/** The four values any chip needs to paint itself — subject or not. */
export type ColourTokens = Pick<SubjectColour, "accent" | "text" | "tint" | "border">;

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
/**
 * ⚠ THE PARAMETER IS THE STYLE SUBSET, NOT SubjectColour, SO A NON-SUBJECT
 * TOKEN CAN USE IT HONESTLY. ONE_TO_ONE is not a science; typing it as a
 * SubjectColour forced it to carry `key: "chemistry"`, which is false data
 * sitting in the palette waiting for something to read it. This function only
 * ever touched the four style values, so that is what it now asks for.
 */
export function subjectVars(c: ColourTokens | null): React.CSSProperties {
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

// ============================================================================
// NAVIGATION TONES — the hover capsule behind each top-level tab
// ============================================================================
//
// ⚠ THE CAPSULE IS TINT + HAIRLINE + ink, AND THE INK IS THE POINT. The
// expressive alternative — a subject's own `text` colour on its own `tint` —
// was measured and rejected: Chemistry lands at 6.16:1 there, BELOW the 6.48:1
// the nav already has at rest. Hovering a tab would have made it very slightly
// harder to read, and only on one of the three, which is the worst kind of
// inconsistency. `ink` on tint gives 16.54 / 16.28 / 16.09 — the token file's
// own documented contract ("a wash behind a chip … type on it is ink"), and it
// beats the rest state everywhere.
//
// The subject is still carried by the capsule, which is what identifies it.
//
// ⚠ THE NON-SUBJECT TABS SPLIT TWO WAYS, AND NOT ARBITRARILY.
//
//   gold     Past Papers · Live Tuition · Calendar — cross-subject PLATFORM
//            features. The homepage capability strip already renders the exact
//            words "Past papers" and "Live tuition" as gold capsules, so the
//            same label gets the same treatment in both places. Making these
//            three a fourth subject hue would invent a subject that does not
//            exist; making them neutral would say they are chrome.
//
//   neutral  Login and the signed-in account control — an ACCOUNT action, not
//            content. Gold here would put the site's premium accent on a
//            utility. It also matches what that control already does today
//            (hover:bg-ink/[0.04]), so the neutral tone is a formalisation of
//            existing behaviour rather than a new look.

/**
 * The gold ramp. These four values were literals in InteractiveCard and
 * CapabilityStrip before they were here.
 *
 * ⚠ THOSE TWO FILES STILL CARRY THEM AS LITERALS, AND THAT IS NOT AN OVERSIGHT.
 * Tailwind generates a class only when it can SEE the value in the source, so
 * `hover:bg-[#B08D57]` cannot be fed from a constant — the literal has to stay
 * in the class string. This export is the source for everything that goes
 * through inline styles or CSS custom properties, which is where a constant
 * actually works. If the ramp ever changes, it changes in three places, and
 * this comment is how the next person finds the other two.
 */
export const GOLD = {
  sheen: "#D9C08A",
  body: "#B08D57",
  deep: "#8C6A3F",
  /** AA on parchment (6.62:1) — the card CTA colour. */
  text: "#6B4F2A",
} as const;

/**
 * Composite a colour over the parchment ground and return an opaque hex.
 *
 * ⚠ DERIVED, NOT TYPED OUT. The gold and neutral washes below are alpha values
 * conceptually — "22% sheen", "5% ink" — and writing their composited results
 * in by hand would pin today's parchment forever. PARCHMENT is imported above;
 * change it and these move with it. That is the whole reason this function
 * exists rather than four more hex constants.
 *
 * ⚠ AND IT IS ONLY VALID BECAUSE THE NAV IS ALWAYS ON PARCHMENT. The header
 * sets bg-parchment unconditionally. A caller that puts these on another ground
 * has to re-derive; the ratios asserted in the test are parchment ratios.
 */
export function overParchment(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const p = PARCHMENT.replace("#", "");
  const out = [0, 2, 4].map((i) => {
    const fg = parseInt(h.slice(i, i + 2), 16);
    const bg = parseInt(p.slice(i, i + 2), 16);
    return Math.round(fg * alpha + bg * (1 - alpha));
  });
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * 1-to-1 availability — the one non-subject thing the calendar colours (§4, §46).
 *
 * ============================================================================
 * ⚠ ONE TOKEN, BUILT FROM THE EXISTING GOLD RAMP, NOT A NEW COLOUR
 * ============================================================================
 * §4 asks for "premium gold / champagne" and explicitly not bright yellow;
 * §46 asks for a single central token and §47 forbids inventing a second
 * palette. GOLD above is already Ailemy's cross-subject platform accent — the
 * capsule behind "Past papers" and "Live tuition" in the nav — so 1-to-1 reuses
 * it rather than introducing a fifth hue that would have to be kept in step.
 *
 * ⚠ IT DELIBERATELY SHARES THE SubjectColour SHAPE. Every calendar surface
 * already styles a chip from {accent, text, tint, border} through subjectVars;
 * matching the shape means a gold chip is the same code path as an orange one,
 * so the two cannot drift apart in padding, contrast or focus treatment.
 *
 * ⚠ `text` IS GOLD.text (6.62:1 on parchment), NOT GOLD.body. §53 asks for
 * adequate contrast on the gold, and body gold is decorative — it fails on
 * small type. accent is decorative only, exactly as the subject tokens say.
 */
export const ONE_TO_ONE: ColourTokens & { name: string; code: string } = {
  name: "1-to-1",
  code: "1:1",
  accent: GOLD.body,
  text: GOLD.text,
  tint: overParchment(GOLD.sheen, 0.22),
  border: overParchment(GOLD.body, 0.55),
};

export type NavToneKey = SubjectKey | "gold" | "neutral";
export type NavTone = { tint: string; border: string };

/**
 * ⚠ THE SUBJECT ENTRIES ARE READ FROM SUBJECT_COLOURS, NOT RESTATED. A nav tab
 * and a subject card must not be able to disagree about what Chemistry looks
 * like, and the only way to guarantee that is to have one of them read the
 * other rather than both reading a memory of the same decision.
 */
export const NAV_TONES: Record<NavToneKey, NavTone> = {
  chemistry: { tint: SUBJECT_COLOURS.chemistry.tint, border: SUBJECT_COLOURS.chemistry.border },
  biology: { tint: SUBJECT_COLOURS.biology.tint, border: SUBJECT_COLOURS.biology.border },
  physics: { tint: SUBJECT_COLOURS.physics.tint, border: SUBJECT_COLOURS.physics.border },
  gold: { tint: overParchment(GOLD.sheen, 0.22), border: overParchment(GOLD.body, 0.55) },
  neutral: { tint: overParchment("#0F1419", 0.05), border: overParchment("#0F1419", 0.15) },
};

/**
 * CSS custom properties for one nav tab.
 *
 * ⚠ CUSTOM PROPERTIES RATHER THAN SEVEN CLASS STRINGS. Every tab shares ONE
 * class string and differs only in two variables, so the capsule geometry, the
 * timing, the scale and the focus ring cannot drift apart between tabs — which
 * is exactly what happens when each tab carries its own copy of the styling.
 */
export function navToneVars(key: NavToneKey): React.CSSProperties {
  const t = NAV_TONES[key];
  return { "--nav-tint": t.tint, "--nav-border": t.border } as React.CSSProperties;
}
