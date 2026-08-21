/**
 * (g) — who may EXECUTE erase_user, answered BEHAVIOURALLY.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/erase-user-execute-grant.ts > /tmp/g.txt 2>&1
 *
 * ============================================================================
 * ⚠ has_function_privilege IS NOT REACHABLE THROUGH PostgREST, SO THIS ASKS
 * THE QUESTION THE OTHER WAY: BY TRYING.
 * ============================================================================
 * A catalogue lookup says what the grant is. Calling the function says what the
 * grant DOES, which is the thing that actually matters — it is the real attack
 * path, not a description of it.
 *
 * ⚠ THE TARGET IS A UUID THAT DOES NOT EXIST, AND THAT IS THE SAFETY DESIGN.
 * erase_user's first statement resolves the email and raises no_data_found
 * (P0002) when there is no such user, before any write. So even in the
 * catastrophic case — anon CAN execute it — nothing is erased and the failure
 * is loud. A test for "can this delete people" must not be able to delete
 * anybody.
 *
 * READING THE RESULT:
 *   42501 / PGRST202  → refused. The grant is absent.       (the two `f`s)
 *   P0002             → executed, found no such user.       (the `t`)
 *   anything else     → report it verbatim, do not interpret.
 */
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (!existsSync(".env.local")) { console.error("REFUSED"); process.exit(2); }
const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const l = line.trim(); if (!l || l.startsWith("#")) continue;
  const i = l.indexOf("="); if (i < 0) continue;
  let v = l.slice(i + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env.set(l.slice(0, i).trim(), v);
}
const URL_ = env.get("NEXT_PUBLIC_SUPABASE_URL")!;
const ANON = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")!;
const SERVICE = env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc: SupabaseClient = createClient(URL_, SERVICE, opts);

let pass = 0, fail = 0;
const t = (n: string, c: boolean, o: unknown) => {
  const s = typeof o === "string" ? o : JSON.stringify(o);
  if (c) { pass++; console.log(`  OK  ${n}\n        ${s}`); } else { fail++; console.log(`  XX  ${n}\n        ${s}`); }
};
const REFUSED = (e: { code?: string } | null) => Boolean(e) && (e!.code === "42501" || e!.code === "PGRST202");

/** ⚠ Nonexistent on purpose. Nothing can be erased by this script. */
const GHOST = randomUUID();
const run = Date.now();
let probeId: string | null = null;

console.log(`\n=== (g) EXECUTE on erase_user — behavioural, run ${run} ===`);
console.log(`  target uuid ${GHOST} — deliberately not a real user\n`);

try {
  // ── anon ──────────────────────────────────────────────────────────────────
  const anonC = createClient(URL_, ANON, opts);
  const { data: aData, error: aErr } = await anonC.rpc("erase_user", { target: GHOST });
  t("(g1) anon CANNOT execute erase_user  →  the first `f`",
    REFUSED(aErr), aErr ? `${aErr.code}: ${(aErr.message ?? "").slice(0, 140)}` : `EXECUTED — returned ${JSON.stringify(aData)}`);

  // ── authenticated ─────────────────────────────────────────────────────────
  const email = `probe-g-${run}@example.test`;
  const { data: made, error: mkErr } = await svc.auth.admin.createUser({
    email, password: `probe-${run}-Aa1!`, email_confirm: true,
  });
  if (mkErr || !made?.user?.id) throw new Error(`mint: ${mkErr?.message}`);
  probeId = made.user.id;
  const userC = createClient(URL_, ANON, opts);
  const { error: sErr } = await userC.auth.signInWithPassword({ email, password: `probe-${run}-Aa1!` });
  if (sErr) throw new Error(`sign in: ${sErr.message}`);
  t("⚠ CONTROL — the session is real and works, so (g2)'s refusal is the grant and not a dead token",
    Boolean((await userC.auth.getUser()).data.user?.id), "authenticated session live");

  const { data: uData, error: uErr } = await userC.rpc("erase_user", { target: GHOST });
  t("(g2) a REAL authenticated student CANNOT execute erase_user  →  the second `f`",
    REFUSED(uErr), uErr ? `${uErr.code}: ${(uErr.message ?? "").slice(0, 140)}` : `EXECUTED — returned ${JSON.stringify(uData)}`);

  // ⚠ the sharper version: a signed-in user aiming at THEMSELVES, which is the
  // one target they could plausibly be allowed. Still refused at the grant.
  const { error: selfErr } = await userC.rpc("erase_user", { target: probeId });
  t("(g2b) …not even at their OWN uid — the grant is checked before the function body runs",
    REFUSED(selfErr), selfErr ? `${selfErr.code}: ${(selfErr.message ?? "").slice(0, 140)}` : "EXECUTED — self-erasure succeeded");
  const { data: stillThere } = await svc.auth.admin.getUserById(probeId);
  t("…and the probe is still present, so (g2b) wrote nothing", Boolean(stillThere?.user?.id),
    stillThere?.user?.id ? "present" : "GONE — a client just erased an account");

  // ── service_role ──────────────────────────────────────────────────────────
  const { error: svcErr } = await svc.rpc("erase_user", { target: GHOST });
  t("(g3) service_role CAN execute it — P0002 'no such user', not a permission error  →  the `t`",
    Boolean(svcErr) && svcErr!.code === "P0002",
    svcErr ? `${svcErr.code}: ${(svcErr.message ?? "").slice(0, 140)}` : "returned a receipt for a ghost uuid");

  console.log(`\n  TRIPLE:  anon=${REFUSED(aErr) ? "f" : "T"}  authenticated=${REFUSED(uErr) ? "f" : "T"}  service_role=${svcErr?.code === "P0002" ? "t" : "F"}`);
} finally {
  if (probeId) {
    const { error } = await svc.auth.admin.deleteUser(probeId);
    console.log(error ? `\n  ⚠⚠ LEFTOVER ${probeId}: ${error.message}` : `\n  cleanup: probe ${probeId.slice(0, 8)} removed by captured id`);
  }
  const { data: rest } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const left = (rest?.users ?? []).filter((u) => (u.email ?? "").endsWith("@example.test"));
  console.log(`  @example.test identities remaining: ${left.length}`);
  left.forEach((u) => console.log(`     ${u.id} ${u.email}`));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
