/**
 * Pathway enum + display copy.
 *
 * A "pathway" is a coarse educational level grouping that sits between
 * subject and curriculum (e.g. "International A-Level" groups Edexcel IAL
 * and Cambridge IAL). This file is the single source of truth for the
 * 6 pathway slugs and how they're presented in the catalogue UI.
 *
 * The string values match the pathway_type Postgres enum created in
 * supabase/migrations/0005_add_pathway_to_courses.sql.
 */

export const PATHWAY_SLUGS = [
  "uk-a-level",
  "international-a-level",
  "ib",
  "ap",
  "uk-gcse",
  "igcse",
] as const;

export type Pathway = (typeof PATHWAY_SLUGS)[number];

/** Narrow an unknown string to Pathway. Use in route param validators. */
export function isPathway(value: string): value is Pathway {
  return (PATHWAY_SLUGS as readonly string[]).includes(value);
}

export type PathwayCopy = {
  slug: Pathway;
  /** Short display name used in cards and breadcrumbs. */
  name: string;
  /** Even-shorter abbreviation (used inline in dense places). */
  shortName: string;
  /** Target age range, shown as the eyebrow on pathway cards. */
  ageRange: string;
  /** One-line description shown beneath the name on the pathway card. */
  description: string;
};

export const PATHWAY_COPY: Record<Pathway, PathwayCopy> = {
  "international-a-level": {
    slug: "international-a-level",
    name: "International A-Level",
    shortName: "IAL",
    ageRange: "Year 12–13 · international",
    description:
      "Edexcel IAL and Cambridge IAL — taught at international schools worldwide.",
  },
  "uk-a-level": {
    slug: "uk-a-level",
    name: "UK A-Level",
    shortName: "A-Level",
    ageRange: "Year 12–13 · UK",
    description:
      "AQA, Edexcel and OCR A-Level — taught in UK schools and sixth forms.",
  },
  ib: {
    slug: "ib",
    name: "International Baccalaureate",
    shortName: "IB",
    ageRange: "IB Diploma",
    description: "IB Chemistry, Physics and Biology — Higher and Standard Level.",
  },
  ap: {
    slug: "ap",
    name: "Advanced Placement",
    shortName: "AP",
    ageRange: "US high school",
    description: "College Board AP — Chemistry, Physics, Biology and beyond.",
  },
  igcse: {
    slug: "igcse",
    name: "International GCSE",
    shortName: "IGCSE",
    ageRange: "Year 10–11 · international",
    description:
      "Edexcel IGCSE and Cambridge IGCSE — taught at international schools.",
  },
  "uk-gcse": {
    slug: "uk-gcse",
    name: "UK GCSE",
    shortName: "GCSE",
    ageRange: "Year 10–11 · UK",
    description: "AQA, Edexcel and OCR GCSE — taught in UK secondary schools.",
  },
};

/**
 * Display order for the 6 pathway cards on /learn/[subject].
 * Mirrors typical student journey by qualification weight, with our
 * current launch focus (IAL) at the top.
 */
export const PATHWAY_DISPLAY_ORDER: readonly Pathway[] = [
  "international-a-level",
  "uk-a-level",
  "ib",
  "ap",
  "igcse",
  "uk-gcse",
];
