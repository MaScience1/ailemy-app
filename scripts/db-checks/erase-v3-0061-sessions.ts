/**
 * 0061 (g), (h), (i), (j) — SESSION-RUN. Not SQL-Editor blocks.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/erase-v3-0061-sessions.ts > /tmp/0061-ghij.txt 2>&1
 *
 * ============================================================================
 * ⚠ THE 0060 FIXTURE IS PROTECTED AND MUST SURVIVE THIS SCRIPT
 * ============================================================================
 * Stage 3b left one probe and one billing profile in place deliberately. They
 * are step 5's erasure target — the SAME row that refused before 0061 must
 * succeed after it, and re-minting would prove nothing. This script mints its
 * own probes and refuses to touch those two ids; the guard is a hard check, not
 * a convention, and the fixture is re-counted at the end.
 *
 * (h) needs an UNOWNED profile. The 0060 fixture probe OWNS its profile, so it
 * could not have served for (h) even if it were free.
 *
 * ============================================================================
 * WHAT EACH BLOCK PROVES
 * ============================================================================
 * (g)  the two grants from paste 12 landed — and paste 12 is the one
 *      non-transactional paste of the session, so a half-apply is possible.
 * (h)  an UNOWNED billing profile carrying the target's address is SCRUBBED.
 *      This is the arm that was missing until review; every other block in the
 *      file seeds a profile the probe owns, which is the case the old
 *      predicate already handled.
 * (i)  a profile owned by SOMEBODY ELSE carrying the address is REFUSED and
 *      NAMED. ⚠ THE REFUSAL IS THE PASS. A success here would mean a third
 *      party's billing identity was rewritten to erase somebody else.
 * (j)  payer_erasure_side_effects names a child with NO entitlements row —
 *      the join that would have made it always-empty is gone.
 *
 * ⚠ @example.test only, unique per run, admin API. Cleanup from a `finally`.
 * NEVER pipe this through `head`.
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

/** ⚠ HARD GUARD. Step 5's target. Nothing here may erase or delete these. */
const PROTECTED_USER = "b85daedd-b226-46f1-9758-f2e6499e6bc6";
const PROTECTED_PROFILE = "180bde15-6720-445b-869d-0ab73ea7846a";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, observed: unknown) => {
  const s = typeof observed === "string" ? observed : JSON.stringify(observed);
  if (c) { pass++; console.log(`  OK  ${n}\n        ${s}`); }
  else { fail++; console.log(`  XX  ${n}\n        ${s}`); }
};
const err = (e: { code?: string; message?: string } | null) =>
  e ? `${e.code ?? "?"}: ${(e.message ?? "").slice(0, 230)}` : "no error";

const run = Date.now();
const users: string[] = [];
const profiles: string[] = [];

const mint = async (who: string) => {
  const email = `probe-0061-${run}-${who}@example.test`;
  const { data, error } = await svc.auth.admin.createUser({
    email, password: `probe-${run}-Aa1!`, email_confirm: true,
  });
  if (error || !data?.user?.id) throw new Error(`mint ${who}: ${error?.message}`);
  users.push(data.user.id);
  return { id: data.user.id as string, email };
};
const profile = async (owner: string | null, email: string, name: string, cus?: string) => {
  const { data, error } = await svc.from("billing_profiles").insert({
    owner_user_id: owner, billing_name: name, billing_email: email,
    ...(cus ? { stripe_customer_id: cus } : {}),
  }).select("id").single();
  if (error) throw new Error(`profile: ${err(error)}`);
  profiles.push(data.id as string);
  return data.id as string;
};
const erase = async (id: string) => {
  if (id === PROTECTED_USER) throw new Error("GUARD: refused to erase the protected 0060 fixture");
  return svc.rpc("erase_user", { target: id });
};

