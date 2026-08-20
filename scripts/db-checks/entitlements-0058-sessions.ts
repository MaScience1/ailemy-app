/**
 * 0058 (g) and (h) — the two blocks that need REAL authenticated sessions.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/entitlements-0058-sessions.ts > /tmp/0058-gh.txt 2>&1
 *
 * ============================================================================
 * ⚠ WHY THESE CANNOT BE RUN FROM THE SQL EDITOR
 * ============================================================================
 * Both policies on public.entitlements are written against auth.uid(), which is
 * NULL for the `postgres` role. Every row policy therefore evaluates false
 * there regardless of whether it is correct — a false from the SQL Editor is
 * not evidence of anything. And service_role holds BYPASSRLS, so running them
 * as service_role passes for the wrong reason.
 *
 * ⚠ THE POINT OF (g): A ROW IN THIS TABLE *IS* ACCESS. A student who could
 * INSERT one would grant themselves a paid course; one who could UPDATE one
 * would extend their own subscription; one who could DELETE one could clear
 * somebody's revocation. All three are tried, because they are three different
 * ways to award yourself the same thing.
 *
 * ⚠ THE POINT OF (h): B'S ROW IS SEEDED AND CONFIRMED FIRST. "A sees 0 of B's
 * rows" is worthless against an empty table, and that exact false pass has
 * already cost a probe on this project once.
 *
 * ⚠ EVERY PROBE IS @example.test (RFC 2606 reserved, can never be real), unique
 * per run, minted through the admin API. Cleanup runs from a `finally` and
 * prints leftover ids in full if it fails. NEVER pipe this through `head` — a
 * closed pipe killed a sibling script before its cleanup and stranded rows that
 * would have made a real person permanently un-erasable.
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
  e ? `${e.code ?? "?"}: ${(e.message ?? "").slice(0, 160)}` : "no error";

/**
 * ⚠ WHICH LAYER REFUSED. Postgres words a write-side privilege failure as
 * "permission denied for TABLE" whether the missing thing is a table grant or a
 * column grant, and an RLS refusal words itself differently again. On this
 * table there is NO write grant at all, so every write must be the grant — and
 * the SELECT control below is what proves the table resolves and the session
 * works, ruling out "the name is wrong" as the reason.
 */
const layer = (e: { code?: string; message?: string } | null): string => {
  if (!e) return "NOT REFUSED";
  const m = (e.message ?? "").toLowerCase();
  if (e.code === "42501" && m.includes("permission denied")) return "TABLE GRANT (no write grant exists)";
  if (e.code === "42501" && m.includes("row-level security")) return "RLS POLICY (WITH CHECK)";
  if (e.code === "PGRST205" || e.code === "42P01") return "TABLE ABSENT — check paste 1 landed";
  return `OTHER (${e.code})`;
};

const run = Date.now();
const mk = (who: string) => `probe-0058gh-${run}-${who}@example.test`;
const PW = `probe-${run}-Aa1!`;

const ids: string[] = [];
const OLD_PROBE = "83e70762-e2d3-4267-8379-20fb11ab130d"; // the founder's Stage 1 probe

let entA: string | null = null;
let entB: string | null = null;

