/**
 * 0059 (a2), (d)–(i) — the blocks that need REAL authenticated sessions.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/notification-prefs-0059-sessions.ts > /tmp/0059-set.txt 2>&1
 *
 * ============================================================================
 * ⚠ WHY THE SQL EDITOR CANNOT ANSWER THESE
 * ============================================================================
 * Every policy on this table is written against auth.uid(), NULL for postgres.
 * And the whole point of (d) and (e) is a COLUMN grant, which the SQL Editor
 * role bypasses entirely — running them there proves nothing about a student.
 *
 * ⚠ THE CENTRAL PAIR IS (e) AND (f), AND NEITHER MEANS ANYTHING ALONE.
 * (e) says a student cannot write their own consent date. (f) says turning
 * marketing on STILL WORKS and produces a server stamp. (e) on its own is
 * satisfied by a settings page that can no longer opt in at all — which would
 * be a worse failure than the one the amendment fixed.
 *
 * ⚠ (a2) ASSERTS WHAT THE MIGRATION CLAIMS, NOT WHAT IS CONVENIENT. §3 states
 * that PostgREST's .upsert() cannot work here because it compiles to
 * ON CONFLICT DO UPDATE SET user_id = EXCLUDED.user_id and user_id is withheld
 * from the UPDATE grant. If that upsert SUCCEEDS, the claim in the file is
 * false and the file must be corrected — so this test asserts the refusal
 * rather than accepting either outcome. A test that passes both ways tests
 * nothing.
 *
 * ⚠ @example.test only, unique per run, minted through the admin API. Cleanup
 * from a `finally`, leftovers printed in full. NEVER pipe through `head`.
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
  e ? `${e.code ?? "?"}: ${(e.message ?? "").slice(0, 150)}` : "no error";

/**
 * ⚠ POSTGRES WORDS A WRITE-SIDE COLUMN-PRIVILEGE FAILURE AS "permission denied
 * for TABLE". The per-column wording is SELECT-only. So a missing table grant
 * and a missing COLUMN grant arrive identically, and only the CONTROL in (h)
 * and (h2) — the same session succeeding on a GRANTED column — separates them.
 */
const layer = (e: { code?: string; message?: string } | null): string => {
  if (!e) return "NOT REFUSED";
  const m = (e.message ?? "").toLowerCase();
  if (e.code === "42501" && m.includes("row-level security")) return "RLS POLICY (WITH CHECK)";
  if (e.code === "42501") return "GRANT (table or column — see the controls)";
  if (e.code === "23514") return "CHECK CONSTRAINT";
  return `OTHER (${e.code})`;
};

const run = Date.now();
const PW = `probe-${run}-Aa1!`;
const FOUNDER_PROBE = "5bce3ca8-0e98-417a-bfb0-8bd91940c09f"; // the Stage 2 SQL-Editor probe
const ids: string[] = [];

