/**
 * Stage 0.2 — capture the v2 erasure baseline BEFORE 0060 is applied.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/erasure-baseline.ts > /tmp/baseline.txt 2>&1
 *
 * ============================================================================
 * ⚠ IT MEASURES ONE NUMBER: HOW MANY email COLUMNS erase_user's SWEEP SCANS
 * ============================================================================
 * 0055's sweep enumerates every text column in `public` named email or %_email
 * and counts the target address against each, refusing to report success while
 * the address is anywhere. `email_columns_scanned` in the receipt is how many
 * it looked at.
 *
 * 0060 adds billing_profiles.billing_email, so after it lands the number must
 * be exactly one higher. 0061's verification (f) asserts that. Taken AFTER
 * 0060, there is nothing to compare against and the assertion silently becomes
 * unfalsifiable — which is why this runs first and why it is its own file.
 *
 * ⚠ AN EMPTY FIXTURE IS CORRECT HERE, AND THIS IS THE ONE CHECK WHERE IT IS.
 * Everywhere else on this project a zero-row fixture is the classic false pass.
 * Not here: the number comes from a CATALOGUE scan, not from rows. A probe with
 * no data anywhere still causes every column to be scanned and counted. What
 * an empty fixture cannot tell us is whether the DELETEs work — and that is not
 * what this file claims to measure.
 *
 * ⚠ THE EXPECTED VALUE IS DERIVED FROM THE MIGRATIONS, NOT REMEMBERED. Seven
 * table.column pairs carry an address today (see EXPECTED below). If the run
 * disagrees with that list, the schema moved and the founder's stop condition
 * fires — the number is not stale, something changed.
 *
 * ============================================================================
 * ⚠ IT CREATES AND ERASES ONE REAL auth IDENTITY.
 * ============================================================================
 * @example.test only (.test is reserved by RFC 2606 and can never be a real
 * address), unique per run, created through the admin API, and the erase target
 * is the uuid captured from createUser() in this process — never an address
 * resolved by lookup, which could match a real person.
 *
 * ⚠ CLEANUP RUNS FROM A `finally` AND PRINTS THE LEFTOVER ID IF IT FAILS. A
 * sibling script was once killed by a closed pipe before its cleanup ran, and
 * the probe rows it stranded would have made a REAL PERSON permanently
 * un-erasable. NEVER pipe this through `head`. Redirect to a file.
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
const SERVICE = env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!URL_ || !SERVICE) { console.error("REFUSED — missing env."); process.exit(2); }

const svc: SupabaseClient = createClient(URL_, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let pass = 0, fail = 0;
const t = (n: string, c: boolean, observed: unknown) => {
  const s = typeof observed === "string" ? observed : JSON.stringify(observed);
  if (c) { pass++; console.log(`  OK  ${n}\n        ${s}`); }
  else { fail++; console.log(`  XX  ${n}\n        ${s}`); }
};

/**
 * The seven pairs derived from the migration DDL — every text column in public
 * named email or %_email. profiles has none: the address lives in auth.users,
 * outside the scanned schema.
 */
const EXPECTED = [
  "waitlist.email",                          // 0001:202
  "cohort_enrolments.email",                 // 0009:57
  "interest_registrations.email",            // 0040:80
  "booking_holds.email",                     // 0046:78
  "private_bookings.email",                  // 0046:110
  "cancellation_requests.requested_by_email", // 0052:86
  "notification_events.email",               // 0053:102
];

const run = Date.now();
const EMAIL = `probe-baseline-${run}@example.test`;
let probeId: string | null = null;
let erased = false;

