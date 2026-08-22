/**
 * Live defect 2026-08-23: family approval does not persist (panel reverts to
 * draft, lesson_family_status stays empty). This replays saveStatus()'s EXACT
 * write path against the live database with the same client shape the app
 * uses (service key, PostgREST), so the error — if the DB path is the fault —
 * is observed, not guessed.
 *
 * Steps, each with the observed result printed:
 *   1. lessons lookup by L1 slug (saveStatus step 1)
 *   2. upsert a PROBE row: probe-namespaced family_key, real lesson_id,
 *      onConflict family_key — byte-identical call shape to registry.ts
 *   3. read the row back (what loadStatuses would see)
 *   4. upsert again with a different status (the UPDATE arm of the upsert)
 *   5. cleanup: DELETE by the captured probe key (only what this run created)
 *
 * ⚠ PROBE KEY ONLY. No real family key is written: approval is the founder's
 * ruling (§67) and a diagnostic must not flip a real family's status.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i < 0 || line.trim().startsWith("#")) continue;
  env.set(line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, ""));
}
const svc = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const err = (e: { code?: string; message?: string } | null) =>
  e ? `${e.code ?? "?"}: ${e.message}` : "no error";

// Probe key conforms to the 0064 shape CHECK on purpose — this probes the
// PIPE, not the constraint (the constraint is checked separately from code).
const probeKey = `probe-diag-${Date.now()}`;
let created = false;

try {
  // 1. the lessons lookup, exactly as saveStatus does it
  const { data: lesson, error: le } = await svc
    .from("lessons").select("id").eq("slug", "definitions-formulae-and-the-mole").maybeSingle();
  console.log(`1. lessons lookup: ${le ? "ERROR " + err(le) : lesson ? `id=${lesson.id}` : "NULL — would take the silent JSON fallback"}`);
  if (!lesson) process.exit(1);

  // 2. the upsert, byte-identical call shape to registry.ts saveStatus
  const { error: upErr } = await svc.from("lesson_family_status").upsert(
    { family_key: probeKey, lesson_id: lesson.id, status: "draft" },
    { onConflict: "family_key" },
  );
  console.log(`2. upsert (INSERT arm): ${err(upErr)}`);
  if (!upErr) created = true;
  if (upErr) {
    console.log(`   → PGRST205 = schema cache; 42501 = grants; 23514 = key-shape CHECK`);
    process.exit(1);
  }

  // 3. read back — what loadStatuses sees
  const { data: row, error: rdErr } = await svc
    .from("lesson_family_status").select("family_key, status, lesson_id").eq("family_key", probeKey).maybeSingle();
  console.log(`3. read-back: ${rdErr ? "ERROR " + err(rdErr) : row ? `status=${row.status} — THE ROW LANDED` : "NO ROW — write claimed success but nothing landed"}`);

  // 4. the UPDATE arm of the upsert (a real status change goes through this)
  const { error: up2Err } = await svc.from("lesson_family_status").upsert(
    { family_key: probeKey, lesson_id: lesson.id, status: "disabled" },
    { onConflict: "family_key" },
  );
  const { data: row2 } = await svc
    .from("lesson_family_status").select("status").eq("family_key", probeKey).maybeSingle();
  console.log(`4. upsert (UPDATE arm): ${err(up2Err)} → status now ${row2?.status ?? "MISSING"}`);

  console.log(`\nVERDICT: ${!upErr && row && row2?.status === "disabled"
    ? "DB write path is HEALTHY end to end — the defect is in the app layer above it"
    : "DB write path FAULTY — see the error above"}`);
} finally {
  if (created) {
    const { error: delErr } = await svc.from("lesson_family_status").delete().eq("family_key", probeKey);
    console.log(`cleanup: probe row ${probeKey} ${delErr ? "⚠⚠ LEFT BEHIND: " + err(delErr) : "deleted"}`);
  }
}
