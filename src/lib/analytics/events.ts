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
  /**
   * The relocated capability pills. One value for all seven: the destination
   * is already in the href the click resolves to, and seven near-identical
   * source names would say less than one plus the page's own referrer data.
   */
  "home_explore_capability",
  /**
   * ⚠ COURSE ROADMAP (§35). The claim behind the feature is that a planned
   * academic year converts better than a price and a schedule dump — checkable
   * only if opening a roadmap and expanding a week report separately.
   *
   * No PII: control names only. The course is already in the URL these fire
   * from; duplicating it into the event would add nothing and widen what the
   * analytics store holds.
   */
  "course_roadmap_opened",
  "course_roadmap_week_expanded",
  "course_roadmap_resource_clicked",
  "course_roadmap_register_clicked",
  /**
   * ⚠ ONLINE TUITION (§57). The whole argument for the two-mode selector is
   * that a visitor picks a product and everything after is relevant to it —
   * which is only checkable if the mode choice and each commitment report
   * separately. Checkout values are declared but not yet emitted: there is no
   * checkout, and declaring them now means the flow that eventually ships
   * cannot do so unnamed.
   *
   * No PII: every value names a control, never a student, price or cohort.
   */
  "tuition_one_to_one_selected",
  "tuition_group_selected",
  "tuition_group_one_month_selected",
  "tuition_group_three_month_selected",
  "tuition_group_academic_selected",
  "tuition_group_programme_selected",
  "tuition_checkout_started",
  "tuition_checkout_completed",
  /**
   * ⚠ THE CALENDAR AS A BOOKING SURFACE (§56 of the calendar brief).
   * The redesign's claim is that banding, gold and the two shortcuts make
   * bookable time findable — which is only checkable if each step reports
   * separately. Booking-completion values are declared but NOT yet emitted:
   * there is no booking control to fire them, and declaring them now means the
   * flow that eventually does cannot ship unnamed. cta-integrity lists them as
   * "declared but not found", which is the honest state.
   *
   * No PII: every value names a control, never a student, slot or teacher.
   */
  "calendar_day_selected",
  // §50 — the way out of an empty month. Worth knowing how often it is the
  // control a student reaches for, since the month they land on is empty for
  // the whole of the summer.
  "calendar_jump_to_month",
  "next_group_lesson_clicked",
  "next_one_to_one_clicked",
  "one_to_one_slot_opened",
  "group_session_opened",
  "one_to_one_booking_started",
  "group_reservation_started",
  /**
   * ⚠ THE HERO AND TUITION FUNNEL (§45 of the conversion brief).
   * These names come from the brief verbatim so the events it asks to be
   * tracked are the events that exist. Four homepage values were RENAMED to
   * match — home_pillar_* became pillar_*_clicked, hero_start_practising
   * became hero_start_free_clicked, hero_live_tuition became
   * hero_book_tuition_clicked, calendar_explore became hero_calendar_clicked.
   * They had shipped one day earlier, so the discontinuity is a day of data
   * against a namespace that now matches its specification.
   *
   * No PII: every value names a control, never a course, level or person.
   */
  "hero_book_one_to_one_clicked",
  "hero_group_tuition_clicked",
  "audience_student_clicked",
  "audience_parent_clicked",
  "audience_teacher_clicked",
  /**
   * ⚠ THE COURSE SELECTOR, STEP BY STEP (§38). The whole argument for
   * progressive disclosure is that students abandon a fourteen-card wall —
   * which is only checkable if each step reports separately. A single
   * "selector_used" event would tell us it was touched and nothing about
   * WHERE people stop.
   *
   * No PII: every value is a step name, never the course or level chosen.
   */
  "resources_subject_opened",
  "resources_level_selected",
  "resources_qualification_selected",
  "resources_board_selected",
  "resources_course_selected",
  "resources_course_changed",
  /**
   * ⚠ NAVIGATION AND THE HOMEPAGE PILLARS (§39, §25). The header was
   * simplified from six destinations to four on the argument that the four
   * are what students actually use — an argument that can only be checked
   * against click data, so every one of them reports.
   *
   * Nav and pillar are SEPARATE VALUES for the same destination on purpose: a
   * student who clicked Resources in the header was navigating, one who
   * clicked the homepage pillar was still deciding what Ailemy is. Folding
   * them together would answer neither question.
   */
  "nav_resources",
  "nav_past_papers",
  "nav_exam_builder",
  "nav_tuition",
  "nav_subject_chemistry",
  "nav_subject_biology",
  "nav_subject_physics",
  "pillar_resources_clicked",
  "pillar_past_papers_clicked",
  "pillar_exam_builder_clicked",
  "pillar_online_tuition_clicked",
  "hero_start_free_clicked",
  "hero_book_tuition_clicked",
  "floating_start_learning",
  "floating_continue_studying",
  // ⚠ THE TWO STATES OF TuitionCta ARE SEPARATE SOURCES, NOT ONE. A click on
  // the collapsed pill came from somebody who had already dismissed the full
  // bar and came back anyway; folding it into floating_tuition would hide the
  // only evidence that the collapsed state earns its place.
  "floating_tuition",
  "floating_tuition_collapsed",
  "hero_calendar_clicked",
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
  // ── the qualification flow (§40). Subject → level → scope → board, all
  //    public catalogue vocabulary; nothing identifies the student.
  "qualification_flow_opened",
  "qualification_level_selected",
  "qualification_scope_selected",
  "exam_board_selected",
  "exam_board_unsure",
  "flagship_pathway_opened",
  // ── flashcard notes (§51). Deck and card ORDINALS only — never card text,
  //    never what a student saved, never anything identifying.
  "notes_deck_opened",
  "notes_card_viewed",
  "notes_card_flipped",
  "notes_next",
  "notes_previous",
  "notes_card_saved",
  "notes_deck_completed",
  "notes_fullscreen_opened",
  "notes_fullscreen_closed",
  "notes_practice_clicked",
  // ── the Resources Hub (§55, §56). Taxonomy slugs and counts only; search
  //    terms are recorded WITHOUT any identifier, which is what makes
  //    "students keep searching electrolysis" usable and not surveillance.
  "resources_opened",
  "resource_subject_selected",
  "resource_course_selected",
  "topic_opened",
  "resource_search",
  "resource_filter_used",
  "resource_opened",
  "past_paper_opened",
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
  /** Qualification taxonomy (§40) — catalogue slugs, never personal data.
   *  `level` is deliberately NOT redeclared here: the calendar taxonomy above
   *  already carries a level slug, and two properties of the same name with
   *  two meanings is how a funnel quietly splits in half. */
  scope?: string;
  board?: string;
  /** A deck id — catalogue vocabulary, not personal (§51). */
  deck?: string;
  /** Ordinal position in a deck. Never the card's content. */
  cardIndex?: number;
};
