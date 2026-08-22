/**
 * The lesson practice engine, proven against the REAL L1 deck (§99–§104).
 *
 * ============================================================================
 * ⚠ THE SOURCE PACK COMES FROM THE ACTUAL INGESTED MANIFEST, NOT A FIXTURE
 * ============================================================================
 * The repo rule: a model of production data must be DERIVED, never copied. The
 * pack here is built from content/decks/definitions-formulae-and-the-mole/v1/
 * manifest.json — the same file the app serves from. If the deck is
 * re-ingested and a slide the families cite disappears, this suite goes red
 * naming the family. No bundle on this machine → SKIPPED via exit 2, the same
 * skip channel schema-probe uses for .env.local.
 *
 * ⚠ EVERY GUARD HERE IS ALSO SABOTAGED. §100 and §101 are proven by shipping
 * a family that VIOLATES them and watching the refusal fire with the right
 * reason — a guard that has never been seen to fail has not been shown to
 * work, and one §101-shaped guard in this repo once passed vacuously for
 * exactly that lack.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ATTEMPT_SIZE,
  buildAttempt,
  buildSourcePack,
  familyWithinBoundary,
  markAttempt,
  pick,
  rng,
  shuffle,
  toServed,
  type Family,
  type FamilyStatus,
} from "../../../src/lib/practice/engine.ts";
import {
  FAMILIES,
  parseSci,
  sci,
} from "../../../src/lib/practice/families/definitions-formulae-and-the-mole.ts";
import { parseManifest } from "../../../src/lib/lesson-deck/manifest.ts";

const BUNDLE = join(process.cwd(), "content", "decks", "definitions-formulae-and-the-mole", "v1", "manifest.json");
if (!existsSync(BUNDLE)) {
  console.log("SKIPPED — no local L1 deck bundle (run scripts/lesson-ingest/ingest.py first).");
  process.exit(2);
}

let pass = 0, fail = 0;
const t = (n: string, c: boolean, got?: unknown) => {
  c ? (pass++, console.log("  ✓ " + n))
    : (fail++, console.log("  ✗ " + n + (got !== undefined ? "\n      " + String(got) : "")));
};

const verdict = parseManifest(JSON.parse(readFileSync(BUNDLE, "utf8")));
if (!verdict.ok) {
  console.log(`  ✗ manifest failed to parse: ${verdict.reason}`);
  process.exit(1);
}
const manifest = verdict.manifest;
// ⚠ 1.1 + 1.2 are the CATALOGUE's lesson_spec_points for this lesson — the
// taught boundary. The deck also mentions 1.3 on its closing slide as a
// next-lesson pointer, and section 4 proves that pointer cannot widen this.
const PACK = buildSourcePack(manifest, ["1.1", "1.2"]);
const APPROVED: Record<string, FamilyStatus> = Object.fromEntries(FAMILIES.map((f) => [f.key, "approved"]));

// ============================================================================
console.log("\n=== 0. the measuring sticks ===");
// ============================================================================
{
  t("sci formats the deck's own constant", sci(6.02e23) === "6.02 × 10²³", sci(6.02e23));
  // ⚠ sci rounds to 3 s.f. BY DESIGN (the deck's own house style), so the
  // round-trip tolerance is the 0.5% every family verifier uses — not 0.1%,
  // which failed here on 1.204 → "1.20" and correctly flagged that this
  // comment needed writing.
  t("parseSci inverts sci to within 3-s.f. rounding", Math.abs((parseSci(sci(1.204e24)) ?? 0) - 1.204e24) / 1.204e24 < 0.005,
    parseSci(sci(1.204e24)));
  t("the real manifest has 25 slides / 49 frames — the pilot's known shape",
    manifest.slideCount === 25 && manifest.frameCount === 49,
    `${manifest.slideCount}/${manifest.frameCount}`);
}

// ============================================================================
console.log("\n=== 1. every L1 family clears the boundary against the REAL deck ===");
// ============================================================================
{
  for (const f of FAMILIES) {
    const v = familyWithinBoundary(f, PACK);
    t(`${f.key} is servable`, v.servable, v.servable ? "" : v.reason);
  }
  t("there are enough families for a varied ten", FAMILIES.length >= 12, FAMILIES.length);
}

// ============================================================================
console.log("\n=== 2. attempt shape (§99) across 200 seeds ===");
// ============================================================================
{
  let allOk = true, firstBad = "";
  const kindSpread = new Set<string>();
  for (let seed = 1; seed <= 200 && allOk; seed++) {
    const a = buildAttempt({ families: FAMILIES, statuses: APPROVED, pack: PACK, seed });
    if (a.questions.length !== ATTEMPT_SIZE) { allOk = false; firstBad = `seed ${seed}: ${a.questions.length} questions`; }
    for (const q of a.questions) {
      kindSpread.add(q.kind);
      if (q.options.length !== 4) { allOk = false; firstBad = `seed ${seed}: ${q.familyKey} has ${q.options.length} options`; }
      if (new Set(q.options).size !== 4) { allOk = false; firstBad = `seed ${seed}: ${q.familyKey} duplicate options`; }
      if (!q.options[q.correctIndex]) { allOk = false; firstBad = `seed ${seed}: ${q.familyKey} bad correctIndex`; }
    }
  }
  t("⚠ 200 seeds: exactly 10 questions, 4 distinct options, valid correct index — and every numerical variant re-verified at birth (§101 runs inside buildAttempt)",
    allOk, firstBad);
  t("attempts span at least 4 question kinds (§34)", kindSpread.size >= 4, [...kindSpread].join(","));
}

// ============================================================================
console.log("\n=== 3. determinism and variation (§45, §35) ===");
// ============================================================================
{
  const a1 = buildAttempt({ families: FAMILIES, statuses: APPROVED, pack: PACK, seed: 42 });
  const a2 = buildAttempt({ families: FAMILIES, statuses: APPROVED, pack: PACK, seed: 42 });
  t("⚠ same seed → byte-identical attempt (refresh keeps the questions, marking regenerates honestly)",
    JSON.stringify(a1) === JSON.stringify(a2));

  const b = buildAttempt({ families: FAMILIES, statuses: APPROVED, pack: PACK, seed: 43 });
  const stemsA = a1.questions.map((q) => q.stem).join("|");
  const stemsB = b.questions.map((q) => q.stem).join("|");
  t("different seed → different attempt", stemsA !== stemsB);

  const orders = new Set<number>();
  for (let seed = 1; seed <= 60; seed++) {
    const a = buildAttempt({ families: FAMILIES, statuses: APPROVED, pack: PACK, seed });
    const q = a.questions.find((x) => x.familyKey === "l1-calc-moles-from-mass");
    if (q) orders.add(q.correctIndex);
  }
  t("option order varies across seeds (§99 randomised)", orders.size >= 3, [...orders].join(","));

  const served = toServed(a1);
  const leaked = JSON.stringify(served);
  t("⚠ served payload carries no correctIndex, no explanation, no wrongWhy (§103)",
    !leaked.includes("correctIndex") && !leaked.includes("explanation") && !leaked.includes("wrongWhy"));
}

// ============================================================================
console.log("\n=== 4. ⚠ SABOTAGE — the boundary and the recompute must BITE (§100, §101) ===");
// ============================================================================
{
  // A kinetics family — real chemistry, wrong lesson. Must be refused.
  const kinetics: Family = {
    key: "sabotage-kinetics",
    lessonSlug: "definitions-formulae-and-the-mole",
    specCode: "1.2",
    kind: "definition",
    sourceSlides: [6],
    groundingTerms: ["activation energy", "rate of reaction"],
    generate: () => ({
      stem: "What does a catalyst do to the activation energy?",
      options: ["Lowers it", "Raises it", "Removes it", "Doubles it"],
      correctIndex: 0, explanation: "", wrongWhy: {}, reviewSlide: null,
    }),
  };
  const kv = familyWithinBoundary(kinetics, PACK);
  t("⚠ a kinetics question is REFUSED — the lesson never shows those terms",
    !kv.servable && !kv.servable && kv.reason.includes("never shows"),
    kv.servable ? "SERVED — boundary is not biting" : kv.reason);

  // A family claiming the closing slide's 1.3 pointer. The deck MENTIONS 1.3;
  // the catalogue does not teach it here. Must be refused on spec, proving a
  // forward pointer cannot widen the boundary.
  const pointer: Family = { ...kinetics, key: "sabotage-spec-pointer", specCode: "1.3", groundingTerms: ["mole"] };
  const pv = familyWithinBoundary(pointer, PACK);
  t("⚠ spec 1.3 is REFUSED even though the deck's closing slide mentions it",
    !pv.servable && pv.reason.includes("teaches only"),
    pv.servable ? "SERVED" : pv.reason);

  // A numerical family whose labelled answer is WRONG — verify must throw it out.
  const lying: Family = {
    key: "sabotage-wrong-answer",
    lessonSlug: "definitions-formulae-and-the-mole",
    specCode: "1.2",
    kind: "calculation",
    sourceSlides: [13],
    groundingTerms: ["mole"],
    generate: () => ({
      stem: "How many atoms are in 2.0 mol of sodium? (L = 6.02 × 10²³ mol⁻¹)",
      options: ["1.20 × 10²⁴", "6.02 × 10²³", "3.01 × 10²³", "2.41 × 10²⁴"],
      correctIndex: 1, // ⚠ deliberately wrong — the answer is 1.204e24, index 0
      explanation: "", wrongWhy: {}, reviewSlide: null,
    }),
    verify: (q) => {
      const n = Number(q.stem.match(/in ([\d.]+) mol/)?.[1]);
      const got = parseSci(q.options[q.correctIndex]);
      if (!Number.isFinite(n) || got === null) return false;
      return Math.abs(got - n * 6.02e23) / (n * 6.02e23) < 0.005;
    },
  };
  let threw = "";
  try {
    buildAttempt({
      families: [lying], statuses: { [lying.key]: "approved" }, pack: PACK, seed: 7,
    });
  } catch (e) {
    threw = String(e);
  }
  t("⚠ a mislabelled numerical answer is REFUSED AT BIRTH, naming §101",
    threw.includes("DISAGREES"), threw || "was served — §101 is not biting");
}

// ============================================================================
console.log("\n=== 5. approval gate (§66, §67) ===");
// ============================================================================
{
  const allDraft: Record<string, FamilyStatus> = {};
  let refused = "";
  try {
    buildAttempt({ families: FAMILIES, statuses: allDraft, pack: PACK, seed: 1 });
  } catch (e) { refused = String(e); }
  t("⚠ all-draft families serve NOTHING to students — approval is the founder's act",
    refused.includes("no servable families"), refused || "served draft content");

  const preview = buildAttempt({ families: FAMILIES, statuses: allDraft, pack: PACK, seed: 1, includeDraft: true });
  t("…but admin preview (includeDraft) can generate", preview.questions.length === ATTEMPT_SIZE);

  const oneDisabled: Record<string, FamilyStatus> = { ...APPROVED, "l1-calc-moles-from-mass": "disabled" };
  let seen = false;
  for (let seed = 1; seed <= 80; seed++) {
    const a = buildAttempt({ families: FAMILIES, statuses: oneDisabled, pack: PACK, seed });
    if (a.questions.some((q) => q.familyKey === "l1-calc-moles-from-mass")) seen = true;
  }
  t("a disabled family never appears in 80 attempts (§63)", !seen);
}

// ============================================================================
console.log("\n=== 6. scoring (§102) and marking ===");
// ============================================================================
{
  const a = buildAttempt({ families: FAMILIES, statuses: APPROVED, pack: PACK, seed: 99 });
  const sels = a.questions.map((q, i) => (i < 7 ? q.correctIndex : (q.correctIndex + 1) % 4));
  const m = markAttempt(a, sels);
  t("7 correct of 10 → 7/10 and exactly 70 — no rounding nonsense", m.score === 7 && m.outOf === 10 && m.percent === 70,
    `${m.score}/${m.outOf} ${m.percent}%`);

  const none = markAttempt(a, a.questions.map(() => null));
  t("all-null selections mark as 0/10, not a crash", none.score === 0 && none.percent === 0);

  const perfect = markAttempt(a, a.questions.map((q) => q.correctIndex));
  t("perfect marks as 10/10, 100", perfect.score === 10 && perfect.percent === 100);

  t("marked questions carry explanation + review slide for the review UI (§50, §52)",
    m.questions.every((q) => typeof q.explanation === "string") &&
    m.questions.some((q) => q.reviewSlide !== null));
}

// ============================================================================
console.log("\n=== 7. recent-repeat avoidance (§44) ===");
// ============================================================================
{
  const first = buildAttempt({ families: FAMILIES, statuses: APPROVED, pack: PACK, seed: 11 });
  const avoid = first.questions.map((q) => q.familyKey);
  // 13 families, 10 used, 3 fresh — the avoid-list must surface all 3 fresh
  // ones before any repeat.
  const second = buildAttempt({ families: FAMILIES, statuses: APPROVED, pack: PACK, seed: 12, avoidFamilies: avoid });
  const fresh = FAMILIES.map((f) => f.key).filter((k) => !avoid.includes(k));
  const surfaced = fresh.filter((k) => second.questions.some((q) => q.familyKey === k));
  t("every family the pool held back appears in the next attempt", surfaced.length === fresh.length,
    `fresh=${fresh.length} surfaced=${surfaced.length}`);
}

// ============================================================================
console.log("\n=== 8. ⚠ THE 2026-08-23 LIVE DEFECT — thin pools and colliding stems (§35, §99) ===");
// ============================================================================
{
  /**
   * ⚠ THIS SECTION IS THE REGRESSION. On production the founder had approved
   * exactly two families, both `definition`. Filling ten meant repeating them,
   * the repeat produced a byte-identical stem, and buildAttempt THREW — so
   * "Start 10 questions" was dead for every student on every seed. The engine
   * now resamples for a fresh stem and serves an honestly-short set instead.
   */

  // ── (a) the exact production configuration, on many seeds ────────────────
  const PROD_APPROVED: Record<string, FamilyStatus> = {
    "l1-def-particle-terms": "approved",
    "l1-def-empirical-formula": "approved",
  };
  let prodThrew = "";
  let dupSeen = "";
  let minServed = Infinity;
  try {
    for (let seed = 1; seed <= 200; seed++) {
      const a = buildAttempt({ families: FAMILIES, statuses: PROD_APPROVED, pack: PACK, seed });
      minServed = Math.min(minServed, a.questions.length);
      const stems = a.questions.map((q) => q.stem);
      if (new Set(stems).size !== stems.length) dupSeen = `seed ${seed}`;
    }
  } catch (e) {
    prodThrew = String(e);
  }
  t("⚠ the two-approved-family production pool BUILDS on 200 seeds (this threw before the fix)",
    prodThrew === "", prodThrew || `min served ${minServed}`);
  t("⚠ …and never serves the same stem twice", dupSeen === "", dupSeen);
  t("…serving at least 2 questions even from the thinnest real pool", minServed >= 2, minServed);

  // ── (b) forced collision: a family with exactly ONE stem, forever ────────
  let calls = 0;
  const oneStem: Family = {
    key: "sabotage-one-stem",
    lessonSlug: "definitions-formulae-and-the-mole",
    specCode: "1.1",
    kind: "definition",
    sourceSlides: [6],
    groundingTerms: ["mole"],
    generate: (r) => {
      calls++;
      const options = shuffle(r, ["a", "b", "c", "d"]);
      return {
        stem: "THE ONLY STEM THIS FAMILY WILL EVER PRODUCE.",
        options,
        correctIndex: options.indexOf("a"),
        explanation: "", wrongWhy: {}, reviewSlide: null,
      };
    },
  };
  let soloThrew = "";
  let solo: ReturnType<typeof buildAttempt> | null = null;
  try {
    solo = buildAttempt({ families: [oneStem], statuses: { [oneStem.key]: "approved" }, pack: PACK, seed: 5 });
  } catch (e) { soloThrew = String(e); }
  t("⚠ a family that can only ever emit ONE stem does not break the attempt",
    soloThrew === "", soloThrew);
  t("…it serves exactly 1 question", solo?.questions.length === 1, solo?.questions.length);
  t("⚠ …and the RESAMPLE actually ran — generate was called repeatedly before the engine gave up",
    calls > 1, `generate called ${calls}×`);
  t("…the shortfall is REPORTED, not hidden (§62): served 1 of 10, with a reason naming approval",
    solo?.shortfall?.served === 1 && solo?.shortfall?.requested === ATTEMPT_SIZE &&
      solo.shortfall.reason.includes("approve more families"),
    JSON.stringify(solo?.shortfall));

  // ── (c) a family with a KNOWN small bank contributes all of it, once ─────
  const threeStems: Family = {
    ...oneStem,
    key: "sabotage-three-stems",
    generate: (r) => {
      const which = pick(r, ["ALPHA", "BETA", "GAMMA"]);
      const options = shuffle(r, ["a", "b", "c", "d"]);
      return {
        stem: `Bounded bank stem ${which}.`,
        options, correctIndex: options.indexOf("a"),
        explanation: "", wrongWhy: {}, reviewSlide: null,
      };
    },
  };
  const bounded = buildAttempt({
    families: [threeStems], statuses: { [threeStems.key]: "approved" }, pack: PACK, seed: 3,
  });
  t("a 3-variant family serves exactly its 3 distinct variants, no repeats",
    bounded.questions.length === 3 && new Set(bounded.questions.map((q) => q.stem)).size === 3,
    `${bounded.questions.length} served`);

  // ── (d) a colliding family beside healthy ones must not cost the ten ─────
  const mixed = buildAttempt({
    families: [...FAMILIES, oneStem],
    statuses: { ...APPROVED, [oneStem.key]: "approved" },
    pack: PACK,
    seed: 21,
  });
  t("⚠ one exhausted family does not stop a healthy pool reaching ten",
    mixed.questions.length === ATTEMPT_SIZE && mixed.shortfall === undefined,
    `${mixed.questions.length} served, shortfall=${JSON.stringify(mixed.shortfall)}`);
  // 14 families for 10 slots, so the sabotage family may not be drawn at all —
  // what must NEVER happen is it appearing twice, which is the collision.
  let everTwice = "";
  for (let seed = 1; seed <= 120; seed++) {
    const a = buildAttempt({
      families: [...FAMILIES, oneStem],
      statuses: { ...APPROVED, [oneStem.key]: "approved" },
      pack: PACK, seed,
    });
    if (a.questions.filter((q) => q.familyKey === oneStem.key).length > 1) everTwice = `seed ${seed}`;
    if (a.questions.length !== ATTEMPT_SIZE) everTwice = `seed ${seed}: only ${a.questions.length}`;
  }
  t("…across 120 seeds the exhausted family never appears twice, and ten is always reached",
    everTwice === "", everTwice);

  // ── (e) the guard of last resort is still in the file, and still an error ─
  // ⚠ HONEST NOTE: the fill above cannot emit a duplicate, so this guard is now
  // unreachable through buildAttempt's own path — a test cannot fire it without
  // breaking the fill on purpose. What IS tested is the property it defends:
  // across every configuration above, no attempt ever carried a repeated stem.
  // The throw stays as the assertion that the fill itself has not regressed.
  const guardPresent = readFileSync(
    join(process.cwd(), "src", "lib", "practice", "engine.ts"), "utf8",
  ).includes("duplicate stem in one attempt");
  t("the last-resort duplicate-stem guard is still present in the engine",
    guardPresent, guardPresent ? "" : "GUARD REMOVED — §99 has no backstop");

  // ── (f) §35: the four definition families now vary their stems ───────────
  for (const key of ["l1-def-particle-terms", "l1-def-empirical-formula", "l1-def-avogadro", "l1-def-mole-counting"]) {
    const f = FAMILIES.find((x) => x.key === key)!;
    const stems = new Set<string>();
    for (let seed = 1; seed <= 120; seed++) {
      const r = rng(seed);
      stems.add(f.generate(r).stem);
    }
    t(`§35 — ${key} produces more than one distinct stem`, stems.size >= 2, `${stems.size} stems`);
  }
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
