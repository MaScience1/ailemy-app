/**
 * What the public site knows about tuition, announcements and demand capture.
 *
 * ============================================================================
 * ⚠ EVERY SURFACE WORKS BEFORE ANY SQL EXISTS
 * ============================================================================
 * The three migrations these read from (0039, 0040, 0041) are PROPOSED and
 * unapplied. The founder reviews SQL before it ever runs, so the site cannot
 * depend on it having run: each reader tries the database, and falls back to a
 * static value that is TRUE TODAY rather than to an empty list.
 *
 * The fallback is not a placeholder. Every figure below is the founder's own
 * catalogue, and a visitor who sees it is seeing the real offer — the database
 * only makes it editable without a deploy.
 *
 * ⚠ A FALLBACK IS NOT A SILENT FAILURE. Each reader reports which source it
 * used, so a page can say "static" in a dev banner and a test can assert the
 * fallback fires when the table is absent rather than inferring it from a
 * coincidentally-identical result.
 */

export type Source = "database" | "fallback";
export type Loaded<T> = { data: T; source: Source; reason?: string };

// ============================================================================
// TUITION COHORTS
// ============================================================================

export type CohortStatus = "enrolling" | "interest" | "full" | "upcoming" | "closed";

export type Cohort = {
  slug: string;
  title: string;
  subject: string;
  qualification: string;
  pricePence: number;
  currency: string;
  hoursPerWeek: number;
  sessionsPerWeek: number;
  /**
   * ⚠ NULL MEANS THERE IS NO PUBLIC TIMETABLE, AND THE CARD MUST SAY NOTHING.
   * Y10 and Y11 are demand-triggered; inventing "Mon + Wed" to fill the slot
   * would be a promise nobody made.
   */
  scheduleSummary: string | null;
  onboardingOn: string | null;
  firstClassOn: string | null;
  seatCap: number;
  status: CohortStatus;
  /**
   * ⚠ NULL MEANS NO PAYMENT LINK YET. ctaFor() turns that into
   * "Register interest" — never a dead "Enrol".
   */
  enrolmentUrl: string | null;
  summary: string;
  features: string[];
};

/**
 * The catalogue as it actually stands. Figures are the founder's, verbatim.
 */
const COHORTS: Cohort[] = [
  {
    slug: "ial-chemistry-as-sep-2026",
    title: "Edexcel IAL Chemistry AS",
    subject: "chemistry",
    qualification: "ial-as",
    pricePence: 16900,
    currency: "GBP",
    hoursPerWeek: 4,
    sessionsPerWeek: 2,
    scheduleSummary: "Tuesday + Saturday · 7:00–9:30 PM Doha · 2 hours teaching + short break",
    onboardingOn: "2026-09-13",
    firstClassOn: "2026-09-15",
    seatCap: 20,
    // ⚠ 'interest' UNTIL A PAYMENT LINK EXISTS. The founding cohort is real and
    // dated, but enrolmentUrl is null, and a card that says Enrol without one
    // is the dead CTA the spec forbids.
    status: "interest",
    enrolmentUrl: null,
    summary:
      "Small-group teaching built around the exact specification and exam requirements, " +
      "with the Ailemy platform, marked practice and progress tracking included.",
    features: [
      "4 live teaching hours a week, as 2 × 2-hour sessions",
      "Founding cohort capped at 20",
      "Ailemy platform and resources included",
      "Homework and exam practice",
      "Marking and mark-scheme-informed feedback",
      "Progress tracking",
      "Exam preparation",
    ],
  },
  {
    slug: "igcse-chemistry-y11",
    title: "Year 11 GCSE / International GCSE Chemistry",
    subject: "chemistry",
    qualification: "gcse-y11",
    pricePence: 14900,
    currency: "GBP",
    hoursPerWeek: 4,
    sessionsPerWeek: 2,
    scheduleSummary: null,
    onboardingOn: null,
    firstClassOn: null,
    seatCap: 20,
    status: "interest",
    enrolmentUrl: null,
    summary:
      "Repair earlier gaps, finish the specification, then retrieval, timed exam questions " +
      "and full papers ahead of the exam.",
    features: [
      "4 hours a week, as 2 × 2-hour sessions",
      "Maximum 20",
      "GCSE and International GCSE",
      "Board-specific practice differentiated through Ailemy",
    ],
  },
  {
    slug: "igcse-chemistry-y10",
    title: "Year 10 GCSE / International GCSE Chemistry",
    subject: "chemistry",
    qualification: "gcse-y10",
    pricePence: 13900,
    currency: "GBP",
    hoursPerWeek: 3,
    sessionsPerWeek: 2,
    scheduleSummary: null,
    onboardingOn: null,
    firstClassOn: null,
    seatCap: 20,
    status: "interest",
    enrolmentUrl: null,
    summary:
      "A foundation programme: strong conceptual understanding, systematic progression " +
      "through the syllabus, calculations, retrieval and exam habits from the start.",
    features: [
      "3 hours a week, as 2 × 1.5-hour sessions",
      "Maximum 20",
      "Foundation and building programme",
    ],
  },
];

