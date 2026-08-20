/**
 * Create ONE throwaway identity for the founder's 0055(e) / 0049(g) pastes.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/make-sabotage-probe.ts          # create, print ids
 *   node ... scripts/db-checks/make-sabotage-probe.ts --abort   # remove it
 *
 * ============================================================================
 * ⚠ WHY THIS EXISTS INSTEAD OF AN INSERT INTO auth.users
 * ============================================================================
 * auth.users is GoTrue's table, not ours. A hand-written row skips every
 * invariant GoTrue maintains — aud, role, instance_id, and in particular the
 * token columns (confirmation_token, recovery_token, email_change,
 * email_change_token_new). GoTrue scans several of those into non-nullable Go
 * strings, so a row with NULLs where it expects '' produces
 * "sql: Scan error … converting NULL to string" — and that error is not
 * scoped to the bad row. It surfaces on token refresh and sign-in for
 * EVERYONE, which is an auth outage caused by a verification probe.
 *
 * The Admin API creates the row the way GoTrue expects. That is the only
 * reason this is a script rather than a paste.
 *
 * ⚠ IT DELIBERATELY DOES NOT CLEAN UP. The founder's paste ends by erasing
 * this identity — that IS the test. `--abort` is here for the case where the
 * paste is never run, so the probe is never stranded with no way back.
 */
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

if (!existsSync(".env.local")) { console.error("REFUSED — .env.local not found."); process.exit(2); }
const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const l = line.trim();
  if (!l || l.startsWith("#")) continue;
  const i = l.indexOf("="); if (i < 0) continue;
  let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env.set(l.slice(0, i).trim(), v);
}
const svc = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } });

const ABORT = process.argv.includes("--abort");

if (ABORT) {
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  // ⚠ NARROWED TWICE: the probe prefix AND the reserved .test TLD. Neither
  // alone is enough to point a delete at a live database.
  const probes = (data?.users ?? []).filter(
    (u) => (u.email ?? "").startsWith("probe-sabotage-") && (u.email ?? "").endsWith("@example.test"),
  );
  if (!probes.length) { console.log("nothing to abort — no probe-sabotage-*@example.test identity exists"); process.exit(0); }
  for (const u of probes) {
    const r = await svc.rpc("erase_user", { target: u.id });
    console.log(`erase_user(${u.email}) -> ${r.error ? r.error.code + ": " + r.error.message : "erased"}`);
  }
  const left = await svc.from("sabotage_probe").select("id");
  if (!left.error) console.log(`⚠ public.sabotage_probe STILL EXISTS with ${(left.data ?? []).length} row(s) — DROP TABLE public.sabotage_probe;`);
  process.exit(0);
}

const stamp = Date.now();
const email = `probe-sabotage-${stamp}@example.test`;
const { data, error } = await svc.auth.admin.createUser({
  email, password: `Px-${randomUUID()}`, email_confirm: true,
});
if (error || !data.user) { console.error("createUser failed:", error?.message); process.exit(1); }

// A ledger row, so 0049(g)'s DELETE has something real to be refused on.
// ⚠ AN UPDATE OR DELETE MATCHING NOTHING FIRES NO PER-ROW TRIGGER AND RETURNS
// NO ERROR. Without this row the block would pass while proving nothing.
const led = await svc.from("lesson_credit_transactions")
  .insert({ user_id: data.user.id, delta: 4, reason: "admin_adjustment" }).select("id").single();
if (led.error) {
  console.error("ledger insert failed:", led.error.message, "— erasing the probe again");
  await svc.rpc("erase_user", { target: data.user.id });
  process.exit(1);
}

console.log(`
PROBE CREATED — hand these to the paste, then run it.

  uuid       ${data.user.id}
  email      ${email}
  ledger id  ${(led.data as { id: string }).id}

Abort without running the paste:
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/db-checks/make-sabotage-probe.ts --abort
`);
