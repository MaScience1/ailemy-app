/**
 * The funnel event vocabulary (§37, §38).
 *
 * ============================================================================
 * ⚠ ONE LIST, AND A NAME NOT ON IT CANNOT BE SENT
 * ============================================================================
 * §37 asks for consistent event naming. The way that fails is not malice — it
 * is `capture("signup_started")` in one file and `capture("signupStarted")` in
 * another six months later, after which the funnel silently splits in two and
 * nobody notices because both lines have data in them.
 *
 * So the names are a union type. A typo is a compile error rather than a
 * half-empty chart.
 *
 * ⚠ AND NO EVENT CARRIES PERSONAL DATA (§37). There is no `email` property
 * anywhere in this file and the payload type forbids one: values are strings
 * from a fixed set, booleans and numbers. A funnel needs to know THAT somebody
 * submitted an interest form; it does not need to know who.
 *
 * ⚠ THE CTA SOURCE NAMES ARE §38'S, VERBATIM. They are also the `data-cta`
 * attributes already sitting on the buttons, so the markup and the analytics
 * cannot drift — the attribute IS the event property.
 */

export const CTA_SOURCES = [
  "hero_start_practising",
  "hero_live_tuition",
  "floating_start_learning",
  "floating_continue_studying",
  // ⚠ THE TWO STATES OF TuitionCta ARE SEPARATE SOURCES, NOT ONE. A click on
  // the collapsed pill came from somebody who had already dismissed the full
  // bar and came back anyway; folding it into floating_tuition would hide the
  // only evidence that the collapsed state earns its place.
  "floating_tuition",
  "floating_tuition_collapsed",
  "calendar_explore",
  "chemistry_course",
  "final_cta",
  "quick_signup_continue",
  "try_mark_answer",
  "try_create_account",
  // ⚠ THESE FOUR EXISTED AS data-cta ATTRIBUTES AND NOWHERE ELSE, WHICH MEANT
  // THEY EMITTED NOTHING. Analytics.tsx filters every data-cta against this
  // list and silently drops anything absent — so four instrumented-looking
  // buttons in the lesson practice surface had been reporting no clicks at
  // all. The file header claims "the markup and the analytics cannot drift";
  // they had, precisely because nothing tested the claim. lesson-cta.test.ts
  // now does.
  "lesson_practice_start",
  "lesson_practice_submit",
  "lesson_practice_regenerate",
  "lesson_practice_retry_mistakes",
] as const;
export type CtaSource = (typeof CTA_SOURCES)[number];

export const EVENTS = [
  "homepage_viewed",
  "subject_selected",
  "interactive_question_attempted",
  "mark_answer_clicked",
  "signup_modal_opened",
  "signup_started",
  "signup_completed",
  "calendar_opened",
  "calendar_date_selected",
  "session_viewed",
  "one_to_one_slot_selected",
  "chemistry_programme_viewed",
  "checkout_started",
  "checkout_completed",
  "biology_interest_submitted",
  "physics_interest_submitted",
  "waitlist_joined",
  "cta_clicked",
  // ── the lesson player + practice funnel (§91). No answers, no scores tied
  //    to identity — the academic record lives in the database, not PostHog.
  "lesson_opened",
  "lesson_slide_viewed",
  "lesson_build_advanced",
  "lesson_slides_completed",
  "lesson_fullscreen_entered",
  "lesson_resume_offered",
  "lesson_resume_accepted",
  "lesson_practice_started",
  "lesson_practice_submitted",
  "lesson_practice_regenerated",
  "lesson_mistakes_retried",
  "lesson_review_slide_clicked",
  // ── the six-section lesson journey (§96). Section KEYS and ordinals only:
  //    what a student answered stays in the academic record, never here.
  "lesson_section_viewed",
  "lesson_section_completed",
  "lesson_progress_opened",
  "lesson_completed",
  "notes_opened",
  "worked_example_opened",
  "exam_question_started",
  "review_resource_clicked",
  "homepage_subject_clicked",
  "homepage_capability_clicked",
  "tuition_sticky_cta_clicked",
  "account_menu_opened",
] as const;
export type EventName = (typeof EVENTS)[number];

/**
 * ⚠ NO FREE-FORM VALUES. A `Record<string, unknown>` payload is how an email
 * address ends up in an analytics provider six months from now — somebody
 * spreads a form object into a capture call and nothing stops them.
 */
export type EventProps = {
  cta?: CtaSource;
  subject?: "chemistry" | "biology" | "physics";
  /** A cohort slug — public catalogue data, not personal. */
  cohort?: string;
  /** A level slug from the calendar taxonomy. */
  level?: string;
  view?: "month" | "week" | "upcoming";
  /** Marks awarded on the sample question. Not tied to a person. */
  score?: number;
  outOf?: number;
  signedIn?: boolean;
  /** Lesson-player context (§91): slugs and ordinals only — never answer text. */
  lesson?: string;
  slide?: number;
  frame?: number;
  attemptNo?: number;
  /** A lesson section key — one of the six in src/lib/lesson/sections.ts. */
  section?: string;
  /** How a completion happened: the student said so, or we observed it. */
  source?: "manual" | "auto";
  /** Which teaching resource a review link pointed at. */
  resource?: "slide" | "notes" | "worked_example";
  /** A homepage capability label — public navigation, not personal. */
  capability?: string;
};