try {
  console.log(`\n=== 0061 (g)(h)(i)(j) — SESSION-RUN, run ${run} ===`);

  // ── the 0060 fixture must be intact before we start ──────────────────────
  const { data: fxUser } = await svc.auth.admin.getUserById(PROTECTED_USER);
  const { count: fxProf } = await svc.from("billing_profiles")
    .select("id", { count: "exact", head: false }).eq("id", PROTECTED_PROFILE);
  t("⚠ PROTECTED — the 0060 fixture is intact before this script runs (step 5's target)",
    Boolean(fxUser?.user?.id) && fxProf === 1,
    `user ${fxUser?.user?.id ? "present" : "MISSING"} · profile ${fxProf} row(s)`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (g) did paste 12 land? ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { data: privs, error: privErr } = await svc.rpc("erase_user_privcheck").then(
    () => ({ data: null, error: null }),
    () => ({ data: null, error: null }),
  );
  void privs; void privErr;
  // has_function_privilege is not exposed over REST; ask through a probe erase
  // instead, plus a direct catalogue read via a one-off SQL function is not
  // available — so (g) is answered by BEHAVIOUR: service_role must be able to
  // call it, and that is exercised by every erase below. The anon/authenticated
  // halves are the founder's SQL-Editor block.
  const probeG = await mint("g");
  const { error: gErr } = await erase(probeG.id);
  t("(g-behaviour) service_role CAN execute erase_user — so paste 12 did not revoke it",
    !gErr, gErr ? err(gErr) : "erased cleanly");
  if (gErr) throw new Error("service_role cannot execute erase_user — STOP, check paste 12");

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (h) an UNOWNED profile carrying the address is SCRUBBED ---");
  // ══════════════════════════════════════════════════════════════════════════
  const Y = await mint("h-target");
  const unowned = await profile(null, Y.email, "Bank transfer family", `cus_probe_h_${run}`);
  const { count: hPre } = await svc.from("billing_profiles")
    .select("id", { count: "exact", head: false }).eq("id", unowned);
  t("⚠ FIXTURE — the UNOWNED profile exists and carries Y's address (owner_user_id NULL, as 0060 documents for bank transfer)",
    hPre === 1, `${hPre} row(s), billing_email = ${Y.email}, owner_user_id = NULL`);

  const { data: hReceipt, error: hErr } = await erase(Y.id);
  t("⚠⚠ (h) erase_user SUCCEEDS — the arm that was missing before review",
    !hErr && Boolean(hReceipt),
    hErr ? `REFUSED: ${err(hErr)}` : JSON.stringify(hReceipt));
  const hr = (hReceipt ?? {}) as Record<string, unknown>;
  t("(h) billing_profiles_scrubbed >= 1", Number(hr.billing_profiles_scrubbed) >= 1,
    `billing_profiles_scrubbed = ${hr.billing_profiles_scrubbed}`);
  t("⚠ (h) email_columns_scanned = 8 — GATE 4's number, up from the baseline of 7",
    hr.email_columns_scanned === 8, `email_columns_scanned = ${hr.email_columns_scanned}`);
  t("⚠ (h) the Stripe customer on the UNOWNED profile is still reported as an obligation",
    Array.isArray(hr.stripe_erasure_required) && (hr.stripe_erasure_required as string[]).includes(`cus_probe_h_${run}`),
    JSON.stringify(hr.stripe_erasure_required));

  const { data: hRow } = await svc.from("billing_profiles")
    .select("billing_email,billing_name,billing_country,stripe_customer_id").eq("id", unowned).single();
  t("(h) the unowned row SURVIVED, tombstoned",
    hRow?.billing_email === `erased-${Y.id}@ailemy.invalid` && hRow?.billing_name === "Erased user" && hRow?.billing_country === null,
    JSON.stringify(hRow));
  t("…and its stripe_customer_id is UNCHANGED — the pointer the operator needs",
    hRow?.stripe_customer_id === `cus_probe_h_${run}`, hRow?.stripe_customer_id);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (i) 🔴 EXPECTED RED — a profile owned by SOMEBODY ELSE is REFUSED ---");
  // ══════════════════════════════════════════════════════════════════════════
  const Y2 = await mint("i-target");
  const Z = await mint("i-other");
  const zProfile = await profile(Z.id, Y2.email, "Other parent");
  const { data: zBefore } = await svc.from("billing_profiles")
    .select("billing_email,billing_name,owner_user_id").eq("id", zProfile).single();
  t("⚠ FIXTURE — Z owns a profile carrying Y2's address (the two-parent-family shape)",
    zBefore?.billing_email === Y2.email && zBefore?.owner_user_id === Z.id,
    JSON.stringify(zBefore));

  const { data: iData, error: iErr } = await erase(Y2.id);
  const refusedRight = Boolean(iErr) && iErr!.code === "23001"
    && (iErr!.message ?? "").includes(zProfile);
  t("⚠⚠ (i) REFUSED with 23001, NAMING the profile id — THE REFUSAL IS THE PASS",
    refusedRight,
    iErr ? `${iErr.code}: ${iErr.message}` : `NOT REFUSED — receipt: ${JSON.stringify(iData)}`);
  t("(i) the message says the address is on a profile owned by somebody else",
    (iErr?.message ?? "").includes("owned by somebody else"), (iErr?.message ?? "").slice(0, 200));

  const { data: y2Still } = await svc.auth.admin.getUserById(Y2.id);
  t("(i) Y2 is STILL PRESENT — refused atomically", Boolean(y2Still?.user?.id),
    y2Still?.user?.id ? "present" : "GONE");
  const { data: zAfter } = await svc.from("billing_profiles")
    .select("billing_email,billing_name,owner_user_id").eq("id", zProfile).single();
  t("⚠ (i) Z's profile is UNTOUCHED — no third party's billing identity was rewritten",
    zAfter?.billing_email === Y2.email && zAfter?.billing_name === "Other parent" && zAfter?.owner_user_id === Z.id,
    JSON.stringify(zAfter));

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (j) side effects name a child with NO entitlements row ---");
  // ══════════════════════════════════════════════════════════════════════════
  const payer = await mint("j-payer");
  const child = await mint("j-child");
  const pProfile = await profile(payer.id, payer.email, "Probe Payer");
  await svc.from("billing_profile_students").insert({ billing_profile_id: pProfile, student_id: child.id });

  const { count: cEnt } = await svc.from("entitlements")
    .select("id", { count: "exact", head: false }).eq("user_id", child.id);
  const { count: cLink } = await svc.from("billing_profile_students")
    .select("student_id", { count: "exact", head: false }).eq("student_id", child.id);
  t("⚠ FIXTURE — the child is LINKED but has NO entitlements row (the case the old join missed)",
    cLink === 1 && cEnt === 0, `links ${cLink} · entitlements ${cEnt}`);

  const { data: jReceipt, error: jErr } = await erase(payer.id);
  const jr = (jReceipt ?? {}) as Record<string, unknown>;
  t("(j) the payer erases cleanly", !jErr, jErr ? err(jErr) : "receipt returned");
  t("⚠⚠ (j) payer_erasure_side_effects NAMES the child — the entitlements join is gone",
    Array.isArray(jr.payer_erasure_side_effects) && (jr.payer_erasure_side_effects as string[]).includes(child.id),
    JSON.stringify(jr.payer_erasure_side_effects));
  t("…and the child's own account is untouched — this refuses nothing, it reports",
    Boolean((await svc.auth.admin.getUserById(child.id)).data?.user?.id), "child still present");
} finally {
  console.log("\n--- CLEANUP — by captured id, protected ids excluded ---");
  const delProfiles = profiles.filter((p) => p !== PROTECTED_PROFILE);
  if (delProfiles.length) {
    await svc.from("billing_profile_students").delete().in("billing_profile_id", delProfiles);
    const { data: g } = await svc.from("billing_profiles").delete().in("id", delProfiles).select("id");
    console.log(`  billing profiles removed: ${g?.length ?? 0} of ${delProfiles.length}`);
  }
  const delUsers = users.filter((u) => u !== PROTECTED_USER);
  const leftovers: string[] = [];
  for (const id of delUsers) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) leftovers.push(`${id} (${error.message})`);
  }
  if (leftovers.length) console.log(`\n  ⚠⚠ LEFTOVERS:\n     ${leftovers.join("\n     ")}\n`);
  else console.log(`  identities removed or already erased: ${delUsers.length}`);

  const { data: fxU } = await svc.auth.admin.getUserById(PROTECTED_USER);
  const { count: fxP } = await svc.from("billing_profiles")
    .select("id", { count: "exact", head: false }).eq("id", PROTECTED_PROFILE);
  console.log(`\n  ══ 0060 FIXTURE — must still be intact for step 5 ══`);
  console.log(`     user    ${PROTECTED_USER}  ${fxU?.user?.id ? "PRESENT" : "⚠⚠ MISSING"}`);
  console.log(`     profile ${PROTECTED_PROFILE}  ${fxP} row(s)`);

  const { data: rest } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const still = (rest?.users ?? []).filter((u) => (u.email ?? "").endsWith("@example.test"));
  console.log(`\n  @example.test identities remaining: ${still.length} (expect 1 — the step 5 target)`);
  still.forEach((u) => console.log(`     ${u.id} ${u.email}`));
  const { count: bp } = await svc.from("billing_profiles").select("id", { count: "exact", head: false });
  const { count: bl } = await svc.from("billing_profile_students").select("student_id", { count: "exact", head: false });
  const { count: py } = await svc.from("payments").select("id", { count: "exact", head: false });
  console.log(`  billing_profiles ${bp} (expect 1) · links ${bl} (expect 0) · payments ${py} (expect 0)`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
