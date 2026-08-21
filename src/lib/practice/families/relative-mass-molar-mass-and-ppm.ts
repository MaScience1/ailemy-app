import { pick, shuffle, type Family } from "../engine.ts";

/**
 * Question families for Lesson 3 — Relative Mass, Molar Mass and ppm (§33).
 *
 * ============================================================================
 * ⚠ EVERY FACT BELOW IS IN THE DECK, AND THE TESTS CHECK THAT MECHANICALLY
 * ============================================================================
 * The Ar definition is slide 6's own text, character-for-character ("The
 * average mass of an atom of an element, compared to 1/12 of the mass of one
 * atom of carbon-12. It is a ratio, so it has no units."). The isotope data
 * are slide 7's (³⁵Cl mass 35 / 75%, ³⁷Cl mass 37 / 25% → 35.5). The Ar
 * values are the ones the deck displays: H 1.0, O 16.0, C 12.0 (s10/s12),
 * S 32.1, Cu 63.5 (s9), Ca 40.1 (s10/s22), Al 27.0 (s20), Mg 24.3 (s18),
 * Na 23.0 / Cl 35.5 (s8/s10) — and M(H₂O) = 18.0 (s11, s18). The hydrate
 * sums 249.6 (s9) and 246.4 (s19), the quick-check Mr values 44.0 / 98.1 /
 * 74.1 (s10) and 102.0 (s20), and 22.0 g CO₂ → 0.500 mol (s12) are all the
 * deck's own worked numbers. The ppm rules are slides 13–16 (1 ppm = 1 mg
 * per 1 kg; ppm = (mass solute / mass solution) × 10⁶; reverse rule
 * mass(g) = ppm × 10⁻⁶ × mass solution(g); 1 % = 10,000 ppm) and the ppb
 * rules slides 18–19 and 26 (1 ppm = 1000 ppb, WHO guideline 10 ppb). Each
 * family's groundingTerms are checked against the extracted deck text at
 * serve time AND in the suite (§100).
 *
 * ⚠ Copper is deliberately ABSENT from the isotope-calculation family: the
 * deck displays Ar(Cu) = 63.5 but its ~69%/~31% abundances compute to 63.6,
 * so a computed answer would contradict the deck's own displayed value.
 * Chlorine's numbers are exact, so chlorine it is (§100 beats variety).
 *
 * ⚠ THE DISTRACTORS ARE THE DECK'S OWN MISTAKES (§38). Percentages instead
 * of fractional abundance (s7's RULE), forgetting to multiply the waters of
 * crystallisation by their coefficient (s9's EXAM RULE and mark scheme),
 * ignoring subscripts/brackets (s10's RULE, s21's COMMON MISTAKE), pinning
 * g mol⁻¹ onto the dimensionless Mr (s11's EXAM TRAP), dropping the ×10⁻⁶
 * (s16's reverse rule), mg-for-g mixing (s22's COMMON MISTAKE), and mixing
 * up ppm and ppb (s19's COMMON MISTAKE: ppb = ppm × 1000). Where the deck
 * names the misconception, wrongWhy repeats the deck's teaching; where it
 * does not (inverted divisions, bare power-of-ten slips), wrongWhy stays
 * silent rather than inventing feedback (§39, §51).
 *
 * ⚠ verify() RE-DERIVES FROM THE RENDERED STRINGS (§101). It parses the
 * quantities back out of the stem and the labelled-correct option text and
 * recomputes with its own expression — expanded additions instead of
 * reductions, raw-ratio ×10⁹ instead of ×1000, per-water 2(1.0)+16.0
 * instead of 18.0 — so a mislabelled option or a generate() bug surfaces as
 * "derivations disagree" and the variant is refused at birth.
 */

const SLUG = "relative-mass-molar-mass-and-ppm";

// ── local helpers (same discipline as the L1 module) ────────────────────────

const sf3 = (x: number) => Number(x.toPrecision(3));

/** Draw until the four option strings are distinct — bounded and
 *  deterministic; the banks below make collisions rare, this makes them
 *  impossible to serve. */
