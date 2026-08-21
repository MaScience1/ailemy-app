import { existsSync, readFileSync } from "node:fs";
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
const svc: SupabaseClient = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } });
let pass = 0, fail = 0;
const t = (n: string, c: boolean, o: unknown) => {
  const s = typeof o === "string" ? o : JSON.stringify(o);
  if (c) { pass++; console.log(`  OK  ${n}\n        ${s}`); } else { fail++; console.log(`  XX  ${n}\n        ${s}`); }
};
const U = "b85daedd-b226-46f1-9758-f2e6499e6bc6";
const P = "180bde15-6720-445b-869d-0ab73ea7846a";
const BASELINE = 7;

console.log("\n=== STEP 5 — the SAME probe that refused before 0061 ===");
const { data: before } = await svc.auth.admin.getUserById(U);
const { data: profBefore } = await svc.from("billing_profiles")
  .select("billing_email,billing_name,billing_country,owner_user_id").eq("id", P).single();
t("⚠ the SAME fixture, untouched since Stage 3b — not re-minted", Boolean(before?.user?.id) && Boolean(profBefore),
  `user present · ${JSON.stringify(profBefore)}`);
t("…and its billing_email is still the probe's own address, which is what refused before",
  profBefore?.billing_email === before?.user?.email, `${profBefore?.billing_email}`);

const { data: receipt, error } = await svc.rpc("erase_user", { target: U });
t("⚠⚠ STEP 5 — erase_user now SUCCEEDS on the row that refused before 0061",
  !error && Boolean(receipt), error ? `STILL REFUSED: ${error.code}: ${error.message}` : "receipt returned");
if (error) { console.log(`\n${"FAILURES"} — ${pass} passed, ${fail + 1} failed`); process.exit(1); }
const r = receipt as Record<string, unknown>;
console.log(`\n  RECEIPT: ${JSON.stringify(r)}\n`);

t("⚠⚠ GATE 4 — email_columns_scanned = 8, baseline + 1", r.email_columns_scanned === BASELINE + 1,
  `${BASELINE} -> ${r.email_columns_scanned}`);
t("billing_profiles_scrubbed = 1", r.billing_profiles_scrubbed === 1, r.billing_profiles_scrubbed);
t("stripe_erasure_required is [] — that probe never had a customer id, and an empty array is a real answer",
  Array.isArray(r.stripe_erasure_required) && (r.stripe_erasure_required as unknown[]).length === 0,
  JSON.stringify(r.stripe_erasure_required));
t("payer_erasure_side_effects is [] — nobody was linked to that profile",
  Array.isArray(r.payer_erasure_side_effects) && (r.payer_erasure_side_effects as unknown[]).length === 0,
  JSON.stringify(r.payer_erasure_side_effects));
t("storage_purge_required names the bucket and the prefix",
  (r.storage_purge_required as Record<string, unknown>)?.bucket === "submissions",
  JSON.stringify(r.storage_purge_required));

const { data: after } = await svc.auth.admin.getUserById(U);
t("the probe is GONE from auth.users — checked independently of the receipt", !after?.user?.id,
  after?.user?.id ? "STILL PRESENT" : "gone");
const { data: profAfter } = await svc.from("billing_profiles")
  .select("billing_email,billing_name,billing_country,owner_user_id").eq("id", P).single();
t("the profile SURVIVED, tombstoned, owner nulled by the FK",
  profAfter?.billing_email === `erased-${U}@ailemy.invalid` && profAfter?.billing_name === "Erased user"
  && profAfter?.billing_country === null && profAfter?.owner_user_id === null,
  JSON.stringify(profAfter));

console.log("\n--- independent residue sweep across all 8 email columns ---");
const cols: [string, string][] = [
  ["waitlist", "email"], ["cohort_enrolments", "email"], ["interest_registrations", "email"],
  ["booking_holds", "email"], ["private_bookings", "email"],
  ["cancellation_requests", "requested_by_email"], ["notification_events", "email"],
  ["billing_profiles", "billing_email"],
];
let residue = 0; const seen: string[] = [];
for (const [tbl, col] of cols) {
  const { count } = await svc.from(tbl).select(col, { count: "exact", head: false }).ilike(col, before!.user!.email!);
  seen.push(`${tbl}.${col}=${count ?? 0}`);
  residue += count ?? 0;
}
t("⚠ residue across all 8 columns = 0 — checked by this script, not by erase_user's own report",
  residue === 0, seen.join(" · "));
t("…and the list is 8 columns long, matching the receipt", cols.length === r.email_columns_scanned,
  `${cols.length} checked vs ${r.email_columns_scanned} scanned`);

console.log("\n--- final state ---");
const { data: rest } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
const still = (rest?.users ?? []).filter((u) => (u.email ?? "").endsWith("@example.test"));
t("⚠ ZERO @example.test identities remain — every probe from the whole session is gone",
  still.length === 0, still.map((u) => `${u.id} ${u.email}`).join(" | ") || "none");
const { count: bp } = await svc.from("billing_profiles").select("id", { count: "exact", head: false });
console.log(`  billing_profiles: ${bp} (1 tombstoned row, retained because payments may reference it)`);
console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
