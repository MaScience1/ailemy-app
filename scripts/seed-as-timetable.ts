/**
 * Seed the AS cohort's real timetable. ONE TIME, AGAINST PRODUCTION.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/seed-as-timetable.ts
 *   node … scripts/seed-as-timetable.ts --verify-only
 *
 * ============================================================================
 * ⚠ THIS REPLACES THE CODE FALLBACK WITH DATABASE TRUTH
 * ============================================================================
 * src/lib/schedule/fallback.ts has been serving this exact timetable since
 * Phase 3. Once these rows exist the reader prefers the database and the
 * fallback stops being consulted — so the two MUST agree, and this script
 * derives its values from fallback.ts rather than retyping them. If they ever
 * disagree the run refuses: a seed that silently published different hours from
 * the ones the site has been showing is the worst possible outcome.
 *
 * ⚠ IT REFUSES TO OVERWRITE. If the cohort already has schedule rows it stops
 * and prints them. An UPDATE dressed as a seed is how a published lesson time
 * changes without anyone deciding to.
 *
 * ⚠ ONBOARDING FINALLY GETS ITS HOUR. §10 gave the DATE (Sunday 13 September
 * 2026) and no time, so Phase 3 deliberately left it out — the engine drops an
 * untimed one-off rather than rendering it at midnight. The founder has now
 * supplied 19:00–21:30, so it becomes a real session.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { fallbackRules, AS_COHORT_SLUG } from "../src/lib/schedule/fallback.ts";
import { zonedTimeToInstant, CANONICAL_TZ } from "../src/lib/schedule/timezone.ts";

/** The founder's instruction, transcribed, reconciled against fallback.ts below. */
const SPEC = {
  tuesday:  { weekday: 2 as const, start: "19:00", end: "21:30" },
  saturday: { weekday: 6 as const, start: "19:00", end: "21:30" },
  validFrom: "2026-09-15",
  validUntil: "2027-05-21",
  onboarding: {
    date: "2026-09-13", start: "19:00", end: "21:30",
    kind: "onboarding" as const, title: "Onboarding & diagnostics",
  },
  timezone: CANONICAL_TZ,
};

const env = new Map<string, string>();
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const t = l.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env.set(t.slice(0, i).trim(), v);
}
const O = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, O);
const anon = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")!, O);

let fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  if (!c) fail++;
  console.log(`  ${c ? "✓" : "✗"} ${n}${got !== undefined ? `\n      ${typeof got === "string" ? got : JSON.stringify(got)}` : ""}`);
};
/**
 * ⚠ THE EXPLICIT TYPE ANNOTATION IS REQUIRED, NOT STYLE. TypeScript only
 * narrows after a never-returning call when the callee's name carries an
 * explicit type annotation. Without it, `if (!startsAt) stop(...)` does not
 * teach the checker that startsAt is non-null afterwards — which is exactly
 * what tsc reported here.
 */
const stop: (why: string) => never = (why) => {
  console.error(`\nREFUSED — ${why}\nNothing was written.`);
  process.exit(1);
};
const VERIFY_ONLY = process.argv.includes("--verify-only");

// ── 1. THE INSTRUCTION AND THE SHIPPED FALLBACK MUST AGREE ─────────────────
console.log("── 1. RECONCILE AGAINST THE TIMETABLE THE SITE ALREADY SHOWS ──");
const shipped = fallbackRules(AS_COHORT_SLUG);
for (const [name, want] of [["Tuesday", SPEC.tuesday], ["Saturday", SPEC.saturday]] as const) {
  const r = shipped.find((x) => x.weekday === want.weekday);
  if (!r) stop(`fallback.ts has no ${name} rule — the instruction and the shipped site disagree`);
  t(`${name}: ${want.start}–${want.end}`, r.startTime === want.start && r.endTime === want.end, `${r.startTime}–${r.endTime}`);
  t(`  timezone ${SPEC.timezone}`, r.timezone === SPEC.timezone, r.timezone);
  t(`  window ${SPEC.validFrom} → ${SPEC.validUntil}`,
    r.validFrom === SPEC.validFrom && r.validUntil === SPEC.validUntil, `${r.validFrom} → ${r.validUntil}`);
}
if (fail > 0) stop(`${fail} disagreement(s) between the instruction and fallback.ts`);

// ── 2. RESOLVE THE COHORT ──────────────────────────────────────────────────
console.log("\n── 2. THE COHORT ─────────────────────────────────────────────");
const c = await svc.from("cohorts").select("id,slug,title,is_public").eq("slug", AS_COHORT_SLUG).maybeSingle();
if (c.error) stop(c.error.message);
if (!c.data) stop(`no cohort with slug ${AS_COHORT_SLUG}`);
const COHORT = c.data as { id: string; title: string; is_public: boolean };
t(`${COHORT.title}`, true, COHORT.id);
t("it is public, so its timetable will be publicly readable", COHORT.is_public === true, COHORT.is_public);
if (!COHORT.is_public) stop("the cohort is not public — seeding its timetable would publish nothing");

