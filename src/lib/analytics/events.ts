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
  "calendar_explore",
  "chemistry_course",
  "final_cta",
  "quick_signup_continue",
  "try_mark_answer",
  "try_create_account",
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
};
