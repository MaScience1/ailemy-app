import { stripeConfig } from "@/lib/booking/config";
import { SUBJECTS } from "@/lib/public/catalogue";
import { createAdminClient } from "@/lib/supabase/admin";

import { PackageActions, PackageForm, type PackageValue } from "./_forms";

/**
 * 1-to-1 packages (§30, §64, §80).
 *
 * ============================================================================
 * ⚠ NOTHING HERE IS SEEDED, AND THE CODE HOLDS NO PACKAGE DEFINITIONS
 * ============================================================================
 * 0047 is explicit about it: what the founder sells is admin-configurable, so
 * an empty table is an empty product list and not a bug. That is the opposite
 * of the cohorts, whose three published rows carry locked commercial facts.
 *
 * ⚠ AND A LIVE PACKAGE IS STILL NOT A PAYABLE ONE. Stripe is keyless in every
 * environment right now, so even a package with a real price id renders
 * "Booking opens soon" and no CTA. The banner says so, because a green "Live"
 * badge otherwise implies money can move.
 */
export const dynamic = "force-dynamic";

type Search = Promise<{ edit?: string }>;

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2 })
    .format(minor / 100);

export default async function AdminPackagesPage({ searchParams }: { searchParams: Search }) {
  const editing = (await searchParams).edit ?? null;
  const db = createAdminClient();
  const stripe = stripeConfig();

  const res = await db
    .from("tuition_packages")
    .select("id,slug,name,description,subject,credits,slot_minutes,price_minor,currency,stripe_price_id,validity_months,display_order,is_active")
    .order("display_order");

  const notMigrated = res.error && ["PGRST205", "42P01", "PGRST204", "42703"].includes(res.error.code ?? "");
  const packages = (res.data ?? []) as unknown as PackageValue[];
  const editPackage = packages.find((p) => p.id === editing) ?? null;

  // ⚠ COUNTED, NOT ASSUMED. "Live but unsellable" is the state that produces a
  // dead Buy button, and it is worth naming with a number rather than leaving
  // an admin to scan the list.
  const liveWithoutPrice = packages.filter((p) => p.is_active && !p.stripe_price_id).length;

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium">1-to-1 packages</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        What a student can buy: a single lesson, or a bundle of credits. Nothing is seeded — an
        empty list means nothing is on sale, which is a real state and not a fault.
      </p>

      {/* ⚠ THE KEYLESS BANNER IS NOT A WARNING, IT IS THE CURRENT TRUTH. */}
      <p className={`mt-6 rounded border px-4 py-3 text-sm ${
        stripe.configured
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-slate-300 bg-slate-50 text-slate-700"
      }`}>
        {stripe.configured ? (
          <>Stripe is configured in <strong>{stripe.live ? "LIVE" : "test"}</strong> mode. Live packages can be bought.</>
        ) : (
          <>
            Stripe has no keys in this environment, so <strong>nothing on the site is payable</strong>.
            Packages marked live show “Booking opens soon” to students, not a Buy button. Setting a
            price id here is preparation, not publication.
            <span className="ml-1 font-mono text-[11px]">missing: {stripe.missing.join(", ")}</span>
          </>
        )}
      </p>

      {res.error && (
        <p role="alert" className="mt-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notMigrated
            ? "Migration 0047 has not been applied yet, so the packages table does not exist. Nothing on this screen can be saved until it is run."
            : "Could not load packages."}{" "}
          <span className="font-mono text-[11px]">{res.error.code}: {res.error.message}</span>
        </p>
      )}

      {liveWithoutPrice > 0 && (
        <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {liveWithoutPrice} live package(s) have no Stripe price id. The database is supposed to
          refuse that — if you can see this, check the tuition_packages_active_needs_price constraint.
        </p>
      )}

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-display text-lg font-medium">{editPackage ? "Edit package" : "Add a package"}</h2>
        <div className="mt-5">
          {editPackage
            ? <PackageForm subjects={SUBJECTS.map((s) => s.slug)} value={editPackage} />
            : <PackageForm subjects={SUBJECTS.map((s) => s.slug)} />}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-display text-lg font-medium">Packages</h2>
        <div className="mt-5">
          {packages.filter((p) => p.id !== editing).length === 0 ? (
            <p className="text-sm text-slate-600">
              {packages.length === 0
                ? "Nothing on sale. Students see the 1-to-1 pages with no prices and no Buy buttons."
                : "Editing the only package."}
            </p>
          ) : (
            <ul className="space-y-2">
              {packages.filter((p) => p.id !== editing).map((p) => (
                <li key={p.id} className="flex flex-wrap items-start gap-3 rounded border border-slate-200 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {p.name}{" "}
                      <span className="font-normal text-slate-500">
                        — {money(p.price_minor, p.currency)} for {p.credits} × {p.slot_minutes}min
                      </span>
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {p.slug} · {p.subject ?? "any subject"} ·{" "}
                      {money(Math.round(p.price_minor / p.credits), p.currency)}/lesson ·{" "}
                      {p.validity_months ? `expires after ${p.validity_months}mo` : "never expires"} ·{" "}
                      {p.stripe_price_id ?? "NO STRIPE PRICE"}
                      {p.is_active ? "" : " · draft"}
                    </p>
                  </div>
                  <a href={`?edit=${p.id}`} className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-slate-500">
                    Edit
                  </a>
                  <PackageActions id={p.id} isActive={p.is_active} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