try {
  console.log(`\n=== 0058 (g) and (h) — real sessions, run ${run} ===`);

  // ── the table must exist, or every refusal below means nothing ────────────
  const { error: existErr } = await svc.from("entitlements").select("id").limit(1);
  t("⚠ PRE-FLIGHT — public.entitlements exists (paste 1 landed)",
    !existErr, existErr ? err(existErr) : "reachable as service_role");
  if (existErr) throw new Error("entitlements is not reachable — stop");

  // ── two probe identities with REAL sessions ───────────────────────────────
  const sessions: Record<string, SupabaseClient> = {};
  const uid: Record<string, string> = {};
  for (const who of ["a", "b"]) {
    const email = mk(who);
    const { data, error } = await svc.auth.admin.createUser({ email, password: PW, email_confirm: true });
    if (error || !data?.user?.id) { t(`mint probe ${who.toUpperCase()}`, false, error?.message ?? "no id"); throw new Error("mint failed"); }
    ids.push(data.user.id);
    uid[who] = data.user.id;

    const c = createClient(URL_, ANON, opts);
    const { data: s, error: sErr } = await c.auth.signInWithPassword({ email, password: PW });
    if (sErr || !s?.session) { t(`sign in probe ${who.toUpperCase()}`, false, sErr?.message ?? "no session"); throw new Error("sign-in failed"); }
    sessions[who] = c;
  }
  t("A and B minted and signed in with the ANON key — real authenticated sessions",
    Object.keys(sessions).length === 2, `A=${uid.a.slice(0, 8)}  B=${uid.b.slice(0, 8)}`);
  t("⚠ EVERY probe address is @example.test — no real identity is in scope",
    [mk("a"), mk("b")].every((e) => e.endsWith("@example.test")), `${mk("a")} | ${mk("b")}`);

  // ── FIXTURE, as service_role, confirmed NON-EMPTY before any negative ─────
  const seed = async (who: string, subject: string) => {
    const { data, error } = await svc.from("entitlements")
      .insert({ user_id: uid[who], kind: "course", subject_ref: subject, source: "admin_grant", note: `probe-0058gh ${who}` })
      .select("id").single();
    if (error) throw new Error(`seed ${who}: ${err(error)}`);
    return data.id as string;
  };
  entA = await seed("a", "ial-chemistry-as");
  entB = await seed("b", "ial-biology-as");

  const { count: seededCount } = await svc.from("entitlements")
    .select("id", { count: "exact", head: false }).in("user_id", [uid.a, uid.b]);
  t("⚠ FIXTURE IS NON-EMPTY — A and B each hold one entitlement, confirmed as service_role",
    seededCount === 2, `${seededCount} row(s)  A:${String(entA).slice(0, 8)}  B:${String(entB).slice(0, 8)}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (g) a student cannot grant themselves access ---");
  // ══════════════════════════════════════════════════════════════════════════

  // CONTROL FIRST. If A cannot even read, every refusal below is "wrong name".
  const { data: ctrl, error: ctrlErr } = await sessions.a.from("entitlements").select("id");
  t("⚠ CONTROL — A CAN read this table, so the refusals below are not a bad name or a dead session",
    !ctrlErr && Array.isArray(ctrl), ctrlErr ? err(ctrlErr) : `${ctrl!.length} row(s) visible to A`);

  const { error: gInsert } = await sessions.a.from("entitlements").insert({
    user_id: uid.a, kind: "course", subject_ref: "ial-physics-as", source: "admin_grant", note: "mine now",
  });
  t("(g1) A cannot INSERT an entitlement for themselves",
    Boolean(gInsert) && gInsert!.code === "42501", `${err(gInsert)}\n        LAYER: ${layer(gInsert)}`);

  const { data: gUpdRows, error: gUpdate } = await sessions.a.from("entitlements")
    .update({ ends_at: new Date(Date.now() + 10 * 365 * 864e5).toISOString() })
    .eq("user_id", uid.a).select("id");
  t("(g2) A cannot UPDATE their own entitlement to extend it",
    Boolean(gUpdate) && gUpdate!.code === "42501",
    `${err(gUpdate)}\n        LAYER: ${layer(gUpdate)}${gUpdRows ? `  rows=${gUpdRows.length}` : ""}`);

  const { data: gDelRows, error: gDelete } = await sessions.a.from("entitlements")
    .delete().eq("user_id", uid.a).select("id");
  t("(g3) …nor DELETE one — clearing a revocation is a third way to award access",
    Boolean(gDelete) && gDelete!.code === "42501",
    `${err(gDelete)}\n        LAYER: ${layer(gDelete)}${gDelRows ? `  rows=${gDelRows.length}` : ""}`);

  // ⚠ THE ROW MUST STILL BE THERE. A refusal that had already written is not a
  // refusal, and PostgREST reports an RLS-filtered write identically to a
  // blocked one.
  const { count: stillA } = await svc.from("entitlements")
    .select("id", { count: "exact", head: false }).eq("user_id", uid.a);
  t("⚠ A's entitlement is UNCHANGED after all three attempts — refused, not partially applied",
    stillA === 1, `${stillA} row(s) for A`);
  const { data: aRow } = await svc.from("entitlements").select("ends_at").eq("id", entA!).single();
  t("…and its ends_at is still NULL — (g2) wrote nothing",
    aRow?.ends_at === null, `ends_at = ${JSON.stringify(aRow?.ends_at)}`);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- (h) A sees only their own ---");
  // ══════════════════════════════════════════════════════════════════════════

  const { data: aSees, error: aSeesErr } = await sessions.a.from("entitlements").select("id,user_id,subject_ref");
  t("(h1) A's SELECT succeeds", !aSeesErr, aSeesErr ? err(aSeesErr) : `${aSees!.length} row(s)`);
  t("(h2) A sees EXACTLY their own row",
    aSees?.length === 1 && aSees[0].user_id === uid.a,
    JSON.stringify(aSees?.map((r) => ({ u: String(r.user_id).slice(0, 8), s: r.subject_ref }))));
  t("⚠ (h3) B's row is ABSENT from A's result THOUGH IT EXISTS — the fixture check above proves it does",
    !aSees?.some((r) => r.id === entB), `B's id ${String(entB).slice(0, 8)} not among A's rows`);

  // The mirror. Without it, (h) is consistent with a policy that shows nobody
  // anything except by coincidence of ordering.
  const { data: bSees } = await sessions.b.from("entitlements").select("id,user_id");
  t("(h4) MIRROR — B sees exactly their own, and not A's",
    bSees?.length === 1 && bSees[0].user_id === uid.b && !bSees.some((r) => r.id === entA),
    JSON.stringify(bSees?.map((r) => String(r.user_id).slice(0, 8))));
} finally {
  console.log("\n--- CLEANUP — by captured id only ---");
  // Rows first: entitlements.user_id is ON DELETE CASCADE, but deleting them
  // explicitly means the count is reportable rather than assumed.
  if (ids.length) {
    const { data: gone } = await svc.from("entitlements").delete().in("user_id", ids).select("id");
    console.log(`  entitlement rows removed: ${gone?.length ?? 0}`);
  }
  const leftovers: string[] = [];
  for (const id of [...ids, OLD_PROBE]) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) leftovers.push(`${id} (${error.message})`);
  }
  if (leftovers.length) {
    console.log(`\n  ⚠⚠ LEFTOVER IDENTITIES — delete by hand:\n     ${leftovers.join("\n     ")}\n`);
  } else {
    console.log(`  identities removed: ${ids.length} probe(s) + the Stage 1 founder probe ${OLD_PROBE.slice(0, 8)}`);
  }
  const { data: rest } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const still = (rest?.users ?? []).filter((u) => (u.email ?? "").endsWith("@example.test"));
  console.log(`  @example.test identities remaining: ${still.length}`);
  still.forEach((u) => console.log(`     LEFTOVER ${u.id} ${u.email}`));
  const { count: entLeft } = await svc.from("entitlements").select("id", { count: "exact", head: false });
  console.log(`  public.entitlements total rows now: ${entLeft ?? "?"}`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
