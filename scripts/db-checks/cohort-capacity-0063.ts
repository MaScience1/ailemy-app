/**
 * 0063 verification (a)–(d), with the paid-probe control.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/cohort-capacity-0063.ts > /tmp/0063.txt 2>&1
 *
 * ============================================================================
 * ⚠ (a) ON ITS OWN PROVES ALMOST NOTHING
 * ============================================================================
 * Every public cohort returns 0 today, and a function that always returned 0
 * would pass that check identically. (b) is what makes it mean something: a
 * PAID probe must make the number move, and an UNPAID one must not — and it is
 * the second half that proves the paid filter is doing the work rather than the
 * is_public filter, since both probes sit on the same public cohort.
 *
 * ⚠ THE PROBE ROWS CARRY AN EMAIL, SO CLEANUP IS NOT OPTIONAL. A stranded
 * cohort_enrolments row would be found by erase_user's generic email sweep
 * forever after. Deleted by the id captured at insert, from a `finally`, and
 * the table is re-counted at the end.
 *
 * ⚠ NEVER pipe this through `head` — a closed pipe killed a sibling script
 * before its cleanup once already.
 */
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (!existsSync(".env.local")) { console.error("REFUSED — .env.local not found."); process.exit(2); }
const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const l = line.trim();
  if (!l || l.startsWith("#")) continue;
  const i = l.indexOf("=");
  if (i < 0) continue;
  let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env.set(l.slice(0, i).trim(), v);
}
const URL_ = env.get("NEXT_PUBLIC_SUPABASE_URL");
const ANON = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE = env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!URL_ || !ANON || !SERVICE) { console.error("REFUSED — missing env."); process.exit(2); }

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc: SupabaseClient = createClient(URL_, SERVICE, opts);
const anon: SupabaseClient = createClient(URL_, ANON, opts);

let pass = 0, fail = 0;
const t = (n: string, c: boolean, observed: unknown) => {
  const s = typeof observed === "string" ? observed : JSON.stringify(observed);
  if (c) { pass++; console.log(`  OK  ${n}\n        ${s}`); }
  else { fail++; console.log(`  XX  ${n}\n        ${s}`); }
};
const err = (e: { code?: string; message?: string } | null) =>
  e ? `${e.code ?? "?"}: ${(e.message ?? "").slice(0, 150)}` : "no error";

const run = Date.now();
const PUBLIC_SLUG = "ial-chemistry-as-sep-2026";
const created: string[] = [];

const seats = async (slug: string, db: SupabaseClient = svc) => db.rpc("cohort_seats_taken", { cohort_slug: slug });