function distinct4<T>(r: () => number, draw: (r: () => number) => T & { options: string[] }): T {
  for (let i = 0; i < 12; i++) {
    const q = draw(r);
    if (new Set(q.options).size === 4) return q;
  }
  throw new Error("could not draw 4 distinct options — parameter ranges too tight");
}

// ── slide 8/18's molecular-vs-formula naming bank ───────────────────────────

const MR_TERM = [
  { sub: "H₂O", answer: "relative molecular mass", slide: 8 },
  { sub: "NaCl", answer: "relative formula mass", slide: 8 },
  { sub: "MgSO₄·7H₂O", answer: "relative formula mass", slide: 18 },
] as const;

const TERM_OPTIONS = [
  "relative molecular mass",
  "relative formula mass",
  "relative atomic mass",
  "relative isotopic mass",
] as const;

// ── slide 10/20's quick-check Mr bank — the deck's own Ar values ────────────

// NaCl is deliberately excluded: every subscript is 1, so the "ignored the
// subscripts" distractor would collide with the correct answer.
const MR_BANK = [
  { f: "CO₂", parts: [{ el: "C", ar: 12.0, n: 1 }, { el: "O", ar: 16.0, n: 2 }], slide: 10 },
  { f: "H₂SO₄", parts: [{ el: "H", ar: 1.0, n: 2 }, { el: "S", ar: 32.1, n: 1 }, { el: "O", ar: 16.0, n: 4 }], slide: 10 },
  { f: "Ca(OH)₂", parts: [{ el: "Ca", ar: 40.1, n: 1 }, { el: "O", ar: 16.0, n: 2 }, { el: "H", ar: 1.0, n: 2 }], slide: 10 },
  { f: "Al₂O₃", parts: [{ el: "Al", ar: 27.0, n: 2 }, { el: "O", ar: 16.0, n: 3 }], slide: 20 },
] as const;

// ── slide 9/18-19's hydrated salts ──────────────────────────────────────────

const HYDRATES = [
  {
    f: "CuSO₄·5H₂O",
    name: "the hydrated salt CuSO₄·5H₂O",
    anh: [{ el: "Cu", ar: 63.5, n: 1 }, { el: "S", ar: 32.1, n: 1 }, { el: "O", ar: 16.0, n: 4 }],
    waters: 5,
    slide: 9,
  },
  {
    f: "MgSO₄·7H₂O",
    name: "hydrated magnesium sulfate, MgSO₄·7H₂O",
    anh: [{ el: "Mg", ar: 24.3, n: 1 }, { el: "S", ar: 32.1, n: 1 }, { el: "O", ar: 16.0, n: 4 }],
    waters: 7,
    slide: 19,
  },
] as const;

// ── n = m/M substances — M values the deck itself displays ──────────────────

// Masses are chosen to divide cleanly by the deck's M values (the deck's own
// examples 22.0 g CO₂ and 9.0 g H₂O are in the banks).
const MOLAR = [
  { name: "CO₂", M: 44.0, masses: [11.0, 22.0, 33.0, 88.0], slide: 12 },
  { name: "H₂O", M: 18.0, masses: [4.5, 9.0, 27.0, 36.0], slide: 20 },
] as const;

// ── ppm parameter banks — ions, ppm values and volumes from slides 16/17/22 ─

const PPM_RESTATE = [
  { ion: "Mg²⁺", ppm: 50, slide: 17 },
  { ion: "Ca²⁺", ppm: 80, slide: 16 },
] as const;

const PPM_LEVELS = [50, 80] as const; // s17 / s22 and s16
const BOTTLE_ML = [250, 500, 1000] as const; // s16, s22, s15

// Pb²⁺ mg-per-litre levels around the deck's own 0.015 (s18) and 0.020
// (s26) — all exceed the WHO guideline of 10 ppb once converted.
const PB_MG_PER_L = [0.012, 0.015, 0.02, 0.03] as const;

