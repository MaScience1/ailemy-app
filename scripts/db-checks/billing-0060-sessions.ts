/**
 * 0060 (c)–(f) — the §109 blocks — and STAGE 3b, the break-first erasure probe.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/billing-0060-sessions.ts > /tmp/0060-set.txt 2>&1
 *
 * ============================================================================
 * ⚠ THIS SCRIPT DELIBERATELY LEAVES TWO THINGS BEHIND. READ THIS FIRST.
 * ============================================================================
 * Stage 3b's probe identity and its billing_profiles row are NOT cleaned up.
 * They are the fixture 0061's verification needs, and re-minting them after
 * 0061 lands would prove nothing — the whole point is that the SAME row that
 * refused before the fix succeeds after it.
 *
 * Both ids are printed at the end under "DELIBERATE LEFTOVERS". Everything
 * else is removed by captured id in a `finally`.
 *
 * ⚠ A LEFTOVER BILLING PROFILE CANNOT BREAK A REAL PERSON'S ERASURE. The sweep
 * matches `lower(billing_email) = lower(target_email)` — the TARGET's address,
 * not any address. A probe row carrying a probe's @example.test address can
 * never match a real person. It is still removed at Stage 4; this is why the
 * window is survivable if something goes wrong in between.
 *
 * ============================================================================
 * ⚠ (d) AND (e) ARE ONE ASSERTION IN TWO HALVES (§109)
 * ============================================================================
 * (d) a STUDENT sees NOTHING of the billing profile that pays for them.
 * (e) the PAYER sees all of it.
 * Either alone is consistent with the policies being wrong in one direction —
 * (d) passes trivially if nobody can see anything, and (e) passes trivially if
 * everybody can.
 *
 * ⚠ @example.test only, unique per run, minted through the admin API.
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
const ANON = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE = env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!URL_ || !ANON || !SERVICE) { console.error("REFUSED — missing env."); process.exit(2); }

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc: SupabaseClient = createClient(URL_, SERVICE, opts);

let pass = 0, fail = 0;
const t = (n: string, c: boolean, observed: unknown) => {
  const s = typeof observed === "string" ? observed : JSON.stringify(observed);
  if (c) { pass++; console.log(`  OK  ${n}\n        ${s}`); }
  else { fail++; console.log(`  XX  ${n}\n        ${s}`); }
};
const err = (e: { code?: string; message?: string } | null) =>
  e ? `${e.code ?? "?"}: ${(e.message ?? "").slice(0, 200)}` : "no error";

const run = Date.now();
const PW = `probe-${run}-Aa1!`;
const cleanupIds: string[] = [];
let leftoverUser: string | null = null;
let leftoverProfile: string | null = null;
let leftoverEmail: string | null = null;

const mint = async (who: string) => {
  const email = `probe-0060-${run}-${who}@example.test`;
  const { data, error } = await svc.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error || !data?.user?.id) throw new Error(`mint ${who}: ${error?.message}`);
  return { id: data.user.id as string, email };
};
const session = async (email: string) => {
  const c = createClient(URL_, ANON, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error || !data?.session) throw new Error(`sign in ${email}: ${error?.message}`);
  return c;
};

try {
  console.log(`\n=== 0060 (c)-(f) + STAGE 3b — run ${run} ===`);

  for (const tbl of ["billing_profiles", "billing_profile_students", "payments"]) {
    const { error } = await svc.from(tbl).select("*").limit(1);
    t(`PRE-FLIGHT — public.${tbl} exists`, !error, error ? err(error) : "reachable");
    if (error) throw new Error(`${tbl} not reachable`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- FIXTURE — a payer P, a student S they pay for, and an unrelated student B ---");
  // ══════════════════════════════════════════════════════════════════════════
  const P = await mint("payer");   cleanupIds.push(P.id);
  const S = await mint("student"); cleanupIds.push(S.id);
  const B = await mint("other");   cleanupIds.push(B.id);
  const sP = await session(P.email), sS = await session(S.email), sB = await session(B.email);
  t("P, S and B minted and signed in with the ANON key", true,
    `P=${P.id.slice(0, 8)} S=${S.id.slice(0, 8)} B=${B.id.slice(0, 8)}`);

  const { data: prof, error: profErr } = await svc.from("billing_profiles").insert({
    owner_user_id: P.id, billing_name: "Probe Parent", billing_email: P.email,
    billing_country: "QA", stripe_customer_id: `cus_probe_${run}`,
  }).select("id").single();
  if (profErr) throw new Error(`seed profile: ${err(profErr)}`);
  const profileId = prof.id as string;

  await svc.from("billing_profile_students").insert({ billing_profile_id: profileId, student_id: S.id });
  const { data: payS } = await svc.from("payments").insert({
    billing_profile_id: profileId, student_id: S.id, kind: "cohort_subscription",
    description: "probe-0060 S tuition", amount_minor: 16900, currency: "GBP",
    status: "paid", paid_at: new Date().toISOString(),
    receipt_url: "https://pay.stripe.com/receipts/PROBE-PAYER-EMAIL-AND-LAST4",
  }).select("id").single();
  const { data: payB } = await svc.from("payments").insert({
    student_id: B.id, kind: "private_lesson", description: "probe-0060 B lesson",
    amount_minor: 4500, currency: "GBP", status: "paid", paid_at: new Date().toISOString(),
  }).select("id").single();

  const { count: profCount } = await svc.from("billing_profiles")
    .select("id", { count: "exact", head: false }).eq("id", profileId);
  const { count: linkCount } = await svc.from("billing_profile_students")
    .select("student_id", { count: "exact", head: false }).eq("billing_profile_id", profileId);
  const { count: payCount } = await svc.from("payments")
    .select("id", { count: "exact", head: false }).in("student_id", [S.id, B.id]);
  t("⚠ FIXTURE CONFIRMED NON-EMPTY as service_role — profile, link and two payments all exist",
    profCount === 1 && linkCount === 1 && payCount === 2,
    `profile ${profCount} · link ${linkCount} · payments ${payCount}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (c) a student sees their own payments and not B's ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { data: sSees, error: sSeesErr } = await sS.from("payments").select("id,student_id,description");
  t("(c1) S's SELECT succeeds", !sSeesErr, sSeesErr ? err(sSeesErr) : `${sSees!.length} row(s)`);
  t("(c2) S sees exactly their own payment",
    sSees?.length === 1 && sSees[0].student_id === S.id, JSON.stringify(sSees?.map((r) => r.description)));
  t("⚠ (c3) B's payment is ABSENT from S's result though it exists (fixture count 2 above)",
    !sSees?.some((r) => r.id === payB?.id), `B's payment ${String(payB?.id).slice(0, 8)} not visible to S`);
  const { data: bSees } = await sB.from("payments").select("id");
  t("(c4) MIRROR — B sees exactly their own and not S's",
    bSees?.length === 1 && bSees[0].id === payB?.id, JSON.stringify(bSees?.map((r) => String(r.id).slice(0, 8))));

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (d) ⚠ A STUDENT CANNOT SEE WHO PAID FOR THEM (§109) ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { data: sProfiles, error: sProfErr } = await sS.from("billing_profiles").select("id,billing_email");
  t("(d1) S sees 0 billing_profiles — and this 0 is MEANINGFUL because the fixture above confirmed one exists AND is linked to S",
    !sProfErr && sProfiles?.length === 0, sProfErr ? err(sProfErr) : `${sProfiles?.length} row(s)`);
  const { data: sLinks, error: sLinkErr } = await sS.from("billing_profile_students").select("student_id");
  t("(d2) S sees 0 billing_profile_students — not even the row naming S",
    !sLinkErr && sLinks?.length === 0, sLinkErr ? err(sLinkErr) : `${sLinks?.length} row(s)`);
  t("⚠ (d3) …and no payer address or card metadata leaked through the payment S CAN see",
    !sSees?.some((r) => JSON.stringify(r).includes("@") || JSON.stringify(r).toLowerCase().includes("receipt")),
    JSON.stringify(sSees));

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (e) …while the PAYER sees both ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { data: pProfiles, error: pProfErr } = await sP.from("billing_profiles").select("id,billing_email,stripe_customer_id");
  t("(e1) P sees their own billing profile — the other half of (d)",
    !pProfErr && pProfiles?.length === 1 && pProfiles[0].id === profileId,
    pProfErr ? err(pProfErr) : JSON.stringify(pProfiles?.map((r) => r.billing_email)));
  const { data: pLinks } = await sP.from("billing_profile_students").select("student_id");
  t("(e2) P sees who they pay for", pLinks?.length === 1 && pLinks[0].student_id === S.id,
    JSON.stringify(pLinks?.map((r) => String(r.student_id).slice(0, 8))));
  const { data: pPays } = await sP.from("payments").select("id,description");
  t("(e3) P sees the payment they MADE — S's tuition — through payments_read_as_payer",
    pPays?.length === 1 && pPays[0].id === payS?.id, JSON.stringify(pPays?.map((r) => r.description)));
  t("⚠ (e4) …and NOT B's payment, which no profile of P's paid for",
    !pPays?.some((r) => r.id === payB?.id), `B's payment absent from P's view`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (f) nobody but staff and service_role can write ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { data: fCtrl, error: fCtrlErr } = await sS.from("payments").select("id").limit(1);
  t("⚠ CONTROL — S CAN read payments, so the refusals below are the write grant and not a dead session",
    !fCtrlErr && Array.isArray(fCtrl), fCtrlErr ? err(fCtrlErr) : `${fCtrl!.length} row(s)`);

  const { error: fIns } = await sS.from("payments").insert({
    student_id: S.id, kind: "other", description: "I paid, honest", amount_minor: 1, currency: "GBP", status: "paid",
    paid_at: new Date().toISOString(),
  });
  t("(f1) S cannot INSERT a payment — cannot mark their own tuition paid",
    Boolean(fIns) && fIns!.code === "42501", err(fIns));

  const { data: fUpdRows, error: fUpd } = await sP.from("payments")
    .update({ refunded_minor: 16900 }).eq("billing_profile_id", profileId).select("id");
  t("(f2) P cannot UPDATE a payment — a payer cannot refund themselves",
    Boolean(fUpd) && fUpd!.code === "42501", `${err(fUpd)}${fUpdRows ? ` rows=${fUpdRows.length}` : ""}`);

  const { error: fDel } = await sP.from("billing_profiles").delete().eq("id", profileId);
  t("(f3) …nor DELETE their billing profile out from under a payment",
    Boolean(fDel) && fDel!.code === "42501", err(fDel));

  const { data: intact } = await svc.from("payments").select("refunded_minor").eq("id", payS!.id).single();
  t("⚠ the payment is UNCHANGED after all three attempts — refused, not partially applied",
    intact?.refunded_minor === 0, `refunded_minor = ${intact?.refunded_minor}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n=== STAGE 3b — WATCH ERASURE BREAK (0060 applied, 0061 NOT) ===");
  // ══════════════════════════════════════════════════════════════════════════
  const X = await mint("stage3b");
  leftoverUser = X.id; leftoverEmail = X.email;
  t("Stage 3b probe minted", true, `${X.email}  ${X.id}`);

  const { data: xProf, error: xProfErr } = await svc.from("billing_profiles").insert({
    owner_user_id: X.id, billing_name: "Probe Break First", billing_email: X.email,
  }).select("id").single();
  if (xProfErr) throw new Error(`seed 3b profile: ${err(xProfErr)}`);
  leftoverProfile = xProf.id as string;

  const { count: xCount } = await svc.from("billing_profiles")
    .select("id", { count: "exact", head: false }).eq("id", leftoverProfile);
  t("⚠ FIXTURE PRE-CHECK — the probe's billing_profiles row EXISTS. A zero-row table cannot fail this check, and that exact false pass has cost a probe here before",
    xCount === 1, `${xCount} row(s), billing_email = ${X.email}`);

  const { data: eraseData, error: eraseErr } = await svc.rpc("erase_user", { target: X.id });
  const refusedCorrectly = Boolean(eraseErr) && eraseErr!.code === "23001"
    && (eraseErr!.message ?? "").includes("billing_profiles.billing_email");
  t("⚠⚠ STAGE 3b — erase_user REFUSES, naming billing_profiles.billing_email",
    refusedCorrectly,
    eraseErr ? `${eraseErr.code}: ${eraseErr.message}` : `NO REFUSAL — RECEIPT RETURNED: ${JSON.stringify(eraseData)}`);
  if (!eraseErr) {
    console.log("\n  ⚠⚠⚠ STOP CONDITION HIT — erase_user SUCCEEDED where it must refuse.\n" +
                "  Either the fixture was empty (it was not — see the pre-check above) or the\n" +
                "  sweep is not seeing billing_profiles.billing_email. Do NOT apply 0061 until\n" +
                "  this is understood.\n");
  }
  t("…and the message says NOTHING WAS ERASED",
    (eraseErr?.message ?? "").includes("NOTHING WAS ERASED"), (eraseErr?.message ?? "").slice(0, 220));

  const { data: xStill } = await svc.auth.admin.getUserById(X.id);
  t("⚠ the probe STILL EXISTS — refused atomically, not half-erased",
    Boolean(xStill?.user?.id), xStill?.user?.id ? "present" : "GONE — the rollback did not hold");

  const { count: xProfStill } = await svc.from("billing_profiles")
    .select("id", { count: "exact", head: false }).eq("id", leftoverProfile);
  t("…and so does its billing profile — the whole transaction rolled back",
    xProfStill === 1, `${xProfStill} row(s)`);
} finally {
  console.log("\n--- CLEANUP — by captured id only ---");
  const { data: paysGone } = await svc.from("payments").delete().like("description", "probe-0060%").select("id");
  console.log(`  payment rows removed: ${paysGone?.length ?? 0}`);
  if (cleanupIds.length) {
    const { data: linksGone } = await svc.from("billing_profile_students")
      .delete().in("student_id", cleanupIds).select("student_id");
    console.log(`  link rows removed: ${linksGone?.length ?? 0}`);
    const { data: profsGone } = await svc.from("billing_profiles")
      .delete().in("owner_user_id", cleanupIds).select("id");
    console.log(`  billing profiles removed: ${profsGone?.length ?? 0}`);
  }
  const leftovers: string[] = [];
  for (const id of cleanupIds) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) leftovers.push(`${id} (${error.message})`);
  }
  if (leftovers.length) console.log(`\n  ⚠⚠ UNEXPECTED LEFTOVERS:\n     ${leftovers.join("\n     ")}\n`);
  else console.log(`  identities removed: ${cleanupIds.length}`);

  console.log("\n  ══ DELIBERATE LEFTOVERS — the fixture 0061 needs, DO NOT remove yet ══");
  console.log(`     user     ${leftoverUser}`);
  console.log(`     email    ${leftoverEmail}`);
  console.log(`     profile  ${leftoverProfile}`);
  console.log("     ⚠ Harmless to any real erasure: the sweep matches the TARGET's address,");
  console.log("       and this row carries an @example.test one. Removed at Stage 4.");

  const { data: rest } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const still = (rest?.users ?? []).filter((u) => (u.email ?? "").endsWith("@example.test"));
  console.log(`\n  @example.test identities remaining: ${still.length} (expect 1 — the Stage 3b probe)`);
  still.forEach((u) => console.log(`     ${u.id} ${u.email}`));
  const { count: pc } = await svc.from("payments").select("id", { count: "exact", head: false });
  const { count: bc } = await svc.from("billing_profiles").select("id", { count: "exact", head: false });
  const { count: lc } = await svc.from("billing_profile_students").select("student_id", { count: "exact", head: false });
  console.log(`  payments ${pc} · billing_profiles ${bc} (expect 1) · billing_profile_students ${lc}`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