export type Cta = { label: string; href: string; kind: "enrol" | "interest" };

/**
 * What a cohort's button should say and do.
 *
 * ⚠ THE ONLY WAY TO GET "Enrol" IS TO HAVE SOMEWHERE TO SEND THEM. Status alone
 * cannot produce it; the url must exist. This is the same rule 0041's
 * cohorts_enrolling_needs_url enforces in the database, expressed once here so
 * the UI cannot render a dead button even if a row slips through.
 */
export function ctaFor(cohort: Cohort): Cta {
  if (cohort.status === "enrolling" && cohort.enrolmentUrl) {
    return { label: "Enrol", href: cohort.enrolmentUrl, kind: "enrol" };
  }
  if (cohort.status === "full") {
    return { label: "Join the waiting list", href: `/tuition/interest?cohort=${cohort.slug}`, kind: "interest" };
  }
  return { label: "Register interest", href: `/tuition/interest?cohort=${cohort.slug}`, kind: "interest" };
}

/** Price as a parent reads it: "£169/month". */
export function priceLabel(cohort: Cohort): string {
  const symbol = cohort.currency === "GBP" ? "£" : `${cohort.currency} `;
  return `${symbol}${Math.round(cohort.pricePence / 100)}/month`;
}

// ============================================================================
// ANNOUNCEMENTS
// ============================================================================

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  priority: number;
};

/**
 * Which announcement the bar should show, if any.
 *
 * ⚠ NONE IS A VALID ANSWER, AND THE BAR MUST DISAPPEAR. The fallback is an
 * EMPTY list, not a sample banner: a hardcoded announcement would be exactly
 * the thing the founder asked to be able to turn off without a deploy, and it
 * would be un-turn-off-able until 0039 is applied.
 */
export function activeAnnouncement(
  rows: readonly (Announcement & { enabled: boolean; startsAt: string | null; endsAt: string | null })[],
  now: Date,
): Announcement | null {
  const live = rows.filter((r) => {
    if (!r.enabled) return false;
    if (r.startsAt && new Date(r.startsAt) > now) return false;
    if (r.endsAt && new Date(r.endsAt) <= now) return false;
    return true;
  });
  if (live.length === 0) return null;
  // Highest priority wins; a tie is broken by title so the choice is stable
  // rather than dependent on row order.
  return [...live].sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))[0];
}

// ============================================================================
// SUBJECTS
// ============================================================================

export type SubjectStatus = "available" | "expanding" | "interest";

export type Subject = {
  slug: string;
  name: string;
  status: SubjectStatus;
  qualifications: string[];
  blurb: string;
  /** ⚠ NULL WHERE THERE IS NOTHING TO EXPLORE YET — the card must not link. */
  exploreHref: string | null;
};

/**
 * ⚠ HONEST STATUS PER SUBJECT. Chemistry has seeded content and a live paper;
 * Biology and Physics do not, and saying "Start learning" on either would be
 * the fake-functionality the spec forbids.
 */
export const SUBJECTS: Subject[] = [
  {
    slug: "chemistry",
    name: "Chemistry",
    status: "available",
    qualifications: ["GCSE", "International GCSE", "IAL AS", "IAL A2"],
    blurb: "Lessons, exam questions, past papers, marked practice, progress tracking and live tuition.",
    exploreHref: "/learn/chemistry",
  },
  {
    slug: "biology",
    name: "Biology",
    status: "interest",
    qualifications: ["GCSE", "International GCSE", "IAL AS", "IAL A2"],
    blurb: "Cohorts open on demand. Register for priority access as resources and teaching expand.",
    exploreHref: null,
  },
  {
    slug: "physics",
    name: "Physics",
    status: "interest",
    qualifications: ["GCSE", "International GCSE", "IAL AS", "IAL A2"],
    blurb: "Cohorts open on demand. Register for priority access as resources and teaching expand.",
    exploreHref: null,
  },
];

/** The static catalogue, for readers and for tests. */
export const FALLBACK_COHORTS: readonly Cohort[] = COHORTS;
