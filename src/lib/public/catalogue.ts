/**
 * What the public site knows about tuition, announcements and demand capture.
 *
 * ============================================================================
 * ⚠ EVERY SURFACE WORKS WITHOUT THE DATABASE
 * ============================================================================
 * 0039, 0040, 0041 and 0042 are all APPLIED (2026-08-19) and the readers use
 * them. The fallback stays, and stays exercised, because "the migration has not
 * run yet" was only ever one of the ways this data can be missing — an outage,
 * a revoked grant, a policy change or an empty table all look the same to a
 * page. Each reader tries the database and falls back to a static value that is
 * TRUE TODAY rather than to an empty list.
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
  /**
   * ⚠ DISPLAY ONLY, IN WHOLE QATARI RIYALS, AND NULL IS COMMON (0042).
   * pricePence is the billed amount; this is a label a visitor in Doha can
   * read. NULL means no QAR price has been set, and the card must render GBP
   * regardless of where the visitor is — never a converted figure, because no
   * FX rate exists anywhere in this system.
   */
  priceQar: number | null;
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
  /**
   * ⚠ NULLABLE, AND THAT IS LOAD-BEARING. cohorts.year_group arrives with 0054
   * and every AS cohort legitimately has none — a year group is a GCSE concept.
   * cohortFromRow REFUSES rows rather than defaulting them, so a required field
   * here would make every existing row unmappable the moment the column is
   * absent or empty, and loadCohorts would return nothing with no error.
   */
  yearGroup: string | null;
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
    priceQar: 800,
    hoursPerWeek: 4,
    sessionsPerWeek: 2,
    scheduleSummary: "Tuesday + Saturday · 7:00–9:30 PM Doha · 2 hours teaching + short break",
    onboardingOn: "2026-09-13",
    firstClassOn: "2026-09-15",
    // ⚠ NULL FOR AS IS CORRECT, NOT A MISS — 0054's own verification says so.
    yearGroup: null,
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
    priceQar: 700,
    hoursPerWeek: 4,
    sessionsPerWeek: 2,
    scheduleSummary: null,
    onboardingOn: null,
    firstClassOn: null,
    // 0054 stores the LABEL, not a slug — levelForYearGroup bridges them.
    yearGroup: "Year 11",
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
    priceQar: 650,
    hoursPerWeek: 3,
    sessionsPerWeek: 2,
    scheduleSummary: null,
    onboardingOn: null,
    firstClassOn: null,
    // 0054 stores the LABEL, not a slug — levelForYearGroup bridges them.
    yearGroup: "Year 10",
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
    // ⚠ §50 — this said only "Cohorts open on demand", which understated what
    // Ailemy already has. Biology carries 90 live past papers today (more than
    // Chemistry's 71). Telling a Biology student there is nothing here yet is
    // as inaccurate as promising lessons that do not exist.
    blurb: "Past papers available now. Structured lessons and tuition expanding — register interest for priority access.",
    exploreHref: null,
  },
  {
    slug: "physics",
    name: "Physics",
    status: "interest",
    qualifications: ["GCSE", "International GCSE", "IAL AS", "IAL A2"],
    // ⚠ §50 — 72 live Physics past papers exist today. Same correction.
    blurb: "Past papers available now. Structured lessons and tuition expanding — register interest for priority access.",
    exploreHref: null,
  },
];

/** The static catalogue, for readers and for tests. */
export const FALLBACK_COHORTS: readonly Cohort[] = COHORTS;

// ============================================================================
// DATABASE ROWS → CATALOGUE VALUES
// ============================================================================
//
// ⚠ EVERY MAPPER REFUSES RATHER THAN INVENTS. A row missing `subject` is not a
// Chemistry cohort with a default; a row missing `title` is not a card with an
// empty heading. The reader drops it and says which row and why, because a
// silently-defaulted row is a wrong price or a wrong subject on a parent's
// screen and nothing on the page says so.
//
// These are pure so they can be tested without a database. readers.ts does the
// I/O and calls them; the decisions live here.

export type RowRefusal = { ok: false; reason: string };
export type Mapped<T> = { ok: true; value: T } | RowRefusal;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;

const COHORT_STATUSES: readonly CohortStatus[] = ["enrolling", "interest", "full", "upcoming", "closed"];

/**
 * One `cohorts` row (post-0041) as a catalogue Cohort.
 *
 * ⚠ THE DEAD-CTA RULE IS ENFORCED HERE TOO, NOT ONLY IN SQL AND ctaFor().
 * 0041's cohorts_enrolling_needs_url stops such a row being written; ctaFor()
 * stops it being rendered. This middle layer downgrades it on the way past so
 * the three cannot disagree — and says so in the refusal channel rather than
 * quietly rewriting a status the admin chose.
 */