// ── 3. REFUSE TO OVERWRITE ─────────────────────────────────────────────────
console.log("\n── 3. NOTHING IS BEING OVERWRITTEN ───────────────────────────");
const existing = await svc.from("cohort_schedules").select("id,weekday,start_time").eq("cohort_id", COHORT.id);
if (existing.error) stop(existing.error.message);
if (!VERIFY_ONLY && (existing.data ?? []).length > 0) {
  stop(`this cohort already has ${(existing.data ?? []).length} schedule row(s): ${JSON.stringify(existing.data)}\n` +
       `  If you meant to re-check rather than re-seed, pass --verify-only.`);
}
t(VERIFY_ONLY ? "rows present (verify-only)" : "no schedule rows yet", true, `${(existing.data ?? []).length} existing`);

// ── 4. WRITE ───────────────────────────────────────────────────────────────
console.log("\n── 4. WRITE (service role) ───────────────────────────────────");
if (!VERIFY_ONLY) {
  const rules = [SPEC.tuesday, SPEC.saturday].map((r) => ({
    id: randomUUID(), cohort_id: COHORT.id, weekday: r.weekday,
    start_time: r.start, end_time: r.end, timezone: SPEC.timezone,
    valid_from: SPEC.validFrom, valid_until: SPEC.validUntil,
    label: null, is_active: true,
  }));
  const ri = await svc.from("cohort_schedules").insert(rules).select("id,weekday");
  if (ri.error) stop(ri.error.message);
  for (const r of (ri.data ?? []) as { id: string; weekday: number }[]) {
    console.log(`    rule    ${r.id}  weekday ${r.weekday}`);
  }

  // ⚠ RESOLVED THROUGH THE ZONE, NOT ASSUMED. 19:00 Asia/Qatar on 2026-09-13.
  const startsAt = zonedTimeToInstant(SPEC.onboarding.date, SPEC.onboarding.start, SPEC.timezone);
  const endsAt = zonedTimeToInstant(SPEC.onboarding.date, SPEC.onboarding.end, SPEC.timezone);
  if (!startsAt || !endsAt) stop("could not resolve the onboarding times");
  const oid = randomUUID();
  const oi = await svc.from("tuition_sessions").insert({
    id: oid, cohort_id: COHORT.id, schedule_id: null,
    occurs_on: SPEC.onboarding.date, status: "scheduled", kind: SPEC.onboarding.kind,
    title: SPEC.onboarding.title, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
    timezone: SPEC.timezone, note: null,
  });
  if (oi.error) stop(oi.error.message);
  console.log(`    one-off ${oid}  ${SPEC.onboarding.date}  ${startsAt.toISOString()} → ${endsAt.toISOString()}`);
} else {
  console.log("    (verify-only — nothing written)");
}

// ── 5. VERIFY AS anon ──────────────────────────────────────────────────────
console.log("\n── 5. WHAT AN ANONYMOUS VISITOR NOW READS ────────────────────");
const ar = await anon.from("cohort_schedules")
  .select("weekday,start_time,end_time,timezone,valid_from,valid_until,is_active")
  .eq("cohort_id", COHORT.id).order("weekday");
if (ar.error) stop(`anon read failed: ${ar.error.code}: ${ar.error.message}`);
t("anon sees exactly 2 recurring rules", (ar.data ?? []).length === 2, ar.data);
const days = (ar.data ?? []).map((r: any) => r.weekday);
t("…Tuesday (2) and Saturday (6)", days.join() === "2,6", days);
t("…19:00:00–21:30:00 Asia/Qatar, active",
  (ar.data ?? []).every((r: any) => r.start_time === "19:00:00" && r.end_time === "21:30:00"
    && r.timezone === CANONICAL_TZ && r.is_active === true), ar.data);
t("…window 2026-09-15 → 2027-05-21",
  (ar.data ?? []).every((r: any) => r.valid_from === "2026-09-15" && r.valid_until === "2027-05-21"));

const ao = await anon.from("tuition_sessions")
  .select("occurs_on,kind,title,starts_at,ends_at,status").eq("cohort_id", COHORT.id);
t("anon sees the onboarding one-off", (ao.data ?? []).length === 1, ao.data);
const ob = (ao.data ?? [])[0] as any;
if (ob) {
  t(`  ${SPEC.onboarding.title}, kind ${SPEC.onboarding.kind}`,
    ob.title === SPEC.onboarding.title && ob.kind === SPEC.onboarding.kind, { title: ob.title, kind: ob.kind });
  t("  19:00 Doha = 16:00Z", new Date(ob.starts_at).toISOString() === "2026-09-13T16:00:00.000Z", ob.starts_at);
  t("  21:30 Doha = 18:30Z", new Date(ob.ends_at).toISOString() === "2026-09-13T18:30:00.000Z", ob.ends_at);
}

// ⚠ Y11 AND Y10 MUST STILL HAVE NOTHING.
console.log("\n── 6. Y11 AND Y10 REMAIN UNPUBLISHED (§11, §12) ──────────────");
for (const slug of ["igcse-chemistry-y11", "igcse-chemistry-y10"]) {
  const row = await svc.from("cohorts").select("id").eq("slug", slug).maybeSingle();
  const id = (row.data as any)?.id;
  const r = await anon.from("cohort_schedules").select("id").eq("cohort_id", id ?? "");
  const s = await anon.from("tuition_sessions").select("id").eq("cohort_id", id ?? "");
  t(`${slug}: no rules, no sessions`,
    (r.data ?? []).length === 0 && (s.data ?? []).length === 0,
    { rules: (r.data ?? []).length, sessions: (s.data ?? []).length });
}

console.log(`\n${fail === 0 ? "SEEDED — ALL CHECKS PASS" : "FAILURES"} — ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
