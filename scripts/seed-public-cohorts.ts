/**
 * Seed the three public tuition cohorts. ONE TIME, AGAINST PRODUCTION.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/seed-public-cohorts.ts
 *
 * ============================================================================
 * ⚠ THE FIGURES ARE THE FOUNDER'S, AND THEY ARE CHECKED TWICE BEFORE ANY WRITE
 * ============================================================================
 * SPEC below is transcribed from the founder's instruction verbatim. The row
 * VALUES are derived from FALLBACK_COHORTS. Neither is trusted alone: the two
 * are reconciled field by field and the script REFUSES TO WRITE if they
 * disagree anywhere. A seed that transcribed the numbers a third time would be
 * a third chance to publish a wrong price; a seed that trusted the catalogue
 * blindly could not notice the catalogue drifting from the instruction.
 *
 * ⚠ IT REFUSES TO OVERWRITE. If any of the three slugs already exists it stops
 * and prints what it found. `cohorts.slug` is UNIQUE, so a second run cannot
 * duplicate them — but an UPDATE dressed as a seed is how a live price changes
 * without anyone deciding to change it.
 *
 * ⚠ ON THE TWO NOT NULL DATE COLUMNS — READ THIS
 * 0009 built `cohorts` for one dated 12-week intensive, so starts_on and
 * ends_on are NOT NULL. Two of these three cohorts are demand-triggered and
 * have NO published dates, and inventing a first-class date for them is
 * exactly the promise this codebase exists to avoid making. What protects us
 * today is that the homepage renders dates only when onboarding_on AND
 * starts_on are both present:
 *
 *     {cohort.onboardingOn && cohort.firstClassOn && ( … )}   src/app/page.tsx
 *
 * Y11 and Y10 get onboarding_on = NULL, so nothing renders whatever starts_on
 * holds. That is INCIDENTAL PROTECTION, not a guarantee: it rests on an `&&`.
 * So their starts_on/ends_on are set to ACADEMIC YEAR BOUNDARIES (1 Sep – 30
 * Jun), which read as a term, never as a timetabled class. If a future screen
 * renders starts_on alone, those two need real dates or a nullable column
 * before it ships.
 *
 * AS gets its real published first class, 2026-09-15, which the catalogue
 * already publishes. Its ends_on is the academic year end and is rendered
 * nowhere.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { FALLBACK_COHORTS, cohortFromRow, priceLabel, ctaFor } from "../src/lib/public/catalogue.ts";

// ── THE FOUNDER'S INSTRUCTION, TRANSCRIBED ─────────────────────────────────
const SPEC = {
  "ial-chemistry-as-sep-2026": {
    priceLabel: "£169/month", hoursPerWeek: 4, seatCap: 20, status: "interest",
    scheduleSummary: "Tuesday + Saturday · 7:00–9:30 PM Doha · 2 hours teaching + short break",
    onboardingOn: "2026-09-13", displayOrder: 1,
    startsOn: "2026-09-15", endsOn: "2027-06-30",
  },
  "igcse-chemistry-y11": {
    priceLabel: "£149/month", hoursPerWeek: 4, seatCap: 20, status: "interest",
    scheduleSummary: null, onboardingOn: null, displayOrder: 2,
    startsOn: "2026-09-01", endsOn: "2027-06-30",
  },
  "igcse-chemistry-y10": {
    priceLabel: "£139/month", hoursPerWeek: 3, seatCap: 20, status: "interest",
    scheduleSummary: null, onboardingOn: null, displayOrder: 3,
    startsOn: "2026-09-01", endsOn: "2027-06-30",
  },
} as const;

const env = new Map<string, string>();
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const t = l.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env.set(t.slice(0, i).trim(), v);
}
const o = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, o);
const anon = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")!, o);

let fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  console.log(`  ${c ? "✓" : "✗"} ${n}${got !== undefined ? `\n      ${typeof got === "string" ? got : JSON.stringify(got)}` : ""}`);
  if (!c) fail++;
};
const stop = (why: string): never => { console.error(`\nREFUSED — ${why}\nNothing was written.`); process.exit(1); };

/** After the one-time insert, the verification half still needs to be runnable. */
const VERIFY_ONLY = process.argv.includes("--verify-only");

