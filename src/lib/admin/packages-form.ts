import type { Validated } from "./schedule-form.ts";

/**
 * What a valid 1-to-1 package is (§30, §64, §80).
 *
 * ============================================================================
 * ⚠ THE PRICE IS TYPED IN POUNDS AND STORED IN MINOR UNITS
 * ============================================================================
 * An admin types 45 or 45.00; the column is `price_minor integer`. Doing that
 * conversion in the form handler rather than in the template is what stops
 * £45.00 being stored as 45 pence — an error that renders as a plausible
 * "£0.45" and is only caught by someone reading the page carefully.
 *
 * Parsed by string, not by `Math.round(Number(x) * 100)`: 19.99 * 100 is
 * 1998.9999999999998 in IEEE 754, and while Math.round rescues that one, the
 * class of bug does not deserve to be in a money path at all.
 *
 * ⚠ AN ACTIVE PACKAGE MUST BE BUYABLE, mirroring
 * tuition_packages_active_needs_price. This is the same rule as
 * cohorts_enrolling_needs_url: a live product with no payment link is a dead
 * Buy button, and the database refuses it with a 23514 that names a constraint
 * rather than the problem.
 *
 * ⚠ AND A STRIPE PRICE ID IS NOT THE SAME AS A PAYABLE SITE. Stripe is keyless
 * in every environment right now, so even a package with a real price_id
 * renders "Booking opens soon" and no CTA. Setting one here is preparation, not
 * publication, and the admin screen says so rather than letting a green toggle
 * imply money can move.
 */

const str = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const orNull = (fd: FormData, k: string): string | null => str(fd, k) || null;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Stripe's own shape. A pasted product id (prod_…) is the common mistake. */
const PRICE_ID_RE = /^price_[A-Za-z0-9]+$/;

/**
 * ⚠ EXPORTED FOR THE SUITE. Money parsing is the one thing here worth aiming
 * assertions directly at.
 */
export function parseMinorUnits(raw: string): number | null {
  const s = raw.replace(/[, ]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export type PackageInput = {
  slug: string;
  name: string;
  description: string | null;
  subject: string | null;
  credits: number;
  slotMinutes: number;
  priceMinor: number;
  currency: string;
  stripePriceId: string | null;
  validityMonths: number | null;
  displayOrder: number;
  isActive: boolean;
};

export function readPackageForm(fd: FormData): Validated<PackageInput> {
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Give the package a name — it is what a student sees." };

  const slug = str(fd, "slug").toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: "The slug must be lower-case words joined by hyphens, e.g. single-lesson." };
  }

  const credits = Number(str(fd, "credits"));
  if (!Number.isInteger(credits) || credits < 1 || credits > 100) {
    return { ok: false, error: "Credits must be a whole number between 1 and 100." };
  }

  const slotRaw = str(fd, "slot_minutes") || "60";
  const slotMinutes = Number(slotRaw);
  if (!Number.isInteger(slotMinutes) || slotMinutes < 15 || slotMinutes > 480) {
    return { ok: false, error: "Slot length must be between 15 and 480 minutes." };
  }

  const priceRaw = str(fd, "price");
  const priceMinor = parseMinorUnits(priceRaw);
  if (priceMinor === null) {
    return { ok: false, error: "Give the price as a number, e.g. 45 or 45.00." };
  }
  // Mirrors tuition_packages_price_positive. A free package is not a package,
  // it is a bug that charges nobody and reconciles against nothing.
  if (priceMinor <= 0) return { ok: false, error: "The price must be more than zero." };

  const currency = (str(fd, "currency") || "GBP").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "Currency must be a three-letter code." };

  const stripePriceId = orNull(fd, "stripe_price_id");
  if (stripePriceId !== null && !PRICE_ID_RE.test(stripePriceId)) {
    return {
      ok: false,
      error: "A Stripe price id looks like price_1A2b3C… — a prod_… id is the product, not the price.",
    };
  }

  const validityRaw = str(fd, "validity_months");
  let validityMonths: number | null = null;
  if (validityRaw) {
    const n = Number(validityRaw);
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      return { ok: false, error: "Validity must be between 1 and 60 months, or blank for never expires." };
    }
    validityMonths = n;
  }

  const orderRaw = str(fd, "display_order") || "0";
  const displayOrder = Number(orderRaw);
  if (!Number.isInteger(displayOrder)) return { ok: false, error: "Display order must be a whole number." };

  const isActive = fd.get("is_active") !== null;
  // ⚠ CAUGHT HERE SO THE ADMIN READS A SENTENCE. The database refuses this too
  // — that is the enforcement — but as
  // 'violates check constraint "tuition_packages_active_needs_price"'.
  if (isActive && stripePriceId === null) {
    return {
      ok: false,
      error: "A live package needs a Stripe price id — without one the Buy button cannot do anything.",
    };
  }

  return {
    ok: true,
    value: {
      slug, name, description: orNull(fd, "description"), subject: orNull(fd, "subject"),
      credits, slotMinutes, priceMinor, currency, stripePriceId,
      validityMonths, displayOrder, isActive,
    },
  };
}
