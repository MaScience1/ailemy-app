/**
 * The vocabulary the browser is allowed to speak.
 *
 * ⚠ THESE UNIONS ARE THE ALLOWLIST. A checkout request carries a course, a
 * mode, a package and a currency — four closed sets — and nothing else. It
 * never carries a price id, a product id, an amount, an interval or a
 * quantity, because every one of those is a commercial decision the server
 * makes by reading Stripe.
 */
export const COURSES = ["as", "year11", "year10", "gcse"] as const;
export type Course = (typeof COURSES)[number];

export const MODES = ["one_to_one", "group"] as const;
export type Mode = (typeof MODES)[number];

export const PACKAGES = ["single", "five_hour", "monthly", "three_month", "academic_year"] as const;
export type Package = (typeof PACKAGES)[number];

export const CURRENCIES = ["qar", "gbp"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Selection = { course: Course; mode: Mode; package: Package; currency: Currency };

export function isCourse(v: unknown): v is Course { return COURSES.includes(v as Course); }
export function isMode(v: unknown): v is Mode { return MODES.includes(v as Mode); }
export function isPackage(v: unknown): v is Package { return PACKAGES.includes(v as Package); }
export function isCurrency(v: unknown): v is Currency { return CURRENCIES.includes(v as Currency); }

/**
 * ⚠ PARSED, NOT CAST. An unknown body from the network becomes a Selection only
 * by passing four membership tests; anything else is null and the route
 * refuses. There is no `as Selection` anywhere on the request path.
 */
export function parseSelection(v: unknown): Selection | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isCourse(o.course) || !isMode(o.mode) || !isPackage(o.package) || !isCurrency(o.currency)) return null;
  return { course: o.course, mode: o.mode, package: o.package, currency: o.currency };
}

/** What a mode legitimately sells. A group "five_hour" is not a thing. */
export const PACKAGES_FOR: Record<Mode, readonly Package[]> = {
  one_to_one: ["single", "five_hour"],
  group: ["monthly", "three_month", "academic_year"],
};

export function packageFitsMode(mode: Mode, pkg: Package): boolean {
  return PACKAGES_FOR[mode].includes(pkg);
}

/** The safe DTO the client receives. No Stripe object, no secret, no key. */
export type PriceView = {
  course: Course;
  mode: Mode;
  package: Package;
  stripePriceId: string;
  type: "recurring" | "one_off";
  interval: string | null;
  /** Minor units keyed by currency — only currencies the Price actually supports. */
  amounts: Partial<Record<Currency, number>>;
  formatted: Partial<Record<Currency, string>>;
};

export type EntitlementGrant =
  | { kind: "one_to_one_credits"; level: "as_a_level" | "gcse"; credits: number }
  | { kind: "group_enrolment"; course: Course; term: "monthly" | "three_month" | "academic_year" };

/**
 * Which Stripe course a cohort belongs to.
 *
 * ⚠ KEYED ON `qualification`, NOT ON THE SLUG. The slugs carry an intake date —
 * ial-chemistry-as-sep-2026 — so a slug map silently unmaps the September 2027
 * cohort and the card renders "Pricing unavailable" for a live programme. The
 * qualification column is the taxonomy the catalogue already uses
 * (ial-as, ial-a2, gcse-y11, gcse-y10) and does not move between intakes.
 *
 * ⚠ AND IT REFUSES RATHER THAN GUESSING. An unrecognised qualification returns
 * null and the card says it cannot price itself. Falling back to "as" would
 * put AS prices on a Year 10 card and look entirely deliberate.
 */
export function courseForQualification(qualification: string | null | undefined): Course | null {
  switch ((qualification ?? "").trim().toLowerCase()) {
    case "ial-as":
    case "ial-a2":
      return "as";
    case "gcse-y11":
      return "year11";
    case "gcse-y10":
      return "year10";
    default:
      return null;
  }
}