// ── 1. RECONCILE THE INSTRUCTION AGAINST THE CATALOGUE ─────────────────────
console.log("── 1. THE INSTRUCTION AND THE CATALOGUE MUST AGREE ───────────");
for (const [slug, want] of Object.entries(SPEC)) {
  const c = FALLBACK_COHORTS.find((x) => x.slug === slug);
  if (!c) stop(`the catalogue has no cohort with slug ${slug}`);
  t(`${slug}: price ${want.priceLabel}`, priceLabel(c!) === want.priceLabel, priceLabel(c!));
  t(`  hours ${want.hoursPerWeek}`, c!.hoursPerWeek === want.hoursPerWeek, c!.hoursPerWeek);
  t(`  cap ${want.seatCap}`, c!.seatCap === want.seatCap, c!.seatCap);
  t(`  status ${want.status}`, c!.status === want.status, c!.status);
  t(`  schedule ${want.scheduleSummary === null ? "NULL" : "as specified"}`,
    c!.scheduleSummary === want.scheduleSummary, c!.scheduleSummary);
  t(`  onboarding ${want.onboardingOn ?? "NULL"}`, c!.onboardingOn === want.onboardingOn, c!.onboardingOn);
  t(`  no enrolment_url, so the CTA is Register interest`,
    c!.enrolmentUrl === null && ctaFor(c!).kind === "interest", ctaFor(c!).label);
}
if (fail > 0) stop(`${fail} disagreement(s) between the instruction and the catalogue`);

// ── 2. REFUSE TO OVERWRITE ─────────────────────────────────────────────────
console.log("\n── 2. NOTHING IS BEING OVERWRITTEN ───────────────────────────");
const slugs = Object.keys(SPEC);
const existing = await svc.from("cohorts").select("id,slug,price_pence,is_public").in("slug", slugs);
if (existing.error) stop(existing.error.message);
if (!VERIFY_ONLY && (existing.data ?? []).length > 0) {
  stop(`these slugs already exist: ${JSON.stringify(existing.data)}\n` +
       `  If you meant to re-check rather than re-seed, pass --verify-only.`);
}
t(VERIFY_ONLY ? "the three slugs are present (verify-only)" : "none of the three slugs exists yet",
  VERIFY_ONLY ? (existing.data ?? []).length === 3 : true,
  VERIFY_ONLY ? JSON.stringify(existing.data) : slugs.join(", "));

// ── 3. INSERT ──────────────────────────────────────────────────────────────
console.log("\n── 3. INSERT (service role) ──────────────────────────────────");
const rows = slugs.map((slug) => {
  const c = FALLBACK_COHORTS.find((x) => x.slug === slug)!;
  const s = SPEC[slug as keyof typeof SPEC];
  return {
    id: randomUUID(),
    slug: c.slug, title: c.title, subject: c.subject, qualification: c.qualification,
    price_pence: c.pricePence, currency: c.currency,
    hours_per_week: c.hoursPerWeek, sessions_per_week: c.sessionsPerWeek,
    schedule_summary: c.scheduleSummary,
    onboarding_on: c.onboardingOn,
    starts_on: s.startsOn, ends_on: s.endsOn,
    seat_cap: c.seatCap, status: c.status,
    enrolment_url: c.enrolmentUrl, teacher_name: null,
    summary: c.summary, features: c.features,
    display_order: s.displayOrder,
    is_public: true,
    // ⚠ is_active IS FALSE, AND THAT IS NOT is_public's OPPOSITE. 0041: "a
    // cohort can be running (active) without being advertised." These are
    // advertised and not yet running. It also means the ONLY policy that can
    // be showing them to anon is cohorts_read_public, which is what section 4
    // then proves.
    is_active: false,
  };
});
let written: { id: string; slug: string; display_order: number }[];
if (VERIFY_ONLY) {
  const cur = await svc.from("cohorts").select("id,slug,display_order").in("slug", slugs).order("display_order");
  if (cur.error) stop(cur.error.message);
  written = (cur.data ?? []) as typeof written;
  console.log("  already present (verify-only, nothing written):");
} else {
  const ins = await svc.from("cohorts").insert(rows).select("id,slug,display_order");
  if (ins.error) stop(ins.error.message);
  written = (ins.data ?? []) as typeof written;
  console.log("  inserted:");
}
for (const r of written) console.log(`    ${r.id}  #${r.display_order}  ${r.slug}`);
t("three rows present", written.length === 3, written.length);

