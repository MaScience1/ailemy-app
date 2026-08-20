"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/lib/admin/auth";
import { readPackageForm } from "@/lib/admin/packages-form";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 1-to-1 packages (§30, §64, §80).
 *
 * ⚠ assertAdmin() FIRST. A server action is a POST endpoint.
 *
 * ⚠ SERVICE ROLE. 0047 grants anon and authenticated SELECT on
 * tuition_packages and nothing else, so every write is server-side by design.
 *
 * ⚠ AND THESE PATHS ARE PRICE SURFACES. A package edit changes what /tuition,
 * /tuition/one-to-one and every calendar chip quote. Revalidating only this
 * screen would leave a stale price on the pages a student actually reads,
 * which is the one kind of staleness that is worse than a stale timetable.
 */

type Result = { ok: true } | { ok: false; error: string };

const PRICE_PATHS = [
  "/", "/calendar", "/tuition", "/tuition/one-to-one",
  "/chemistry", "/biology", "/physics", "/admin/packages",
];

function refresh() {
  for (const p of PRICE_PATHS) revalidatePath(p);
}

function explain(error: { code?: string; message?: string }): string {
  if (error.code === "PGRST205" || error.code === "42P01") {
    return "Migration 0047 has not been applied — the packages table does not exist yet.";
  }
  if (error.code === "PGRST204" || error.code === "42703") {
    return `Migration 0047 has not been applied in full. (${error.message})`;
  }
  if (error.code === "23505") {
    return "A package with that slug already exists. Slugs have to be unique — edit that one instead.";
  }
  // ⚠ NAMED, NOT PASSED THROUGH. tuition_packages_active_needs_price is the
  // constraint an admin will actually hit, and "violates check constraint" is
  // not a sentence that tells them to paste a Stripe price id.
  if (error.code === "23514") {
    if ((error.message ?? "").includes("active_needs_price")) {
      return "A live package needs a Stripe price id — the database refused to publish one without it.";
    }
    return `The database refused this: ${error.message}`;
  }
  return error.message ?? "Unknown database error.";
}

function missing(): Result {
  return { ok: false, error: "That package no longer exists — reload the page." };
}

export async function createPackage(_prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();
  const parsed = readPackageForm(fd);
  if (!parsed.ok) return parsed;
  const v = parsed.value;

  const { error } = await createAdminClient().from("tuition_packages").insert({
    slug: v.slug, name: v.name, description: v.description, subject: v.subject,
    credits: v.credits, slot_minutes: v.slotMinutes,
    price_minor: v.priceMinor, currency: v.currency,
    stripe_price_id: v.stripePriceId, validity_months: v.validityMonths,
    display_order: v.displayOrder, is_active: v.isActive,
  });
  if (error) return { ok: false, error: explain(error) };
  refresh();
  return { ok: true };
}

/**
 * ⚠ EDITING A PRICE DOES NOT REPRICE A CREDIT SOMEBODY ALREADY BOUGHT. 0047's
 * ledger records what was paid at the time; this table is the offer, not the
 * receipt. Raising £45 to £50 affects the next purchase and nothing else, which
 * is correct and worth stating on screen so nobody edits a package expecting to
 * settle a dispute with it.
 */
export async function updatePackage(id: string, _prev: Result | null, fd: FormData): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing package id." };
  const parsed = readPackageForm(fd);
  if (!parsed.ok) return parsed;
  const v = parsed.value;

  const { data, error } = await createAdminClient()
    .from("tuition_packages")
    .update({
      slug: v.slug, name: v.name, description: v.description, subject: v.subject,
      credits: v.credits, slot_minutes: v.slotMinutes,
      price_minor: v.priceMinor, currency: v.currency,
      stripe_price_id: v.stripePriceId, validity_months: v.validityMonths,
      display_order: v.displayOrder, is_active: v.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: explain(error) };
  if (!data || data.length === 0) return missing();
  refresh();
  return { ok: true };
}

/**
 * ⚠ UNPUBLISHING IS ALWAYS ALLOWED; PUBLISHING IS NOT. Taking a package off
 * sale must never be blocked, so the un-publish path sets is_active false with
 * no other condition. Publishing checks for a Stripe price id first — the
 * database refuses it anyway, and a 23514 is a worse way to learn.
 */
export async function setPackageActive(id: string, isActive: boolean): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing package id." };
  const db = createAdminClient();

  if (isActive) {
    const { data, error } = await db
      .from("tuition_packages").select("stripe_price_id").eq("id", id).limit(1);
    if (error) return { ok: false, error: explain(error) };
    if (!data || data.length === 0) return missing();
    if (!(data[0] as { stripe_price_id: string | null }).stripe_price_id) {
      return {
        ok: false,
        error: "This package has no Stripe price id, so a Buy button could not do anything. Add one first.",
      };
    }
  }

  const { data, error } = await db
    .from("tuition_packages")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: explain(error) };
  if (!data || data.length === 0) return missing();
  refresh();
  return { ok: true };
}

/**
 * ⚠ DELETING A PACKAGE IS NOT DELETING WHAT PEOPLE BOUGHT. 0047 references it
 * from lesson_credit_transactions with ON DELETE SET NULL, so the ledger rows
 * survive with package_id NULL — the credits stay, the receipt loses its link
 * to a package that no longer exists. Unpublishing keeps that link, which is
 * why the UI offers it first and says so.
 */
export async function deletePackage(id: string): Promise<Result> {
  await assertAdmin();
  if (!id) return { ok: false, error: "Missing package id." };
  const { data, error } = await createAdminClient()
    .from("tuition_packages").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: explain(error) };
  if (!data || data.length === 0) return missing();
  refresh();
  return { ok: true };
}