try {
  console.log(`\n=== STAGE 0.2 — erasure baseline, run ${run} ===`);

  // ── guard: 0060 must NOT be applied yet, or the baseline is worthless ─────
  const { error: bpErr } = await svc.from("billing_profiles").select("id").limit(1);
  const notThere = bpErr && (bpErr.code === "PGRST205" || bpErr.code === "42P01");
  t("⚠ 0060 is NOT applied yet — billing_profiles absent, so this IS the pre-0060 baseline",
    Boolean(notThere), notThere ? `${bpErr!.code}: table absent (correct)` : `billing_profiles is REACHABLE — too late for a baseline`);
  if (!notThere) {
    console.log("\n  STOP — billing_profiles already exists. A baseline taken now already\n" +
                "  includes the new column, so 0061(f)'s +1 assertion cannot be made.\n");
    process.exit(1);
  }

  // ── mint one probe ────────────────────────────────────────────────────────
  const { data: made, error: mkErr } = await svc.auth.admin.createUser({
    email: EMAIL, password: `probe-${run}-Aa1!`, email_confirm: true,
  });
  if (mkErr || !made?.user?.id) {
    t("mint probe via admin API", false, mkErr?.message ?? "no id returned");
    throw new Error("cannot continue without a probe");
  }
  probeId = made.user.id;
  t("probe minted through the admin API, @example.test, unique per run",
    EMAIL.endsWith("@example.test"), `${EMAIL}  ${probeId.slice(0, 8)}`);

  // ── the probe genuinely exists before we erase it ─────────────────────────
  const { data: before } = await svc.auth.admin.getUserById(probeId);
  t("⚠ CONTROL — the probe EXISTS before the call, so a success is not vacuous",
    Boolean(before?.user?.id), before?.user?.id ? "present" : "ABSENT");

  // ── the measurement ───────────────────────────────────────────────────────
  const { data: receipt, error: eraseErr } = await svc.rpc("erase_user", { target: probeId });
  if (eraseErr) {
    t("erase_user returned a receipt", false, `${eraseErr.code}: ${eraseErr.message}`);
    throw new Error("erase_user refused — see the message above");
  }
  erased = true;
  const r = receipt as Record<string, unknown>;
  console.log(`\n  RECEIPT: ${JSON.stringify(r)}\n`);

  const N = r.email_columns_scanned;
  t("receipt carries email_columns_scanned as a number", typeof N === "number", N);
  t(`⚠ N = ${N}  — this is the BASELINE to compare against at Gate 4`,
    typeof N === "number", `expected ${EXPECTED.length} from the DDL:\n        ` + EXPECTED.join("\n        "));
  t(`⚠ N matches the ${EXPECTED.length} pairs derived from the migrations`,
    N === EXPECTED.length,
    N === EXPECTED.length ? `${N} = ${EXPECTED.length}` : `${N} ≠ ${EXPECTED.length} — THE SCHEMA MOVED. Find out what added or removed an email column before continuing.`);

  // storage_purge_required must still be shaped correctly even with no files
  const spr = r.storage_purge_required as Record<string, unknown> | undefined;
  t("storage_purge_required present and shaped, with 0 files for an empty probe",
    Boolean(spr && spr.bucket === "submissions" && spr.rows_referencing_files === 0),
    JSON.stringify(spr));

  // ── independent residue check — not erase_user's own report ───────────────
  const { data: after } = await svc.auth.admin.getUserById(probeId);
  t("probe is gone from auth.users — checked independently of the receipt",
    !after?.user?.id, after?.user?.id ? "STILL PRESENT" : "gone");
} finally {
  // ⚠ erase_user already removed the user on the happy path. This is the path
  // where it refused or the script died mid-way: delete by the id captured at
  // creation, never by an email lookup, and never a table-wide sweep.
  if (probeId && !erased) {
    const { error } = await svc.auth.admin.deleteUser(probeId);
    if (error) {
      console.log(`\n  ⚠⚠ LEFTOVER PROBE NOT REMOVED — delete it by hand:\n     id    ${probeId}\n     email ${EMAIL}\n     error ${error.message}\n`);
    } else {
      console.log(`\n  cleanup: probe ${probeId.slice(0, 8)} removed by captured id`);
    }
  }
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