try {
  console.log(`\n=== 0063 verification — run ${run} ===`);

  const { data: cohort, error: cErr } = await svc
    .from("cohorts").select("id,slug,seat_cap,is_public").eq("slug", PUBLIC_SLUG).single();
  t("PRE-FLIGHT — the public AS cohort exists", !cErr && cohort?.is_public === true,
    cErr ? err(cErr) : `${cohort?.slug} cap=${cohort?.seat_cap} public=${cohort?.is_public}`);
  if (cErr || !cohort) throw new Error("cannot continue without the cohort");

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (a) every public cohort reports 0 ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { data: publics } = await svc.from("cohorts").select("slug").eq("is_public", true);
  for (const c of (publics ?? []) as { slug: string }[]) {
    const { data, error } = await seats(c.slug);
    t(`(a) ${c.slug} → ${data}`, !error && data === 0, error ? err(error) : String(data));
  }
  console.log("        ⚠ A 0 HERE IS CONSISTENT WITH A FUNCTION THAT ALWAYS RETURNS 0. See (b).");

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (b) ⚠ THE CONTROL — a PAID probe must move the number ---");
  // ══════════════════════════════════════════════════════════════════════════
  const paidEmail = `probe-0063-${run}-paid@example.test`;
  const { data: paid, error: paidErr } = await svc.from("cohort_enrolments").insert({
    cohort_id: cohort.id, email: paidEmail, status: "active",
    amount_pence: 16900, stripe_ref: `probe_0063_${run}`, source_tag: "probe",
  }).select("id").single();
  if (paidErr) { t("(b) seed a PAID probe", false, err(paidErr)); throw new Error("seed failed"); }
  created.push(paid.id as string);

  const { data: afterPaid } = await seats(PUBLIC_SLUG);
  t("⚠ (b1) a PAID, active seat on a PUBLIC cohort COUNTS", afterPaid === 1, String(afterPaid));

  const unpaidEmail = `probe-0063-${run}-unpaid@example.test`;
  const { data: unpaid, error: unpaidErr } = await svc.from("cohort_enrolments").insert({
    cohort_id: cohort.id, email: unpaidEmail, status: "active",
    amount_pence: null, stripe_ref: null, source_tag: "probe",
  }).select("id").single();
  if (unpaidErr) { t("(b) seed an UNPAID probe", false, err(unpaidErr)); throw new Error("seed failed"); }
  created.push(unpaid.id as string);

  const { data: afterUnpaid } = await seats(PUBLIC_SLUG);
  t("⚠ (b2) an UNPAID seat on the SAME public cohort does NOT count — still 1, not 2",
    afterUnpaid === 1, String(afterUnpaid));
  console.log("        ⚠ BOTH PROBES SIT ON THE SAME PUBLIC COHORT, so (b2) isolates the PAID");
  console.log("        filter from the is_public filter. That is the whole point of the pair.");

  /**
   * A third probe: PAID but no longer active.
   *
   * ⚠ status MUST BE ONE OF ('paid','active','refunded','completed') — 0009's
   * CHECK. The first version of this block used 'cancelled', which violates it,
   * and the insert error was DESTRUCTURED AWAY. The row never existed, the seat
   * count stayed at 1 for that reason rather than because the filter worked,
   * and the assertion passed vacuously. 'refunded' is the real "paid once, not
   * a seat now" status, and the error is checked this time.
   */
  const { data: refunded, error: refundedErr } = await svc.from("cohort_enrolments").insert({
    cohort_id: cohort.id, email: `probe-0063-${run}-refunded@example.test`, status: "refunded",
    amount_pence: 16900, stripe_ref: `probe_0063_${run}_r`, source_tag: "probe",
  }).select("id").single();
  t("(b3) PRE-CHECK — the refunded probe actually inserted, so the next line is not vacuous",
    !refundedErr && Boolean(refunded?.id), refundedErr ? err(refundedErr) : `id ${String(refunded?.id).slice(0, 8)}`);
  if (refundedErr) throw new Error("refunded probe failed to insert");
  created.push(refunded!.id as string);

  const { data: afterRefunded } = await seats(PUBLIC_SLUG);
  t("⚠ (b3) a PAID but REFUNDED seat does not count — still 1, not 2",
    afterRefunded === 1, String(afterRefunded));

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (c) ⚠ anon STILL CANNOT READ THE TABLE ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { data: anonRows, error: anonErr } = await anon.from("cohort_enrolments").select("email").limit(1);
  t("⚠ (c) anon reading cohort_enrolments is REFUSED — a 0 would be a failure",
    Boolean(anonErr), anonErr ? err(anonErr) : `NOT REFUSED — returned ${JSON.stringify(anonRows)}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (d) …but anon CAN call the function ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { data: anonSeats, error: anonSeatsErr } = await seats(PUBLIC_SLUG, anon);
  t("⚠ (d) anon CAN execute cohort_seats_taken and gets the same figure",
    !anonSeatsErr && anonSeats === 1, anonSeatsErr ? err(anonSeatsErr) : String(anonSeats));
  console.log("        ⚠ (c) AND (d) TOGETHER ARE THE POINT OF THE MIGRATION: the number is");
  console.log("        public, the rows are not. Either alone would be half the claim.");

  const { data: unknownSlug } = await seats("no-such-cohort-anywhere", anon);
  t("(d2) an unknown slug returns 0, not an error — a caller cannot probe for existence",
    unknownSlug === 0, String(unknownSlug));
} finally {
  console.log("\n--- CLEANUP — by captured id only ---");
  if (created.length) {
    const { data: gone, error } = await svc.from("cohort_enrolments").delete().in("id", created).select("id");
    console.log(error ? `  ⚠⚠ CLEANUP FAILED: ${err(error)}` : `  probe enrolments removed: ${gone?.length ?? 0} of ${created.length}`);
    if (error) console.log(`  ⚠⚠ LEFTOVER IDS: ${created.join(", ")}`);
  }
  const { data: rest } = await svc.from("cohort_enrolments").select("id,email,amount_pence,stripe_ref");
  console.log(`  cohort_enrolments now: ${rest?.length ?? "?"} row(s)`);
  for (const r of (rest ?? []) as Record<string, unknown>[]) {
    console.log(`     ${String(r.email)}  amount=${r.amount_pence ?? "null"} ref=${r.stripe_ref ?? "null"}`);
  }
  const { data: finalSeats } = await seats(PUBLIC_SLUG);
  console.log(`  cohort_seats_taken('${PUBLIC_SLUG}') back to: ${finalSeats}`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
