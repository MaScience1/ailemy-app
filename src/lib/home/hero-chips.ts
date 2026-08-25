/**
 * THE FEATURE CHIPS — TWO ROWS, AND THE SECOND ROW IS NOT A LINK.
 *
 * ============================================================================
 * ⚠ ROW 2 IS THE HONEST WAY TO SHOW AMBITION WITHOUT LYING ABOUT IT.
 * ============================================================================
 * A chip is a promise made on the first screen a parent sees after tapping a
 * WhatsApp link. Four of the eight things worth naming do not exist yet:
 *
 *   Flashcards     — its tables live in an unapplied _PROPOSED_ migration, so
 *                    the feature has no database to run on at all.
 *   Exam Builder   — /exam-builder renders "This is not built yet." above the
 *                    fold, in its own words.
 *   Question Bank  — there is no standalone route. The only candidate needs
 *                    three path params and renders paper PDFs, not questions.
 *   Progress       — reads student_courses, which has ZERO writes anywhere in
 *                    src/. It is permanently empty for every student who pays.
 *
 * Naming them as live links is the broken promise. Hiding them entirely loses
 * the roadmap. Showing them as visibly coming-soon, with no href and no focus
 * stop, says the true thing: this is the shape of the product, and these four
 * are not ready.
 *
 * ⚠ NO href, aria-disabled, NOT FOCUSABLE. A muted colour alone would still
 * put four dead stops in the keyboard order and four "links" under a screen
 * reader. The guard asserts the absence of the href, not the presence of a
 * class, because a class is a look and an href is a promise.
 */
export type HeroChip = {
  /** Catalogue key for the label — never a literal, so Arabic gets it too. */
  readonly labelKey: string;
  readonly cta: string;
};

/** A chip a reader may tap. Every href is a verified, distinct destination. */
export type LiveChip = HeroChip & { readonly href: string };

/** A chip that names something real but unbuilt. Deliberately hrefless. */
export type SoonChip = HeroChip;

export const LIVE_CHIPS: readonly LiveChip[] = [
  { labelKey: "home.chipLessons",        href: "/learn",       cta: "hero_chip_lessons" },
  { labelKey: "home.chipPastPapers",     href: "/past-papers", cta: "hero_chip_past_papers" },
  { labelKey: "home.chipMarkedFeedback", href: "/#try",        cta: "hero_chip_marked_feedback" },
  { labelKey: "home.chipResources",      href: "/resources",   cta: "hero_chip_resources" },
] as const;

export const SOON_CHIPS: readonly SoonChip[] = [
  { labelKey: "home.chipFlashcards",   cta: "hero_chip_soon_flashcards" },
  { labelKey: "home.chipExamBuilder",  cta: "hero_chip_soon_exam_builder" },
  { labelKey: "home.chipQuestionBank", cta: "hero_chip_soon_question_bank" },
  { labelKey: "home.chipProgress",     cta: "hero_chip_soon_progress" },
] as const;

/**
 * ⚠ ROUTES A LIVE CHIP MUST NEVER POINT AT. Each verified as a stub, with the
 * copy a visitor would actually read. Moving a row-2 chip up without building
 * the thing first lands here and the guard fails.
 */
export const STUB_ROUTES: readonly string[] = [
  "/exam-builder",
  "/past-papers/",   // per-paper workspaces: /test is a stub, /classroom is staff-only
];

/** Distinct destinations — the guard asserts one per live chip, never shared. */
export function liveDestinations(): string[] {
  return [...new Set(LIVE_CHIPS.map((c) => c.href))];
}