export const FAMILIES: Family[] = [
  // ══ 1.4 — definitions ═════════════════════════════════════════════════════
  {
    key: "l3-def-ar",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "definition",
    sourceSlides: [3, 6],
    groundingTerms: ["average mass of an atom", "1/12 of the mass", "it is a ratio, so it has no units"],
    generate: (r) => {
      const correct = "The average mass of an atom of an element, compared to 1/12 of the mass of one atom of carbon-12.";
      const molar = "The mass of one mole of a substance, in g mol⁻¹.";
      const mr = "The sum of Aᵣ over every atom in the molecular formula.";
      const moleOfAtoms = "The mass of 6.02 × 10²³ atoms of the element.";
      const options = shuffle(r, [correct, molar, mr, moleOfAtoms]);
      return {
        stem: "Which of these is the definition of relative atomic mass, Aᵣ?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          'Slide 6: "The average mass of an atom of an element, compared to 1/12 of the mass of one atom of carbon-12. It is a ratio, so it has no units." Carbon-12 is fixed by definition, and everything else is measured against 1/12 of it.',
        wrongWhy: {
          [options.indexOf(molar)]:
            "That is the molar mass M — slide 11's exam trap: Mᵣ and Aᵣ have no units, M is in g mol⁻¹. They share digits but mean different things.",
          [options.indexOf(mr)]:
            "That is Mᵣ, the relative molecular mass — slide 8: the sum of Aᵣ across a formula, not the mass of one atom.",
          [options.indexOf(moleOfAtoms)]:
            "That describes one mole — slide 3: M(Cl) is the mass of 6.02 × 10²³ Cl atoms. Aᵣ is a ratio for ONE atom on the ¹²C scale.",
        },
        reviewSlide: 6,
      };
    },
  },
  {
    key: "l3-def-ppm",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "definition",
    sourceSlides: [13, 14, 18],
    groundingTerms: ["parts per million", "1 mg per 1 kg", "trace"],
    generate: (r) => {
      const correct = "1 part in 10⁶ — 1 mg of solute per 1 kg of solution.";
      const ppb = "1 part in 10⁹ — the scale used for parts per billion.";
      const percent = "1 part in 100 — the percentage scale.";
      const gram = "1 g of solute per 1 kg of solution.";
      const options = shuffle(r, [correct, ppb, percent, gram]);
      return {
        stem: "Trace concentrations are expressed in ppm. What exactly is 1 ppm?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 13: 1 ppm = 1 part in 10⁶ = 1 mg per 1 kg = 1 mg per 1 L of water — the scale for trace levels like fluoride in tap water or CO₂ in the atmosphere.",
        wrongWhy: {
          [options.indexOf(ppb)]:
            "1 in 10⁹ is a part per BILLION — slide 18: ppm is a 10⁶ ratio, ppb a 10⁹ ratio, and 1 ppm = 1000 ppb.",
          [options.indexOf(percent)]:
            "1 in 100 is a percent — slide 14's conversion: 1 % = 10,000 ppm, four orders of magnitude coarser.",
          [options.indexOf(gram)]:
            "A thousand times too much — slide 14: 1 ppm = 0.001 g per kg. At the ppm scale the solute is measured in milligrams.",
        },
        reviewSlide: 13,
      };
    },
  },

  // ══ 1.4 — classification ══════════════════════════════════════════════════
  {
    key: "l3-cls-mr-term",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "classification",
    sourceSlides: [8, 18],
    groundingTerms: ["relative molecular mass", "relative formula mass", "giant lattice"],
    generate: (r) => {
      const target = pick(r, MR_TERM);
      const options = shuffle(r, [...TERM_OPTIONS]);
      return {
        stem: `Mᵣ of ${target.sub} is found by counting each atom, multiplying by Aᵣ and adding. Which term properly names that quantity for ${target.sub}?`,
        options,
        correctIndex: options.indexOf(target.answer),
        explanation:
          target.sub === "H₂O"
            ? "Slide 8: for covalent compounds with discrete molecules the term is relative MOLECULAR mass — H₂O → 2(1.0) + 16.0 = 18.0. Same arithmetic as formula mass; the only difference is the name."
            : target.sub === "NaCl"
              ? "Slide 8: NaCl is ionic — no discrete molecules, a giant lattice — so the term is relative FORMULA mass: 23.0 + 35.5 = 58.5. Same arithmetic, different name."
              : "Slide 18 asks for exactly this: the relative FORMULA mass of hydrated magnesium sulfate — an ionic lattice, so formula mass is the name, produced by the same count-multiply-add arithmetic as slide 8.",
        wrongWhy:
          target.answer === "relative molecular mass"
            ? {
                [options.indexOf("relative formula mass")]:
                  "Formula mass is the name slide 8 reserves for ionic compounds — a giant lattice with no discrete molecules. H₂O is covalent, with discrete molecules.",
                [options.indexOf("relative atomic mass")]:
                  "Aᵣ belongs to atoms of a single element (slide 6) — a compound's value, summed across the formula, is Mᵣ.",
              }
            : {
                [options.indexOf("relative molecular mass")]:
                  "Slide 8: an ionic compound has no discrete molecules — a giant lattice — so its quantity is the relative formula mass, not molecular.",
                [options.indexOf("relative atomic mass")]:
                  "Aᵣ belongs to atoms of a single element (slide 6) — a compound's value, summed across the formula, is Mᵣ.",
              },
        reviewSlide: target.slide,
      };
    },
  },
  {
    key: "l3-cls-ppm-scale",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "classification",
    sourceSlides: [13, 16, 17],
    groundingTerms: ["50 ppm", "completely different scales", "mol dm⁻³"],
    generate: (r) => {
      const t = pick(r, PPM_RESTATE);
      const correct = `${t.ppm} mg of ${t.ion} in 1 kg of solution`;
      const pc = `${t.ppm} % ${t.ion} by mass`;
      const molar = `${t.ppm} mol dm⁻³ of ${t.ion}`;
      const grams = `${t.ppm} g of ${t.ion} in 1 kg of solution`;
      const options = shuffle(r, [correct, pc, molar, grams]);
      return {
        stem: `A water sample contains ${t.ppm} ppm of ${t.ion}. Which restatement is correct?`,
        options,
        correctIndex: options.indexOf(correct),
        explanation: `Slide 17: ppm, % and mol dm⁻³ describe completely different scales. ${t.ppm} ppm means ${t.ppm} mg of ${t.ion} in 1 kg (≈ 1 L) of solution — slide 13's rule: 1 ppm = 1 mg per 1 kg.`,
        wrongWhy: {
          [options.indexOf(pc)]:
            `Slide 17's trap: the percent scale is 10,000× coarser (1 % = 10,000 ppm) — ${t.ppm} % would be ${(t.ppm * 10000).toLocaleString("en-US")} ppm, a HUGE concentration, not a trace level.`,
          [options.indexOf(molar)]:
            `Slide 17's trap: ppm is a mass ratio, not an amount concentration — ${t.ppm} mol dm⁻³ of ${t.ion} would be physically impossible.`,
          [options.indexOf(grams)]:
            "Grams overstate it a thousandfold — slide 14: 1 ppm = 0.001 g per kg, so at this scale the solute is milligrams.",
        },
        reviewSlide: t.slide === 17 ? 17 : 16,
      };
    },
  },

  // ══ 1.4 — formulas ════════════════════════════════════════════════════════
  {
    key: "l3-formula-ppm",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "formula",
    sourceSlides: [14, 18],
    groundingTerms: ["mass of solute / mass of solution", "parts per billion", "10,000 ppm"],
    generate: (r) => {
      const correct = "(mass of solute ÷ mass of solution) × 10⁶";
      const ppb = "(mass of solute ÷ mass of solution) × 10⁹";
      const inverted = "(mass of solution ÷ mass of solute) × 10⁶";
      const percent = "(mass of solute ÷ mass of solution) × 100";
      const options = shuffle(r, [correct, ppb, inverted, percent]);
      return {
        stem: "Which expression gives a mass-based concentration in parts per million?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 14's definition: ppm = (mass of solute / mass of solution) × 10⁶ — one part in a million. For dilute aqueous solutions this makes mg per L numerically the same as ppm, because 1 L of water has mass ≈ 1 kg.",
        wrongWhy: {
          [options.indexOf(ppb)]:
            "×10⁹ is the parts-per-billion ratio — slide 18: ppm is a 10⁶ ratio and ppb a 10⁹ ratio, with 1 ppm = 1000 ppb.",
          [options.indexOf(percent)]:
            "×100 gives a percentage — a far coarser scale. Slide 14: 1 % = 10,000 ppm.",
        },
        reviewSlide: 14,
      };
    },
  },
  {
    key: "l3-formula-n-from-m",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "formula",
    sourceSlides: [11, 12],
    groundingTerms: ["n = m / m", "m = n × m", "translate between lab mass"],
    generate: (r) => {
      const correct = "n = m ÷ M";
      const times = "n = m × M";
      const inverted = "n = M ÷ m";
      const reverse = "m = n × M";
      const options = shuffle(r, [correct, times, inverted, reverse]);
      return {
        stem: "A sample's mass m is measured in grams and its molar mass M is known in g mol⁻¹. Which formula gives the amount of substance n in moles?",
        options,
        correctIndex: options.indexOf(correct),
        explanation:
          "Slide 11: n = m / M counts moles from mass and M. M translates between lab mass (g) and amount (mol) — slide 12's worked example: 22.0 / 44.0 = 0.500 mol of CO₂.",
        wrongWhy: {
          [options.indexOf(times)]:
            "Multiplying goes the wrong way — slide 12: m = n × M is the reverse direction, from moles back to grams.",
          [options.indexOf(reverse)]:
            "A true relation, but the reverse one — slide 12: use m = n × M to go from moles BACK to grams. The question asks for n from m.",
        },
        reviewSlide: 11,
      };
    },
  },

  // ══ 1.4 — calculations, every answer computed then independently verified ═
  {
    key: "l3-calc-ar-isotopes",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "calculation",
    sourceSlides: [2, 6, 7],
    groundingTerms: ["mass 35, abundance 75%", "fractional abundance", "weighted"],
    generate: (r) =>
      distinct4(r, (r2) => {
        // Chlorine only — the one element whose displayed Ar the deck's own
        // abundances reproduce exactly (see header).
        const iso = shuffle(r2, [
          { sym: "³⁵Cl", m: 35, pc: 75 },
          { sym: "³⁷Cl", m: 37, pc: 25 },
        ] as const);
        const ar = iso.reduce((s, i) => s + i.m * (i.pc / 100), 0);
        const simpleMean = (iso[0].m + iso[1].m) / 2;
        const pcSlip = iso.reduce((s, i) => s + i.m * i.pc, 0);
        const invertedWeights = iso[0].m * (iso[1].pc / 100) + iso[1].m * (iso[0].pc / 100);
        const options = shuffle(r2, [
          ar.toFixed(1),
          simpleMean.toFixed(1),
          pcSlip.toFixed(1),
          invertedWeights.toFixed(1),
        ]);
        return {
          stem: `Chlorine has two stable isotopes: ${iso[0].sym} (mass ${iso[0].m}, abundance ${iso[0].pc}%) and ${iso[1].sym} (mass ${iso[1].m}, abundance ${iso[1].pc}%). Calculate Aᵣ(Cl).`,
          options,
          correctIndex: options.indexOf(ar.toFixed(1)),
          explanation:
            "Weight each isotope mass by its FRACTIONAL abundance, then sum — slide 7: (35 × 0.75) + (37 × 0.25) = 26.25 + 9.25 = 35.5, matching the periodic table value to 1 dp. No single atom has that mass; a real sample does on average.",
          wrongWhy: {
            [options.indexOf(pcSlip.toFixed(1))]:
              "Percentages were used instead of fractions — slide 7's rule: use FRACTIONAL abundance (0.75); if percentages are used, divide the final answer by 100.",
            [options.indexOf(simpleMean.toFixed(1))]:
              "An unweighted mean ignores abundance — slide 6: Aᵣ is the abundance-weighted mean, because ³⁵Cl (75%) dominates a real sample.",
            [options.indexOf(invertedWeights.toFixed(1))]:
              "The abundances are swapped between the isotopes — slide 7: ³⁵Cl is the most common (75%) and must carry the larger weight.",
          },
          reviewSlide: 7,
        };
      }),
    verify: (q) => {
      const m = q.stem.match(/\(mass (\d+), abundance (\d+)%\).*\(mass (\d+), abundance (\d+)%\)/);
      const got = Number(q.options[q.correctIndex]);
      if (!m || !Number.isFinite(got)) return false;
      const expected = (Number(m[1]) * Number(m[2]) + Number(m[3]) * Number(m[4])) / 100;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l3-calc-mr",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "calculation",
    sourceSlides: [10, 20],
    groundingTerms: ["h₂so₄", "including atoms inside brackets", "al₂o₃"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const t = pick(r2, MR_BANK);
        const mr = t.parts.reduce((s, p) => s + p.ar * p.n, 0);
        const onceEach = t.parts.reduce((s, p) => s + p.ar, 0);
        const mrStr = mr.toFixed(1);
        const options = shuffle(r2, [
          mrStr,
          `${mrStr} g mol⁻¹`,
          onceEach.toFixed(1),
          (mr * 10).toFixed(1),
        ]);
        return {
          stem: `Quick check: calculate Mᵣ of ${t.f}. Use ${t.parts.map((p) => `Aᵣ(${p.el}) = ${p.ar.toFixed(1)}`).join(", ")}.`,
          options,
          correctIndex: options.indexOf(mrStr),
          explanation: `Multiply each Aᵣ by the count of that atom — including atoms inside brackets — then sum (slide 10's rule): ${t.parts.map((p) => `${p.n}(${p.ar.toFixed(1)})`).join(" + ")} = ${mrStr}. Mᵣ is dimensionless, like the Aᵣ values it is built from.`,
          wrongWhy: {
            [options.indexOf(onceEach.toFixed(1))]:
              "Each Aᵣ was counted once — the subscripts were ignored. Slide 10's rule: multiply Aᵣ by the count of each atom, including atoms inside brackets, then sum.",
            [options.indexOf(`${mrStr} g mol⁻¹`)]:
              "Mᵣ is a dimensionless ratio (slide 10). The same number in g mol⁻¹ is the molar mass M — slide 11's exam trap is exactly this confusion.",
          },
          reviewSlide: t.slide,
        };
      }),
    verify: (q) => {
      const f = q.stem.match(/Mᵣ of (.+?)\. Use/)?.[1];
      const expected =
        f === "CO₂" ? 12.0 + 16.0 + 16.0
        : f === "H₂SO₄" ? 1.0 + 1.0 + 32.1 + 16.0 + 16.0 + 16.0 + 16.0
        : f === "Ca(OH)₂" ? 40.1 + 16.0 + 1.0 + 16.0 + 1.0
        : f === "Al₂O₃" ? 27.0 + 27.0 + 16.0 + 16.0 + 16.0
        : NaN;
      const got = Number(q.options[q.correctIndex]);
      if (!Number.isFinite(expected) || !Number.isFinite(got)) return false;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l3-calc-mr-hydrate",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "calculation",
    sourceSlides: [9, 18, 19],
    groundingTerms: ["cuso₄·5h₂o", "waters of crystallisation", "mgso₄·7h₂o"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const t = pick(r2, HYDRATES);
        const anh = t.anh.reduce((s, p) => s + p.ar * p.n, 0);
        const mr = anh + t.waters * 18.0;
        const mrStr = mr.toFixed(1);
        const waterOnce = (anh + 18.0).toFixed(1);
        const noWater = anh.toFixed(1);
        const options = shuffle(r2, [mrStr, waterOnce, noWater, `${mrStr} g mol⁻¹`]);
        return {
          stem: `Calculate the relative formula mass Mᵣ of ${t.name}. Use ${t.anh.map((p) => `Aᵣ(${p.el}) = ${p.ar.toFixed(1)}`).join(", ")}, Aᵣ(H) = 1.0, and M(H₂O) = 18.0.`,
          options,
          correctIndex: options.indexOf(mrStr),
          explanation: `The dot · means waters of crystallisation — multiply each H₂O by its coefficient (slide 9's exam rule): Mᵣ = ${t.anh.map((p) => `${p.n}(${p.ar.toFixed(1)})`).join(" + ")} + ${t.waters} × 18.0 = ${mrStr}${t.f === "MgSO₄·7H₂O" ? " — exactly slide 19's worked sum" : " — exactly slide 9's worked sum"}.`,
          wrongWhy: {
            [options.indexOf(waterOnce)]:
              `Only ONE H₂O was added — the coefficient multiplies the whole H₂O (slide 9's exam rule), so the water must be counted ×${t.waters} here.`,
            [options.indexOf(noWater)]:
              `The ·${t.waters}H₂O was dropped entirely — the waters of crystallisation are part of the formula (slide 9's exam rule).`,
            [options.indexOf(`${mrStr} g mol⁻¹`)]:
              "Relative formula mass is dimensionless — slide 21: no units. In g mol⁻¹ the number would be the molar mass M (slide 11's exam trap).",
          },
          reviewSlide: t.slide,
        };
      }),
    verify: (q) => {
      const expected = q.stem.includes("CuSO₄·5H₂O")
        ? 63.5 + 32.1 + 4 * 16.0 + 5 * (2 * 1.0 + 16.0)
        : q.stem.includes("MgSO₄·7H₂O")
          ? 24.3 + 32.1 + 4 * 16.0 + 7 * (2 * 1.0 + 16.0)
          : NaN;
      const got = Number(q.options[q.correctIndex]);
      if (!Number.isFinite(expected) || !Number.isFinite(got)) return false;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l3-calc-moles-from-mass",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "calculation",
    sourceSlides: [11, 12, 20],
    groundingTerms: ["22.0 / 44.0", "0.500 mol", "9.0 / 18.0"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const sub = pick(r2, MOLAR);
        const m = pick(r2, sub.masses);
        const n = sf3(m / sub.M);
        const options = shuffle(r2, [
          `${n} mol`,
          `${sf3(m * sub.M)} mol`, // × for ÷
          `${sf3(sub.M / m)} mol`, // inverted the division
          `${sf3(n * 10)} mol`, // power-of-ten slip
        ]);
        return {
          stem: `How many moles of ${sub.name} are in ${m.toFixed(1)} g? (M(${sub.name}) = ${sub.M.toFixed(1)} g mol⁻¹)`,
          options,
          correctIndex: options.indexOf(`${n} mol`),
          explanation: `n = m / M = ${m.toFixed(1)} / ${sub.M.toFixed(1)} = ${n} mol — slide 12's routine. Check by reversing: m = n × M = ${n} × ${sub.M.toFixed(1)} = ${m.toFixed(1)} g.`,
          wrongWhy: {
            [options.indexOf(`${sf3(m * sub.M)} mol`)]:
              "This multiplied instead of dividing — slide 12: m = n × M is the reverse direction, from moles back to grams. From grams to moles it is n = m / M.",
          },
          reviewSlide: sub.slide,
        };
      }),
    verify: (q) => {
      const m = Number(q.stem.match(/are in ([\d.]+) g\?/)?.[1]);
      const M = Number(q.stem.match(/= ([\d.]+) g mol⁻¹/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) mol$/)?.[1]);
      if (![m, M, got].every(Number.isFinite)) return false;
      const expected = m / M;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },

  // ══ 1.4 — application: ppm both ways, and the ppb ladder ══════════════════
  {
    key: "l3-app-ppm-to-mass",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "application",
    sourceSlides: [16, 22],
    groundingTerms: ["mineral water", "80 ppm", "1 g ml⁻¹"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const ppm = pick(r2, PPM_LEVELS);
        const V = pick(r2, BOTTLE_ML);
        const massG = sf3(ppm * 1e-6 * V);
        const options = shuffle(r2, [
          `${massG} g`,
          `${sf3(ppm * V)} g`, // dropped the ×10⁻⁶
          `${sf3(massG * 1000)} g`, // mg-for-g mix-up
          `${massG} mg`, // right digits, wrong unit
        ]);
        return {
          stem: `A ${V} mL bottle of mineral water lists Ca²⁺ at ${ppm} ppm. Calculate the mass of Ca²⁺ in the bottle. (Take 1 mL of water ≈ 1 g.)`,
          options,
          correctIndex: options.indexOf(`${massG} g`),
          explanation: `Slide 16's reverse rule: mass(g) = ppm × 10⁻⁶ × mass solution(g). ${V} mL ≈ ${V} g, so m = ${ppm} × 10⁻⁶ × ${V} = ${massG} g = ${sf3(massG * 1000)} mg — the same stepped route as slide 22's exam-style answer.`,
          wrongWhy: {
            [options.indexOf(`${sf3(ppm * V)} g`)]:
              "The ×10⁻⁶ was dropped — ppm means parts per MILLION. Slide 16's rule: mass(g) = ppm × 10⁻⁶ × mass solution(g).",
            [options.indexOf(`${sf3(massG * 1000)} g`)]:
              "A mg-for-g mix-up — slide 22's common mistake: ppm needs the SAME mass units top and bottom. Use grams everywhere, then convert at the end if mg are required.",
            [options.indexOf(`${massG} mg`)]:
              `The number is right in grams, not milligrams — slide 16: the result inherits the units of the solution mass. In mg it would be ${sf3(massG * 1000)} mg.`,
          },
          reviewSlide: 16,
        };
      }),
    verify: (q) => {
      const V = Number(q.stem.match(/A ([\d.]+) mL/)?.[1]);
      const ppm = Number(q.stem.match(/at ([\d.]+) ppm/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.]+) g$/)?.[1]);
      if (![V, ppm, got].every(Number.isFinite)) return false;
      const expected = (ppm * V) / 1e6;
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
  {
    key: "l3-app-ppm-ppb",
    lessonSlug: SLUG,
    specCode: "1.4",
    kind: "application",
    sourceSlides: [18, 19, 26],
    groundingTerms: ["1 ppm = 1000 ppb", "0.020 mg per l", "who guideline"],
    generate: (r) =>
      distinct4(r, (r2) => {
        const X = pick(r2, PB_MG_PER_L);
        const xStr = X.toFixed(3);
        const ppb = sf3(X * 1000);
        const options = shuffle(r2, [
          `${ppb} ppb`,
          `${xStr} ppb`, // relabelled the ppm number as ppb
          `${sf3(X * 1e6)} ppb`, // ×10⁶ power-of-ten slip
          `${sf3(X / 1000)} ppb`, // divided instead of multiplying
        ]);
        return {
          stem: `Tap water in a region contains ${xStr} mg of Pb²⁺ per litre. Express this concentration in ppb. (1 L of water ≈ 1 kg; 1 ppm = 1000 ppb.)`,
          options,
          correctIndex: options.indexOf(`${ppb} ppb`),
          explanation: `${xStr} mg per L ≈ ${xStr} ppm, because mg per L is numerically the same as ppm in dilute aqueous solution (slide 13). Then ppb = ppm × 1000 = ${ppb} ppb — above the WHO guideline limit of 10 ppb (slide 19), so this water exceeds it.`,
          wrongWhy: {
            [options.indexOf(`${xStr} ppb`)]:
              "This is the ppm value relabelled — slide 19's common mistake: mixing up ppm and ppb. ppb = ppm × 1000, and drinking-water limits for trace metals are usually quoted in ppb.",
            [options.indexOf(`${sf3(X / 1000)} ppb`)]:
              "Divided by 1000 instead of multiplying — 1 ppm = 1000 ppb, so the ppb number is a thousand times BIGGER than the ppm number.",
          },
          reviewSlide: 19,
        };
      }),
    verify: (q) => {
      const X = Number(q.stem.match(/contains ([\d.]+) mg of Pb²⁺ per litre/)?.[1]);
      const got = Number(q.options[q.correctIndex].match(/^([\d.eE+-]+) ppb$/)?.[1]);
      if (![X, got].every(Number.isFinite)) return false;
      const expected = ((X * 1e-3) / 1000) * 1e9; // raw mass ratio, then ×10⁹
      return Math.abs(got - expected) / expected < 0.005;
    },
  },
];