try {
  console.log(`\n=== 0059 (a2), (d)-(i) — real sessions, run ${run} ===`);

  const { error: existErr } = await svc.from("notification_preferences").select("user_id").limit(1);
  t("⚠ PRE-FLIGHT — public.notification_preferences exists (pastes 4-7 landed)",
    !existErr, existErr ? err(existErr) : "reachable as service_role");
  if (existErr) throw new Error("table not reachable — stop");

  const { count: startRows } = await svc.from("notification_preferences")
    .select("user_id", { count: "exact", head: false });
  t("⚠ PRE-FLIGHT — the table starts EMPTY, so every count below is ours",
    startRows === 0, `${startRows} row(s)`);

  const sessions: Record<string, SupabaseClient> = {};
  const uid: Record<string, string> = {};
  for (const who of ["a", "b"]) {
    const email = `probe-0059s-${run}-${who}@example.test`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: PW, email_confirm: true });
    if (error || !data?.user?.id) { t(`mint ${who}`, false, error?.message ?? "no id"); throw new Error("mint failed"); }
    ids.push(data.user.id); uid[who] = data.user.id;
    const c = createClient(URL_, ANON, opts);
    const { data: s, error: sErr } = await c.auth.signInWithPassword({ email, password: PW });
    if (sErr || !s?.session) { t(`sign in ${who}`, false, sErr?.message ?? "no session"); throw new Error("sign-in failed"); }
    sessions[who] = c;
  }
  t("A and B minted and signed in with the ANON key — real authenticated sessions",
    true, `A=${uid.a.slice(0, 8)}  B=${uid.b.slice(0, 8)}`);

  const A = sessions.a, B = sessions.b;
  const asSvc = async (u: string) => (await svc.from("notification_preferences")
    .select("*").eq("user_id", u).maybeSingle()).data as Record<string, unknown> | null;

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (a2) the client write path is UPDATE-then-INSERT ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { data: u0, error: u0e } = await A.from("notification_preferences")
    .update({ announcements_email: false }).eq("user_id", uid.a).select("user_id");
  t("(a2-1) UPDATE with no row yet touches 0 rows — the 'defaults' state",
    !u0e && u0?.length === 0, u0e ? err(u0e) : `${u0?.length} row(s)`);

  const { data: i0, error: i0e } = await A.from("notification_preferences")
    .insert({ user_id: uid.a, announcements_email: false }).select("user_id");
  t("(a2-2) INSERT creates it", !i0e && i0?.length === 1, i0e ? err(i0e) : `${i0?.length} row(s)`);

  const { data: u1, error: u1e } = await A.from("notification_preferences")
    .update({ announcements_email: true }).eq("user_id", uid.a).select("user_id");
  t("(a2-3) the SAME update now finds it", !u1e && u1?.length === 1, u1e ? err(u1e) : `${u1?.length} row(s)`);

  const { error: upsertErr } = await A.from("notification_preferences")
    .upsert({ user_id: uid.a, announcements_email: false });
  t("⚠ (a2-4) .upsert() IS REFUSED — the file claims it needs UPDATE(user_id), which is withheld",
    Boolean(upsertErr) && upsertErr!.code === "42501",
    upsertErr ? `${err(upsertErr)}\n        LAYER: ${layer(upsertErr)}`
              : "UPSERT SUCCEEDED — the §3 comment in 0059 is WRONG and must be corrected");

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (d) and (e) the withheld columns ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { error: dTuition } = await A.from("notification_preferences")
    .update({ tuition_in_app: false }).eq("user_id", uid.a);
  t("(d1) A cannot NAME tuition_in_app",
    Boolean(dTuition) && dTuition!.code === "42501", `${err(dTuition)}\n        LAYER: ${layer(dTuition)}`);

  const { error: dAcademic } = await A.from("notification_preferences")
    .update({ academic_in_app: false }).eq("user_id", uid.a);
  t("(d2) …nor academic_in_app",
    Boolean(dAcademic) && dAcademic!.code === "42501", `${err(dAcademic)}\n        LAYER: ${layer(dAcademic)}`);

  const { error: eUpd } = await A.from("notification_preferences")
    .update({ marketing_email: true, marketing_opt_in_at: "2020-01-01T00:00:00Z" }).eq("user_id", uid.a);
  t("(e1) A cannot NAME marketing_opt_in_at on UPDATE",
    Boolean(eUpd) && eUpd!.code === "42501", `${err(eUpd)}\n        LAYER: ${layer(eUpd)}`);

  const { error: eIns } = await B.from("notification_preferences")
    .insert({ user_id: uid.b, marketing_email: true, marketing_opt_in_at: "2020-01-01T00:00:00Z" });
  t("⚠ (e2) …nor on INSERT — withheld from BOTH grants, not just one",
    Boolean(eIns) && eIns!.code === "42501", `${err(eIns)}\n        LAYER: ${layer(eIns)}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (h) and (h2) the two controls, and (h3) ---");
  // ══════════════════════════════════════════════════════════════════════════
  const beforeTouch = (await asSvc(uid.a))?.updated_at as string;
  const { data: hCtrl, error: hErr } = await A.from("notification_preferences")
    .update({ announcements_email: false }).eq("user_id", uid.a).select("user_id");
  t("⚠ (h) UPDATE CONTROL — the SAME session updating a GRANTED column succeeds, so (d) and (e1) were the COLUMN grant",
    !hErr && hCtrl?.length === 1, hErr ? err(hErr) : `${hCtrl?.length} row(s)`);

  const { data: hIns, error: hInsErr } = await B.from("notification_preferences")
    .insert({ user_id: uid.b, marketing_email: true }).select("user_id");
  t("⚠ (h2) INSERT CONTROL — B creates its own row naming only granted columns, so (e2) was the COLUMN grant and not a missing INSERT grant",
    !hInsErr && hIns?.length === 1, hInsErr ? err(hInsErr) : `${hIns?.length} row(s)`);

  const afterTouch = (await asSvc(uid.a))?.updated_at as string;
  t("(h3) updated_at moved without the client naming it — touch_notification_preferences fires",
    Boolean(beforeTouch && afterTouch && new Date(afterTouch) > new Date(beforeTouch)),
    `${beforeTouch} -> ${afterTouch}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (f), (f2), (g) the consent lifecycle ---");
  // ══════════════════════════════════════════════════════════════════════════
  const bRow = await asSvc(uid.b);
  const bStamp = bRow?.marketing_opt_in_at as string | null;
  t("⚠ (f) B's opt-in via a GRANTED column is SERVER-STAMPED — the amendment did not break the product",
    Boolean(bStamp), `marketing_email=${bRow?.marketing_email} marketing_opt_in_at=${bStamp}`);
  const skewMs = bStamp ? Math.abs(Date.now() - new Date(bStamp).getTime()) : Infinity;
  t("…and the stamp is now(), not a value the client chose",
    skewMs < 120_000, `${Math.round(skewMs / 1000)}s from now  (the client sent no timestamp at all)`);

  const { error: f2e } = await B.from("notification_preferences")
    .update({ marketing_in_app: true }).eq("user_id", uid.b);
  const bRow2 = await asSvc(uid.b);
  t("(f2) turning the SECOND channel on does not re-date the consent",
    !f2e && bRow2?.marketing_opt_in_at === bStamp,
    `${bStamp} -> ${bRow2?.marketing_opt_in_at}`);

  const { error: ge } = await B.from("notification_preferences")
    .update({ marketing_email: false, marketing_in_app: false }).eq("user_id", uid.b);
  const bRow3 = await asSvc(uid.b);
  t("⚠ (g) WITHDRAWAL CLEARS THE DATE — the direction a CHECK cannot enforce",
    !ge && bRow3?.marketing_opt_in_at === null,
    `marketing off, marketing_opt_in_at = ${JSON.stringify(bRow3?.marketing_opt_in_at)}`);

  const { error: ge2 } = await B.from("notification_preferences")
    .update({ marketing_email: true }).eq("user_id", uid.b);
  const bRow4 = await asSvc(uid.b);
  const restamped = bRow4?.marketing_opt_in_at as string | null;
  t("…and a SECOND opt-in is a NEW consent with a LATER stamp, not a resumption of the first",
    Boolean(!ge2 && restamped && bStamp && new Date(restamped) > new Date(bStamp)),
    `first ${bStamp}  ->  second ${restamped}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (i) A cannot read or write B's preferences ---");
  // ══════════════════════════════════════════════════════════════════════════
  const { count: bothExist } = await svc.from("notification_preferences")
    .select("user_id", { count: "exact", head: false }).in("user_id", [uid.a, uid.b]);
  t("⚠ FIXTURE — BOTH rows exist, confirmed as service_role, before any negative is believed",
    bothExist === 2, `${bothExist} row(s)`);

  const { data: aSees } = await A.from("notification_preferences").select("user_id");
  t("(i1) A sees only their own row",
    aSees?.length === 1 && aSees[0].user_id === uid.a,
    JSON.stringify(aSees?.map((r) => String(r.user_id).slice(0, 8))));

  const { data: iUpd, error: iUpdErr } = await A.from("notification_preferences")
    .update({ announcements_email: false }).eq("user_id", uid.b).select("user_id");
  t("(i2) A's UPDATE of B's row touches 0 rows — the policy, silently",
    !iUpdErr && iUpd?.length === 0,
    iUpdErr ? err(iUpdErr) : `${iUpd?.length} row(s)  LAYER: RLS POLICY (USING), no error by design`);

  const { error: iIns } = await A.from("notification_preferences")
    .insert({ user_id: uid.b, academic_email: false });
  t("⚠ (i3) A's INSERT for B is REFUSED BY THE WITH CHECK — a different failure from (i2), and both matter",
    Boolean(iIns) && iIns!.code === "42501",
    `${err(iIns)}\n        LAYER: ${layer(iIns)}`);

  const bAfter = await asSvc(uid.b);
  t("…and B's row is untouched by any of it",
    bAfter?.announcements_email === true, `B.announcements_email = ${bAfter?.announcements_email}`);
} finally {
  console.log("\n--- CLEANUP — by captured id only ---");
  const all = [...ids, FOUNDER_PROBE];
  const { data: gone } = await svc.from("notification_preferences").delete().in("user_id", all).select("user_id");
  console.log(`  preference rows removed: ${gone?.length ?? 0}`);
  const leftovers: string[] = [];
  for (const id of all) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) leftovers.push(`${id} (${error.message})`);
  }
  if (leftovers.length) console.log(`\n  ⚠⚠ LEFTOVER IDENTITIES:\n     ${leftovers.join("\n     ")}\n`);
  else console.log(`  identities removed: ${ids.length} probe(s) + the Stage 2 founder probe ${FOUNDER_PROBE.slice(0, 8)}`);
  const { data: rest } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const still = (rest?.users ?? []).filter((u) => (u.email ?? "").endsWith("@example.test"));
  console.log(`  @example.test identities remaining: ${still.length}`);
  still.forEach((u) => console.log(`     LEFTOVER ${u.id} ${u.email}`));
  const { count: left } = await svc.from("notification_preferences").select("user_id", { count: "exact", head: false });
  console.log(`  public.notification_preferences total rows now: ${left ?? "?"}`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
