/**
 * THE SIX FEATURE CHIPS, AND WHERE EACH ONE HONESTLY LEADS.
 *
 * ============================================================================
 * ⚠ A CHIP IS A PROMISE MADE ON THE FIRST SCREEN A PAYING PARENT SEES.
 * ============================================================================
 * These render in the hero, above the fold, to someone who arrived from a
 * WhatsApp link and is deciding whether this is worth money. A chip that leads
 * to "not built yet" is not a rough edge — it is the moment they stop trusting
 * the rest of the page.
 *
 * ⚠ FOUR SURFACES ARE DELIBERATELY NOT LINKED, each verified as a stub today:
 *   /exam-builder                  "This is not built yet." above the fold
 *   /past-papers/<slug>/test       "Not built yet — nothing you type anywhere
 *                                   on this page is saved"
 *   .../interactive/sit/practice   "Practice mode isn't built yet."
 *   .../interactive/sit/exam       "Nothing is marked yet" + a sign-in wall
 * Flashcards are not here at all: their tables live in an unapplied _PROPOSED_
 * migration, so the feature has no database to run on.
 *
 * ⚠ AND THE DESTINATIONS ARE UNLOCALISED ROOTS ON PURPOSE. /learn, /resources
 * and /past-papers all sit outside the [locale] segment, so SmartLink leaves
 * them unprefixed and they resolve identically on /ar. A chip that 404'd in
 * Arabic would be the same broken promise in a different language.
 */
export type HeroChip = {
  /** Catalogue key for the label — never a literal, so Arabic gets it too. */
  readonly labelKey: string;
  readonly href: string;
  readonly cta: string;
};

/**
 * ⚠ FOUR CHIPS, FOUR DESTINATIONS — ONE LABEL EACH, AND NO LABEL NAMES A
 * SURFACE IT DOES NOT LEAD TO.
 *
 * "Question Bank" and "Exam Practice" were removed outright. Both resolved to
 * /past-papers because no standalone question-bank or exam-practice surface
 * exists — so three labels pointed at one archive and two of them named
 * something the app does not have. A label over a destination it does not name
 * is the same broken promise as a link to a stub, made more quietly.
 *
 * "Revision Notes" became "Resources" for the same reason: /resources is a
 * search and three subject cards, not a notes library. The only real notes are
 * a self-labelled sample deck inside one lesson. Rename it back when notes
 * exist, not before.
 */
export const HERO_CHIPS: readonly HeroChip[] = [
  { labelKey: "home.chipLessons",        href: "/learn",       cta: "hero_chip_lessons" },
  { labelKey: "home.chipPastPapers",     href: "/past-papers", cta: "hero_chip_past_papers" },
  { labelKey: "home.chipMarkedFeedback", href: "/#try",        cta: "hero_chip_marked_feedback" },
  { labelKey: "home.chipResources",      href: "/resources",   cta: "hero_chip_resources" },
] as const;

/**
 * ⚠ THE ROUTES A CHIP MUST NEVER POINT AT. Verified stubs, each with the exact
 * copy a visitor would read. The guard asserts no chip href starts with any of
 * these, so adding one back is a test failure rather than a discovery made by
 * a parent.
 */
export const STUB_ROUTES: readonly string[] = [
  "/exam-builder",
  "/past-papers/",   // any per-paper workspace: /test is a stub, /classroom is a teacher tool
];

/** Distinct destinations, for the redundancy check the guard reports on. */
export function chipDestinations(): string[] {
  return [...new Set(HERO_CHIPS.map((c) => c.href))];
}
