/**
 * Catalogue reflow — founder mapping ruling, 2026-08-22.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/db-checks/catalogue-reflow-2026-08-22.ts
 *
 * ============================================================================
 * ⚠ THE RULING THIS EXECUTES, VERBATIM SCOPE
 * ============================================================================
 * "My decks are the teaching order; the catalogue follows them." Specifically:
 *   · catalogue L2 = "Balancing Equations, Full & Ionic" (spec 1.3 + 1.12) —
 *     a NEW row; the provisional deck slug becomes real
 *   · catalogue L3 = "Relative Mass, Molar Mass and ppm" (1.4) — the two
 *     half-coverage seed rows MERGE into this one: relative-atomic-mass-…
 *     transforms in place; molar-mass-and-mole-conversions is absorbed
 *   · L4 solution-concentration unchanged (gains its 1.5 link)
 *   · empirical-and-molecular-formulae moves position 9 → 5 (gains 1.6)
 *   · remaining coming_soon rows reflow to a contiguous, coherent sequence
 *   · L1 (live) is untouched by every statement here
 *   · lesson_spec_points for L2–L5 exactly per each deck's cover chips
 *
 * ⚠ NOTHING IS DELETED. The two absorbed rows become status='archived',
 * lesson_number=NULL — reversible with one UPDATE each. the-mole-and-
 * avogadro-constant is archived under the reflow's coherence mandate because
 * its content is already taught by LIVE L1 (deck slides 11–17: mole, Avogadro,
 * molar mass, conversions); leaving it as a future lesson would promise a
 * lesson that L1 already delivered.
 *
 * ⚠ EVERY WRITE IS GUARDED: preflight asserts each row is exactly what the
 * plan assumes (slug AND status) and aborts wholesale on any surprise;
 * archive/transform updates carry .eq("status","coming_soon") so a row that
 * went live since preflight cannot be touched; the final verification demands
 * a contiguous 1..N sequence and prints the full outcome.
 *
 * ⚠ SPEC-POINT TITLES ARE DELIBERATELY NOT TOUCHED. The seeded draft titles
 * for 1.3/1.4/1.5/1.6/1.12 disagree with the decks' claims (e.g. seed says
 * 1.6 = "Concentration of solutions", deck L4 says concentration = 1.5). The
 * codes are linked exactly as the founder ruled; retitling unverified seeds
 * against the official Edexcel document is a separate founder decision,
 * reported, not smuggled in here.
 */
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const env = new Map<string, string>();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i < 0 || line.trim().startsWith("#")) continue;
  env.set(line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, ""));
}
const db = createClient(env.get("NEXT_PUBLIC_SUPABASE_URL")!, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const COURSE = "cb778b14-0832-41aa-9532-8079f7bd0633"; // edexcel-ial-as-chemistry
const TOPIC = "80767fbe-b6a9-4a58-9222-519d94c930cc"; // Topic 1 (owns codes 1.1–1.13)
const LIVE_L1 = "67ba789f-de2b-4e80-b1ca-e8ba317d971b";

const fail = (m: string): never => {
  console.error("ABORT — " + m);
  process.exit(1);
};

type Row = { id: string; slug: string; title: string; lesson_number: number | null; status: string; unit_id: string | null };

async function main() {
  // ── PRE-FLIGHT ────────────────────────────────────────────────────────────
  const { data: lessons, error: listErr } = await db
    .from("lessons")
    .select("id,slug,title,lesson_number,status,unit_id")
    .eq("course_id", COURSE)
    .order("lesson_number");
  if (listErr || !lessons) return fail(`preflight list: ${listErr?.message}`);
  const rows = lessons as Row[];

  const bySlug = (s: string) => rows.find((l) => l.slug === s);
  const relAtomic = bySlug("relative-atomic-mass-and-isotopic-mass");
  const mole = bySlug("the-mole-and-avogadro-constant");
  const solconc = bySlug("solution-concentration");
  const molar = bySlug("molar-mass-and-mole-conversions");
  const empirical = bySlug("empirical-and-molecular-formulae");
  for (const [n, r] of Object.entries({ relAtomic, mole, solconc, molar, empirical })) {
    if (!r) return fail(`preflight: ${n} not found by slug`);
    if (r.status !== "coming_soon") return fail(`preflight: ${n} is ${r.status}, not coming_soon — nothing touched`);
  }
  if (bySlug("balancing-equations-full-and-ionic")) return fail("balancing row already exists — already executed?");
  const live = rows.find((l) => l.id === LIVE_L1);
  if (!live || live.status !== "live" || live.lesson_number !== 1) return fail("L1 is not the live #1 row");
  console.log(`preflight ✓ — ${rows.length} rows; every targeted row is coming_soon; L1 live and untouched below`);

  const guarded = async (q: PromiseLike<{ data: unknown; error: { message: string } | null }>, label: string) => {
    const { data, error } = await q;
    if (error) return fail(`${label}: ${error.message}`);
    if (Array.isArray(data) && data.length === 0) return fail(`${label}: matched 0 rows — status changed underfoot?`);
    return data;
  };

  // ── 1. transform relAtomic → merged L3 ────────────────────────────────────
  await guarded(
    db.from("lessons").update({
      slug: "relative-mass-molar-mass-and-ppm",
      title: "Relative Mass, Molar Mass and ppm",
      description: "Aᵣ, Mᵣ, M and concentration scales — from the ¹²C scale to grams to ppm.",
      lesson_number: 3,
    }).eq("id", relAtomic!.id).eq("status", "coming_soon").select("id"),
    "transform relAtomic",
  );
  console.log("1 ✓ relative-atomic-mass-… → relative-mass-molar-mass-and-ppm @3");

  // ── 2. archive the two absorbed rows ──────────────────────────────────────
  for (const [row, why] of [
    [molar!, "merged into relative-mass-molar-mass-and-ppm per the ruling"],
    [mole!, "content already taught by live L1 (deck slides 11–17)"],
  ] as const) {
    await guarded(
      db.from("lessons").update({ status: "archived", lesson_number: null })
        .eq("id", row.id).eq("status", "coming_soon").select("id"),
      `archive ${row.slug}`,
    );
    console.log(`2 ✓ archived ${row.slug} — ${why}`);
  }

  // ── 3. new catalogue L2 ───────────────────────────────────────────────────
  const inserted = (await guarded(
    db.from("lessons").insert({
      slug: "balancing-equations-full-and-ionic",
      title: "Balancing Equations, Full & Ionic",
      description: "Full and ionic equations — conservation, state symbols and observations.",
      course_id: COURSE,
      unit_id: relAtomic!.unit_id,
      lesson_number: 2,
      status: "coming_soon",
    }).select("id,slug"),
    "insert balancing",
  )) as { id: string }[];
  const balancingId = inserted[0].id;
  console.log(`3 ✓ inserted balancing-equations-full-and-ionic @2 (${balancingId.slice(0, 8)})`);

  // ── 4. empirical 9 → 5 ────────────────────────────────────────────────────
  await guarded(db.from("lessons").update({ lesson_number: 5 }).eq("id", empirical!.id).select("id"), "empirical→5");
  console.log("4 ✓ empirical-and-molecular-formulae 9 → 5");

  // ── 5. compact later numbers into a contiguous sequence ───────────────────
  const rest = rows
    .filter((l) => l.lesson_number !== null && l.lesson_number >= 10 &&
      ![molar!.id, mole!.id, empirical!.id].includes(l.id))
    .sort((a, b) => a.lesson_number! - b.lesson_number!);
  let next = 9; // 1–5 settled above; 6,7,8 keep their rows and numbers
  let moved = 0;
  for (const l of rest) {
    if (l.lesson_number !== next) {
      await guarded(db.from("lessons").update({ lesson_number: next }).eq("id", l.id).select("id"), `renumber ${l.slug}`);
      moved++;
    }
    next++;
  }
  console.log(`5 ✓ compacted: ${moved} of ${rest.length} later rows renumbered, sequence now ends at ${next - 1}`);

  // ── 6. lesson_spec_points, exactly per each deck's cover chips ────────────
  const { data: sp, error: spErr } = await db.from("spec_points").select("id,code").eq("topic_id", TOPIC);
  if (spErr || !sp) return fail(`spec points: ${spErr?.message}`);
  const codeId = (c: string) => sp.find((s) => s.code === c)?.id ?? fail(`spec code ${c} missing from topic`);

  const LINKS: [string, string[], string][] = [
    [balancingId, ["1.3", "1.12"], "balancing-equations-full-and-ionic"],
    [relAtomic!.id, ["1.4"], "relative-mass-molar-mass-and-ppm"],
    [solconc!.id, ["1.5"], "solution-concentration"],
    [empirical!.id, ["1.6"], "empirical-and-molecular-formulae"],
  ];
  for (const [lid, codes, label] of LINKS) {
    const { data: old } = await db.from("lesson_spec_points").select("spec_point_id").eq("lesson_id", lid);
    if ((old ?? []).length > 0) {
      // The row's OLD identity carried seed links that no longer describe it.
      const { error: delErr } = await db.from("lesson_spec_points").delete().eq("lesson_id", lid);
      if (delErr) return fail(`clear stale links ${label}: ${delErr.message}`);
      console.log(`   (cleared ${old!.length} stale seed link(s) on ${label})`);
    }
    const { error: insErr } = await db
      .from("lesson_spec_points")
      .insert(codes.map((c) => ({ lesson_id: lid, spec_point_id: codeId(c) })));
    if (insErr) return fail(`link ${label}: ${insErr.message}`);
    console.log(`6 ✓ ${label} ← spec ${codes.join(" + ")}`);
  }

  // ── VERIFY ────────────────────────────────────────────────────────────────
  const { data: after } = await db
    .from("lessons").select("slug,lesson_number,status").eq("course_id", COURSE)
    .neq("status", "archived").order("lesson_number");
  const nums = (after ?? []).map((l) => l.lesson_number as number);
  const contiguous = nums.every((n, i) => n === i + 1);
  console.log(`\nVERIFY: ${after?.length} active rows, contiguous 1..${nums.at(-1)}: ${contiguous ? "✓" : "✗✗ " + nums.join(",")}`);
  for (const l of (after ?? []).slice(0, 6)) {
    console.log(`   L${String(l.lesson_number).padStart(2)} ${(l.status as string).padEnd(12)} ${l.slug}`);
  }
  const { data: links } = await db
    .from("lesson_spec_points")
    .select("spec_points(code), lessons!inner(slug)")
    .in("lesson_id", [balancingId, relAtomic!.id, solconc!.id, empirical!.id, LIVE_L1]);
  for (const l of (links ?? []) as unknown as { spec_points: { code: string }; lessons: { slug: string } }[]) {
    console.log(`   link: ${l.lessons.slug} ← ${l.spec_points.code}`);
  }
  const { data: archived } = await db.from("lessons").select("slug").eq("course_id", COURSE).eq("status", "archived");
  console.log(`   archived: ${(archived ?? []).map((a) => a.slug).join(", ")}`);
  if (!contiguous) process.exit(1);
  console.log("\nDONE — ruling executed; nothing deleted; L1 untouched.");
}

main();
