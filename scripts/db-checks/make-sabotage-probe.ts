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
 *
 * ============================================================================
 * ⚠ IT REFUSES TO MINT IF public.sabotage_probe ALREADY EXISTS. THIS IS THE
 * WHOLE REASON THE FIRST ATTEMPT WASTED A PROBE.
 * ============================================================================
 * The table pre-existed from an earlier paste. `CREATE TABLE` raised 42P07,
 * the SQL Editor aborted the rest of that paste, and the REVOKE and the INSERT
 * never ran — so the trap existed and was EMPTY. erase_user then found no
 * residue, succeeded, and destroyed the probe it was meant to be refused on.
 *
 * That is precisely the failure 0055's own header names: A ZERO-ROW TABLE
 * CANNOT FAIL AN ERASURE CHECK. The rule was written for the pre-counts and
 * not applied to the fixture. Checking here means a doomed paste never gets a
 * probe minted for it in the first place.
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

// ⚠ PRE-FLIGHT. Refuse to mint into a run that cannot work.
{
  const existing = await svc.from("sabotage_probe").select("id");
  if (!existing.error) {
    console.error(`
REFUSED — public.sabotage_probe ALREADY EXISTS (${(existing.data ?? []).length} row(s)).

CREATE TABLE would raise 42P07, the SQL Editor would abort the rest of that
paste, and the fixture INSERT would silently not run — leaving an EMPTY trap
that erase_user sails straight through, destroying the probe. That is exactly
how the previous attempt was lost.

Drop it first, confirm zero, then re-run this:
    DROP TABLE public.sabotage_probe;
`);
    process.exit(2);
  }
  // PGRST205 is the expected, wanted answer here: the table is absent.
  if (existing.error.code !== "PGRST205" && existing.error.code !== "42P01") {
    console.error(`REFUSED — could not determine whether sabotage_probe exists: ${existing.error.code}: ${existing.error.message}`);
    process.exit(2);
  }
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

const UID = data.user.id;
const LEDGER = (led.data as { id: string }).id;

/**
 * ⚠ THE PASTES ARE EMITTED WITH THE REAL VALUES ALREADY IN THEM. Three ids
 * transcribed by hand into eight statements is a transcription error waiting
 * to happen, and one of those statements deletes a person.
 */
console.log(`
PROBE CREATED
  uuid       ${UID}
  email      ${email}
  ledger id  ${LEDGER}

Abort without running the pastes:
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/db-checks/make-sabotage-probe.ts --abort

════════════════════════════════════════════════════════════════════════════
RUN EACH BLOCK AS ITS OWN PASTE, IN ORDER, AND READ THE RESULT BEFORE THE NEXT
════════════════════════════════════════════════════════════════════════════

-- ── BLOCK 0 · the table must NOT exist ──────────────────────────────────────
SELECT count(*) AS must_be_zero FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name = 'sabotage_probe';
-- EXPECT 0. A 1 means BLOCK 1 will raise 42P07 and abort — STOP and drop it.

-- ── BLOCK 1 · 0049(g): an ordinary DELETE on the ledger is refused ──────────
DELETE FROM public.lesson_credit_transactions WHERE id = '${LEDGER}';
-- EXPECT ERROR 23001 '...append-only: DELETE refused...'  (says DELETE, not UPDATE)

-- ── BLOCK 2 · 0049(g) second half: the row is PROVABLY intact ───────────────
SELECT count(*) AS must_be_one FROM public.lesson_credit_transactions WHERE id = '${LEDGER}';
-- EXPECT 1. A 0 means the delete went through and the error came from elsewhere.

-- ── BLOCK 3 · create the trap table (alone) ────────────────────────────────
CREATE TABLE public.sabotage_probe (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);

-- ── BLOCK 4 · the three privileges (alone) ─────────────────────────────────
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.sabotage_probe FROM anon, authenticated;

-- ── BLOCK 5 · the fixture row (alone — this is the one that went missing) ──
INSERT INTO public.sabotage_probe (email) VALUES ('${email}');

-- ── BLOCK 6 · ⚠ FIXTURE PRE-CHECK. STOP IF THIS IS NOT 1. ──────────────────
SELECT count(*) AS must_be_one FROM public.sabotage_probe WHERE email = '${email}';
-- EXPECT 1. A 0 means the trap is EMPTY and BLOCK 7 would SUCCEED and destroy
-- the probe instead of being refused. That is exactly what happened last time.

-- ── BLOCK 7 · 0055(e) HALF ONE — the sweep must REFUSE ─────────────────────
SELECT public.erase_user('${UID}');
-- EXPECT ERROR 23001 'the address still appears in 1 — sabotage_probe.email (1 row(s)).
--   NOTHING WAS ERASED; this transaction rolled back...'
-- ⚠ A RECEIPT HERE IS THE FAILURE. Stop and say so.

-- ── BLOCK 8 · the rollback was total ───────────────────────────────────────
SELECT (SELECT count(*) FROM auth.users WHERE id = '${UID}')                                  AS user_still_there,
       (SELECT count(*) FROM public.lesson_credit_transactions WHERE id = '${LEDGER}')        AS ledger_still_there;
-- EXPECT 1, 1 — refused, not partly erased.

-- ── BLOCK 9 · remove the cause (alone, so nothing can roll it back) ────────
DROP TABLE public.sabotage_probe;

-- ── BLOCK 10 · 0055(e) HALF TWO — now it must SUCCEED ──────────────────────
SELECT public.erase_user('${UID}');
-- EXPECT a jsonb receipt with ledger_rows_removed 1.
-- ⚠ RUN BOTH HALVES OR NEITHER PROVES ANYTHING: the refusal shows the check
--   fires, the success shows the check was the CAUSE and not some other fault.

-- ── BLOCK 11 · nothing left ────────────────────────────────────────────────
SELECT (SELECT count(*) FROM auth.users WHERE id = '${UID}')                            AS probe_user,
       (SELECT count(*) FROM public.lesson_credit_transactions WHERE id = '${LEDGER}')  AS ledger_row,
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema='public' AND table_name='sabotage_probe')                    AS probe_table;
-- EXPECT 0, 0, 0
`);
