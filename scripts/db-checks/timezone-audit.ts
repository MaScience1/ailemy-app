/**
 * READ-ONLY audit: which stored timezone values are abbreviations?
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/timezone-audit.ts
 *
 * ============================================================================
 * ⚠ THIS SCRIPT PERFORMS NO WRITES. SELECT ONLY, EVERY TABLE.
 * ============================================================================
 * It exists to answer "how bad is it" BEFORE anything is changed, because a
 * migration that rewrites stored zones needs to know what it would be
 * rewriting — and because "we found none" is a different report from "we fixed
 * some".
 *
 * ⚠ THE TEST IS RESOLUTION, NOT SHAPE. Checking for a "/" would miss "UTC",
 * which is legitimate, and would not explain WHY a value is wrong. Intl
 * silently remaps a legacy abbreviation to a canonical zone, so the tell is
 * that what comes back is not what went in: "BST" resolves to Asia/Dhaka, and
 * that inequality is the defect made visible.
 */
import { existsSync, readFileSync } from "node:fs";

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

type Verdict = "ok" | "remapped" | "rejected" | "empty";
function classify(tz: string | null): { verdict: Verdict; resolved: string | null } {
  if (tz === null || tz.trim() === "") return { verdict: "empty", resolved: null };
  try {
    const resolved = new Intl.DateTimeFormat("en-GB", { timeZone: tz }).resolvedOptions().timeZone;
    return { verdict: resolved === tz ? "ok" : "remapped", resolved };
  } catch {
    return { verdict: "rejected", resolved: null };
  }
}

// Every column in the schema that stores a timezone NAME (not a timestamptz).
const TARGETS: [table: string, column: string, note: string][] = [
  ["profiles", "timezone", "student preference — free text, column-grant writable by the student"],
  ["cohort_schedules", "timezone", "⚠ SCHEDULING: expands into lesson instants"],
  ["tuition_sessions", "timezone", "⚠ SCHEDULING: one-off and override times"],
  ["teacher_availability", "timezone", "⚠ SCHEDULING: 1-to-1 slot generation"],
  ["private_bookings", "timezone", "display on a confirmed lesson"],
  ["interest_registrations", "timezone", "captured from the browser at signup"],
];

let anyBad = 0;
console.log("\n=== READ-ONLY. No writes are performed by this script. ===\n");

for (const [table, column, note] of TARGETS) {
  /**
   * ⚠ CAST THROUGH unknown. The typed client cannot know the shape of a column
   * name built at runtime, and its inferred ParserError type is not assignable
   * to anything useful. The cast is honest here — this loop deliberately walks
   * a list of (table, column) pairs — and it keeps `npm run typecheck` green,
   * which matters because tsconfig.scripts.json is the only thing checking
   * this file at all.
   */
  const r = (await svc.from(table).select(`id,${column}`)) as unknown as {
    data: Record<string, unknown>[] | null;
    error: { code?: string; message: string } | null;
  };
  if (r.error) {
    console.log(`  ${table}.${column}: UNREADABLE (${r.error.code}: ${r.error.message.slice(0, 60)})`);
    continue;
  }
  const rows = r.data ?? [];
  const tally: Record<Verdict, number> = { ok: 0, remapped: 0, rejected: 0, empty: 0 };
  const offenders: string[] = [];
  const distinct = new Map<string, number>();

  for (const row of rows) {
    const raw = typeof row[column] === "string" ? (row[column] as string) : null;
    const { verdict, resolved } = classify(raw);
    tally[verdict]++;
    if (raw) distinct.set(raw, (distinct.get(raw) ?? 0) + 1);
    if (verdict === "remapped" || verdict === "rejected") {
      anyBad++;
      offenders.push(`id=${String(row.id).slice(0, 8)} "${raw}" -> ${resolved ?? "REJECTED BY Intl"}`);
    }
  }

  const flag = tally.remapped + tally.rejected > 0 ? "  ⚠⚠" : "";
  console.log(`  ${table}.${column}${flag}`);
  console.log(`      ${note}`);
  console.log(`      ${rows.length} row(s): ok ${tally.ok} · REMAPPED ${tally.remapped} · rejected ${tally.rejected} · empty/null ${tally.empty}`);
  if (distinct.size) {
    console.log(`      distinct values: ${[...distinct.entries()].map(([v, n]) => `"${v}"×${n}`).join(", ")}`);
  }
  for (const o of offenders) console.log(`      ⚠ ${o}`);
  console.log("");
}

console.log(anyBad === 0
  ? "RESULT: no stored timezone value is an abbreviation. Nothing to migrate."
  : `RESULT: ⚠ ${anyBad} stored value(s) would resolve to the wrong zone.`);
console.log("\n(Read-only: this script issued SELECTs and nothing else.)");