// ── 4. VERIFY AS anon ──────────────────────────────────────────────────────
console.log("\n── 4. WHAT AN ANONYMOUS VISITOR NOW SEES ─────────────────────");
const read = await anon.from("cohorts")
  .select("slug,title,subject,qualification,price_pence,currency,hours_per_week,sessions_per_week," +
          "schedule_summary,onboarding_on,starts_on,seat_cap,status,enrolment_url,summary,features,display_order")
  .eq("is_public", true)
  .order("display_order", { ascending: true });
if (read.error) stop(`anon read failed: ${read.error.code}: ${read.error.message}`);
const seen = (read.data ?? []) as unknown as Record<string, unknown>[];
t("anon sees EXACTLY 3 cohorts", seen.length === 3, seen.length);
t("…and they are the three seeded, in display_order",
  seen.map((r) => r.slug).join() === slugs.join(), seen.map((r) => r.slug));

console.log("\n  figures echoed back from the database read:");
for (const raw of seen) {
  const m = cohortFromRow(raw);
  if (!m.ok) { t(`${raw.slug} maps to a Cohort`, false, m.reason); continue; }
  const c = m.value, want = SPEC[c.slug as keyof typeof SPEC];
  console.log(`    ${c.title}`);
  console.log(`      ${priceLabel(c)} · ${c.hoursPerWeek} live hrs/week · ${c.sessionsPerWeek} sessions · cap ${c.seatCap} · ${c.status} · CTA "${ctaFor(c).label}"`);
  console.log(`      schedule: ${c.scheduleSummary === null ? "NULL (no published timetable)" : c.scheduleSummary}`);
  console.log(`      onboarding: ${c.onboardingOn ?? "NULL"} · first class: ${c.firstClassOn ?? "NULL"}`);
  t(`  ${c.slug}: price is ${want.priceLabel} verbatim`, priceLabel(c) === want.priceLabel, priceLabel(c));
  t(`  ${c.slug}: hours ${want.hoursPerWeek}`, c.hoursPerWeek === want.hoursPerWeek, c.hoursPerWeek);
  t(`  ${c.slug}: cap ${want.seatCap}`, c.seatCap === want.seatCap, c.seatCap);
  t(`  ${c.slug}: status ${want.status}`, c.status === want.status, c.status);
  t(`  ${c.slug}: schedule matches exactly`, c.scheduleSummary === want.scheduleSummary, c.scheduleSummary);
  t(`  ${c.slug}: CTA is Register interest, never a dead Enrol`, ctaFor(c).kind === "interest", ctaFor(c).label);
  // ⚠ EVERY FIELD EXCEPT firstClassOn, AND THE EXCEPTION IS NOT A LOOSENING.
  // starts_on is NOT NULL (0009), so a cohort with no published first class
  // CANNOT round-trip that column — the catalogue says null and the database
  // is forbidden from storing one. Comparing it would fail forever and teach
  // us to ignore this check. It is asserted separately below instead, against
  // the thing that actually matters: what reaches the page.
  const src = FALLBACK_COHORTS.find((x) => x.slug === c.slug)!;
  const { firstClassOn: dbFirst, ...dbRest } = c;
  const { firstClassOn: catFirst, ...catRest } = src;
  t(`  ${c.slug}: round-trips identically to the catalogue (every field but firstClassOn)`,
    JSON.stringify(dbRest) === JSON.stringify(catRest),
    JSON.stringify(dbRest) === JSON.stringify(catRest) ? undefined : { db: dbRest, catalogue: catRest });
  if (catFirst === null) {
    t(`  ${c.slug}: catalogue publishes no first class; the NOT NULL column holds ${dbFirst}`,
      dbFirst === want.startsOn, dbFirst);
    t(`  ${c.slug}: …and onboarding_on is NULL, so the page renders NO date at all`,
      c.onboardingOn === null, c.onboardingOn);
  } else {
    t(`  ${c.slug}: first class ${catFirst} survives verbatim`, dbFirst === catFirst, dbFirst);
  }
}

console.log(`\n${fail === 0 ? "SEEDED — ALL CHECKS PASS" : "FAILURES"} — ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