export function cohortFromRow(row: Record<string, unknown>): Mapped<Cohort> {
  const slug = str(row.slug);
  if (!slug) return { ok: false, reason: "row has no slug" };

  const title = str(row.title);
  if (!title) return { ok: false, reason: `${slug}: no title` };

  const subject = str(row.subject);
  if (!subject) return { ok: false, reason: `${slug}: no subject — it cannot be placed on a subject page` };

  const qualification = str(row.qualification);
  if (!qualification) return { ok: false, reason: `${slug}: no qualification` };

  const pricePence = num(row.price_pence);
  if (pricePence === null) return { ok: false, reason: `${slug}: no price_pence` };

  const statusRaw = str(row.status);
  if (!statusRaw || !(COHORT_STATUSES as readonly string[]).includes(statusRaw)) {
    return { ok: false, reason: `${slug}: status ${JSON.stringify(statusRaw)} is not one of ${COHORT_STATUSES.join("/")}` };
  }
  let status = statusRaw as CohortStatus;

  const enrolmentUrl = str(row.enrolment_url);
  if (status === "enrolling" && !enrolmentUrl) {
    // Not a refusal — the cohort is real and should still appear. It just
    // cannot claim to be enrolling with nowhere to send anyone.
    status = "interest";
  }

  const features = Array.isArray(row.features)
    ? row.features.filter((f): f is string => typeof f === "string" && f.trim().length > 0).map((f) => f.trim())
    : [];

  return {
    ok: true,
    value: {
      slug,
      title,
      subject,
      qualification,
      pricePence,
      currency: str(row.currency) ?? "GBP",
      // ⚠ NULL STAYS NULL — it is the signal that this cohort has no QAR price
      // and must render GBP. A default of 0 would reach a card as "0 QAR/month".
      priceQar: num(row.price_qar),
      hoursPerWeek: num(row.hours_per_week) ?? 0,
      sessionsPerWeek: num(row.sessions_per_week) ?? 0,
      // ⚠ NULL STAYS NULL. An absent schedule_summary is "no published
      // timetable", and the card renders nothing. Defaulting to "" would be the
      // same on screen; defaulting to anything else would be an invented promise.
      scheduleSummary: str(row.schedule_summary),
      onboardingOn: str(row.onboarding_on),
      firstClassOn: str(row.starts_on),
      // ⚠ NULL STAYS NULL — see the type. An AS cohort has no year group.
      yearGroup: str(row.year_group),
      seatCap: num(row.seat_cap) ?? 0,
      status,
      enrolmentUrl,
      summary: str(row.summary) ?? "",
      features,
    },
  };
}

/** One `announcements` row (post-0039) as a bar-ready Announcement. */
export type AnnouncementRow = Announcement & {
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export function announcementFromRow(row: Record<string, unknown>): Mapped<AnnouncementRow> {
  const id = str(row.id);
  if (!id) return { ok: false, reason: "row has no id" };
  const title = str(row.title);
  if (!title) return { ok: false, reason: `${id}: no title — the bar would render an empty strip` };

  const ctaLabel = str(row.cta_label);
  const ctaUrl = str(row.link_url);

  return {
    ok: true,
    value: {
      id,
      title,
      body: str(row.body),
      // ⚠ HALF A CTA IS NO CTA. A label with no url is a button that goes
      // nowhere; a url with no label has no words. Either alone is dropped.
      ctaLabel: ctaLabel && ctaUrl ? ctaLabel : null,
      ctaUrl: ctaLabel && ctaUrl ? ctaUrl : null,
      priority: num(row.priority) ?? 0,
      enabled: row.enabled === true,
      startsAt: str(row.starts_at),
      endsAt: str(row.ends_at),
    },
  };
}

/**
 * Which cohort list the site should show.
 *
 * ⚠ AN EMPTY DATABASE IS NOT AN EMPTY CATALOGUE. Zero public rows means 0041
 * has not been applied, or nobody has ticked is_public yet — and either way the
 * honest thing on screen is the founder's real offer, not a blank page where
 * three cohorts used to be. This is the ONE place that decision is made, so a
 * page cannot make a different one.
 *
 * Announcements are the opposite and deliberately so: there, empty IS the
 * answer, and activeAnnouncement() returning null hides the bar.
 */
export function chooseCohorts(
  rows: readonly Cohort[],
  fallback: readonly Cohort[],
): Loaded<readonly Cohort[]> {
  if (rows.length === 0) {
    return { data: fallback, source: "fallback", reason: "no public cohort rows" };
  }
  // ⚠ ORDER IS THE CALLER'S, NOT OURS. The reader asks the database for
  // display_order, and the fallback list is in the founder's own order (AS,
  // Y11, Y10). Re-sorting here would silently override an admin's ordering
  // with alphabetical slugs.
  return { data: rows, source: "database" };
}
