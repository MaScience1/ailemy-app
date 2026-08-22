/**
 * Every registered family module, proven against ITS OWN deck (§99–§101 for
 * lessons beyond the pilot).
 *
 * ============================================================================
 * ⚠ THIS SUITE DISCOVERS ITS WORK — a module added without tests is tested
 * ============================================================================
 * It globs src/lib/practice/families/*.ts, dynamically imports each module's
 * FAMILIES, loads the matching deck bundle, and runs the boundary + shape +
 * verify checks. Adding a families file makes it covered HERE with no edit;
 * removing a deck bundle makes its families' grounding UNPROVABLE and the
 * suite says so rather than passing on nothing.
 *
 * ⚠ TAUGHT CODES ARE DERIVED, NOT TYPED. For lessons the catalogue has not
 * mapped yet, the boundary comes from the deck's own REPEATED header chips —
 * a code on ≥5 slides is being taught; a code on one closing slide is a
 * pointer. The pilot lesson's catalogue mapping (1.1, 1.2) is asserted to
 * agree with this derivation, which keeps the heuristic itself honest.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { buildAttempt, familyWithinBoundary, buildSourcePack, type Family, type FamilyStatus } from "../../../src/lib/practice/engine.ts";
import { parseManifest } from "../../../src/lib/lesson-deck/manifest.ts";

const FAM_DIR = join(process.cwd(), "src", "lib", "practice", "families");
const DECKS = join(process.cwd(), "content", "decks");
if (!existsSync(DECKS)) {
  console.log("SKIPPED — no deck bundles (grounding is unprovable without the decks).");
  process.exit(2);
}

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const moduleFiles = readdirSync(FAM_DIR).filter((f) => f.endsWith(".ts"));
console.log(`\n=== ${moduleFiles.length} family module(s) discovered ===`);
t("at least the pilot module exists", moduleFiles.includes("definitions-formulae-and-the-mole.ts"));

function derivedTaughtCodes(manifest: { slides: { specCodes: string[] }[] }): string[] {
  const counts = new Map<string, number>();
  for (const s of manifest.slides) {
    for (const c of s.specCodes) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= 5).map(([c]) => c).sort();
}

for (const file of moduleFiles) {
  const slug = file.replace(/\.ts$/, "");
  console.log(`\n── ${slug} ──`);
  const mod = (await import(join(FAM_DIR, file))) as { FAMILIES?: Family[] };
  const families = mod.FAMILIES;
  if (!families || families.length === 0) {
    t(`${slug}: exports FAMILIES`, false, "no FAMILIES export");
    continue;
  }

  const bundle = join(DECKS, slug, "v1", "manifest.json");
  if (!existsSync(bundle)) {
    t(`${slug}: deck bundle exists — grounding is provable`, false,
      `no bundle at content/decks/${slug}/v1 — families cannot be verified against their source`);
    continue;
  }
  const verdict = parseManifest(JSON.parse(readFileSync(bundle, "utf8")));
  if (!verdict.ok) {
    t(`${slug}: manifest parses`, false, verdict.reason);
    continue;
  }
  const taught = derivedTaughtCodes(verdict.manifest);
  if (slug === "definitions-formulae-and-the-mole") {
    t("pilot: derived taught codes agree with the catalogue mapping (1.1, 1.2) — the heuristic itself is checked",
      JSON.stringify(taught) === JSON.stringify(["1.1", "1.2"]), taught.join(","));
  }
  const pack = buildSourcePack(verdict.manifest, taught);
  const statuses: Record<string, FamilyStatus> =
    Object.fromEntries(families.map((f) => [f.key, "approved"]));

  for (const f of families) {
    const v = familyWithinBoundary(f, pack);
    t(`${f.key} servable within its deck`, v.servable, v.servable ? "" : v.reason);
  }

  // 50 seeds through the full generation gauntlet — §99 shape + every
  // numerical verify() at birth. A throw is a red with the seed named.
  let bad = "";
  for (let seed = 1; seed <= 50 && !bad; seed++) {
    try {
      const a = buildAttempt({ families, statuses, pack, seed });
      for (const q of a.questions) {
        if (q.options.length !== 4 || new Set(q.options).size !== 4) bad = `seed ${seed}: ${q.familyKey} options`;
        if (!q.options[q.correctIndex]) bad = `seed ${seed}: ${q.familyKey} correctIndex`;
      }
    } catch (e) {
      bad = `seed ${seed}: ${String(e).slice(0, 140)}`;
    }
  }
  t(`${slug}: 50 seeds generate clean tens (verify() ran on every numerical variant)`, !bad, bad);

  const kinds = new Set(families.map((f) => f.kind));
  t(`${slug}: families span ≥3 kinds (§34)`, kinds.size >= 3, [...kinds].join(","));

  // ⚠ §100 SABOTAGE, PER LESSON: an out-of-scope family must be refused by
  // THIS lesson's own pack — proving each deck's boundary bites, not only the
  // pilot's. Kinetics content appears in none of the Unit 1 Topic 1 decks.
  const alien: Family = {
    key: `sabotage-${slug}`,
    lessonSlug: slug,
    specCode: taught[0] ?? "1.1",
    kind: "definition",
    sourceSlides: [1],
    groundingTerms: ["activation energy", "maxwell–boltzmann distribution"],
    generate: () => ({
      stem: "What does a catalyst do to the activation energy?",
      options: ["Lowers it", "Raises it", "Removes it", "Doubles it"],
      correctIndex: 0, explanation: "", wrongWhy: {}, reviewSlide: null,
    }),
  };
  const av = familyWithinBoundary(alien, pack);
  t(`${slug}: ⚠ an out-of-scope (kinetics) family is REFUSED by this deck's boundary (§100)`,
    !av.servable && av.reason.includes("never shows"),
    av.servable ? "SERVED — the boundary is not biting for this lesson" : av.reason);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
